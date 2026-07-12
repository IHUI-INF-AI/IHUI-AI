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
  Switch,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui'
import { selectClass } from './helpers'
import type { Product, ProductForm, Resource } from './types'

interface Props {
  open: boolean
  editing: Product | null
  form: ProductForm
  setForm: React.Dispatch<React.SetStateAction<ProductForm>>
  err: string | null
  savePending: boolean
  resources: Resource[]
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function ProductDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  resources,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.resources')
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-xl">
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
            <Label htmlFor="prod-resource">{t('fieldResource')}</Label>
            <Select
              value={form.resourceId || 'none'}
              onValueChange={(v) => setForm({ ...form, resourceId: v === 'none' ? '' : v })}
            >
              <SelectTrigger className={selectClass} id="prod-resource">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('noResource')}</SelectItem>
                {resources.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.title}
                    {!r.isPublished ? `（${t('unpublished')}）` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prod-name">{t('fieldName')}</Label>
            <Input
              id="prod-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('namePlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="prod-price">{t('fieldPrice')}</Label>
              <Input
                id="prod-price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder={t('pricePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-original">{t('fieldOriginalPrice')}</Label>
              <Input
                id="prod-original"
                type="number"
                min="0"
                step="0.01"
                value={form.originalPrice}
                onChange={(e) => setForm({ ...form, originalPrice: e.target.value })}
                placeholder={t('pricePlaceholder')}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prod-desc">{t('fieldDescription')}</Label>
            <Input
              id="prod-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('descPlaceholder')}
            />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="prod-published"
                checked={form.isPublished}
                onCheckedChange={(v) => setForm({ ...form, isPublished: v })}
              />
              <Label htmlFor="prod-published">{t('fieldPublished')}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="prod-sort">{t('fieldSort')}</Label>
              <Input
                id="prod-sort"
                type="number"
                min="0"
                value={form.sort}
                onChange={(e) => setForm({ ...form, sort: e.target.value })}
                className="w-24"
              />
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
