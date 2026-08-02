import type { Metadata } from 'next'
import { Suspense } from 'react'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'AI Agent 市场 — 200+ 智能 Agent 模板 | 智汇 AI',
  description:
    '智汇 AI Agent 市场:200+ 智能 Agent 模板,覆盖客服、销售、内容创作、代码审查、数据分析等场景。可视化编排,一键发布六端,支持 MCP 工具协议。',
  alternates: { canonical: '/agents' },
  openGraph: {
    title: 'AI Agent 市场 — 200+ 智能 Agent 模板',
    description: '可视化编排 + MCP 工具协议 + 一键发布六端',
    url: 'https://aizhs.top/agents',
    type: 'website',
  },
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageClient />
    </Suspense>
  )
}
