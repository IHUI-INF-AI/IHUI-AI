import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import Script from 'next/script'
import { Toaster } from '@/components/common'

import './globals.css'
import { ThemeProvider } from '@/providers/theme-provider'
import { QueryProvider } from '@/providers/query-provider'
import { GlobalHooksProvider } from '@/providers/global-hooks-provider'
import { I18nProvider } from '@/providers/i18n-provider'
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

const SITE_URL = 'https://aizhs.top'
const SITE_DESCRIPTION =
  'IHUI AI(智汇 AI 社区)是一站式全栈 AI 操作系统,集成 Agent 市场、知识库 RAG、多模型统一调度、MCP 工具协议,支持 Web / API / AI Service / CLI / Desktop / Browser Extension / Mobile / Miniapp 8 端同源分发,Apache 2.0 开源,支持私有化部署。'
const SITE_KEYWORDS = [
  'IHUI AI',
  'iHuiAI',
  '智汇AI',
  '智汇 AI 社区',
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
  '8 端',
  '8 端同源',
  'monorepo AI',
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
  'Open WebUI 替代',
]

export const metadata: Metadata = {
  title: {
    default: 'IHUI AI — 全栈 AI 操作系统 | Agent 市场 / RAG / 多模型调度',
    template: '%s | IHUI AI',
  },
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
    // 2026-07-28 P1-4 SEO 资产补全:
    // - favicon.ico(多尺寸 16/32/48)作为浏览器默认 favicon 兜底
    // - apple-touch-icon.png(180x180)用于 iOS 添加到主屏幕
    // - icon.png 兜底高分辨率浏览器(Chrome/Edge tab)
    // - shortcut icon 兼容旧版 IE/Edge
    // 老的 /images/logo.png?v=20260719-unify 保留作为 SVG 矢量备选
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48', type: 'image/x-icon' },
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: [{ url: '/favicon.ico', type: 'image/x-icon' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
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
    title: 'IHUI AI — 8 端全栈 AI 操作系统',
    description: SITE_DESCRIPTION,
    images: [
      // 2026-07-28 P1-4 SEO 资产补全:使用新建的 og-image.png(1200x630 品牌图)
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'IHUI AI — 8 端全栈 AI 操作系统',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IHUI AI — 8 端全栈 AI 操作系统',
    description: SITE_DESCRIPTION,
    // 2026-07-28 P1-4 SEO 资产补全:Twitter card 使用 og-image.png
    images: ['/og-image.png'],
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
  verification: {
    // 站长平台所有权验证 — 用户注册各站长平台后,在 .env(或 Vercel 后台)填入验证码即可
    // 详见 docs/seo-submit-guide.md
    google: process.env.GOOGLE_SITE_VERIFICATION,
    other: {
      ...(process.env.BAIDU_SITE_VERIFICATION && {
        'baidu-site-verification': process.env.BAIDU_SITE_VERIFICATION,
      }),
      ...(process.env.BING_SITE_VERIFICATION && {
        'msvalidate.01': process.env.BING_SITE_VERIFICATION,
      }),
      ...(process.env.QIHU_SITE_VERIFICATION && {
        '360-site-verification': process.env.QIHU_SITE_VERIFICATION,
      }),
      ...(process.env.SOGOU_SITE_VERIFICATION && {
        sogou_site_verification: process.env.SOGOU_SITE_VERIFICATION,
      }),
      ...(process.env.TOUTIAO_SITE_VERIFICATION && {
        'toutiao-site-verification': process.env.TOUTIAO_SITE_VERIFICATION,
      }),
      ...(process.env.SHENMA_SITE_VERIFICATION && {
        'shenma-site-verification': process.env.SHENMA_SITE_VERIFICATION,
      }),
    },
  },
  other: {
    'geo.region': 'CN',
    'geo.placename': 'Shanghai',
    'geo.position': '31.2304;121.4737',
    ICBM: '31.2304, 121.4737',
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
  // 2026-07-27:语言切换改为客户端 I18nProvider 驱动(响应 useLanguageStore.locale 变化)。
  // 服务端不再调用 getMessages/getLocale(原 i18n/request.ts 硬编码 zh-CN,Provider 无法响应切换)。
  // html lang 固定 'zh-CN' 作为 SSR 默认值,客户端挂载后由 I18nProvider 接管,suppressHydrationWarning 兼容。
  const locale = 'zh-CN'

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="font-sans antialiased">
        {/*
          Bootstrap script(React hydrate 前同步执行):
          1. z-index 变量:TRAE IDE 注入 <style> 覆盖 --z-sticky / --z-modal 等,
             此处用 document.documentElement.style.setProperty() 设 inline style,优先级高于任何 stylesheet。
          2. --ai-panel-occupy:从 localStorage 读取 AI 面板持久化 width 预设到 :root。
             2026-07-30 修订:不再用于 work-area paddingLeft(已移除),仅供 WebWorkPanel 计算最大可用宽度。
             GlobalShell useEffect 会运行时同步此变量(跟随用户拖拽/关闭面板)。
          与 next-themes 的 suppressHydrationWarning 同模式:只设 CSS 变量,无 hydration mismatch。
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=document.documentElement;d.style.setProperty('--z-base','1');d.style.setProperty('--z-sticky','990');d.style.setProperty('--z-modal','2000');d.style.setProperty('--z-popover','2001');d.style.setProperty('--z-notification','9999');d.style.setProperty('--z-max','10003');d.style.setProperty('--z-0','0');d.style.setProperty('--z-header','100');d.style.setProperty('--z-dropdown','1000');d.style.setProperty('--z-overlay','1000');d.style.setProperty('--z-loading','10000');try{var sw=localStorage.getItem('sidebar-width');if(sw){var sn=parseInt(sw,10);if(sn>=130&&sn<=180){d.style.setProperty('--sidebar-width',sn+'px');}else{d.style.setProperty('--sidebar-width','160px');}}else{d.style.setProperty('--sidebar-width','160px');}}catch(e){d.style.setProperty('--sidebar-width','160px');}try{var raw=localStorage.getItem('ihui-ai-panel');if(raw){var p=JSON.parse(raw);var w=p&&p.state&&p.state.width;if(typeof w==='number'&&w>=320&&w<=720){d.style.setProperty('--ai-panel-occupy',(w+6)+'px');return;}}}catch(e){}d.style.setProperty('--ai-panel-occupy','406px');})();`,
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
                  '@id': 'https://aizhs.top/#organization',
                  name: 'IHUI AI',
                  alternateName: ['智汇AI', '智汇 AI 社区', 'iHuiAI', '智汇AI社区', '智汇 AI'],
                  url: 'https://aizhs.top',
                  logo: {
                    '@type': 'ImageObject',
                    url: 'https://aizhs.top/images/logo.png',
                    width: 512,
                    height: 512,
                  },
                  description:
                    '智汇 AI 社区(IHUI AI)是一站式 8 端全栈 AI 操作系统,提供 Agent 市场、知识库 RAG、多模型统一调度、跨端协作,支持 Web/API/AI Service/CLI/Desktop/Browser Extension/Mobile/Miniapp 8 端同源,Apache 2.0 开源。',
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
                      email: 'support@aizhs.top',
                      availableLanguage: ['zh-Hans', 'zh-Hant', 'en', 'ko', 'ja'],
                    },
                    {
                      '@type': 'ContactPoint',
                      contactType: 'sales',
                      email: 'contact@aizhs.top',
                      availableLanguage: ['zh-Hans', 'zh-Hant', 'en'],
                    },
                  ],
                  sameAs: [
                    'https://github.com/IHUI-INF-AI/IHUI-AI',
                    'https://zhuanlan.zhihu.com/ihui-ai',
                    'https://juejin.cn/ihui-ai',
                    'https://twitter.com/ihui_ai',
                  ],
                },
                {
                  '@type': 'WebSite',
                  '@id': 'https://aizhs.top/#website',
                  url: 'https://aizhs.top',
                  name: 'IHUI AI — 8 端全栈 AI 操作系统',
                  description:
                    '8 端全栈 AI 操作系统,集成 Agent 市场、知识库 RAG、多模型调度、8 端同源分发(Web/API/AI Service/CLI/Desktop/Browser Extension/Mobile/Miniapp)。',
                  inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
                  publisher: { '@id': 'https://aizhs.top/#organization' },
                  potentialAction: {
                    '@type': 'SearchAction',
                    target: {
                      '@type': 'EntryPoint',
                      urlTemplate: 'https://aizhs.top/search?q={search_term_string}',
                    },
                    'query-input': 'required name=search_term_string',
                  },
                },
                {
                  '@type': 'SoftwareApplication',
                  '@id': 'https://aizhs.top/#software',
                  name: 'IHUI AI',
                  alternateName: ['智汇AI', '智汇 AI 社区', 'iHuiAI', '智汇AI社区'],
                  applicationCategory: 'BusinessApplication',
                  applicationSubCategory: 'AI Agent Platform',
                  operatingSystem:
                    'Web, Windows, macOS, Linux, iOS, Android, WeChat Mini Program, Chrome/Firefox/Edge',
                  description:
                    '8 端全栈 AI 操作系统:Agent 市场、知识库 RAG、多模型调度(MCP)、工作流编排、8 端同源分发(Web/API/AI Service/CLI/Desktop/Browser Extension/Mobile/Miniapp),Apache 2.0 开源。',
                  url: 'https://aizhs.top',
                  downloadUrl: 'https://github.com/IHUI-INF-AI/IHUI-AI',
                  codeRepository: 'https://github.com/IHUI-INF-AI/IHUI-AI',
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
                    '8 端同源分发 (Web / API / AI Service / CLI / Desktop / Browser Extension / Mobile / Miniapp),AI Agent 市场,可视化拖拽 Agent 构建器,知识库 RAG,多模型统一调度(OpenAI/Claude/通义/DeepSeek/智谱/文心/豆包/Kimi/Ollama/Mistral/Llama),MCP 工具协议,工作流编排,团队协作,积分通兑,SSO/OAuth,Apache 2.0 开源,私有化部署,Docker Compose 一键部署',
                  screenshot: 'https://aizhs.top/images/logo.png',
                  softwareRequirements: 'Node.js 20+, PostgreSQL 16+, Redis 7+',
                  memoryRequirements: '4GB RAM minimum, 8GB recommended',
                  storageRequirements: '20GB available disk space',
                  author: { '@id': 'https://aizhs.top/#organization' },
                  publisher: { '@id': 'https://aizhs.top/#organization' },
                  license: 'https://www.apache.org/licenses/LICENSE-2.0',
                },
              ],
            }),
          }}
        />
        {/*
          Feed 自动发现(2026-07-26 立,SEO 强化):
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
          href="https://aizhs.top/rss.xml"
        />
        <link
          rel="alternate"
          type="application/atom+xml"
          title="IHUI AI — Atom Feed"
          href="https://aizhs.top/atom.xml"
        />
        <link
          rel="alternate"
          type="text/plain"
          title="IHUI AI — LLM Short Index"
          href="https://aizhs.top/llms.txt"
        />
        <link
          rel="alternate"
          type="text/plain"
          title="IHUI AI — LLM Full Documentation"
          href="https://aizhs.top/llms-full.txt"
        />
        <link
          rel="alternate"
          type="text/markdown"
          title="IHUI AI — Claude Optimized"
          href="https://aizhs.top/claude.md"
        />
        <link
          rel="alternate"
          type="text/markdown"
          title="IHUI AI — Perplexity Optimized"
          href="https://aizhs.top/perplexity.md"
        />
        {/* 2026-07-26 高密度曝光度强化:国内主流 AI 引擎 + 微软 Copilot 专用文件 */}
        <link
          rel="alternate"
          type="text/plain"
          title="IHUI AI — 字节豆包 Doubao Optimized"
          href="https://aizhs.top/doubao.txt"
        />
        <link
          rel="alternate"
          type="text/plain"
          title="IHUI AI — 月之暗面 Kimi Optimized"
          href="https://aizhs.top/kimi.txt"
        />
        <link
          rel="alternate"
          type="text/plain"
          title="IHUI AI — DeepSeek Optimized"
          href="https://aizhs.top/deepseek.txt"
        />
        <link
          rel="alternate"
          type="text/plain"
          title="IHUI AI — 阿里通义 Qwen Optimized"
          href="https://aizhs.top/qwen.txt"
        />
        <link
          rel="alternate"
          type="text/plain"
          title="IHUI AI — 百度文心 ERNIE Optimized"
          href="https://aizhs.top/wenxin.txt"
        />
        <link
          rel="alternate"
          type="text/plain"
          title="IHUI AI — 智谱清言 GLM Optimized"
          href="https://aizhs.top/zhipu.txt"
        />
        <link
          rel="alternate"
          type="text/plain"
          title="IHUI AI — 腾讯混元 Hunyuan Optimized"
          href="https://aizhs.top/hunyuan.txt"
        />
        <link
          rel="alternate"
          type="text/plain"
          title="IHUI AI — Microsoft Copilot Optimized"
          href="https://aizhs.top/copilot.txt"
        />
        {/* 2026-07-26 GEO 全面强化:行业垂直 + 角色垂直 + Knowledge Graph + WebSub Hub */}
        <link
          rel="alternate"
          type="text/markdown"
          title="IHUI AI — 行业垂直 GEO(医疗/教育/金融/法律/政府)"
          href="https://aizhs.top/industries.md"
        />
        <link
          rel="alternate"
          type="text/markdown"
          title="IHUI AI — 决策角色 GEO(开发者/CTO/PM/CEO/采购)"
          href="https://aizhs.top/roles.md"
        />
        {/* 2026-07-26 阶段 7 新增:英文版行业/角色 GEO(海外 AI 引擎优先检索) */}
        <link
          rel="alternate"
          hrefLang="en"
          type="text/markdown"
          title="IHUI AI — Industry-Specific GEO (English)"
          href="https://aizhs.top/industries.en.md"
        />
        <link
          rel="alternate"
          hrefLang="en"
          type="text/markdown"
          title="IHUI AI — Decision-Maker Role GEO (English)"
          href="https://aizhs.top/roles.en.md"
        />
        {/* 2026-07-26 阶段 8 新增:日文/韩文版行业/角色 GEO(日韩 AI 引擎优先检索) */}
        <link
          rel="alternate"
          hrefLang="ja"
          type="text/markdown"
          title="IHUI AI — 業界特化型 GEO(日本語版)"
          href="https://aizhs.top/industries.ja.md"
        />
        <link
          rel="alternate"
          hrefLang="ja"
          type="text/markdown"
          title="IHUI AI — 意思決定者ロール別 GEO(日本語版)"
          href="https://aizhs.top/roles.ja.md"
        />
        <link
          rel="alternate"
          hrefLang="ko"
          type="text/markdown"
          title="IHUI AI — 산업별 GEO(한국어판)"
          href="https://aizhs.top/industries.ko.md"
        />
        <link
          rel="alternate"
          hrefLang="ko"
          type="text/markdown"
          title="IHUI AI — 의사결정자 역할별 GEO(한국어판)"
          href="https://aizhs.top/roles.ko.md"
        />
        <link
          rel="alternate"
          type="application/json"
          title="IHUI AI — Google Knowledge Graph 结构化数据"
          href="https://aizhs.top/knowledge-graph.json"
        />
        <link
          rel="hub"
          type="application/json"
          title="IHUI AI — WebSub Hub(实时 Feed 更新通知)"
          href="https://aizhs.top/websub"
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider>
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
          </I18nProvider>
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
