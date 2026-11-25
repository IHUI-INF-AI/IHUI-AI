// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useAuthGate } from '@/hooks/use-auth-gate'
import { AuthGatePrompt } from '@/components/common'
import { Mail, MessageSquare, Bell, Volume2, Loader2, Check, Play } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, Switch } from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import { Container } from '@/components/layout'
import { Tooltip } from '@/components/feedback'
import { fetchApi } from '@/lib/api'
import { useNotification } from '@/hooks/use-notification'
import { useRingtonePreference } from '@/hooks/use-ringtone-preference'
import { RINGTONES, type RingtoneId } from '@ihui/shared/notifications/ringtone'
import {
  querySystemNotificationPermission,
  type SystemNotificationPermissionReport,
} from '@/lib/tauri-bridge'
import { resolveSystemPermissionView } from './system-permission-display'

interface NotificationPrefs {
  emailEnabled: boolean
  systemNotif: boolean
  marketingEmail: boolean
  smsEnabled: boolean
  pushEnabled: boolean
}

// G-402:每键缺省值的单一真相源。读侧从存储值还原时一律回落这张表(从未设置 / 被清空 → 该键默认),
// 不再散写 `!== 'false'` / `=== 'true'`(同一含义两键极性相反 ⇒ 漂移风险);默认态初值也取同一份。
const NOTIFICATION_DEFAULTS: NotificationPrefs = {
  emailEnabled: true,
  systemNotif: true,
  marketingEmail: false,
  smsEnabled: false,
  pushEnabled: true,
}

// 显式 'true'/'false' 优先;缺省(undefined / null / 被清空)回落该键默认 —— 逐值等价于旧散写逻辑,只是集中一处。
const resolvePref = (raw: string | null | undefined, key: keyof NotificationPrefs): boolean =>
  raw === 'true' ? true : raw === 'false' ? false : NOTIFICATION_DEFAULTS[key]

