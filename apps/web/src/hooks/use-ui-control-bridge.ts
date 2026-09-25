// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 DOM/window 与站内 WS,不适合共享
'use client'

/**
 * Web UI Agent Control Bridge(2026-09-20 立)——镜像 use-agent-control.ts 的 web 版姊妹实现:
 * 上报 endpoint:'web' 能力 + 消费 WS `agent.action`(category:'ui')→ ui-action-registry 执行 →
 * POST /api/agent-control/result 回传。
 *
 * Tauri 桌面端同样启用:桌面端跑的就是这份前端(DOM 同源可用),而 `category:'ui'` 与
 * use-agent-control 的 `category:'computer'` 是两条不相交的指令通道(api 按 category 择端),
 * 不构成"同页两端点抢同一指令";每个连接只处理自己 category 的消息。
 */
import * as React from 'react'

import { useTranslations } from 'next-intl'
import { createNotificationClient } from '@ihui/api-client'
import {
  createAssignmentTokenLedger,
  isAgentActionAssignedToInstance,
  unassignedAgentActionLogMessage,
  withRespondedIdentity,
  type AgentActionSelfIdentity,
} from '@ihui/shared/utils/agent-action-addressing'
import type {
  AgentActionAssignment,
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
import { useNavigateWithProgress } from '@/stores/navigation'
import { useAuthStore } from '@/stores/auth'
import { resolveWsApiBaseUrl } from '@/lib/api-base-url'

/**
 * UI 控制桥 WS 基址(必须绝对地址:api-client 内部 new URL() 解析,空串会抛错)。
 * 收口于 lib/api-base-url.ts(2026-09-21):桌面端薄壳加载线上站点,WS 必须同源线上,
 * 旧逻辑空 env 回退 127.0.0.1:8802 会连用户本机 dev 后端。
 */
const API_BASE = resolveWsApiBaseUrl()
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

/**
 * 定址投递(2026-09-26,与 extension / 桌面 webview 桥同一套共享判据):api 的 WS 按用户
 * 广播,`assignment` 由服务端派发时写入载荷 —— 非指派到本标签页的指令不得执行,且如实
 * 记日志(不静默 return);回执原样回显服务端 token + 自报本实例,身份对账在服务端做。
 * 缺 assignment = 旧服务端形态,逐字走改前路径(含回执不带 responded)。
 */
const assignmentTokens = createAssignmentTokenLedger(PROCESSED_IDS_MAX)

/** 本桥身份:端种类 'web' + 既有实例 id 单点(惰性取,模块加载期不得碰 window/SSR) */
function selfIdentity(): AgentActionSelfIdentity {
  return { endpoint: 'web', instanceId: getInstanceId() }
}

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
  const payload = withRespondedIdentity(response, assignmentTokens, selfIdentity())
  try {
    const res = await fetchApi<{ accepted: boolean }>('/api/agent-control/result', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (!res.success) console.warn('[web-ui] agent-control result report failed')
  } catch (err) {
    console.warn('[web-ui] agent-control result report error:', err)
  }
}

function extractAgentEnvelope(payload: unknown): {
  request: AgentActionRequest
  assignment?: AgentActionAssignment
} | null {
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
  const assignment = wsData.assignment as AgentActionAssignment | undefined
  return { request: req, ...(assignment ? { assignment } : {}) }
}

function isUiAction(action: unknown): action is UiControlActionType {
  return typeof action === 'string' && (UI_ACTIONS as string[]).includes(action)
}

function handleWsMessage(msg: WSNotification): void {
  const envelope = extractAgentEnvelope(msg)
  if (!envelope) return
  const { request: req, assignment } = envelope
  if (req.category !== 'ui' || !isUiAction(req.action)) return
  // 定址过滤:非指派到本实例不得执行,且留下可诊断痕迹(不得静默 return)
  if (!isAgentActionAssignedToInstance(assignment, selfIdentity())) {
    console.warn(
      '[web-ui]',
      unassignedAgentActionLogMessage(req.requestId, assignment, selfIdentity()),
    )
    return
  }
  if (processedIds.has(req.requestId)) return
  processedIds.add(req.requestId)
  if (processedIds.size > PROCESSED_IDS_MAX) {
    const arr = Array.from(processedIds)
    processedIds.clear()
    for (const id of arr.slice(-Math.floor(PROCESSED_IDS_MAX / 2))) processedIds.add(id)
  }
  if (assignment) assignmentTokens.remember(req.requestId, assignment.token)
  const start = performance.now()
  void executeUiAction(req.action, (req.params ?? {}) as Record<string, unknown>)
    .then((r): AgentActionResponse => {
      const payload = (r.data ?? {}) as Record<string, unknown>
      return {
        requestId: req.requestId,
        success: r.ok,
        ...(r.error !== undefined ? { error: r.error } : {}),
        ...(r.errorCode !== undefined ? { errorCode: r.errorCode } : {}),
        // 每条应答都带自身 instanceId:多标签页下调用方据此把后续动作钉回同一页面
        data: { ...payload, instanceId: getInstanceId() },
        durationMs: Math.max(0, Math.round(performance.now() - start)),
        executedBy: 'web',
      }
    })
    .then(reportResult)
    .catch((err) => {
      console.warn('[web-ui] agent-control action failed:', err)
    })
}

export function useUiControlBridge(): void {
  const t = useTranslations('commandPalette')
  const navigate = useNavigateWithProgress()
  const token = useAuthStore((s) => s.token)
  const enabled = typeof window !== 'undefined'

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

/** 测试面(2026-09-26 定址投递票,同 use-agent-control.ts):入站处理与身份直接驱动,不开写接口 */
export const __test__ = {
  handleWsMessage,
  selfIdentity,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
