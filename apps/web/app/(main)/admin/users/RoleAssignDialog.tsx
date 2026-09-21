// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { KeyRound, Loader2 } from 'lucide-react'
import {
  Button,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui-react'
import { Modal } from '@/components/feedback'
import { TruncatedText } from '@/components/common'
import { api } from './helpers'
import type { AdminUser } from './types'

interface RbacRole {
  id: string
  name: string
  displayName: string
  isSystem: boolean
}

// 2026-08-30 教师角色入口:/api/admin/user-roles 关联记录(user_roles 表)
interface UserRoleRow {
  id: string
  userId: string
  roleId: string
}

interface Props {
  user: AdminUser | null
  pending: boolean
  // 2026-08-30 教师角色入口:教师(RBAC)关联操作 pending 状态
  teacherPending: boolean
  onConfirm: (role: number) => void
  // 2026-08-30 教师角色入口:挂 teacher 角色(走 RBAC,不改 users.roleId)
  onAssignTeacher: (roleId: string) => void
  // 2026-08-30 教师角色入口:移除 teacher 角色关联
  onRemoveTeacher: (assocId: string) => void
  onCancel: () => void
}

// 2026-08-30 教师角色入口:教师为 RBAC 角色(roles.name='teacher'),用特殊值区分数值 roleId
const TEACHER_VALUE = 'teacher'

const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '0', label: '普通用户' },
  { value: '1', label: '管理员' },
  { value: TEACHER_VALUE, label: '教师' },
]

export function RoleAssignDialog({
  user,
  pending,
  teacherPending,
  onConfirm,
  onAssignTeacher,
  onRemoveTeacher,
  onCancel,
}: Props) {
  const [role, setRole] = React.useState<string>('0')

  // 复用 RBAC 角色列表作为参考展示(只读,与 users.roleId 体系独立)
  const rbacQ = useQuery({
    queryKey: ['admin', 'rbac-roles-ref'],
    queryFn: () => api<{ list: RbacRole[] }>('/api/roles'),
    enabled: !!user,
    staleTime: 60 * 1000,
  })

  // 2026-08-30 教师角色入口:从 RBAC 角色列表解析 teacher 角色(以 roles.name='teacher' 为准)
  const teacherRole = rbacQ.data?.list?.find((r) => r.name === 'teacher')

  // 2026-08-30 教师角色入口:查询该用户已有 RBAC 关联,用于回显"教师"与取消关联
  const userRolesQ = useQuery({
    queryKey: ['admin', 'user-roles', user?.id],
    queryFn: () => api<{ list: UserRoleRow[] }>(`/api/admin/user-roles?search=${user?.id}`),
    enabled: !!user,
  })
  const teacherAssoc = teacherRole
    ? userRolesQ.data?.list?.find((r) => r.roleId === teacherRole.id)
    : undefined

  React.useEffect(() => {
    if (user) {
      // 2026-08-30 教师角色入口:已有 teacher 关联时默认选中"教师",否则回落到数值 roleId
      setRole(teacherAssoc ? TEACHER_VALUE : (user.roleId ?? 0) >= 1 ? '1' : '0')
    }
  }, [user, teacherAssoc])

  const busy = pending || teacherPending

  // 2026-08-30 教师角色入口:确认逻辑分流——教师走 RBAC 关联,普通/管理员保持原 PATCH roleId 逻辑
  const handleConfirm = () => {
    if (role === TEACHER_VALUE) {
      if (!teacherRole) return
      // 已是教师则无需变更,直接关闭
      if (teacherAssoc) {
        onCancel()
        return
      }
      onAssignTeacher(teacherRole.id)
      return
    }
    // 由教师切换回普通/管理员时,先移除 RBAC teacher 关联再改 roleId
    if (teacherAssoc) onRemoveTeacher(teacherAssoc.id)
    onConfirm(Number(role))
  }

  return (
    <Modal
      open={!!user}
      onClose={onCancel}
      title="分配角色"
      description={user ? `设置 "${user.nickname || user.phone || user.id}" 的角色` : undefined}
      size="sm"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            取消
          </Button>
          <Button type="button" disabled={busy} onClick={handleConfirm}>
            {busy ? '提交中…' : '确认分配'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="role-select" className="text-sm font-medium">
            系统角色
          </label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger id="role-select" className="h-9 w-full" aria-label="选择角色">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((o) => (
                // 2026-08-30 教师角色入口:RBAC 中不存在 teacher 角色时禁用该选项
                <SelectItem
                  key={o.value}
                  value={o.value}
                  disabled={o.value === TEACHER_VALUE && !teacherRole}
                >
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
                <TruncatedText
                  key={r.id}
                  value={r.displayName}
                  className="inline-flex max-w-[200px] items-center rounded-md bg-background px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-border/60"
                />
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
