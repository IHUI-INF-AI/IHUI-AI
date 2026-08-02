import type { Metadata } from 'next'
import { Suspense } from 'react'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: '知识库 — 企业 RAG 知识管理系统 | 智汇 AI',
  description:
    '智汇 AI 知识库:支持 30+ 数据源接入,混合检索(向量 + BM25 + 知识图谱),引用追溯,细粒度权限管控。帮企业把散落文档变成可对话的 AI 知识大脑。',
  alternates: { canonical: '/knowledge-base' },
  openGraph: {
    title: '企业知识库 RAG — 智汇 AI',
    description: '30+ 数据源 + 混合检索 + 引用追溯 + 权限管控',
    url: 'https://aizhs.top/knowledge-base',
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
