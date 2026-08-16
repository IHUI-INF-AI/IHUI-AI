/**
 * 视频模块 — 生成 / 任务查询 / 编排。
 *
 * 端点(3 个):
 * - POST /v1/videos/generations
 * - GET  /v1/videos/tasks/:id
 * - POST /v1/videos/compose
 */

import type { BaseClient } from './base.js'

// =============================================================================
// 内联类型定义
// =============================================================================

export interface V1VideoGenerationsRequest {
  model: string
  prompt: string
  image?: string
  duration?: number
  resolution?: string
  vendor?: string
}

export interface V1VideoGenerationsResponse {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  estimatedTime?: number
}

export interface V1VideoTaskResponse {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  progress?: number
  error?: string
  createdAt: string
}

export interface V1VideoComposeRequest {
  scenes: Array<{
    text: string
    duration: number
    imagePrompt?: string
  }>
  bgmUrl?: string
}

export interface V1VideoComposeResponse {
  composeId: string
  status: 'processing' | 'completed' | 'failed'
}

// =============================================================================
// Module 接口 + 工厂函数
// =============================================================================

export interface VideosModule {
  /** POST /v1/videos/generations(视频生成,异步任务)。 */
  generations(req: V1VideoGenerationsRequest): Promise<V1VideoGenerationsResponse>
  /** GET /v1/videos/tasks/:id(查询视频任务状态)。 */
  getTask(taskId: string): Promise<V1VideoTaskResponse>
  /** POST /v1/videos/compose(视频编排)。 */
  compose(req: V1VideoComposeRequest): Promise<V1VideoComposeResponse>
}

export function createVideosModule(client: BaseClient): VideosModule {
  return {
    generations: (req) =>
      client.request<V1VideoGenerationsResponse>('POST', '/videos/generations', req),
    getTask: (taskId) =>
      client.request<V1VideoTaskResponse>('GET', `/videos/tasks/${encodeURIComponent(taskId)}`),
    compose: (req) => client.request<V1VideoComposeResponse>('POST', '/videos/compose', req),
  }
}
