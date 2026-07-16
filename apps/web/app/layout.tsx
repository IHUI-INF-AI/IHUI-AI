import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getLocale } from 'next-intl/server'
import { Toaster } from 'sonner'

import './globals.css'
import { ThemeProvider } from '@/providers/theme-provider'
import { QueryProvider } from '@/providers/query-provider'
import { GlobalHooksProvider } from '@/providers/global-hooks-provider'
import { LoginDialog } from '@/components/login/LoginDialog'

export const metadata: Metadata = {
  title: { default: 'IHUI AI', template: '%s | IHUI AI' },
  description: 'AI SaaS Platform',
  metadataBase: new URL('https://ihui.ai'),
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/images/logo.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/images/logo.png' }],
  },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: 'IHUI AI',
    images: [{ url: '/images/logo.png', width: 1200, height: 630, alt: 'IHUI AI' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/images/logo.png'],
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [messages, locale] = await Promise.all([getMessages(), getLocale()])

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider locale={locale} messages={messages}>
            <QueryProvider>
              <GlobalHooksProvider>
                {children}
                <LoginDialog />
              </GlobalHooksProvider>
            </QueryProvider>
            <Toaster position="top-center" richColors closeButton />
          </NextIntlClientProvider>
        </ThemeProvider>
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))`,
          }}
        />
      </body>
    </html>
  )
}
