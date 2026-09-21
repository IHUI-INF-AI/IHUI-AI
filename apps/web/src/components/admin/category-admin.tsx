// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 管理后台分类管理共享组件(Table + Dialog)。
 *
 * 背景(2026-09-06 立):live/resources/learn 三个管理域的 CategoryTable/CategoryDialog
 * 为同一来源的复制粘贴,且已发生漂移(edu-exam 变体还残留 window.confirm 违规)。
 * 本组件为唯一事实来源,各域文件退化为薄 wrapper(仅注入各自 i18n 文案),
 * 页面/helper/类型零改动。
 *
 * 类型契约与各域 types.ts 的 Category/CategoryForm 结构完全一致。
 */

import * as React from 'react'
import { Loader2, Edit, Trash2, FolderTree } from 'lucide-react'
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
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@ihui/ui-react'
import type { TreeNode } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { Tooltip, ConfirmDialog } from '@/components/feedback'

/** 分类实体(与各域 types.ts 的 Category 结构一致;createdAt 非渲染必需,可选兼容各域) */
export interface AdminCategory {
  id: string
  name: string
  pid: string | null
  sort: number
  status: number
  createdAt?: string
}

/** 分类表单状态 */
export interface AdminCategoryForm {
  pid: string
  name: string
  sort: string
  status: boolean
}

export interface CategoryTableLabels {
  colName: string
  colSort: string
  colStatus: string
  colActions: string
  loading: string
  noData: string
  enabled: string
  disabled: string
  edit: string
  delete: string
  /** 删除确认对话框标题(各域已有 deleteConfirm / confirmDelete 键) */
  confirmTitle: string
  /** 删除确认对话框确认按钮文案(各域已有 delete 键) */
  confirmAction: string
  /** 删除确认对话框取消按钮文案(各域已有 cancel 键) */
  confirmCancel: string
}

export interface CategoryDialogLabels {
  editTitle: string
  createTitle: string
  fieldParent: string
  rootCategory: string
  fieldName: string
  namePlaceholder: string
  fieldSort: string
  fieldStatus: string
  enabled: string
  disabled: string
  cancel: string
  save: string
}

// ===== Table =====

interface AdminCategoryTableProps<T extends AdminCategory> {
  list: T[]
  isLoading: boolean
  error: Error | null
  deletePending: boolean
  onEdit: (item: T) => void
  onDelete: (item: T) => void
  labels: CategoryTableLabels
}

export function AdminCategoryTable<T extends AdminCategory>({
  list,
  isLoading,
  error,
  deletePending,
  onEdit,
  onDelete,
  labels,
}: AdminCategoryTableProps<T>) {
  // 删除确认内聚在共享表格层(AGENTS.md §4:禁 window.confirm,用项目自有 ConfirmDialog)
  const [pendingDelete, setPendingDelete] = React.useState<T | null>(null)
  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">{labels.colName}</TableHead>
              <TableHead className="px-4 py-2.5">{labels.colSort}</TableHead>
              <TableHead className="px-4 py-2.5">{labels.colStatus}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{labels.colActions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {labels.loading}
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={4} className="px-4 py-10 text-center text-destructive">
                  {error.message}
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  <FolderTree className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {labels.noData}
                </TableCell>
              </TableRow>
            ) : (
              list.map((cat) => {
                const enabled = cat.status === 1
                return (
                  <TableRow key={cat.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5 font-medium">{cat.name}</TableCell>
                    <TableCell className="px-4 py-2.5">{cat.sort}</TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                          enabled
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            enabled ? 'bg-emerald-500' : 'bg-muted-foreground',
                          )}
                        />
                        {enabled ? labels.enabled : labels.disabled}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip content={labels.edit}>
                          <Button variant="ghost" size="sm" onClick={() => onEdit(cat)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content={labels.delete}>
                          <span className="inline-flex">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPendingDelete(cat)}
                              className="text-destructive hover:text-destructive"
                              disabled={deletePending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </span>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
      <ConfirmDialog
        open={pendingDelete !== null}
        title={labels.confirmTitle}
        variant="danger"
        confirmText={labels.confirmAction}
        cancelText={labels.confirmCancel}
        onConfirm={() => {
          if (pendingDelete) onDelete(pendingDelete)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  )
}

// ===== Dialog =====

interface AdminCategoryDialogProps<T extends AdminCategory> {
  open: boolean
  editing: T | null
  form: AdminCategoryForm
  setForm: React.Dispatch<React.SetStateAction<AdminCategoryForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  categories: T[]
  labels: CategoryDialogLabels
}

export function AdminCategoryDialog<T extends AdminCategory>({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
  categories,
  labels,
}: AdminCategoryDialogProps<T>) {
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
            <DialogTitle>{editing ? labels.editTitle : labels.createTitle}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label>{labels.fieldParent}</Label>
            <TreeSelect
              value={form.pid || null}
              onChange={(v) => setForm({ ...form, pid: v ?? '' })}
              data={treeData}
              placeholder={labels.rootCategory}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-name">{labels.fieldName}</Label>
            <Input
              id="cat-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={labels.namePlaceholder}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cat-sort">{labels.fieldSort}</Label>
              <Input
                id="cat-sort"
                type="number"
                min="0"
                value={form.sort}
                onChange={(e) => setForm({ ...form, sort: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-status">{labels.fieldStatus}</Label>
              <div className="flex h-9 items-center gap-2">
                <Switch
                  id="cat-status"
                  checked={form.status}
                  onCheckedChange={(v) => setForm({ ...form, status: v })}
                />
                <span className="text-sm text-muted-foreground">
                  {form.status ? labels.enabled : labels.disabled}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              {labels.cancel}
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="h-4 w-4 animate-spin" />}
              {labels.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
