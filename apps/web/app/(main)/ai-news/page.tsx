import * as React from 'react'
import type { Metadata } from 'next'
import { Hero } from './components/Hero'
import { ComparisonTableSection } from './components/ComparisonTable'
import { LiveChannelsBlock } from './components/LiveChannelsBlock'
import { AiFeedTimeline } from './components/AiFeedTimeline'
import { FundingSection } from './components/FundingSection'
import { CtaSection } from './components/CtaSection'
import {
  fetchAiFeedItems,
  fetchAiFeedSources,
  fetchAiLiveChannels,
  getComparisonTable,
  getFundingItems,
} from '@/lib/ai-news-api'

export const metadata: Metadata = {
  title: 'AI 资讯 · 全网实时聚合流',
  description:
    '聚合国内外 17 个信源(微博/知乎/36氪/HackerNews/TechCrunch/OpenAI Blog/Arxiv 等),每 6 小时自动采集,模型/产品/行业/论文分类与趋势信号实时更新。',
}

export default async function AiNewsPage() {
  const [feed, sources, channels, comparison, funding] = await Promise.all([
    fetchAiFeedItems(50),
    fetchAiFeedSources(),
    fetchAiLiveChannels(4),
    Promise.resolve(getComparisonTable()),
    Promise.resolve(getFundingItems()),
  ])

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-6">
      <Hero />
      <ComparisonTableSection table={comparison} />
      <LiveChannelsBlock channels={channels} />
      <AiFeedTimeline items={feed.items} sources={sources} total={feed.total} />
      <FundingSection items={funding} />
      <CtaSection />
    </div>
  )
}
