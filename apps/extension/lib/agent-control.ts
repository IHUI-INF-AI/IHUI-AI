/**
 * AI Agent 浏览器控制执行器(2026-07-22 立)
 *
 * 实现 12 个 BrowserControlAction:
 * - DOM actions(在 content script 执行):click_element / type_text / scroll / extract_dom /
 *   wait_for_element / get_attribute / hover / select_option
 *   → 2026-07-27 已下沉到 @ihui/dom-actions 共享包(8 端可复用,无 chrome.* 依赖)
 * - Background actions(在 service worker 执行):screenshot / navigate / switch_tab / close_tab
 *   → 2026-07-27 已迁移到 @ihui/browser-platform 适配层(chrome.* 调用统一走 platform.tabs)
 *
 * 调用方:background.ts routeMessage / agent-control-bridge.ts onRuntimeMessage / content.ts agent.action.dom handler
 * 2026-07-22 P2 dedupe:新增 executeAgentActionRequest + forwardRequestToContentScript 共享函数,
 * 供 background.ts 和 agent-control-bridge.ts 共用,消除重复实现。
 * 2026-07-27 P2 共享化:DOM action 迁移到 @ihui/dom-actions;chrome.tabs 调用迁移到
 * @ihui/browser-platform 适配层,本文件保留 re-export 保持下游 import 路径不变。
 */
import type { BrowserControlActionType, AgentActionRequest, AgentActionResponse } from '@ihui/types'
import { type DomActionResult, isDomAction, executeDomAction } from '@ihui/dom-actions'
import { createChromePlatform } from '@ihui/browser-platform'

const platform = createChromePlatform()

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
  const base64 = await platform.tabs.captureVisibleTab()
  const degraded = requestedArea !== 'viewport'
  return {
    success: true,
    data: {
      screenshot: base64,
      area: 'viewport',
      ...(degraded
        ? {
            warning: `requested ${requestedArea} but only viewport captured (platform.tabs.captureVisibleTab limitation)`,
          }
        : {}),
    },
  }
}

async function bgNavigate(params: Record<string, unknown>): Promise<DomActionResult> {
  const url = params.url as string
  const timeout = (params.timeout as number) ?? 30000
  const activeTab = await platform.tabs.queryActiveTab()
  if (!activeTab) {
    return { success: false, errorCode: 'TARGET_NOT_CONNECTED', error: 'no active tab' }
  }
  const result = await platform.tabs.navigateTab(activeTab.id, url, timeout)
  return { success: true, data: { id: result.id, url: result.url, title: result.title } }
}

async function bgSwitchTab(params: Record<string, unknown>): Promise<DomActionResult> {
  const index = params.index as number
  const tabs = await platform.tabs.listTabs()
  const tab = tabs[index]
  if (!tab) {
    return {
      success: false,
      errorCode: 'EXECUTION_FAILED',
      error: `tab index out of range: ${index}`,
    }
  }
  await platform.tabs.activateTab(tab.id)
  return { success: true, data: { url: tab.url, title: tab.title, index } }
}

async function bgCloseTab(params: Record<string, unknown>): Promise<DomActionResult> {
  const index = params.index as number
  const tabs = await platform.tabs.listTabs()
  const tab = tabs[index]
  if (!tab) {
    return {
      success: false,
      errorCode: 'EXECUTION_FAILED',
      error: `tab index out of range: ${index}`,
    }
  }
  await platform.tabs.closeTab(tab.id)
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
  const activeTab = await platform.tabs.queryActiveTab()
  if (!activeTab) {
    return { success: false, errorCode: 'TARGET_NOT_CONNECTED', error: 'no active tab' }
  }
  const timeoutMs = req.timeout ?? 30000
  const sendPromise = platform.tabs
    .sendMessageToTab<DomActionResult>(activeTab.id, { type: 'agent.action.dom', payload: req })
    .then((response) => {
      if (!response) {
        return {
          success: false as const,
          errorCode: 'EXECUTION_FAILED' as const,
          error: 'no response from content script',
        }
      }
      return response
    })
    .catch((err: Error) => ({
      success: false as const,
      errorCode: 'TARGET_NOT_CONNECTED' as const,
      error: err.message,
    }))

  const timeoutPromise = new Promise<DomActionResult>((resolve) => {
    setTimeout(() => {
      resolve({
        success: false,
        errorCode: 'TIMEOUT',
        error: `content script no response after ${timeoutMs}ms`,
      })
    }, timeoutMs)
  })

  return Promise.race([sendPromise, timeoutPromise])
}
