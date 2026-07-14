'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Globe, AlertCircle, Clock, Loader2, ArrowRight } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

interface LangProgress {
  locale: string
  name: string
  total: number
  translated: number
  missing: number
  completion: number
}

interface RecentUpdate {
  id: string
  locale: string
  key: string
  namespace: string
  updatedAt: string
  author?: string
}

interface I18nOverview {
  languages: LangProgress[]
  totalMissing: number
  recentUpdates: RecentUpdate[]
}

const MOCK: I18nOverview = {
  languages: [
    {
      locale: 'zh-CN',
      name: '简体中文',
      total: 3600,
      translated: 3600,
      missing: 0,
      completion: 100,
    },
    { locale: 'en', name: 'English', total: 3600, translated: 3420, missing: 180, completion: 95 },
    { locale: 'ja', name: '日本語', total: 3600, translated: 3168, missing: 432, completion: 88 },
    { locale: 'ko', name: '한국어', total: 3600, translated: 3060, missing: 540, completion: 85 },
    {
      locale: 'zh-TW',
      name: '繁體中文',
      total: 3600,
      translated: 3312,
      missing: 288,
      completion: 92,
    },
  ],
  totalMissing: 1440,
  recentUpdates: [
    {
      id: '1',
      locale: 'en',
      key: 'common.save',
      namespace: 'common',
      updatedAt: '2026-07-14T10:30:00Z',
      author: 'admin',
    },
    {
      id: '2',
      locale: 'ja',
      key: 'menu.settings',
      namespace: 'menu',
      updatedAt: '2026-07-14T09:15:00Z',
      author: 'translator1',
    },
    {
      id: '3',
      locale: 'ko',
      key: 'home.welcome',
      namespace: 'home',
      updatedAt: '2026-07-13T18:45:00Z',
    },
    {
      id: '4',
      locale: 'zh-TW',
      key: 'user.profile',
      namespace: 'user',
      updatedAt: '2026-07-13T14:20:00Z',
      author: 'admin',
    },
    {
      id: '5',
      locale: 'en',
      key: 'articles.title',
      namespace: 'articles',
      updatedAt: '2026-07-13T11:00:00Z',
    },
  ],
}

const LOCALE_COLORS: Record<string, string> = {
  'zh-CN': '#10b981',
  en: '#3b82f6',
  ja: '#f59e0b',
  ko: '#8b5cf6',
  'zh-TW': '#ec4899',
}

function RingChart({ value, color }: { value: number; color: string }) {
  const deg = (value / 100) * 360
  return (
    <div
      className="relative flex h-20 w-20 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${color} ${deg}deg, hsl(var(--muted)) 0deg)` }}
    >
      <div className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-background">
        <span className="text-sm font-bold">{value}%</span>
      </div>
    </div>
  )
}

function fmtTime(v: string) {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '-'
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return `${Math.floor(diff / 86_400_000)} 天前`
}

export default function I18nDashboardPage() {
  const { data, isLoading } = useQuery<I18nOverview>({
    queryKey: ['i18n', 'overview'],
    queryFn: async () => {
      const r = await fetchApi<I18nOverview>('/api/admin/i18n-dashboard')
      return r.success && r.data ? r.data : MOCK
    },
    staleTime: 60_000,
  })

  const d = data ?? MOCK
  const avgCompletion = Math.round(
    d.languages.reduce((s, l) => s + l.completion, 0) / d.languages.length,
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Globe className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">国际化数据看板</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          5 种语言翻译进度总览 · 平均完成度 {avgCompletion}%
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">语言数量</CardTitle>
            <Globe className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{d.languages.length}</div>
            <p className="text-xs text-muted-foreground">支持的语言种类</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              缺失 Key 总数
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{d.totalMissing}</div>
            <p className="text-xs text-muted-foreground">待翻译 Key 总量</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">平均完成度</CardTitle>
            <Clock className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{avgCompletion}%</div>
            <p className="text-xs text-muted-foreground">所有语言平均</p>
          </CardContent>
        </Card>
      </section>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {d.languages.map((lang) => (
            <Card key={lang.locale}>
              <CardContent className="flex items-center gap-4 p-4">
                <RingChart
                  value={lang.completion}
                  color={LOCALE_COLORS[lang.locale] ?? '#3b82f6'}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{lang.name}</span>
                    <span className="text-xs text-muted-foreground">{lang.locale}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>已翻译 {lang.translated}</span>
                    <span>缺失 {lang.missing}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${lang.completion}%`,
                        background: LOCALE_COLORS[lang.locale] ?? '#3b82f6',
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">最近更新</h2>
          <Link
            href="/admin/i18n-dashboard/missing"
            className="inline-flex items-center gap-1 text-sm text-primary transition-colors hover:opacity-80"
          >
            查看缺失列表
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <Card>
          <CardContent className="divide-y p-0">
            {d.recentUpdates.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30"
              >
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium"
                  style={{
                    background: `${LOCALE_COLORS[u.locale] ?? '#3b82f6'}20`,
                    color: LOCALE_COLORS[u.locale] ?? '#3b82f6',
                  }}
                >
                  {u.locale}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-sm">{u.key}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{u.namespace}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {fmtTime(u.updatedAt)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
