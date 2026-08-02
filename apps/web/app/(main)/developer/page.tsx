import type { Metadata } from 'next'
import { Suspense } from 'react'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: '开发者中心 — API 调用统计 / Webhook / 密钥管理 | 智汇 AI',
  description:
    '智汇 AI 开发者中心:API 调用统计、Webhook 配置、API Key 管理、用量监控。OpenAI 兼容 API,支持 9 大厂商模型,Bearer Token 鉴权。',
  alternates: { canonical: '/developer' },
  openGraph: {
    title: '开发者中心 — API 统计 / Webhook / 密钥管理',
    description: 'OpenAI 兼容 API + 9 大厂商模型 + 用量监控',
    url: 'https://aizhs.top/developer',
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
