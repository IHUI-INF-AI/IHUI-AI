'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Download, Wallet } from 'lucide-react'
import { exportFromApi } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui'

import { UserMarginFilter } from './UserMarginFilter'
import { UserMarginTable } from './UserMarginTable'
import { UserMarginDialog, UserMarginDeleteDialog } from './UserMarginDialog'
import {
  RESOURCE,
  PERM,
  PAGE_SIZE,
  api,
  FIELDS,
  ALL_SEARCH,
  EMPTY,
  EXPORT_COLS,
  itemToForm,
} from './helpers'
import type { Item, FormState, ListData } from './types'

export default function UserMarginPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState<FormState>(
    Object.fromEntries(ALL_SEARCH.map((f) => [f.key, ''])),
  )
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Item | null>(null)
  const [form, setForm] = React.useState<FormState>(EMPTY)
  const [delId, setDelId] = React.useState<string | null>(null)

  const params = React.useMemo(() => {
    const p: Record<string, string> = { pageNum: String(page), pageSize: String(PAGE_SIZE) }
    for (const f of ALL_SEARCH) {
      const v = search[f.key]?.trim()
      if (v) p[f.key] = v
    }
    return p
  }, [search, page])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', PERM, params],
    queryFn: () => api<ListData>(`${RESOURCE}?${new URLSearchParams(params)}`),
  })

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? api(`${RESOURCE}/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) })
        : api(RESOURCE, { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', PERM] })
      toast.success(editing ? '更新成功' : '创建成功')
      close()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`${RESOURCE}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', PERM] })
      toast.success('删除成功')
      setDelId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  function openEdit(item: Item) {
    setEditing(item)
    setForm(itemToForm(item))
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    for (const f of FIELDS)
      if (f.required && !form[f.key]?.trim()) {
        toast.error(`${f.label}为必填项`)
        return
      }
    saveMut.mutate()
  }
  function handleReset() {
    setSearch(Object.fromEntries(ALL_SEARCH.map((f) => [f.key, ''])))
    setPage(1)
  }
  async function handleExport() {
    const ok = await exportFromApi(
      `${RESOURCE}?${new URLSearchParams(params)}`,
      '用户额度',
      EXPORT_COLS,
    )
    if (!ok) toast.error('导出失败')
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Wallet className="h-6 w-6 text-primary" />
          用户额度
        </h1>
        <div className="flex gap-2">
          <HasPermi code={`${PERM}:export`}>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              导出
            </Button>
          </HasPermi>
          <HasPermi code={`${PERM}:add`}>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新增
            </Button>
          </HasPermi>
        </div>
      </div>

      <UserMarginFilter
        search={search}
        setSearch={setSearch}
        onSearch={() => setPage(1)}
        onReset={handleReset}
      />

      <UserMarginTable
        list={list}
        isLoading={isLoading}
        onEdit={openEdit}
        onDelete={(id) => setDelId(id)}
      />

      {total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            共 {total} 条 · {page}/{totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              上一页
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      )}

      <UserMarginDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={close}
      />

      <UserMarginDeleteDialog
        delId={delId}
        setDelId={setDelId}
        delPending={delMut.isPending}
        onConfirm={() => delId && delMut.mutate(delId)}
      />
    </div>
  )
}
