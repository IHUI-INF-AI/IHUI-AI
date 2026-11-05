// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, ArrowLeft, Sparkles } from 'lucide-react'

import { apiOrThrow } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui-react'
import { CategoryHeader, AgentAvatar } from '@ihui/rn-app/pilot'
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

export default function AgentCategoryDetailPage() {
  const params = useParams<{ id: string }>()
  const locale = useLocale()
  const t = useTranslations('agentsCategoriesPage')
  const { resolvedTheme } = useTheme()
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light'

  const {
    data: category,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['agents', 'category', params.id],
    queryFn: () => apiOrThrow<Category>(`/api/categories/${params.id}`),
    enabled: !!params.id,
  })

  const { data: agentsData } = useQuery({
    queryKey: ['agents', 'list', params.id],
    queryFn: () =>
      apiOrThrow<AgentsData>(
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
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  if (error || !category) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1 text-body text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-body text-destructive">
          {(error as Error)?.message ?? t('notExists')}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4">
      <Link
        href="/agents"
        className="inline-flex items-center gap-1 text-body text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </Link>

      <Card>
        <CardContent className="min-[640px]:p-3 space-y-4 p-3">
          {/* 分类头与 RN/小程序共用同一段:单源 @ihui/rn-app/pilot → CategoryHeader */}
          <CategoryHeader
            name={category.name}
            icon={category.icon}
            description={category.description}
            statusLabel={t(category.status === '1' ? 'status.enabled' : 'status.disabled')}
            statusEnabled={category.status === '1'}
            paidLabel={t('paidCategory')}
            isPaid={category.isPaid}
            createdAtLabel={fmt(category.createdAt)}
            colorScheme={theme}
          />
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('agentsTitle')}</h2>
          <span className="text-body text-muted-foreground">
            {t('total', { count: agentsData?.total ?? 0 })}
          </span>
        </div>

        {agentsData ? (
          agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
              <Sparkles className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-body text-muted-foreground">{t('emptyAgents')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
              {agents.map((agent: Agent) => (
                <Link
                  key={agent.agentId}
                  href={`/agents/${agent.agentId}`}
                  className="group rounded-lg border p-3 transition-colors hover:bg-accent/40"
                >
                  <div className="flex items-start gap-3">
                    {/* 条目头像同样走共享段(单源 AgentAvatar),web 不再自绘 */}
                    <AgentAvatar avatar={agent.avatar} name={agent.name} colorScheme={theme} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="line-clamp-2 text-body font-medium group-hover:text-primary">
                        {agent.name}
                      </h3>
                      <p className="line-clamp-2 text-label text-muted-foreground">
                        {agent.description ?? t('noDescription')}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <span
                          className={cn(
                            'text-label font-semibold',
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
