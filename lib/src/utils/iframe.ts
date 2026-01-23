
export function createIframe(
  sessionUrl: string,
  options: {
    width?: string;
    height?: string;
    title?: string;
    className?: string;
  } = {}
): HTMLIFrameElement {
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