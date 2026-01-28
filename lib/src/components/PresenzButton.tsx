import React, { useState, useCallback, useEffect, ReactNode } from 'react';
import { createSession } from '../utils/api';
import { setupPostMessageListener } from '../utils/postMessageHandler';
import { createIframe } from '../utils/iframe';
import { PresenzCallbacks } from '../types';
import './presenzButton.css';

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
  container?: HTMLElement; // optional: render inline instead of modal
  children?: ReactNode; // button content
  className?: string; // custom button class
  disabled?: boolean;
  theme?: 'light' | 'dark' | 'brand'; // optional styling variant
}

const PresenzButton: React.FC<PresenzButtonProps> = ({
  config,
  callbacks,
  container,
  children = 'Presenz Verify Identity Button',
  className = '',
  disabled = false,
  theme = 'brand',
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isIframeLoading, setIsIframeLoading] = useState<boolean>(true);
  const sessionUrlRef = React.useRef<string | null>(null);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);

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

  // Handle iframe load event
  const handleIframeLoad = useCallback(() => {
    setIsIframeLoading(false);
  }, []);

  // Start verification flow when button is clicked
  const startVerification = useCallback(async () => {
    if (disabled || isLoading) return;
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
      } else {
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
    handleIframeLoad,
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

  // Remove iframe load listener on cleanup
  useEffect(() => {
    return () => {
      if (iframeRef.current) {
        iframeRef.current.removeEventListener('load', handleIframeLoad);
      }
    };
  }, [handleIframeLoad]);

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
        <div
          className="presenz-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'white',
            padding: '15px',
          }}
          onClick={handleClose}
        >
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()} // prevent close on content click
          >
            <button
              style={{
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
              }}
              onClick={handleClose}
            >
              ×
            </button>

            {errorMessage ? (
              <div className="presenz-error">
                <p>{errorMessage}</p>
                <button onClick={cleanup}>Close</button>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  position: 'relative',
                }}
              >
                {/* Horizontal Dot Loader */}
                {isIframeLoading && (
                  <div
                    style={{
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
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap: '5px',
                      }}
                    >
                      {[0, 1, 2, 3, 4].map((index) => (
                        <div
                          key={index}
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #1E3E62 0%, #0B192C 100%)',
                            animation: `dotPulse 1.5s ease-in-out ${index * 0.1}s infinite`,
                            opacity: 0.7,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Inline CSS for the animation */}
                <style>
                  {`
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
                  `}
                </style>

                {sessionUrlRef.current && (
                  <iframe
                    style={{
                      flex: 1,
                      borderColor: 'transparent',
                      opacity: isIframeLoading ? 0.3 : 1,
                      transition: 'opacity 0.3s ease',
                      pointerEvents: isIframeLoading ? 'none' : 'auto',
                    }}
                    ref={iframeRef}
                    src={sessionUrlRef.current}
                    onLoad={handleIframeLoad}
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

export default PresenzButton;