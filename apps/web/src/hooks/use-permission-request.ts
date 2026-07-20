'use client'

import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'

export interface PermissionRequestPayload {
  requestId: string
  userId: string
  tool: string
  args: Record<string, unknown>
  workspacePath?: string
  createdAt: number
}

interface UsePermissionRequestOptions {
  userId?: string
}

/**
 * 监听 WebSocket 推送的权限确认请求(default 模式下,Agent 调用工具前会推送一条
 * permission.request 事件,前端弹出确认对话框,用户选择后调
 * POST /api/workspace/permissions/:requestId/resolve)。
 */
export function usePermissionRequest({ userId }: UsePermissionRequestOptions = {}) {
  const queryClient = useQueryClient()
  const [pendingRequests, setPendingRequests] = React.useState<PermissionRequestPayload[]>([])

  React.useEffect(() => {
    if (!userId) return

    let cancelled = false
    // 复用全局 WebSocket(由 use-websocket.ts 维护);此处通过自定义事件订阅
    const handler = (e: Event) => {
      if (cancelled) return
      const detail = (e as CustomEvent<{ type: string; payload: unknown }>).detail
      if (detail?.type !== 'permission.request') return
      const payload = detail.payload as PermissionRequestPayload
      if (payload.userId !== userId) return
      setPendingRequests((prev) => [...prev, payload])
    }
    window.addEventListener('ws:message', handler as EventListener)

    return () => {
      cancelled = true
      window.removeEventListener('ws:message', handler as EventListener)
    }
  }, [userId, queryClient])

  const dismiss = React.useCallback((requestId: string) => {
    setPendingRequests((prev) => prev.filter((r) => r.requestId !== requestId))
  }, [])

  return { pendingRequests, dismiss }
}
