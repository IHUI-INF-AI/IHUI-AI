'use client'

import * as React from 'react'
import Link from 'next/link'
import { Flame, Eye } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'

export interface HotNewsItem {
  id: string
  title: string
  viewCount: number
  publishedAt: string
}

interface HotNewsProps {
  limit?: number
  className?: string
}

const MOCK_NEWS: HotNewsItem[] = [
  {
    id: '1',
    title: 'GPT-5 发布:多模态推理能力大幅提升',
    viewCount: 128340,
    publishedAt: '2026-07-13T10:00:00Z',
  },
  {
    id: '2',
    title: '开源大模型 Llama 4 重磅来袭,推理速度翻倍',
    viewCount: 96512,
    publishedAt: '2026-07-12T14:30:00Z',
  },
  {
    id: '3',
    title: 'AI Agent 在企业场景的落地实践与挑战',
    viewCount: 84210,
    publishedAt: '2026-07-12T09:15:00Z',
  },
  {
    id: '4',
    title: '深度解析 MCP 协议:工具调用的标准化之路',
    viewCount: 67390,
    publishedAt: '2026-07-11T16:20:00Z',
  },
  {
    id: '5',
    title: '国产大模型价格战:豆包、通义、文心三足鼎立',
    viewCount: 56128,
    publishedAt: '2026-07-11T11:45:00Z',
  },
  {
    id: '6',
    title: 'LangChain 0.3 发布:全新的流式处理架构',
    viewCount: 48923,
    publishedAt: '2026-07-10T18:00:00Z',
  },
  {
    id: '7',
    title: 'RAG 进阶:混合检索与重排序的最佳实践',
    viewCount: 41256,
    publishedAt: '2026-07-10T13:30:00Z',
  },
  {
    id: '8',
    title: '多模态大模型评测榜单:谁才是真正的全能王',
    viewCount: 35890,
    publishedAt: '2026-07-09T15:50:00Z',
  },
  {
    id: '9',
    title: '从零搭建 AI 客服:RAG + Agent 实战教程',
    viewCount: 30124,
    publishedAt: '2026-07-09T10:10:00Z',
  },
  {
    id: '10',
    title: 'Claude 4 上线:超长上下文与代码生成新突破',
    viewCount: 25678,
    publishedAt: '2026-07-08T17:25:00Z',
  },
]

const RANK_STYLES: Record<number, string> = {
  1: 'bg-amber-500 text-white',
  2: 'bg-slate-400 text-white',
  3: 'bg-orange-700 text-white',
}

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function formatViews(count: number): string {
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`
  return String(count)
}

async function fetchHotNews(limit: number): Promise<HotNewsItem[]> {
  const res = await fetchApi<HotNewsItem[]>(`/api/news/hot?limit=${limit}`)
  if (res.success && Array.isArray(res.data)) return res.data
  return MOCK_NEWS.slice(0, limit)
}

export function HotNews({ limit = 10, className }: HotNewsProps) {
  const [items, setItems] = React.useState<HotNewsItem[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    fetchHotNews(limit)
      .then((data) => {
        if (!cancelled) setItems(data)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [limit])

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <Flame className="h-4 w-4 text-orange-500" />
          热门资讯
        </CardTitle>
        <Link
          href="/news"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          更多
        </Link>
      </CardHeader>
      <CardContent className="p-2 pt-0">
        {loading ? (
          <div className="space-y-1.5 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 px-1.5 py-1.5">
                <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-muted" />
                <div className="h-3.5 flex-1 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          <ol className="space-y-0.5">
            {items.map((item, idx) => {
              const rank = idx + 1
              const topThree = rank <= 3
              return (
                <li key={item.id}>
                  <Link
                    href={`/news/${item.id}`}
                    className="group flex items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-muted/60"
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-semibold',
                        topThree ? RANK_STYLES[rank] : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {rank}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm leading-snug text-foreground/90 transition-colors group-hover:text-foreground">
                      {item.title}
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
                      <Eye className="h-3 w-3" />
                      {formatViews(item.viewCount)}
                    </span>
                    <time className="hidden shrink-0 text-xs text-muted-foreground/70 sm:block">
                      {dateFmt.format(new Date(item.publishedAt))}
                    </time>
                  </Link>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

export default HotNews
