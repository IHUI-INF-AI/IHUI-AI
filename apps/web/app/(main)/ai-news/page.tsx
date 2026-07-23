import * as React from 'react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Hero } from './components/Hero'
import { Leaderboard } from './components/Leaderboard'
import { ApiRelaysSection } from './components/ApiRelaysSection'
import { LiveChannelsBlock } from './components/LiveChannelsBlock'
import { AiFeedTimeline } from './components/AiFeedTimeline'
import { HotRanking } from './components/HotRanking'
import { FundingSection } from './components/FundingSection'
import { CtaSection } from './components/CtaSection'
import {
  fetchAiFeedItems,
  fetchAiFeedSources,
  fetchAiFeedHot,
  fetchAiLiveChannels,
  fetchAllLeaderboardEntries,
  getFundingItems,
} from '@/lib/ai-news-api'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('aiNews')
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function AiNewsPage() {
  // allSettled 降级:任一 fetch 失败不阻塞整页,用空数组/默认值降级
  const [feed, sources, hotRanking, channels, leaderboard, funding] = await Promise.allSettled([
    fetchAiFeedItems(50),
    fetchAiFeedSources(),
    fetchAiFeedHot(10),
    fetchAiLiveChannels(4),
    fetchAllLeaderboardEntries(),
    Promise.resolve(getFundingItems()),
  ])

  const feedData = feed.status === 'fulfilled' ? feed.value : { items: [], total: 0 }
  const sourcesData = sources.status === 'fulfilled' ? sources.value : []
  const hotData = hotRanking.status === 'fulfilled' ? hotRanking.value : []
  const channelsData = channels.status === 'fulfilled' ? channels.value : []
  const leaderboardData = leaderboard.status === 'fulfilled' ? leaderboard.value : []
  const fundingData = funding.status === 'fulfilled' ? funding.value : []

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-6">
      <Hero />
      <Leaderboard entries={leaderboardData} />
      <ApiRelaysSection />
      <LiveChannelsBlock channels={channelsData} />
      <AiFeedTimeline items={feedData.items} sources={sourcesData} total={feedData.total} />
      {hotData.length > 0 ? <HotRanking items={hotData} sources={sourcesData} /> : null}
      <FundingSection items={fundingData} />
      <CtaSection />
    </div>
  )
}
