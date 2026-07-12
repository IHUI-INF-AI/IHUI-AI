'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Search, ChevronLeft, ChevronRight } from 'lucide-react'

import { Button, Input, Label, Checkbox, DialogFooter } from '@ihui/ui'
import { api, inputCls, toggleId } from './helpers'
import type { ListResp } from './types'

const PAGE_SIZE = 10

export function SelectUserDialog({ roleId, onClose }: { roleId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState({ userName: '', phonenumber: '' })
  const [applied, setApplied] = React.useState({ userName: '', phonenumber: '' })
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
    queryKey: ['admin', 'role-unallocated-users', params],
    queryFn: () => api<ListResp>(`/api/admin/roles/${roleId}/unallocated-users?${params}`),
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
      qc.invalidateQueries({ queryKey: ['admin', 'role-auth-users'] })
      toast.success('授权成功')
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggleAll = () =>
    setSelected(selected.size === list.length ? new Set() : new Set(list.map((l) => l.id)))
  const toggleOne = (id: string) => setSelected(toggleId(selected, id))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">用户名</Label>
          <Input
            value={search.userName}
            onChange={(e) => setSearch({ ...search, userName: e.target.value })}
            placeholder="用户名"
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">手机号</Label>
          <Input
            value={search.phonenumber}
            onChange={(e) => setSearch({ ...search, phonenumber: e.target.value })}
            placeholder="手机号"
            className={inputCls}
          />
        </div>
        <Button
          size="sm"
          onClick={() => {
            setPage(1)
            setApplied(search)
          }}
        >
          <Search className="h-4 w-4" />
          搜索
        </Button>
      </div>

      <div className="max-h-64 overflow-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/50">
            <tr>
              <th className="w-10 px-3 py-2">
                <Checkbox
                  checked={list.length > 0 && selected.size === list.length}
                  onCheckedChange={toggleAll}
                />
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                用户名
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                昵称
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                手机号
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
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
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(u.id)}
                      onCheckedChange={() => toggleOne(u.id)}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">{u.userName}</td>
                  <td className="px-3 py-2 text-muted-foreground">{u.nickName}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {u.phonenumber || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          共 {total} 条 · {page}/{totalPages}
        </span>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          取消
        </Button>
        <Button
          type="button"
          disabled={selected.size === 0 || authMut.isPending}
          onClick={() => authMut.mutate([...selected])}
        >
          {authMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}授权(
          {selected.size})
        </Button>
      </DialogFooter>
    </div>
  )
}
