'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Star, Loader2, ArrowLeft, Trash2, Share2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui'

interface BusinessCard {
  id: string
  name: string
  title?: string | null
  company?: string | null
  phone?: string | null
  email?: string | null
  wechat?: string | null
  address?: string | null
  avatar?: string | null
  bio?: string | null
  template?: string
}

interface FavoriteEntry {
  card: BusinessCard
  favoriteId: string
  createdAt: string
}

interface FavListData {
  list: FavoriteEntry[]
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase()
}

export default function CardFavoritesPage() {
  const locale = useLocale()
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['business-card', 'favorites', 'list'],
    queryFn: () => api<FavListData>(`/api/business-card/favorites`).then((d) => d.list ?? []),
  })

  const removeMut = useMutation({
    mutationFn: (favId: string) =>
      api(`/api/business-card/favorites/${favId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-card'] }),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit' })
  const fmt = (v?: string) => {
    if (!v) return ''
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '' : dateFmt.format(d)
  }

  const items = data ?? []

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link
        href="/business-card"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回列表
      </Link>

      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Star className="h-6 w-6 text-amber-500" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">收藏的名片</h1>
        </div>
        <p className="text-sm text-muted-foreground">共收藏 {items.length} 张名片</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <Star className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">暂无收藏名片</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((entry) => {
            const card = entry.card
            return (
              <Card
                key={entry.favoriteId}
                className="overflow-hidden transition-colors hover:bg-accent/40"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {card.avatar ? (
                      <Image
                        src={card.avatar}
                        alt={card.name}
                        width={48}
                        height={48}
                        className="h-12 w-12 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {initials(card.name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <Link href={`/business-card/share/${card.id}`}>
                        <span className="font-medium transition-colors hover:text-primary">
                          {card.name}
                        </span>
                      </Link>
                      {card.title && (
                        <p className="truncate text-sm text-muted-foreground">{card.title}</p>
                      )}
                      {card.company && (
                        <p className="truncate text-sm text-muted-foreground">{card.company}</p>
                      )}
                      <div className="flex items-center gap-2 pt-1.5 text-xs">
                        <span className="text-muted-foreground">收藏于 {fmt(entry.createdAt)}</span>
                        <div className="flex flex-1 justify-end gap-1">
                          <Link
                            href={`/business-card/share/${card.id}`}
                            className="inline-flex items-center rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            title="查看"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeMut.mutate(entry.favoriteId)}
                            disabled={removeMut.isPending}
                            title="取消收藏"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
