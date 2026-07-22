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
 *
 * 2026-07-22 P2 dedupe:删除重复的 executeAgentAction/forwardToContentScript,
 * 改用 agent-control.ts 抽取的 executeAgentActionRequest(与 background.ts 共用同一实现)。
 * 2026-07-22 P1 fix:BRIDGE_BASE_URL 改为从 ./config 派生,不再硬编码 127.0.0.1:8802。
 */
import type {
  AgentActionRequest,
  AgentActionResponse,
  AgentControlCapability,
  BrowserControlActionType,
} from '@ihui/types'
import { getToken } from './token'
import { BRIDGE_BASE_URL } from './config'
import { executeAgentActionRequest } from './agent-control'

// ===== Constants =====

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

/** requestId 去重集,防止 WS 重连后重复推送相同 lastMessage 导致同一 DOM 操作执行两次(与 desktop hook 一致) */
const _processedIds = new Set<string>()
const _PROCESSED_IDS_MAX = 100

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

// ===== Result reporting (action 执行已抽到 ./agent-control.ts executeAgentActionRequest,2026-07-22 P2 dedupe) =====

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
  // requestId 去重,防止 WS 重连后重复执行同一指令(与 desktop hook 一致)
  if (_processedIds.has(req.requestId)) return
  _processedIds.add(req.requestId)
  // 清理超过 _PROCESSED_IDS_MAX 的旧 requestId(避免 Set 无限增长)
  if (_processedIds.size > _PROCESSED_IDS_MAX) {
    const arr = Array.from(_processedIds)
    _processedIds.clear()
    for (const id of arr.slice(-Math.floor(_PROCESSED_IDS_MAX / 2))) {
      _processedIds.add(id)
    }
  }
  void executeAgentActionRequest(req)
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
