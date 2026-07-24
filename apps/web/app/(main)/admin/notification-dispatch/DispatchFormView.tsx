'use client'

import { useTranslations } from 'next-intl'
import { Loader2, Send } from 'lucide-react'

import { Button, Input, Label, Checkbox } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

import {
  ROLES,
  CHANNELS,
  MSG_TYPES,
  TARGET_MODES,
  textareaCls,
  selectClass,
} from './helpers'
import type { DispatchForm, NotificationChannel } from './types'

interface Props {
  form: DispatchForm
  submitting: boolean
  onChange: (f: DispatchForm) => void
  onSubmit: (e: React.FormEvent) => void
}

export function DispatchFormView({ form, submitting, onChange, onSubmit }: Props) {
  const t = useTranslations('adminTools')

  function toggleRole(role: string) {
    onChange({
      ...form,
      roleFilter: form.roleFilter.includes(role)
        ? form.roleFilter.filter((r) => r !== role)
        : [...form.roleFilter, role],
    })
  }

  function toggleChannel(ch: NotificationChannel) {
    onChange({
      ...form,
      channels: form.channels.includes(ch)
        ? form.channels.filter((c) => c !== ch)
        : [...form.channels, ch],
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <Label htmlFor="nd-title">{t('nd.fieldTitle')}</Label>
        <Input
          id="nd-title"
          maxLength={255}
          value={form.title}
          onChange={(e) => onChange({ ...form, title: e.target.value })}
          placeholder={t('nd.titlePlaceholder')}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nd-content">{t('nd.fieldContent')}</Label>
        <textarea
          id="nd-content"
          rows={4}
          maxLength={5000}
          value={form.content}
          onChange={(e) => onChange({ ...form, content: e.target.value })}
          className={textareaCls}
          placeholder={t('nd.contentPlaceholder')}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('nd.fieldTargetMode')}</Label>
        <div className="flex gap-2">
          {TARGET_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ ...form, targetMode: m })}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                form.targetMode === m
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {t(`nd.targetMode_${m}`)}
            </button>
          ))}
        </div>
      </div>

      {form.targetMode === 'userIds' ? (
        <div className="space-y-2">
          <Label htmlFor="nd-uids">{t('nd.fieldUserIds')}</Label>
          <textarea
            id="nd-uids"
            rows={4}
            value={form.userIdsText}
            onChange={(e) => onChange({ ...form, userIdsText: e.target.value })}
            className={textareaCls}
            placeholder={t('nd.userIdsPlaceholder')}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label>{t('nd.fieldRoleFilter')}</Label>
          <div className="flex flex-wrap gap-4">
            {ROLES.map((role) => (
              <label key={role} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={form.roleFilter.includes(role)}
                  onCheckedChange={() => toggleRole(role)}
                />
                {role}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>{t('nd.fieldChannels')}</Label>
        <div className="flex flex-wrap gap-4">
          {CHANNELS.map((ch) => (
            <label key={ch} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={form.channels.includes(ch)}
                onCheckedChange={() => toggleChannel(ch)}
              />
              {t(`nd.channel_${ch}`)}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nd-msgtype">{t('nd.fieldMsgType')}</Label>
        <select
          id="nd-msgtype"
          value={form.msgType}
          onChange={(e) => onChange({ ...form, msgType: e.target.value as DispatchForm['msgType'] })}
          className={selectClass}
        >
          {MSG_TYPES.map((m) => (
            <option key={m} value={m}>
              {t(`nd.msgType_${m}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? t('nd.sending') : t('nd.send')}
        </Button>
      </div>
    </form>
  )
}
