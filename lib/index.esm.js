import { jsxs, Fragment, jsx } from 'react/jsx-runtime';
import React, { useState, useCallback, useEffect } from 'react';

// src/utils/api.ts
// import axios, { AxiosError } from 'axios';
// interface SessionResponse {
//   success: boolean;
//   sessionUrl: string;
//   sessionId: string;
//   expiresAt?: string;
//   error?: {
//     code: string;
//     message: string;
//   };
// }
// const API_BASE_URL = 'https://usepresenz-api.com/v1';
// Optional: central Axios instance (recommended)
// const api = axios.create({
//   baseURL: API_BASE_URL,
//   headers: {
//     'Content-Type': 'application/json',
//     Accept: 'application/json',
//     'X-Presenz-SDK-Version': '1.0.0',
//   },
//   timeout: 15000,
// });
async function createSession(config) {
    // const payload: SessionRequestPayload = {
    //   ...config,
    //   origin: window.location.origin,
    //   clientTimestamp: new Date().toISOString(),
    // };
    console.log(config);
    try {
        // const { data } = await api.post<SessionResponse>('/sessions', payload);
        // if (!data.success || !data.sessionUrl || !data.sessionId) {
        //   throw new Error('Invalid session response from server');
        // }
        // if (data.error) {
        //   const err = new Error(data.error.message || 'Session creation failed');
        //   (err as any).code = data.error.code;
        //   throw err;
        // }
        const sessionUrl = "https://presenz.netlify.app/";
        const sessionId = "test";
        // return {
        //   sessionUrl: data.sessionUrl,
        //   sessionId: data.sessionId,
        // };
        return {
            sessionUrl,
            sessionId,
        };
    }
    catch (error) {
        // const err = error as AxiosError<any>;
        // const normalizedError = {
        //   message:
        //     err.response?.data?.error?.message ||
        //     err.response?.data?.message ||
        //     err.message ||
        //     'Failed to create verification session',
        //   code:
        //     err.response?.data?.error?.code ||
        //     err.code ||
        //     'session_creation_failed',
        //   status: err.response?.status,
        //   details:
        //     err.response?.data ||
        //     err.stack?.split('\n')[0] ||
        //     undefined,
        // };
        // console.error('[Presenz SDK] Session creation failed:', normalizedError);
        // throw normalizedError;
        console.error('[Presenz SDK] Session creation failed:');
        return {
            sessionId: "",
            sessionUrl: ""
        };
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

const PresenzButton = ({ config, callbacks, container, children = 'Presenz Verify Identity Button', className = '', disabled = false, theme = 'brand', }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [isIframeLoading, setIsIframeLoading] = useState(true);
    const sessionUrlRef = React.useRef(null);
    const iframeRef = React.useRef(null);
    // Cleanup function
    const cleanup = useCallback(() => {
        setModalOpen(false);
        setIsLoading(false);
        setIsIframeLoading(true);
        setErrorMessage(null);
        if (iframeRef.current) {
            iframeRef.current.remove();
            iframeRef.current = null;
        }
        // Remove postMessage listener (handled in setupPostMessageListener)
    }, []);
    // Handle successful verification from postMessage
    const handleSuccess = useCallback((payload) => {
        callbacks.onSuccess(payload);
        cleanup();
    }, [callbacks, cleanup]);
    // Handle error from postMessage
    const handleError = useCallback((payload) => {
        callbacks.onError(payload);
        setErrorMessage(payload.message || 'Verification failed');
        setTimeout(cleanup, 3000); // auto-close after showing error
    }, [callbacks, cleanup]);
    // Handle close from postMessage or X button
    const handleClose = useCallback(() => {
        callbacks.onClose?.();
        cleanup();
    }, [callbacks, cleanup]);
    // Handle iframe load event
    const handleIframeLoad = useCallback(() => {
        setIsIframeLoading(false);
    }, []);
    // Start verification flow when button is clicked
    const startVerification = useCallback(async () => {
        if (disabled || isLoading)
            return;
        setIsLoading(true);
        setErrorMessage(null);
        setIsIframeLoading(true);
        try {
            // 1. Create session via your API
            const { sessionUrl, sessionId } = await createSession({
                ...config,
            });
            sessionUrlRef.current = sessionUrl;
            // 2. Create iframe
            const iframe = createIframe(sessionUrl);
            iframeRef.current = iframe;
            // Add load event listener to hide loader
            iframe.addEventListener('load', handleIframeLoad);
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
        handleIframeLoad,
    ]);
    // Close modal on Escape key (accessibility)
    useEffect(() => {
        if (!modalOpen)
            return;
        const handleEsc = (e) => {
            if (e.key === 'Escape')
                handleClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [modalOpen, handleClose]);
    // Remove iframe load listener on cleanup
    useEffect(() => {
        return () => {
            if (iframeRef.current) {
                iframeRef.current.removeEventListener('load', handleIframeLoad);
            }
        };
    }, [handleIframeLoad]);
    return (jsxs(Fragment, { children: [jsx("button", { type: "button", className: `presenz-button presenz-theme-${theme} ${className}`, onClick: startVerification, disabled: disabled || isLoading, children: isLoading ? (jsx("span", { className: "presenz-loading", children: "Loading..." })) : (children) }), modalOpen && !container && (jsx("div", { className: "presenz-modal-overlay", style: {
                    position: 'fixed',
                    inset: 0,
                    width: '100vw',
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'white',
                    padding: '15px',
                }, onClick: handleClose, children: jsxs("div", { style: {
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                    }, onClick: (e) => e.stopPropagation(), children: [jsx("button", { style: {
                                width: '30px',
                                height: '30px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '5px',
                                backgroundColor: 'rgba(255, 255, 255, 0.50)',
                                border: '1px solid black',
                                color: 'black',
                                fontSize: '20px',
                            }, onClick: handleClose, children: "\u00D7" }), errorMessage ? (jsxs("div", { className: "presenz-error", children: [jsx("p", { children: errorMessage }), jsx("button", { onClick: cleanup, children: "Close" })] })) : (jsxs("div", { style: {
                                display: 'flex',
                                flexDirection: 'column',
                                flex: 1,
                                position: 'relative',
                            }, children: [isIframeLoading && (jsx("div", { style: {
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        zIndex: 10,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'white',
                                        padding: '20px',
                                        borderRadius: '12px',
                                    }, children: jsx("div", { style: {
                                            display: 'flex',
                                            gap: '5px',
                                        }, children: [0, 1, 2, 3, 4].map((index) => (jsx("div", { style: {
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                background: 'linear-gradient(135deg, #1E3E62 0%, #0B192C 100%)',
                                                animation: `dotPulse 1.5s ease-in-out ${index * 0.1}s infinite`,
                                                opacity: 0.7,
                                            } }, index))) }) })), jsx("style", { children: `
                    @keyframes dotPulse {
                      0%, 60%, 100% {
                        transform: translateY(0);
                        opacity: 0.7;
                      }
                      30% {
                        transform: translateY(-10px);
                        opacity: 1;
                      }
                    }
                  ` }), sessionUrlRef.current && (jsx("iframe", { style: {
                                        flex: 1,
                                        borderColor: 'transparent',
                                        opacity: isIframeLoading ? 0.3 : 1,
                                        transition: 'opacity 0.3s ease',
                                        pointerEvents: isIframeLoading ? 'none' : 'auto',
                                    }, ref: iframeRef, src: sessionUrlRef.current, onLoad: handleIframeLoad, allow: "camera; microphone; fullscreen; autoplay", sandbox: "allow-scripts allow-same-origin allow-forms allow-popups allow-modals", title: "Presenz Identity Verification" }))] }))] }) }))] }));
};

export { PresenzButton };
//# sourceMappingURL=index.esm.js.map
