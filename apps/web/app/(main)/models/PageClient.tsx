'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ModelsHeader } from './ModelsHeader'
import { ModelsNav } from './ModelsNav'
import { ModelsMarketplace } from './ModelsMarketplace'
import { PROVIDERS, fetchModels } from './helpers'
import type { Provider } from './types'

/**
 * A 套壳:output:export 不支持 searchParams: Promise + await fetchModels() SSR
 * 改为客户端组件:useSearchParams + useQuery(fetchModels)
 */
export default function ModelsPageClient() {
  const searchParams = useSearchParams()
  const providerParam = searchParams.get('provider')

  const { data: MODELS = [] } = useQuery({
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
    <div className="space-y-6">
      <ModelsHeader
        total={total}
        freeCount={freeCount}
        providerCount={providerCount}
        highlightCount={highlightCount}
      />
      <ModelsNav active={active} />
      <ModelsMarketplace list={list} />
    </div>
  )
}
