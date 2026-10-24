// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import { Button, SearchInput } from '@ihui/ui-react'

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

  // 「加载更多」此前用的是同一个 useQuery + 把 offset 塞进 queryKey:换页 = 换查询 =
  // 列表只剩新一页,**前面 12 条整屏消失**(用户点"加载更多"看到的是列表被顶掉)。
  // 按仓内既有分页形态(sidebar-chat-history 同款)改 useInfiniteQuery:页累加在 pages 里,
  // queryKey 不含 offset,筛选条件变化由 key 自然回第 0 页,原先那个重置 offset 的 effect 一并删除。
  const { data, isLoading, error, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['ai-world-items', kind, category, search, order, pageSize],
      queryFn: ({ pageParam }) =>
        fetchAiWorldItems({
          kind,
          category,
          offset: pageParam,
          limit: pageSize,
          search: search.trim() || undefined,
          order,
        }),
      initialPageParam: 0,
      // 下一页的 offset = 已加载条数;后端给了 total,所以以 total 为准
      // (不用"本页条数==pageSize"那种猜法:后端按状态过滤后末页不足一页就会提前停)。
      getNextPageParam: (lastPage, allPages) => {
        const loaded = allPages.reduce((n, p) => n + p.items.length, 0)
        const total = lastPage.total ?? loaded
        return loaded > 0 && loaded < total ? loaded : undefined
      },
    })

  const items = data?.pages.flatMap((p) => p.items) ?? []
  const hasMore = hasNextPage

  return (
    <div className="space-y-3">
      {(showSearch || showOrder) && (
        <div className="flex flex-wrap items-center gap-2">
          {showSearch && (
            <SearchInput
              size="lg"
              wrapperClassName="min-w-[140px] min-[640px]:min-w-[200px] flex-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索标题或摘要..."
            />
          )}
          {showOrder && (
            <div className="flex items-center gap-1 ui-card rounded-lg border bg-card p-0.5">
              {ORDER_OPTIONS.map((opt) => (
                <Button
                  key={opt.key}
                  variant={order === opt.key ? 'secondary' : 'ghost'}
                  size="xs"
                  className="px-2.5 text-xs"
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
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中...
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-center rounded-md border border-dashed py-8 text-sm text-muted-foreground">
          {emptyHint}
        </div>
      ) : (
        <>
          <div
            className={
              layout === 'grid'
                ? 'grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3'
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
                disabled={isFetching || isFetchingNextPage}
                onClick={() => void fetchNextPage()}
              >
                {(isFetching || isFetchingNextPage) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isFetching || isFetchingNextPage ? '加载中...' : '加载更多'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
