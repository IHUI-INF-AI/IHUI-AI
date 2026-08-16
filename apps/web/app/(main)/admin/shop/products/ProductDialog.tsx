'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Switch,
} from '@ihui/ui-react'
import { ImageUpload } from '@/components/form/ImageUpload'
import type { Product, ProductForm } from './types'

interface Props {
  open: boolean
  editing: Product | null
  form: ProductForm
  setForm: React.Dispatch<React.SetStateAction<ProductForm>>
  err: string | null
  savePending: boolean
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
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.shop')
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-2xl">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('products.dialog.editTitle') : t('products.dialog.createTitle')}
            </DialogTitle>
            <DialogDescription>{t('products.dialog.description')}</DialogDescription>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pr-name">{t('products.dialog.name')} *</Label>
              <Input
                id="pr-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('products.dialog.namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-cat">{t('products.dialog.category')} *</Label>
              <Input
                id="pr-cat"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder={t('products.dialog.categoryPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-price">{t('products.dialog.price')} *</Label>
              <Input
                id="pr-price"
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-stock">{t('products.dialog.stock')} *</Label>
              <Input
                id="pr-stock"
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-sales">{t('products.dialog.sales')} *</Label>
              <Input
                id="pr-sales"
                type="number"
                value={form.sales}
                onChange={(e) => setForm({ ...form, sales: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-type">{t('products.dialog.type')} *</Label>
              <Input
                id="pr-type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                placeholder={t('products.dialog.typePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-den">{t('products.dialog.denomination')}</Label>
              <Input
                id="pr-den"
                value={form.denomination}
                onChange={(e) => setForm({ ...form, denomination: e.target.value })}
                placeholder={t('products.dialog.denominationPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-den-vip">{t('products.dialog.denominationVip')}</Label>
              <Input
                id="pr-den-vip"
                value={form.denominationVip}
                onChange={(e) => setForm({ ...form, denominationVip: e.target.value })}
                placeholder={t('products.dialog.denominationVipPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-den-op">{t('products.dialog.denominationOperate')}</Label>
              <Input
                id="pr-den-op"
                value={form.denominationOperate}
                onChange={(e) => setForm({ ...form, denominationOperate: e.target.value })}
                placeholder={t('products.dialog.denominationOperatePlaceholder')}
              />
            </div>
            <div className="flex items-center gap-2 pt-7">
              <Switch
                checked={form.status}
                onCheckedChange={(v) => setForm({ ...form, status: v })}
              />
              <Label>
                {form.status ? t('products.toggleOnline') : t('products.toggleOffline')}
              </Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pr-desc">{t('products.dialog.desc')}</Label>
            <textarea
              id="pr-desc"
              value={form.desc}
              onChange={(e) => setForm({ ...form, desc: e.target.value })}
              placeholder={t('products.dialog.descPlaceholder')}
              className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('products.dialog.images')}</Label>
            <ImageUpload
              value={form.images}
              onChange={(v) => setForm({ ...form, images: Array.isArray(v) ? v : v ? [v] : [] })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              {t('products.dialog.cancel')}
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {t('products.dialog.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
