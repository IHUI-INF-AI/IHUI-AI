'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'
import { CATEGORIES, selectClass } from './helpers'
import type { SensitiveWord, SensitiveWordForm } from './types'

interface Props {
  open: boolean
  editing: SensitiveWord | null
  form: SensitiveWordForm
  setForm: React.Dispatch<React.SetStateAction<SensitiveWordForm>>
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function SensitiveWordDialog({
  open,
  editing,
  form,
  setForm,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.sensitiveWords')
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
            <DialogTitle>{editing ? '编辑敏感词' : '新增敏感词'}</DialogTitle>
            <DialogDescription>{editing ? '修改敏感词信息' : '添加新的敏感词'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="sw-word">{t('colWord')}</Label>
            <Input
              id="sw-word"
              value={form.word}
              onChange={(e) => setForm({ ...form, word: e.target.value })}
              placeholder="请输入敏感词"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sw-category">{t('colCategory')}</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sw-level">{t('colLevel')}</Label>
              <Select
                value={String(form.level)}
                onValueChange={(v) => setForm({ ...form, level: Number(v) })}
              >
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t('levelReplace')}</SelectItem>
                  <SelectItem value="2">{t('levelBlock')}</SelectItem>
                  <SelectItem value="3">{t('levelBan')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sw-replacement">替换文本</Label>
            <Input
              id="sw-replacement"
              value={form.replacement}
              onChange={(e) => setForm({ ...form, replacement: e.target.value })}
              placeholder="默认 ***"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sw-status">{t('colStatus')}</Label>
            <Select
              value={String(form.status)}
              onValueChange={(v) => setForm({ ...form, status: Number(v) })}
            >
              <SelectTrigger className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{t('enabled')}</SelectItem>
                <SelectItem value="0">{t('disabled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
