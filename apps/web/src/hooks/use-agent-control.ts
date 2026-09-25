// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// 链名: chain: replayable —— 本文件消费的是「断线重放链」:api 侧 `agent.action` 经 WS 送达,
// 同一用户的多个连接/重连都可能把同一条指令再送一次(投递保证是"至少一次"),所以这里必须按
// 指令 id 做幂等去重。与之相对的桌面原生事件总线是 chain: continuous(见 use-desktop.ts),
// 那条链没有 id 也没有队列,两者语义不得互换 —— 判据 scripts/check-desktop-event-wiring.mjs 规则 E。

/**
 * Desktop Agent Control Bridge(2026-08-16 立)——打通 LLM computer_* 工具 →
 * api → desktop(webview)的完整闭环,镜像 apps/extension/lib/agent-control-bridge.ts。
 *
 * 职责:
 * 1. 登录后上报能力(POST /api/agent-control/capability, endpoint:'desktop'),
 *    每 60s 保活(api 侧 ENDPOINT_TTL_MS = 5min)
 * 2. 监听 WS 推送 data.type === 'agent.action' 且 category === 'computer',
 *    分发到 tauri-bridge 的 Rust 命令执行
 * 3. 执行后 POST /api/agent-control/result 回传 AgentActionResponse
 *
 * 仅 Tauri 环境生效(浏览器端 no-op);HTTP 走 fetchApi(自动 baseUrl + Bearer + 401 刷新),
 * WS 直连本地 API server(http://127.0.0.1:8802),不能用 useWebSocket(window.location.origin
 * 在 Tauri 下是 tauri://localhost,会连到错误端口)。
 */
import * as React from 'react'

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
  ComputerControlActionType,
  WSNotification,
} from '@ihui/types'
import { fetchApi } from '@/lib/api'
import {
  clipboardGet,
  clipboardSet,
  getActiveWindow,
  isTauri,
  keyboardHotkey,
  keyboardPress,
  keyboardType,
  mouseClick,
  mouseMove,
  mouseScroll,
  screenshotScreen,
} from '@/lib/tauri-bridge'
import { useAuthStore } from '@/stores/auth'
import { resolveWsApiBaseUrl } from '@/lib/api-base-url'

// ===== Constants =====

/**
 * 通知 WS 基址(必须绝对地址:api-client 内部 new URL() 解析,空串会抛错)。
 * 收口于 lib/api-base-url.ts(2026-09-21):桌面端是薄壳 —— 主窗口加载线上
 * https://aizhs.top/agents,WS 必须同源线上;旧逻辑回退 127.0.0.1:8802 会让
 * 桌面端通知通道连用户本机 dev 后端(连不上或打到本地库)。
 */
const API_BASE = resolveWsApiBaseUrl()
const CAPABILITY_INTERVAL_MS = 60_000
const VERSION = '1.0.0'
const PROCESSED_IDS_MAX = 100

const COMPUTER_ACTIONS: ComputerControlActionType[] = [
  'screenshot_screen',
  'mouse_move',
  'mouse_click',
  'keyboard_type',
  'mouse_scroll',
  'keyboard_press',
  'keyboard_hotkey',
  'active_window',
  'clipboard_get',
  'clipboard_set',
]

/** requestId 去重集,防止 WS 重连后重复推送导致同一操作执行两次(与 extension bridge 一致)。 */
const processedIds = new Set<string>()

/**
 * 稳定的实例 ID:hook 生命周期内固定(首次生成后缓存)。
 * 2026-08-16 修复:此前每次上报都生成新 UUID,api 端 _endpoints 会按新 instanceId
 * 累积条目(5min TTL 清理,但 60s 一次的保活会让表里始终有多个同端实例)。
 */
let cachedInstanceId: string | null = null
function getInstanceId(): string {
  if (!cachedInstanceId) {
    cachedInstanceId = `desktop-${crypto.randomUUID()}`
  }
  return cachedInstanceId
}

