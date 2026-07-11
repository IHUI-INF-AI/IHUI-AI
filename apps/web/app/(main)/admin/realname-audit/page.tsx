'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import {
  Loader2,
  ShieldCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Card,
  CardContent,
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@ihui/ui'
import { cn } from '@/lib/utils'

type AuditStatus = 'pending' | 'approved' | 'rejected' | 'unverified'

interface RealnameItem {
  userUuid: string
  realName: string
  idCard: string
  status: AuditStatus
  auditTime?: string | null
  createdAt?: string | null
  rejectReason?: string | null
}

interface ListData {
  list: RealnameItem[]
  total: number
  page: number
  pageSize: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const PAGE_SIZE = 20

function maskIdCard(idCard: string): string {
  if (!idCard || idCard.length < 8) return idCard ?? '-'
  return idCard.slice(0, 4) + '****' + idCard.slice(-4)
}

function formatDate(v?: string | null): string {
  if (!v) return '-'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString()
}

export default function AdminRealnameAuditPage() {
  const t = useTranslations('admin.realnameAudit')
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)

  const STATUS_BADGE: Record<AuditStatus, { label: string; cls: string }> = {
    pending: {
      label: t('statusPending'),
      cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
    },
    approved: {
      label: t('statusApproved'),
      cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
    },
    rejected: {
      label: t('statusRejected'),
      cls: 'bg-red-500/10 text-red-600 dark:text-red-500',
    },
    unverified: {
      label: t('statusUnverified'),
      cls: 'bg-muted text-muted-foreground',
    },
  }

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'realname', 'list', debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (debounced) qs.set('keyword', debounced)
      return api<ListData>(`/api/auth/realname/list?${qs.toString()}`)
    },
  })

  const auditMut = useMutation({
    mutationFn: (p: { userUuid: string; action: 'approve' | 'reject'; rejectReason?: string }) =>
      api(`/api/auth/realname/${p.userUuid}/audit`, {
        method: 'PUT',
        body: JSON.stringify({
          action: p.action,
          rejectReason: p.rejectReason,
        }),
      }),
    onSuccess: (_data, vars) => {
      toast.success(vars.action === 'approve' ? t('approveSuccess') : t('rejectSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'realname', 'list'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleReject = (userUuid: string) => {
    const reason = window.prompt(t('rejectPrompt'))
    if (reason === null) return
    auditMut.mutate({
      userUuid,
      action: 'reject',
      rejectReason: reason || undefined,
    })
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-9 pl-8"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="px-4 py-2.5">{t('userId')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('realName')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('idCard')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('status')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('auditTime')}</TableHead>
                  <TableHead className="px-4 py-2.5 text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      {t('loading')}
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-4 py-10 text-center text-destructive">
                      {(error as Error).message}
                    </TableCell>
                  </TableRow>
                ) : list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      <ShieldCheck className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      {t('noData')}
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((item) => {
                    const badge = STATUS_BADGE[item.status]
                    return (
                      <TableRow key={item.userUuid} className="transition-colors hover:bg-muted/30">
                        <TableCell className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {item.userUuid}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 font-medium">
                          {item.realName || '-'}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 font-mono text-xs">
                          {maskIdCard(item.idCard)}
                        </TableCell>
                        <TableCell className="px-4 py-2.5">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                              badge.cls,
                            )}
                          >
                            {badge.label}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                          {formatDate(item.auditTime ?? item.createdAt)}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-right">
                          {item.status === 'pending' ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={auditMut.isPending}
                                onClick={() =>
                                  auditMut.mutate({
                                    userUuid: item.userUuid,
                                    action: 'approve',
                                  })
                                }
                                className="text-emerald-600 hover:text-emerald-600"
                              >
                                <UserCheck className="h-4 w-4" />
                                {t('approve')}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={auditMut.isPending}
                                onClick={() => handleReject(item.userUuid)}
                                className="text-destructive hover:text-destructive"
                              >
                                <UserX className="h-4 w-4" />
                                {t('reject')}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
