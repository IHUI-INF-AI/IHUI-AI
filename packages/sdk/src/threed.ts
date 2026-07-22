/**
 * 3D 模型生成模块。
 *
 * 端点(1 个):
 * - POST /v1/3d/generations
 */

import type { BaseClient } from './base.js'
import type { V1ThreeDGenerationsRequest, V1ThreeDGenerationsResponse } from '@ihui/types'

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
