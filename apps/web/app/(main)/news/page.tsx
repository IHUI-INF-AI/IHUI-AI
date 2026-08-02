import type { Metadata } from 'next'
import { Suspense } from 'react'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'AI 行业资讯 — 最新人工智能新闻动态 | 智汇 AI',
  description:
    '智汇 AI 行业资讯:聚焦 AI 大模型、Agent、RAG、MCP、多模态等前沿动态。每日更新 OpenAI / Anthropic / Google / 百度 / 阿里等最新发布。',
  alternates: { canonical: '/news' },
  openGraph: {
    title: 'AI 行业资讯 — 最新人工智能新闻动态',
    description: '每日更新 AI 大模型 / Agent / RAG / MCP 前沿动态',
    url: 'https://aizhs.top/news',
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
