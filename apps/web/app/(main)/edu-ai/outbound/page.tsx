'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart3,
  Loader2,
  Megaphone,
  Phone,
  PhoneOutgoing,
  Play,
  Plus,
  Square,
} from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { formatDateOnly } from '@/lib/date-utils'
import {
  Badge,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { BackButton } from '@/components/common'

type CampaignStatus = 'created' | 'running' | 'paused' | 'stopped' | 'completed'
interface Campaign {
  id: string
  name: string
  userId: string
  script: string
  phoneList: string[]
  status: CampaignStatus
  totalCalls: number
  answeredCalls: number
  failedCalls: number
  createdAt: number
  updatedAt: number
  startedAt?: number
}
interface CampaignListData {
  list: Campaign[]
  total: number
  page: number
  pageSize: number
}
interface CampaignStats {
  id: string
  name: string
  status: CampaignStatus
  totalCalls: number
  answeredCalls: number
  failedCalls: number
  pendingCalls: number
  answerRate: number
  durationMs: number
}
interface CreateForm {
  name: string
  script: string
  phoneNumbers: string
}

const EMPTY_FORM: CreateForm = { name: '', script: '', phoneNumbers: '' }
const TEXTAREA_CLASS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const STATUS_BADGE: Record<CampaignStatus, string> = {
  created: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  running: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  paused: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  stopped: 'bg-red-500/10 text-red-600 border-red-500/20',
  completed: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function OutboundPage() {
  const t = useTranslations('eduAi.outbound')
  const tc = useTranslations('common')
  const locale = useLocale()
  const queryClient = useQueryClient()
  const [form, setForm] = React.useState<CreateForm>(EMPTY_FORM)
  const [formError, setFormError] = React.useState('')
  const [statsId, setStatsId] = React.useState<string | null>(null)
  const [statsOpen, setStatsOpen] = React.useState(false)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['outbound-campaigns'],
    queryFn: () => api<CampaignListData>('/api/outbound/campaign'),
  })
  const statsQuery = useQuery({
    queryKey: ['outbound-campaigns', 'stats', statsId],
    queryFn: () => {
      if (!statsId) throw new Error('missing id')
      return api<CampaignStats>(`/api/outbound/campaign/${statsId}/stats`)
    },
    enabled: statsId !== null,
  })
  const createMutation = useMutation({
    mutationFn: async (values: CreateForm) => {
      const phoneList = values.phoneNumbers
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
      return api<Campaign>('/api/outbound/campaign', {
        method: 'POST',
        body: JSON.stringify({ name: values.name, script: values.script, phoneList }),
      })
    },
    onSuccess: () => {
      setForm(EMPTY_FORM)
      queryClient.invalidateQueries({ queryKey: ['outbound-campaigns'] })
    },
  })
  const startMutation = useMutation({
    mutationFn: (id: string) =>
      api<Campaign>(`/api/outbound/campaign/${id}/start`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['outbound-campaigns'] }),
  })
  const stopMutation = useMutation({
    mutationFn: (id: string) =>
      api<Campaign>(`/api/outbound/campaign/${id}/stop`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['outbound-campaigns'] }),
  })
  const campaigns = data?.list ?? []
  const stats = statsQuery.data
  const parsePhones = (s: string) =>
    s
      .split(/[,\n]/)
      .map((p) => p.trim())
      .filter(Boolean)
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.name.trim() || !form.script.trim() || parsePhones(form.phoneNumbers).length === 0) {
      setFormError(t('error'))
      return
    }
    setFormError('')
    createMutation.mutate(form)
  }
  const openStats = (id: string) => {
    setStatsId(id)
    setStatsOpen(true)
  }
  const statItems = stats
    ? [
        { label: t('totalCalls'), value: String(stats.totalCalls) },
        { label: t('answered'), value: String(stats.answeredCalls) },
        { label: t('failed'), value: String(stats.failedCalls) },
        { label: t('answerRate'), value: `${(stats.answerRate * 100).toFixed(1)}%` },
        { label: t('avgDuration'), value: `${(stats.durationMs / 1000).toFixed(1)}s` },
      ]
    : []
  return (
    <div className="space-y-4">
      <BackButton />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Megaphone className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-primary" />
            {t('createCampaign')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('campaignName')}</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-9"
                placeholder={t('campaignName')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="script">{t('script')}</Label>
              <textarea
                id="script"
                value={form.script}
                onChange={(e) => setForm({ ...form, script: e.target.value })}
                className={TEXTAREA_CLASS}
                rows={3}
                placeholder={t('script')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumbers">{t('phoneNumbers')}</Label>
              <textarea
                id="phoneNumbers"
                value={form.phoneNumbers}
                onChange={(e) => setForm({ ...form, phoneNumbers: e.target.value })}
                className={TEXTAREA_CLASS}
                rows={3}
                placeholder={t('phoneNumbersHint')}
              />
              <p className="text-xs text-muted-foreground">{t('phoneNumbersHint')}</p>
            </div>
            {createMutation.isError && (
              <Alert
                variant="danger"
                title={t('error')}
                description={(createMutation.error as Error).message}
              />
            )}
            {formError && <Alert variant="warning" title={formError} />}
            {createMutation.isSuccess && <Alert variant="success" title={t('create')} />}
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {createMutation.isPending ? t('loading') : t('create')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <PhoneOutgoing className="h-5 w-5 text-primary" />
          {t('title')}
        </h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {tc('loading')}
          </div>
        ) : isError ? (
          <Alert variant="danger" description={(error as Error).message} />
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10">
            <PhoneOutgoing className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('noCampaigns')}</p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('campaignName')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead className="text-center">{t('phoneNumbers')}</TableHead>
                  <TableHead>{t('created')}</TableHead>
                  <TableHead className="text-right">{t('viewStats')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_BADGE[c.status]}>
                        {t(c.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <Phone className="h-3.5 w-3.5" />
                        {c.phoneList.length}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateOnly(c.createdAt, locale)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(c.status === 'created' || c.status === 'paused') && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={startMutation.isPending}
                            onClick={() => startMutation.mutate(c.id)}
                          >
                            <Play className="mr-1 h-3.5 w-3.5" />
                            {t('start')}
                          </Button>
                        )}
                        {c.status === 'running' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={stopMutation.isPending}
                            onClick={() => stopMutation.mutate(c.id)}
                          >
                            <Square className="mr-1 h-3.5 w-3.5" />
                            {t('stop')}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openStats(c.id)}>
                          <BarChart3 className="mr-1 h-3.5 w-3.5" />
                          {t('viewStats')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Dialog open={statsOpen} onOpenChange={setStatsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              {t('stats')}
            </DialogTitle>
            <DialogDescription>{stats?.name ?? ''}</DialogDescription>
          </DialogHeader>
          {statsQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {tc('loading')}
            </div>
          ) : statsQuery.isError ? (
            <Alert variant="danger" description={(statsQuery.error as Error).message} />
          ) : stats ? (
            <div className="grid grid-cols-2 gap-3">
              {statItems.map((s) => (
                <div key={s.label} className="flex flex-col gap-1 rounded-lg border p-3">
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                  <span className="text-lg font-semibold">{s.value}</span>
                </div>
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
