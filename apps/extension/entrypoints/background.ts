/**
 * Background Service Worker — 消息路由中心 + API 代理 + token 管理 + contextMenu。
 *
 * 职责:
 * 1. 接收来自 content / popup / sidepanel 的 ExtMessage
 * 2. 路由分发到对应 handler(API proxy / token / vocab / highlight / sidePanel)
 * 3. API 代理:通过 fetchApi 转发(避免 content script CORS)
 * 4. 注册右键菜单(contextMenus):翻译选区 / 查词 / 发送到 AI
 * 5. 安装时初始化 token + 启动 refresh alarm
 * 6. 转发 chrome.action.onClicked 打开 sidePanel
 */
import { initApi, getRefreshToken, getToken, clearAllTokens } from '../lib/token'
import { doRefresh, startAutoRefresh, scheduleRefreshAlarm } from '../lib/token-utils'
import type { ExtMessage, ExtResponse, ApiProxyPayload } from '../lib/message-router'
import { REFRESH_ALARM_NAME, API_BASE_URL } from '../lib/config'
import type { AgentActionRequest, AgentActionResponse, BrowserControlActionType } from '@ihui/types'
import { executeBackgroundAction, isDomAction, isBackgroundAction, type DomActionResult } from '../lib/agent-control'
import { initAgentControlBridge } from '../lib/agent-control-bridge'

// API 代理:background context 通过 fetch 直连 API(走 @ihui/api-client 的 fetchApi)。
// 用 chrome.runtime.sendMessage 接 fetchApi 不便(扩展中 fetch 走 service worker
// 无 CORS 限制,直接调用更稳)。
async function callApi<T = unknown>(path: string, init: {
  method: string
  headers?: Record<string, string>
  body?: string
}): Promise<{ ok: boolean; status: number; data: T | null; text: string }> {
  const url = new URL(path.replace(/^\//, ''), API_BASE_URL).toString()
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(url, { method: init.method, headers, body: init.body })
  const text = await res.text()
  let data: T | null = null
  if (text) {
    try { data = JSON.parse(text) as T } catch { data = null }
  }
  return { ok: res.ok, status: res.status, data, text }
}

function reply<T>(requestId: string, data: T): ExtResponse {
  return { ok: true, data, requestId }
}

function replyError(requestId: string, err: unknown): ExtResponse {
  const msg = err instanceof Error ? err.message : String(err)
  return { ok: false, error: msg, requestId }
}

async function handleApiProxy(payload: ApiProxyPayload): Promise<unknown> {
  const qs = payload.query
    ? '?' +
      Object.entries(payload.query)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : ''
  const path = `${payload.path}${qs}`
  const res = await callApi<unknown>(path, {
    method: payload.method,
    headers: payload.headers,
    body: payload.body !== undefined ? JSON.stringify(payload.body) : undefined,
  })
  if (!res.ok) {
    throw new Error(`proxy ${payload.method} ${payload.path} failed: ${res.status} ${res.text.slice(0, 200)}`)
  }
  // 尝试解包 { code, message, data } 格式
  if (res.data && typeof res.data === 'object' && 'data' in (res.data as Record<string, unknown>)) {
    const wrapped = res.data as { code?: number; message?: string; data: unknown }
    if (wrapped.code !== undefined && wrapped.code !== 0) {
      throw new Error(wrapped.message || `proxy failed code=${wrapped.code}`)
    }
    return wrapped.data
  }
  return res.data
}

async function handleVocabLookup(
  payload: { word: string; source?: string },
): Promise<{ word: string; translation: string; phonetic?: string; definitions?: string[] }> {
  // 简化:调用通用 chat proxy 做翻译(用系统 prompt 引导输出)
  // 真实部署可对接独立 /vocab 端点
  const word = payload.word.trim()
  if (!word) throw new Error('empty word')
  try {
    const res = await callApi<{
      choices?: Array<{ message?: { content?: string } }>
    }>('/llm/chat', {
      method: 'POST',
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a dictionary. Reply in JSON: {"translation":"...","phonetic":"...","definitions":["..."]}',
          },
          { role: 'user', content: word },
        ],
      }),
    })
    if (res.ok && res.data) {
      const content = res.data.choices?.[0]?.message?.content || ''
      const parsed = parseVocabContent(content)
      return { word, translation: parsed.translation || content, phonetic: parsed.phonetic, definitions: parsed.definitions }
    }
  } catch {
    // ignore — fallback below
  }
  // fallback:本地直译(不调 API)
  return { word, translation: word, definitions: ['离线模式:无法连接服务器'] }
}

