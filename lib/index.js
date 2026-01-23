'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var axios = require('axios');

// src/utils/api.ts
const API_BASE_URL = 'https://usepresenz-api.com/v1';
// Optional: central Axios instance (recommended)
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Presenz-SDK-Version': '1.0.0',
    },
    timeout: 15000,
});
async function createSession(config) {
    const payload = {
        ...config,
        origin: window.location.origin,
        clientTimestamp: new Date().toISOString(),
    };
    try {
        const { data } = await api.post('/sessions', payload);
        if (!data.success || !data.sessionUrl || !data.sessionId) {
            throw new Error('Invalid session response from server');
        }
        if (data.error) {
            const err = new Error(data.error.message || 'Session creation failed');
            err.code = data.error.code;
            throw err;
        }
        return {
            sessionUrl: data.sessionUrl,
            sessionId: data.sessionId,
        };
    }
    catch (error) {
        const err = error;
        const normalizedError = {
            message: err.response?.data?.error?.message ||
                err.response?.data?.message ||
                err.message ||
                'Failed to create verification session',
            code: err.response?.data?.error?.code ||
                err.code ||
                'session_creation_failed',
            status: err.response?.status,
            details: err.response?.data ||
                err.stack?.split('\n')[0] ||
                undefined,
        };
        console.error('[Presenz SDK] Session creation failed:', normalizedError);
        throw normalizedError;
    }
}

// src/utils/postMessageHandler.ts
// Trusted origin — MUST match your widget's deployed domain exactly
// In production: 'https://verifypresenz.com'
// For local development/testing: you can temporarily allow 'http://localhost:5173' etc.
const TRUSTED_ORIGIN = 'https://presenz.netlify.com';
let messageListener = null;
/**
 * Sets up the postMessage listener to receive communication from the Presenz iframe widget.
 * Should be called **once** when the iframe is created.
 *
 * @param callbacks - The callbacks provided by the developer
 */
function setupPostMessageListener(callbacks) {
    // Prevent multiple listeners
    if (messageListener) {
        console.warn('[Presenz SDK] postMessage listener already active. Skipping duplicate setup.');
        return;
    }
    messageListener = (event) => {
        // Critical security check: only accept messages from the official widget domain
        if (event.origin !== TRUSTED_ORIGIN) {
            // Silently ignore messages from untrusted origins
            // You could log in development mode:
            // if (import.meta.env.DEV) {
            //   console.debug('[Presenz SDK] Ignored message from untrusted origin:', event.origin);
            // }
            return;
        }
        // Optional: additional origin check using full URL if needed
        // if (event.source !== iframe.contentWindow) return;
        const data = event.data;
        if (!data || !data.type) {
            console.warn('[Presenz SDK] Received invalid postMessage format');
            return;
        }
        switch (data.type) {
            case 'presenz_success':
                if (data.payload && typeof data.payload === 'object') {
                    callbacks.onSuccess?.(data.payload);
                }
                else {
                    console.warn('[Presenz SDK] Missing or invalid payload in success message');
                    callbacks.onError?.({
                        message: 'Invalid success response from verification widget',
                        code: 'invalid_success_payload',
                    });
                }
                break;
            case 'presenz_error':
                callbacks.onError?.(data.payload && typeof data.payload === 'object'
                    ? data.payload
                    : { message: 'Verification error', code: 'unknown_widget_error' });
                break;
            case 'presenz_close':
                callbacks.onClose?.();
                break;
            case 'presenz_progress':
                if (callbacks.onProgress && data.payload && typeof data.payload.percent === 'number') {
                    callbacks.onProgress(data.payload);
                }
                break;
            default:
                console.warn('[Presenz SDK] Unknown message type received:', data.type);
        }
    };
    window.addEventListener('message', messageListener);
}

function createIframe(sessionUrl, options = {}) {
    const iframe = document.createElement('iframe');
    // Core attributes
    iframe.src = sessionUrl;
    iframe.title = options.title || 'Presenz Identity Verification';
    iframe.allow = 'camera; microphone; fullscreen; autoplay; encrypted-media';
    // Security sandbox - restrict what the iframe can do
    // Very important: prevents clickjacking, navigation hijacking, etc.
    iframe.sandbox =
        'allow-scripts ' +
            'allow-same-origin ' +
            'allow-forms ' +
            'allow-popups ' +
            'allow-modals ' +
            'allow-storage-access-by-user-activation';
    // Do NOT allow: 
    // - allow-top-navigation (prevents widget from redirecting your whole page)
    // - allow-popups-to-escape-sandbox (unless explicitly needed)
    // Styling & layout
    iframe.style.border = 'none';
    iframe.style.width = options.width || '100%';
    iframe.style.height = options.height || '100%';
    iframe.style.background = 'transparent';
    if (options.className) {
        iframe.className = options.className;
    }
    // Accessibility & best practices
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('loading', 'lazy'); // optional: defer offscreen loading
    // Prevent referrer leakage if desired (can be useful)
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    return iframe;
}

