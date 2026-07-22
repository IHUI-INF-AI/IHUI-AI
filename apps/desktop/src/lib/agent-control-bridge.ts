/**
 * Agent Control Bridge(desktop 端,2026-07-22 立)
 *
 * 打通 api ↔ desktop 的 AI 电脑控制链路:
 *  - 启动时上报能力(POST /api/agent-control/capability),每 60s 续期保持活跃
 *  - 监听 WebSocket agent.action 消息,调用 agent-control.ts 执行 Tauri IPC
 *  - 执行后回传结果(POST /api/agent-control/result)
 *
 * 调用方:useAgentControlBridge hook 在应用启动时调用 initAgentControlBridge,
 * 收到 WS agent.action 消息时调用 handleAgentAction。
 */
import type {
  AgentActionRequest,
  AgentActionResponse,
  AgentControlCapability,
  ComputerControlActionType,
} from '@ihui/types'
import {
  activeWindow,
  clipboardGet,
  clipboardSet,
  keyboardHotkey,
  keyboardPress,
  keyboardType,
  mouseClick,
  mouseMove,
  mouseScroll,
  screenshotScreen,
} from './agent-control'
import { getToken } from './token'

const API_BASE = 'http://127.0.0.1:3002/api/agent-control'
const CAPABILITY_INTERVAL_MS = 60_000
const RETRY_DELAY_MS = 5_000
const VERSION = '1.0.0'

/** 端实例 ID,模块级常量(进程生命周期内稳定) */
const INSTANCE_ID = `desktop-${Date.now()}`

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

interface BridgeState {
  token: string
  capabilityTimer: ReturnType<typeof setInterval> | null
  retryTimer: ReturnType<typeof setTimeout> | null
}

let state: BridgeState | null = null

function headers(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

async function reportCapability(token: string): Promise<void> {
  const payload: AgentControlCapability = {
    endpoint: 'desktop',
    instanceId: INSTANCE_ID,
    browserActions: [],
    computerActions: COMPUTER_ACTIONS,
    version: VERSION,
    reportedAt: new Date().toISOString(),
  }
  try {
    const res = await fetch(`${API_BASE}/capability`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.warn('[agent-control-bridge] capability report failed:', res.status)
    }
  } catch (err) {
    console.warn('[agent-control-bridge] capability report error:', err)
  }
}

async function postResult(token: string, response: AgentActionResponse): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/result`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(response),
    })
    if (!res.ok) {
      console.warn('[agent-control-bridge] result post failed:', res.status)
    }
  } catch (err) {
    console.warn('[agent-control-bridge] result post error:', err)
  }
}

async function executeAction(req: AgentActionRequest): Promise<AgentActionResponse> {
  const startedAt = Date.now()
  // 动态分发:params 类型由 action 决定,agent-control.ts 内部已做 Args 转换
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = req.params as any
  const timeoutMs = req.timeout ?? 30000
  const finalize = (
    success: boolean,
    data?: AgentActionResponse['data'],
    error?: string,
    errorCode?: AgentActionResponse['errorCode'],
  ): AgentActionResponse => ({
    requestId: req.requestId,
    success,
    data,
    error,
    errorCode,
    durationMs: Date.now() - startedAt,
    executedBy: 'desktop',
  })

  // Tauri IPC 超时保护:防止 invoke() 卡住导致 Promise 永远 pending
  // (api 端 pending Map 会超时,但 desktop 的 Promise 不会,这里加 race 保护)
  function withTimeout<T>(p: Promise<T>): Promise<T> {
    return Promise.race([
      p,
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Tauri IPC timed out after ${timeoutMs}ms`))
        }, timeoutMs)
      }),
    ])
  }

  try {
    // 用 unknown 承接各 action 返回的具体接口类型(ScreenshotResult/OkResult/...),
    // 这些接口无索引签名,不能直接赋给 AgentActionResponse['data'],故在 finalize 处统一 cast
    let data: unknown
    switch (req.action) {
      case 'screenshot_screen':
        data = await withTimeout(screenshotScreen(params))
        break
      case 'mouse_move':
        data = await withTimeout(mouseMove(params))
        break
      case 'mouse_click':
        data = await withTimeout(mouseClick(params))
        break
      case 'keyboard_type':
        data = await withTimeout(keyboardType(params))
        break
      case 'mouse_scroll':
        data = await withTimeout(mouseScroll(params))
        break
      case 'keyboard_press':
        data = await withTimeout(keyboardPress(params))
        break
      case 'keyboard_hotkey':
        data = await withTimeout(keyboardHotkey(params))
        break
      case 'active_window':
        data = await withTimeout(activeWindow())
        break
      case 'clipboard_get':
        data = await withTimeout(clipboardGet(params))
        break
      case 'clipboard_set':
        data = await withTimeout(clipboardSet(params))
        break
      default:
        return finalize(
          false,
          undefined,
          `Unsupported action: ${req.action}`,
          'UNSUPPORTED_ACTION',
        )
    }
    return finalize(true, data as AgentActionResponse['data'])
  } catch (err) {
    const errMsg = (err as Error).message
    // 超时错误用 TIMEOUT 错误码,其他用 EXECUTION_FAILED
    const errorCode = errMsg.includes('timed out') ? 'TIMEOUT' : 'EXECUTION_FAILED'
    return finalize(false, undefined, errMsg, errorCode)
  }
}

/** 处理 WS 推送的 agent.action 消息:执行 Tauri IPC + 回传结果 */
export async function handleAgentAction(req: AgentActionRequest): Promise<void> {
  if (!state) {
    console.warn('[agent-control-bridge] handleAgentAction called before init')
    return
  }
  const response = await executeAction(req)
  await postResult(state.token, response)
}

/**
 * 初始化 Agent Control Bridge
 * - token 非空:立即上报能力 + 每 60s 续期
 * - token 为空:每 5s 重试读取 getToken(),拿到后切到 60s 续期
 * @returns cleanup 函数(组件卸载或 token 变化时调用)
 */
export function initAgentControlBridge(initialToken: string): () => void {
  if (state?.capabilityTimer) clearInterval(state.capabilityTimer)
  if (state?.retryTimer) clearTimeout(state.retryTimer)

  state = { token: initialToken, capabilityTimer: null, retryTimer: null }

  const startReporting = (token: string): void => {
    if (!state) return
    state.token = token
    void reportCapability(token)
    state.capabilityTimer = setInterval(() => {
      if (state) void reportCapability(state.token)
    }, CAPABILITY_INTERVAL_MS)
  }

  if (initialToken) {
    startReporting(initialToken)
  } else {
    const retry = (): void => {
      if (!state) return
      const t = getToken()
      if (t) {
        startReporting(t)
      } else {
        state.retryTimer = setTimeout(retry, RETRY_DELAY_MS)
      }
    }
    state.retryTimer = setTimeout(retry, RETRY_DELAY_MS)
  }

  return () => {
    if (state?.capabilityTimer) clearInterval(state.capabilityTimer)
    if (state?.retryTimer) clearTimeout(state.retryTimer)
    state = null
  }
}
