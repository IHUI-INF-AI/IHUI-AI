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
} from '@ihui/ui-react'
import { inputClass, selectClass, SCOPES } from './helpers'
import type { Role, RoleForm } from './types'

interface Props {
  mode: 'create' | 'edit' | null
  form: RoleForm
  setForm: React.Dispatch<React.SetStateAction<RoleForm>>
  formErr: string | null
  saving: boolean
  delTarget: Role | null
  deletePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
}

export function RoleDialog({
  mode,
  form,
  setForm,
  formErr,
  saving,
  delTarget,
  deletePending,
  onSubmit,
  onClose,
  onDeleteConfirm,
  onDeleteCancel,
}: Props) {
  const t = useTranslations('admin.roles')
  const tc = useTranslations('common')
  return (
    <>
      <Dialog
        open={mode !== null}
        onOpenChange={(o) => {
          if (!o) onClose()
        }}
      >
        <DialogContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{mode === 'edit' ? t('edit') : t('add')}</DialogTitle>
              <DialogDescription>{t('subtitle')}</DialogDescription>
            </DialogHeader>
            {formErr && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formErr}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="r-name">{t('name')}</Label>
              <Input
                id="r-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('namePlaceholder')}
                disabled={mode === 'edit'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-display">{t('displayName')}</Label>
              <Input
                id="r-display"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder={t('namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-desc">{t('description')}</Label>
              <textarea
                id="r-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('descPlaceholder')}
                rows={2}
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-scope">{t('scope')}</Label>
              <Select
                value={form.scope}
                onValueChange={(v) => setForm({ ...form, scope: v as typeof form.scope })}
              >
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`scopes.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {t('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!delTarget}
        onOpenChange={(o) => {
          if (!o) onDeleteCancel()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>{t('deleteDesc')}</DialogDescription>
          </DialogHeader>
          {formErr && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formErr}
            </div>
          )}
          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
            <span className="font-medium">{delTarget?.displayName}</span>
            <span className="ml-2 text-xs text-muted-foreground">{delTarget?.name}</span>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onDeleteCancel}
              disabled={deletePending}
            >
              {tc('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletePending}
              onClick={onDeleteConfirm}
            >
              {deletePending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
