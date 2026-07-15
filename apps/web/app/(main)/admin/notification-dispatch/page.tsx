'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Bell } from 'lucide-react'

import { fetchApi } from '@/lib/api'

import { DispatchFormView } from './DispatchFormView'
import { DispatchResultView } from './DispatchResultView'
import { EMPTY_FORM, parseUserIds } from './helpers'
import type { DispatchForm, DispatchResult } from './types'

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Bell className="h-6 w-6 text-primary" />
          {t('nd.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('nd.subtitle')}</p>
      </div>

      <DispatchFormView form={form} submitting={sendMut.isPending} onChange={setForm} onSubmit={submit} />

      {result && <DispatchResultView result={result} />}
    </div>
  )
}
