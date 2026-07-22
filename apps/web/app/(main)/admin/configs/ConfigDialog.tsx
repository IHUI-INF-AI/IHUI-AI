'use client'

import * as React from 'react'
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
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Switch,
} from '@ihui/ui'
import { Radio, Textarea } from '@/components/form'
import { CATEGORIES, TYPES, selectClass } from './helpers'
import type { Category, CfgType, Config, ConfigForm } from './types'

interface Props {
  open: boolean
  editing: Config | null
  form: ConfigForm
  setForm: React.Dispatch<React.SetStateAction<ConfigForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function ConfigDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.configs')
  const tc = useTranslations('common')
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
            <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
            <DialogDescription>{t('createDesc')}</DialogDescription>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="c-key">{t('fieldKey')}</Label>
            <Input
              id="c-key"
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
              placeholder={t('keyPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-value">{t('fieldValue')}</Label>
            <Textarea
              id="c-value"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              placeholder={t('valuePlaceholder')}
              rows={4}
              className="font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="c-type">{t('fieldType')}</Label>
              <Radio
                inline
                options={TYPES.map((tp) => ({ label: tp, value: tp }))}
                value={form.type}
                onChange={(v) => setForm({ ...form, type: v as CfgType })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-cat">{t('fieldCategory')}</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v as Category })}
              >
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`categories.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-desc">{t('fieldDescription')}</Label>
            <Input
              id="c-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('descriptionPlaceholder')}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.isPublic} onCheckedChange={(v) => setForm({ ...form, isPublic: v })} />
            <span className="text-sm">{t('fieldPublic')}</span>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
