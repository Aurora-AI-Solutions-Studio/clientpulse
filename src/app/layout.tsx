import type { Metadata } from 'next';
import { Playfair_Display, Outfit } from 'next/font/google';
import './globals.css';

const playfairDisplay = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  display: 'swap',
});

const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
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
        className={`${playfairDisplay.variable} ${outfit.variable} bg-background text-foreground antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
