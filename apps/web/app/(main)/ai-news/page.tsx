import * as React from 'react'
import type { Metadata } from 'next'
import { Hero } from './components/Hero'
import { ComparisonTableSection } from './components/ComparisonTable'
import { LiveChannelsBlock } from './components/LiveChannelsBlock'
import { NewsGrid } from './components/NewsGrid'
import { FundingSection } from './components/FundingSection'
import { CtaSection } from './components/CtaSection'
import {
  fetchAiNewsArticles,
  fetchAiLiveChannels,
  getComparisonTable,
  getFundingItems,
} from '@/lib/ai-news-api'

export const metadata: Metadata = {
  title: 'AI 资讯 · 2026-07 真实资讯流',
  description:
    '聚合 2026 年 7 月真实 AI 资讯:GPT-5.6 / Claude Sonnet 5 / Gemini 3.5 Pro / Kimi K3 / DeepSeek V4 横向对比,WAIC 2026 直播入口,重磅融资与收购。',
}

export default async function AiNewsPage() {
  const [articles, channels, comparison, funding] = await Promise.all([
    fetchAiNewsArticles(9),
    fetchAiLiveChannels(4),
    Promise.resolve(getComparisonTable()),
    Promise.resolve(getFundingItems()),
  ])

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-6">
      <Hero />
      <ComparisonTableSection table={comparison} />
      <LiveChannelsBlock channels={channels} />
      <NewsGrid articles={articles} />
      <FundingSection items={funding} />
      <CtaSection />
    </div>
  )
}
