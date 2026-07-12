'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Zap, Code, Wrench, ArrowRight } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardDescription } from '@ihui/ui'

interface ToolItem {
  id: string
  name: string
  description: string
  category: 'ai' | 'dev' | 'efficiency'
  url: string
}

const CATEGORIES: {
  key: ToolItem['category']
  label: string
  Icon: React.ComponentType<{ className?: string }>
}[] = [
  { key: 'ai', label: 'categoryAi', Icon: Zap },
  { key: 'dev', label: 'categoryDev', Icon: Code },
  { key: 'efficiency', label: 'categoryEfficiency', Icon: Wrench },
]

export default function ToolsPage() {
  const t = useTranslations('common.tools')
  const { data: list = [], isLoading } = useQuery({
    queryKey: ['tools'],
    queryFn: async () => {
      const r = await fetchApi<ToolItem[]>('/api/tools')
      if (r.success && r.data) return r.data
      return []
    },
  })

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : (
        CATEGORIES.map(({ key, label, Icon }) => {
          const items = list.filter((item) => item.category === key)
          return (
            <section key={key} className="space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Icon className="h-5 w-5 text-primary" />
                {t(label)}
              </h2>
              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                  {t('empty')}
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((tool) => (
                    <Link key={tool.id} href={tool.url} className="group block">
                      <Card className="transition-colors hover:bg-accent">
                        <CardHeader className="flex-row items-center gap-3 space-y-0 p-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-sm">{tool.name}</CardTitle>
                            <CardDescription className="text-xs">
                              {tool.description}
                            </CardDescription>
                          </div>
                          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                        </CardHeader>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}
