'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Settings, Loader2, Bell, Shield, Save } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Button, Label } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface NotificationPrefs {
  orderUpdates: boolean
  promotions: boolean
  points: boolean
  newsletter: boolean
}

interface PrivacyPrefs {
  showProfile: boolean
  showActivity: boolean
  allowInvites: boolean
}

const DEFAULT_NOTIF: NotificationPrefs = {
  orderUpdates: true,
  promotions: false,
  points: true,
  newsletter: false,
}

const DEFAULT_PRIVACY: PrivacyPrefs = {
  showProfile: true,
  showActivity: false,
  allowInvites: true,
}

const NOTIF_KEYS = ['orderUpdates', 'promotions', 'points', 'newsletter'] as const
const PRIVACY_KEYS = ['showProfile', 'showActivity', 'allowInvites'] as const

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 rounded-lg transition-colors',
        checked ? 'bg-primary' : 'bg-muted',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded bg-background shadow transition-transform',
          checked ? 'left-4' : 'left-0.5',
        )}
      />
    </button>
  )
}

export default function MemberSettingsPage() {
  const t = useTranslations('memberSettingsPage')
  const [notif, setNotif] = React.useState<NotificationPrefs>(DEFAULT_NOTIF)
  const [privacy, setPrivacy] = React.useState<PrivacyPrefs>(DEFAULT_PRIVACY)
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    api<{ settings: { notifications?: NotificationPrefs; privacy?: PrivacyPrefs } }>(
      '/api/member/settings',
    )
      .then((d) => {
        if (d.settings?.notifications) setNotif({ ...DEFAULT_NOTIF, ...d.settings.notifications })
        if (d.settings?.privacy) setPrivacy({ ...DEFAULT_PRIVACY, ...d.settings.privacy })
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const saveMut = useMutation({
    mutationFn: () =>
      api('/api/member/settings', {
        method: 'PUT',
        body: JSON.stringify({ notifications: notif, privacy }),
      }),
  })

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Settings className="h-5 w-5 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2 border-b pb-2 text-sm font-semibold">
            <Bell className="h-4 w-4" />
            {t('notifTitle')}
          </div>
          {NOTIF_KEYS.map((key) => (
            <div key={key} className="flex items-center justify-between">
              <Label className="text-sm font-normal text-muted-foreground">
                {t(`notif.${key}`)}
              </Label>
              <Toggle checked={notif[key]} onChange={(v) => setNotif({ ...notif, [key]: v })} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2 border-b pb-2 text-sm font-semibold">
            <Shield className="h-4 w-4" />
            {t('privacyTitle')}
          </div>
          {PRIVACY_KEYS.map((key) => (
            <div key={key} className="flex items-center justify-between">
              <Label className="text-sm font-normal text-muted-foreground">
                {t(`privacy.${key}`)}
              </Label>
              <Toggle
                checked={privacy[key]}
                onChange={(v) => setPrivacy({ ...privacy, [key]: v })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} size="sm">
          {saveMut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {t('saveBtn')}
        </Button>
        {saveMut.isSuccess && (
          <span className="text-xs text-emerald-600 dark:text-emerald-500">{t('saved')}</span>
        )}
      </div>

      {saveMut.isError && <Alert variant="danger" description={(saveMut.error as Error).message} />}
    </div>
  )
}
