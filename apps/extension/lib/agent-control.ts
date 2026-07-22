/**
 * AI Agent 浏览器控制执行器(2026-07-22 立)
 *
 * 实现 12 个 BrowserControlAction:
 * - DOM actions(在 content script 执行):click_element / type_text / scroll / extract_dom /
 *   wait_for_element / get_attribute / hover / select_option
 * - Background actions(在 service worker 执行):screenshot / navigate / switch_tab / close_tab
 *
 * 调用方:background.ts routeMessage / agent-control-bridge.ts onRuntimeMessage / content.ts agent.action.dom handler
 * 2026-07-22 P2 dedupe:新增 executeAgentActionRequest + forwardRequestToContentScript 共享函数,
 * 供 background.ts 和 agent-control-bridge.ts 共用,消除重复实现。
 */
import type { BrowserControlActionType, AgentActionErrorCode, AgentActionRequest, AgentActionResponse } from '@ihui/types'

// ===== Result type =====

export interface DomActionResult {
  success: boolean
  data?: Record<string, unknown>
  error?: string
  errorCode?: AgentActionErrorCode
}

// ===== Action classification =====

const DOM_ACTIONS = new Set<BrowserControlActionType>([
  'click_element',
  'type_text',
  'scroll',
  'extract_dom',
  'wait_for_element',
  'get_attribute',
  'hover',
  'select_option',
])

const BACKGROUND_ACTIONS = new Set<BrowserControlActionType>([
  'screenshot',
  'navigate',
  'switch_tab',
  'close_tab',
])

export function isDomAction(action: BrowserControlActionType): boolean {
  return DOM_ACTIONS.has(action)
}

export function isBackgroundAction(action: BrowserControlActionType): boolean {
  return BACKGROUND_ACTIONS.has(action)
}

// ===== DOM action executor (runs in content script) =====

export async function executeDomAction(
  action: BrowserControlActionType,
  params: Record<string, unknown>,
  timeoutMs = 30000,
): Promise<DomActionResult> {
  if (!isDomAction(action)) {
    return { success: false, errorCode: 'UNSUPPORTED_ACTION', error: `not a DOM action: ${action}` }
  }
  const exec = doDomAction(action, params)
  const timeout = new Promise<DomActionResult>((resolve) => {
    setTimeout(() => {
      resolve({ success: false, errorCode: 'TIMEOUT', error: `action ${action} timed out after ${timeoutMs}ms` })
    }, timeoutMs)
  })
  return Promise.race([exec, timeout])
}

async function doDomAction(
  action: BrowserControlActionType,
  params: Record<string, unknown>,
): Promise<DomActionResult> {
  switch (action) {
    case 'click_element':
      return domClick(params)
    case 'type_text':
      return domType(params)
    case 'scroll':
      return domScroll(params)
    case 'extract_dom':
      return domExtract(params)
    case 'wait_for_element':
      return domWaitForElement(params)
    case 'get_attribute':
      return domGetAttribute(params)
    case 'hover':
      return domHover(params)
    case 'select_option':
      return domSelectOption(params)
    default:
      return { success: false, errorCode: 'UNSUPPORTED_ACTION', error: `unsupported DOM action: ${action}` }
  }
}

function notFound(selector: string): DomActionResult {
  return { success: false, errorCode: 'SELECTOR_NOT_FOUND', error: `selector not found: ${selector}` }
}

function domClick(params: Record<string, unknown>): DomActionResult {
  const selector = params.selector as string
  const el = document.querySelector(selector) as HTMLElement | null
  if (!el) return notFound(selector)
  const button = (params.button as 'left' | 'right' | 'middle') ?? 'left'
  const buttonCode = button === 'right' ? 2 : button === 'middle' ? 1 : 0
  const count = (params.count as number) ?? 1
  for (let i = 0; i < count; i++) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: buttonCode }))
  }
  return { success: true, data: { clicked: true, selector } }
}

/** React/Vue 受控组件需要通过原型链 setter 修改 value,直接赋值 el.value 不会触发 onChange */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter) {
    setter.call(el, value)
  } else {
    el.value = value
  }
}

