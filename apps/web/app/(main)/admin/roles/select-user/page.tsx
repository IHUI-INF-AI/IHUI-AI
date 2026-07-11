'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, UserPlus, X, Search, ChevronLeft, ChevronRight } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Input, Label, Checkbox } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import { cn } from '@/lib/utils'

interface UnallocUser {
  id: string
  userName: string
  nickName: string
  email: string
  phonenumber: string
  status: number
  createdAt: string
}

interface ListResp {
  list: UnallocUser[]
  total: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const th = 'px-4 py-2.5 text-left font-medium text-xs uppercase text-muted-foreground'
const inputCls =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function SelectUserPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const roleId = sp.get('roleId') ?? ''
  const qc = useQueryClient()
  const [search, setSearch] = React.useState({ userName: '', phonenumber: '' })
  const [applied, setApplied] = React.useState({ userName: '', phonenumber: '' })
  const [page, setPage] = React.useState(1)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const pageSize = 15

  const params = React.useMemo(() => {
    const qs = new URLSearchParams()
    qs.set('roleId', roleId)
    qs.set('page', String(page))
    qs.set('pageSize', String(pageSize))
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
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

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

      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="space-y-1.5">
          <Label className="text-xs">用户名</Label>
          <Input
            value={search.userName}
            onChange={(e) => setSearch({ ...search, userName: e.target.value })}
            placeholder="用户名"
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">手机号</Label>
          <Input
            value={search.phonenumber}
            onChange={(e) => setSearch({ ...search, phonenumber: e.target.value })}
            placeholder="手机号"
            className={inputCls}
          />
        </div>
        <Button size="sm" onClick={handleSearch}>
          <Search className="h-4 w-4" />
          搜索
        </Button>
      </div>

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

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-10 px-4 py-2.5">
                <Checkbox
                  checked={list.length > 0 && selected.size === list.length}
                  onCheckedChange={toggleAll}
                />
              </th>
              <th className={th}>用户名</th>
              <th className={th}>昵称</th>
              <th className={th}>邮箱</th>
              <th className={th}>手机号</th>
              <th className={th}>状态</th>
              <th className={th}>创建时间</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  暂无可授权用户
                </td>
              </tr>
            ) : (
              list.map((u) => (
                <tr
                  key={u.id}
                  className="cursor-pointer transition-colors hover:bg-muted/30"
                  onClick={() => toggleOne(u.id)}
                >
                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(u.id)}
                      onCheckedChange={() => toggleOne(u.id)}
                    />
                  </td>
                  <td className="px-4 py-2.5 font-medium">{u.userName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{u.nickName}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{u.email || '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {u.phonenumber || '-'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs',
                        u.status === 0
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {u.status === 0 ? '正常' : '停用'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                    {u.createdAt ? new Date(u.createdAt).toLocaleString() : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
