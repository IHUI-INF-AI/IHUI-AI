'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Users, Search, ChevronLeft, ChevronRight, UserCheck, UserX } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Input, Button } from '@ihui/ui'
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

export default function AdminMemberUnauditedPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'member', 'unaudited', debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        status: 'pending',
      })
      if (debounced) qs.set('search', debounced)
      return api<ListData>(`/api/admin/users?${qs.toString()}`)
    },
  })

  const auditMut = useMutation({
    mutationFn: (p: { id: string; action: 'approve' | 'reject' }) =>
      api(`/api/admin/users/${p.id}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: p.action }),
      }),
    onSuccess: (_data, vars) => {
      toast.success(vars.action === 'approve' ? '已通过审核' : '已拒绝')
      qc.invalidateQueries({ queryKey: ['admin', 'member', 'unaudited'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Users className="h-6 w-6 text-primary" />
          未审核会员
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">审核待通过的会员注册申请</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/member/users">
            <ChevronLeft className="h-4 w-4" />
            返回会员列表
          </Link>
        </Button>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索昵称/手机号"
            className="h-9 pl-8"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">用户</th>
              <th className="px-4 py-2.5 font-medium">联系方式</th>
              <th className="px-4 py-2.5 font-medium">等级</th>
              <th className="px-4 py-2.5 font-medium">申请时间</th>
              <th className="px-4 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无待审核会员
                </td>
              </tr>
            ) : (
              list.map((u) => {
                const levelLabel = ['普通', '白银', '黄金', '钻石'][u.level] ?? '普通'
                return (
                  <tr key={u.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">
                      {u.nickname || u.phone || u.email || u.id}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      <div>{u.phone || '-'}</div>
                      <div className="text-muted-foreground/80">{u.email || '-'}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex rounded px-1.5 py-0.5 text-xs',
                          u.level >= 2
                            ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {levelLabel}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={auditMut.isPending}
                          onClick={() => auditMut.mutate({ id: u.id, action: 'approve' })}
                          className="text-emerald-600 hover:text-emerald-600"
                        >
                          <UserCheck className="h-4 w-4" />
                          通过
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={auditMut.isPending}
                          onClick={() => auditMut.mutate({ id: u.id, action: 'reject' })}
                          className="text-destructive hover:text-destructive"
                        >
                          <UserX className="h-4 w-4" />
                          拒绝
                        </Button>
                      </div>
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
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
