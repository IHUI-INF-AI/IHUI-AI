import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client'
import { buildQs } from '../utils'

/**
 * SRS 媒体服务器相关 API(对接后端 apps/api/src/routes/srs.ts)。
 *
 * 后端路由注册于 /srs 前缀(经 normalizeUrl 补 /api 前缀,最终为 /api/srs/...)。
 * 端点清单(12 个):
 * - 流管理:GET/POST /srs/streams、GET /srs/streams/:key、PUT/DELETE /srs/streams/:id、
 *   POST /srs/streams/:key/kick、GET /srs/streams/:key/status
 * - 服务器管理:GET/POST /srs/servers、PUT/DELETE /srs/servers/:id、GET /srs/servers/:id/health
 *
 * 命名约定:
 * - createSrsStream / updateSrsStream / getSrsStreamStatus 与 miniapp-taro 原生 API 同名,
 *   便于 miniapp-taro 后续通过 unwrapApi() 桥接迁移到 @ihui/api-client。
 * - 按 streamKey 查询的端点使用 ByKey 后缀(getSrsStreamByKey),按 id 操作的端点直接用 id 参数,
 *   与后端 :key / :id 参数语义对齐。
 */

export interface SrsStream {
  id: string
  streamKey: string
  title: string
  pushUrl: string | null
  recvBytes: number | null
  sendBytes: number | null
  status: 'active' | 'inactive' | 'banned'
  channelId?: string | null
  endTime?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface SrsStreamList {
  list: SrsStream[]
  page: number
  pageSize: number
}

export interface SrsStreamStatus {
  streamKey: string
  /** SRS 原始流状态对象(结构由 SRS 服务端返回,此处保留 unknown 以兼容不同版本) */
  srsStatus: unknown
}

export interface SrsServer {
  id: string
  name: string
  host: string
  rtmpPort: number
  httpPort: number
  webrtcPort: number
  apiPort: number
  apiSecret: string | null
  maxStreams: number
  healthCheckUrl: string | null
  status: 'online' | 'offline'
  lastHealthCheck?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface SrsServerHealth {
  healthy: boolean
  serverId: string
  status: 'online' | 'offline'
  [key: string]: unknown
}

export type SrsStreamListQuery = {
  status?: string
  page?: number
  pageSize?: number
}

export type SrsCreateStreamInput = {
  title: string
  channelId?: string
}

export type SrsUpdateStreamInput = Partial<{
  title: string
  status: 'active' | 'inactive' | 'banned'
  channelId: string
}>

export type SrsCreateServerInput = {
  name: string
  host: string
  rtmpPort?: number
  httpPort?: number
  webrtcPort?: number
  apiPort?: number
  apiSecret?: string
  maxStreams?: number
  healthCheckUrl?: string
}

export type SrsUpdateServerInput = Partial<SrsCreateServerInput>

// ===== 流管理 =====

/** 流列表 — GET /srs/streams */
export async function getSrsStreams(
  query: SrsStreamListQuery = {},
): Promise<ApiResult<SrsStreamList>> {
  return fetchApi<SrsStreamList>(`/srs/streams${buildQs(query)}`)
}

/** 流详情(按 streamKey 查询)— GET /srs/streams/:key */
export async function getSrsStreamByKey(key: string): Promise<ApiResult<SrsStream>> {
  return fetchApi<SrsStream>(`/srs/streams/${encodeURIComponent(key)}`)
}

/** 创建直播流(生成推流密钥+URL)— POST /srs/streams */
export async function createSrsStream(
  data: SrsCreateStreamInput,
): Promise<ApiResult<SrsStream>> {
  return fetchApi<SrsStream>('/srs/streams', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/** 更新直播流(结束直播传 status='inactive')— PUT /srs/streams/:id */
export async function updateSrsStream(
  id: string,
  data: SrsUpdateStreamInput,
): Promise<ApiResult<SrsStream>> {
  return fetchApi<SrsStream>(`/srs/streams/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/** 删除直播流 — DELETE /srs/streams/:id */
export async function deleteSrsStream(id: string): Promise<ApiResult<{ deleted: boolean }>> {
  return fetchApi<{ deleted: boolean }>(`/srs/streams/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

/** 踢出推流 — POST /srs/streams/:key/kick */
export async function kickSrsStream(
  key: string,
): Promise<ApiResult<{ kicked: boolean; streamKey: string }>> {
  return fetchApi<{ kicked: boolean; streamKey: string }>(
    `/srs/streams/${encodeURIComponent(key)}/kick`,
    { method: 'POST' },
  )
}

/** 查询 SRS 实时流状态 — GET /srs/streams/:key/status */
export async function getSrsStreamStatus(key: string): Promise<ApiResult<SrsStreamStatus>> {
  return fetchApi<SrsStreamStatus>(`/srs/streams/${encodeURIComponent(key)}/status`)
}

// ===== SRS 服务器管理 =====

/** SRS 服务器列表 — GET /srs/servers */
export async function getSrsServers(): Promise<ApiResult<SrsServer[]>> {
  return fetchApi<SrsServer[]>('/srs/servers')
}

/** 添加 SRS 服务器 — POST /srs/servers */
export async function createSrsServer(
  data: SrsCreateServerInput,
): Promise<ApiResult<SrsServer>> {
  return fetchApi<SrsServer>('/srs/servers', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/** 更新 SRS 服务器 — PUT /srs/servers/:id */
export async function updateSrsServer(
  id: string,
  data: SrsUpdateServerInput,
): Promise<ApiResult<SrsServer>> {
  return fetchApi<SrsServer>(`/srs/servers/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/** 删除 SRS 服务器 — DELETE /srs/servers/:id */
export async function deleteSrsServer(id: string): Promise<ApiResult<{ deleted: boolean }>> {
  return fetchApi<{ deleted: boolean }>(`/srs/servers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

/** SRS 服务器健康检查 — GET /srs/servers/:id/health */
export async function checkSrsServerHealth(id: string): Promise<ApiResult<SrsServerHealth>> {
  return fetchApi<SrsServerHealth>(`/srs/servers/${encodeURIComponent(id)}/health`)
}
