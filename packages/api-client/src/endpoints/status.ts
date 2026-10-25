// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 公开状态页端点(2026-10-21 立,守门 check-direct-backend-calls 新增违规收口:
 * apps/web /status「展开全部」客户端取数改走 api-client 统一层,不再端内裸 fetch)。
 *
 * 覆盖端点:
 * - GET /api/public/status/models   (公开,无鉴权;信封 data.models 逐条由消费侧防御性校验)
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/** 单条模型可用性(对齐后端 /api/public/status/models 的 models 行)。 */
export interface PublicStatusModelRow {
  modelId: string
  displayName: string | null
  providerCode: string
  status: 'operational' | 'degraded' | 'outage'
  p95LatencyMs: number
  errorRate: number
  lastIncidentAt: string | null
}

/** /api/public/status/models 的信封 data 载荷。 */
export interface PublicStatusModelsPayload {
  models: PublicStatusModelRow[]
}

/** 获取公开模型可用性列表(公开端点)。 */
export async function getPublicStatusModels(): Promise<ApiResult<PublicStatusModelsPayload>> {
  return fetchApi<PublicStatusModelsPayload>('/api/public/status/models')
}

/** 单条事件(对齐后端 /api/public/status/incidents 的 incidents 行)。 */
export interface PublicStatusIncident {
  id: string
  providerCode: string
  modelId: string | null
  startedAt: string
  resolvedAt: string | null
  severity: 'minor' | 'major' | 'critical'
  description: string
}

/** /api/public/status/incidents 的信封 data 载荷。
 * degraded=true 表示「查询失败所以列表为空」,必须优先于 incidents.length 判断(见 web 端 IncidentsUnavailableNotice)。 */
export interface PublicStatusIncidentsPayload {
  incidents: PublicStatusIncident[]
  degraded: boolean
}

/** /api/public/status/overview 的信封 data 载荷(直接是 Overview,不嵌套)。 */
export interface PublicStatusOverview {
  platform: string
  version: string
  uptime: number
  timestamp: string
  services: Record<string, PublicStatusModelRow['status']>
}

/** 获取公开系统总览(公开端点)。 */
export async function getPublicStatusOverview(): Promise<ApiResult<PublicStatusOverview>> {
  return fetchApi<PublicStatusOverview>('/api/public/status/overview')
}

/** 获取公开事件列表(公开端点)。degraded 见 PublicStatusIncidentsPayload。 */
export async function getPublicStatusIncidents(): Promise<ApiResult<PublicStatusIncidentsPayload>> {
  return fetchApi<PublicStatusIncidentsPayload>('/api/public/status/incidents')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
