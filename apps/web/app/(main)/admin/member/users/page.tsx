'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Users, Search, ChevronLeft, ChevronRight } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Input, Button, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface MemberUser {
  id: string
  nickname: string | null
  phone: string | null
  email: string | null
  level: number
  status: number
  createdAt: string | null
}

interface ListData {
  list: MemberUser[]
  total: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const PAGE_SIZE = 10
const selectClass = 'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function AdminMemberUsersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [level, setLevel] = React.useState('all')
  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    const tm = setTimeout(() => { setDebounced(search); setPage(1) }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'member', 'users', debounced, level, status, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debounced) qs.set('search', debounced)
      if (level !== 'all') qs.set('level', level)
      if (status !== 'all') qs.set('status', status)
      return api<ListData>(`/api/admin/member/users?${qs.toString()}`)
    },
  })

  const patchMut = useMutation({
    mutationFn: (p: { id: string; body: { status?: number; level?: number } }) =>
      api(`/api/admin/member/users/${p.id}`, { method: 'PATCH', body: JSON.stringify(p.body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'member', 'users'] }),
  })

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Users className="h-6 w-6 text-primary" />
          会员用户列表
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">管理平台会员用户</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索昵称/手机号" className="h-9 pl-8" />
        </div>
        <Select value={level} onValueChange={(v) => { setLevel(v); setPage(1) }}>
          <SelectTrigger className={selectClass} aria-label="等级"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部等级</SelectItem>
            <SelectItem value="0">普通</SelectItem>
            <SelectItem value="1">白银</SelectItem>
            <SelectItem value="2">黄金</SelectItem>
            <SelectItem value="3">钻石</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className={selectClass} aria-label="状态"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="1">正常</SelectItem>
            <SelectItem value="0">禁用</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">用户</th>
              <th className="px-4 py-2.5 font-medium">联系方式</th>
              <th className="px-4 py-2.5 font-medium">等级</th>
              <th className="px-4 py-2.5 font-medium">状态</th>
              <th className="px-4 py-2.5 font-medium">注册时间</th>
              <th className="px-4 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /></td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">暂无用户</td></tr>
            ) : (
              list.map((u) => {
                const isActive = (u.status ?? 0) >= 1
                const levelLabel = ['普通', '白银', '黄金', '钻石'][u.level] ?? '普通'
                return (
                  <tr key={u.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{u.nickname || u.phone || u.email || u.id}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      <div>{u.phone || '-'}</div>
                      <div className="text-muted-foreground/80">{u.email || '-'}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn('inline-flex rounded px-1.5 py-0.5 text-xs', u.level >= 2 ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground')}>
                        {levelLabel}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs', isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', isActive ? 'bg-emerald-500' : 'bg-muted-foreground')} />
                        {isActive ? '正常' : '禁用'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Button size="sm" variant="ghost" disabled={patchMut.isPending} onClick={() => patchMut.mutate({ id: u.id, body: { status: isActive ? 0 : 1 } })}>
                        {isActive ? '禁用' : '启用'}
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" />上一页</Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页<ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  )
}
