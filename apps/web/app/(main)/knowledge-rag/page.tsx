import type { Metadata } from 'next'
import { Suspense } from 'react'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'RAG 知识检索 — 向量 + BM25 + 知识图谱 | 智汇 AI',
  description:
    '智汇 AI RAG 知识检索:文档分块、向量化、混合检索(向量 + BM25 + 知识图谱),支持实时搜索与引用追溯。企业级 RAG 管理平台。',
  alternates: { canonical: '/knowledge-rag' },
  openGraph: {
    title: 'RAG 知识检索 — 向量 + BM25 + 知识图谱',
    description: '文档分块 + 向量化 + 混合检索 + 引用追溯',
    url: 'https://aizhs.top/knowledge-rag',
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
