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
  DialogFooter,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Switch,
} from '@ihui/ui'
import { selectClass } from '@/lib/edu'
import type { Category, LForm, Lesson } from './types'

interface Props {
  open: boolean
  editing: Lesson | null
  form: LForm
  setForm: React.Dispatch<React.SetStateAction<LForm>>
  err: string | null
  savePending: boolean
  categories: Category[]
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function LearnDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  categories,
  onSubmit,
  onClose,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-xl">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑课程' : '新建课程'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="l-title">标题</Label>
            <Input
              id="l-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="l-cat">分类</Label>
              <Select
                value={form.categoryId || 'none'}
                onValueChange={(v) => setForm({ ...form, categoryId: v === 'none' ? '' : v })}
              >
                <SelectTrigger className={selectClass} id="l-cat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无分类</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="l-lec">讲师</Label>
              <Input
                id="l-lec"
                value={form.lecturerName}
                onChange={(e) => setForm({ ...form, lecturerName: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="l-intro">简介</Label>
            <Input
              id="l-intro"
              value={form.intro}
              onChange={(e) => setForm({ ...form, intro: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="l-price">价格</Label>
              <Input
                id="l-price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="l-sort">排序</Label>
              <Input
                id="l-sort"
                type="number"
                min="0"
                value={form.sort}
                onChange={(e) => setForm({ ...form, sort: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="l-free"
                checked={form.isFree}
                onCheckedChange={(v) => setForm({ ...form, isFree: v })}
              />
              <Label htmlFor="l-free">免费</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="l-pub"
                checked={form.isPublished}
                onCheckedChange={(v) => setForm({ ...form, isPublished: v })}
              />
              <Label htmlFor="l-pub">上架</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              取消
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="h-4 w-4 animate-spin" />}保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
