// Aurora Suite brand marks — single source for the CP and RF wordmarks
// + the "by Aurora" gradient.
//
// CP: teal rounded-square app icon with an EKG/pulse glyph + "Client"
//     in white + "Pulse" in the Aurora gradient.
// RF: gold pulse glyph + "ReForge" in serif + cyan underline accent.
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
        className="relative inline-flex items-center justify-center rounded-[10px] shadow-[0_4px_18px_rgba(56,232,200,0.25)]"
        style={{
          width: px,
          height: px,
          background: 'linear-gradient(135deg, #4ff3d6 0%, #38e8c8 50%, #2bc0a3 100%)',
        }}
        aria-hidden="true"
      >
        <PulseGlyph size={Math.round(px * 0.62)} />
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
        className="relative inline-flex items-center justify-center"
        style={{ width: px, height: px }}
        aria-hidden="true"
      >
        <ForgeGlyph size={Math.round(px * 0.85)} />
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

function PulseGlyph({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#0a1f1a"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12h3l2-5 4 10 2-5 2 3h5" />
    </svg>
  );
}

function ForgeGlyph({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#f0c84c"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12h6" />
      <path d="M9 7l3 5-3 5" />
      <path d="M14 7l3 5-3 5" />
      <path d="M19 7l2 5-2 5" />
    </svg>
  );
}
