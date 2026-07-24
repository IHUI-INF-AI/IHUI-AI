'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Search } from 'lucide-react'

import { Button, Input } from '@ihui/ui-react'
import { fetchAiWorldItems } from './helpers'
import type { ItemKind } from './types'
import { ItemCard } from './ItemCard'

interface Props {
  kind: ItemKind
  category?: string
  layout?: 'grid' | 'list'
  pageSize?: number
  showSearch?: boolean
  showOrder?: boolean
  emptyHint?: string
}

type OrderKey = 'latest' | 'hot' | 'published' | 'trending'

const ORDER_OPTIONS: Array<{ key: OrderKey; label: string }> = [
  { key: 'latest', label: '最新' },
  { key: 'hot', label: '热门' },
  { key: 'published', label: '发布时间' },
  { key: 'trending', label: '热度榜' },
]

export function ItemList({
  kind,
  category,
  layout = 'grid',
  pageSize = 12,
  showSearch = true,
  showOrder = true,
  emptyHint = '暂无数据',
}: Props) {
  const [search, setSearch] = React.useState('')
  const [order, setOrder] = React.useState<OrderKey>('latest')
  const [offset, setOffset] = React.useState(0)

  // 切换 kind/category 时重置分页
  React.useEffect(() => {
    setOffset(0)
  }, [kind, category, search, order])

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['ai-world-items', kind, category, search, order, offset, pageSize],
    queryFn: () =>
      fetchAiWorldItems({
        kind,
        category,
        offset,
        limit: pageSize,
        search: search.trim() || undefined,
        order,
      }),
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const hasMore = offset + items.length < total

  return (
    <div className="space-y-3">
      {(showSearch || showOrder) && (
        <div className="flex flex-wrap items-center gap-2">
          {showSearch && (
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索标题或摘要..."
                className="pl-8"
              />
            </div>
          )}
          {showOrder && (
            <div className="flex items-center gap-1 rounded-md border bg-card p-0.5">
              {ORDER_OPTIONS.map((opt) => (
                <Button
                  key={opt.key}
                  variant={order === opt.key ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setOrder(opt.key)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中...
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-center rounded-md border border-dashed py-12 text-sm text-muted-foreground">
          {emptyHint}
        </div>
      ) : (
        <>
          <div
            className={
              layout === 'grid'
                ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'
                : 'space-y-2'
            }
          >
            {items.map((item) => (
              <ItemCard key={item.id} item={item} layout={layout} />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isFetching}
                onClick={() => setOffset((o) => o + pageSize)}
              >
                {isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isFetching ? '加载中...' : '加载更多'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
