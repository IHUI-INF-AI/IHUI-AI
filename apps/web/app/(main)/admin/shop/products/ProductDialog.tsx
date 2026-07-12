'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
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
} from '@ihui/ui'
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
            <DialogTitle>{editing ? '编辑商品' : '新建商品'}</DialogTitle>
            <DialogDescription>配置商品信息</DialogDescription>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pr-name">商品名称 *</Label>
              <Input
                id="pr-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="请输入商品名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-cat">分类 *</Label>
              <Input
                id="pr-cat"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="请输入分类"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-price">价格（分）*</Label>
              <Input
                id="pr-price"
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-stock">库存 *</Label>
              <Input
                id="pr-stock"
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-sales">销量 *</Label>
              <Input
                id="pr-sales"
                type="number"
                value={form.sales}
                onChange={(e) => setForm({ ...form, sales: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-type">类型 *</Label>
              <Input
                id="pr-type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                placeholder="请输入类型"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-den">面额</Label>
              <Input
                id="pr-den"
                value={form.denomination}
                onChange={(e) => setForm({ ...form, denomination: e.target.value })}
                placeholder="请输入面额"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-den-vip">VIP面额</Label>
              <Input
                id="pr-den-vip"
                value={form.denominationVip}
                onChange={(e) => setForm({ ...form, denominationVip: e.target.value })}
                placeholder="请输入VIP面额"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-den-op">运营商面额</Label>
              <Input
                id="pr-den-op"
                value={form.denominationOperate}
                onChange={(e) => setForm({ ...form, denominationOperate: e.target.value })}
                placeholder="请输入运营商面额"
              />
            </div>
            <div className="flex items-center gap-2 pt-7">
              <Switch
                checked={form.status}
                onCheckedChange={(v) => setForm({ ...form, status: v })}
              />
              <Label>{form.status ? '上架' : '下架'}</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pr-desc">描述</Label>
            <textarea
              id="pr-desc"
              value={form.desc}
              onChange={(e) => setForm({ ...form, desc: e.target.value })}
              placeholder="请输入描述"
              className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label>商品图片</Label>
            <ImageUpload
              value={form.images}
              onChange={(v) => setForm({ ...form, images: Array.isArray(v) ? v : v ? [v] : [] })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              取消
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
