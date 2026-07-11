'use client'

import * as React from 'react'

import { useAuthStore } from '@/stores/auth'
import { useLocalStorage } from '@/hooks/use-local-storage'

export interface LoginProject {
  id: string
  name: string
  logo?: string
  redirectUrl?: string
}

export interface UseLoginProjectReturn {
  projects: LoginProject[]
  currentId: string | null
  current: LoginProject | null
  select: (id: string) => void
  addProject: (project: LoginProject) => void
  removeProject: (id: string) => void
}

/** 登录项目 Hook，管理登录页可选的项目/租户切换 */
export function useLoginProject(): UseLoginProjectReturn {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [projects, setProjects] = useLocalStorage<LoginProject[]>('login-projects', [])
  const [currentId, setCurrentId] = useLocalStorage<string | null>('login-project-current', null)

  const select = React.useCallback(
    (id: string) => {
      setCurrentId(id)
    },
    [setCurrentId],
  )

  const addProject = React.useCallback(
    (project: LoginProject) => {
      setProjects((prev) => (prev.some((p) => p.id === project.id) ? prev : [...prev, project]))
    },
    [setProjects],
  )

  const removeProject = React.useCallback(
    (id: string) => {
      setProjects((prev) => prev.filter((p) => p.id !== id))
      setCurrentId((cur) => (cur === id ? null : cur))
    },
    [setProjects, setCurrentId],
  )

  const current = React.useMemo(
    () => projects.find((p) => p.id === currentId) ?? null,
    [projects, currentId],
  )

  // 已认证时清空项目选择（避免残留）
  React.useEffect(() => {
    if (isAuthenticated) setCurrentId(null)
  }, [isAuthenticated, setCurrentId])

  return { projects, currentId, current, select, addProject, removeProject }
}
