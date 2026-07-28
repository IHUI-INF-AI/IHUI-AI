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
import { getApiBaseUrl } from '../lib/config'
import { PENDING_ROUTE_STORAGE_KEY } from '@ihui/shared/constants'
import { executeAgentActionRequest } from '../lib/agent-control'
import { initAgentControlBridge } from '../lib/agent-control-bridge'
import { createChromePlatform } from '@ihui/browser-platform'
import { translate, mergeMessages, isLocale, type Locale, type Messages } from '@ihui/i18n'
import sharedZhCN from '@ihui/i18n/messages/shared/zh-CN.json'
import sharedEn from '@ihui/i18n/messages/shared/en.json'
import sharedJa from '@ihui/i18n/messages/shared/ja.json'
import sharedKo from '@ihui/i18n/messages/shared/ko.json'
import sharedZhTW from '@ihui/i18n/messages/shared/zh-TW.json'
import extZhCN from '@ihui/i18n/messages/extension/zh-CN.json'
import extEn from '@ihui/i18n/messages/extension/en.json'
import extJa from '@ihui/i18n/messages/extension/ja.json'
import extKo from '@ihui/i18n/messages/extension/ko.json'
import extZhTW from '@ihui/i18n/messages/extension/zh-TW.json'

const platform = createChromePlatform()

// SW 非 React 组件,无法用 useI18n hook;直接加载翻译表 + 读取 chrome.storage.local 的 locale
const LOCALE_STORAGE_KEY = 'ihui_locale'
const DEFAULT_LOCALE: Locale = 'zh-CN'
const backgroundMessages: Record<Locale, Messages> = {
  'zh-CN': mergeMessages(sharedZhCN, extZhCN),
  en: mergeMessages(sharedEn, extEn),
  ja: mergeMessages(sharedJa, extJa),
  ko: mergeMessages(sharedKo, extKo),
  'zh-TW': mergeMessages(sharedZhTW, extZhTW),
}

async function getBackgroundLocale(): Promise<Locale> {
  const stored = await platform.storage.localGet<string>(LOCALE_STORAGE_KEY)
  if (typeof stored === 'string' && isLocale(stored)) return stored
  return DEFAULT_LOCALE
}

function translateBg(locale: Locale, key: string): string {
  return translate(backgroundMessages[locale], key, {
    fallback: backgroundMessages[DEFAULT_LOCALE],
  })
}

