// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
} from '@ihui/ui-react'
import { sendMaintenanceNoticeEmail } from '@ihui/api-client'
import type { MaintenanceNoticeEmailResult } from '@ihui/api-client'

interface Props {
  open: boolean
  onClose: () => void
}

interface NoticeForm {
  window: string
  scope: string
  downtime: string
  dryRun: boolean
  limit: string
}

const EMPTY: NoticeForm = {
  window: '',
  scope: '',
  downtime: '',
  dryRun: false,
  limit: '',
}

export function MaintenanceNoticeDialog({ open, onClose }: Props) {
  const t = useTranslations('admin.announcements.maintenanceNotice')
  const tc = useTranslations('common')
  const [form, setForm] = React.useState<NoticeForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<MaintenanceNoticeEmailResult | null>(null)

  const sendMut = useMutation({
    mutationFn: async () => {
      const limitNum = form.limit.trim() === '' ? undefined : Number(form.limit)
      const r = await sendMaintenanceNoticeEmail({
        window: form.window.trim(),
        scope: form.scope.trim(),
        downtime: form.downtime.trim(),
        dryRun: form.dryRun,
        limit: limitNum,
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (data) => {
      setErr(null)
      setResult(data)
    },
    onError: (e: Error) => {
      setResult(null)
      setErr(e.message)
    },
  })

  function close() {
    if (sendMut.isPending) return
    setResult(null)
    setErr(null)
    onClose()
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.window.trim() || !form.scope.trim() || !form.downtime.trim()) {
      setErr(t('required'))
      return
    }
    if (form.limit.trim() !== '' && !Number.isInteger(Number(form.limit))) {
      setErr(t('limitInvalid'))
      return
    }
    sendMut.mutate()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close()
      }}
    >
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('desc')}</DialogDescription>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          {result && (
            <div className="rounded-md bg-muted px-3 py-2 text-sm text-foreground">
              {result.dryRun
                ? t('resultDryRun', { total: result.total, subject: result.subject })
                : t('resultSent', {
                    sent: result.stats?.sent ?? 0,
                    failed: result.stats?.failed ?? 0,
                    stubbed: result.stats?.stubbed ?? 0,
                  })}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="mn-window">{t('fieldWindow')}</Label>
            <Input
              id="mn-window"
              value={form.window}
              onChange={(e) => setForm({ ...form, window: e.target.value })}
              placeholder={t('windowPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mn-scope">{t('fieldScope')}</Label>
            <Input
              id="mn-scope"
              value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value })}
              placeholder={t('scopePlaceholder')}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 min-[768px]:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mn-downtime">{t('fieldDowntime')}</Label>
              <Input
                id="mn-downtime"
                value={form.downtime}
                onChange={(e) => setForm({ ...form, downtime: e.target.value })}
                placeholder={t('downtimePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mn-limit">{t('fieldLimit')}</Label>
              <Input
                id="mn-limit"
                type="number"
                min={1}
                step="any"
                value={form.limit}
                onChange={(e) => setForm({ ...form, limit: e.target.value })}
                placeholder={t('limitPlaceholder')}
              />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.dryRun}
              onChange={(e) => setForm({ ...form, dryRun: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
            {t('dryRun')}
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={sendMut.isPending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={sendMut.isPending}>
              {sendMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('send')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
