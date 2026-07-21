/**
 * Agent Control Bridge — 打通 api ↔ extension 的完整链路(2026-07-22 立)。
 *
 * 职责:
 * 1. 启动时上报能力(POST /api/agent-control/capability),每 60s 定期上报保持端活跃
 * 2. 监听 ws.notification 消息,当 data.type === 'agent.action' 时执行 browser action
 * 3. 执行后通过 POST /api/agent-control/result 回传 AgentActionResponse
 *
 * 运行环境:background service worker(MV3)
 * WS 消息来源:sidepanel/popup 的 useNotificationWebSocket hook 收到后通过
 * chrome.runtime.sendMessage({ type: 'ws.notification', payload: WSNotification }) 广播
 */
import type {
  AgentActionRequest,
  AgentActionResponse,
  AgentControlCapability,
  BrowserControlActionType,
} from '@ihui/types'
import { getToken } from './token'
import {
  executeBackgroundAction,
  isDomAction,
  isBackgroundAction,
  type DomActionResult,
} from './agent-control'

// ===== Constants =====

const BRIDGE_BASE_URL = 'http://127.0.0.1:3001/api/agent-control'
const CAPABILITY_ALARM_NAME = 'ihui-agent-capability'
const CAPABILITY_INTERVAL_MIN = 1
const TOKEN_RETRY_MS = 5000
const VERSION = '1.0.0'

const BROWSER_ACTIONS: BrowserControlActionType[] = [
  'screenshot',
  'click_element',
  'type_text',
  'scroll',
  'extract_dom',
  'navigate',
  'wait_for_element',
  'get_attribute',
  'hover',
  'select_option',
  'switch_tab',
  'close_tab',
]

let bridgeInitialized = false

// ===== HTTP helper =====

async function postJson(path: string, body: unknown): Promise<boolean> {
  const token = getToken()
  if (!token) return false
  try {
    const res = await fetch(`${BRIDGE_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    return res.ok
  } catch {
    return false
  }
}

// ===== Capability reporting =====

function buildCapability(): AgentControlCapability {
  return {
    endpoint: 'extension',
    instanceId: `ext-${chrome.runtime.id}`,
    browserActions: BROWSER_ACTIONS,
    computerActions: [],
    version: VERSION,
    reportedAt: new Date().toISOString(),
  }
}

async function reportCapability(): Promise<void> {
  if (!getToken()) {
    // token 不存在(未登录),延迟 5s 后重试
    setTimeout(() => void reportCapability(), TOKEN_RETRY_MS)
    return
  }
  const ok = await postJson('/capability', buildCapability())
  if (!ok) {
    console.warn('[IHUI AI] agent-control bridge: capability report failed')
  }
}

// ===== Action execution =====

async function executeAgentAction(req: AgentActionRequest): Promise<AgentActionResponse> {
  const start = Date.now()
  const timeout = req.timeout ?? 30000
  const action = req.action as BrowserControlActionType

  let result: DomActionResult
  if (isDomAction(action)) {
    // DOM actions 在 content script 执行,需转发
    result = await forwardToContentScript(req)
  } else if (isBackgroundAction(action)) {
    // screenshot/navigate/switch_tab/close_tab 在 background 直接执行
    result = await executeBackgroundAction(action, req.params, timeout)
  } else {
    result = { success: false, errorCode: 'UNSUPPORTED_ACTION', error: `unsupported action: ${action}` }
  }

  return {
    requestId: req.requestId,
    success: result.success,
    error: result.error,
    errorCode: result.errorCode,
    data: result.data,
    durationMs: Date.now() - start,
    executedBy: 'extension',
  }
}

async function forwardToContentScript(req: AgentActionRequest): Promise<DomActionResult> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tabId = tabs[0]?.id
  if (typeof tabId !== 'number') {
    return { success: false, errorCode: 'TARGET_NOT_CONNECTED', error: 'no active tab' }
  }
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: 'agent.action.dom', payload: req },
      (response: DomActionResult | undefined) => {
        const lastErr = chrome.runtime.lastError
        if (lastErr) {
          resolve({ success: false, errorCode: 'TARGET_NOT_CONNECTED', error: lastErr.message })
          return
        }
        if (!response) {
          resolve({ success: false, errorCode: 'EXECUTION_FAILED', error: 'no response from content script' })
          return
        }
        resolve(response)
      },
    )
  })
}

async function reportResult(response: AgentActionResponse): Promise<void> {
  if (!getToken()) return
  const ok = await postJson('/result', response)
  if (!ok) {
    console.warn('[IHUI AI] agent-control bridge: result report failed')
  }
}

// ===== WS notification listener =====

/**
 * 从 ws.notification payload 中提取 AgentActionRequest。
 * 兼容两种 payload 格式:
 *  - WSNotification 直接作为 payload
 *  - { notification: WSNotification } 包装格式
 */
function extractAgentRequest(payload: unknown): AgentActionRequest | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>

  // 定位 WSNotification.data 对象(兼容直接 / 包装两种格式)
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

function onRuntimeMessage(msg: unknown): void {
  const m = msg as { type?: string; payload?: unknown }
  if (m?.type !== 'ws.notification') return
  const req = extractAgentRequest(m.payload)
  if (!req) return
  void executeAgentAction(req)
    .then(reportResult)
    .catch((err) => {
      console.warn('[IHUI AI] agent-control bridge: action failed:', err)
    })
}

// ===== Init =====

export function initAgentControlBridge(): void {
  if (bridgeInitialized) return
  bridgeInitialized = true

  // 1. 启动时上报能力
  void reportCapability()

  // 2. 每 60s 定期上报(MV3 service worker 用 chrome.alarms 替代 setInterval)
  chrome.alarms.create(CAPABILITY_ALARM_NAME, { periodInMinutes: CAPABILITY_INTERVAL_MIN })
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === CAPABILITY_ALARM_NAME) {
      void reportCapability()
    }
  })

  // 3. 监听 WS 通知消息(sidepanel/popup 广播的 ws.notification)
  chrome.runtime.onMessage.addListener(onRuntimeMessage)
}
