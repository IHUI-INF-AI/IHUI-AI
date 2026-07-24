'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { LogIn, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, Switch } from '@ihui/ui-react'
import { Container } from '@/components/layout'
import {
  fetchLoginPreferences,
  saveLoginPreferences,
  type LoginPreferences,
} from '@/lib/login-preferences'
import { startAutoRefresh, stopAutoRefresh } from '@/lib/tokenUtils'

/** 记住天数(与后端 refresh TTL 对齐) */
const REMEMBER_DAYS = 30

export default function LoginSecurityPage() {
  const t = useTranslations('settings')

  const [prefs, setPrefs] = React.useState<LoginPreferences>({
    autoLogin: false,
    autoRenew: true,
  })
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [toast, setToast] = React.useState<'ok' | 'err' | null>(null)

  // 初始化:从后端拉取偏好
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

  const showToast = (kind: 'ok' | 'err') => {
    setToast(kind)
    setTimeout(() => setToast(null), 2000)
  }

  const update = async (next: Partial<LoginPreferences>) => {
    setSaving(true)
    const merged = { ...prefs, ...next }
    setPrefs(merged)
    const saved = await saveLoginPreferences(next)
    setSaving(false)
    if (saved) {
      setPrefs(saved)
      showToast('ok')
      // autoRenew 切换:实时启停自动续期
      if (next.autoRenew !== undefined) {
        if (next.autoRenew) startAutoRefresh()
        else stopAutoRefresh()
      }
    } else {
      showToast('err')
      setPrefs(prefs) // 回滚
    }
  }

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('loginSecurityTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('loginSecurityDesc')}</p>
      </div>

      {/* 自动登录 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LogIn className="h-4 w-4" />
            {t('loginSecurity.autoLoginTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {t('loginSecurity.autoLoginDesc')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('loginSecurity.rememberDays', { days: REMEMBER_DAYS })}
              </p>
            </div>
            {loading ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Switch
                checked={prefs.autoLogin}
                disabled={saving}
                onCheckedChange={(v) => update({ autoLogin: v })}
                aria-label={t('loginSecurity.autoLoginTitle')}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* 自动续期 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4" />
            {t('loginSecurity.autoRenewTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {t('loginSecurity.autoRenewDesc')}
              </p>
              <p className="text-xs text-muted-foreground">
                {prefs.autoRenew
                  ? t('loginSecurity.autoRenewOn')
                  : t('loginSecurity.autoRenewOff')}
              </p>
            </div>
            {loading ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Switch
                checked={prefs.autoRenew}
                disabled={saving}
                onCheckedChange={(v) => update({ autoRenew: v })}
                aria-label={t('loginSecurity.autoRenewTitle')}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md px-4 py-2 text-sm shadow-md ${
            toast === 'ok'
              ? 'bg-foreground text-background'
              : 'bg-destructive text-destructive-foreground'
          }`}
        >
          {toast === 'ok' ? (
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              {t('loginSecurity.saveSuccess')}
            </span>
          ) : (
            t('loginSecurity.saveFailed')
          )}
        </div>
      )}
    </Container>
  )
}
