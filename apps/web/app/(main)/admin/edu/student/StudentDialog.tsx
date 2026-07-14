'use client'
import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { selectClass } from '@/lib/edu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { useTranslations } from 'next-intl'
import { LEVEL_MAP } from './helpers'
import type { Student, SForm } from './types'

interface Props {
  open: boolean
  editing: Student | null
  form: SForm
  onFormChange: (patch: Partial<SForm>) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  pending: boolean
  err: string | null
}

export function StudentDialog({
  open,
  editing,
  form,
  onFormChange,
  onClose,
  onSubmit,
  pending,
  err,
}: Props) {
  const t = useTranslations('admin.edu.student')
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="s-nick">{t('fieldNickname')}</Label>
            <Input
              id="s-nick"
              value={form.nickname}
              onChange={(e) => onFormChange({ nickname: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="s-phone">{t('fieldPhone')}</Label>
              <Input
                id="s-phone"
                value={form.phone}
                onChange={(e) => onFormChange({ phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-email">{t('fieldEmail')}</Label>
              <Input
                id="s-email"
                value={form.email}
                onChange={(e) => onFormChange({ email: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="s-level">{t('fieldLevel')}</Label>
              <Select value={form.level} onValueChange={(v) => onFormChange({ level: v })}>
                <SelectTrigger className={selectClass} id="s-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LEVEL_MAP).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {t(`level.${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-status">{t('fieldStatus')}</Label>
              <Select
                value={String(form.status)}
                onValueChange={(v) => onFormChange({ status: Number(v) })}
              >
                <SelectTrigger className={selectClass} id="s-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t('statusActive')}</SelectItem>
                  <SelectItem value="0">{t('statusDisabled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
