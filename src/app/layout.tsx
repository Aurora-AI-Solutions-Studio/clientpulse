import type { Metadata } from 'next';
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
import { CookieConsent } from '@/components/cookie-consent';
import './globals.css';

// Canonical Aurora landing typography stack — see aurora-ops/products/canonical-workflow-copy.md
// Display: geometric sans for headings; Body: high-readability sans; Mono: step numbers + technical accents.
const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'https://clientpulse.helloaurora.ai'
  ),
  alternates: {
    canonical: '/',
  },
  title: 'ClientPulse — AI Client Health Intelligence for Agencies',
  description:
    'Monitor client health, identify risks, and act before churn happens. AI-powered insights for agencies to strengthen relationships and grow faster.',
  keywords: [
    'client health',
    'churn prevention',
    'agency intelligence',
    'client management',
    'AI analytics',
  ],
  authors: [
    {
      name: 'Aurora AI Solutions Studio',
      url: 'https://helloaurora.ai',
    },
  ],
  creator: 'Aurora AI Solutions Studio UG (haftungsbeschränkt)',
  publisher: 'Aurora AI Solutions Studio UG (haftungsbeschränkt)',
  formatDetection: {
    email: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://clientpulse.helloaurora.ai',
    siteName: 'ClientPulse',
    title: 'ClientPulse — AI Client Health Intelligence for Agencies',
    description:
      'Monitor client health, identify risks, and act before churn happens.',
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://clientpulse.helloaurora.ai'}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'ClientPulse',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ClientPulse',
    description: 'AI Client Health Intelligence for Agencies',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} ${jetBrainsMono.variable} bg-background text-foreground antialiased`}
      >
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
