'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { FileJson, FileText, Download, RefreshCw, Loader2 } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, Button } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { Container } from '@/components/layout'
import { fetchApi } from '@/lib/api'

interface ExportTask {
  taskId: string | null
  status: string | null
  url: string | null
  exportedAt: string | null
}

interface ExportResult {
  url: string
  filename: string
  expiresAt: string
  taskId: string
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default function DataExportPage() {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const [lastExport, setLastExport] = React.useState<ExportTask>({
    taskId: null,
    status: null,
    url: null,
    exportedAt: null,
  })
  const [expiresAt, setExpiresAt] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [creating, setCreating] = React.useState(false)
  const [error, setError] = React.useState('')
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchApi<ExportTask>('/settings/export')
      .then((res) => {
        if (cancelled) return
        if (res.success) {
          setLastExport(res.data)
        } else {
          setError(res.error)
        }
      })
      .catch(() => {
        if (!cancelled) setError(t('exportFailed'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [t])

  React.useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const handleExport = async () => {
    if (creating) return
    setCreating(true)
    try {
      const res = await fetchApi<ExportResult>('/settings/export', { method: 'POST' })
      if (res.success) {
        setLastExport({
          taskId: res.data.taskId,
          status: 'completed',
          url: res.data.url,
          exportedAt: new Date().toISOString(),
        })
        setExpiresAt(res.data.expiresAt)
        setToast({ type: 'success', msg: t('exportSuccess') })
      } else {
        setToast({ type: 'error', msg: t('exportFailed') })
      }
    } catch {
      setToast({ type: 'error', msg: t('exportFailed') })
    } finally {
      setCreating(false)
    }
  }

  const handleDownload = (url: string) => {
    window.open(url, '_blank')
  }

  const hasExport = Boolean(lastExport.url)

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('dataExportTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('dataExportDesc')}</p>
      </div>

      <Alert variant="info" title={t('exportScope')} description={t('exportScopeDesc')} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileJson className="h-4 w-4" />
            {t('exportJson')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('exportJsonDesc')}</span>
            <Button size="sm" onClick={handleExport} disabled={creating}>
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileJson className="h-4 w-4" />
              )}
              {creating ? t('exportCreating') : t('download')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            {t('exportCsv')}
            <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {tc('comingSoon')}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('exportCsvDesc')}</span>
            <Button size="sm" disabled>
              <Download className="h-4 w-4" />
              {t('download')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{t('activityLoading')}</p>
      ) : error ? (
        <p className="py-4 text-center text-sm text-destructive">{error}</p>
      ) : hasExport ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-4 w-4" />
              {t('exportLastExport')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('exportLastExport')}</span>
                <span>{formatTime(lastExport.exportedAt)}</span>
              </div>
              {expiresAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('exportExpiresAt')}</span>
                  <span>{formatTime(expiresAt)}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => lastExport.url && handleDownload(lastExport.url)}
              >
                <Download className="h-4 w-4" />
                {t('download')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={creating}>
                <RefreshCw className="h-4 w-4" />
                {t('exportRecreate')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">{t('exportNoHistory')}</p>
      )}

      {toast && (
        <div
          className={
            toast.type === 'success'
              ? 'fixed bottom-4 right-4 z-50 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 shadow-md dark:text-emerald-400'
              : 'fixed bottom-4 right-4 z-50 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 shadow-md dark:text-red-400'
          }
        >
          {toast.msg}
        </div>
      )}
    </Container>
  )
}
