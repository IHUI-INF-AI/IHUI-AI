'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Lock, Loader2 } from 'lucide-react'
import { Button, Input, Label } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import type { FormMsg } from './types'

interface Props {
  pwMsg: FormMsg
  pwLoading: boolean
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
}

export function PasswordSection({ pwMsg, pwLoading, onSubmit }: Props) {
  const t = useTranslations('user.security')
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{t('password')}</h2>
      </div>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="current">{t('currentPassword')}</Label>
          <Input id="current" name="current" type="password" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new">{t('newPassword')}</Label>
          <Input
            id="new"
            name="new"
            type="password"
            required
            minLength={6}
            maxLength={20}
            pattern={'^[^<>"\'|\\\\]+$'}
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground">{t('passwordHint')}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">{t('confirmPassword')}</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            required
            minLength={6}
            maxLength={20}
            autoComplete="new-password"
          />
        </div>
        {pwMsg && (
          <p
            className={cn(
              'text-xs',
              pwMsg.type === 'ok' ? 'text-emerald-600 dark:text-emerald-500' : 'text-destructive',
            )}
          >
            {pwMsg.text}
          </p>
        )}
        <Button type="submit" disabled={pwLoading}>
          {pwLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          {t('updatePassword')}
        </Button>
      </form>
    </section>
  )
}
