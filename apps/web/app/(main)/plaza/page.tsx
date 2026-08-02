import type { Metadata } from 'next'
import { Suspense } from 'react'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: '社区广场 — 圈子 / 问答 / 讨论 | 智汇 AI',
  description:
    '智汇 AI 社区广场:加入 AI 圈子、提问答疑、分享经验。与 10000+ AI 开发者、产品经理、企业决策者交流 AI 落地实践。',
  alternates: { canonical: '/plaza' },
  openGraph: {
    title: '社区广场 — 圈子 / 问答 / 讨论',
    description: '与 10000+ AI 从业者交流落地实践',
    url: 'https://aizhs.top/plaza',
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
