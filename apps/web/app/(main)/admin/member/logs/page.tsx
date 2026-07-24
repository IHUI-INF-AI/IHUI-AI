'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ScrollText, Search } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Input, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui-react'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/date-utils'

interface LogRow {
  id: string
  user: string
  action: string
  resource: string
  ip: string
  userAgent: string | null
  status: 'success' | 'failed'
  detail: string | null
  createdAt: string
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function AdminMemberLogsPage() {
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState('all')

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['admin', 'member', 'logs', search, status],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (search) qs.set('search', search)
      if (status !== 'all') qs.set('status', status)
      return api<{ list: LogRow[] }>(`/api/admin/member/logs?${qs.toString()}`).then(
        (d) => d.list ?? [],
      )
    },
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ScrollText className="h-6 w-6 text-primary" />
          会员操作日志
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">会员用户操作行为记录</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索用户/操作"
            className="h-9 pl-8"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className={selectClass} aria-label="状态">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="success">成功</SelectItem>
            <SelectItem value="failed">失败</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs uppercase">用户</TableHead>
              <TableHead className="text-xs uppercase">操作</TableHead>
              <TableHead className="text-xs uppercase">资源</TableHead>
              <TableHead className="text-xs uppercase">IP</TableHead>
              <TableHead className="text-xs uppercase">状态</TableHead>
              <TableHead className="text-xs uppercase">时间</TableHead>
              <TableHead className="text-xs uppercase">详情</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  暂无日志
                </TableCell>
              </TableRow>
            ) : (
              list.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.user}</TableCell>
                  <TableCell>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                      {l.action}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.resource}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{l.ip}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs',
                        l.status === 'success'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-red-500/10 text-red-600',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          l.status === 'success' ? 'bg-emerald-500' : 'bg-red-500',
                        )}
                      />
                      {l.status === 'success' ? '成功' : '失败'}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(l.createdAt)}
                  </TableCell>
                  <TableCell className="max-w-[240px] break-words text-xs text-muted-foreground">
                    {l.detail || '-'}
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
