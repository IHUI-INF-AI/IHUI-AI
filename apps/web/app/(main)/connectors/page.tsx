import type { Metadata } from 'next'
import { Suspense } from 'react'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: '中文连接器 — 接入语雀/飞书/企业微信/钉钉 | IHUI AI',
  description:
    '配置语雀/飞书/企业微信/钉钉连接器(token 与知识库地址),让 AI 对话能直接读取中文知识平台文档。',
  alternates: { canonical: '/connectors' },
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageClient />
    </Suspense>
  )
}
