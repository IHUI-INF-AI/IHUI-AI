'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Phone, ShieldCheck, AlertTriangle } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, Button } from '@ihui/ui'
import { Container } from '@/components/layout'
import { Input } from '@/components/form'
import { useCountdown } from '@/hooks/use-countdown'

const CURRENT_PHONE = '13888888888'
const CODE_LENGTH = 6
const COUNTDOWN_SECONDS = 60

function maskPhone(phone: string): string {
  const p = (phone || '').trim()
  if (!p || p.length < 11) return '未绑定'
  return p.slice(0, 3) + '****' + p.slice(-4)
}

export default function ChangePhonePage() {
  const t = useTranslations('settings')
  const router = useRouter()

  const [step, setStep] = React.useState<1 | 2>(1)
  const [oldCode, setOldCode] = React.useState('')
  const [newPhone, setNewPhone] = React.useState('')
  const [newCode, setNewCode] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [tip, setTip] = React.useState('')

  const oldCountdown = useCountdown(COUNTDOWN_SECONDS)
  const newCountdown = useCountdown(COUNTDOWN_SECONDS)

  const maskedPhone = React.useMemo(() => maskPhone(CURRENT_PHONE), [])

  const canVerifyOld = oldCode.trim().length === CODE_LENGTH
  const isNewPhoneValid = /^1\d{10}$/.test(newPhone.trim())
  const canSubmitNew = isNewPhoneValid && newCode.trim().length === CODE_LENGTH

  const handleGetOldCode = () => {
    if (oldCountdown.isRunning) return
    // TODO: 调用发送验证码 API,确认接口路径
    // await fetch('/api/user/settings/change-phone/send-code', { method: 'POST', body: JSON.stringify({ phone: CURRENT_PHONE, type: 'old' }) })
    oldCountdown.start()
    setTip(t('changePhoneCodeSent'))
  }

  const handleVerifyOld = () => {
    if (!canVerifyOld) {
      setTip(t('changePhoneInvalidCode'))
      return
    }
    // TODO: 调用校验旧手机号验证码 API
    // const res = await fetch('/api/user/settings/change-phone/verify-old', { method: 'POST', body: JSON.stringify({ phone: CURRENT_PHONE, code: oldCode }) })
    setStep(2)
    setTip('')
  }

  const handleGetNewCode = () => {
    if (newCountdown.isRunning) return
    if (!isNewPhoneValid) {
      setTip(t('changePhoneInvalidNewPhone'))
      return
    }
    // TODO: 调用发送新手机号验证码 API
    // await fetch('/api/user/settings/change-phone/send-code', { method: 'POST', body: JSON.stringify({ phone: newPhone, type: 'new' }) })
    newCountdown.start()
    setTip(t('changePhoneCodeSent'))
  }

  const handleSubmit = async () => {
    if (!canSubmitNew) {
      if (!isNewPhoneValid) setTip(t('changePhoneInvalidNewPhone'))
      else setTip(t('changePhoneInvalidCode'))
      return
    }
    if (submitting) return
    setSubmitting(true)
    try {
      // TODO: 调用更换手机号 API,后端接口待确认
      // const res = await fetch('/api/user/settings/change-phone', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ oldPhone: CURRENT_PHONE, oldCode, newPhone, newCode }),
      // })
      await new Promise((resolve) => setTimeout(resolve, 800))
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-4 w-4" />
              {t('changePhoneStep1Label')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-muted/30 px-3 py-2">
              <span className="text-xs text-muted-foreground">{t('changePhoneCurrentPhone')}</span>
              <p className="mt-0.5 font-mono text-sm font-medium">{maskedPhone}</p>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder={t('changePhoneOldCodePlaceholder')}
                maxLength={CODE_LENGTH}
                value={oldCode}
                onChange={(e) => setOldCode(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                className="flex-1"
              />
              <Button
                variant="outline"
                size="default"
                disabled={oldCountdown.isRunning}
                onClick={handleGetOldCode}
                className="shrink-0"
              >
                {oldCountdown.isRunning ? `${oldCountdown.count}s` : t('changePhoneSendCode')}
              </Button>
            </div>

            <Button className="w-full" disabled={!canVerifyOld} onClick={handleVerifyOld}>
              {t('changePhoneNextStep')}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-4 w-4" />
              {t('changePhoneStep2Label')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-950/40 dark:text-green-400">
              {t('changePhoneStep1DoneTip')} {maskedPhone}
            </p>

            <Input
              label={t('changePhoneNewPhoneLabel')}
              placeholder={t('changePhoneNewPhonePlaceholder')}
              maxLength={11}
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
            />

            <div className="flex gap-2">
              <Input
                placeholder={t('changePhoneNewCodePlaceholder')}
                maxLength={CODE_LENGTH}
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                className="flex-1"
              />
              <Button
                variant="outline"
                size="default"
                disabled={newCountdown.isRunning}
                onClick={handleGetNewCode}
                className="shrink-0"
              >
                {newCountdown.isRunning ? `${newCountdown.count}s` : t('changePhoneSendCode')}
              </Button>
            </div>

            <Button
              className="w-full"
              disabled={!canSubmitNew || submitting}
              onClick={handleSubmit}
            >
              {submitting ? t('changePhoneSubmitting') : t('changePhoneSubmit')}
            </Button>
          </CardContent>
        </Card>
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
