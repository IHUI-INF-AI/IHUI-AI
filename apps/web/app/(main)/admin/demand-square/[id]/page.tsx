'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Check, X } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Label,
} from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import { cn } from '@/lib/utils'
import { api, STATUS_CLASS } from '../helpers'
import type { Examine } from '../types'

interface ExamineDetail extends Examine {
  reviewerId?: string | null
  reviewedAt?: string | null
}

function DetailRow({
  label,
  value,
  mono,
  muted,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn('text-sm', mono && 'font-mono text-xs', muted && 'text-muted-foreground')}
      >
        {value}
      </span>
    </div>
  )
}

export default function DemandSquareDetailPage() {
  const t = useTranslations('admin.demandSquare')
  const tc = useTranslations('common')
  const tr = useTranslations('admin.refund')
  const locale = useLocale()
  const params = useParams<{ id: string }>()

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'demandSquare', 'detail', params.id],
    queryFn: () => api<ExamineDetail>(`/api/examine/${params.id}`),
    enabled: !!params.id,
  })

  const qc = useQueryClient()
  const [rejectOpen, setRejectOpen] = React.useState(false)
  const [reason, setReason] = React.useState('')
  const [err, setErr] = React.useState<string | null>(null)

  const approveMut = useMutation({
    mutationFn: () => api<Examine>(`/api/examine/${params.id}/approve`, { method: 'PUT' }),
    onSuccess: () => {
      toast.success(t('approveSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'demandSquare'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rejectMut = useMutation({
    mutationFn: () =>
      api<Examine>(`/api/examine/${params.id}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ reason: reason.trim() }),
      }),
    onSuccess: () => {
      toast.success(t('rejectSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'demandSquare'] })
      closeReject()
    },
    onError: (e: Error) => setErr(e.message),
  })

  function openReject() {
    setRejectOpen(true)
    setReason('')
    setErr(null)
  }
  function closeReject() {
    if (rejectMut.isPending) return
    setRejectOpen(false)
    setReason('')
    setErr(null)
  }
  function submitReject(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!reason.trim()) {
      setErr(t('reasonRequired'))
      return
    }
    rejectMut.mutate()
  }

  const rec = data
  const isPending = rec?.status === 'pending'
  const busy = approveMut.isPending || rejectMut.isPending

  return (
    <div className="space-y-4">
      <Link
        href="/admin/demand-square"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {tc('back')}
      </Link>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-10 text-center text-destructive">
          {(error as Error).message}
        </div>
      ) : !rec ? (
        <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground">
          {t('empty')}
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              {t('title')}
              <span
                className={cn(
                  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                  STATUS_CLASS[rec.status] ?? STATUS_CLASS.pending,
                )}
              >
                {t(`status${rec.status.charAt(0).toUpperCase()}${rec.status.slice(1)}`)}
              </span>
            </CardTitle>
            <CardDescription className="font-mono text-xs">#{rec.id}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 text-sm">
            <DetailRow
              label={t('colAgent')}
              value={rec.agentId ? rec.agentId.slice(0, 8) : '-'}
              mono
            />
            <DetailRow
              label={t('colUser')}
              value={rec.userId ? rec.userId.slice(0, 8) : '-'}
              mono
              muted
            />
            <DetailRow label={t('colCreatedAt')} value={dateFmt.format(new Date(rec.createdAt))} />
            {!isPending && rec.reviewedAt && (
              <DetailRow
                label={tr('processTime')}
                value={dateFmt.format(new Date(rec.reviewedAt))}
              />
            )}
            {!isPending && rec.reviewerId && (
              <DetailRow label={tr('auditor')} value={rec.reviewerId.slice(0, 8)} mono muted />
            )}
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">{t('colReason')}</div>
              <div className="break-words rounded-md border bg-muted/30 px-3 py-2 text-sm">
                {rec.reason || '-'}
              </div>
            </div>
          </CardContent>

          {isPending && (
            <CardFooter className="justify-end gap-2 border-t pt-3">
              <HasPermi code="demandsquare:approve">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => approveMut.mutate()}
                  disabled={busy}
                >
                  <Check className="h-4 w-4 text-emerald-600" />
                  {t('approve')}
                </Button>
              </HasPermi>
              <HasPermi code="demandsquare:reject">
                <Button size="sm" variant="outline" onClick={openReject} disabled={busy}>
                  <X className="h-4 w-4 text-destructive" />
                  {t('reject')}
                </Button>
              </HasPermi>
            </CardFooter>
          )}
        </Card>
      )}

      <Dialog open={rejectOpen} onOpenChange={(v) => !v && closeReject()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('rejectTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitReject} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dsd-reason">
                {t('reason')} <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="dsd-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeReject}
                disabled={rejectMut.isPending}
              >
                {tc('cancel')}
              </Button>
              <Button type="submit" variant="destructive" disabled={rejectMut.isPending}>
                {rejectMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('reject')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
