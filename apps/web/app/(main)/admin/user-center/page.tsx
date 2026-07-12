'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Download, Users } from 'lucide-react'

import { exportFromApi } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui'

import { api, RESOURCE, PERM, EMPTY, EXPORT_COLS } from './helpers'
import type { UserCenter } from './types'
import { UserCenterFilter } from './UserCenterFilter'
import { UserCenterTable } from './UserCenterTable'
import { UserCenterEditDialog } from './UserCenterEditDialog'
import { UserCenterIdentityDialog } from './UserCenterIdentityDialog'
import { UserCenterAssignDialog } from './UserCenterAssignDialog'
import { UserCenterDeleteDialog } from './UserCenterDeleteDialog'

export default function UserCenterPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState({ nickname: '', parentId: '' })
  const [page, setPage] = React.useState(1)
  const [pageSize] = React.useState(10)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<UserCenter | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [identityTarget, setIdentityTarget] = React.useState<UserCenter | null>(null)
  const [assignTarget, setAssignTarget] = React.useState<UserCenter | null>(null)
  const [delTarget, setDelTarget] = React.useState<string | null>(null)
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'users'] })

  const params = React.useMemo(() => {
    const p: Record<string, string> = { pageNum: String(page), pageSize: String(pageSize) }
    Object.entries(search).forEach(([k, v]) => {
      if (v.trim()) p[k] = v.trim()
    })
    return p
  }, [search, page, pageSize])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () =>
      api<{ list: UserCenter[]; total: number }>(`${RESOURCE}?${new URLSearchParams(params)}`),
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? api(`${RESOURCE}/${editing.uuid}`, { method: 'PUT', body: JSON.stringify(form) })
        : api(RESOURCE, { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      invalidate()
      toast.success(editing ? '更新成功' : '创建成功')
      close()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  function openEdit(item: UserCenter) {
    setEditing(item)
    setForm({
      nickname: item.nickname ?? '',
      avatar: item.avatar ?? '',
      gender: String(item.gender ?? ''),
      birthday: item.birthday ?? '',
      inviteCode: item.inviteCode ?? '',
      parentId: item.parentId ?? '',
      createdAt: item.createdAt ?? '',
    })
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    saveMut.mutate()
  }
  function handleReset() {
    setSearch({ nickname: '', parentId: '' })
    setPage(1)
  }
  async function handleExport() {
    const ok = await exportFromApi(
      `${RESOURCE}?${new URLSearchParams(params)}`,
      '用户中心',
      EXPORT_COLS,
    )
    if (!ok) toast.error('导出失败')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Users className="h-6 w-6 text-primary" />
          用户中心
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

      <UserCenterFilter
        search={search}
        onSearchChange={(patch) => setSearch({ ...search, ...patch })}
        onSearch={() => setPage(1)}
        onReset={handleReset}
      />

      <UserCenterTable
        list={list}
        isLoading={isLoading}
        onEdit={openEdit}
        onDelete={setDelTarget}
        onIdentity={setIdentityTarget}
        onAssign={setAssignTarget}
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

      <UserCenterEditDialog
        open={open}
        editing={editing}
        form={form}
        onFormChange={(patch) => setForm({ ...form, ...patch })}
        onClose={close}
        onSubmit={submit}
        pending={saveMut.isPending}
      />
      <UserCenterIdentityDialog
        target={identityTarget}
        onClose={() => setIdentityTarget(null)}
        onInvalidate={invalidate}
      />
      <UserCenterAssignDialog target={assignTarget} onClose={() => setAssignTarget(null)} />
      <UserCenterDeleteDialog
        target={delTarget}
        onClose={() => setDelTarget(null)}
        onInvalidate={invalidate}
      />
    </div>
  )
}
