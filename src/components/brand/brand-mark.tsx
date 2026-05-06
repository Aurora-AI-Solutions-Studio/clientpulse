// Aurora Suite brand marks — single source for the CP and ContentPulse wordmarks
// + the "by Aurora" gradient.
//
// The SVGs below are LIFTED VERBATIM from the canonical landing-page
// implementations:
//   - ClientPulse:  clientpulse/src/app/page.tsx       Icon.pulse  (40x40 viewBox)
//   - ContentPulse: contentpulse/app/page.tsx          ContentPulse nav (72x72 viewBox)
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

export function ContentPulseMark({
  showWordmark = true,
  size = 'md',
  href,
  className = '',
}: BrandProps) {
  const px = ICON_PX[size];
  const inner = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img src="/icon.png" width={px} height={px} alt="Aurora Logo" className="rounded-full shadow-[0_0_8px_rgba(0,229,255,0.4)]" />
      {showWordmark && (
        <span
          className={`font-bold tracking-[-0.01em] text-white ${TEXT_CLASS[size]}`}
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          ContentPulse
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

export function ClientPulseMark({
  showWordmark = true,
  size = 'sm',
  href,
  className = '',
}: BrandProps) {
  const px = ICON_PX[size];
  const inner = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img src="/icon.png" width={px} height={px} alt="Aurora Logo" className="rounded-full shadow-[0_0_8px_rgba(0,229,255,0.4)]" />
      {showWordmark && (
        <span
          className={`font-bold tracking-[-0.01em] text-white ${TEXT_CLASS[size]}`}
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          ClientPulse
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

export function AuroraWordmark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`font-medium text-white ${className}`}
    >
      by Aurora
    </span>
  );
}
