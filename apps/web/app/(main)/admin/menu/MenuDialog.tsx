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
  DialogFooter,
} from '@ihui/ui-react'
import { Select } from '@/components/form'
import type { MenuItem, MenuForm } from './types'

interface Props {
  open: boolean
  editing: MenuItem | null
  form: MenuForm
  setForm: React.Dispatch<React.SetStateAction<MenuForm>>
  list: MenuItem[]
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function MenuDialog({
  open,
  editing,
  form,
  setForm,
  list,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.menu')
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
          <div className="space-y-2">
            <Label htmlFor="m-name">{t('labelName')}</Label>
            <Input
              id="m-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('placeholderName')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="m-icon">{t('labelIcon')}</Label>
              <Input
                id="m-icon"
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                placeholder={t('placeholderIcon')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-sort">{t('labelSort')}</Label>
              <Input
                id="m-sort"
                type="number"
                value={form.sort}
                onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-path">{t('labelPath')}</Label>
            <Input
              id="m-path"
              value={form.path}
              onChange={(e) => setForm({ ...form, path: e.target.value })}
              placeholder="/admin/menu"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-parent">{t('labelParent')}</Label>
            <Select
              options={[
                { label: t('topMenu'), value: '' },
                ...list
                  .filter((m) => m.id !== editing?.id)
                  .map((m) => ({ label: m.name, value: m.id })),
              ]}
              value={form.parentId ?? ''}
              onChange={(v) => setForm({ ...form, parentId: (v as string) || null })}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.visible}
              onChange={(e) => setForm({ ...form, visible: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
            {t('labelVisible')}
          </label>
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
