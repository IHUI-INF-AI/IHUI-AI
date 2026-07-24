'use client'
import * as React from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
} from '@ihui/ui-react'
import { useTranslations } from 'next-intl'
import type { Level, LForm } from './types'

interface Props {
  open: boolean
  editing: Level | null
  form: LForm
  onFormChange: (patch: Partial<LForm>) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  pending: boolean
  err: string | null
}

export function LevelDialog({
  open,
  editing,
  form,
  onFormChange,
  onClose,
  onSubmit,
  pending,
  err,
}: Props) {
  const t = useTranslations('admin.edu.student.levels')
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? t('editLevel') : t('createLevel')}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="lv-name">{t('name')}</Label>
            <Input
              id="lv-name"
              value={form.name}
              onChange={(e) => onFormChange({ name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="lv-level">{t('levelNumber')}</Label>
              <Input
                id="lv-level"
                type="number"
                min="1"
                value={form.level}
                onChange={(e) => onFormChange({ level: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lv-discount">{t('discount')}</Label>
              <Input
                id="lv-discount"
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={form.discount}
                onChange={(e) => onFormChange({ discount: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="lv-min">{t('minScore')}</Label>
              <Input
                id="lv-min"
                type="number"
                min="0"
                value={form.minScore}
                onChange={(e) => onFormChange({ minScore: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lv-max">{t('maxScore')}</Label>
              <Input
                id="lv-max"
                type="number"
                min="0"
                value={form.maxScore}
                onChange={(e) => onFormChange({ maxScore: e.target.value })}
              />
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
