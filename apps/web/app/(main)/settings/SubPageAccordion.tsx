'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChevronRight, ExternalLink, Loader2 } from 'lucide-react'

import {
  Card,
  CardContent,
  Switch,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { useNotification } from '@/hooks/use-notification'
import {
  fetchLoginPreferences,
  saveLoginPreferences,
  type LoginPreferences,
} from '@/lib/login-preferences'
import { startAutoRefresh, stopAutoRefresh } from '@/lib/tokenUtils'
import { cn } from '@/lib/utils'
import { SUB_PAGES } from './helpers'

/* ========== 通知快速设置 ========== */

interface NotificationPrefs {
  emailEnabled: boolean
  systemNotif: boolean
  marketingEmail: boolean
  smsEnabled: boolean
  pushEnabled: boolean
}

function NotificationsQuickSettings() {
  const t = useTranslations('settings')
  const { soundEnabled, setSoundEnabled } = useNotification()
  const [prefs, setPrefs] = React.useState<NotificationPrefs>({
    emailEnabled: true,
    systemNotif: true,
    marketingEmail: false,
    smsEnabled: false,
    pushEnabled: true,
  })
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    fetchApi<{ settings: Record<string, string> }>('/settings/notifications')
      .then((res) => {
        if (cancelled || !res.success) return
        const s = res.data.settings
        setPrefs({
          emailEnabled: s.emailEnabled !== 'false',
          systemNotif: s.systemNotif !== 'false',
          marketingEmail: s.marketingEmail === 'true',
          smsEnabled: s.smsEnabled === 'true',
          pushEnabled: s.pushEnabled !== 'false',
        })
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const update = async (key: keyof NotificationPrefs, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }))
    try {
      await fetchApi('/settings/notifications', {
        method: 'PUT',
        body: JSON.stringify({ [key]: String(value) }),
      })
    } catch {
      setPrefs((prev) => ({ ...prev, [key]: !value }))
    }
  }

  const updateSound = async (value: boolean) => {
    setSoundEnabled(value)
    try {
      await fetchApi('/settings/notifications', {
        method: 'PUT',
        body: JSON.stringify({ soundEnabled: String(value) }),
      })
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t('notificationsTitle')}
      </div>
    )
  }

  const rows: Array<{
    key: keyof NotificationPrefs | 'sound'
    label: string
    value: boolean
    onChange: (v: boolean) => void
  }> = [
    {
      key: 'emailEnabled',
      label: t('emailNotif'),
      value: prefs.emailEnabled,
      onChange: (v) => update('emailEnabled', v),
    },
    {
      key: 'pushEnabled',
      label: t('pushNotif'),
      value: prefs.pushEnabled,
      onChange: (v) => update('pushEnabled', v),
    },
    {
      key: 'smsEnabled',
      label: t('smsNotif'),
      value: prefs.smsEnabled,
      onChange: (v) => update('smsEnabled', v),
    },
    {
      key: 'sound',
      label: t('labels.notificationSound'),
      value: soundEnabled,
      onChange: updateSound,
    },
  ]

  return (
    <div className="space-y-2 py-1">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center justify-between gap-3">
          <span className="min-w-0 flex-1 text-xs text-muted-foreground">{row.label}</span>
          <Switch
            size="sm"
            checked={row.value}
            onCheckedChange={row.onChange}
            className="shrink-0"
          />
        </div>
      ))}
    </div>
  )
}

/* ========== 隐私快速设置 ========== */

interface PrivacyPrefs {
  dataVisible: boolean
  adTracking: boolean
  personalizedRecommendation: boolean
}

function PrivacyQuickSettings() {
  const t = useTranslations('settings')
  const [prefs, setPrefs] = React.useState<PrivacyPrefs>({
    dataVisible: true,
    adTracking: false,
    personalizedRecommendation: true,
  })
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    fetchApi<{ settings: Record<string, string> }>('/settings/privacy')
      .then((res) => {
        if (cancelled || !res.success) return
        const s = res.data.settings
        setPrefs({
          dataVisible: s.dataVisible !== 'false',
          adTracking: s.adTracking === 'true',
          personalizedRecommendation: s.personalizedRecommendation !== 'false',
        })
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const update = async (key: keyof PrivacyPrefs, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }))
    try {
      await fetchApi('/settings/privacy', {
        method: 'PUT',
        body: JSON.stringify({ [key]: String(value) }),
      })
    } catch {
      setPrefs((prev) => ({ ...prev, [key]: !value }))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t('privacyTitle')}
      </div>
    )
  }

  const rows: Array<{
    key: keyof PrivacyPrefs
    label: string
    value: boolean
    onChange: (v: boolean) => void
  }> = [
    {
      key: 'dataVisible',
      label: t('dataVisibility'),
      value: prefs.dataVisible,
      onChange: (v) => update('dataVisible', v),
    },
    {
      key: 'adTracking',
      label: t('adTracking'),
      value: prefs.adTracking,
      onChange: (v) => update('adTracking', v),
    },
    {
      key: 'personalizedRecommendation',
      label: t('personalizedRecommendation'),
      value: prefs.personalizedRecommendation,
      onChange: (v) => update('personalizedRecommendation', v),
    },
  ]

  return (
    <div className="space-y-2 py-1">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center justify-between gap-3">
          <span className="min-w-0 flex-1 text-xs text-muted-foreground">{row.label}</span>
          <Switch
            size="sm"
            checked={row.value}
            onCheckedChange={row.onChange}
            className="shrink-0"
          />
        </div>
      ))}
    </div>
  )
}