async function domType(params: Record<string, unknown>): Promise<DomActionResult> {
  const selector = params.selector as string
  const text = params.text as string
  const el = document.querySelector(selector) as (HTMLInputElement | HTMLTextAreaElement) | null
  if (!el) return notFound(selector)
  const clear = params.clear !== false
  const delay = (params.delay as number) ?? 0
  if (clear) {
    setNativeValue(el, '')
    el.dispatchEvent(new InputEvent('input', { bubbles: true }))
  }
  for (const char of text) {
    setNativeValue(el, el.value + char)
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: char }))
    if (delay > 0) await new Promise((r) => setTimeout(r, delay))
  }
  el.dispatchEvent(new Event('change', { bubbles: true }))
  return { success: true, data: { typed: true, length: text.length } }
}

function domScroll(params: Record<string, unknown>): DomActionResult {
  const direction = params.direction as 'up' | 'down' | 'left' | 'right'
  const amount = (params.amount as number) ?? 300
  const selector = params.selector as string | undefined
  let x = 0
  let y = 0
  if (direction === 'up') y = -amount
  else if (direction === 'down') y = amount
  else if (direction === 'left') x = -amount
  else if (direction === 'right') x = amount
  if (selector) {
    const el = document.querySelector(selector)
    if (!el) return notFound(selector)
    el.scrollBy(x, y)
  } else {
    window.scrollBy(x, y)
  }
  return { success: true, data: { scrolled: true, direction, amount } }
}

function domExtract(params: Record<string, unknown>): DomActionResult {
  const selector = params.selector as string | undefined
  const attributes = (params.attributes as string[]) ?? ['text', 'href', 'src', 'value']
  const maxNodes = (params.maxNodes as number) ?? 100
  let elements: Element[]
  let truncated = false
  if (!selector) {
    // 无 selector 时只扫描语义元素,避免 body * 在大页面上返回上万节点
    elements = Array.from(document.querySelectorAll('a, button, input, textarea, select, [role="button"], [role="link"], [role="menuitem"], h1, h2, h3, [data-testid]'))
  } else if (selector === 'all') {
    elements = Array.from(document.querySelectorAll('*'))
  } else {
    elements = Array.from(document.querySelectorAll(selector))
  }
  if (elements.length > maxNodes) truncated = true
  const nodes = elements.slice(0, maxNodes).map((el) => {
    const node: Record<string, unknown> = { tag: el.tagName.toLowerCase() }
    for (const attr of attributes) {
      if (attr === 'text') {
        node[attr] = (el.textContent || '').trim().slice(0, 500)
      } else {
        node[attr] = el.getAttribute(attr)
      }
    }
    return node
  })
  return {
    success: true,
    data: {
      dom: nodes,
      count: nodes.length,
      totalMatched: elements.length,
      ...(truncated ? { warning: `truncated from ${elements.length} to ${maxNodes} nodes` } : {}),
    },
  }
}

async function domWaitForElement(params: Record<string, unknown>): Promise<DomActionResult> {
  const selector = params.selector as string
  const state = (params.state as 'attached' | 'detached' | 'visible' | 'hidden') ?? 'visible'
  const timeout = (params.timeout as number) ?? 30000
  const start = Date.now()
  return new Promise((resolve) => {
    const check = () => {
      const el = document.querySelector(selector)
      let ready = false
      if (state === 'attached') ready = !!el
      else if (state === 'detached') ready = !el
      else if (state === 'visible') ready = !!el && (el as HTMLElement).offsetParent !== null
      else if (state === 'hidden') ready = !el || (el as HTMLElement).offsetParent === null
      if (ready) {
        resolve({ success: true, data: { found: true, selector, state } })
        return
      }
      if (Date.now() - start > timeout) {
        resolve({ success: false, errorCode: 'TIMEOUT', error: `wait for element timeout: ${selector}` })
        return
      }
      setTimeout(check, 100)
    }
    check()
  })
}

function domGetAttribute(params: Record<string, unknown>): DomActionResult {
  const selector = params.selector as string
  const attribute = params.attribute as string
  const el = document.querySelector(selector)
  if (!el) return notFound(selector)
  let value: string | null = null
  if (attribute === 'value') {
    const inputEl = el as HTMLInputElement
    if (typeof inputEl.value === 'string') value = inputEl.value
  }
  if (value === null) value = el.getAttribute(attribute)
  return { success: true, data: { value: value ?? '' } }
}

