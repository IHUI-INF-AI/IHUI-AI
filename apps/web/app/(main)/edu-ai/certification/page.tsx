'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
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

interface CertificationItem {
  id: string
  certName: string
  issuingAuthority: string
  targetTeachers?: string | null
  level?: string | null
  trainingHours?: number | null
  trainingContent?: string | null
  assessmentMethod?: string | null
  certificationRequirements?: string | null
  validity?: string | null
  benefits?: string | null
  status?: string | null
}

interface CertListData {
  list: CertificationItem[]
  total: number
  page: number
  pageSize: number
}

interface CertDetailData {
  certification: CertificationItem
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

const LEVEL_VALUES = ['primary', 'intermediate', 'advanced'] as const
type LevelValue = (typeof LEVEL_VALUES)[number]

const levelClassMap: Record<LevelValue, string> = {
  primary: 'bg-blue-500/10 text-blue-600 dark:text-blue-500',
  intermediate: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  advanced: 'bg-purple-500/10 text-purple-600 dark:text-purple-500',
}

export default function EduAiCertificationPage() {
  const t = useTranslations('eduAi.cert')

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
    queryKey: ['edu-ai', 'certification', page, debouncedKeyword, level],
    queryFn: () => {
      const qs = new URLSearchParams()
      qs.set('page', String(page))
      qs.set('pageSize', String(PAGE_SIZE))
      qs.set('status', 'active')
      if (debouncedKeyword) qs.set('keyword', debouncedKeyword)
      if (level !== 'all') qs.set('level', level)
      return api<CertListData>(`/api/ai-education/teacher-certification?${qs.toString()}`)
    },
  })

  const {
    data: detail,
    isLoading: detailLoading,
    isError: detailError,
    error: detailErrorObj,
  } = useQuery({
    queryKey: ['edu-ai', 'certification', 'detail', selectedId],
    queryFn: () =>
      api<CertDetailData>(`/api/ai-education/teacher-certification/${selectedId}`).then(
        (d) => d.certification,
      ),
    enabled: !!selectedId,
  })

  const levelLabel = (lv?: string | null) => {
    if (lv === 'primary') return t('primary')
    if (lv === 'intermediate') return t('intermediate')
    if (lv === 'advanced') return t('advanced')
    return lv || '-'
  }

  const levelClass = (lv?: string | null) => {
    if (lv === 'primary' || lv === 'intermediate' || lv === 'advanced') return levelClassMap[lv]
    return 'bg-muted text-muted-foreground'
  }

  const hoursText = (hours?: number | null) =>
    hours !== null ? `${hours} ${t('hoursSuffix')}` : '-'

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const metaItems = (item: CertificationItem) => [
    { label: t('issuingAuthority'), value: item.issuingAuthority, icon: Building2 },
    { label: t('targetTeachers'), value: item.targetTeachers || '-', icon: Users },
    { label: t('level'), value: levelLabel(item.level), icon: BadgeCheck },
    { label: t('trainingHours'), value: hoursText(item.trainingHours), icon: Clock },
    { label: t('validity'), value: item.validity || '-', icon: CalendarDays },
  ]

  const contentSections = detail
    ? (
        [
          { label: t('trainingContent'), value: detail.trainingContent },
          { label: t('assessmentMethod'), value: detail.assessmentMethod },
          { label: t('certificationRequirements'), value: detail.certificationRequirements },
          { label: t('benefits'), value: detail.benefits },
        ] as const
      ).filter((s) => !!s.value)
    : []

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/edu-ai" />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BadgeCheck className="h-7 w-7 text-primary" />
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
        <Empty icon={BadgeCheck} title={t('empty')} />
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
          {list.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer transition-colors hover:bg-accent"
              onClick={() => setSelectedId(item.id)}
            >
              <CardContent className="flex h-full flex-col space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <BadgeCheck className="h-5 w-5 text-primary" />
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-md px-2 py-0.5 text-xs font-medium',
                      levelClass(item.level),
                    )}
                  >
                    {levelLabel(item.level)}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="line-clamp-1 font-medium">{item.certName}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {item.issuingAuthority}
                  </p>
                </div>
                <div className="mt-auto space-y-1 border-t pt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 truncate">{item.targetTeachers || '-'}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    {hoursText(item.trainingHours)}
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 truncate">{item.validity || '-'}</span>
                  </span>
                </div>
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
            <DialogTitle>{detail?.certName ?? t('viewDetail')}</DialogTitle>
            <DialogDescription>{detail?.issuingAuthority ?? t('viewDetail')}</DialogDescription>
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

              {contentSections.map((s) => (
                <section key={s.label} className="space-y-1">
                  <h3 className="text-sm font-semibold">{s.label}</h3>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {s.value}
                  </p>
                </section>
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
