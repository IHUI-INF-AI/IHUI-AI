'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { CreditCard, Plus, Star, Share2, Loader2, Pencil, Trash2 } from 'lucide-react'

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
  createdAt: string
}

interface CardListData {
  list: BusinessCard[]
}

interface FavCardListData {
  list: (BusinessCard & { favoriteId: string })[]
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase()
}

function CardItem({ card, footer }: { card: BusinessCard; footer?: React.ReactNode }) {
  return (
    <Card className="overflow-hidden transition-colors hover:bg-accent/40">
      <CardContent className="flex items-start gap-3 p-4">
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
          <div className="flex items-center gap-2">
            <span className="font-medium">{card.name}</span>
            {card.title && (
              <span className="truncate text-sm text-muted-foreground">{card.title}</span>
            )}
          </div>
          {card.company && <p className="truncate text-sm text-muted-foreground">{card.company}</p>}
          {card.bio && <p className="line-clamp-1 text-xs text-muted-foreground">{card.bio}</p>}
          {footer}
        </div>
      </CardContent>
    </Card>
  )
}

export default function BusinessCardPage() {
  const locale = useLocale()
  const qc = useQueryClient()

  const {
    data: mine,
    isLoading: mineLoading,
    error: mineErr,
  } = useQuery({
    queryKey: ['business-card', 'mine'],
    queryFn: () => api<CardListData>(`/api/business-card`).then((d) => d.list ?? []),
  })

  const {
    data: favs,
    isLoading: favLoading,
    error: favErr,
  } = useQuery({
    queryKey: ['business-card', 'favorites'],
    queryFn: () => api<FavCardListData>(`/api/business-card/favorites`).then((d) => d.list ?? []),
  })

  const removeMut = useMutation({
    mutationFn: (id: string) => api(`/api/business-card/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-card'] }),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit' })
  const fmt = (v?: string) => {
    if (!v) return ''
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '' : dateFmt.format(d)
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">电子名片</h1>
          </div>
          <p className="text-sm text-muted-foreground">管理我的名片与收藏</p>
        </div>
        <Button asChild>
          <Link href="/business-card/edit">
            <Plus className="mr-1 h-4 w-4" />
            新建
          </Link>
        </Button>
      </header>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CreditCard className="h-4 w-4 text-primary" />
          我的名片
          <span className="text-sm font-normal text-muted-foreground">{(mine ?? []).length}</span>
        </h2>
        {mineLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载中...
          </div>
        ) : mineErr ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {(mineErr as Error).message}
          </div>
        ) : (mine ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
            <CreditCard className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">还没有名片,点击「新建」创建</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(mine ?? []).map((card) => (
              <CardItem
                key={card.id}
                card={card}
                footer={
                  <div className="flex items-center gap-2 pt-1.5 text-xs">
                    <span className="text-muted-foreground">{fmt(card.createdAt)}</span>
                    <div className="flex flex-1 justify-end gap-1">
                      <Link
                        href={`/business-card/share/${card.id}`}
                        className="inline-flex items-center rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        title="分享"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </Link>
                      <Link
                        href={`/business-card/edit?id=${card.id}`}
                        className="inline-flex items-center rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        title="编辑"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeMut.mutate(card.id)}
                        disabled={removeMut.isPending}
                        className="inline-flex items-center rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Star className="h-4 w-4 text-amber-500" />
            收藏名片
            <span className="text-sm font-normal text-muted-foreground">{(favs ?? []).length}</span>
          </h2>
          <Link
            href="/business-card/favorites"
            className="text-sm text-primary transition-colors hover:opacity-80"
          >
            查看全部
          </Link>
        </div>
        {favLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载中...
          </div>
        ) : favErr ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {(favErr as Error).message}
          </div>
        ) : (favs ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
            <Star className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">暂无收藏名片</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(favs ?? []).slice(0, 4).map((card) => (
              <Link key={card.id} href={`/business-card/share/${card.id}`}>
                <CardItem card={card} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