function parseVocabContent(content: string): {
  translation: string
  phonetic?: string
  definitions?: string[]
} {
  const trimmed = content.trim()
  // 尝试 JSON parse
  try {
    const obj = JSON.parse(trimmed)
    if (obj && typeof obj === 'object') {
      return {
        translation: typeof obj.translation === 'string' ? obj.translation : '',
        phonetic: typeof obj.phonetic === 'string' ? obj.phonetic : undefined,
        definitions: Array.isArray(obj.definitions)
          ? obj.definitions.filter((s: unknown) => typeof s === 'string')
          : undefined,
      }
    }
  } catch {
    // fall through
  }
  return { translation: trimmed }
}

async function handleHighlightToggle(
  payload: { word: string; enabled: boolean; scope: 'page' | 'selection' },
): Promise<{ word: string; matches: number }> {
  // 高亮由 content script 本地执行,这里只更新配置 + 广播到所有 tab
  if (payload.enabled) {
    await chrome.storage.local.set({ ihui_highlight_word: payload.word })
  } else {
    await chrome.storage.local.remove('ihui_highlight_word')
  }
  // 通知所有 tab 应用高亮(matches=0 表示清除)
  const tabs = await chrome.tabs.query({})
  for (const tab of tabs) {
    if (typeof tab.id === 'number') {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'highlight.applied',
          payload: { word: payload.word, matches: payload.enabled ? 1 : 0 },
        })
      } catch {
        // ignore tabs without content script
      }
    }
  }
  return { word: payload.word, matches: payload.enabled ? 1 : 0 }
}

async function handleSidePanelOpen(payload: { tabId?: number }): Promise<{ opened: boolean }> {
  if (typeof payload.tabId === 'number') {
    await chrome.sidePanel.open({ tabId: payload.tabId })
    return { opened: true }
  }
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const id = tabs[0]?.id
  if (typeof id === 'number') {
    await chrome.sidePanel.open({ tabId: id })
  } else {
    // MV3:必须传 tabId 或 windowId,空 {} 不被允许
    const winId = tabs[0]?.windowId
    if (typeof winId === 'number') {
      await chrome.sidePanel.open({ windowId: winId })
    } else {
      // 拿不到任何 ID 时,放弃(用户需先激活标签)
      throw new Error('no active tab to open side panel')
    }
  }
  return { opened: true }
}

async function handleAgentAction(req: AgentActionRequest): Promise<AgentActionResponse> {
  const start = Date.now()
  const timeout = req.timeout ?? 30000
  const action = req.action as BrowserControlActionType

  let result: DomActionResult
  if (isDomAction(action)) {
    // click/type/scroll/extract/wait/attr/hover/select → forward to content script
    result = await forwardAgentToContent(req)
  } else if (isBackgroundAction(action)) {
    // screenshot/navigate/switch_tab/close_tab → execute in background
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

async function forwardAgentToContent(req: AgentActionRequest): Promise<DomActionResult> {
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

async function routeMessage(msg: ExtMessage): Promise<ExtResponse> {
  try {
    switch (msg.type) {
      case 'api.proxy': {
        const data = await handleApiProxy(msg.payload)
        return reply(msg.requestId, data)
      }
      case 'token.get': {
        return reply(msg.requestId, { accessToken: getToken(), refreshToken: getRefreshToken() })
      }
      case 'token.refresh': {
        const ok = await doRefresh()
        return reply(msg.requestId, { ok })
      }
      case 'vocab.lookup': {
        const data = await handleVocabLookup(msg.payload)
        return reply(msg.requestId, data)
      }
      case 'highlight.toggle': {
        const data = await handleHighlightToggle(msg.payload)
        return reply(msg.requestId, data)
      }
      case 'tab.queryActive': {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
        const tab = tabs[0]
        return reply(msg.requestId, { tabId: tab?.id, url: tab?.url, title: tab?.title })
      }
      case 'sidePanel.open': {
        const data = await handleSidePanelOpen(msg.payload)
        return reply(msg.requestId, data)
      }
      case 'notification.broadcast': {
        // 广播给所有 frame(content script + sidepanel)
        await chrome.runtime.sendMessage({
          type: 'ws.notification',
          payload: msg.payload,
        }).catch(() => {})
        return reply(msg.requestId, { broadcast: true })
      }
      case 'agent.action': {
        const data = await handleAgentAction(msg.payload)
        return reply(msg.requestId, data)
      }
      default: {
        const type = (msg as { type?: string }).type || 'unknown'
        return replyError((msg as { requestId?: string }).requestId || 'unknown', `unknown message type: ${type}`)
      }
    }
  } catch (err) {
    return replyError(msg.requestId, err)
  }
}

function registerContextMenu(): void {
  if (!chrome.contextMenus) return
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'ihui-translate',
      title: 'IHUI AI · 翻译选区',
      contexts: ['selection'],
    })
    chrome.contextMenus.create({
      id: 'ihui-vocab',
      title: 'IHUI AI · 查词',
      contexts: ['selection'],
    })
    chrome.contextMenus.create({
      id: 'ihui-send',
      title: 'IHUI AI · 发送到对话',
      contexts: ['selection'],
    })
  })

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const text = info.selectionText?.trim() || ''
    if (!text) return
    if (info.menuItemId === 'ihui-translate' || info.menuItemId === 'ihui-vocab') {
      try {
        const res = await handleVocabLookup({ word: text, source: 'context-menu' })
        if (typeof tab?.id === 'number') {
          await chrome.tabs.sendMessage(tab.id, {
            type: 'vocab.result',
            payload: res,
          }).catch(() => {})
        }
      } catch (err) {
        console.warn('[IHUI AI] context menu vocab failed:', err)
      }
    } else if (info.menuItemId === 'ihui-send') {
      try {
        await chrome.storage.session?.set({ ihui_pending_prompt: text })
        if (typeof tab?.id === 'number') {
          await chrome.sidePanel.open({ tabId: tab.id })
        } else {
          // 退而求其次:通过当前窗口
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
          const winId = tabs[0]?.windowId
          if (typeof winId === 'number') {
            await chrome.sidePanel.open({ windowId: winId })
          }
        }
      } catch (err) {
        console.warn('[IHUI AI] context menu send failed:', err)
      }
    }
  })
}

