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
} from '@ihui/ui'
import { selectClass, textareaClass, TYPES } from './helpers'
import type { EduSetting, EduSettingForm, CfgType } from './types'

interface Props {
  open: boolean
  editing: EduSetting | null
  form: EduSettingForm
  setForm: React.Dispatch<React.SetStateAction<EduSettingForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function EduSettingsDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.eduSettings')
  const tc = useTranslations('common')
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="s-group">{t('fieldGroup')}</Label>
              <Input
                id="s-group"
                value={form.group}
                onChange={(e) => setForm({ ...form, group: e.target.value })}
                placeholder="site / seo / watermark"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-key">{t('fieldKey')}</Label>
              <Input
                id="s-key"
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                placeholder="site_name"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-value">{t('fieldValue')}</Label>
            <textarea
              id="s-value"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              placeholder={t('valuePlaceholder')}
              rows={3}
              className={textareaClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="s-type">{t('fieldType')}</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as CfgType })}
              >
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((tp) => (
                    <SelectItem key={tp} value={tp}>
                      {tp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-sort">{t('fieldSort')}</Label>
              <Input
                id="s-sort"
                type="number"
                value={form.sort}
                onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-cred">{t('fieldCredentials')}</Label>
            <textarea
              id="s-cred"
              value={form.credentialsJson}
              onChange={(e) => setForm({ ...form, credentialsJson: e.target.value })}
              rows={3}
              className={textareaClass}
              placeholder='{"apiKey":"","secret":""}'
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-desc">{t('fieldDescription')}</Label>
            <Input
              id="s-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('descriptionPlaceholder')}
            />
          </div>
          <div className="flex gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isPublic}
                onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
                className="h-4 w-4 accent-primary"
              />
              {t('fieldPublic')}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.status === 1}
                onChange={(e) => setForm({ ...form, status: e.target.checked ? 1 : 0 })}
                className="h-4 w-4 accent-primary"
              />
              {t('fieldEnabled')}
            </label>
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
