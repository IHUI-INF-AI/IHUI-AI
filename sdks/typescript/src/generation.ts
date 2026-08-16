/**
 * 生成队列模块 — 入队 / 状态查询 / 取消。
 *
 * 端点(3 个):
 * - POST /v1/generation/enqueue
 * - GET  /v1/generation/status/:id
 * - POST /v1/generation/cancel/:id
 */

import type { BaseClient } from './base.js'

// =============================================================================
// 内联类型定义
// =============================================================================

export interface V1GenerationEnqueueRequest {
  type: string
  payload: Record<string, unknown>
  priority?: number
}

export interface V1GenerationEnqueueResponse {
  jobId: string
  status: 'queued'
  position: number
}

export interface V1GenerationStatusResponse {
  jobId: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  result?: unknown
  error?: string
  progress?: number
}

/** 取消生成任务响应。 */
export interface V1GenerationCancelResponse {
  jobId: string
  status: 'cancelled'
}

// =============================================================================
// Module 接口 + 工厂函数
// =============================================================================

export interface GenerationModule {
  /** POST /v1/generation/enqueue(入队生成任务)。 */
  enqueue(req: V1GenerationEnqueueRequest): Promise<V1GenerationEnqueueResponse>
  /** GET /v1/generation/status/:id(查询生成状态)。 */
  getStatus(jobId: string): Promise<V1GenerationStatusResponse>
  /** POST /v1/generation/cancel/:id(取消生成任务)。 */
  cancel(jobId: string): Promise<V1GenerationCancelResponse>
}

export function createGenerationModule(client: BaseClient): GenerationModule {
  return {
    enqueue: (req) =>
      client.request<V1GenerationEnqueueResponse>('POST', '/generation/enqueue', req),
    getStatus: (jobId) =>
      client.request<V1GenerationStatusResponse>(
        'GET',
        `/generation/status/${encodeURIComponent(jobId)}`,
      ),
    cancel: (jobId) =>
      client.request<V1GenerationCancelResponse>(
        'POST',
        `/generation/cancel/${encodeURIComponent(jobId)}`,
      ),
  }
}
