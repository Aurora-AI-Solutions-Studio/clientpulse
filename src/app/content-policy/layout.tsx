import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Content Policy — ClientPulse',
  description:
    'How ClientPulse handles AI refusals, escalation paths, and the boundaries between automated insight and human judgment.',
  alternates: {
    canonical: '/content-policy',
  },
};

export default function ContentPolicyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
