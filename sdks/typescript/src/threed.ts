/**
 * 3D 模型生成模块。
 *
 * 端点(1 个):
 * - POST /v1/3d/generations
 */

import type { BaseClient } from './base.js'

// =============================================================================
// 内联类型定义
// =============================================================================

export interface V1ThreeDGenerationsRequest {
  model: string
  input: string
  format?: string
}

export interface V1ThreeDGenerationsResponse {
  taskId: string
  status: 'pending' | 'processing' | 'completed'
}

// =============================================================================
// Module 接口 + 工厂函数
// =============================================================================

export interface ThreeDModule {
  /** POST /v1/3d/generations(3D 模型生成)。 */
  generations(req: V1ThreeDGenerationsRequest): Promise<V1ThreeDGenerationsResponse>
}

export function createThreeDModule(client: BaseClient): ThreeDModule {
  return {
    generations: (req) =>
      client.request<V1ThreeDGenerationsResponse>('POST', '/3d/generations', req),
  }
}
