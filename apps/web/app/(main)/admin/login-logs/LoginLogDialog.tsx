'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui-react'
import { DatePicker } from '@/components/form/DatePicker'
import type { LoginLog, LoginLogForm } from './types'

interface Props {
  open: boolean
  editing: LoginLog | null
  form: LoginLogForm
  setForm: React.Dispatch<React.SetStateAction<LoginLogForm>>
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function LoginLogDialog({
  open,
  editing,
  form,
  setForm,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.loginLogs')
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? t('dialogEditTitle') : t('dialogCreateTitle')}</DialogTitle>
            <DialogDescription>{editing ? t('descEdit') : t('descCreate')}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('fieldUserUuid')}</Label>
              <Input
                value={form.userUuid}
                onChange={(e) => setForm({ ...form, userUuid: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('fieldLoginType')}</Label>
              <Input
                value={form.loginType}
                onChange={(e) => setForm({ ...form, loginType: e.target.value })}
                placeholder="sms/password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('fieldPlatform')}</Label>
              <Input
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>IP</Label>
              <Input value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('fieldLocation')}</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <DatePicker
              label={t('fieldLoginTime')}
              value={form.loginTime}
              onChange={(v) => setForm({ ...form, loginTime: v })}
            />
            <div className="col-span-2 space-y-1.5">
              <Label>UserAgent</Label>
              <Input
                value={form.userAgent}
                onChange={(e) => setForm({ ...form, userAgent: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>{t('fieldMessage')}</Label>
              <Input
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
