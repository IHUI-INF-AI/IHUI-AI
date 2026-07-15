'use client'

import { Phone } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@ihui/ui'
import { Input } from '@/components/form'
import { useCountdown } from '@/hooks/use-countdown'
import { CODE_LENGTH, COUNTDOWN_SECONDS, maskPhone } from './helpers'

interface Props {
  t: (k: string) => string
  currentPhone: string
  isProfileLoading: boolean
  oldCode: string
  onOldCodeChange: (v: string) => void
  onVerify: () => void
  onGetOldCode: () => Promise<void>
}

export function Step1PhoneVerify({
  t,
  currentPhone,
  isProfileLoading,
  oldCode,
  onOldCodeChange,
  onVerify,
  onGetOldCode,
}: Props) {
  const oldCountdown = useCountdown(COUNTDOWN_SECONDS)
  const masked = maskPhone(currentPhone)
  const canVerifyOld = oldCode.trim().length === CODE_LENGTH

  const handleGet = async () => {
    await onGetOldCode()
    oldCountdown.start()
  }

  return (
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
          <p className="mt-0.5 font-mono text-sm font-medium">
            {isProfileLoading ? '加载中...' : masked}
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder={t('changePhoneOldCodePlaceholder')}
            maxLength={CODE_LENGTH}
            value={oldCode}
            onChange={(e) => onOldCodeChange(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            className="flex-1"
          />
          <Button
            variant="outline"
            size="default"
            disabled={oldCountdown.isRunning}
            onClick={handleGet}
            className="shrink-0"
          >
            {oldCountdown.isRunning ? `${oldCountdown.count}s` : t('changePhoneSendCode')}
          </Button>
        </div>

        <Button className="w-full" disabled={!canVerifyOld} onClick={onVerify}>
          {t('changePhoneNextStep')}
        </Button>
      </CardContent>
    </Card>
  )
}
