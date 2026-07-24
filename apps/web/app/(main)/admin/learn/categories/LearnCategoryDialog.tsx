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
  TreeSelect,
} from '@ihui/ui-react'
import type { TreeNode } from '@ihui/ui-react'
import type { Category, CategoryForm } from './types'

interface Props {
  open: boolean
  editing: Category | null
  form: CategoryForm
  setForm: React.Dispatch<React.SetStateAction<CategoryForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  categories: Category[]
}

export function LearnCategoryDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
  categories,
}: Props) {
  const t = useTranslations('admin.learn')
  const treeData = React.useMemo<TreeNode[]>(
    () => categories.map((c) => ({ id: c.id, label: c.name, pid: c.pid })),
    [categories],
  )
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
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label>{t('fieldParent')}</Label>
            <TreeSelect
              value={form.pid || null}
              onChange={(v) => setForm({ ...form, pid: v ?? '' })}
              data={treeData}
              placeholder={t('rootCategory')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-name">{t('fieldName')}</Label>
            <Input
              id="cat-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('namePlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cat-sort">{t('fieldSort')}</Label>
              <Input
                id="cat-sort"
                type="number"
                min="0"
                value={form.sort}
                onChange={(e) => setForm({ ...form, sort: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-status">{t('fieldStatus')}</Label>
              <div className="flex h-9 items-center gap-2">
                <Switch
                  id="cat-status"
                  checked={form.status}
                  onCheckedChange={(v) => setForm({ ...form, status: v })}
                />
                <span className="text-sm text-muted-foreground">
                  {form.status ? t('enabled') : t('disabled')}
                </span>
              </div>
            </div>
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
