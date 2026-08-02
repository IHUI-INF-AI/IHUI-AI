import type { Metadata } from 'next'
import { Suspense } from 'react'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'AI 技术文章 — Agent / LLM / RAG / MCP 深度文章 | 智汇 AI',
  description:
    '智汇 AI 技术文章:AI Agent 开发、LLM 微调、RAG 知识库、MCP 工具协议、多端架构等深度技术文章。实战案例 + 代码示例,助你掌握 AI 全栈开发。',
  alternates: { canonical: '/articles' },
  openGraph: {
    title: 'AI 技术文章 — Agent / LLM / RAG / MCP',
    description: '实战案例 + 代码示例,掌握 AI 全栈开发',
    url: 'https://aizhs.top/articles',
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
