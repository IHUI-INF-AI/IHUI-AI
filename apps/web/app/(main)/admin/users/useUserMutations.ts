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

  return { patchMut, createMut, deleteMut, resetPwdMut, invalidateUsers }
}
