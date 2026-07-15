'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ScrollText, Search, ShieldAlert } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Input,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@ihui/ui'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/date-utils'

interface AuthRecord {
  id: string
  user: string
  appName: string
  clientId: string
  scopes: string[]
  ip: string
  status: 'success' | 'denied' | 'revoked'
  createdAt: string
  expiresAt: string | null
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const STATUS_LABEL: Record<AuthRecord['status'], string> = {
  success: '成功',
  denied: '拒绝',
  revoked: '已撤销',
}
const STATUS_STYLE: Record<AuthRecord['status'], string> = {
  success: 'bg-emerald-500/10 text-emerald-600',
  denied: 'bg-red-500/10 text-red-600',
  revoked: 'bg-muted text-muted-foreground',
}

export default function AdminOAuthAuditPage() {
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState('all')

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['admin', 'oauth', 'audit', search, status],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (search) qs.set('search', search)
      if (status !== 'all') qs.set('status', status)
      return api<{ list: AuthRecord[] }>(`/api/admin/oauth/audit?${qs.toString()}`).then(
        (d) => d.list ?? [],
      )
    },
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldAlert className="h-6 w-6 text-primary" />
          授权记录审计
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">审计用户授权 OAuth 应用的历史记录</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索用户/应用"
            className="h-9 pl-8"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className={selectClass} aria-label="状态">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs uppercase">用户</TableHead>
              <TableHead className="text-xs uppercase">应用</TableHead>
              <TableHead className="text-xs uppercase">权限</TableHead>
              <TableHead className="text-xs uppercase">IP</TableHead>
              <TableHead className="text-xs uppercase">状态</TableHead>
              <TableHead className="text-xs uppercase">授权时间</TableHead>
              <TableHead className="text-xs uppercase">过期时间</TableHead>
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
                  <ScrollText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无授权记录
                </TableCell>
              </TableRow>
            ) : (
              list.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.user}</TableCell>
                  <TableCell>
                    <div className="font-medium">{r.appName}</div>
                    <div className="font-mono text-xs text-muted-foreground">{r.clientId}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(r.scopes ?? []).map((s) => (
                        <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {s}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.ip}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                        STATUS_STYLE[r.status],
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {STATUS_LABEL[r.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(r.createdAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.expiresAt ? formatDate(r.expiresAt) : '永久'}
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
