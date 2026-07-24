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
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Switch,
} from '@ihui/ui-react'
import { STATUS_OPTIONS, selectClassLg } from './helpers'
import type { AgentForm, Category } from './types'

const textareaCls =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

interface AgentEditDialogProps {
  open: boolean
  form: AgentForm
  err: string | null
  isPending: boolean
  categories: Category[]
  onFormChange: (form: AgentForm) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

export function AgentEditDialog({
  open,
  form,
  err,
  isPending,
  categories,
  onFormChange,
  onClose,
  onSubmit,
}: AgentEditDialogProps) {
  const t = useTranslations('admin.agents')
  const tc = useTranslations('common')

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('editTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ed-name">
              {t('fieldName')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ed-name"
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ed-desc">{t('fieldDescription')}</Label>
            <textarea
              id="ed-desc"
              value={form.description}
              onChange={(e) => onFormChange({ ...form, description: e.target.value })}
              rows={3}
              className={textareaCls}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ed-avatar">{t('fieldAvatar')}</Label>
              <Input
                id="ed-avatar"
                value={form.avatar}
                onChange={(e) => onFormChange({ ...form, avatar: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ed-cover">{t('fieldCover')}</Label>
              <Input
                id="ed-cover"
                value={form.cover}
                onChange={(e) => onFormChange({ ...form, cover: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ed-cat">{t('fieldCategory')}</Label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => onFormChange({ ...form, categoryId: v })}
              >
                <SelectTrigger className={selectClassLg} id="ed-cat">
                  <SelectValue placeholder={t('fieldCategoryPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.categoryId} value={c.categoryId}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ed-status">{t('fieldStatus')}</Label>
              <Select
                value={form.status}
                onValueChange={(v) => onFormChange({ ...form, status: v })}
              >
                <SelectTrigger className={selectClassLg} id="ed-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`status${s.charAt(0).toUpperCase()}${s.slice(1)}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="ed-price">{t('fieldPrice')}</Label>
              <Input
                id="ed-price"
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => onFormChange({ ...form, price: e.target.value })}
                disabled={form.isFree}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ed-sort">{t('fieldSort')}</Label>
              <Input
                id="ed-sort"
                type="number"
                min={0}
                value={form.sort}
                onChange={(e) => onFormChange({ ...form, sort: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <Switch
                  id="ed-free"
                  checked={form.isFree}
                  onCheckedChange={(v) => onFormChange({ ...form, isFree: v })}
                />
                <Label htmlFor="ed-free" className="cursor-pointer">
                  {t('fieldIsFree')}
                </Label>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ed-remark">{tc('remark')}</Label>
            <textarea
              id="ed-remark"
              value={form.remark}
              onChange={(e) => onFormChange({ ...form, remark: e.target.value })}
              rows={2}
              className={textareaCls}
            />
          </div>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
