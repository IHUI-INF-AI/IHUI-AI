'use client'

import * as React from 'react'
import { type UseFormReturn } from 'react-hook-form'
import { Loader2, Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Input, Label } from '@ihui/ui'
import { cn } from '@/lib/utils'
import type { ProfileForm } from './types'

interface Props {
  form: UseFormReturn<ProfileForm>
  onSubmit: (values: ProfileForm) => void | Promise<void>
  isSubmitting: boolean
  saved: boolean
  errorMsg: string
  phone: string
}

const GENDER_OPTIONS = [
  { value: 0, key: 'unknown' },
  { value: 1, key: 'male' },
  { value: 2, key: 'female' },
] as const

export function ProfileEditForm({ form, onSubmit, isSubmitting, saved, errorMsg, phone }: Props) {
  const t = useTranslations('user.profile')
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="nickname">{t('nickname')}</Label>
        <Input id="nickname" {...register('nickname')} placeholder={t('nicknamePlaceholder')} />
        {errors.nickname && <p className="text-xs text-destructive">{t('nicknameError')}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">{t('phone')}</Label>
        <Input id="phone" value={phone} readOnly disabled className="bg-muted/50" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">{t('email')}</Label>
        <Input id="email" type="email" {...register('email')} placeholder={t('emailPlaceholder')} />
        {errors.email && <p className="text-xs text-destructive">{t('emailError')}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bio">{t('bio')}</Label>
        <textarea
          id="bio"
          {...register('bio')}
          rows={3}
          placeholder={t('bioPlaceholder')}
          className={cn(
            'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors',
            'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        />
        {errors.bio && <p className="text-xs text-destructive">{t('bioError')}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="gender">{t('gender')}</Label>
        <select
          id="gender"
          {...form.register('gender', { valueAsNumber: true })}
          className={cn(
            'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          )}
        >
          {GENDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(`gender_${opt.key}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              {t('saving')}
            </>
          ) : (
            t('save')
          )}
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-500">
            <Check className="h-4 w-4" />
            {t('saved')}
          </span>
        )}
        {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}
      </div>
    </form>
  )
}
