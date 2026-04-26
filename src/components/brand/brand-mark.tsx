// Aurora Suite brand marks — single source for the CP and RF wordmarks
// + the "by Aurora" gradient.
//
// The SVGs below are LIFTED VERBATIM from the canonical landing-page
// implementations:
//   - ClientPulse: clientpulse/src/app/page.tsx Icon.pulse  (40x40 viewBox)
//   - ReForge:    reforge/app/page.tsx          ReForge nav (72x72 viewBox)
// Do not improvise — if the marks change on the landing page, update them
// here too so dashboard chrome stays in lockstep with the public brand.

import Link from 'next/link';

interface BrandProps {
  /** Show wordmark text alongside the icon. Default true. */
  showWordmark?: boolean;
  /** "sm" = 24px icon (header / tight nav), "md" = 32px (sidebar). */
  size?: 'sm' | 'md' | 'lg';
  /** Wrap in a Link to /dashboard. */
  href?: string;
  className?: string;
}

const ICON_PX = { sm: 24, md: 32, lg: 44 };
const TEXT_CLASS = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
};

export function ClientPulseMark({
  showWordmark = true,
  size = 'md',
  href,
  className = '',
}: BrandProps) {
  const px = ICON_PX[size];
  const inner = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <ClientPulseLogoSvg size={px} />
      {showWordmark && (
        <span className={`font-semibold tracking-[-0.01em] ${TEXT_CLASS[size]}`}>
          <span className="text-white">Client</span>
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                'linear-gradient(135deg, #38e8c8 0%, #4cc9f0 35%, #b388eb 70%, #e87fa5 100%)',
            }}
          >
            Pulse
          </span>
        </span>
      )}
    </span>
  );
  if (href) {
    return (
      <Link href={href} className="inline-flex hover:opacity-95 transition-opacity">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function ReForgeMark({
  showWordmark = true,
  size = 'sm',
  href,
  className = '',
}: BrandProps) {
  const px = ICON_PX[size];
  const inner = (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <ReForgeLogoSvg size={px} />
      {showWordmark && (
        <span
          className={`font-playfair font-bold tracking-[-0.01em] text-white ${TEXT_CLASS[size]}`}
        >
          ReForge
        </span>
      )}
    </span>
  );
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex hover:opacity-95 transition-opacity"
      >
        {inner}
      </a>
    );
  }
  return inner;
}

export function AuroraWordmark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`bg-clip-text text-transparent font-medium ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(135deg, #38e8c8 0%, #4cc9f0 25%, #7b8ff0 50%, #b388eb 75%, #e87fa5 100%)',
      }}
    >
      by Aurora
    </span>
  );
}

// -----------------------------
// Canonical SVGs (verbatim from landing pages)
// -----------------------------

/** ClientPulse — verbatim from clientpulse/src/app/page.tsx Icon.pulse. */
function ClientPulseLogoSvg({ size }: { size: number }) {
  // ID is locally-scoped to avoid collisions when multiple instances render
  // on the same page (e.g. sidebar + product switcher both visible).
  const gradId = `cpLogoGrad_${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <rect width="40" height="40" rx="10" fill={`url(#${gradId})`} />
      <circle
        cx="20"
        cy="20"
        r="13"
        stroke="#06090f"
        strokeWidth="2"
        opacity="0.3"
        fill="none"
      />
      <circle cx="20" cy="20" r="7" fill="#06090f" opacity="0.15" />
      <polyline
        points="7,20 13,20 16,12 20,28 24,12 27,20 33,20"
        stroke="#06090f"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="20" cy="7" r="2.5" fill="#06090f" />
      <circle cx="33" cy="20" r="2" fill="#06090f" opacity="0.6" />
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="40" y2="40">
          <stop offset="0%" stopColor="#38e8c8" />
          <stop offset="100%" stopColor="#4cc9f0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** ReForge — verbatim from reforge/app/page.tsx nav header. */
function ReForgeLogoSvg({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      fill="none"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <line x1="8" y1="36" x2="24" y2="36" stroke="#f0c84c" strokeWidth="2.5" strokeLinecap="round" />
      <polyline
        points="20,32 24,36 20,40"
        stroke="#f0c84c"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M28 36 L36 22 L44 36 L36 50 Z"
        fill="none"
        stroke="#f0c84c"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M32 36 L36 28 L40 36 L36 44 Z" fill="#f0c84c" opacity="0.15" />
      <line x1="44" y1="28" x2="62" y2="16" stroke="#f0c84c" strokeWidth="2" strokeLinecap="round" />
      <line
        x1="44"
        y1="32"
        x2="64"
        y2="28"
        stroke="#f0c84c"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.85"
      />
      <line x1="44" y1="36" x2="64" y2="36" stroke="#f0c84c" strokeWidth="2.5" strokeLinecap="round" />
      <line
        x1="44"
        y1="40"
        x2="64"
        y2="44"
        stroke="#f0c84c"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.85"
      />
      <line x1="44" y1="44" x2="62" y2="56" stroke="#f0c84c" strokeWidth="2" strokeLinecap="round" />
      <circle cx="62" cy="16" r="2" fill="#f0c84c" opacity="0.8" />
      <circle cx="64" cy="28" r="2" fill="#f0c84c" opacity="0.6" />
      <circle cx="64" cy="36" r="2.5" fill="#f0c84c" />
      <circle cx="64" cy="44" r="2" fill="#f0c84c" opacity="0.6" />
      <circle cx="62" cy="56" r="2" fill="#f0c84c" opacity="0.8" />
    </svg>
  );
}
