import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Unsubscribed — ClientPulse',
  description:
    "You've been unsubscribed from the ClientPulse Monday Brief. Re-subscribe any time from your dashboard settings.",
  alternates: {
    canonical: '/unsubscribe',
  },
  robots: {
    index: false,
    follow: false,
  },
};

interface PageProps {
  searchParams: Promise<{ status?: string; reason?: string }>;
}

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const { status, reason } = await searchParams;

  let title = "You're unsubscribed";
  let body =
    "You won't receive any more Monday Briefs. You can re-subscribe any time from your dashboard settings — Brief delivery → set a delivery time again.";

  if (status === 'invalid') {
    title = 'This unsubscribe link is no longer valid';
    body =
      reason === 'expired'
        ? 'The link has expired. Sign in to your dashboard and use Settings → Brief delivery to manage your subscription.'
        : 'We could not verify this link. If you keep receiving briefs, contact support@helloaurora.ai.';
  } else if (status === 'error') {
    title = 'Something went wrong';
    body =
      'We could not record your preference. Please try the link again or contact support@helloaurora.ai if the problem persists.';
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0b1426] text-white px-6">
      <div className="max-w-md w-full">
        <h1 className="text-3xl font-bold mb-4">{title}</h1>
        <p className="text-[#9ca3b8] mb-8 leading-relaxed">{body}</p>
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#e74c3c] text-white text-sm font-medium hover:bg-[#d44434] transition-colors"
        >
          Open settings
        </Link>
      </div>
    </main>
  );
}
