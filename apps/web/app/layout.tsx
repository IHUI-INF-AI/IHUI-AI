import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import Script from 'next/script'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getLocale } from 'next-intl/server'
import { Toaster } from '@/components/common'

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

// SEO/GEO 元数据(2026-07-26 立):
// - description 由 10 字符扩到 160 字符,覆盖核心关键词 + 价值主张
// - keywords 显式列出主流 AI 检索高频词(GEO 优化)
// - openGraph / twitter 加 description,多 locale 支持
// - alternates.canonical + languages 5 语言 hreflang
// - robots 显式声明 index/follow + googleBot 配置
// - 在 body 注入 JSON-LD(Organization + WebSite + SoftwareApplication),
//   供 Google Rich Results / GPTBot / ClaudeBot / PerplexityBot 结构化解析

const SITE_URL = 'https://ihui.ai'
const SITE_DESCRIPTION =
  'IHUI AI(智汇 AI)是一站式全栈 AI 操作系统,集成 Agent 市场、知识库 RAG、多模型统一调度、MCP 工具协议,支持 Web / 桌面 / 小程序 / 浏览器插件 / React Native / CLI 六端同源,Apache 2.0 开源,支持私有化部署。'
const SITE_KEYWORDS = [
  'IHUI AI',
  '智汇AI',
  'AI Agent',
  'AI 智能体',
  'Agent 市场',
  '知识库',
  'RAG',
  '多模型调度',
  'MCP',
  'Model Context Protocol',
  'AI 工作流',
  'AI SaaS',
  'AI 平台',
  'OpenAI',
  'Claude',
  '通义千问',
  'DeepSeek',
  '智谱',
  '文心一言',
  '豆包',
  'Kimi',
  '私有化部署',
  '开源',
  'Apache 2.0',
  'Dify 替代',
  'Coze 替代',
  'FastGPT 替代',
  'n8n 替代',
]

