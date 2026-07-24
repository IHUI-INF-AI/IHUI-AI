'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Mail, MessageSquare, Bell, Volume2, Loader2 } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, Switch } from '@ihui/ui-react'
import { Container } from '@/components/layout'
import { fetchApi } from '@/lib/api'
import { useNotification } from '@/hooks/use-notification'

interface NotificationPrefs {
  emailEnabled: boolean
  systemNotif: boolean
  marketingEmail: boolean
  smsEnabled: boolean
  pushEnabled: boolean
}

export default function NotificationsPage() {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const { soundEnabled, setSoundEnabled } = useNotification()
  const [prefs, setPrefs] = React.useState<NotificationPrefs>({
    emailEnabled: true,
    systemNotif: true,
    marketingEmail: false,
    smsEnabled: false,
    pushEnabled: true,
  })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetchApi<{ settings: Record<string, string> }>('/settings/notifications')
      .then((res) => {
        if (cancelled) return
        if (res.success) {
          const s = res.data.settings
          setPrefs({
            emailEnabled: s.emailEnabled !== 'false',
            systemNotif: s.systemNotif !== 'false',
            marketingEmail: s.marketingEmail === 'true',
            smsEnabled: s.smsEnabled === 'true',
            pushEnabled: s.pushEnabled !== 'false',
          })
        } else {
          setError(t('notificationsLoadFailed'))
        }
      })
      .catch(() => {
        if (cancelled) return
        setError(t('notificationsLoadFailed'))
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

  const update = async (key: keyof NotificationPrefs, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }))
    try {
      const res = await fetchApi('/settings/notifications', {
        method: 'PUT',
        body: JSON.stringify({ [key]: String(value) }),
      })
      if (res.success) {
        setToast({ type: 'success', msg: t('notificationsSaveSuccess') })
      } else {
        setToast({ type: 'error', msg: t('notificationsSaveFailed') })
      }
    } catch {
      setToast({ type: 'error', msg: t('notificationsSaveFailed') })
    }
  }

  // soundEnabled 保留 useNotification hook 的 localStorage 逻辑,同时同步到后端
  const updateSound = async (value: boolean) => {
    setSoundEnabled(value)
    try {
      const res = await fetchApi('/settings/notifications', {
        method: 'PUT',
        body: JSON.stringify({ soundEnabled: String(value) }),
      })
      if (res.success) {
        setToast({ type: 'success', msg: t('notificationsSaveSuccess') })
      } else {
        setToast({ type: 'error', msg: t('notificationsSaveFailed') })
      }
    } catch {
      setToast({ type: 'error', msg: t('notificationsSaveFailed') })
    }
  }

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('notificationsTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('notificationsDesc')}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {tc('loading')}
        </div>
      ) : error ? (
        <p className="py-12 text-center text-sm text-destructive">{error}</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" />
                {t('emailNotif')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('emailNotifDesc')}</span>
                <Switch
                  checked={prefs.emailEnabled}
                  onCheckedChange={(v) => update('emailEnabled', v)}
                />
              </div>
              {prefs.emailEnabled && (
                <div className="space-y-3 rounded-md bg-muted/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{t('systemNotif')}</span>
                    <Switch
                      size="sm"
                      checked={prefs.systemNotif}
                      onCheckedChange={(v) => update('systemNotif', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{t('marketingEmail')}</span>
                    <Switch
                      size="sm"
                      checked={prefs.marketingEmail}
                      onCheckedChange={(v) => update('marketingEmail', v)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" />
                {t('smsNotif')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">{t('smsNotifDesc')}</span>
                  <p className="font-mono text-xs text-muted-foreground">+86 138****8888</p>
                </div>
                <Switch
                  checked={prefs.smsEnabled}
                  onCheckedChange={(v) => update('smsEnabled', v)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4" />
                {t('pushNotif')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('pushNotifDesc')}</span>
                <Switch
                  checked={prefs.pushEnabled}
                  onCheckedChange={(v) => update('pushEnabled', v)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Volume2 className="h-4 w-4" />
                {t('labels.notificationSound')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('desc.notificationSound')}</span>
                <Switch checked={soundEnabled} onCheckedChange={updateSound} />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {toast && (
        <div
          className={`fixed right-4 top-4 z-modal rounded-md px-4 py-2 text-sm text-white shadow-lg ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
        >
          {toast.msg}
        </div>
      )}
    </Container>
  )
}
