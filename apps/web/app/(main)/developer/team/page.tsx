'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Users, Plus, Trash2, Loader2, Pencil } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Button, Input, Label } from '@ihui/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { Avatar } from '@/components/data/Avatar'
import { cn } from '@/lib/utils'

interface TeamMember {
  id: string
  nickname: string
  avatar?: string
  email: string
  role: 'owner' | 'admin' | 'developer' | 'viewer'
  joinedAt: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const ROLE_CONFIG: Record<TeamMember['role'], { label: string; cls: string }> = {
  owner: { label: '所有者', cls: 'bg-primary/10 text-primary' },
  admin: { label: '管理员', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  developer: { label: '开发者', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  viewer: { label: '观察者', cls: 'bg-muted text-muted-foreground' },
}

const ROLE_OPTIONS: TeamMember['role'][] = ['admin', 'developer', 'viewer']

export default function TeamPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editId, setEditId] = React.useState<string | null>(null)
  const [email, setEmail] = React.useState('')
  const [role, setRole] = React.useState<TeamMember['role']>('developer')

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const {
    data: list = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['developer', 'team'],
    queryFn: () => api<TeamMember[]>('/api/developer/team').catch(() => [] as TeamMember[]),
  })

  const inviteMut = useMutation({
    mutationFn: () =>
      api('/api/developer/team/invite', {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['developer', 'team'] })
      closeDialog()
      toast.success('邀请已发送')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const updateRoleMut = useMutation({
    mutationFn: (m: TeamMember) =>
      api(`/api/developer/team/${m.id}`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['developer', 'team'] })
      closeDialog()
      toast.success('角色已更新')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const removeMut = useMutation({
    mutationFn: (id: string) => api(`/api/developer/team/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['developer', 'team'] })
      toast.success('成员已移除')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function closeDialog() {
    setOpen(false)
    setEditId(null)
    setEmail('')
    setRole('developer')
  }

  function openEdit(m: TeamMember) {
    setEditId(m.id)
    setEmail(m.email)
    setRole(m.role === 'owner' ? 'admin' : m.role)
    setOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Users className="h-5 w-5 text-primary" />
            团队管理
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">成员列表、邀请与角色权限</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            closeDialog()
            setOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          邀请成员
        </Button>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载中...
            </div>
          ) : list.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">暂无团队成员</p>
          ) : (
            <div className="divide-y">
              {list.map((m) => {
                const cfg = ROLE_CONFIG[m.role]
                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar src={m.avatar} name={m.nickname} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{m.nickname}</p>
                        <span
                          className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', cfg.cls)}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.email} · 加入于 {dateFmt.format(new Date(m.joinedAt))}
                      </p>
                    </div>
                    {m.role !== 'owner' && (
                      <div className="flex shrink-0 gap-1">
                        <Button size="sm" variant="outline" onClick={() => openEdit(m)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => confirm('确认移除该成员?') && removeMut.mutate(m.id)}
                          className="text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? '修改角色' : '邀请成员'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-sm">邮箱</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="member@example.com"
                disabled={!!editId}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">角色</Label>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs transition-colors',
                      role === r
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {ROLE_CONFIG[r].label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (editId) {
                  const m = list.find((x) => x.id === editId)
                  if (m) updateRoleMut.mutate(m)
                } else {
                  inviteMut.mutate()
                }
              }}
              disabled={!email.trim() || inviteMut.isPending || updateRoleMut.isPending}
            >
              {(inviteMut.isPending || updateRoleMut.isPending) && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              {editId ? '保存' : '邀请'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
