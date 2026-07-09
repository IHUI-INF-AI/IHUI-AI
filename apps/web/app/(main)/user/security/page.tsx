'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Lock, Smartphone, Monitor, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'

import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Button, Input, Label } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface Device {
  id: string
  name: string
  ip: string
  lastActive: string
  current: boolean
}

const MOCK_DEVICES: Device[] = [
  { id: '1', name: 'Chrome · macOS', ip: '192.168.1.1', lastActive: '2026-07-08T10:00:00Z', current: true },
  { id: '2', name: 'Safari · iPhone', ip: '10.0.0.2', lastActive: '2026-07-07T22:30:00Z', current: false },
]

export default function SecurityPage() {
  const t = useTranslations('user.security')
  const locale = useLocale()
  const user = useAuthStore((s) => s.user)
  const [pwMsg, setPwMsg] = React.useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [pwLoading, setPwLoading] = React.useState(false)
  const [codeCountdown, setCodeCountdown] = React.useState(0)
  const [newPhone, setNewPhone] = React.useState('')
  const [phoneCode, setPhoneCode] = React.useState('')
  const [phoneMsg, setPhoneMsg] = React.useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [phoneLoading, setPhoneLoading] = React.useState(false)
  const [sendingCode, setSendingCode] = React.useState(false)

  const onPasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const current = String(fd.get('current') ?? '')
    const next = String(fd.get('new') ?? '')
    const confirm = String(fd.get('confirm') ?? '')
    if (next !== confirm) {
      setPwMsg({ type: 'err', text: t('mismatch') })
      return
    }
    if (next.length < 6) {
      setPwMsg({ type: 'err', text: t('tooShort') })
      return
    }
    setPwLoading(true)
    setPwMsg(null)
    const res = await fetchApi(`/api/users/${user?.id}/password`, {
      method: 'POST',
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    })
    setPwLoading(false)
    setPwMsg(res.success ? { type: 'ok', text: t('pwUpdated') } : { type: 'err', text: res.error })
    if (res.success) form.reset()
  }

  const phoneRegex = /^1[3-9]\d{9}$/

  const startCountdown = () => {
    setCodeCountdown(60)
    const timer = setInterval(() => {
      setCodeCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  const onSendCode = async () => {
    if (codeCountdown > 0 || sendingCode) return
    setPhoneMsg(null)
    if (!phoneRegex.test(newPhone)) {
      setPhoneMsg({ type: 'err', text: t('newPhonePlaceholder') })
      return
    }
    setSendingCode(true)
    try {
      const res = await fetchApi<{ sent: boolean }>('/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ phone: newPhone, scene: 'phone-binding' }),
      })
      if (!res.success) {
        setPhoneMsg({ type: 'err', text: res.error })
        return
      }
      toast.success(t('sendCode'))
      startCountdown()
    } catch {
      setPhoneMsg({ type: 'err', text: t('newPhonePlaceholder') })
    } finally {
      setSendingCode(false)
    }
  }

  const onChangePhone = async () => {
    setPhoneMsg(null)
    if (!phoneRegex.test(newPhone)) {
      setPhoneMsg({ type: 'err', text: t('newPhonePlaceholder') })
      return
    }
    if (!phoneCode) {
      setPhoneMsg({ type: 'err', text: t('codePlaceholder') })
      return
    }
    setPhoneLoading(true)
    const res = await fetchApi<{ user: { id: string; phone: string } }>(
      '/api/users/change-phone',
      {
        method: 'POST',
        body: JSON.stringify({ newPhone, code: phoneCode }),
      },
    )
    setPhoneLoading(false)
    if (!res.success) {
      setPhoneMsg({ type: 'err', text: res.error })
      return
    }
    toast.success(t('phoneChanged'))
    if (user) {
      useAuthStore.getState().setUser({ ...user, phone: res.data.user.phone })
    }
    setNewPhone('')
    setPhoneCode('')
    setPhoneMsg({ type: 'ok', text: t('phoneChanged') })
  }

  const maskPhone = (phone: string) => {
    if (!phone || phone.length < 7) return phone
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`
  }

  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* 修改密码 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{t('password')}</h2>
        </div>
        <form onSubmit={onPasswordSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="current">{t('currentPassword')}</Label>
            <Input id="current" name="current" type="password" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new">{t('newPassword')}</Label>
            <Input id="new" name="new" type="password" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">{t('confirmPassword')}</Label>
            <Input id="confirm" name="confirm" type="password" required />
          </div>
          {pwMsg && (
            <p className={cn('text-xs', pwMsg.type === 'ok' ? 'text-emerald-600 dark:text-emerald-500' : 'text-destructive')}>
              {pwMsg.text}
            </p>
          )}
          <Button type="submit" disabled={pwLoading}>
            {pwLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {t('updatePassword')}
          </Button>
        </form>
      </section>

      {/* 修改手机号 */}
      <section className="space-y-4 border-t pt-6">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{t('phone')}</h2>
        </div>
        {user?.phone ? (
          <p className="text-sm text-muted-foreground">
            {t('phoneBound', { phone: maskPhone(user.phone) })}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t('changePhoneDesc')}</p>
        )}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="newPhone">{t('newPhone')}</Label>
            <Input
              id="newPhone"
              name="newPhone"
              type="tel"
              placeholder={t('newPhonePlaceholder')}
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="code">{t('code')}</Label>
              <Input
                id="code"
                name="code"
                placeholder={t('codePlaceholder')}
                value={phoneCode}
                onChange={(e) => setPhoneCode(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={onSendCode}
              disabled={codeCountdown > 0 || sendingCode}
            >
              {sendingCode && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {codeCountdown > 0 ? t('resend', { seconds: codeCountdown }) : t('sendCode')}
            </Button>
          </div>
          {phoneMsg && (
            <p className={cn('text-xs', phoneMsg.type === 'ok' ? 'text-emerald-600 dark:text-emerald-500' : 'text-destructive')}>
              {phoneMsg.text}
            </p>
          )}
          <Button type="button" disabled={phoneLoading} onClick={onChangePhone}>
            {phoneLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {t('changePhone')}
          </Button>
        </div>
      </section>

      {/* 登录设备 */}
      <section className="space-y-3 border-t pt-6">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{t('devices')}</h2>
        </div>
        <ul className="divide-y rounded-lg border">
          {MOCK_DEVICES.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
              <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.name}</p>
                <p className="truncate text-xs text-muted-foreground">{d.ip} · {dateFmt.format(new Date(d.lastActive))}</p>
              </div>
              {d.current ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-500">
                  <Check className="h-3 w-3" />{t('currentDevice')}
                </span>
              ) : (
                <Button variant="ghost" size="sm">{t('logout')}</Button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
