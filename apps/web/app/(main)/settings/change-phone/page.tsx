'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, AlertTriangle } from 'lucide-react'

import { Card, CardContent } from '@ihui/ui'
import { Container } from '@/components/layout'
import { getProfile } from '@/lib/user-api'
import {
  sendChangePhoneOldCode,
  verifyChangePhoneOldCode,
  sendChangePhoneNewCode,
  changePhone,
} from '@/lib/auth-api'

import { Step1PhoneVerify } from './Step1PhoneVerify'
import { Step2NewPhone } from './Step2NewPhone'

export default function ChangePhonePage() {
  const t = useTranslations('settings')
  const router = useRouter()

  const [step, setStep] = React.useState<1 | 2>(1)
  const [oldCode, setOldCode] = React.useState('')
  const [newPhone, setNewPhone] = React.useState('')
  const [newCode, setNewCode] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [tip, setTip] = React.useState('')

  const profileQ = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const r = await getProfile()
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const currentPhone = profileQ.data?.phone ?? ''

  const handleGetOldCode = async () => {
    const r = await sendChangePhoneOldCode()
    if (!r.success) {
      setTip(r.error)
      return
    }
    setTip(t('changePhoneCodeSent'))
  }

  const handleVerifyOld = async () => {
    if (oldCode.trim().length !== 6) {
      setTip(t('changePhoneInvalidCode'))
      return
    }
    const r = await verifyChangePhoneOldCode(oldCode.trim())
    if (!r.success) {
      setTip(t('changePhoneVerifyFailed'))
      return
    }
    setStep(2)
    setTip('')
  }

  const handleGetNewCode = async () => {
    if (!/^1\d{10}$/.test(newPhone.trim())) {
      setTip(t('changePhoneInvalidNewPhone'))
      return
    }
    const r = await sendChangePhoneNewCode(newPhone.trim())
    if (!r.success) {
      setTip(r.error)
      return
    }
    setTip(t('changePhoneCodeSent'))
  }

  const handleSubmit = async () => {
    const isNewPhoneValid = /^1\d{10}$/.test(newPhone.trim())
    if (!isNewPhoneValid) {
      setTip(t('changePhoneInvalidNewPhone'))
      return
    }
    if (newCode.trim().length !== 6) {
      setTip(t('changePhoneInvalidCode'))
      return
    }
    if (submitting) return
    setSubmitting(true)
    try {
      const r = await changePhone(newPhone.trim(), newCode.trim())
      if (!r.success) {
        setTip(r.error || t('changePhoneVerifyFailed'))
        return
      }
      setTip(t('changePhoneSuccess'))
      setTimeout(() => router.back(), 1000)
    } catch {
      setTip(t('changePhoneVerifyFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('changePhoneTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('changePhoneDesc')}</p>
      </div>

      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{t('changePhoneIntroTitle')}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t('changePhoneIntroDesc')}
            </p>
          </div>
        </CardContent>
      </Card>

      {step === 1 && (
        <Step1PhoneVerify
          t={t}
          currentPhone={currentPhone}
          isProfileLoading={profileQ.isLoading}
          oldCode={oldCode}
          onOldCodeChange={setOldCode}
          onVerify={handleVerifyOld}
          onGetOldCode={handleGetOldCode}
        />
      )}

      {step === 2 && (
        <Step2NewPhone
          t={t}
          currentPhone={currentPhone}
          newPhone={newPhone}
          onNewPhoneChange={setNewPhone}
          newCode={newCode}
          onNewCodeChange={setNewCode}
          submitting={submitting}
          onGetNewCode={handleGetNewCode}
          onSubmit={handleSubmit}
        />
      )}

      {tip && <p className="text-center text-xs text-muted-foreground">{tip}</p>}

      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
          <div>
            <p className="text-sm font-medium">{t('changePhoneNoticeTitle')}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t('changePhoneNoticeDesc')}
            </p>
          </div>
        </CardContent>
      </Card>
    </Container>
  )
}
