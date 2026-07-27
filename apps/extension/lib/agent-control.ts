/**
 * AI Agent 浏览器控制执行器(2026-07-22 立)
 *
 * 实现 12 个 BrowserControlAction:
 * - DOM actions(在 content script 执行):click_element / type_text / scroll / extract_dom /
 *   wait_for_element / get_attribute / hover / select_option
 *   → 2026-07-27 已下沉到 @ihui/dom-actions 共享包(8 端可复用,无 chrome.* 依赖)
 * - Background actions(在 service worker 执行):screenshot / navigate / switch_tab / close_tab
 *   → 保留在本文件(依赖 chrome.tabs API,无法跨端复用)
 *
 * 调用方:background.ts routeMessage / agent-control-bridge.ts onRuntimeMessage / content.ts agent.action.dom handler
 * 2026-07-22 P2 dedupe:新增 executeAgentActionRequest + forwardRequestToContentScript 共享函数,
 * 供 background.ts 和 agent-control-bridge.ts 共用,消除重复实现。
 * 2026-07-27 P2 共享化:DOM action 实现迁移到 @ihui/dom-actions,本文件保留 re-export
 * 以保持 content.ts / tests 的 import 路径不变。
 */
import type { BrowserControlActionType, AgentActionRequest, AgentActionResponse } from '@ihui/types'
import { type DomActionResult, isDomAction, executeDomAction } from '@ihui/dom-actions'

// re-export 保持下游 import 路径不变:
// - content.ts: `import { executeDomAction } from '../lib/agent-control'`
// - tests/agent-control.test.ts: `import { isDomAction } from '../lib/agent-control'`
export { executeDomAction, isDomAction }

// ===== Background action classification =====

const BACKGROUND_ACTIONS = new Set<BrowserControlActionType>([
  'screenshot',
  'navigate',
  'switch_tab',
  'close_tab',
])

export function isBackgroundAction(action: BrowserControlActionType): boolean {
  return BACKGROUND_ACTIONS.has(action)
}

// ===== Background action executor (runs in service worker) =====

export async function executeBackgroundAction(
  action: BrowserControlActionType,
  params: Record<string, unknown>,
  timeoutMs = 30000,
): Promise<DomActionResult> {
  if (!isBackgroundAction(action)) {
    return {
      success: false,
      errorCode: 'UNSUPPORTED_ACTION',
      error: `not a background action: ${action}`,
    }
  }
  const exec = doBackgroundAction(action, params)
  const timeout = new Promise<DomActionResult>((resolve) => {
    setTimeout(() => {
      resolve({
        success: false,
        errorCode: 'TIMEOUT',
        error: `action ${action} timed out after ${timeoutMs}ms`,
      })
    }, timeoutMs)
  })
  return Promise.race([exec, timeout])
}

async function doBackgroundAction(
  action: BrowserControlActionType,
  params: Record<string, unknown>,
): Promise<DomActionResult> {
  switch (action) {
    case 'screenshot':
      return bgScreenshot(params)
    case 'navigate':
      return bgNavigate(params)
    case 'switch_tab':
      return bgSwitchTab(params)
    case 'close_tab':
      return bgCloseTab(params)
    default:
      return {
        success: false,
        errorCode: 'UNSUPPORTED_ACTION',
        error: `unsupported background action: ${action}`,
      }
  }
}

async function bgScreenshot(params: Record<string, unknown>): Promise<DomActionResult> {
  const requestedArea = (params.area as 'viewport' | 'fullpage' | 'element') ?? 'viewport'
  // captureVisibleTab only captures current viewport — fullpage/element 降级为 viewport
  const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' })
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
  const degraded = requestedArea !== 'viewport'
  return {
    success: true,
    data: {
      screenshot: base64,
      area: 'viewport',
      ...(degraded
        ? {
            warning: `requested ${requestedArea} but only viewport captured (chrome.tabs.captureVisibleTab limitation)`,
          }
        : {}),
    },
  }
}

