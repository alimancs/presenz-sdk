// src/utils/postMessageHandler.ts

import type { PresenzCallbacks } from '../types';  // assuming you have a types.ts file

// Trusted origin — MUST match your widget's deployed domain exactly
// In production: 'https://verifypresenz.com'
// For local development/testing: you can temporarily allow 'http://localhost:5173' etc.
const TRUSTED_ORIGIN = 'https://presenz.netlify.com';

// You can make this configurable later via environment variable or SDK init
// const TRUSTED_ORIGIN = import.meta.env.VITE_PRESENZ_WIDGET_ORIGIN || 'https://verifypresenz.com';

interface PresenzMessage {
  type: 'presenz_success' | 'presenz_error' | 'presenz_close' | 'presenz_progress';
  payload?: any;
}

let messageListener: ((event: MessageEvent) => void) | null = null;

/**
 * Sets up the postMessage listener to receive communication from the Presenz iframe widget.
 * Should be called **once** when the iframe is created.
 *
 * @param callbacks - The callbacks provided by the developer
 */
export function setupPostMessageListener(callbacks: PresenzCallbacks): void {
  // Prevent multiple listeners
  if (messageListener) {
    console.warn('[Presenz SDK] postMessage listener already active. Skipping duplicate setup.');
    return;
  }

  messageListener = (event: MessageEvent) => {
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

    const data = event.data as PresenzMessage | undefined;

    if (!data || !data.type) {
      console.warn('[Presenz SDK] Received invalid postMessage format');
      return;
    }

    switch (data.type) {
      case 'presenz_success':
        if (data.payload && typeof data.payload === 'object') {
          callbacks.onSuccess?.(data.payload);
        } else {
          console.warn('[Presenz SDK] Missing or invalid payload in success message');
          callbacks.onError?.({
            message: 'Invalid success response from verification widget',
            code: 'invalid_success_payload',
          });
        }
        break;

      case 'presenz_error':
        callbacks.onError?.(
          data.payload && typeof data.payload === 'object'
            ? data.payload
            : { message: 'Verification error', code: 'unknown_widget_error' }
        );
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

/**
 * Removes the postMessage listener.
 * Should be called when:
 * - Verification completes (success or error)
 * - User closes the modal
 * - Component unmounts / cleanup
 */
export function removePostMessageListener(): void {
  if (messageListener) {
    window.removeEventListener('message', messageListener);
    messageListener = null;
    // console.debug('[Presenz SDK] postMessage listener removed');
  }
}