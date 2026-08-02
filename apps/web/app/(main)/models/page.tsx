import type { Metadata } from 'next'
import { Suspense } from 'react'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'AI 模型市场 — 176+ 模型统一调度 | 智汇 AI',
  description:
    '智汇 AI 模型市场:集成 OpenAI / Claude / Gemini / 通义千问 / 文心一言 / DeepSeek / Kimi 等 9 大厂商 176+ 模型,统一 API 调度,自动 fallback,按量计费。',
  alternates: { canonical: '/models' },
  openGraph: {
    title: 'AI 模型市场 — 176+ 模型统一调度',
    description: '9 大厂商 176+ 模型,统一 API + 自动 fallback + 按量计费',
    url: 'https://aizhs.top/models',
    type: 'website',
  },
}

export function generateStaticParams() {
  return []
}

export default function Page() {
  return (
    <Suspense>
      <PageClient />
    </Suspense>
  )
}
