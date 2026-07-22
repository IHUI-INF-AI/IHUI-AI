/**
 * 视频模块 — 生成 / 任务查询 / 编排。
 *
 * 端点(3 个):
 * - POST /v1/videos/generations
 * - GET  /v1/videos/tasks/:id
 * - POST /v1/videos/compose
 */

import type { BaseClient } from './base.js'
import type {
  V1VideoGenerationsRequest,
  V1VideoGenerationsResponse,
  V1VideoTaskResponse,
  V1VideoComposeRequest,
  V1VideoComposeResponse,
} from '@ihui/types'

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
