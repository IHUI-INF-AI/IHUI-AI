'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Landmark,
  Loader2,
  ScrollText,
  Search,
  Users,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { Empty } from '@/components/common'
import { BackButton } from '@/components/common'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 10

interface PolicyItem {
  id: string
  policyName: string
  issuingAuthority: string
  issueDate?: string | null
  effectiveDate?: string | null
  policyLevel?: string | null
  targetGroup?: string | null
  summary?: string | null
  keyPoints?: string | null
  implementation?: string | null
  goals?: string | null
  sourceUrl?: string | null
  status?: string | null
}

interface PolicyListData {
  list: PolicyItem[]
  total: number
  page: number
  pageSize: number
}

interface PolicyDetailData {
  policy: PolicyItem
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

const LEVEL_VALUES = ['national', 'ministerial', 'local'] as const
type LevelValue = (typeof LEVEL_VALUES)[number]

const levelClassMap: Record<LevelValue, string> = {
  national: 'bg-primary/10 text-primary',
  ministerial: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  local: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
}

export default function EduAiPolicyPage() {
  const locale = useLocale()
  const t = useTranslations('eduAi.policy')

  const [keyword, setKeyword] = React.useState('')
  const [debouncedKeyword, setDebouncedKeyword] = React.useState('')
  const [level, setLevel] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  // 关键词 300ms 防抖
  React.useEffect(() => {
    const tm = setTimeout(() => setDebouncedKeyword(keyword), 300)
    return () => clearTimeout(tm)
  }, [keyword])

  // 关键词或级别变化时回到第一页
  React.useEffect(() => {
    setPage(1)
  }, [debouncedKeyword, level])

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['edu-ai', 'policy', page, debouncedKeyword, level],
    queryFn: () => {
      const qs = new URLSearchParams()
      qs.set('page', String(page))
      qs.set('pageSize', String(PAGE_SIZE))
      qs.set('status', 'active')
      if (debouncedKeyword) qs.set('keyword', debouncedKeyword)
      if (level !== 'all') qs.set('policyLevel', level)
      return api<PolicyListData>(`/api/ai-education/policy?${qs.toString()}`)
    },
  })

  const {
    data: detail,
    isLoading: detailLoading,
    isError: detailError,
    error: detailErrorObj,
  } = useQuery({
    queryKey: ['edu-ai', 'policy', 'detail', selectedId],
    queryFn: () =>
      api<PolicyDetailData>(`/api/ai-education/policy/${selectedId}`).then((d) => d.policy),
    enabled: !!selectedId,
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const fmtDate = (v?: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? v : dateFmt.format(d)
  }

  const levelLabel = (lv?: string | null) => {
    if (lv === 'national') return t('national')
    if (lv === 'ministerial') return t('ministerial')
    if (lv === 'local') return t('local')
    return lv || '-'
  }

  const levelClass = (lv?: string | null) => {
    if (lv === 'national' || lv === 'ministerial' || lv === 'local') return levelClassMap[lv]
    return 'bg-muted text-muted-foreground'
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const metaItems = (item: PolicyItem) => [
    { label: t('issuingAuthority'), value: item.issuingAuthority, icon: Building2 },
    { label: t('policyLevel'), value: levelLabel(item.policyLevel), icon: Landmark },
    { label: t('issueDate'), value: fmtDate(item.issueDate), icon: CalendarDays },
    { label: t('effectiveDate'), value: fmtDate(item.effectiveDate), icon: CalendarDays },
    { label: t('targetGroup'), value: item.targetGroup || '-', icon: Users },
  ]

  const contentSections = detail
    ? (
        [
          { label: t('summary'), value: detail.summary },
          { label: t('keyPoints'), value: detail.keyPoints },
          { label: t('implementation'), value: detail.implementation },
          { label: t('goals'), value: detail.goals },
        ] as const
      ).filter((s) => !!s.value)
    : []

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/edu-ai" />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Landmark className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('search')}
            className="h-9 pl-8"
          />
        </div>
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className={cn(selectClass, 'w-36')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allLevels')}</SelectItem>
            {LEVEL_VALUES.map((lv) => (
              <SelectItem key={lv} value={lv}>
                {levelLabel(lv)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : isError ? (
        <Alert variant="danger" description={(error as Error).message} />
      ) : list.length === 0 ? (
        <Empty icon={ScrollText} title={t('empty')} />
      ) : (
        <div className="space-y-3">
          {list.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer transition-colors hover:bg-accent"
              onClick={() => setSelectedId(item.id)}
            >
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex items-start gap-2 font-medium">
                    <ScrollText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {item.policyName}
                  </p>
                  <span
                    className={cn(
                      'shrink-0 rounded-md px-2 py-0.5 text-xs font-medium',
                      levelClass(item.policyLevel),
                    )}
                  >
                    {levelLabel(item.policyLevel)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {item.issuingAuthority}
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {fmtDate(item.issueDate)}
                  </span>
                </div>
                {item.summary && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{item.summary}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && !isError && list.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <span className="shrink-0 whitespace-nowrap tabular-nums text-sm text-muted-foreground">
            {t('page', { page, total: totalPages })}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4 shrink-0" />
              {t('prev')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              {t('next')}
              <ChevronRight className="h-4 w-4 shrink-0" />
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={!!selectedId}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.policyName ?? t('viewDetail')}</DialogTitle>
            <DialogDescription>
              {detail?.issuingAuthority
                ? `${detail.issuingAuthority} · ${fmtDate(detail.issueDate)}`
                : t('viewDetail')}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('loading')}
            </div>
          ) : detailError ? (
            <Alert variant="danger" description={(detailErrorObj as Error).message} />
          ) : detail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {metaItems(detail).map((m) => (
                  <div key={m.label} className="flex items-center gap-2 text-sm">
                    <m.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="shrink-0 text-muted-foreground">{m.label}</span>
                    <span className="min-w-0 truncate">{m.value}</span>
                  </div>
                ))}
              </div>

              {contentSections.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noDetail')}</p>
              ) : (
                contentSections.map((s) => (
                  <section key={s.label} className="space-y-1">
                    <h3 className="text-sm font-semibold">{s.label}</h3>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                      {s.value}
                    </p>
                  </section>
                ))
              )}

              {detail.sourceUrl && (
                <a
                  href={detail.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t('sourceUrl')}
                </a>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
