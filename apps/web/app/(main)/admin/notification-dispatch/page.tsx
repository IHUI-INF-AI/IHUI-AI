'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Bell, Loader2, Send } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Input, Label, Checkbox } from '@ihui/ui'
import { cn } from '@/lib/utils'

import type {
  DispatchForm,
  DispatchResult,
  MsgType,
  NotificationChannel,
  TargetMode,
} from './types'

const ROLES = ['admin', 'teacher', 'student', 'user'] as const
const CHANNELS: NotificationChannel[] = ['in_app', 'email', 'sms']
const MSG_TYPES: MsgType[] = ['system', 'order', 'project', 'comment', 'mention', 'follow']

const EMPTY_FORM: DispatchForm = {
  title: '',
  content: '',
  targetMode: 'roleFilter',
  userIdsText: '',
  roleFilter: [],
  channels: ['in_app'],
  msgType: 'system',
}

const textareaCls =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const parseUserIds = (text: string): string[] =>
  text
    .split(/[\n,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)

export default function NotificationDispatchPage() {
  const t = useTranslations('adminTools')
  const [form, setForm] = React.useState<DispatchForm>(EMPTY_FORM)
  const [result, setResult] = React.useState<DispatchResult | null>(null)

  const sendMut = useMutation({
    mutationFn: async () => {
      const userIds = form.targetMode === 'userIds' ? parseUserIds(form.userIdsText) : null
      const roleFilter = form.targetMode === 'roleFilter' ? form.roleFilter : null
      const r = await fetchApi<DispatchResult>('/api/admin/notifications/send-targeted', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          content: form.content.trim(),
          userIds,
          roleFilter,
          channels: form.channels,
          msgType: form.msgType,
        }),
      })
      if (!r.success) throw r
      return r.data
    },
    onSuccess: (data) => {
      setResult(data)
      toast.success(t('nd.sendSuccess'))
    },
    onError: (err: unknown) => {
      const e = err as { error?: string; status?: number; retryAfter?: number }
      if (e?.status === 429) {
        toast.error(
          e.retryAfter ? t('nd.retryAfterSeconds', { seconds: e.retryAfter }) : t('nd.rateLimited'),
        )
      } else {
        toast.error(e?.error || t('nd.sendFailed'))
      }
    },
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const validTarget =
      form.targetMode === 'userIds'
        ? parseUserIds(form.userIdsText).length > 0
        : form.roleFilter.length > 0
    if (!form.title.trim() || !form.content.trim() || !form.channels.length || !validTarget) {
      toast.error(t('nd.required'))
      return
    }
    setResult(null)
    sendMut.mutate()
  }

  function toggleRole(role: string) {
    setForm((f) => ({
      ...f,
      roleFilter: f.roleFilter.includes(role)
        ? f.roleFilter.filter((r) => r !== role)
        : [...f.roleFilter, role],
    }))
  }

  function toggleChannel(ch: NotificationChannel) {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(ch) ? f.channels.filter((c) => c !== ch) : [...f.channels, ch],
    }))
  }

  const stats = result
    ? [
        { key: 'sent', value: result.sent, cls: 'bg-emerald-500/10 text-emerald-600' },
        { key: 'failed', value: result.failed, cls: 'bg-red-500/10 text-red-600' },
        { key: 'skipped', value: result.skipped, cls: 'bg-muted text-muted-foreground' },
        { key: 'queued', value: result.queued, cls: 'bg-amber-500/10 text-amber-600' },
      ]
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Bell className="h-6 w-6 text-primary" />
          {t('nd.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('nd.subtitle')}</p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-lg border p-4">
        <div className="space-y-2">
          <Label htmlFor="nd-title">{t('nd.fieldTitle')}</Label>
          <Input
            id="nd-title"
            maxLength={255}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
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
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            className={textareaCls}
            placeholder={t('nd.contentPlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <Label>{t('nd.fieldTargetMode')}</Label>
          <div className="flex gap-2">
            {(['userIds', 'roleFilter'] as TargetMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setForm({ ...form, targetMode: m })}
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
              onChange={(e) => setForm({ ...form, userIdsText: e.target.value })}
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
            onChange={(e) => setForm({ ...form, msgType: e.target.value as MsgType })}
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
          <Button type="submit" disabled={sendMut.isPending}>
            {sendMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {sendMut.isPending ? t('nd.sending') : t('nd.send')}
          </Button>
        </div>
      </form>

      {result && (
        <div className="rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-medium">{t('nd.resultTitle')}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.key} className={cn('rounded-md px-3 py-2', s.cls)}>
                <div className="text-xs opacity-80">{t(`nd.result_${s.key}`)}</div>
                <div className="text-xl font-bold">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
