'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Download, LogIn, Loader2 } from 'lucide-react'

import { exportFromApi } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'

import { LoginLogFilter } from './LoginLogFilter'
import { LoginLogTable } from './LoginLogTable'
import { LoginLogDialog } from './LoginLogDialog'
import {
  PAGE_SIZE,
  RESOURCE,
  PERM,
  EMPTY_FORM,
  EMPTY_SEARCH,
  EXPORT_COLS,
  api,
  buildQueryParams,
  loginLogToForm,
} from './helpers'
import type { LoginLog, LoginLogForm, LoginLogSearch, ListData } from './types'

export default function LoginLogsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState<LoginLogSearch>(EMPTY_SEARCH)
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<LoginLog | null>(null)
  const [form, setForm] = React.useState<LoginLogForm>(EMPTY_FORM)
  const [delId, setDelId] = React.useState<string | null>(null)

  const params = React.useMemo(() => buildQueryParams(search, page, PAGE_SIZE), [search, page])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'login-logs', params],
    queryFn: () => api<ListData>(`${RESOURCE}?${new URLSearchParams(params)}`),
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? api(`${RESOURCE}/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) })
        : api(RESOURCE, { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'login-logs'] })
      toast.success(editing ? '更新成功' : '创建成功')
      close()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`${RESOURCE}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'login-logs'] })
      toast.success('删除成功')
      setDelId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }
  function openEdit(item: LoginLog) {
    setEditing(item)
    setForm(loginLogToForm(item))
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.userUuid.trim() || !form.loginType.trim()) {
      toast.error('用户UUID 和 登录类型 为必填项')
      return
    }
    saveMut.mutate()
  }
  function handleSearchChange(patch: Partial<LoginLogSearch>) {
    setSearch((prev) => ({ ...prev, ...patch }))
  }
  function handleReset() {
    setSearch(EMPTY_SEARCH)
    setPage(1)
  }
  async function handleExport() {
    const ok = await exportFromApi(
      `${RESOURCE}?${new URLSearchParams(params)}`,
      '登录日志',
      EXPORT_COLS,
    )
    if (!ok) toast.error('导出失败')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <LogIn className="h-6 w-6 text-primary" />
          登录日志
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

      <LoginLogFilter
        search={search}
        onSearchChange={handleSearchChange}
        onReset={handleReset}
        onQuery={() => setPage(1)}
      />

      <LoginLogTable list={list} isLoading={isLoading} onEdit={openEdit} onDelete={setDelId} />

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

      <LoginLogDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={close}
      />

      <Dialog
        open={delId !== null}
        onOpenChange={(o) => {
          if (!o) setDelId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>确定要删除该登录日志记录吗？此操作不可撤销。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDelId(null)}
              disabled={delMut.isPending}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={delMut.isPending}
              onClick={() => delId && delMut.mutate(delId)}
            >
              {delMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
