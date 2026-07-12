'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Search, Cpu, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Input } from '@ihui/ui'
import {
  FeatureCenterHeader,
  FeatureCenterNav,
  FeatureCard,
  VirtualList,
} from '@/components/feature-center'

interface ModelItem {
  id: string
  name: string
  provider: string
  description: string
  capabilities: string[]
  inputPrice: number
  outputPrice: number
  contextLength: number
}

async function fetchModels(): Promise<ModelItem[]> {
  const res = await fetchApi<ModelItem[]>('/api/feature-center/models')
  if (!res.success) throw new Error(res.error)
  return res.data
}

const PROVIDERS = ['全部', 'openai', 'anthropic', 'google', 'meta', 'local']

export default function ModelsPage() {
  const t = useTranslations('featureCenter.models')
  const { data, isLoading } = useQuery({
    queryKey: ['feature-center-models'],
    queryFn: fetchModels,
  })
  const [keyword, setKeyword] = React.useState('')
  const [provider, setProvider] = React.useState('全部')

  const list = React.useMemo(() => {
    const all = data ?? []
    return all.filter((item) => {
      const matchKeyword =
        !keyword ||
        item.name.toLowerCase().includes(keyword.toLowerCase()) ||
        item.description.toLowerCase().includes(keyword.toLowerCase())
      const matchProvider = provider === '全部' || item.provider === provider
      return matchKeyword && matchProvider
    })
  }, [data, keyword, provider])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <FeatureCenterHeader title={t('title')} description={t('description')} />
      <FeatureCenterNav />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              className={
                'rounded-full border px-3 py-1 text-sm transition-colors ' +
                (provider === p
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted')
              }
            >
              {p === '全部' ? t('catAll') : p}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {t('noMatch')}
          </CardContent>
        </Card>
      ) : (
        <VirtualList items={list} itemKey={(item) => item.id} itemHeight={200}>
          {(item) => (
            <FeatureCard
              title={item.name}
              description={item.description}
              badge={item.provider}
              footer={
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Cpu className="h-3.5 w-3.5" />
                      {t('contextLabel')} {item.contextLength.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="h-3.5 w-3.5" />
                      {item.inputPrice === 0 ? t('freeLabel') : `$${item.inputPrice}/1M`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {item.capabilities.map((cap) => (
                      <span
                        key={cap}
                        className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              }
            />
          )}
        </VirtualList>
      )}
    </div>
  )
}
