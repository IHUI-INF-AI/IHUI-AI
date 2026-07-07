/**
 * 统一 AI 能力 API 层
 * 对接后端 /api/v1/ai/capabilities/*
 *
 * 支持: 智能体 / Skills / 脚本插件 / 浏览器自动化 / 计算机控制 / MCP 工具
 * 调用方式: HTTP REST / WebSocket / SSE 流式
 */

import request from '@/utils/request'
import { logger } from '@/utils/logger'

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** 能力类型 */
export type CapabilityType = 'agent' | 'skill' | 'plugin' | 'browser' | 'computer' | 'mcp' | 'auto'

/** 能力分类 ID */
export type CapabilityCategoryID = 'agents' | 'skills' | 'plugins' | 'browser' | 'computer' | 'mcp' | 'auto'

/** 统一能力项 */
export interface CapabilityItem {
  id: string
  name: string
  description: string
  type: CapabilityType
  category: string
  icon: string
  platform: string
  tags: string[]
  enabled: boolean
  metadata: Record<string, unknown>
}

/** 能力分类 */
export interface CapabilityCategory {
  id: string
  name: string
  icon: string
  description: string
  items: CapabilityItem[]
}

/** 能力列表响应 */
export interface CapabilityListResponse {
  categories: CapabilityCategory[]
  total: number
}

/** 能力调用请求 */
export interface InvokeCapabilityRequest {
  capability_id: string
  capability_type?: string
  input: string
  stream?: boolean
  options?: Record<string, unknown>
  context?: Record<string, unknown>
}

/** 能力调用响应 */
export interface InvokeCapabilityResult {
  success: boolean
  result?: string
  error?: string
  [key: string]: unknown
}

/** 自动匹配结果 */
export interface AutoMatchResult {
  matched: boolean
  capability_id: string
  capability_type: CapabilityType
  capability_name: string
  reason: string
  confidence: number
}

// ---------------------------------------------------------------------------
// API 函数
// ---------------------------------------------------------------------------

const BASE_PATH = '/api/v1/ai/capabilities'

/**
 * 获取能力分类列表
 */
export async function getCapabilityCategories() {
  const resp = await request.get(`${BASE_PATH}/categories`)
  return resp.data
}

/**
 * 列出所有能力 (分类)
 */
export async function listCapabilities(params?: {
  category?: string
  capability_type?: string
  keyword?: string
}): Promise<CapabilityListResponse> {
  const resp = await request.get(`${BASE_PATH}/list`, { params })
  const data = resp.data?.data ?? resp.data
  return data as CapabilityListResponse
}

/**
 * 获取能力详情
 */
export async function getCapabilityDetail(capabilityId: string): Promise<CapabilityItem> {
  const resp = await request.get(`${BASE_PATH}/${capabilityId}`)
  return resp.data?.data ?? resp.data
}

/**
 * 调用指定能力 (同步)
 */
export async function invokeCapability(req: InvokeCapabilityRequest): Promise<InvokeCapabilityResult> {
  const resp = await request.post(`${BASE_PATH}/invoke`, req)
  return resp.data?.data ?? resp.data
}

/**
 * 调用指定能力 (SSE 流式)
 * 返回 AsyncGenerator, yield SSE 事件
 */
export async function* invokeCapabilityStream(
  req: InvokeCapabilityRequest
): AsyncGenerator<{ event: string; data?: unknown; timestamp?: number }> {
  const resp = await fetch(`${BASE_PATH}/invoke/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })

  if (!resp.ok || !resp.body) {
    throw new Error(`Stream request failed: ${resp.status}`)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const json = JSON.parse(line.slice(6))
            yield json
          } catch {
            // skip invalid JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * AI 自动匹配能力
 */
export async function autoMatchCapability(
  input: string,
  context?: Record<string, unknown>
): Promise<AutoMatchResult> {
  const resp = await request.post(`${BASE_PATH}/auto-match`, { input, context })
  return resp.data?.data ?? resp.data
}

// ---------------------------------------------------------------------------
// WebSocket 能力调用
// ---------------------------------------------------------------------------

/** WebSocket 能力调用客户端 */
export class CapabilityWebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map()

  constructor(baseUrl?: string) {
    // 自动构建 WS URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = baseUrl || `${protocol}//${window.location.host}`
    this.url = `${host}/api/v1/ai/capabilities/ws/stream`
  }

  /** 连接 WebSocket */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)
        this.ws.onopen = () => {
          logger.info('[CapabilityWS] connected')
          resolve()
        }
        this.ws.onerror = (err) => {
          logger.error('[CapabilityWS] error', err)
          reject(err)
        }
        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            const listeners = this.listeners.get(msg.event)
            if (listeners) {
              listeners.forEach((cb) => cb(msg.data ?? msg))
            }
            // 通用 listener
            const allListeners = this.listeners.get('*')
            if (allListeners) {
              allListeners.forEach((cb) => cb(msg))
            }
          } catch (e) {
            logger.warn('[CapabilityWS] parse error', e)
          }
        }
        this.ws.onclose = () => {
          logger.info('[CapabilityWS] closed')
          this.ws = null
        }
      } catch (e) {
        reject(e)
      }
    })
  }

  /** 监听事件 */
  on(event: string, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
    return () => this.listeners.get(event)?.delete(callback)
  }

  /** 列出能力 */
  sendList(params?: { category?: string; keyword?: string }) {
    this.send({ action: 'list', ...params })
  }

  /** 自动匹配 */
  sendAutoMatch(input: string) {
    this.send({ action: 'auto-match', input })
  }

  /** 调用能力 */
  sendInvoke(capabilityId: string, input: string, options?: Record<string, unknown>) {
    this.send({
      action: 'invoke',
      capability_id: capabilityId,
      input,
      options: options || {},
    })
  }

  /** 发送消息 */
  private send(msg: Record<string, unknown>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    } else {
      logger.warn('[CapabilityWS] not connected, message dropped')
    }
  }

  /** 关闭连接 */
  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.listeners.clear()
  }

  /** 是否已连接 */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}
