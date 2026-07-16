'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, ArrowLeft, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, CardContent, CardHeader, CardTitle, Label } from '@ihui/ui'
import {
  Badge,
  DescriptionList,
  type DescriptionItem,
  Timeline,
  type TimelineItem,
} from '@/components/data'
import { api, textareaClass } from '../helpers'
import type { ListData } from '../types'

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  draft: 'default',
  approved: 'success',
  published: 'success',
  pending: 'warning',
  rejected: 'danger',
}

export default function DemandAuditDetailPage() {
  const t = useTranslations('admin.demandAudit')
  const tc = useTranslations('common')
  const locale = useLocale()
  const params = useParams<{ id: string }>()
  const qc = useQueryClient()

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  // 列表页 API 无单条详情端点，按任务要求使用「列表 API + filter」方式获取
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'demand-audit', 'detail', params.id],
    queryFn: () =>
      api<ListData>(`/api/admin/examine?${new URLSearchParams({ page: '1', pageSize: '100' })}`),
    enabled: !!params.id,
  })
  const row = data?.list?.find((r) => r.id === params.id) ?? null

  const [remark, setRemark] = React.useState('')
  const auditMut = useMutation({
    mutationFn: (action: 'pass' | 'reject') =>
      api(action === 'pass' ? '/api/admin/examine/pass' : '/api/admin/examine/reject', {
        method: 'POST',
        body: JSON.stringify({ id: row?.id, remark }),
      }),
    onSuccess: () => {
      toast.success(t('operateSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'demand-audit'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function fmtDate(v?: string) {
    if (!v) return '-'
    const d = new Date(v)
    return isNaN(d.getTime()) ? v : dateFmt.format(d)
  }

  const status = (row?.status ?? '') as string
  const statusLabel =
    status === 'approved'
      ? t('statusApproved')
      : status === 'rejected'
        ? t('statusRejected')
        : status === 'pending'
          ? t('statusPending')
          : status || '-'
  const statusVariant = STATUS_VARIANT[status] ?? 'default'
  const canAct = !!row && status === 'pending'
  const rowStr = row as Record<string, string> | null
  const existOpinion = (rowStr && (rowStr.remark || rowStr.follow || rowStr.reason)) || ''

  const descItems: DescriptionItem[] = [
    { label: t('colAgentName'), value: row?.agentName || '-' },
    { label: t('colStartName'), value: row?.startName || '-' },
    { label: t('colExamineTime'), value: fmtDate(row?.examineTime) },
    { label: tc('status'), value: <Badge variant={statusVariant}>{statusLabel}</Badge> },
  ]

  const timelineItems: TimelineItem[] = [
    {
      title: tc('submit'),
      time: fmtDate(row?.startTime),
      description: row?.startName ? `${t('colStartName')}: ${row.startName}` : undefined,
      color: 'var(--muted-foreground)',
    },
  ]
  if (status !== 'pending' || row?.examineTime) {
    timelineItems.push({
      title: statusLabel,
      time: fmtDate(row?.examineTime),
      description: existOpinion || undefined,
      color:
        status === 'approved' ? '#10b981' : status === 'rejected' ? '#ef4444' : 'var(--primary)',
    })
  }

  return (
    <div className="space-y-4">
      <Link
        href="/admin/demand-audit"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {tc('back')}
      </Link>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {tc('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-10 text-center text-destructive">
          {(error as Error).message}
        </div>
      ) : !row ? (
        <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground">
          {tc('noData')}
        </div>
      ) : (
        <>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{row.agentName || '-'}</CardTitle>
              <Badge variant={statusVariant}>{statusLabel}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <DescriptionList items={descItems} column={2} />
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{t('colDesc')}</span>
                <span className="whitespace-pre-wrap text-sm">{row.desc || '-'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{t('approvalTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Timeline items={timelineItems} />

              {canAct ? (
                <div className="space-y-2 border-t pt-4">
                  <Label className="text-xs">{t('opinionLabel')}</Label>
                  <textarea
                    className={textareaClass}
                    rows={3}
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder={t('opinionPlaceholder')}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      disabled={auditMut.isPending}
                      onClick={() => auditMut.mutate('pass')}
                    >
                      <Check className="h-4 w-4" />
                      {t('approve')}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      disabled={auditMut.isPending}
                      onClick={() => auditMut.mutate('reject')}
                    >
                      <X className="h-4 w-4" />
                      {t('reject')}
                    </Button>
                  </div>
                </div>
              ) : existOpinion ? (
                <div className="flex flex-col gap-1 border-t pt-3">
                  <span className="text-xs text-muted-foreground">{t('opinionLabel')}</span>
                  <span className="whitespace-pre-wrap text-sm">{existOpinion}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