export default function NotificationsPage() {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  // 2026-10-15 登录态门(与 /chat/favorites、签到助手同型):未就绪/未登录不发注定 401 的请求,改显登录引导
  const tGate = useTranslations('chatHistory')
  const { ready, allow } = useAuthGate()
  const { soundEnabled, setSoundEnabled } = useNotification()
  const { ringtoneId, selectRingtone, preview, refreshFromServer } = useRingtonePreference()
  const [prefs, setPrefs] = React.useState<NotificationPrefs>(NOTIFICATION_DEFAULTS)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  // 系统级通知权限三态:默认 unjudged,绝不在查询前预设 allowed。
  const [systemPermission, setSystemPermission] =
    React.useState<SystemNotificationPermissionReport | null>(null)
  const systemView = resolveSystemPermissionView(systemPermission?.state)

  // 独立查询:系统级权限不依赖登录态,也不依赖偏好接口;失败保持 null(=未判定)。
  React.useEffect(() => {
    let cancelled = false
    querySystemNotificationPermission()
      .then((report) => {
        if (!cancelled) setSystemPermission(report)
      })
      .catch(() => {
        // fail-closed:查询失败不写 allowed,保持未判定。
        if (!cancelled) setSystemPermission(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!allow) return
    let cancelled = false
    fetchApi<{ settings: Record<string, string> }>('/settings/notifications')
      .then((res) => {
        if (cancelled) return
        if (res.success) {
          const s = res.data.settings
          setPrefs({
            emailEnabled: resolvePref(s.emailEnabled, 'emailEnabled'),
            systemNotif: resolvePref(s.systemNotif, 'systemNotif'),
            marketingEmail: resolvePref(s.marketingEmail, 'marketingEmail'),
            smsEnabled: resolvePref(s.smsEnabled, 'smsEnabled'),
            pushEnabled: resolvePref(s.pushEnabled, 'pushEnabled'),
          })
          // 声音开关随设备跟随:以服务端为准校正本地与 state;后端无值时本地默认开。
          const serverSound = s.soundEnabled
          setSoundEnabled(serverSound !== '0' && serverSound !== 'false')
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
  }, [t, allow, setSoundEnabled])

  React.useEffect(() => {
    if (!allow) return
    void refreshFromServer()
  }, [allow, refreshFromServer])

  React.useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const update = async (key: keyof NotificationPrefs, value: boolean) => {
    // 乐观更新失败必须回滚:不回滚时开关停在新位置、只有一条 toast,
    // 用户会以为已保存,刷新后又变回去。
    const previous = prefs[key]
    setPrefs((prev) => ({ ...prev, [key]: value }))
    const rollback = () => setPrefs((prev) => ({ ...prev, [key]: previous }))
    try {
      const res = await fetchApi('/settings/notifications', {
        method: 'PUT',
        body: JSON.stringify({ [key]: String(value) }),
      })
      if (res.success) {
        setToast({ type: 'success', msg: t('notificationsSaveSuccess') })
      } else {
        rollback()
        setToast({ type: 'error', msg: t('notificationsSaveFailed') })
      }
    } catch {
      rollback()
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

  // 选中铃声:hook 内已乐观更新本地 + 试听 + PUT,失败回滚;这里只补成功/失败提示。
  const handleSelectRingtone = async (id: RingtoneId) => {
    const ok = await selectRingtone(id)
    setToast({
      type: ok ? 'success' : 'error',
      msg: t(ok ? 'notificationsSaveSuccess' : 'notificationsSaveFailed'),
    })
  }

  return (
    <Container maxWidth="full" padding={false} className="px-4 flex h-full flex-col py-4">
      <BackButton />
      <div className="shrink-0">
        <h1 className="text-display font-bold tracking-tight">{t('notificationsTitle')}</h1>
        <p className="mt-1 text-body text-muted-foreground">{t('notificationsDesc')}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        {!ready ? (
          // 登录态确认中 ≠ 未登录:bootstrap 静默刷新还没跑完时就显「请先登录」,
          // 已登录用户会误判被踢出(与签到助手 HEAD 三态同型,2026-10-15 改判)。
          <div className="flex items-center justify-center gap-2 py-8 text-body text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tc('loading')}
          </div>
        ) : !allow ? (
          <AuthGatePrompt message={tGate('loginRequired')} />
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-body text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tc('loading')}
          </div>
        ) : error ? (
          <p className="py-8 text-center text-body text-destructive">{error}</p>
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
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 text-body text-muted-foreground">
                    {t('emailNotifDesc')}
                  </span>
                  <Switch
                    checked={prefs.emailEnabled}
                    onCheckedChange={(v) => update('emailEnabled', v)}
                    className="shrink-0"
                  />
                </div>
                {prefs.emailEnabled && (
                  <div className="space-y-3 rounded-md bg-muted/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 text-body">{t('systemNotif')}</span>
                      <Switch
                        size="sm"
                        checked={prefs.systemNotif}
                        onCheckedChange={(v) => update('systemNotif', v)}
                        className="shrink-0"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 text-body">{t('marketingEmail')}</span>
                      <Switch
                        size="sm"
                        checked={prefs.marketingEmail}
                        onCheckedChange={(v) => update('marketingEmail', v)}
                        className="shrink-0"
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
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <span className="block text-body text-muted-foreground">
                      {t('smsNotifDesc')}
                    </span>
                    <p className="font-mono text-label text-muted-foreground">+86 138****8888</p>
                  </div>
                  <Switch
                    checked={prefs.smsEnabled}
                    onCheckedChange={(v) => update('smsEnabled', v)}
                    className="shrink-0"
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
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 text-body text-muted-foreground">
                    {t('pushNotifDesc')}
                  </span>
                  <Switch
                    checked={prefs.pushEnabled}
                    onCheckedChange={(v) => update('pushEnabled', v)}
                    className="shrink-0"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bell className="h-4 w-4" />
                  {t('systemPermissionTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 text-body text-muted-foreground">
                    {t('systemPermissionDesc')}
                  </span>
                  <span
                    data-testid="system-permission-state"
                    data-state={systemView.state}
                    className="shrink-0 font-mono text-label"
                  >
                    {t(systemView.labelKey)}
                  </span>
                </div>
                {systemView.showDeniedHint && (
                  <p
                    data-testid="system-permission-denied-hint"
                    className="text-body text-destructive"
                  >
                    {t('systemPermissionDeniedHint')}
                  </p>
                )}
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
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 text-body text-muted-foreground">
                    {t('desc.notificationSound')}
                  </span>
                  <Switch
                    checked={soundEnabled}
                    onCheckedChange={updateSound}
                    className="shrink-0"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bell className="h-4 w-4" />
                  {t('labels.notificationRingtone')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-body text-muted-foreground">
                  {t('desc.notificationRingtone')}
                </p>
                <div
                  role="radiogroup"
                  tabIndex={0}
                  aria-label={t('labels.notificationRingtone')}
                  className="space-y-2"
                  onKeyDown={(e) => {
                    if (
                      e.key !== 'ArrowDown' &&
                      e.key !== 'ArrowUp' &&
                      e.key !== 'ArrowLeft' &&
                      e.key !== 'ArrowRight'
                    )
                      return
                    const options = Array.from(
                      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
                    )
                    const current = options.indexOf(document.activeElement as HTMLButtonElement)
                    if (current < 0) return
                    e.preventDefault()
                    const delta = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1
                    const next = (current + delta + options.length) % options.length
                    options[next]?.focus()
                  }}
                >
                  {RINGTONES.map((ring) => {
                    const checked = ringtoneId === ring.id
                    return (
                      <button
                        key={ring.id}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        onClick={() => void handleSelectRingtone(ring.id)}
                        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stroke-focus ${
                          checked ? 'border-stroke-strong bg-muted/40' : 'border-stroke-light'
                        }`}
                      >
                        <span className="min-w-0 flex-1 text-body">
                          {t(`ringtoneNames.${ring.id}`)}
                        </span>
                        <Tooltip content={t('ringtonePreview')}>
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label={t('ringtonePreview')}
                            onClick={(e) => {
                              e.stopPropagation()
                              preview(ring.id)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.stopPropagation()
                                preview(ring.id)
                              }
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
                          >
                            <Play className="h-4 w-4" />
                          </span>
                        </Tooltip>
                        {checked && <Check className="h-4 w-4 shrink-0 text-primary" />}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {toast && (
          <div
            className={`fixed right-4 top-4 z-modal rounded-md px-4 py-2 text-body text-white shadow-elevation-lg ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
          >
            {toast.msg}
          </div>
        )}
      </div>
    </Container>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
