'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { KeyRound, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react'

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui'
import { Container } from '@/components/layout'
import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

interface SessionInfo {
  id: string
  createdAt: string | null
  expiresAt: string | null
  familyId: string | null
}

const PAGE_SIZE = 20

export default function AuthorizationsPage() {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const [sessions, setSessions] = React.useState<SessionInfo[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [confirmId, setConfirmId] = React.useState<string | null>(null)
  const [revoking, setRevoking] = React.useState(false)
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  React.useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchApi<PageData<SessionInfo>>(
      '/settings/authorizations' + buildQs({ page, pageSize: PAGE_SIZE }),
    )
      .then((res) => {
        if (cancelled) return
        if (res.success) {
          setSessions(res.data.list ?? [])
          setTotal(res.data.total ?? 0)
        } else {
          setError(res.error)
          setSessions([])
          setTotal(0)
        }
      })
      .catch(() => {
        if (cancelled) return
        setError(t('activityLoadFailed'))
        setSessions([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page, t])

  // 当前会话:未过期会话中 createdAt 最新的一条(无后端 isCurrent 标记时的启发式)
  const currentSessionId = React.useMemo(() => {
    const now = Date.now()
    const active = sessions.filter((s) => !s.expiresAt || new Date(s.expiresAt).getTime() > now)
    if (active.length === 0) return null
    return active.reduce((latest, s) => {
      const a = s.createdAt ? new Date(s.createdAt).getTime() : 0
      const b = latest.createdAt ? new Date(latest.createdAt).getTime() : 0
      return a > b ? s : latest
    }).id
  }, [sessions])

  const formatTime = (iso: string | null): string => {
    if (!iso) return '-'
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? '-' : dateFormatter.format(d)
  }

  const handleConfirmRevoke = async () => {
    if (!confirmId || revoking) return
    const targetId = confirmId
    setRevoking(true)
    try {
      const res = await fetchApi<{ revoked: boolean }>(
        `/settings/authorizations/${targetId}`,
        { method: 'DELETE' },
      )
      if (res.success) {
        setSessions((prev) => prev.filter((s) => s.id !== targetId))
        setTotal((prev) => Math.max(0, prev - 1))
        setToast({ type: 'success', msg: t('sessionRevokeSuccess') })
      } else {
        setToast({ type: 'error', msg: t('sessionRevokeFailed') })
      }
    } catch {
      setToast({ type: 'error', msg: t('sessionRevokeFailed') })
    } finally {
      setRevoking(false)
      setConfirmId(null)
    }
  }

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('authorizationsTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('authorizationsDesc')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" />
            {t('authorizationsTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('activityLoading')}</p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-destructive">{error}</p>
          ) : sessions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('noAuthorizations')}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('authorizedAt')}</TableHead>
                    <TableHead>{t('sessionExpiresAt')}</TableHead>
                    <TableHead>{t('logStatus')}</TableHead>
                    <TableHead className="text-right">{t('revokeAuth')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((s) => {
                    const isCurrent = s.id === currentSessionId
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="whitespace-nowrap text-xs">{formatTime(s.createdAt)}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{formatTime(s.expiresAt)}</TableCell>
                        <TableCell>
                          {isCurrent ? (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              <ShieldCheck className="h-3 w-3" />
                              {t('sessionCurrent')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-xs text-muted-foreground"><span className="inline-block h-2 w-2 rounded-full bg-green-500" /></span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => setConfirmId(s.id)}>
                            {t('revokeAuth')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {!loading && !error && sessions.length > 0 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {t('activityPageInfo', { page, totalPages })}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-4 w-4" />
                  {t('activityPrev')}
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  {t('activityNext')}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmId !== null} onOpenChange={(o) => { if (!o && !revoking) setConfirmId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('revokeAuth')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('sessionRevokeConfirm')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmId(null)} disabled={revoking}>
              {tc('cancel')}
            </Button>
            <Button onClick={handleConfirmRevoke} disabled={revoking}>
              {tc('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast && (
        <div className={`fixed right-4 top-4 z-modal rounded-md px-4 py-2 text-sm text-white shadow-lg ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}
    </Container>
  )
}
