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

export const metadata: Metadata = {
  title: 'YashWorld — Premium Plant Marketplace',
  description:
    'YashWorld is a premium marketplace for plants, pots, planters and gardening essentials from verified sellers.',
  generator: 'v0.app',
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
