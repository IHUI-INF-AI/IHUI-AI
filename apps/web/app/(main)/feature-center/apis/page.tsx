'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Search } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Input } from '@ihui/ui'
import {
  FeatureCenterHeader,
  FeatureCenterNav,
  FeatureCard,
  VirtualList,
} from '@/components/feature-center'

interface ApiItem {
  id: string
  name: string
  description: string
  version: string
  category: string
  endpoints: string[]
}

async function fetchApis(): Promise<ApiItem[]> {
  const res = await fetchApi<ApiItem[]>('/api/feature-center/apis')
  if (!res.success) throw new Error(res.error)
  return res.data
}

const CATEGORIES = ['全部', '对话', '图像', '音频', '视频', '工具']

export default function ApisPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['feature-center-apis'],
    queryFn: fetchApis,
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
      <FeatureCenterHeader title="API 集市" description="浏览与接入开放 API" />
      <FeatureCenterNav />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索 API 名称或描述..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={
                'rounded-full border px-3 py-1 text-sm transition-colors ' +
                (category === c
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted')
              }
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            暂无匹配的 API
          </CardContent>
        </Card>
      ) : (
        <VirtualList items={list} itemKey={(item) => item.id} itemHeight={180}>
          {(item) => (
            <FeatureCard
              title={item.name}
              description={item.description}
              badge={item.version}
              footer={
                <div className="flex flex-wrap gap-1">
                  {item.endpoints.map((ep) => (
                    <span
                      key={ep}
                      className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                    >
                      {ep}
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
