// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 DOM/window 与站内 WS,不适合共享
'use client'

/**
 * Web UI Agent Control Bridge(2026-09-20 立)——镜像 use-agent-control.ts 的 web 版姊妹实现:
 * 上报 endpoint:'web' 能力 + 消费 WS `agent.action`(category:'ui')→ ui-action-registry 执行 →
 * POST /api/agent-control/result 回传。Tauri 下让位 desktop 桥,避免同页两端点抢同一指令。
 */
import * as React from 'react'

import { useTranslations } from 'next-intl'
import { createNotificationClient } from '@ihui/api-client'
import type {
  AgentActionRequest,
  AgentActionResponse,
  AgentControlCapability,
  UiControlActionType,
  WSNotification,
} from '@ihui/types'
import { fetchApi } from '@/lib/api'
import {
  configureUiControlBridge,
  executeUiAction,
  resetUiControlBridge,
} from '@/lib/ui-action-registry'
import { isTauri } from '@/lib/tauri-bridge'
import { useNavigateWithProgress } from '@/stores/navigation'
import { useAuthStore } from '@/stores/auth'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8802'
const CAPABILITY_INTERVAL_MS = 60_000
const VERSION = '1.0.0'
const PROCESSED_IDS_MAX = 100
const INSTANCE_STORAGE_KEY = 'ihui-web-ui-instance-id'

const UI_ACTIONS: UiControlActionType[] = [
  'describe',
  'navigate',
  'click',
  'fill',
  'submit',
  'read',
  'invoke',
]

/** requestId 去重:WS 重连后服务端可能重推同一指令,重复执行会双击/双提交 */
const processedIds = new Set<string>()

let cachedInstanceId: string | null = null
function getInstanceId(): string {
  if (cachedInstanceId) return cachedInstanceId
  let id: string | null = null
  try {
    id = window.sessionStorage.getItem(INSTANCE_STORAGE_KEY)
  } catch {
    id = null
  }
  if (!id || !id.startsWith('web-')) {
    id = `web-${Math.random().toString(36).slice(2, 10)}`
    try {
      window.sessionStorage.setItem(INSTANCE_STORAGE_KEY, id)
    } catch {
      // 隐私模式 sessionStorage 禁用,退化为内存级稳定 id
    }
  }
  cachedInstanceId = id
  return id
}

function buildCapability(): AgentControlCapability {
  return {
    endpoint: 'web',
    instanceId: getInstanceId(),
    uiActions: UI_ACTIONS,
    version: VERSION,
    reportedAt: new Date().toISOString(),
  }
}

async function reportCapability(): Promise<void> {
  try {
    const res = await fetchApi<{ registered: boolean; instanceId: string }>(
      '/api/agent-control/capability',
      { method: 'POST', body: JSON.stringify(buildCapability()) },
    )
    if (!res.success) console.warn('[web-ui] agent-control capability report failed')
  } catch (err) {
    console.warn('[web-ui] agent-control capability report error:', err)
  }
}

async function reportResult(response: AgentActionResponse): Promise<void> {
  try {
    const res = await fetchApi<{ accepted: boolean }>('/api/agent-control/result', {
      method: 'POST',
      body: JSON.stringify(response),
    })
    if (!res.success) console.warn('[web-ui] agent-control result report failed')
  } catch (err) {
    console.warn('[web-ui] agent-control result report error:', err)
  }
}

function extractAgentRequest(payload: unknown): AgentActionRequest | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  let wsData: Record<string, unknown> | undefined
  if (p.type === 'notification' && p.data && typeof p.data === 'object') {
    wsData = p.data as Record<string, unknown>
  } else if (p.notification && typeof p.notification === 'object') {
    const inner = p.notification as Record<string, unknown>
    if (inner.type === 'notification' && inner.data && typeof inner.data === 'object') {
      wsData = inner.data as Record<string, unknown>
    }
  }
  if (!wsData || wsData.type !== 'agent.action') return null
  const req = wsData.request as AgentActionRequest | undefined
  if (!req || typeof req !== 'object') return null
  return req
}

function isUiAction(action: unknown): action is UiControlActionType {
  return typeof action === 'string' && (UI_ACTIONS as string[]).includes(action)
}

function handleWsMessage(msg: WSNotification): void {
  const req = extractAgentRequest(msg)
  if (!req || req.category !== 'ui' || !isUiAction(req.action)) return
  if (processedIds.has(req.requestId)) return
  processedIds.add(req.requestId)
  if (processedIds.size > PROCESSED_IDS_MAX) {
    const arr = Array.from(processedIds)
    processedIds.clear()
    for (const id of arr.slice(-Math.floor(PROCESSED_IDS_MAX / 2))) processedIds.add(id)
  }
  const start = performance.now()
  void executeUiAction(req.action, (req.params ?? {}) as Record<string, unknown>)
    .then((r): AgentActionResponse => ({
      requestId: req.requestId,
      success: r.ok,
      ...(r.error !== undefined ? { error: r.error } : {}),
      ...(r.errorCode !== undefined ? { errorCode: r.errorCode } : {}),
      ...(r.data !== undefined ? { data: r.data } : {}),
      durationMs: Math.max(0, Math.round(performance.now() - start)),
      executedBy: 'web',
    }))
    .then(reportResult)
    .catch((err) => {
      console.warn('[web-ui] agent-control action failed:', err)
    })
}

export function useUiControlBridge(): void {
  const t = useTranslations('commandPalette')
  const navigate = useNavigateWithProgress()
  const isTauriEnv = isTauri()
  const token = useAuthStore((s) => s.token)
  const enabled = typeof window !== 'undefined' && !isTauriEnv

  // navigate/t 随路由切换变化,经 ref 转发避免每次变化重连 WS
  const navigateRef = React.useRef(navigate)
  navigateRef.current = navigate
  const tRef = React.useRef(t)
  tRef.current = t

  React.useEffect(() => {
    if (!enabled) return
    configureUiControlBridge({
      navigate: (href) => navigateRef.current(href),
      translate: (key) => {
        try {
          return tRef.current(key)
        } catch {
          return ''
        }
      },
    })
    return () => resetUiControlBridge()
  }, [enabled])

  React.useEffect(() => {
    if (!enabled || !token) return
    let disposed = false
    let capabilityTimer: number | null = null
    let wsClient: ReturnType<typeof createNotificationClient> | null = null

    const report = () => {
      if (disposed) return
      void reportCapability()
    }
    report()
    capabilityTimer = window.setInterval(report, CAPABILITY_INTERVAL_MS)

    wsClient = createNotificationClient(
      {
        baseUrl: API_BASE,
        tokenProvider: () => useAuthStore.getState().token,
      },
      { onMessage: handleWsMessage },
    )
    wsClient.connect()

    return () => {
      disposed = true
      if (capabilityTimer) window.clearInterval(capabilityTimer)
      wsClient?.disconnect()
    }
  }, [enabled, !!token])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
