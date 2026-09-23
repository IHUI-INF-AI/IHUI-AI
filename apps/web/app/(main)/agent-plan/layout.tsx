// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// Agent Plan 计划模式页 metadata(SEO):服务端 wrapper 注入唯一 title/OG,区别于工作区通用标题。

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    absolute: 'Agent Plan 计划模式 | IHUI AI',
  },
  description:
    'IHUI AI Agent Plan 计划模式:AI 先拆解任务、生成可执行计划,再逐步执行并实时展示进度,让复杂 Agent 任务可规划、可追踪、可复现。',
  alternates: { canonical: '/agent-plan' },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    title: 'Agent Plan 计划模式 | IHUI AI',
    description: 'IHUI AI Agent Plan:AI 先生成计划再逐步执行,复杂任务可规划可追踪。',
    url: 'https://aizhs.top/agent-plan',
    siteName: 'IHUI AI',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'IHUI AI Agent Plan' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agent Plan 计划模式 | IHUI AI',
    description: 'IHUI AI Agent Plan 计划模式,复杂 Agent 任务可规划可追踪。',
    images: ['/og-image.png'],
  },
}

export default function AgentPlanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
