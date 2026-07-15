'use client'

import { Phone } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@ihui/ui'
import { Input } from '@/components/form'
import { useCountdown } from '@/hooks/use-countdown'
import { CODE_LENGTH, COUNTDOWN_SECONDS, maskPhone } from './helpers'

interface Props {
  t: (k: string) => string
  currentPhone: string
  newPhone: string
  onNewPhoneChange: (v: string) => void
  newCode: string
  onNewCodeChange: (v: string) => void
  submitting: boolean
  onGetNewCode: () => Promise<void>
  onSubmit: () => void
}

export function Step2NewPhone({
  t,
  currentPhone,
  newPhone,
  onNewPhoneChange,
  newCode,
  onNewCodeChange,
  submitting,
  onGetNewCode,
  onSubmit,
}: Props) {
  const newCountdown = useCountdown(COUNTDOWN_SECONDS)
  const masked = maskPhone(currentPhone)
  const isNewPhoneValid = /^1\d{10}$/.test(newPhone.trim())
  const canSubmitNew = isNewPhoneValid && newCode.trim().length === CODE_LENGTH

  const handleGet = async () => {
    await onGetNewCode()
    newCountdown.start()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Phone className="h-4 w-4" />
          {t('changePhoneStep2Label')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-950/40 dark:text-green-400">
          {t('changePhoneStep1DoneTip')} {masked}
        </p>

        <Input
          label={t('changePhoneNewPhoneLabel')}
          placeholder={t('changePhoneNewPhonePlaceholder')}
          maxLength={11}
          value={newPhone}
          onChange={(e) => onNewPhoneChange(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
        />

        <div className="flex gap-2">
          <Input
            placeholder={t('changePhoneNewCodePlaceholder')}
            maxLength={CODE_LENGTH}
            value={newCode}
            onChange={(e) => onNewCodeChange(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            className="flex-1"
          />
          <Button
            variant="outline"
            size="default"
            disabled={newCountdown.isRunning}
            onClick={handleGet}
            className="shrink-0"
          >
            {newCountdown.isRunning ? `${newCountdown.count}s` : t('changePhoneSendCode')}
          </Button>
        </div>

        <Button className="w-full" disabled={!canSubmitNew || submitting} onClick={onSubmit}>
          {submitting ? t('changePhoneSubmitting') : t('changePhoneSubmit')}
        </Button>
      </CardContent>
    </Card>
  )
}
