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
import type {
  V1SaveMemoryRequest,
  V1RecallMemoryResponse,
  V1MemorySearchRequest,
  V1MemoryDreamRequest,
  V1MemoryDreamResponse,
  V1WorkingMemoryResponse,
  V1EpisodicMemoryResponse,
  V1ProceduralMemoryResponse,
} from '@ihui/types'

/** 记忆搜索响应(POST /v1/memory/search)。 */
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

/** 遗忘记忆请求(DELETE /v1/memory)。 */
export interface V1ForgetMemoryRequest {
  memoryId: string
}

/** 遗忘记忆响应。 */
export interface V1ForgetMemoryResponse {
  memoryId: string
  status: 'forgotten'
}

/** 保存记忆响应(POST /v1/memory)。 */
export interface V1SaveMemoryResponse {
  memoryId: string
  status: 'saved'
}

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
