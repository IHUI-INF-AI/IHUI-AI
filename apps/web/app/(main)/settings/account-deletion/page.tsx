'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Send, Loader2, CheckCircle2 } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, Button, Switch } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { Input } from '@/components/form'
import { Container } from '@/components/layout'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

interface DeletionStatus {
  isScheduled: boolean
  scheduledDate: string | null
  canCancel: boolean
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default function AccountDeletionPage() {
  const t = useTranslations('settings')
  const user = useAuthStore((s) => s.user)
  const [status, setStatus] = React.useState<DeletionStatus | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [phone, setPhone] = React.useState(user?.phone ?? '')
  const [code, setCode] = React.useState('')
  const [confirmed, setConfirmed] = React.useState(false)
  const [countdown, setCountdown] = React.useState(0)
  const [sending, setSending] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const queryStatus = React.useCallback(() => {
    setLoading(true)
    fetchApi<DeletionStatus>('/settings/delete-account/status')
      .then((res) => {
        if (res.success) setStatus(res.data)
      })
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => {
    queryStatus()
  }, [queryStatus])

  React.useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const handleSendCode = async () => {
    if (!phone || countdown > 0) return
    setSending(true)
    try {
      const res = await fetchApi('/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ phone, scene: 'reset' }),
      })
      if (res.success) {
        setToast({ type: 'success', msg: t('accountDeletionCodeSent') })
        setCountdown(60)
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      } else {
        setToast({ type: 'error', msg: t('accountDeletionCodeSendFailed') })
      }
    } catch {
      setToast({ type: 'error', msg: t('accountDeletionCodeSendFailed') })
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = async () => {
    if (!confirmed || !code) return
    setSubmitting(true)
    try {
      const res = await fetchApi('/settings/delete-account', { method: 'POST' })
      if (res.success) {
        setToast({ type: 'success', msg: t('accountDeletionSuccess') })
        setTimeout(() => {
          window.location.href = '/login'
        }, 2000)
      } else {
        setToast({ type: 'error', msg: t('accountDeletionFailed') })
      }
    } catch {
      setToast({ type: 'error', msg: t('accountDeletionFailed') })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async () => {
    setSubmitting(true)
    try {
      const res = await fetchApi('/settings/delete-account/cancel', { method: 'POST' })
      if (res.success) {
        setToast({ type: 'success', msg: t('accountDeletionCancelSuccess') })
        queryStatus()
      } else {
        setToast({ type: 'error', msg: t('accountDeletionFailed') })
      }
    } catch {
      setToast({ type: 'error', msg: t('accountDeletionFailed') })
    } finally {
      setSubmitting(false)
    }
  }

  const toastClass =
    toast?.type === 'success'
      ? 'fixed bottom-4 right-4 z-50 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 shadow-md dark:text-emerald-400'
      : 'fixed bottom-4 right-4 z-50 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 shadow-md dark:text-red-400'

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('accountDeletionTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('accountDeletionDesc')}</p>
      </div>

      <Alert variant="warning" title={t('accountDeletionWarning')} />

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('activityLoading')}</p>
      ) : status?.isScheduled ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4" />
              {t('accountDeletionStatusScheduled')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {status.scheduledDate && (
              <p className="text-sm text-muted-foreground">{formatDate(status.scheduledDate)}</p>
            )}
            {status.canCancel && (
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('accountDeletionCancel')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" />
              {t('accountDeletionConfirm')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label={t('accountDeletionPhoneLabel')}
              placeholder={t('accountDeletionPhonePlaceholder')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <div className="space-y-2">
              <Input
                label={t('accountDeletionCodeLabel')}
                placeholder={t('accountDeletionCodePlaceholder')}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendCode}
                disabled={sending || countdown > 0 || !phone}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {countdown > 0
                  ? t('accountDeletionResend', { seconds: countdown })
                  : t('accountDeletionSendCode')}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('accountDeletionConfirm')}</span>
              <Switch checked={confirmed} onCheckedChange={setConfirmed} />
            </div>

            <Button
              variant="destructive"
              className="w-full"
              onClick={handleSubmit}
              disabled={!confirmed || !code || submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitting ? t('accountDeletionSubmitting') : t('accountDeletionSubmit')}
            </Button>
          </CardContent>
        </Card>
      )}

      {toast && <div className={toastClass}>{toast.msg}</div>}
    </Container>
  )
}
