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
} from '@ihui/ui'
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
            <DialogTitle>{editing ? '编辑菜单' : '新建菜单'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="m-name">菜单名称</Label>
            <Input
              id="m-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="请输入菜单名称"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="m-icon">图标</Label>
              <Input
                id="m-icon"
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                placeholder="如 Settings"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-sort">排序权重</Label>
              <Input
                id="m-sort"
                type="number"
                value={form.sort}
                onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-path">路由路径</Label>
            <Input
              id="m-path"
              value={form.path}
              onChange={(e) => setForm({ ...form, path: e.target.value })}
              placeholder="/admin/menu"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-parent">父菜单</Label>
            <Select
              options={[
                { label: '顶级菜单', value: '' },
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
            是否显示
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              取消
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