function registerActionClick(): void {
  // 工具栏图标点击(未配置 default_popup 时):打开 sidePanel
  chrome.action.onClicked.addListener(async (tab) => {
    try {
      if (typeof tab?.id === 'number') {
        await chrome.sidePanel.open({ tabId: tab.id })
      } else {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
        const winId = tabs[0]?.windowId
        if (typeof winId === 'number') {
          await chrome.sidePanel.open({ windowId: winId })
        }
      }
    } catch (err) {
      console.warn('[IHUI AI] action onClicked open sidePanel failed:', err)
    }
  })
}

function registerInstallHook(): void {
  chrome.runtime.onInstalled.addListener(async (details) => {
    console.info('[IHUI AI] installed:', details.reason)
    try {
      await initApi()
      if (getToken() && getRefreshToken()) {
        const t = getToken()
        if (t) scheduleRefreshAlarm(t)
      }
    } catch (err) {
      console.error('[IHUI AI] onInstalled init failed:', err)
    }
    // 默认启用 sidePanel 行为(action + toolbar icon)
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    } catch (err) {
      console.warn('[IHUI AI] setPanelBehavior failed:', err)
    }
  })

  chrome.runtime.onStartup.addListener(() => {
    console.info('[IHUI AI] startup')
    void initApi()
      .then(() => {
        const t = getToken()
        if (t) scheduleRefreshAlarm(t)
      })
      .catch((err) => {
        console.error('[IHUI AI] onStartup init failed:', err)
      })
  })
}

function registerMessageListener(): void {
  chrome.runtime.onMessage.addListener((msg: ExtMessage, _sender, sendResponse) => {
    if (!msg || typeof msg !== 'object' || !('type' in msg) || !('requestId' in msg)) {
      return false
    }
    void routeMessage(msg).then(sendResponse)
    return true // 异步响应
  })
}

function registerAlarmListener(): void {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === REFRESH_ALARM_NAME) {
      void doRefresh().catch((err) => {
        console.error('[IHUI AI] refresh alarm failed:', err)
      })
    }
  })
}

export default defineBackground(() => {
  startAutoRefresh()
  registerMessageListener()
  registerInstallHook()
  registerActionClick()
  registerContextMenu()
  registerAlarmListener()
  initAgentControlBridge()

  // 监听 storage 变化(其他 context 改 token 时同步)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes['ihui_token']) {
      // token 变化已在 lib/token.ts 内部处理
    }
    if (area === 'session' && changes['ihui_pending_prompt']) {
      const v = changes['ihui_pending_prompt'].newValue
      if (typeof v === 'string') {
        // 转发给 sidepanel(可能尚未打开,会被忽略)
        chrome.runtime.sendMessage({ type: 'ws.pending_prompt', payload: { text: v } }).catch(() => {})
      }
    }
    if (area === 'session' && changes['ihui_pending_vocab']) {
      const v = changes['ihui_pending_vocab'].newValue
      if (typeof v === 'string') {
        chrome.runtime.sendMessage({ type: 'ws.pending_vocab', payload: { text: v } }).catch(() => {})
      }
    }
    if (area === 'session' && changes['ihui_pending_route']) {
      const v = changes['ihui_pending_route'].newValue
      if (typeof v === 'string') {
        chrome.runtime.sendMessage({ type: 'ws.pending_route', payload: { route: v } }).catch(() => {})
      }
    }
  })

  // 启动时尝试静默 refresh
  if (getToken() && getRefreshToken()) {
    const t = getToken()
    if (t) scheduleRefreshAlarm(t)
  } else {
    void clearAllTokens().catch(() => {})
  }
})
