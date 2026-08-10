/**
 * 记忆模块 — 保存 / 召回 / 搜索 / Dream / 遗忘 / 分类记忆。
 *
 * 端点(8 个):
 * - POST   /v1/memory(保存记忆)
 * - GET    /v1/memory(召回记忆)
 * - POST   /v1/memory/search(语义搜索)
 * - POST   /v1/memory/dream(Dream 梦境系统)
 * - DELETE /v1/memory(遗忘记忆)
 * - GET    /v1/memory/working(工作记忆)
 * - GET    /v1/memory/episodic(情景记忆)
 * - GET    /v1/memory/procedural(程序记忆)
 */

import type { BaseClient } from './base.js'

// =============================================================================
// 内联类型定义
// =============================================================================

export interface V1SaveMemoryRequest {
  content: string
  type?: string
  metadata?: Record<string, unknown>
}

/** 保存记忆响应。 */
export interface V1SaveMemoryResponse {
  memoryId: string
  status: 'saved'
}

export interface V1RecallMemoryResponse {
  object: 'list'
  data: Array<{
    id: string
    content: string
    type: string
    score: number
    createdAt: string
    metadata?: Record<string, unknown>
  }>
}

export interface V1MemorySearchRequest {
  query: string
  topK?: number
  type?: string
}

/** 记忆搜索响应。 */
export interface V1MemorySearchResponse {
  object: 'list'
  data: Array<{
    id: string
    content: string
    type: string
    score: number
    createdAt: string
  }>
}

export interface V1MemoryDreamRequest {
  mode?: string
}

export interface V1MemoryDreamResponse {
  dreamId: string
  insights: string[]
  newMemories: number
}

export interface V1WorkingMemoryResponse {
  items: Array<{ id: string; content: string; createdAt: string }>
}

export interface V1EpisodicMemoryResponse {
  episodes: Array<{
    id: string
    summary: string
    timestamp: string
    participants: string[]
  }>
}

export interface V1ProceduralMemoryResponse {
  procedures: Array<{
    id: string
    name: string
    steps: string[]
    successRate: number
  }>
}

/** 遗忘记忆请求/响应。 */
export interface V1ForgetMemoryRequest {
  memoryId: string
}

export interface V1ForgetMemoryResponse {
  memoryId: string
  status: 'forgotten'
}

// =============================================================================
// Module 接口 + 工厂函数
// =============================================================================

export interface MemoryModule {
  /** POST /v1/memory(保存记忆)。 */
  save(req: V1SaveMemoryRequest): Promise<V1SaveMemoryResponse>
  /** GET /v1/memory(召回记忆)。 */
  recall(): Promise<V1RecallMemoryResponse>
  /** POST /v1/memory/search(语义搜索)。 */
  search(req: V1MemorySearchRequest): Promise<V1MemorySearchResponse>
  /** POST /v1/memory/dream(Dream 梦境系统)。 */
  dream(req?: V1MemoryDreamRequest): Promise<V1MemoryDreamResponse>
  /** DELETE /v1/memory(遗忘记忆)。 */
  forget(req: V1ForgetMemoryRequest): Promise<V1ForgetMemoryResponse>
  /** GET /v1/memory/working(工作记忆)。 */
  working(): Promise<V1WorkingMemoryResponse>
  /** GET /v1/memory/episodic(情景记忆)。 */
  episodic(): Promise<V1EpisodicMemoryResponse>
  /** GET /v1/memory/procedural(程序记忆)。 */
  procedural(): Promise<V1ProceduralMemoryResponse>
}

export function createMemoryModule(client: BaseClient): MemoryModule {
  return {
    save: (req) => client.request<V1SaveMemoryResponse>('POST', '/memory', req),
    recall: () => client.request<V1RecallMemoryResponse>('GET', '/memory'),
    search: (req) => client.request<V1MemorySearchResponse>('POST', '/memory/search', req),
    dream: (req) => client.request<V1MemoryDreamResponse>('POST', '/memory/dream', req),
    forget: (req) => client.request<V1ForgetMemoryResponse>('DELETE', '/memory', req),
    working: () => client.request<V1WorkingMemoryResponse>('GET', '/memory/working'),
    episodic: () => client.request<V1EpisodicMemoryResponse>('GET', '/memory/episodic'),
    procedural: () => client.request<V1ProceduralMemoryResponse>('GET', '/memory/procedural'),
  }
}