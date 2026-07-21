/**
 * Background / Content / Popup / Sidepanel 之间的消息路由契约。
 *
 * MV3 限制:
 * - content script 不能直接 fetch 受 CORS 限制的资源,需要通过 background 中转
 * - 跨上下文共享类型必须能 serialize(JSON),所以只用原始类型
 * - background 不能 await Promise 在事件回调外(MV3 service worker 休眠)
 *
 * 协议:chrome.runtime.sendMessage({ type, payload, requestId })
 *      background 返回 { ok, data?, error? }
 */
import type { ApiResult, AgentActionRequest } from '@ihui/types'

// ===== Request types (sender -> background) =====

export type ExtMessage =
  | { type: 'api.proxy'; payload: ApiProxyPayload; requestId: string }
  | { type: 'token.get'; payload: undefined; requestId: string }
  | { type: 'token.refresh'; payload: undefined; requestId: string }
  | { type: 'vocab.lookup'; payload: VocabLookupPayload; requestId: string }
  | { type: 'highlight.toggle'; payload: HighlightPayload; requestId: string }
  | { type: 'tab.queryActive'; payload: undefined; requestId: string }
  | { type: 'sidePanel.open'; payload: { tabId?: number }; requestId: string }
  | { type: 'notification.broadcast'; payload: { notification: unknown }; requestId: string }
  | { type: 'agent.action'; payload: AgentActionRequest; requestId: string }

// ===== Response types (background -> sender) =====

export type ExtResponse =
  | { ok: true; data: unknown; requestId: string }
  | { ok: false; error: string; requestId: string }

// ===== Background → Content Script: forward agent DOM action =====

export interface AgentDomForwardMessage {
  type: 'agent.action.dom'
  payload: AgentActionRequest
}

// ===== Payload types =====

export interface ApiProxyPayload {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  headers?: Record<string, string>
}

export interface VocabLookupPayload {
  word: string
  source: 'selection' | 'manual' | 'context-menu'
  pageUrl?: string
  pageTitle?: string
}

export interface HighlightPayload {
  word: string
  enabled: boolean
  scope: 'page' | 'selection'
}

// ===== Helpers (统一类型) =====

export function makeRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * sendMessage 的薄包装,带超时控制(MV3 必需:防止 background 休眠导致 pending)。
 */
export function sendMessage<T = unknown>(msg: ExtMessage, timeoutMs = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`message ${msg.type} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    try {
      chrome.runtime.sendMessage(msg, (res: ExtResponse | undefined) => {
        clearTimeout(timer)
        const lastErr = chrome.runtime.lastError
        if (lastErr) {
          reject(new Error(lastErr.message || 'runtime error'))
          return
        }
        if (!res) {
          reject(new Error('no response'))
          return
        }
        if (res.ok) resolve(res.data as T)
        else reject(new Error(res.error))
      })
    } catch (err) {
      clearTimeout(timer)
      reject(err instanceof Error ? err : new Error(String(err)))
    }
  })
}

/**
 * 简化的 ApiResult 适配器 — content script 不直接用 fetchApi,
 * 通过 background 代理(避开 CORS / token 注入 / 统一鉴权刷新)。
 */
export type ApiProxyResult<T> = ApiResult<T>
