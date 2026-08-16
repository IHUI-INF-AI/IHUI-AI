'use client'

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
import type {
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

// ===== Constants =====

/** Tauri 下 api-client detectApiBaseUrl 的取值一致;WS 需要显式 baseUrl。 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8802'
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
  try {
    const res = await fetchApi<{ accepted: boolean }>('/api/agent-control/result', {
      method: 'POST',
      body: JSON.stringify(response),
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
        await keyboardType(
          String(p.text ?? ''),
          typeof p.delay === 'number' ? p.delay : undefined,
        )
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
        const r = await clipboardGet(
          p.format === 'image' ? 'image' : undefined,
        )
        return {
          requestId: req.requestId,
          success: true,
          data: { clipboard: r.clipboard },
          durationMs: done(),
          executedBy: 'desktop',
        }
      }
      case 'clipboard_set': {
        await clipboardSet(
          String(p.content ?? ''),
          p.format === 'image' ? 'image' : undefined,
        )
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
 * 从 WS 消息中提取 AgentActionRequest(兼容直接 / { notification } 包装两种格式)。
 * 与 extension agent-control-bridge.ts 的 extractAgentRequest 一致。
 */
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

function handleWsMessage(msg: WSNotification): void {
  const req = extractAgentRequest(msg)
  if (!req || req.category !== 'computer') return
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
  void executeAction(req)
    .then(reportResult)
    .catch((err) => {
      console.warn('[desktop] agent-control action failed:', err)
    })
}

// ===== Hook =====

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
