import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
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
        {/*
          No-flash bootstrap(2026-07-22 立,修复首屏侧边栏宽度闪烁):
          在 React hydrate 之前同步执行,从 localStorage 读取 AI 面板持久化 width,
          预设 --ai-panel-occupy CSS 变量,让 GlobalShell 的 work-area 首帧 paddingLeft
          就是用户持久化值,而非 store 默认值(408px)。

          注意:sidebar-width **不**在此 inline script 中预设。
          - 用户要求首帧直接显示默认 130 宽度,不要先显示持久化的拉伸宽度(如 180)再切回。
          - sidebar.tsx 的 aside style 用 `var(--sidebar-width, 130px)`,首帧 fallback 130。
          - sidebar.tsx 的 useState(SIDEBAR_WIDTH)=130 + useEffect 同步 CSS 变量=130,三者一致无跳变。
          - 拖拽宽度仍存 localStorage,但刷新后不读取(首帧永远默认 130,无跳变)。

          与 next-themes 的 suppressHydrationWarning 同模式:只设 CSS 变量,
          React inline style 只声明 CSS 变量引用,不接管具体数值 → 无 hydration mismatch。
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var raw=localStorage.getItem('ihui-ai-panel');if(raw){var p=JSON.parse(raw);var w=p&&p.state&&p.state.width;if(typeof w==='number'&&w>=320&&w<=720){document.documentElement.style.setProperty('--ai-panel-occupy',(w+8)+'px');return;}}}catch(e){}document.documentElement.style.setProperty('--ai-panel-occupy','408px');})();`,
          }}
        />
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
                  {/* output: 'export' 模式:useSearchParams() 必须包裹 Suspense */}
                  <Suspense fallback={null}>
                    <LoginRedirectListener />
                  </Suspense>
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
