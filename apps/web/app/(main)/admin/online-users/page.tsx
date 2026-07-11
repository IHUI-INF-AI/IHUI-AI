'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, LogOut, Smartphone, Monitor } from 'lucide-react'
import { toast } from 'sonner'

import { fetchApi } from '@/lib/api'
import { Button, Input } from '@ihui/ui'
import { DataTable, type Column, Badge } from '@/components/data'

interface OnlineUser {
  id: string
  username: string
  ip: string
  loginAt: string
  lastActiveAt: string
  device: string
  location?: string | null
  [key: string]: unknown
}

interface OnlineUsersData {
  list: OnlineUser[]
  total: number
}

const PAGE_SIZE = 20

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function DeviceIcon({ device }: { device: string }) {
  const isMobile = /mobile|android|iphone|ipad/i.test(device)
  const Icon = isMobile ? Smartphone : Monitor
  return <Icon className="h-3.5 w-3.5 text-muted-foreground" />
}

export default function OnlineUsersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'online-users', search, page],
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        keyword: search,
      })
      const res = await api<OnlineUsersData | OnlineUser[]>(`/api/admin/online-users?${qs}`)
      const list = Array.isArray(res) ? res : (res.list ?? [])
      const total = Array.isArray(res) ? res.length : (res.total ?? 0)
      return { list, total }
    },
  })

  const forceLogoutMut = useMutation({
    mutationFn: (id: string) =>
      api(`/api/admin/online-users/${id}/force-logout`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'online-users'] })
      toast.success('已强制下线')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const dateFmt = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const columns: Column<OnlineUser>[] = [
    {
      key: 'username',
      title: '用户名',
      render: (u) => <span className="font-medium">{u.username}</span>,
    },
    {
      key: 'ip',
      title: 'IP地址',
      render: (u) => <code className="font-mono text-xs text-muted-foreground">{u.ip}</code>,
    },
    {
      key: 'loginAt',
      title: '登录时间',
      render: (u) => (
        <span className="text-muted-foreground">{dateFmt.format(new Date(u.loginAt))}</span>
      ),
    },
    {
      key: 'lastActiveAt',
      title: '最后活跃',
      render: (u) => (
        <span className="text-muted-foreground">{dateFmt.format(new Date(u.lastActiveAt))}</span>
      ),
    },
    {
      key: 'device',
      title: '设备信息',
      render: (u) => (
        <div className="flex items-center gap-1.5">
          <DeviceIcon device={u.device} />
          <span className="text-xs text-muted-foreground">{u.device}</span>
        </div>
      ),
    },
    {
      key: 'location',
      title: '登录位置',
      render: (u) => <span className="text-xs text-muted-foreground">{u.location ?? '-'}</span>,
    },
    {
      key: 'actions',
      title: '操作',
      align: 'right',
      render: (u) => (
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          disabled={forceLogoutMut.isPending}
          onClick={() => {
            if (confirm(`确认强制下线用户 ${u.username}?`)) forceLogoutMut.mutate(u.id)
          }}
        >
          <LogOut className="h-4 w-4" />
          强制下线
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Users className="h-6 w-6 text-primary" />
            在线用户
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">查看当前在线用户列表,支持强制下线</p>
        </div>
        <Badge variant="success">
          <Users className="h-3 w-3" />
          当前在线 {total} 人
        </Badge>
      </div>

      <Input
        placeholder="搜索用户名或IP地址..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setPage(1)
        }}
        className="max-w-sm"
      />

      <DataTable
        columns={columns}
        data={list}
        rowKey={(u) => u.id}
        loading={isLoading}
        pagination={{ page, pageSize: PAGE_SIZE, total }}
        onPageChange={setPage}
      />
    </div>
  )
}
