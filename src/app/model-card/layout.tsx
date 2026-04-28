import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Model Card — ClientPulse',
  description:
    "ClientPulse's AI agents, models, training data, evaluation, and oversight gates. Compliance with the EU AI Act Article 13 transparency obligation.",
  alternates: {
    canonical: '/model-card',
  },
};

export default function ModelCardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
