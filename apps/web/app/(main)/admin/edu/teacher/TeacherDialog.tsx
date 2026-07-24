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
} from '@ihui/ui-react'
import { useTranslations } from 'next-intl'
import type { Teacher, TForm } from './types'

interface Props {
  open: boolean
  editing: Teacher | null
  form: TForm
  onFormChange: (patch: Partial<TForm>) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  pending: boolean
  err: string | null
}

export function TeacherDialog({
  open,
  editing,
  form,
  onFormChange,
  onClose,
  onSubmit,
  pending,
  err,
}: Props) {
  const t = useTranslations('admin.edu.teacher')
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="t-nick">{t('fieldNickname')}</Label>
              <Input
                id="t-nick"
                value={form.nickname}
                onChange={(e) => onFormChange({ nickname: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-phone">{t('fieldPhone')}</Label>
              <Input
                id="t-phone"
                value={form.phone}
                onChange={(e) => onFormChange({ phone: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-title">{t('fieldTitle')}</Label>
            <Input
              id="t-title"
              value={form.title}
              onChange={(e) => onFormChange({ title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-intro">{t('fieldIntro')}</Label>
            <Input
              id="t-intro"
              value={form.intro}
              onChange={(e) => onFormChange({ intro: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-status">{t('fieldStatus')}</Label>
            <Select
              value={String(form.status)}
              onValueChange={(v) => onFormChange({ status: Number(v) })}
            >
              <SelectTrigger className={selectClass} id="t-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{t('statusActive')}</SelectItem>
                <SelectItem value="0">{t('statusInactive')}</SelectItem>
              </SelectContent>
            </Select>
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