/**
 * 定址投递(2026-09-26,共享层收口):判定本身住在
 * `@ihui/shared/utils/agent-action-addressing`(五桥一份实现),本文件只注入自身身份。
 * api 的 WS 推送按用户广播,assignment 由服务端派发时写入载荷 —— 非指派端不得执行,
 * 且如实记日志(不静默 return);回执原样回显 token + 自报本实例,身份对账在服务端做。
 */
const assignmentTokens = createAssignmentTokenLedger(PROCESSED_IDS_MAX)

function selfIdentity(): AgentActionSelfIdentity {
  return { endpoint: 'desktop', instanceId: getInstanceId() }
}

/** requestId → assignment.token(仅缓存服务端下发值,不在端内计算期望身份) */
function recordAssignment(requestId: string, assignment: AgentActionAssignment): void {
  assignmentTokens.remember(requestId, assignment.token)
}

/** 取出并消费本请求的回显 token(无 = 旧服务端形态,回执不带身份) */
function takeAssignmentToken(requestId: string): string | undefined {
  return assignmentTokens.take(requestId)
}

/** 本条指令是否指派给本实例:无 assignment(旧服务端)按原语义执行;有则须端种类 + 实例一致 */
function isAssignedToThisInstance(assignment: AgentActionAssignment | undefined): boolean {
  return isAgentActionAssignedToInstance(assignment, selfIdentity())
}

// ===== Capability reporting =====

function buildCapability(): AgentControlCapability {
  return {
    endpoint: 'desktop',
    instanceId: getInstanceId(),
    browserActions: [],
    computerActions: COMPUTER_ACTIONS,
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
    if (!res.success) {
      console.warn('[desktop] agent-control capability report failed')
    }
  } catch (err) {
    console.warn('[desktop] agent-control capability report error:', err)
  }
}

// ===== Result reporting =====

