// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 文件模块 — 列表 / 上传 / 详情 / 删除 / 内容 / 版本 / 分片上传。
 *
 * 端点(9 个):
 * - GET  /v1/files(文件列表)
 * - POST /v1/files(上传文件,multipart/form-data)
 * - GET  /v1/files/:id(文件详情)
 * - DELETE /v1/files/:id(删除文件)
 * - GET  /v1/files/:id/content(文件内容,二进制流)
 * - GET  /v1/files/:id/versions(文件版本)
 * - POST /v1/files/upload-init(分片上传初始化)
 * - POST /v1/files/upload-chunk(上传分片)
 * - POST /v1/files/complete(完成上传)
 */

import type { BaseClient } from './base.js'
import type {
  V1FileInfo,
  V1FileVersionsResponse,
  V1UploadInitRequest,
  V1UploadInitResponse,
  V1UploadChunkRequest,
  V1UploadCompleteRequest,
} from '@ihui/types'

/** 文件列表响应(GET /v1/files)。 */
export interface V1FilesListResponse {
  object: 'list'
  data: Array<{
    id: string
    object: 'file'
    filename: string
    bytes: number
    createdAt: string
  }>
}

/** 完成分片上传响应。 */
export interface V1UploadCompleteResponse {
  fileId: string
  status: 'completed'
}

export interface FilesModule {
  /** GET /v1/files(文件列表)。 */
  list(): Promise<V1FilesListResponse>
  /** POST /v1/files(上传文件,multipart/form-data)。 */
  upload(file: Blob | File, filename?: string): Promise<V1FileInfo>
  /** GET /v1/files/:id(文件详情)。 */
  get(id: string): Promise<V1FileInfo>
  /** DELETE /v1/files/:id(删除文件)。 */
  delete(id: string): Promise<void>
  /** GET /v1/files/:id/content。同一资产预检通过才发请求。 */
  getContent(
    id: string,
    preflight: { assetId?: unknown; ok?: unknown } | null,
  ): Promise<ReadableStream<Uint8Array>>
  /** GET /v1/files/:id/versions(文件版本列表)。 */
  getVersions(id: string): Promise<V1FileVersionsResponse>
  /** POST /v1/files/upload-init(分片上传初始化)。 */
  uploadInit(req: V1UploadInitRequest): Promise<V1UploadInitResponse>
  /** POST /v1/files/upload-chunk(上传分片)。 */
  uploadChunk(req: V1UploadChunkRequest): Promise<void>
  /** POST /v1/files/complete(完成分片上传)。 */
  uploadComplete(req: V1UploadCompleteRequest): Promise<V1UploadCompleteResponse>
}

export type AssetContentPlan = {
  disposition: 'fetch' | 'refused' | 'unjudged'
  reason:
    | 'preflight-ok'
    | 'preflight-failed'
    | 'preflight-unmeasured'
    | 'asset-mismatch'
    | 'asset-invalid'
    | 'preflight-unreadable'
}

function assetIdOk(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !/[\s\0]/.test(value)
}

/**
 * 读内容之前必须有同一资产的预检。
 * 别的资产预检通过,不能拿来读这一份。
 * 预检结果不是明确的通过或失败时,不发起内容请求。
 */
export function admitAssetContent(input: {
  assetId: unknown
  preflight: { assetId?: unknown; ok?: unknown } | null
}): AssetContentPlan {
  if (!assetIdOk(input.assetId)) return { disposition: 'unjudged', reason: 'asset-invalid' }
  if (input.preflight === null) return { disposition: 'unjudged', reason: 'preflight-unmeasured' }
  if (typeof input.preflight !== 'object')
    return { disposition: 'unjudged', reason: 'preflight-unreadable' }
  if (!assetIdOk(input.preflight.assetId))
    return { disposition: 'unjudged', reason: 'preflight-unreadable' }
  if (input.preflight.assetId !== input.assetId)
    return { disposition: 'refused', reason: 'asset-mismatch' }
  if (input.preflight.ok === true) return { disposition: 'fetch', reason: 'preflight-ok' }
  if (input.preflight.ok === false) return { disposition: 'refused', reason: 'preflight-failed' }
  return { disposition: 'unjudged', reason: 'preflight-unreadable' }
}

export function createFilesModule(client: BaseClient): FilesModule {
  return {
    list: () => client.request<V1FilesListResponse>('GET', '/files'),

    upload: (file, filename) => {
      const formData = new FormData()
      formData.append('file', file, filename ?? (file instanceof File ? file.name : 'upload'))
      return client.request<V1FileInfo>('POST', '/files', formData)
    },

    get: (id) => client.request<V1FileInfo>('GET', `/files/${encodeURIComponent(id)}`),
    delete: (id) => client.request<void>('DELETE', `/files/${encodeURIComponent(id)}`),
    getContent: (id, preflight) => {
      const plan = admitAssetContent({ assetId: id, preflight })
      if (plan.disposition !== 'fetch')
        return Promise.reject(new Error(`asset content ${plan.reason}`))
      return client.requestStream('GET', `/files/${encodeURIComponent(id)}/content`)
    },
    getVersions: (id) =>
      client.request<V1FileVersionsResponse>('GET', `/files/${encodeURIComponent(id)}/versions`),
    uploadInit: (req) => client.request<V1UploadInitResponse>('POST', '/files/upload-init', req),
    uploadChunk: (req) => client.request<void>('POST', '/files/upload-chunk', req),
    uploadComplete: (req) =>
      client.request<V1UploadCompleteResponse>('POST', '/files/complete', req),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