/* ========== 登录安全快速设置 ========== */

function LoginSecurityQuickSettings() {
  const t = useTranslations('settings')
  const [prefs, setPrefs] = React.useState<LoginPreferences>({
    autoLogin: false,
    autoRenew: true,
  })
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    let active = true
    void (async () => {
      const p = await fetchLoginPreferences()
      if (active) {
        setPrefs(p)
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const update = async (next: Partial<LoginPreferences>) => {
    setSaving(true)
    const merged = { ...prefs, ...next }
    setPrefs(merged)
    const saved = await saveLoginPreferences(next)
    setSaving(false)
    if (saved) {
      setPrefs(saved)
      if (next.autoRenew !== undefined) {
        if (next.autoRenew) startAutoRefresh()
        else stopAutoRefresh()
      }
    } else {
      setPrefs(prefs)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t('loginSecurityTitle')}
      </div>
    )
  }

  const rows: Array<{
    key: keyof LoginPreferences
    label: string
    value: boolean
    onChange: (v: boolean) => void
  }> = [
    {
      key: 'autoLogin',
      label: t('loginSecurity.autoLoginTitle'),
      value: prefs.autoLogin,
      onChange: (v) => update({ autoLogin: v }),
    },
    {
      key: 'autoRenew',
      label: t('loginSecurity.autoRenewTitle'),
      value: prefs.autoRenew,
      onChange: (v) => update({ autoRenew: v }),
    },
  ]

  return (
    <div className="space-y-2 py-1">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center justify-between gap-3">
          <span className="min-w-0 flex-1 text-xs text-muted-foreground">{row.label}</span>
          <Switch
            size="sm"
            checked={row.value}
            disabled={saving}
            onCheckedChange={row.onChange}
            className="shrink-0"
          />
        </div>
      ))}
    </div>
  )
}

/* ========== 快速设置组件映射 ========== */

const QUICK_SETTINGS_MAP: Record<string, React.ComponentType> = {
  '/settings/notifications': NotificationsQuickSettings,
  '/settings/privacy': PrivacyQuickSettings,
  '/settings/login-security': LoginSecurityQuickSettings,
}

/* ========== 子页面手风琴 ========== */

interface SubPageAccordionProps {
  t: (k: string) => string
}

export function SubPageAccordion({ t }: SubPageAccordionProps) {
  const [openHref, setOpenHref] = React.useState<string>('')

  return (
    <div className="grid grid-cols-1 gap-2 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
      {SUB_PAGES.map((item) => {
        const isOpen = openHref === item.href
        const QuickSettings = QUICK_SETTINGS_MAP[item.href]
        const Icon = item.icon
        return (
          <Collapsible
            key={item.href}
            open={isOpen}
            onOpenChange={(open) => setOpenHref(open ? item.href : '')}
            className={cn('min-w-0', isOpen && 'col-span-full')}
          >
            <Card className={cn('transition-colors', isOpen && 'ring-1 ring-border')}>
              <CollapsibleTrigger className="w-full text-left">
                <CardContent className="flex items-center gap-2 p-3 hover:bg-accent transition-colors">
                  <div className="rounded-md bg-muted p-1.5">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-medium">{t(item.titleKey)}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                      {t(item.descKey)}
                    </p>
                  </div>
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                      isOpen && 'rotate-90',
                    )}
                  />
                </CardContent>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-border px-3 py-2.5">
                  {QuickSettings ? (
                    <QuickSettings />
                  ) : (
                    <Link
                      href={item.href}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      <span className="min-w-0 flex-1">{t(item.descKey)}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </Link>
                  )}
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )
      })}
    </div>
  )
}
