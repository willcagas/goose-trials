import { Suspense } from 'react';
import { SessionProvider } from '@/app/providers/SessionContext';
import { MeProvider } from '@/app/providers/MeContext';
import { PHProvider } from '@/app/providers/PostHogProvider';
import PostHogPageView from '@/app/PostHogPageView';
import UsernamePrompt from '@/components/UsernamePrompt';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Goose Trials',
  description: "Think you're smart? Prove it.",
  icons: {
    icon: '/goosetrials-favicon.ico',
    apple: '/goosetrialspfp-removebg-preview.png',
  },
  openGraph: {
    title: 'Goose Trials',
    description: "Think you're smart? Prove it.",
    url: 'https://goosetrials.com',
    siteName: 'Goose Trials',
    images: [
      {
        url: 'https://goosetrials.com/api/og/home',
        width: 1200,
        height: 630,
        alt: "Goose Trials - Think you're smart? Prove it.",
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Goose Trials',
    description: "Think you're smart? Prove it.",
    images: ['https://goosetrials.com/api/og/home'],
  },
};

//Next.js feature: automatically wraps all pages with layout.tsx
//this function allows us to use SessionProvider within each page without having to explicitly wrap each page
//now, every app component can use useSession() and useMe()
export default function RootLayout({children,}: {children: React.ReactNode;}) {
  return (
    <html lang="en">
      <body>
        <PHProvider>
          <Suspense fallback={null}>
            <PostHogPageView />
          </Suspense>
          <SessionProvider>
            <MeProvider>
              {children}
              <UsernamePrompt />
            </MeProvider>
          </SessionProvider>
        </PHProvider>
      </body>
    </html>
  )
}