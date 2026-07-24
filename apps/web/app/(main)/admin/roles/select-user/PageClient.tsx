'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, UserPlus, X, ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { HasPermi } from '@/components/auth/HasPermi'

import { SelectUserFilter } from './SelectUserFilter'
import { SelectUserTable } from './SelectUserTable'
import { PAGE_SIZE, api } from './helpers'
import type { ListResp, SearchState } from './types'

export default function SelectUserPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const roleId = sp.get('roleId') ?? ''
  const qc = useQueryClient()
  const [search, setSearch] = React.useState<SearchState>({ userName: '', phonenumber: '' })
  const [applied, setApplied] = React.useState<SearchState>({ userName: '', phonenumber: '' })
  const [page, setPage] = React.useState(1)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())

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
    queryKey: ['admin', 'role-select-users', params],
    queryFn: () => api<ListResp>(`/api/admin/roles/${roleId}/unallocated-users?${params}`),
    enabled: !!roleId,
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const authMut = useMutation({
    mutationFn: (userIds: string[]) =>
      api(`/api/admin/roles/${roleId}/users`, {
        method: 'POST',
        body: JSON.stringify({ userIds }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'role-select-users'] })
      qc.invalidateQueries({ queryKey: ['admin', 'role-auth-users'] })
      toast.success('授权成功')
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
  const toggleOne = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelected(next)
  }

  if (!roleId)
    return <div className="py-16 text-center text-muted-foreground">缺少 roleId 参数</div>

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <UserPlus className="h-6 w-6 text-primary" />
          选择授权用户
        </h1>
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push(`/admin/roles/auth-user?roleId=${roleId}`)}
        >
          <X className="h-4 w-4" />
          返回
        </Button>
      </div>

      <SelectUserFilter search={search} setSearch={setSearch} onSearch={handleSearch} />

      <div className="flex items-center gap-2">
        <HasPermi code="system:role:edit">
          <Button
            size="sm"
            disabled={selected.size === 0 || authMut.isPending}
            onClick={() => authMut.mutate([...selected])}
          >
            {authMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}授权选中(
            {selected.size})
          </Button>
        </HasPermi>
      </div>

      <SelectUserTable
        list={list}
        isLoading={isLoading}
        selected={selected}
        onToggleAll={toggleAll}
        onToggleOne={toggleOne}
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
    </div>
  )
}
