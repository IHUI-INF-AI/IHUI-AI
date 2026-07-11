'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Key, Ban } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
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

interface Token {
  id: string
  tokenType: 'access' | 'refresh'
  user: string
  appName: string
  clientId: string
  scopes: string[]
  status: 'active' | 'expired' | 'revoked'
  createdAt: string
  expiresAt: string
  lastUsedAt: string | null
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const TYPE_LABEL: Record<Token['tokenType'], string> = { access: 'Access', refresh: 'Refresh' }
const STATUS_LABEL: Record<Token['status'], string> = {
  active: '有效',
  expired: '已过期',
  revoked: '已撤销',
}
const STATUS_STYLE: Record<Token['status'], string> = {
  active: 'bg-emerald-500/10 text-emerald-600',
  expired: 'bg-muted text-muted-foreground',
  revoked: 'bg-red-500/10 text-red-600',
}

export default function AdminOAuthTokensPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState('all')
  const [type, setType] = React.useState('all')

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['admin', 'oauth', 'tokens', search, status, type],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (search) qs.set('search', search)
      if (status !== 'all') qs.set('status', status)
      if (type !== 'all') qs.set('type', type)
      return api<{ list: Token[] }>(`/api/admin/oauth/tokens?${qs.toString()}`).then(
        (d) => d.list ?? [],
      )
    },
  })

  const revokeMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/oauth/tokens/${id}/revoke`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'oauth', 'tokens'] }),
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Key className="h-6 w-6 text-primary" />
          Token 管理
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">管理 OAuth Access/Refresh Token</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索用户/应用"
            className="h-9 pl-3"
          />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className={selectClass} aria-label="类型">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="access">Access</SelectItem>
            <SelectItem value="refresh">Refresh</SelectItem>
          </SelectContent>
        </Select>
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
              <TableHead className="text-xs uppercase">类型</TableHead>
              <TableHead className="text-xs uppercase">权限</TableHead>
              <TableHead className="text-xs uppercase">状态</TableHead>
              <TableHead className="text-xs uppercase">创建/过期</TableHead>
              <TableHead className="text-xs uppercase">最近使用</TableHead>
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
                  暂无 Token
                </TableCell>
              </TableRow>
            ) : (
              list.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.user}</TableCell>
                  <TableCell>{t.appName}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex rounded px-1.5 py-0.5 text-xs',
                        t.tokenType === 'access'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-purple-500/10 text-purple-600',
                      )}
                    >
                      {TYPE_LABEL[t.tokenType]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(t.scopes ?? []).map((s) => (
                        <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {s}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                        STATUS_STYLE[t.status],
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {STATUS_LABEL[t.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div>{new Date(t.createdAt).toLocaleString()}</div>
                    <div className="opacity-70">→ {new Date(t.expiresAt).toLocaleString()}</div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {t.status === 'active' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={revokeMut.isPending}
                        onClick={() => revokeMut.mutate(t.id)}
                      >
                        <Ban className="h-3.5 w-3.5 text-red-600" />
                        撤销
                      </Button>
                    )}
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