// API 代理:background context 通过 fetch 直连 API(走 @ihui/api-client 的 fetchApi)。
// 用 chrome.runtime.sendMessage 接 fetchApi 不便(扩展中 fetch 走 service worker
// 无 CORS 限制,直接调用更稳)。
async function callApi<T = unknown>(
  path: string,
  init: {
    method: string
    headers?: Record<string, string>
    body?: string
  },
): Promise<{ ok: boolean; status: number; data: T | null; text: string }> {
  const url = new URL(path.replace(/^\//, ''), getApiBaseUrl()).toString()
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(url, { method: init.method, headers, body: init.body })
  const text = await res.text()
  let data: T | null = null
  if (text) {
    try {
      data = JSON.parse(text) as T
    } catch {
      data = null
    }
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
    throw new Error(
      `proxy ${payload.method} ${payload.path} failed: ${res.status} ${res.text.slice(0, 200)}`,
    )
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

async function handleVocabLookup(payload: {
  word: string
  source?: string
}): Promise<{ word: string; translation: string; phonetic?: string; definitions?: string[] }> {
  // 简化:调用通用 chat proxy 做翻译(用系统 prompt 引导输出)
  // 真实部署可对接独立 /vocab 端点
  const word = payload.word.trim()
  if (!word) throw new Error('empty word')
  try {
    const res = await callApi<{
      choices?: Array<{ message?: { content?: string } }>
    }>('/api/llm/chat', {
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
      return {
        word,
        translation: parsed.translation || content,
        phonetic: parsed.phonetic,
        definitions: parsed.definitions,
      }
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

async function handleHighlightToggle(payload: {
  word: string
  enabled: boolean
  scope: 'page' | 'selection'
}): Promise<{ word: string; matches: number }> {
  // 高亮由 content script 本地执行,这里只更新配置 + 广播到所有 tab
  if (payload.enabled) {
    await platform.storage.localSet('ihui_highlight_word', payload.word)
  } else {
    await platform.storage.localRemove('ihui_highlight_word')
  }
  // 通知所有 tab 应用高亮(matches=0 表示清除)
  // 注意:platform.tabs.listTabs() 默认只返回当前窗口,这里需要广播到所有窗口的所有 tab,
  // 所以保留 chrome.tabs.query({}) 直接调用(平台接口限制,无法用 platform 替代)。
  const tabs = await chrome.tabs.query({})
  for (const tab of tabs) {
    if (typeof tab.id !== 'number') continue
    try {
      await platform.tabs.sendMessageToTab(tab.id, {
        type: 'highlight.applied',
        payload: { word: payload.word, matches: payload.enabled ? 1 : 0 },
      })
    } catch {
      // ignore tabs without content script
    }
  }
  return { word: payload.word, matches: payload.enabled ? 1 : 0 }
}

async function handleSidePanelOpen(payload: { tabId?: number }): Promise<{ opened: boolean }> {
  if (typeof payload.tabId === 'number') {
    await chrome.sidePanel.open({ tabId: payload.tabId })
    return { opened: true }
  }
  // 保留原 chrome.tabs.query 形式:platform.tabs.TabInfo 不含 windowId 字段,
  // 而 sidePanel.open 的 fallback 路径需要 windowId(MV3 硬边界,平台接口限制无法替代)。
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

// 2026-07-22 P2 dedupe:handleAgentAction / forwardAgentToContent 已删除,
// 改用 agent-control.ts 的 executeAgentActionRequest(与 agent-control-bridge.ts 共用同一实现)。

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
        const tab = await platform.tabs.queryActiveTab()
        return reply(msg.requestId, { tabId: tab?.id, url: tab?.url, title: tab?.title })
      }
      case 'sidePanel.open': {
        const data = await handleSidePanelOpen(msg.payload)
        return reply(msg.requestId, data)
      }
      case 'notification.broadcast': {
        // 广播给所有 frame(content script + sidepanel)
        await platform.messaging
          .sendRuntimeMessage({
            type: 'ws.notification',
            payload: msg.payload,
          })
          .catch(() => {})
        return reply(msg.requestId, { broadcast: true })
      }
      case 'agent.action': {
        // 2026-07-22 P2 dedupe:改用 agent-control.ts 的 executeAgentActionRequest
        // (与 agent-control-bridge.ts 共用同一实现,消除重复)
        const data = await executeAgentActionRequest(msg.payload)
        return reply(msg.requestId, data)
      }
      default: {
        const type = (msg as { type?: string }).type || 'unknown'
        return replyError(
          (msg as { requestId?: string }).requestId || 'unknown',
          `unknown message type: ${type}`,
        )
      }
    }
  } catch (err) {
    return replyError(msg.requestId, err)
  }
}

async function registerContextMenu(): Promise<void> {
  if (!chrome.contextMenus) return
  const locale = await getBackgroundLocale()
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'ihui-translate',
      title: translateBg(locale, 'contextMenu.translate'),
      contexts: ['selection'],
    })
    chrome.contextMenus.create({
      id: 'ihui-vocab',
      title: translateBg(locale, 'contextMenu.vocab'),
      contexts: ['selection'],
    })
    chrome.contextMenus.create({
      id: 'ihui-send',
      title: translateBg(locale, 'contextMenu.send'),
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
          await platform.tabs
            .sendMessageToTab(tab.id, {
              type: 'vocab.result',
              payload: res,
            })
            .catch(() => {})
        }
      } catch (err) {
        console.warn('[IHUI AI] context menu vocab failed:', err)
      }
    } else if (info.menuItemId === 'ihui-send') {
      try {
        await platform.storage.sessionSet('ihui_pending_prompt', text)
        if (typeof tab?.id === 'number') {
          await chrome.sidePanel.open({ tabId: tab.id })
        } else {
          // 退而求其次:通过当前窗口(MV3 硬边界,platform 无 windowId 字段)
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
        // 退而求其次:通过当前窗口(MV3 硬边界,platform 无 windowId 字段)
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
    // 2026-07-23 修复:openPanelOnActionClick: true 与 default_popup 冲突 → 点击图标无 popup
    // 改为 false:点击图标走 default_popup(popup.html),sidePanel 由 popup 按钮触发
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
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

export default defineBackground(() => {
  // 2026-07-22 P0 Round 5 鲁棒性加固:全局未捕获 Promise rejection + error 监听
  // MV3 Service Worker 未捕获异常会被 Chrome 累计,达阈值后自动禁用扩展(工具栏图标变灰)
  // 监听后写 chrome.storage.local 日志,供 sidepanel 错误监控面板读取
  self.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    console.error('[IHUI AI] SW unhandledrejection:', reason)
    void platform.storage
      .localSet(`ihui_sw_error_${Date.now()}`, {
        type: 'unhandledrejection',
        reason: String(reason?.message || reason),
        stack: reason?.stack,
        ts: Date.now(),
      })
      .catch(() => {})
    event.preventDefault()
  })

  self.addEventListener('error', (event) => {
    console.error('[IHUI AI] SW error:', event.message, event.filename, event.lineno)
    void platform.storage
      .localSet(`ihui_sw_error_${Date.now()}`, {
        type: 'error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        ts: Date.now(),
      })
      .catch(() => {})
  })

  startAutoRefresh()
  registerMessageListener()
  registerInstallHook()
  registerActionClick()
  void registerContextMenu()
  initAgentControlBridge()

  // 监听 storage 变化(其他 context 改 token 时同步)
  // 'local' area:token 变化已在 lib/token.ts 内部处理,无需注册监听
  platform.storage.onStorageChanged('session', (changes) => {
    if (changes['ihui_pending_prompt']) {
      const v = changes['ihui_pending_prompt'].newValue
      if (typeof v === 'string') {
        // 转发给 sidepanel(可能尚未打开,会被忽略)
        platform.messaging
          .sendRuntimeMessage({ type: 'ws.pending_prompt', payload: { text: v } })
          .catch(() => {})
      }
    }
    if (changes['ihui_pending_vocab']) {
      const v = changes['ihui_pending_vocab'].newValue
      if (typeof v === 'string') {
        platform.messaging
          .sendRuntimeMessage({ type: 'ws.pending_vocab', payload: { text: v } })
          .catch(() => {})
      }
    }
    if (changes[PENDING_ROUTE_STORAGE_KEY]) {
      const v = changes[PENDING_ROUTE_STORAGE_KEY].newValue
      if (typeof v === 'string') {
        platform.messaging
          .sendRuntimeMessage({ type: 'ws.pending_route', payload: { route: v } })
          .catch(() => {})
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
