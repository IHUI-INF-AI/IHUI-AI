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
import { LoginRedirectListener } from '@/components/login/LoginRedirectListener'
import { GlobalShell } from '@/components/layout/GlobalShell'
import { TooltipProvider } from '@/components/feedback'

// EDIX 拉丁字体仅在 h1-h6 标题 + .font-edix 工具类中显式使用(见 globals.css)。
// 不再通过 next/font/local 挂载到 body,避免全站英文文本被强制走 EDIX 字体。
// EDIX 字体由 globals.css 中的 @font-face 声明加载(unicode-range 限定拉丁字符)。

export const metadata: Metadata = {
  title: { default: 'IHUI AI', template: '%s | IHUI AI' },
  description: 'AI SaaS Platform',
  metadataBase: new URL('https://ihui.ai'),
  manifest: '/manifest.json',
  icons: {
    // 浏览器 favicon 与 apple-touch:统一用无文字版 logo.png(2026-07-19 全站统一)
    icon: [{ url: '/images/logo.png?v=20260719-unify', type: 'image/png' }],
    apple: [{ url: '/images/logo.png?v=20260719-unify' }],
  },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: 'IHUI AI',
    images: [
      { url: '/images/logo.png?v=20260719-unify', width: 1200, height: 630, alt: 'IHUI AI' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/images/logo.png?v=20260719-unify'],
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
              <TooltipProvider>
                <GlobalHooksProvider>
                  {/*
                    GlobalShell 提供真全局骨架:左侧 Sidebar + 内容槽 + 右侧 AISidePanel + PWA 提示。
                    所有路由组((main)/(marketing)/(auth)/sso/h5/forbidden)共享同一套全局组件,
                    符合"本项目所有内容都应包含在工作区"的全局设定(2026-07-19)。
                    各路由组 layout 在内容槽内填充自己的样式((main) 用 MainShell 工作区面板,
                    (marketing) 用 Header+Footer,(auth) 用居中表单等)。
                  */}
                  <GlobalShell>{children}</GlobalShell>
                  <LoginRedirectListener />
                  <LoginDialog />
                </GlobalHooksProvider>
              </TooltipProvider>
            </QueryProvider>
            <Toaster position="top-center" richColors closeButton />
          </NextIntlClientProvider>
        </ThemeProvider>
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator && !location.host.includes('localhost'))window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))`,
          }}
        />
      </body>
    </html>
  )
}
