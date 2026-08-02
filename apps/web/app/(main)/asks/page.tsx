import type { Metadata } from 'next'
import { Suspense } from 'react'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'AI 问答社区 — 技术问答与经验分享 | 智汇 AI',
  description:
    '智汇 AI 问答社区:提问 AI 开发、Agent 编排、RAG 部署、MCP 集成等问题,获得社区专家解答。已有 1000+ 优质问答。',
  alternates: { canonical: '/asks' },
  openGraph: {
    title: 'AI 问答社区 — 技术问答与经验分享',
    description: '1000+ 优质问答,社区专家在线解答',
    url: 'https://aizhs.top/asks',
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
