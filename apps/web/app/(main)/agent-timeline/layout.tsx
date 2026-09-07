// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 全活动时间线回放页 metadata(SEO):服务端 wrapper 注入唯一 title/OG。

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    absolute: 'Agent 全活动时间线回放 | IHUI AI',
  },
  description:
    'IHUI AI Agent 全活动时间线回放:输入 session_id 一次拉全步骤/上下文压缩/检查点/成本/注入拦截五类活动,统一时间轴可视化与汇总统计,检查点可回滚,对标 WorkBuddy/Codex 可复现审计。',
  alternates: { canonical: '/agent-timeline' },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    title: 'Agent 全活动时间线回放 | IHUI AI',
    description:
      '五类 agent 活动统一时间轴回放,含成本 / Token 汇总与检查点回滚入口。',
    url: 'https://aizhs.top/agent-timeline',
    siteName: 'IHUI AI',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'IHUI AI Agent 全活动时间线回放' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agent 全活动时间线回放 | IHUI AI',
    description: 'IHUI AI Agent 全活动时间线回放,可复现审计。',
    images: ['/og-image.png'],
  },
}

export default function AgentTimelineLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
