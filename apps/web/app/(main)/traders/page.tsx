'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Percent,
  TrendingUp,
  UserRound,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatDateOnly } from '@/lib/date-utils'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { BackButton } from '@/components/common'

interface Trader {
  id: string
  userId: string
  commissionRate: number
  performance: Record<string, unknown>
  specialties: string[]
  intro?: string | null
  createdAt: string
}

interface TraderDetail extends Trader {
  status?: string
  updatedAt?: string | null
}

interface TraderListData {
  list: Trader[]
}

interface TraderDetailData {
  trader: TraderDetail
}

interface ApplyForm {
  commissionRate: string
  specialties: string
  intro: string
}

interface ApplyPayload {
  commissionRate?: number
  specialties: string[]
  intro?: string
}

interface RequestError extends Error {
  status?: number
}

const EMPTY_FORM: ApplyForm = { commissionRate: '', specialties: '', intro: '' }

const CHIP_COLORS = [
  'bg-sky-500/10 text-sky-600',
  'bg-violet-500/10 text-violet-600',
  'bg-emerald-500/10 text-emerald-600',
  'bg-amber-500/10 text-amber-600',
  'bg-rose-500/10 text-rose-600',
]

const TEXTAREA_CLASS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) {
    const err = new Error(r.error) as RequestError
    err.status = r.status
    throw err
  }
  return r.data
}

function specialtyChips(specialties: string[] | undefined, className?: string) {
  const items = specialties?.filter(Boolean) ?? []
  if (items.length === 0) return null
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {items.map((s, i) => (
        <span
          key={`${i}-${s}`}
          className={cn(
            'rounded-md px-2 py-0.5 text-xs',
            CHIP_COLORS[i % CHIP_COLORS.length],
          )}
        >
          {s}
        </span>
      ))}
    </div>
  )
}

