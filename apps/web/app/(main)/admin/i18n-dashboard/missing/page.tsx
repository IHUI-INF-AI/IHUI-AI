'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft, Loader2, ChevronDown, ChevronRight } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@ihui/ui-react'

interface MissingKey {
  key: string
  namespace: string
  locale: string
}

interface MissingData {
  list: MissingKey[]
  total: number
}

const LOCALES = [
  { value: 'all', label: '全部语言' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'zh-TW', label: '繁體中文' },
]

const LOCALE_COLORS: Record<string, string> = {
  en: '#3b82f6',
  ja: '#f59e0b',
  ko: '#8b5cf6',
  'zh-TW': '#ec4899',
}

const MOCK: MissingData = {
  list: [
    { key: 'common.confirm', namespace: 'common', locale: 'en' },
    { key: 'common.cancel', namespace: 'common', locale: 'en' },
    { key: 'menu.dashboard', namespace: 'menu', locale: 'en' },
    { key: 'menu.profile', namespace: 'menu', locale: 'ja' },
    { key: 'menu.settings', namespace: 'menu', locale: 'ja' },
    { key: 'home.hero_title', namespace: 'home', locale: 'ko' },
    { key: 'home.hero_desc', namespace: 'home', locale: 'ko' },
    { key: 'user.edit', namespace: 'user', locale: 'zh-TW' },
    { key: 'user.delete', namespace: 'user', locale: 'zh-TW' },
    { key: 'articles.empty', namespace: 'articles', locale: 'ja' },
  ],
  total: 1440,
}

export default function I18nMissingPage() {
  const [locale, setLocale] = React.useState<string>('all')
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})

  const { data, isLoading, error } = useQuery<MissingData>({
    queryKey: ['i18n', 'missing', locale],
    queryFn: async () => {
      const qs = new URLSearchParams({ pageSize: '200' })
      if (locale !== 'all') qs.set('locale', locale)
      const r = await fetchApi<MissingData>(`/api/admin/i18n-dashboard/missing?${qs.toString()}`)
      return r.success && r.data ? r.data : MOCK
    },
    staleTime: 60_000,
  })

  const d = data ?? MOCK
  const items = d.list

  const groups = React.useMemo(() => {
    const m = new Map<string, MissingKey[]>()
    for (const item of items) {
      if (locale !== 'all' && item.locale !== locale) continue
      const arr = m.get(item.namespace) ?? []
      arr.push(item)
      m.set(item.namespace, arr)
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [items, locale])

  function toggle(ns: string) {
    setExpanded((p) => ({ ...p, [ns]: !p[ns] }))
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Link
        href="/admin/i18n-dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回概览
      </Link>

      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-6 w-6 text-amber-500" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">缺失 Key 列表</h1>
        </div>
        <p className="text-sm text-muted-foreground">共 {d.total} 个 Key 待翻译</p>
      </header>

      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
        {LOCALES.map((l) => (
          <button
            key={l.value}
            type="button"
            onClick={() => setLocale(l.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              locale === l.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {l.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <AlertCircle className="h-8 w-8 text-emerald-500" />
          <p className="text-sm text-muted-foreground">该语言无缺失 Key</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(([ns, keys]) => {
            const isOpen = expanded[ns] ?? true
            return (
              <Card key={ns}>
                <CardContent className="p-0">
                  <button
                    type="button"
                    onClick={() => toggle(ns)}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/30"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-mono text-sm font-medium">{ns}</span>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {keys.length}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="divide-y border-t">
                      {keys.map((k) => (
                        <div
                          key={`${k.locale}-${k.key}`}
                          className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/30"
                        >
                          <span
                            className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium"
                            style={{
                              background: `${LOCALE_COLORS[k.locale] ?? '#3b82f6'}20`,
                              color: LOCALE_COLORS[k.locale] ?? '#3b82f6',
                            }}
                          >
                            {k.locale}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-mono text-sm">{k.key}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
