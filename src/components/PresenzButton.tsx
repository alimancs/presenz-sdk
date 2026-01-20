import React, { useState, useEffect, useCallback, ReactNode } from 'react';

import { createSession } from '../utils/api';
import { setupPostMessageListener } from '../utils/postMessageHandler';
import { createIframe } from '../utils/iframe';
import { PresenzCallbacks } from '../types';

import './PresenzButton.css'; 

interface PresenzConfig {
  publicKey: string;
  userId?: string;
  email?: string;
  metadata?: Record<string, any>;
  redirectUrl?: string;
}


interface PresenzButtonProps {
  config: PresenzConfig;
  callbacks: PresenzCallbacks;
  container?: HTMLElement;           // optional: render inline instead of modal
  children?: ReactNode;              // button content
  className?: string;                // custom button class
  disabled?: boolean;
  theme?: 'light' | 'dark' | 'brand'; // optional styling variant
}

export const PresenzButton: React.FC<PresenzButtonProps> = ({
  config,
  callbacks,
  container,
  children = 'Verify Identity',
  className = '',
  disabled = false,
  theme = 'brand',
}) => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [modalOpen, setModalOpen] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const sessionUrlRef = React.useRef<string | null>(null);
    const iframeRef = React.useRef<HTMLIFrameElement | null>(null);

    // Cleanup function
    const cleanup = useCallback(() => {
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
    const handleSuccess = useCallback((payload: any) => {
        callbacks.onSuccess(payload);
        cleanup();
    }, [callbacks, cleanup]);

    // Handle error from postMessage
    const handleError = useCallback((payload: any) => {
        callbacks.onError(payload);
        setErrorMessage(payload.message || 'Verification failed');
        setTimeout(cleanup, 3000); // auto-close after showing error
    }, [callbacks, cleanup]);

    // Handle close from postMessage or X button
    const handleClose = useCallback(() => {
        callbacks.onClose?.();
        cleanup();
    }, [callbacks, cleanup]);

    // Start verification flow when button is clicked
    const startVerification = useCallback(async () => {
        if (disabled || isLoading) return;

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
            } else {
                // Modal mode
                setModalOpen(true);
                // iframe will be appended in the render below
            }

            // 4. Setup postMessage listener (once)
            setupPostMessageListener({
                onSuccess: handleSuccess,
                onError: handleError,
                onClose: handleClose,
                onProgress: callbacks.onProgress,
            });

        } catch (err: any) {
            const error = {
                message: err.message || 'Failed to start verification session',
                code: err.code || 'session_creation_failed',
            };
            setErrorMessage(error.message);
            callbacks.onError(error);
            setTimeout(cleanup, 4000);
        } finally {
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
  useEffect(() => {
    if (!modalOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [modalOpen, handleClose]);

  return (
    <>
        {/* The button itself */}
        <button
            type="button"
            className={`presenz-button presenz-theme-${theme} ${className}`}
            onClick={startVerification}
            disabled={disabled || isLoading}
        >
            {isLoading ? (
            <span className="presenz-loading">Loading...</span>
            ) : (
            children
            )}
        </button>

      {/* Modal (only shown when !container and modalOpen) */}
      {modalOpen && !container && (
        <div className="presenz-modal-overlay" onClick={handleClose}>
            <div
                className="presenz-modal-content"
                onClick={(e) => e.stopPropagation()} // prevent close on content click
            >
                <button className="presenz-modal-close" onClick={handleClose}>
                ×
                </button>

                {errorMessage ? (
                <div className="presenz-error">
                    <p>{errorMessage}</p>
                    <button onClick={cleanup}>Close</button>
                </div>
                ) : (
                <div className="presenz-iframe-wrapper">
                    {sessionUrlRef.current && (
                    <iframe
                        ref={iframeRef}
                        src={sessionUrlRef.current}
                        allow="camera; microphone; fullscreen; autoplay"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                        title="Presenz Identity Verification"
                    />
                    )}
                </div>
                )}
            </div>
        </div>
      )}
    </>
  );
};