async function reportResult(response: AgentActionResponse): Promise<void> {
  const payload = withRespondedIdentity(response, assignmentTokens, selfIdentity())
  try {
    const res = await fetchApi<{ accepted: boolean }>('/api/agent-control/result', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (!res.success) {
      console.warn('[desktop] agent-control result report failed')
    }
  } catch (err) {
    console.warn('[desktop] agent-control result report error:', err)
  }
}

// ===== Action execution =====

async function executeAction(req: AgentActionRequest): Promise<AgentActionResponse> {
  const start = performance.now()
  const done = () => Math.max(0, Math.round(performance.now() - start))
  try {
    const p = (req.params ?? {}) as Record<string, unknown>
    switch (req.action) {
      case 'screenshot_screen': {
        const r = await screenshotScreen(
          typeof p.displayIndex === 'number' ? p.displayIndex : undefined,
          Array.isArray(p.region) ? (p.region as [number, number, number, number]) : undefined,
        )
        return {
          requestId: req.requestId,
          success: true,
          data: { screenshot: r.screenshot },
          durationMs: done(),
          executedBy: 'desktop',
        }
      }
      case 'mouse_move': {
        await mouseMove(
          Number(p.x) || 0,
          Number(p.y) || 0,
          typeof p.absolute === 'boolean' ? p.absolute : undefined,
        )
        break
      }
      case 'mouse_click': {
        await mouseClick(
          Number(p.x) || 0,
          Number(p.y) || 0,
          p.button === 'right' || p.button === 'middle' ? p.button : undefined,
          typeof p.count === 'number' ? p.count : undefined,
        )
        break
      }
      case 'keyboard_type': {
        await keyboardType(String(p.text ?? ''), typeof p.delay === 'number' ? p.delay : undefined)
        break
      }
      case 'mouse_scroll': {
        await mouseScroll(
          Number(p.deltaY) || 0,
          typeof p.x === 'number' ? p.x : undefined,
          typeof p.y === 'number' ? p.y : undefined,
        )
        break
      }
      case 'keyboard_press': {
        await keyboardPress(String(p.key ?? ''))
        break
      }
      case 'keyboard_hotkey': {
        await keyboardHotkey(Array.isArray(p.keys) ? (p.keys as string[]) : [])
        break
      }
      case 'active_window': {
        const r = await getActiveWindow()
        return {
          requestId: req.requestId,
          success: true,
          data: {
            window: {
              title: r.window.title,
              appName: r.window.appName,
              // Rust 端 active_window 已返回真实窗口矩形(2026-08-16)
              bounds: r.window.bounds,
            },
          },
          durationMs: done(),
          executedBy: 'desktop',
        }
      }
      case 'clipboard_get': {
        const r = await clipboardGet(p.format === 'image' ? 'image' : undefined)
        return {
          requestId: req.requestId,
          success: true,
          data: { clipboard: r.clipboard },
          durationMs: done(),
          executedBy: 'desktop',
        }
      }
      case 'clipboard_set': {
        await clipboardSet(String(p.content ?? ''), p.format === 'image' ? 'image' : undefined)
        break
      }
      default:
        return {
          requestId: req.requestId,
          success: false,
          error: `Unsupported action: ${String(req.action)}`,
          errorCode: 'UNSUPPORTED_ACTION',
          durationMs: done(),
          executedBy: 'desktop',
        }
    }
    return {
      requestId: req.requestId,
      success: true,
      durationMs: done(),
      executedBy: 'desktop',
    }
  } catch (err) {
    return {
      requestId: req.requestId,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      errorCode: 'EXECUTION_FAILED',
      durationMs: done(),
      executedBy: 'desktop',
    }
  }
}

// ===== WS notification listener =====

/**
 * 从 WS 消息中提取 AgentActionRequest 与服务端派发的定址信封 assignment
 * (兼容直接 / { notification } 包装两种格式)。与 extension agent-control-bridge.ts 一致。
 */
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

function handleWsMessage(msg: WSNotification): void {
  const envelope = extractAgentEnvelope(msg)
  if (!envelope) return
  const { request: req, assignment } = envelope
  if (req.category !== 'computer') return
  // 定址过滤(2026-09-26):非指派端不得执行;如实记日志,不得静默 return
  if (!isAssignedToThisInstance(assignment)) {
    console.warn(
      '[desktop] agent-control:',
      unassignedAgentActionLogMessage(req.requestId, assignment, selfIdentity()),
    )
    return
  }
  // requestId 去重,防止 WS 重连后重复执行同一指令
  if (processedIds.has(req.requestId)) return
  processedIds.add(req.requestId)
  if (processedIds.size > PROCESSED_IDS_MAX) {
    const arr = Array.from(processedIds)
    processedIds.clear()
    for (const id of arr.slice(-Math.floor(PROCESSED_IDS_MAX / 2))) {
      processedIds.add(id)
    }
  }
  if (assignment) recordAssignment(req.requestId, assignment)
  void executeAction(req)
    .then(reportResult)
    .catch((err) => {
      console.warn('[desktop] agent-control action failed:', err)
    })
}

// ===== Hook =====

/** 测试面(2026-09-26 定址投递票):入站处理与判据直接驱动,不开写接口 */
export const __test__ = {
  handleWsMessage,
  isAssignedToThisInstance,
  getInstanceId,
  takeAssignmentToken,
}

/**
 * 全局挂载(浏览器端 no-op):
 * - 登录后上报能力 + 60s 保活
 * - 连接本地 WS,消费 agent.action 推送
 * - token 从无到有时自动启动(依赖 !!token)
 */
export function useAgentControl(): void {
  const isTauriEnv = isTauri()
  const token = useAuthStore((s) => s.token)

  React.useEffect(() => {
    if (!isTauriEnv || !token) return
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
  }, [isTauriEnv, !!token])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
