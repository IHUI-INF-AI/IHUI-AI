/**
 * 图像模块 — 文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景生成。
 *
 * 端点(6 个):
 * - POST /v1/images/generations
 * - POST /v1/images/edits
 * - POST /v1/images/inpaint
 * - POST /v1/images/style-transfer
 * - POST /v1/images/virtual-try-on
 * - POST /v1/images/background
 */

import type { BaseClient } from './base.js'
import type {
  V1ImageGenerationsRequest,
  V1ImageGenerationsResponse,
  V1ImageEditsRequest,
  V1ImageInpaintRequest,
  V1StyleTransferRequest,
  V1VirtualTryOnRequest,
  V1BackgroundGenerationRequest,
} from '@ihui/types'

/** 图片编辑/修复/风格迁移等通用响应(复用 V1ImageGenerationsResponse)。 */
type ImageEditResponse = V1ImageGenerationsResponse

export interface ImagesModule {
  /** POST /v1/images/generations(文生图)。 */
  generations(req: V1ImageGenerationsRequest): Promise<V1ImageGenerationsResponse>
  /** POST /v1/images/edits(图片编辑)。 */
  edits(req: V1ImageEditsRequest): Promise<ImageEditResponse>
  /** POST /v1/images/inpaint(图片修复)。 */
  inpaint(req: V1ImageInpaintRequest): Promise<ImageEditResponse>
  /** POST /v1/images/style-transfer(风格迁移)。 */
  styleTransfer(req: V1StyleTransferRequest): Promise<ImageEditResponse>
  /** POST /v1/images/virtual-try-on(虚拟试穿)。 */
  virtualTryOn(req: V1VirtualTryOnRequest): Promise<ImageEditResponse>
  /** POST /v1/images/background(背景生成)。 */
  background(req: V1BackgroundGenerationRequest): Promise<ImageEditResponse>
}

export function createImagesModule(client: BaseClient): ImagesModule {
  return {
    generations: (req) =>
      client.request<V1ImageGenerationsResponse>('POST', '/images/generations', req),
    edits: (req) => client.request<ImageEditResponse>('POST', '/images/edits', req),
    inpaint: (req) => client.request<ImageEditResponse>('POST', '/images/inpaint', req),
    styleTransfer: (req) => client.request<ImageEditResponse>('POST', '/images/style-transfer', req),
    virtualTryOn: (req) => client.request<ImageEditResponse>('POST', '/images/virtual-try-on', req),
    background: (req) => client.request<ImageEditResponse>('POST', '/images/background', req),
  }
}