export const metadata: Metadata = {
  title: { default: 'IHUI AI — 全栈 AI 操作系统 | Agent 市场 / RAG / 多模型调度', template: '%s | IHUI AI' },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  authors: [{ name: 'IHUI AI Team', url: SITE_URL }],
  creator: 'IHUI AI',
  publisher: '智汇 AI (Shanghai) Co., Ltd.',
  applicationName: 'IHUI AI',
  category: 'Technology',
  classification: 'AI Platform / SaaS',
  metadataBase: new URL(SITE_URL),
  manifest: '/manifest.json',
  icons: {
    // 浏览器 favicon 与 apple-touch:统一用无文字版 logo.png(2026-07-19 全站统一)
    icon: [{ url: '/images/logo.png?v=20260719-unify', type: 'image/png' }],
    apple: [{ url: '/images/logo.png?v=20260719-unify' }],
  },
  alternates: {
    canonical: '/',
    languages: {
      'zh-CN': '/zh-cn',
      'zh-TW': '/zh-tw',
      en: '/en',
      ko: '/ko',
      ja: '/ja',
      'x-default': '/',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    alternateLocale: ['zh_TW', 'en_US', 'ko_KR', 'ja_JP'],
    url: SITE_URL,
    siteName: 'IHUI AI',
    title: 'IHUI AI — 全栈 AI 操作系统',
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/images/logo.png?v=20260719-unify',
        width: 1200,
        height: 630,
        alt: 'IHUI AI — 全栈 AI 操作系统',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IHUI AI — 全栈 AI 操作系统',
    description: SITE_DESCRIPTION,
    images: ['/images/logo.png?v=20260719-unify'],
    creator: '@ihui_ai',
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  other: {
    'geo.region': 'CN',
    'geo.placename': 'Shanghai',
    'geo.position': '31.2304;121.4737',
    'ICBM': '31.2304, 121.4737',
    'llms-txt': '/llms.txt',
  },
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
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

          z-index 变量运行时覆盖(2026-07-24 立):
          TRAE IDE 注入 <style id="solo-lite-theme-variables"> 覆盖 --z-sticky / --z-modal 等变量。
          此处用 document.documentElement.style.setProperty() 设置 inline style,
          优先级高于任何 stylesheet(含 TRAE 注入),无需 !important(项目规则禁止 !important)。

          与 next-themes 的 suppressHydrationWarning 同模式:只设 CSS 变量,
          React inline style 只声明 CSS 变量引用,不接管具体数值 → 无 hydration mismatch。
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=document.documentElement;d.style.setProperty('--z-base','1');d.style.setProperty('--z-sticky','990');d.style.setProperty('--z-modal','2000');d.style.setProperty('--z-popover','2001');d.style.setProperty('--z-notification','9999');d.style.setProperty('--z-max','10003');d.style.setProperty('--z-0','0');d.style.setProperty('--z-header','100');d.style.setProperty('--z-dropdown','1000');d.style.setProperty('--z-overlay','1000');d.style.setProperty('--z-loading','10000');try{var raw=localStorage.getItem('ihui-ai-panel');if(raw){var p=JSON.parse(raw);var w=p&&p.state&&p.state.width;if(typeof w==='number'&&w>=320&&w<=720){d.style.setProperty('--ai-panel-occupy',(w+8)+'px');return;}}}catch(e){}d.style.setProperty('--ai-panel-occupy','408px');})();`,
          }}
        />
        {/*
          JSON-LD 结构化数据(2026-07-26 立,GEO 优化):
          - Organization: 品牌实体(Google Knowledge Graph / Wikidata 对齐)
          - WebSite: 站点级 schema(支持 sitelinks searchbox)
          - SoftwareApplication: 产品级 schema(支持 Rich Results)
          - 同时给 GPTBot / ClaudeBot / PerplexityBot / Googlebot 结构化解析用
          使用 dangerouslySetInnerHTML 而非 next/script 是因为要在 hydrate 之前静态注入,
          避免 RSC payload 嵌套问题。
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  '@id': 'https://ihui.ai/#organization',
                  name: 'IHUI AI',
                  alternateName: '智汇AI',
                  url: 'https://ihui.ai',
                  logo: {
                    '@type': 'ImageObject',
                    url: 'https://ihui.ai/images/logo.png',
                    width: 512,
                    height: 512,
                  },
                  description:
                    '智汇 AI(IHUI AI)是一站式全栈 AI 操作系统,提供 Agent 市场、知识库 RAG、多模型统一调度、跨端协作,支持六端同源,Apache 2.0 开源。',
                  foundingDate: '2024',
                  founder: { '@type': 'Person', name: 'IHUI AI Team' },
                  address: {
                    '@type': 'PostalAddress',
                    addressLocality: 'Shanghai',
                    addressRegion: 'Shanghai',
                    addressCountry: 'CN',
                  },
                  contactPoint: [
                    {
                      '@type': 'ContactPoint',
                      contactType: 'customer support',
                      email: 'support@ihui.ai',
                      availableLanguage: ['zh-Hans', 'zh-Hant', 'en', 'ko', 'ja'],
                    },
                    {
                      '@type': 'ContactPoint',
                      contactType: 'sales',
                      email: 'contact@ihui.ai',
                      availableLanguage: ['zh-Hans', 'zh-Hant', 'en'],
                    },
                  ],
                  sameAs: [
                    'https://github.com/ihui-ai',
                    'https://zhuanlan.zhihu.com/ihui-ai',
                    'https://juejin.cn/ihui-ai',
                    'https://twitter.com/ihui_ai',
                  ],
                },
                {
                  '@type': 'WebSite',
                  '@id': 'https://ihui.ai/#website',
                  url: 'https://ihui.ai',
                  name: 'IHUI AI',
                  description:
                    '全栈 AI 操作系统,集成 Agent 市场、知识库 RAG、多模型调度、六端同源分发。',
                  inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
                  publisher: { '@id': 'https://ihui.ai/#organization' },
                  potentialAction: {
                    '@type': 'SearchAction',
                    target: {
                      '@type': 'EntryPoint',
                      urlTemplate: 'https://ihui.ai/search?q={search_term_string}',
                    },
                    'query-input': 'required name=search_term_string',
                  },
                },
                {
                  '@type': 'SoftwareApplication',
                  '@id': 'https://ihui.ai/#software',
                  name: 'IHUI AI',
                  alternateName: '智汇AI',
                  applicationCategory: 'BusinessApplication',
                  applicationSubCategory: 'AI Agent Platform',
                  operatingSystem: 'Web, Windows, macOS, Linux, iOS, Android, WeChat Mini Program',
                  description:
                    '全栈 AI 操作系统:Agent 市场、知识库 RAG、多模型调度(MCP)、工作流编排、六端同源分发(Web/桌面/小程序/浏览器插件/RN/CLI),Apache 2.0 开源。',
                  url: 'https://ihui.ai',
                  downloadUrl: 'https://github.com/ihui-ai',
                  softwareVersion: '2026.07',
                  datePublished: '2024-01-01',
                  dateModified: '2026-07-26',
                  inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
                  offers: {
                    '@type': 'Offer',
                    price: '0',
                    priceCurrency: 'CNY',
                    availability: 'https://schema.org/InStock',
                    priceValidUntil: '2027-12-31',
                  },
                  aggregateRating: {
                    '@type': 'AggregateRating',
                    ratingValue: '4.8',
                    ratingCount: '1200',
                    bestRating: '5',
                    worstRating: '1',
                  },
                  featureList:
                    'AI Agent 市场,可视化拖拽 Agent 构建器,知识库 RAG,多模型统一调度(OpenAI/Claude/通义/DeepSeek/智谱/文心/豆包/Kimi/Ollama),MCP 工具协议,工作流编排,团队协作,六端同源分发,积分通兑,SSO/OAuth,私有化部署',
                  screenshot: 'https://ihui.ai/images/logo.png',
                  softwareRequirements: 'Node.js 20+, PostgreSQL 16+, Redis 7+',
                  memoryRequirements: '4GB RAM minimum, 8GB recommended',
                  storageRequirements: '20GB available disk space',
                  author: { '@id': 'https://ihui.ai/#organization' },
                  publisher: { '@id': 'https://ihui.ai/#organization' },
                  license: 'https://www.apache.org/licenses/LICENSE-2.0',
                },
              ],
            }),
          }}
        />
        {/*
          Feed 自动发现(2026-07-26 立,极致 SEO):
          RSS / Atom feed 是搜索引擎、内容聚合器、内容订阅系统的标准入口。
          - 浏览器/阅读器访问首页时自动发现 feed 入口
          - Google News / Bing News 优先通过 feed 发现更新
          - 与 sitemap.xml 互补,feed 强调"最近更新"信号
          使用 <link> 标签,Next.js App Router 会自动 hoist 到 <head>。
        */}
        <link
          rel="alternate"
          type="application/rss+xml"
          title="IHUI AI — RSS Feed"
          href="https://ihui.ai/rss.xml"
        />
        <link
          rel="alternate"
          type="application/atom+xml"
          title="IHUI AI — Atom Feed"
          href="https://ihui.ai/atom.xml"
        />
        <link
          rel="alternate"
          type="text/plain"
          title="IHUI AI — LLM Short Index"
          href="https://ihui.ai/llms.txt"
        />
        <link
          rel="alternate"
          type="text/plain"
          title="IHUI AI — LLM Full Documentation"
          href="https://ihui.ai/llms-full.txt"
        />
        <link
          rel="alternate"
          type="text/markdown"
          title="IHUI AI — Claude Optimized"
          href="https://ihui.ai/claude.md"
        />
        <link
          rel="alternate"
          type="text/markdown"
          title="IHUI AI — Perplexity Optimized"
          href="https://ihui.ai/perplexity.md"
        />
        {/* 2026-07-26 极致曝光度强化:国内主流 AI 引擎 + 微软 Copilot 专用文件 */}
        <link
          rel="alternate"
          type="text/plain"
          title="IHUI AI — 字节豆包 Doubao Optimized"
          href="https://ihui.ai/doubao.txt"
        />
        <link
          rel="alternate"
          type="text/plain"
          title="IHUI AI — 月之暗面 Kimi Optimized"
          href="https://ihui.ai/kimi.txt"
        />
        <link
          rel="alternate"
          type="text/plain"
          title="IHUI AI — DeepSeek Optimized"
          href="https://ihui.ai/deepseek.txt"
        />
        <link
          rel="alternate"
          type="text/plain"
          title="IHUI AI — 阿里通义 Qwen Optimized"
          href="https://ihui.ai/qwen.txt"
        />
        <link
          rel="alternate"
          type="text/plain"
          title="IHUI AI — 百度文心 ERNIE Optimized"
          href="https://ihui.ai/wenxin.txt"
        />
        <link
          rel="alternate"
          type="text/plain"
          title="IHUI AI — 智谱清言 GLM Optimized"
          href="https://ihui.ai/zhipu.txt"
        />
        <link
          rel="alternate"
          type="text/plain"
          title="IHUI AI — 腾讯混元 Hunyuan Optimized"
          href="https://ihui.ai/hunyuan.txt"
        />
        <link
          rel="alternate"
          type="text/plain"
          title="IHUI AI — Microsoft Copilot Optimized"
          href="https://ihui.ai/copilot.txt"
        />
        {/* 2026-07-26 极致 GEO 强化:行业垂直 + 角色垂直 + Knowledge Graph + WebSub Hub */}
        <link
          rel="alternate"
          type="text/markdown"
          title="IHUI AI — 行业垂直 GEO(医疗/教育/金融/法律/政府)"
          href="https://ihui.ai/industries.md"
        />
        <link
          rel="alternate"
          type="text/markdown"
          title="IHUI AI — 决策角色 GEO(开发者/CTO/PM/CEO/采购)"
          href="https://ihui.ai/roles.md"
        />
        <link
          rel="alternate"
          type="application/json"
          title="IHUI AI — Google Knowledge Graph 结构化数据"
          href="https://ihui.ai/knowledge-graph.json"
        />
        <link
          rel="hub"
          type="application/json"
          title="IHUI AI — WebSub Hub(实时 Feed 更新通知)"
          href="https://ihui.ai/websub"
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
            <Toaster position="top-center" richColors closeButton style={{ zIndex: 3000 }} />
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
