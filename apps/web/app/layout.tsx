import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getLocale } from 'next-intl/server'
import { Toaster } from 'sonner'

import './globals.css'
import { ThemeProvider } from '@/providers/theme-provider'
import { QueryProvider } from '@/providers/query-provider'
import { GlobalHooksProvider } from '@/providers/global-hooks-provider'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'IHUI AI', template: '%s | IHUI AI' },
  description: 'AI SaaS Platform',
  metadataBase: new URL('https://ihui.ai'),
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: 'IHUI AI',
  },
  twitter: { card: 'summary_large_image' },
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
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider locale={locale} messages={messages}>
            <QueryProvider>
              <GlobalHooksProvider>{children}</GlobalHooksProvider>
            </QueryProvider>
            <Toaster position="top-center" richColors closeButton />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
