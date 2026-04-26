// Aurora Suite brand marks — single source for the CP and RF wordmarks
// + the "by Aurora" gradient.
//
// CP: teal rounded-square app icon with a "monitor screen" frame
//     containing an EKG path + a small heart accent. Wordmark = "Client"
//     in white + "Pulse" in the Aurora gradient (teal→blue→purple→pink).
// RF: dark charcoal rounded-square with a gold "fast-forward / forge"
//     glyph + serif "ReForge" wordmark.
// AuroraWordmark: standalone gradient "by Aurora" for footers / dividers.

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
      <span
        className="relative inline-flex items-center justify-center rounded-[10px] shadow-[0_4px_22px_-4px_rgba(56,232,200,0.45)] ring-1 ring-[#2bc0a3]/40"
        style={{
          width: px,
          height: px,
          background:
            'linear-gradient(135deg, #5cf3d8 0%, #3ddec3 45%, #28b89c 100%)',
        }}
        aria-hidden="true"
      >
        <PulseMonitorGlyph size={Math.round(px * 0.74)} />
      </span>
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
      <span
        className="relative inline-flex items-center justify-center rounded-[8px] shadow-[0_2px_10px_-2px_rgba(0,0,0,0.5)] ring-1 ring-white/5"
        style={{
          width: px,
          height: px,
          background: 'linear-gradient(135deg, #1a1f2e 0%, #0d1220 100%)',
        }}
        aria-hidden="true"
      >
        <ForgeGlyph size={Math.round(px * 0.62)} />
      </span>
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
// SVG glyphs
// -----------------------------

/**
 * CP mark inner glyph — a rounded "monitor screen" with an EKG trace
 * crossing it, plus a small heart accent at the right. Captures the
 * "client health monitor" idea instead of just a bare pulse line.
 */
function PulseMonitorGlyph({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {/* Monitor frame */}
      <rect
        x="2.4"
        y="5"
        width="19.2"
        height="14"
        rx="2.4"
        stroke="#0a3a32"
        strokeWidth="1.6"
        fill="rgba(10,58,50,0.18)"
      />
      {/* EKG trace */}
      <path
        d="M4.6 12.5h2.6l1.4-3.6 2.4 7.6 1.6-4 1.2 1.7h2.6"
        stroke="#0a3a32"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Heart accent */}
      <path
        d="M18.8 12.5c0-0.9 0.7-1.6 1.5-1.6 0.5 0 1 0.3 1.2 0.7 0.2-0.4 0.7-0.7 1.2-0.7 0.8 0 1.5 0.7 1.5 1.6 0 1.4-2.7 3.1-2.7 3.1s-2.7-1.7-2.7-3.1z"
        fill="#0a3a32"
        transform="translate(-1.6 -0.5) scale(0.55)"
      />
    </svg>
  );
}

/**
 * RF mark glyph — gold "fast-forward / forge" abstract. Three parallel
 * arrow shapes converging right, suggesting motion + velocity.
 */
function ForgeGlyph({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 6l5 6-5 6"
        stroke="#f0c84c"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 6l5 6-5 6"
        stroke="#f0c84c"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 6l3 6-3 6"
        stroke="#f0c84c"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
    </svg>
  );
}