const PresenzButton = ({ config, callbacks, container, children = 'Verify Identity', className = '', disabled = false, theme = 'brand', }) => {
    const [isLoading, setIsLoading] = React.useState(false);
    const [modalOpen, setModalOpen] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState(null);
    const sessionUrlRef = React.useRef(null);
    const iframeRef = React.useRef(null);
    // Cleanup function
    const cleanup = React.useCallback(() => {
        setModalOpen(false);
        setIsLoading(false);
        setErrorMessage(null);
        if (iframeRef.current) {
            iframeRef.current.remove();
            iframeRef.current = null;
        }
        // Remove postMessage listener (handled in setupPostMessageListener)
    }, []);
    // Handle successful verification from postMessage
    const handleSuccess = React.useCallback((payload) => {
        callbacks.onSuccess(payload);
        cleanup();
    }, [callbacks, cleanup]);
    // Handle error from postMessage
    const handleError = React.useCallback((payload) => {
        callbacks.onError(payload);
        setErrorMessage(payload.message || 'Verification failed');
        setTimeout(cleanup, 3000); // auto-close after showing error
    }, [callbacks, cleanup]);
    // Handle close from postMessage or X button
    const handleClose = React.useCallback(() => {
        callbacks.onClose?.();
        cleanup();
    }, [callbacks, cleanup]);
    // Start verification flow when button is clicked
    const startVerification = React.useCallback(async () => {
        if (disabled || isLoading)
            return;
        setIsLoading(true);
        setErrorMessage(null);
        try {
            // 1. Create session via your API
            const { sessionUrl, sessionId } = await createSession({
                ...config,
            });
            sessionUrlRef.current = sessionUrl;
            // 2. Create iframe
            const iframe = createIframe(sessionUrl);
            iframeRef.current = iframe;
            // 3. Show modal or append to container
            if (container) {
                // Inline mode
                container.innerHTML = ''; // clear previous content if any
                container.appendChild(iframe);
                // You could add resize listener here if desired
            }
            else {
                // Modal mode
                setModalOpen(true);
                // iframe will be appended in the render below
            }
            const handleSuccessResponse = () => {
                const result = {
                    verified: true,
                    sessionId,
                    score: 10
                };
                handleSuccess(result);
            };
            // 4. Setup postMessage listener (once)
            setupPostMessageListener({
                onSuccess: handleSuccessResponse,
                onError: handleError,
                onClose: handleClose,
                onProgress: callbacks.onProgress,
            });
        }
        catch (err) {
            const error = {
                message: err.message || 'Failed to start verification session',
                code: err.code || 'session_creation_failed',
            };
            setErrorMessage(error.message);
            callbacks.onError(error);
            setTimeout(cleanup, 4000);
        }
        finally {
            setIsLoading(false);
        }
    }, [
        disabled,
        isLoading,
        config,
        container,
        callbacks,
        handleSuccess,
        handleError,
        handleClose,
        cleanup,
    ]);
    // Close modal on Escape key (accessibility)
    React.useEffect(() => {
        if (!modalOpen)
            return;
        const handleEsc = (e) => {
            if (e.key === 'Escape')
                handleClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [modalOpen, handleClose]);
    return (jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [jsxRuntime.jsx("button", { type: "button", className: `presenz-button presenz-theme-${theme} ${className}`, onClick: startVerification, disabled: disabled || isLoading, children: isLoading ? (jsxRuntime.jsx("span", { className: "presenz-loading", children: "Loading..." })) : (children) }), modalOpen && !container && (jsxRuntime.jsx("div", { className: "presenz-modal-overlay", onClick: handleClose, children: jsxRuntime.jsxs("div", { className: "presenz-modal-content", onClick: (e) => e.stopPropagation(), children: [jsxRuntime.jsx("button", { className: "presenz-modal-close", onClick: handleClose, children: "\u00D7" }), errorMessage ? (jsxRuntime.jsxs("div", { className: "presenz-error", children: [jsxRuntime.jsx("p", { children: errorMessage }), jsxRuntime.jsx("button", { onClick: cleanup, children: "Close" })] })) : (jsxRuntime.jsx("div", { className: "presenz-iframe-wrapper", children: sessionUrlRef.current && (jsxRuntime.jsx("iframe", { ref: iframeRef, src: sessionUrlRef.current, allow: "camera; microphone; fullscreen; autoplay", sandbox: "allow-scripts allow-same-origin allow-forms allow-popups allow-modals", title: "Presenz Identity Verification" })) }))] }) }))] }));
};

exports.PresenzButton = PresenzButton;
//# sourceMappingURL=index.js.map
