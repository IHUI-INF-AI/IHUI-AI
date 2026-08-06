'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/query-client'
import { useAuthStore } from '@/stores/auth'

export function QueryProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  // 2026-08-06 修复:登录/静默登录成功后失效全部查询。
  // 原因:access token 过期时对话列表等请求 401 进入 error 态(界面"加载失败");
  // 重新登录拿到新 token 后,react-query 缓存仍是失败状态(query key 未变、
  // staleTime 未过期且无 invalidate) → 界面一直显示"加载失败"直到手动刷新。
  // 监听登录态 false→true,全量 invalidate 让所有数据用新 token 重新拉取。
  const prevAuth = useRef(isAuthenticated)
  useEffect(() => {
    if (isAuthenticated && !prevAuth.current) {
      void queryClient.invalidateQueries()
    }
    prevAuth.current = isAuthenticated
  }, [isAuthenticated, queryClient])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

export default QueryProvider
