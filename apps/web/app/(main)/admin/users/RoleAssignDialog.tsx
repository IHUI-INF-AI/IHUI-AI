'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { KeyRound, Loader2 } from 'lucide-react'
import { Button, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { Modal } from '@/components/feedback'
import { api } from './helpers'
import type { AdminUser } from './types'

interface RbacRole {
  id: string
  name: string
  displayName: string
  isSystem: boolean
}

interface Props {
  user: AdminUser | null
  pending: boolean
  onConfirm: (role: number) => void
  onCancel: () => void
}

const ROLE_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: '普通用户' },
  { value: 1, label: '管理员' },
]

export function RoleAssignDialog({ user, pending, onConfirm, onCancel }: Props) {
  const initialRole = user && (user.roleId ?? 0) >= 1 ? 1 : 0
  const [role, setRole] = React.useState<number>(initialRole)

  React.useEffect(() => {
    if (user) setRole((user.roleId ?? 0) >= 1 ? 1 : 0)
  }, [user])

  // 复用 RBAC 角色列表作为参考展示(只读,与 users.roleId 体系独立)
  const rbacQ = useQuery({
    queryKey: ['admin', 'rbac-roles-ref'],
    queryFn: () => api<{ list: RbacRole[] }>('/api/roles'),
    enabled: !!user,
    staleTime: 60 * 1000,
  })

  return (
    <Modal
      open={!!user}
      onClose={onCancel}
      title="分配角色"
      description={user ? `设置 "${user.nickname || user.phone || user.id}" 的角色` : undefined}
      size="sm"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            取消
          </Button>
          <Button type="button" disabled={pending} onClick={() => onConfirm(role)}>
            {pending ? '提交中…' : '确认分配'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="role-select" className="text-sm font-medium">
            系统角色
          </label>
          <Select value={String(role)} onValueChange={(v) => setRole(Number(v))}>
            <SelectTrigger id="role-select" className="h-9 w-full" aria-label="选择角色">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border border-border/60 bg-muted/30 p-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5" />
            RBAC 细粒度角色(参考)
          </p>
          {rbacQ.isLoading ? (
            <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              加载中…
            </div>
          ) : rbacQ.data?.list?.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {rbacQ.data.list.map((r) => (
                <span
                  key={r.id}
                  className="inline-flex items-center rounded-md bg-background px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-border/60"
                  title={r.name}
                >
                  {r.displayName}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground/80">暂无 RBAC 角色</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
