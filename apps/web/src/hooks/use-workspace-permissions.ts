'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteWorkspacePermission,
  getWorkspacePermission,
  listAllWorkspacePermissions,
  setWorkspacePermission,
  type WorkspacePermission,
  type WorkspacePermissionMode,
} from '@ihui/api-client/endpoints/workspace'

/** 查询单个工作区权限 */
export function useWorkspacePermission(workspacePath: string | null) {
  return useQuery({
    queryKey: ['workspace', 'permission', workspacePath],
    queryFn: async () => {
      if (!workspacePath) return null
      const res = await getWorkspacePermission(workspacePath)
      if (!res.success) throw new Error(res.error)
      return res.data.permission
    },
    enabled: !!workspacePath,
  })
}

/** 列出当前用户所有工作区权限 */
export function useAllWorkspacePermissions() {
  return useQuery({
    queryKey: ['workspace', 'permissions'],
    queryFn: async () => {
      const res = await listAllWorkspacePermissions()
      if (!res.success) throw new Error(res.error)
      return res.data.permissions
    },
  })
}

/** 设置/更新权限模式 */
export function useSetWorkspacePermission() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      workspacePath: string
      name: string
      techStack?: string
      mode: WorkspacePermissionMode
      initializeDefaults?: boolean
    }) => {
      const res = await setWorkspacePermission(input)
      if (!res.success) throw new Error(res.error)
      return res.data.permission
    },
    onSuccess: (perm: WorkspacePermission) => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'permissions'] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'permission', perm.workspacePath] })
      queryClient.invalidateQueries({ queryKey: ['workspace', 'permission-rules'] })
    },
  })
}

/** 删除权限配置 */
export function useDeleteWorkspacePermission() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (workspacePath: string) => {
      const res = await deleteWorkspacePermission(workspacePath)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'permissions'] })
    },
  })
}
