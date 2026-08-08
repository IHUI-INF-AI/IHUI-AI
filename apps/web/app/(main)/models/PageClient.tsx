'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ModelsHeader } from './ModelsHeader'
import { ModelsNav } from './ModelsNav'
import { ModelsMarketplace } from './ModelsMarketplace'
import { AiNewsStrip } from './AiNewsStrip'
import { PROVIDERS, fetchModels } from './helpers'
import type { Provider } from './types'
import { BackButton } from '@/components/common'

/**
 * A 套壳:output:export 不支持 searchParams: Promise + await fetchModels() SSR
 * 改为客户端组件:useSearchParams + useQuery(fetchModels)
 */
export default function ModelsPageClient() {
  const searchParams = useSearchParams()
  const providerParam = searchParams.get('provider')

  const { data: MODELS = [], isError } = useQuery({
    queryKey: ['models'],
    queryFn: fetchModels,
    staleTime: 5 * 60 * 1000,
  })

  const { active, list } = useMemo(() => {
    const active: Provider | 'all' =
      providerParam && (PROVIDERS as string[]).includes(providerParam)
        ? (providerParam as Provider)
        : 'all'
    const list = active === 'all' ? MODELS : MODELS.filter((m) => m.provider === active)
    return { active, list }
  }, [MODELS, providerParam])

  const total = list.length
  const freeCount = list.filter((m) => m.inputPrice === 0).length
  const providerCount = new Set(list.map((m) => m.provider)).size
  const highlightCount = list.filter((m) => m.highlight).length

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      {isError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          模型列表加载失败,请稍后重试
        </div>
      )}
      <ModelsHeader
        total={total}
        freeCount={freeCount}
        providerCount={providerCount}
        highlightCount={highlightCount}
      />
      {/* 2026-08-05 接入:AI 资讯条带(数据源 /api/news/feed → ai_world_items 每日更新,news_articles 为空时自动兜底) */}
      <AiNewsStrip initialNews={[]} />
      <ModelsNav active={active} />
      <ModelsMarketplace list={list} />
    </div>
  )
}
