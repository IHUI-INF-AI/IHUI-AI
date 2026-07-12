'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Download, Link2 } from 'lucide-react'

import { exportFromApi } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui'
import { AuthAccountsFilter } from './AuthAccountsFilter'
import { AuthAccountsTable } from './AuthAccountsTable'
import { AuthAccountEditDialog, AuthAccountDeleteDialog } from './AuthAccountsDialog'
import { RESOURCE, PERM, EMPTY_FORM, EMPTY_SEARCH, EXPORT_COLS, api } from './helpers'
import type { AuthAccount, AuthAccountForm, AuthAccountSearch } from './types'

export default function AuthAccountsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState<AuthAccountSearch>(EMPTY_SEARCH)
  const [page, setPage] = React.useState(1)
  const [pageSize] = React.useState(10)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AuthAccount | null>(null)
  const [form, setForm] = React.useState<AuthAccountForm>(EMPTY_FORM)
  const [delId, setDelId] = React.useState<string | null>(null)

  const params = React.useMemo(() => {
    const p: Record<string, string> = { pageNum: String(page), pageSize: String(pageSize) }
    Object.entries(search).forEach(([k, v]) => {
      if (v.trim()) p[k] = v.trim()
    })
    return p
  }, [search, page, pageSize])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'auth-accounts', params],
    queryFn: () =>
      api<{ list: AuthAccount[]; total: number }>(`${RESOURCE}?${new URLSearchParams(params)}`),
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? api(`${RESOURCE}/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) })
        : api(RESOURCE, { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'auth-accounts'] })
      toast.success(editing ? '更新成功' : '创建成功')
      close()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`${RESOURCE}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'auth-accounts'] })
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
  function openEdit(item: AuthAccount) {
    setEditing(item)
    setForm({
      userUuid: item.userUuid ?? '',
      platform: item.platform ?? '',
      openId: item.openId ?? '',
      platformName: item.platformName ?? '',
      accessToken: item.accessToken ?? '',
      refreshToken: item.refreshToken ?? '',
      expiresAt: item.expiresAt ?? '',
      nickname: item.nickname ?? '',
      avatar: item.avatar ?? '',
      bindTime: item.bindTime ?? '',
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
    if (!form.userUuid.trim() || !form.platform.trim() || !form.openId.trim()) {
      toast.error('用户UUID、平台、OpenID 为必填项')
      return
    }
    saveMut.mutate()
  }
  function handleReset() {
    setSearch(EMPTY_SEARCH)
    setPage(1)
  }
  async function handleExport() {
    const ok = await exportFromApi(
      `${RESOURCE}?${new URLSearchParams(params)}`,
      '第三方账号',
      EXPORT_COLS,
    )
    if (!ok) toast.error('导出失败')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Link2 className="h-6 w-6 text-primary" />
          第三方账号管理
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

      <AuthAccountsFilter
        search={search}
        onSearchChange={setSearch}
        onSearch={() => setPage(1)}
        onReset={handleReset}
      />

      <AuthAccountsTable
        list={list}
        isLoading={isLoading}
        page={page}
        totalPages={totalPages}
        total={total}
        onEdit={openEdit}
        onDelete={setDelId}
        onPageChange={setPage}
      />

      <AuthAccountEditDialog
        open={open}
        editing={editing}
        form={form}
        isPending={saveMut.isPending}
        onFormChange={setForm}
        onClose={close}
        onSubmit={submit}
      />

      <AuthAccountDeleteDialog
        delId={delId}
        isPending={delMut.isPending}
        onClose={() => setDelId(null)}
        onConfirm={delMut.mutate}
      />
    </div>
  )
}
