'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ShieldAlert, KeyRound, LogIn, Settings } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { formatDate } from '@/lib/date-utils'

import {
  Card,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@ihui/ui'

interface AuditEvent {
  id: string
  type: 'login' | 'permission' | 'sensitive'
  description: string
  ip: string
  createdAt: string
}

type EventMeta = { label: string; Icon: React.ComponentType<{ className?: string }> }

function metaOf(type: AuditEvent['type']): EventMeta {
  switch (type) {
    case 'login':
      return { label: '登录记录', Icon: LogIn }
    case 'permission':
      return { label: '权限变更', Icon: KeyRound }
    case 'sensitive':
      return { label: '敏感操作', Icon: Settings }
    default:
      return { label: '其他', Icon: ShieldAlert }
  }
}

export default function SecurityAuditPage() {
  const { data: list = [], isLoading } = useQuery({
    queryKey: ['security-audit'],
    queryFn: async () => {
      const r = await fetchApi<AuditEvent[]>('/api/security-audit')
      if (r.success && r.data) return r.data
      return []
    },
  })

  const fmtDate = (v: string) => {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : formatDate(d)
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldAlert className="h-6 w-6 text-primary" />
          安全审计
        </h1>
        <p className="text-sm text-muted-foreground">查看账户安全相关事件（已脱敏）</p>
      </header>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              加载中...
            </div>
          ) : list.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">暂无安全事件</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-32 px-4 py-2.5">类型</TableHead>
                  <TableHead className="px-4 py-2.5">描述</TableHead>
                  <TableHead className="px-4 py-2.5">IP</TableHead>
                  <TableHead className="px-4 py-2.5">时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((ev) => {
                  const meta = metaOf(ev.type)
                  const Icon = meta.Icon
                  return (
                    <TableRow key={ev.id}>
                      <TableCell className="px-4 py-2.5">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {meta.label}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-2.5">{ev.description}</TableCell>
                      <TableCell className="px-4 py-2.5 text-muted-foreground">{ev.ip}</TableCell>
                      <TableCell className="px-4 py-2.5 text-muted-foreground">
                        {fmtDate(ev.createdAt)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
