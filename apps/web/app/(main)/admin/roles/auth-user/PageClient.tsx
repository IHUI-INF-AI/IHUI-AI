'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Shield, UserMinus, X, ChevronLeft, ChevronRight } from 'lucide-react'

import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import { AuthUserFilter } from './AuthUserFilter'
import { AuthUserTable } from './AuthUserTable'
import { SelectUserDialog } from './SelectUserDialog'
import { api, toggleId } from './helpers'
import type { ListResp } from './types'

const PAGE_SIZE = 15

export default function AuthUserPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const roleId = sp.get('roleId') ?? ''
  const qc = useQueryClient()
  const [search, setSearch] = React.useState({ userName: '', phonenumber: '' })
  const [applied, setApplied] = React.useState({ userName: '', phonenumber: '' })
  const [page, setPage] = React.useState(1)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [selectOpen, setSelectOpen] = React.useState(false)

  const params = React.useMemo(() => {
    const qs = new URLSearchParams()
    qs.set('roleId', roleId)
    qs.set('page', String(page))
    qs.set('pageSize', String(PAGE_SIZE))
    if (applied.userName) qs.set('userName', applied.userName)
    if (applied.phonenumber) qs.set('phonenumber', applied.phonenumber)
    return qs.toString()
  }, [roleId, page, applied])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'role-auth-users', params],
    queryFn: () => api<ListResp>(`/api/admin/roles/${roleId}/users?${params}`),
    enabled: !!roleId,
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const cancelMut = useMutation({
    mutationFn: (userId: string) =>
      api(`/api/admin/roles/${roleId}/users/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'role-auth-users'] })
      toast.success('取消授权成功')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const cancelAllMut = useMutation({
    mutationFn: (userIds: string[]) =>
      api(`/api/admin/roles/${roleId}/users`, {
        method: 'DELETE',
        body: JSON.stringify({ userIds }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'role-auth-users'] })
      toast.success('批量取消授权成功')
      setSelected(new Set())
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleSearch = () => {
    setPage(1)
    setApplied(search)
  }
  const toggleAll = () =>
    setSelected(selected.size === list.length ? new Set() : new Set(list.map((l) => l.id)))
  const toggleOne = (id: string) => setSelected(toggleId(selected, id))

  if (!roleId)
    return <div className="py-16 text-center text-muted-foreground">缺少 roleId 参数</div>

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Shield className="h-6 w-6 text-primary" />
          角色授权用户
        </h1>
        <Button size="sm" variant="outline" onClick={() => router.push('/admin/roles')}>
          <X className="h-4 w-4" />
          返回
        </Button>
      </div>

      <AuthUserFilter search={search} onSearchChange={setSearch} onSearch={handleSearch} />

      <div className="flex items-center gap-2">
        <HasPermi code="system:role:edit">
          <Button size="sm" variant="outline" onClick={() => setSelectOpen(true)}>
            添加用户
          </Button>
        </HasPermi>
        <HasPermi code="system:role:edit">
          <Button
            size="sm"
            variant="outline"
            disabled={selected.size === 0 || cancelAllMut.isPending}
            onClick={() => {
              if (confirm(`确认取消选中 ${selected.size} 个用户的授权？`))
                cancelAllMut.mutate([...selected])
            }}
          >
            <UserMinus className="h-4 w-4" />
            批量取消授权
          </Button>
        </HasPermi>
      </div>

      <AuthUserTable
        list={list}
        isLoading={isLoading}
        selected={selected}
        cancelPending={cancelMut.isPending}
        onToggleAll={toggleAll}
        onToggleOne={toggleOne}
        onCancel={(u) => {
          if (confirm(`确认取消 ${u.userName} 的授权？`)) cancelMut.mutate(u.id)
        }}
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
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={selectOpen} onOpenChange={setSelectOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>选择用户授权</DialogTitle>
          </DialogHeader>
          <SelectUserDialog roleId={roleId} onClose={() => setSelectOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
