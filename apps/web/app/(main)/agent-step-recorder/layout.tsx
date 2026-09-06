// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​‌​‌​‌‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍‌​‌‌​‌‌‌‍‌‌​​‌‌​​‌‌‌‌​‌​‍‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍‌​‌‌​‌‌‌‍‌‌​​‌‌‌​‌​​‌‌‌​‍‌‌​​‌‌​​​‌​​‌​‌‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍​‌‌​‌‌‌‍​‌​​‌‌​​‍​‌​​​​‌‌‍​‌​​​​​‌‌‍​‌‌​‌‌​‌‌‍​‌‌‌​​​​‌‍​‌‌​‌​​‌‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍​‌‌‌​​‌‌‍​​‌​‌‌‌​‍​‌‌‌​‌​​‍​‌‌​‌‌‌‌‍​‌‌‌​​​​‍‌​‌‌​‌‌‌‍​‌​‌​​​​‍​‌​‌​​‌​‍​‌​​‌‌‌‌‍​‌​‌​‌‌​‍​‌​​​‌​‌‍​‌​​‌‌‌​‍​‌​​​​​‌‍​‌​​‌‌‌​‍​‌​​​​‌‌‍​‌​​​‌​‌‍​​‌​‌‌​‌‍​​‌‌​​‌​‍​​‌‌​​​​‍​​‌‌​​‌​‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// Agent Step 录制回放页 metadata(SEO):服务端 wrapper 注入唯一 title/OG,区别于工作区通用标题。

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    absolute: 'Agent Step 录制回放 | IHUI AI',
  },
  description:
    'IHUI AI Agent Step 录制回放:输入 run_id 回放 Agent 运行的逐步工具调用时间线,含 Token、耗时、成本与成败统计,实现可复现审计,对标 WorkBuddy/Codex。',
  alternates: { canonical: '/agent-step-recorder' },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    title: 'Agent Step 录制回放 | IHUI AI',
    description:
      'IHUI AI Agent Step 录制回放:逐步工具调用时间线,含 token / 耗时 / 成本 / 成败统计。',
    url: 'https://aizhs.top/agent-step-recorder',
    siteName: 'IHUI AI',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'IHUI AI Agent Step 录制回放' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agent Step 录制回放 | IHUI AI',
    description: 'IHUI AI Agent Step 录制回放,Agent 运行可复现审计。',
    images: ['/og-image.png'],
  },
}

export default function AgentStepRecorderLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}