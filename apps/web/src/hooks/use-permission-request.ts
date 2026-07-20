'use client'

import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  listPendingPermissionRequests,
  resolvePermissionRequest,
} from '@ihui/api-client/endpoints/workspace'

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
 * 监听 WebSocket 推送的权限确认请求(default / accept-edits 无匹配模式,FS Bridge
 * 工具调用前会推送一条 workspace.permission.request 事件,前端弹窗展示后,
 * 用户选择后调 POST /api/workspace/permission/requests/:requestId/resolve)。
 *
 * 同时仍兼容旧的 permission.request 事件(AgentLoop 用),统一收集展示。
 */
export function usePermissionRequest({ userId }: UsePermissionRequestOptions = {}) {
  const queryClient = useQueryClient()
  const [pendingRequests, setPendingRequests] = React.useState<PermissionRequestPayload[]>([])

  // 页面加载时拉一次后端 pending 列表(兜底:刷新时仍存在的待决请求)
  React.useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      const res = await listPendingPermissionRequests()
      if (cancelled || !res.success) return
      const items: PermissionRequestPayload[] = (res.data?.requests ?? []).map((r) => ({
        requestId: r.requestId,
        userId: r.userId,
        tool: r.tool,
        args: r.args,
        createdAt: r.createdAt,
      }))
      if (items.length > 0) {
        setPendingRequests((prev) => {
          const known = new Set(prev.map((p) => p.requestId))
          return [...prev, ...items.filter((i) => !known.has(i.requestId))]
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  React.useEffect(() => {
    if (!userId) return

    let cancelled = false
    // 复用全局 WebSocket(由 use-websocket.ts 维护);此处通过自定义事件订阅
    const handler = (e: Event) => {
      if (cancelled) return
      const detail = (e as CustomEvent<{ type: string; payload: unknown }>).detail
      // workspace_permissions 系统的待决请求
      if (detail?.type === 'workspace.permission.request') {
        const payload = detail.payload as PermissionRequestPayload
        if (payload.userId !== userId) return
        setPendingRequests((prev) => {
          if (prev.some((p) => p.requestId === payload.requestId)) return prev
          return [...prev, payload]
        })
        return
      }
      // 兼容旧 AgentLoop 的 permission.request 事件
      if (detail?.type === 'permission.request') {
        const payload = detail.payload as PermissionRequestPayload
        if (payload.userId !== userId) return
        setPendingRequests((prev) => {
          if (prev.some((p) => p.requestId === payload.requestId)) return prev
          return [...prev, payload]
        })
      }
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

  /**
   * 用户决策:调用后端 resolve 端点 → 后端 Promise 解锁 → 等待中的 FS 工具调用同步放行/拒绝。
   */
  const resolve = React.useCallback(
    async (requestId: string, approved: boolean, reason?: string) => {
      dismiss(requestId)
      await resolvePermissionRequest(requestId, approved, reason)
    },
    [dismiss],
  )

  return { pendingRequests, dismiss, resolve }
}