export default function TradersPage() {
  const t = useTranslations('eduAi.traders')
  const tc = useTranslations('common')
  const locale = useLocale()
  const queryClient = useQueryClient()

  const [form, setForm] = React.useState<ApplyForm>(EMPTY_FORM)
  const [formError, setFormError] = React.useState('')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [detailOpen, setDetailOpen] = React.useState(false)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['traders'],
    queryFn: () => api<TraderListData>('/api/trader'),
  })

  const detailQuery = useQuery({
    queryKey: ['traders', 'detail', selectedId],
    queryFn: () => {
      if (selectedId === null) throw new Error('missing trader id')
      return api<TraderDetailData>(`/api/trader/${selectedId}`)
    },
    enabled: selectedId !== null,
  })

  const applyMutation = useMutation({
    mutationFn: async (values: ApplyForm) => {
      const payload: ApplyPayload = {
        specialties: values.specialties
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }
      const rate = values.commissionRate.trim()
      if (rate !== '') payload.commissionRate = Number(rate)
      const intro = values.intro.trim()
      if (intro !== '') payload.intro = intro
      return api<{ trader: Trader }>('/api/trader/apply', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => {
      setForm(EMPTY_FORM)
      queryClient.invalidateQueries({ queryKey: ['traders'] })
    },
  })

  const traders = data?.list ?? []
  const detail = detailQuery.data?.trader
  const applyError = applyMutation.error as RequestError | null
  const isDuplicate = applyError?.status === 409

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const rate = form.commissionRate.trim()
    if (rate !== '') {
      const n = Number(rate)
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        setFormError(t('required'))
        return
      }
    }
    if (form.intro.trim().length > 500) {
      setFormError(t('required'))
      return
    }
    setFormError('')
    applyMutation.mutate(form)
  }

  const openDetail = (id: string) => {
    setSelectedId(id)
    setDetailOpen(true)
  }

  return (
    <div className="space-y-4">
      <BackButton />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <TrendingUp className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Briefcase className="h-4 w-4 text-primary" />
            {t('apply')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="commissionRate">{t('commissionRate')}</Label>
              <div className="relative">
                <Percent className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="commissionRate"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={form.commissionRate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setForm({ ...form, commissionRate: e.target.value })
                  }
                  className="h-9 pl-8"
                  placeholder="0 - 100"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialties">{t('specialties')}</Label>
              <Input
                id="specialties"
                value={form.specialties}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm({ ...form, specialties: e.target.value })
                }
                className="h-9"
                placeholder={t('specialtiesHint')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="intro">{t('intro')}</Label>
              <textarea
                id="intro"
                value={form.intro}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setForm({ ...form, intro: e.target.value })
                }
                className={TEXTAREA_CLASS}
                rows={4}
                maxLength={500}
                placeholder={t('intro')}
              />
            </div>

            {applyMutation.isSuccess && (
              <Alert variant="success" title={t('applySuccess')} />
            )}

            {applyMutation.isError && (
              isDuplicate ? (
                <Alert variant="warning" title={t('applyDuplicate')} />
              ) : (
                <Alert
                  variant="danger"
                  title={t('error')}
                  description={applyError?.message ?? ''}
                />
              )
            )}

            {formError && <Alert variant="warning" title={formError} />}

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={applyMutation.isPending}>
                {applyMutation.isPending && (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                )}
                {applyMutation.isPending ? t('submitting') : t('submit')}
              </Button>
              {applyMutation.isSuccess && (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <UserRound className="h-5 w-5 text-primary" />
          {t('traders')}
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {tc('loading')}
          </div>
        ) : isError ? (
          <Alert variant="danger" description={(error as Error).message} />
        ) : traders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10">
            <UserRound className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('noTraders')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
            {traders.map((trader) => (
              <Card
                key={trader.id}
                className="flex cursor-pointer flex-col transition-colors hover:bg-accent"
                onClick={() => openDetail(trader.id)}
              >
                <CardContent className="flex min-w-0 flex-1 flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      <Percent className="h-3.5 w-3.5" />
                      {t('commission')}: {trader.commissionRate}%
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDateOnly(trader.createdAt, locale)}
                    </span>
                  </div>

                  {specialtyChips(trader.specialties)}

                  {trader.intro && (
                    <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">
                      {trader.intro}
                    </p>
                  )}

                  <div className="mt-auto flex items-center justify-end pt-1">
                    <span className="flex shrink-0 items-center gap-1 text-xs text-primary">
                      {t('viewDetail')}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 pr-8">
              <UserRound className="h-4 w-4 text-primary" />
              {t('viewDetail')}
            </DialogTitle>
            <DialogDescription>
              {detail ? (
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    <Percent className="h-3.5 w-3.5" />
                    {t('commission')}: {detail.commissionRate}%
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {t('joinedAt')}: {formatDateOnly(detail.createdAt, locale)}
                  </span>
                </span>
              ) : (
                tc('loading')
              )}
            </DialogDescription>
          </DialogHeader>

          {detailQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {tc('loading')}
            </div>
          ) : detailQuery.isError ? (
            <Alert variant="danger" description={(detailQuery.error as Error).message} />
          ) : detail ? (
            <div className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <h3 className="flex items-center gap-1.5 font-medium">
                  <Briefcase className="h-4 w-4 text-primary/70" />
                  {t('specialties')}
                </h3>
                {specialtyChips(detail.specialties) ?? (
                  <p className="text-xs text-muted-foreground">{t('empty')}</p>
                )}
              </div>

              {detail.intro && (
                <div className="space-y-1.5">
                  <h3 className="font-medium">{t('intro')}</h3>
                  <p className="whitespace-pre-wrap text-muted-foreground">{detail.intro}</p>
                </div>
              )}

              {Object.keys(detail.performance ?? {}).length > 0 && (
                <div className="space-y-1.5">
                  <h3 className="flex items-center gap-1.5 font-medium">
                    <TrendingUp className="h-4 w-4 text-primary/70" />
                    {t('performance')}
                  </h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {Object.entries(detail.performance ?? {}).map(([k, v]) => (
                      <span key={k} className="text-xs text-muted-foreground">
                        {k}: {String(v)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
