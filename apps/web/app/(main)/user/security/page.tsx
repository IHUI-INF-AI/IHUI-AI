'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'

import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

import { PasswordSection } from './PasswordSection'
import { PhoneSection } from './PhoneSection'
import { DevicesSection } from './DevicesSection'
import { phoneRegex, createDateFmt } from './helpers'
import type { Device, FormMsg } from './types'

export default function SecurityPage() {
  const t = useTranslations('user.security')
  const locale = useLocale()
  const user = useAuthStore((s) => s.user)
  const [pwMsg, setPwMsg] = React.useState<FormMsg>(null)
  const [pwLoading, setPwLoading] = React.useState(false)
  const [codeCountdown, setCodeCountdown] = React.useState(0)
  const [newPhone, setNewPhone] = React.useState('')
  const [phoneCode, setPhoneCode] = React.useState('')
  const [phoneMsg, setPhoneMsg] = React.useState<FormMsg>(null)
  const [phoneLoading, setPhoneLoading] = React.useState(false)
  const [sendingCode, setSendingCode] = React.useState(false)

  const { data: devices, isLoading: devicesLoading } = useQuery({
    queryKey: ['user', 'security', 'devices', user?.id],
    queryFn: async () => {
      const r = await fetchApi<Device[]>(`/api/users/${user?.id}/devices`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    enabled: !!user?.id,
  })
  const devicesList = devices ?? []

  const onPasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const current = String(fd.get('current') ?? '')
    const next = String(fd.get('new') ?? '')
    const confirm = String(fd.get('confirm') ?? '')
    if (next !== confirm) {
      setPwMsg({ type: 'err', text: t('passwordNotMatch') })
      return
    }
    if (next.length < 6) {
      setPwMsg({ type: 'err', text: t('passwordTooShort') })
      return
    }
    if (next.length > 20) {
      setPwMsg({ type: 'err', text: t('passwordTooLong') })
      return
    }
    if (/[<>"'|\\]/.test(next)) {
      setPwMsg({ type: 'err', text: t('passwordInvalidChar') })
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
    const res = await fetchApi<{ user: { id: string; phone: string } }>('/api/users/change-phone', {
      method: 'POST',
      body: JSON.stringify({ newPhone, code: phoneCode }),
    })
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

  const dateFmt = createDateFmt(locale)

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <PasswordSection pwMsg={pwMsg} pwLoading={pwLoading} onSubmit={onPasswordSubmit} />
      <PhoneSection
        phone={user?.phone}
        newPhone={newPhone}
        setNewPhone={setNewPhone}
        phoneCode={phoneCode}
        setPhoneCode={setPhoneCode}
        phoneMsg={phoneMsg}
        codeCountdown={codeCountdown}
        sendingCode={sendingCode}
        phoneLoading={phoneLoading}
        onSendCode={onSendCode}
        onChangePhone={onChangePhone}
      />
      <DevicesSection devicesList={devicesList} devicesLoading={devicesLoading} dateFmt={dateFmt} />
    </div>
  )
}
