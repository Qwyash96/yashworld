import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Playfair_Display } from 'next/font/google'
import { Suspense } from 'react'
import { StoreProvider } from '@/components/store-provider'
import { SiteChrome } from '@/components/site-chrome'
import { PresenceHeartbeat } from '@/components/presence-heartbeat'
import { AnalyticsScripts } from '@/components/analytics-scripts'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' })

const SITE_URL = 'https://www.yashworld.shop'
const SITE_TITLE = 'IXOFLORA — Premium Plant Marketplace'
const SITE_DESCRIPTION =
  'IXOFLORA is a premium marketplace for plants, pots, planters and gardening essentials from verified sellers.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: '%s' },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: 'IXOFLORA',
    type: 'website',
    locale: 'en_IN',
  },
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#ffffff',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`bg-background ${geistSans.variable} ${playfair.variable}`}>
      <body className="antialiased font-sans flex min-h-dvh flex-col">
        <StoreProvider>
          <PresenceHeartbeat />
          <Suspense fallback={null}>
            <SiteChrome>{children}</SiteChrome>
          </Suspense>
          <Toaster position="bottom-right" />
        </StoreProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
        <AnalyticsScripts />
      </body>
    </html>
  )
}