async function bgNavigate(params: Record<string, unknown>): Promise<DomActionResult> {
  const url = params.url as string
  const timeout = (params.timeout as number) ?? 30000
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tabId = tabs[0]?.id
  if (typeof tabId !== 'number') {
    return { success: false, errorCode: 'TARGET_NOT_CONNECTED', error: 'no active tab' }
  }
  await chrome.tabs.update(tabId, { url })
  const result = await waitForTabComplete(tabId, url, timeout)
  return { success: true, data: result }
}

function waitForTabComplete(
  tabId: number,
  fallbackUrl: string,
  timeoutMs: number,
): Promise<{ url: string; title: string }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      resolve({ url: fallbackUrl, title: '' })
    }, timeoutMs)
    const listener = (id: number, info: { status?: string }, tab: chrome.tabs.Tab) => {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer)
        chrome.tabs.onUpdated.removeListener(listener)
        resolve({ url: tab.url || fallbackUrl, title: tab.title || '' })
      }
    }
    chrome.tabs.onUpdated.addListener(listener)
  })
}

async function bgSwitchTab(params: Record<string, unknown>): Promise<DomActionResult> {
  const index = params.index as number
  const tabs = await chrome.tabs.query({ currentWindow: true })
  const tab = tabs[index]
  if (!tab || typeof tab.id !== 'number') {
    return {
      success: false,
      errorCode: 'EXECUTION_FAILED',
      error: `tab index out of range: ${index}`,
    }
  }
  await chrome.tabs.update(tab.id, { active: true })
  return { success: true, data: { url: tab.url || '', title: tab.title || '', index } }
}

async function bgCloseTab(params: Record<string, unknown>): Promise<DomActionResult> {
  const index = params.index as number
  const tabs = await chrome.tabs.query({ currentWindow: true })
  const tab = tabs[index]
  if (!tab || typeof tab.id !== 'number') {
    return {
      success: false,
      errorCode: 'EXECUTION_FAILED',
      error: `tab index out of range: ${index}`,
    }
  }
  await chrome.tabs.remove(tab.id)
  return { success: true, data: { closed: true, index } }
}

// ===== Shared agent action dispatcher (2026-07-22 抽取,消除 background.ts 与 agent-control-bridge.ts 重复) =====

/**
 * 共享:执行 AgentActionRequest,自动分发 DOM action(转发到 content script)或 background action(本地执行)。
 * 供 background.ts 的 routeMessage 'agent.action' 和 agent-control-bridge.ts 的 onRuntimeMessage 共用。
 */
export async function executeAgentActionRequest(
  req: AgentActionRequest,
): Promise<AgentActionResponse> {
  const start = Date.now()
  const timeout = req.timeout ?? 30000
  const action = req.action as BrowserControlActionType

  let result: DomActionResult
  if (isDomAction(action)) {
    result = await forwardRequestToContentScript(req)
  } else if (isBackgroundAction(action)) {
    result = await executeBackgroundAction(action, req.params, timeout)
  } else {
    result = {
      success: false,
      errorCode: 'UNSUPPORTED_ACTION',
      error: `unsupported action: ${action}`,
    }
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

/**
 * 共享:将 DOM action 请求转发到当前 active tab 的 content script,带超时。
 */
export async function forwardRequestToContentScript(
  req: AgentActionRequest,
): Promise<DomActionResult> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tabId = tabs[0]?.id
  if (typeof tabId !== 'number') {
    return { success: false, errorCode: 'TARGET_NOT_CONNECTED', error: 'no active tab' }
  }
  const timeoutMs = req.timeout ?? 30000
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({
        success: false,
        errorCode: 'TIMEOUT',
        error: `content script no response after ${timeoutMs}ms`,
      })
    }, timeoutMs)
    chrome.tabs.sendMessage(
      tabId,
      { type: 'agent.action.dom', payload: req },
      (response: DomActionResult | undefined) => {
        clearTimeout(timer)
        const lastErr = chrome.runtime.lastError
        if (lastErr) {
          resolve({ success: false, errorCode: 'TARGET_NOT_CONNECTED', error: lastErr.message })
          return
        }
        if (!response) {
          resolve({
            success: false,
            errorCode: 'EXECUTION_FAILED',
            error: 'no response from content script',
          })
          return
        }
        resolve(response)
      },
    )
  })
}
