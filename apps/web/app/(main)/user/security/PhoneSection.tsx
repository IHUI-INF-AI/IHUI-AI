'use client'

import { useTranslations } from 'next-intl'
import { Smartphone, Loader2 } from 'lucide-react'
import { Button, Input, Label } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { maskPhone } from './helpers'
import type { FormMsg } from './types'

interface Props {
  phone: string | undefined
  newPhone: string
  setNewPhone: (v: string) => void
  phoneCode: string
  setPhoneCode: (v: string) => void
  phoneMsg: FormMsg
  codeCountdown: number
  sendingCode: boolean
  phoneLoading: boolean
  onSendCode: () => void
  onChangePhone: () => void
}

export function PhoneSection({
  phone,
  newPhone,
  setNewPhone,
  phoneCode,
  setPhoneCode,
  phoneMsg,
  codeCountdown,
  sendingCode,
  phoneLoading,
  onSendCode,
  onChangePhone,
}: Props) {
  const t = useTranslations('user.security')
  return (
    <section className="space-y-4 border-t pt-6">
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{t('phone')}</h2>
      </div>
      {phone ? (
        <p className="text-sm text-muted-foreground">
          {t('phoneBound', { phone: maskPhone(phone) })}
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
          <p
            className={cn(
              'text-xs',
              phoneMsg.type === 'ok'
                ? 'text-emerald-600 dark:text-emerald-500'
                : 'text-destructive',
            )}
          >
            {phoneMsg.text}
          </p>
        )}
        <Button type="button" disabled={phoneLoading} onClick={onChangePhone}>
          {phoneLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          {t('changePhone')}
        </Button>
      </div>
    </section>
  )
}