function domHover(params: Record<string, unknown>): DomActionResult {
  const selector = params.selector as string
  const el = document.querySelector(selector)
  if (!el) return notFound(selector)
  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }))
  el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, cancelable: true }))
  return { success: true, data: { hovered: true, selector } }
}

function domSelectOption(params: Record<string, unknown>): DomActionResult {
  const selector = params.selector as string
  const value = params.value as string
  const el = document.querySelector(selector) as HTMLSelectElement | null
  if (!el) return notFound(selector)
  if (el.tagName.toLowerCase() !== 'select') {
    return { success: false, errorCode: 'EXECUTION_FAILED', error: 'element is not a <select>' }
  }
  let matched = false
  for (const opt of Array.from(el.options)) {
    if (opt.value === value || opt.text === value) {
      el.value = opt.value
      el.dispatchEvent(new Event('change', { bubbles: true }))
      matched = true
      break
    }
  }
  if (!matched) {
    return { success: false, errorCode: 'EXECUTION_FAILED', error: `option not found: ${value}` }
  }
  return { success: true, data: { selected: true, value } }
}

// ===== Background action executor (runs in service worker) =====

export async function executeBackgroundAction(
  action: BrowserControlActionType,
  params: Record<string, unknown>,
  timeoutMs = 30000,
): Promise<DomActionResult> {
  if (!isBackgroundAction(action)) {
    return { success: false, errorCode: 'UNSUPPORTED_ACTION', error: `not a background action: ${action}` }
  }
  const exec = doBackgroundAction(action, params)
  const timeout = new Promise<DomActionResult>((resolve) => {
    setTimeout(() => {
      resolve({ success: false, errorCode: 'TIMEOUT', error: `action ${action} timed out after ${timeoutMs}ms` })
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
      return { success: false, errorCode: 'UNSUPPORTED_ACTION', error: `unsupported background action: ${action}` }
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
      ...(degraded ? { warning: `requested ${requestedArea} but only viewport captured (chrome.tabs.captureVisibleTab limitation)` } : {}),
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
    return { success: false, errorCode: 'EXECUTION_FAILED', error: `tab index out of range: ${index}` }
  }
  await chrome.tabs.update(tab.id, { active: true })
  return { success: true, data: { url: tab.url || '', title: tab.title || '', index } }
}

async function bgCloseTab(params: Record<string, unknown>): Promise<DomActionResult> {
  const index = params.index as number
  const tabs = await chrome.tabs.query({ currentWindow: true })
  const tab = tabs[index]
  if (!tab || typeof tab.id !== 'number') {
    return { success: false, errorCode: 'EXECUTION_FAILED', error: `tab index out of range: ${index}` }
  }
  await chrome.tabs.remove(tab.id)
  return { success: true, data: { closed: true, index } }
}

// ===== Shared agent action dispatcher (2026-07-22 抽取,消除 background.ts 与 agent-control-bridge.ts 重复) =====

/**
 * 共享:执行 AgentActionRequest,自动分发 DOM action(转发到 content script)或 background action(本地执行)。
 * 供 background.ts 的 routeMessage 'agent.action' 和 agent-control-bridge.ts 的 onRuntimeMessage 共用。
 */
export async function executeAgentActionRequest(req: AgentActionRequest): Promise<AgentActionResponse> {
  const start = Date.now()
  const timeout = req.timeout ?? 30000
  const action = req.action as BrowserControlActionType

  let result: DomActionResult
  if (isDomAction(action)) {
    result = await forwardRequestToContentScript(req)
  } else if (isBackgroundAction(action)) {
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

/**
 * 共享:将 DOM action 请求转发到当前 active tab 的 content script,带超时。
 */
export async function forwardRequestToContentScript(req: AgentActionRequest): Promise<DomActionResult> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tabId = tabs[0]?.id
  if (typeof tabId !== 'number') {
    return { success: false, errorCode: 'TARGET_NOT_CONNECTED', error: 'no active tab' }
  }
  const timeoutMs = req.timeout ?? 30000
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ success: false, errorCode: 'TIMEOUT', error: `content script no response after ${timeoutMs}ms` })
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
          resolve({ success: false, errorCode: 'EXECUTION_FAILED', error: 'no response from content script' })
          return
        }
        resolve(response)
      },
    )
  })
}
