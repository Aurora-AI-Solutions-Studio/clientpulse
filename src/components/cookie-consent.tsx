'use client';

import { useState, useEffect } from 'react';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if consent was already given
    const consent = document.cookie
      .split('; ')
      .find((c) => c.startsWith('aurora_cookie_consent='));
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    document.cookie =
      'aurora_cookie_consent=accepted; path=/; max-age=31536000; SameSite=Lax';
    setVisible(false);
    // Enable analytics here if needed
    // e.g., window.gtag?.('consent', 'update', { analytics_storage: 'granted' });
  };

  const decline = () => {
    document.cookie =
      'aurora_cookie_consent=declined; path=/; max-age=31536000; SameSite=Lax';
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'rgba(6, 9, 15, 0.95)',
        backdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(122, 136, 168, 0.15)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        flexWrap: 'wrap',
        fontFamily: 'var(--font-outfit, system-ui)',
      }}
    >
      <p
        style={{
          color: '#c0c8d8',
          fontSize: '13px',
          lineHeight: '1.5',
          margin: 0,
          maxWidth: '600px',
        }}
      >
        We use cookies for essential functionality and analytics. See our{' '}
        <a
          href="https://helloaurora.ai/privacy"
          style={{ color: '#38e8c8', textDecoration: 'underline' }}
        >
          Privacy Policy
        </a>
        .
      </p>
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button
          onClick={decline}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid rgba(122, 136, 168, 0.2)',
            background: 'transparent',
            color: '#7a88a8',
            fontSize: '13px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Decline
        </button>
        <button
          onClick={accept}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: '#38e8c8',
            color: '#06090f',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
