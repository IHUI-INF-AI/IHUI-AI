'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, ArrowLeft, Tag, Calendar, CreditCard, Sparkles } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface Category {
  categoryId: string
  name: string
  description: string | null
  icon: string | null
  sort: number
  status: string
  isPaid: boolean
  createdAt: string
  updatedAt: string
}

interface Agent {
  agentId: string
  name: string
  description: string | null
  avatar: string | null
  cover: string | null
  status: string
  price: number
  isFree: boolean
  sort: number
  createdAt: string
}

interface AgentsData {
  list: Agent[]
  total: number
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function AgentCategoryDetailPage() {
  const params = useParams<{ id: string }>()
  const locale = useLocale()
  const t = useTranslations('agentsCategoriesPage')

  const {
    data: category,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['agents', 'category', params.id],
    queryFn: () => api<Category>(`/api/categories/${params.id}`),
    enabled: !!params.id,
  })

  const { data: agentsData } = useQuery({
    queryKey: ['agents', 'list', params.id],
    queryFn: () =>
      api<AgentsData>(
        `/api/agents/list?categoryId=${params.id}&status=published&page=1&pageSize=100`,
      ),
    enabled: !!params.id,
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const fmt = (v: string) => {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const agents = agentsData?.list ?? []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  if (error || !category) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? t('notExists')}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link
        href="/agents"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </Link>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              {category.icon ? (
                <span className="text-xl">{category.icon}</span>
              ) : (
                <Tag className="h-6 w-6 text-primary" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h1 className="text-xl font-bold tracking-tight">{category.name}</h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-2 py-0.5',
                    category.status === '1'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {t(category.status === '1' ? 'status.enabled' : 'status.disabled')}
                </span>
                {category.isPaid && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-amber-600 dark:text-amber-500">
                    <CreditCard className="h-3 w-3" />
                    {t('paidCategory')}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {fmt(category.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {category.description && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {category.description}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('agentsTitle')}</h2>
          <span className="text-sm text-muted-foreground">{t('total', { count: agentsData?.total ?? 0 })}</span>
        </div>

        {agentsData ? (
          agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
              <Sparkles className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('emptyAgents')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {agents.map((agent) => (
                <Link
                  key={agent.agentId}
                  href={`/agents/${agent.agentId}`}
                  className="group rounded-lg border p-4 transition-colors hover:bg-accent/40"
                >
                  <div className="flex items-start gap-3">
                    {agent.avatar ? (
                      <Image
                        src={agent.avatar}
                        alt={agent.name}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <Sparkles className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="line-clamp-2 text-sm font-medium group-hover:text-primary">
                        {agent.name}
                      </h3>
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {agent.description ?? t('noDescription')}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <span
                          className={cn(
                            'text-xs font-semibold',
                            agent.isFree
                              ? 'text-emerald-600 dark:text-emerald-500'
                              : 'text-primary',
                          )}
                        >
                          {agent.isFree ? t('free') : `¥${agent.price}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        ) : (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('loadingAgents')}
          </div>
        )}
      </div>
    </div>
  )
}
