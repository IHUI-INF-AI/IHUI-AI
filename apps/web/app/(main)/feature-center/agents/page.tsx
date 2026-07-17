'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Input } from '@ihui/ui'
import {
  FeatureCenterHeader,
  FeatureCenterNav,
  FeatureCard,
  VirtualList,
} from '@/components/feature-center'

interface AgentItem {
  id: string
  name: string
  description: string
  category: string
  capabilities: string[]
}

async function fetchAgents(): Promise<AgentItem[]> {
  const res = await fetchApi<AgentItem[]>('/api/feature-center/agents')
  if (!res.success) throw new Error(res.error)
  return res.data
}

const CATEGORIES = [
  { value: '全部', key: 'catAll' },
  { value: '对话', key: 'catChat' },
  { value: '编程', key: 'catCoding' },
  { value: '写作', key: 'catWriting' },
  { value: '分析', key: 'catAnalysis' },
  { value: '工具', key: 'catTool' },
] as const

export default function AgentsPage() {
  const t = useTranslations('featureCenter.agents')
  const { data, isLoading } = useQuery({
    queryKey: ['feature-center-agents'],
    queryFn: fetchAgents,
  })
  const [keyword, setKeyword] = React.useState('')
  const [category, setCategory] = React.useState('全部')

  const list = React.useMemo(() => {
    const all = data ?? []
    return all.filter((item) => {
      const matchKeyword =
        !keyword ||
        item.name.toLowerCase().includes(keyword.toLowerCase()) ||
        item.description.toLowerCase().includes(keyword.toLowerCase())
      const matchCategory = category === '全部' || item.category === category
      return matchKeyword && matchCategory
    })
  }, [data, keyword, category])

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
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={
                'rounded-md border px-3 py-1 text-sm transition-colors ' +
                (category === c.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted')
              }
            >
              {t(c.key)}
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
        <VirtualList items={list} itemKey={(item) => item.id} itemHeight={180}>
          {(item) => (
            <FeatureCard
              title={item.name}
              description={item.description}
              badge={item.category}
              footer={
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
              }
            />
          )}
        </VirtualList>
      )}
    </div>
  )
}
