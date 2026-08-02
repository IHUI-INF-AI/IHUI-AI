import type { Metadata } from 'next'
import { Suspense } from 'react'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: '社区圈子 — AI 兴趣小组与主题社区 | 智汇 AI',
  description:
    '智汇 AI 社区圈子:加入或创建 AI 兴趣小组,与同行交流 RAG、Agent、MCP、多模态等主题。分享帖子,互助成长。',
  alternates: { canonical: '/circles' },
  openGraph: {
    title: '社区圈子 — AI 兴趣小组与主题社区',
    description: '加入 AI 兴趣小组,与同行交流成长',
    url: 'https://aizhs.top/circles',
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
