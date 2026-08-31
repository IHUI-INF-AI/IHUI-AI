// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from './helpers'
import type { AdminUser } from './types'

export function useUserMutations() {
  const qc = useQueryClient()
  const invalidateUsers = () => qc.invalidateQueries({ queryKey: ['admin', 'users'] })

  const patchMut = useMutation({
    mutationFn: (p: {
      id: string
      body: { role?: number; status?: number; deptId?: number | null }
    }) =>
      api<{ user: AdminUser }>(`/api/admin/users/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify(p.body),
      }),
    onSuccess: () => {
      toast.success('操作成功')
      invalidateUsers()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const createMut = useMutation({
    mutationFn: (body: { nickname: string; phone?: string; email?: string; password: string }) =>
      api<{ user: AdminUser }>('/api/admin/users', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('用户创建成功')
      invalidateUsers()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('用户已删除')
      invalidateUsers()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const resetPwdMut = useMutation({
    mutationFn: (p: { userId: string; password: string }) =>
      api<{ success: boolean }>('/api/admin/users/resetPwd', {
        method: 'PUT',
        body: JSON.stringify(p),
      }),
    onSuccess: () => toast.success('密码已重置'),
    onError: (e: Error) => toast.error(e.message),
  })

  // 2026-08-30 教师角色入口:教师走 RBAC(user_roles 关联),不改 users.roleId,避免提权
  const invalidateUserRoles = () => qc.invalidateQueries({ queryKey: ['admin', 'user-roles'] })

  // 2026-08-30 教师角色入口:给用户挂 teacher 角色(POST /api/admin/user-roles)
  const assignTeacherMut = useMutation({
    mutationFn: (p: { userId: string; roleId: string }) =>
      api('/api/admin/user-roles', {
        method: 'POST',
        body: JSON.stringify({ userId: p.userId, roleId: p.roleId }),
      }),
    onSuccess: () => {
      toast.success('已设为教师')
      invalidateUserRoles()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // 2026-08-30 教师角色入口:移除用户的 teacher 角色关联(DELETE /api/admin/user-roles/:id)
  const removeTeacherMut = useMutation({
    mutationFn: (assocId: string) => api(`/api/admin/user-roles/${assocId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('已取消教师角色')
      invalidateUserRoles()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return {
    patchMut,
    createMut,
    deleteMut,
    resetPwdMut,
    assignTeacherMut,
    removeTeacherMut,
    invalidateUsers,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
