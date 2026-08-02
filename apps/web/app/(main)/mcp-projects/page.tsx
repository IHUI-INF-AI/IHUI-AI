import type { Metadata } from 'next'
import { Suspense } from 'react'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'MCP 项目管理 — Model Context Protocol 工具集成 | 智汇 AI',
  description:
    '智汇 AI MCP 项目管理:原生支持 Model Context Protocol,管理 MCP Server、工具调用、Prompt 模板、资源。让 AI Agent 安全调用外部工具与数据源。',
  alternates: { canonical: '/mcp-projects' },
  openGraph: {
    title: 'MCP 项目管理 — Model Context Protocol 工具集成',
    description: '原生 MCP 协议 + 工具调用 + Prompt 模板 + 资源管理',
    url: 'https://aizhs.top/mcp-projects',
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
