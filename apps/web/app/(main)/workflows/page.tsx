import type { Metadata } from 'next'
import { Suspense } from 'react'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'AI 工作流编排 — n8n 风格节点画布 | 智汇 AI',
  description:
    '智汇 AI 工作流编排:n8n 风格可视化节点画布,拖拽式编排 AI 自动化流程。支持触发器、条件分支、循环、并行执行,集成 100+ 模型与 MCP 工具。',
  alternates: { canonical: '/workflows' },
  openGraph: {
    title: 'AI 工作流编排 — n8n 风格节点画布',
    description: '可视化拖拽编排 + 触发器 + 条件分支 + MCP 工具集成',
    url: 'https://aizhs.top/workflows',
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
