'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Switch,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui-react'
import { selectClass } from './helpers'
import type { Channel, Rule, RuleForm } from './types'

interface Props {
  open: boolean
  editing: Rule | null
  form: RuleForm
  setForm: React.Dispatch<React.SetStateAction<RuleForm>>
  err: string | null
  savePending: boolean
  channels: Channel[]
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function RuleDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  channels,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.point')
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
            <DialogTitle>{editing ? t('rulesEditTitle') : t('rulesCreateTitle')}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="rule-name">{t('fieldName')}</Label>
            <Input
              id="rule-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('namePlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="rule-code">{t('fieldCode')}</Label>
              <Input
                id="rule-code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder={t('codePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-channel">{t('fieldChannel')}</Label>
              <Select
                value={form.channelId || 'none'}
                onValueChange={(v) => setForm({ ...form, channelId: v === 'none' ? '' : v })}
              >
                <SelectTrigger className={selectClass} id="rule-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('noChannel')}</SelectItem>
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="rule-point">{t('colPoint')}</Label>
              <Input
                id="rule-point"
                type="number"
                value={form.point}
                onChange={(e) => setForm({ ...form, point: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-sort">{t('fieldSort')}</Label>
              <Input
                id="rule-sort"
                type="number"
                min="0"
                value={form.sort}
                onChange={(e) => setForm({ ...form, sort: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-status">{t('fieldStatus')}</Label>
              <div className="flex h-9 items-center gap-2">
                <Switch
                  id="rule-status"
                  checked={form.status}
                  onCheckedChange={(v) => setForm({ ...form, status: v })}
                />
                <span className="text-sm text-muted-foreground">
                  {form.status ? t('enabled') : t('disabled')}
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rule-desc">{t('fieldDescription')}</Label>
            <Input
              id="rule-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('descriptionPlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              {t('cancel')}
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
