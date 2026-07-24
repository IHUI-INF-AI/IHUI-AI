'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Ban, Search, Trash2, RotateCcw } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Input,
  Button,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui-react'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/date-utils'

interface BlacklistItem {
  id: string
  user: string
  identifier: string
  type: 'user' | 'ip' | 'device'
  reason: string
  status: 'active' | 'removed'
  expiresAt: string | null
  createdAt: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const TYPE_LABEL: Record<BlacklistItem['type'], string> = { user: '用户', ip: 'IP', device: '设备' }

export default function AdminMemberBlacklistPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [type, setType] = React.useState('all')

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['admin', 'member', 'blacklist', search, type],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (search) qs.set('search', search)
      if (type !== 'all') qs.set('type', type)
      return api<{ list: BlacklistItem[] }>(`/api/admin/member/blacklist?${qs.toString()}`).then(
        (d) => d.list ?? [],
      )
    },
  })

  const removeMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/member/blacklist/${id}/remove`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'member', 'blacklist'] }),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/member/blacklist/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'member', 'blacklist'] }),
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Ban className="h-6 w-6 text-primary" />
          会员黑名单
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">管理被封禁的用户/IP/设备</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索用户/标识"
            className="h-9 pl-8"
          />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className={selectClass} aria-label="类型">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="user">用户</SelectItem>
            <SelectItem value="ip">IP</SelectItem>
            <SelectItem value="device">设备</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs uppercase">类型</TableHead>
              <TableHead className="text-xs uppercase">标识</TableHead>
              <TableHead className="text-xs uppercase">用户</TableHead>
              <TableHead className="text-xs uppercase">原因</TableHead>
              <TableHead className="text-xs uppercase">状态</TableHead>
              <TableHead className="text-xs uppercase">封禁时间</TableHead>
              <TableHead className="text-xs uppercase">到期</TableHead>
              <TableHead className="text-right text-xs uppercase">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  暂无黑名单记录
                </TableCell>
              </TableRow>
            ) : (
              list.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <span className="inline-flex rounded bg-muted px-1.5 py-0.5 text-xs">
                      {TYPE_LABEL[b.type]}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{b.identifier}</TableCell>
                  <TableCell className="text-muted-foreground">{b.user || '-'}</TableCell>
                  <TableCell className="max-w-[200px] break-words text-xs text-muted-foreground">
                    {b.reason}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs',
                        b.status === 'active'
                          ? 'bg-red-500/10 text-red-600'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          b.status === 'active' ? 'bg-red-500' : 'bg-muted-foreground',
                        )}
                      />
                      {b.status === 'active' ? '封禁中' : '已解除'}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(b.createdAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {b.expiresAt ? formatDate(b.expiresAt) : '永久'}
                  </TableCell>
                  <TableCell className="text-right">
                    {b.status === 'active' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={removeMut.isPending}
                        onClick={() => removeMut.mutate(b.id)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        解除
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm('确认删除记录？')) delMut.mutate(b.id)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
