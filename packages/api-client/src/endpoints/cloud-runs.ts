// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 云运行历史端点(`/api/cloud-runs/*`,ai-service 路由,apps/api openapi 无此域)。
 *
 * 后端证据:`apps/ai-service/app/routers/cloud_runs.py:39` `router = APIRouter(prefix="/cloud-runs")`,
 * main.py 以 `include_router(cloud_runs.router, prefix="/api", tags=["cloud-runs"])` 挂载 → 最终:
 * - GET /api/cloud-runs              列表(page / page_size / 可选 status,回 pageSize)
 * - GET /api/cloud-runs/{run_id}     单条详情(归属型记录,非本人与不存在同为 404)
 * 另有写入口 POST /run、PATCH /run/{id}(CLI 用),端内无调用点,不在此封装。
 *
 * 基址:前端原有三处调用都走 api-client 的 `fetchApi`(web `/api/cloud-runs` 经 next rewrites /
 * nginx 反代到 ai-service)。本域按 A 类台账要求走 ai-service 腿 `fetchAiServiceJson`;
 * 该腿未注入 override 时沿用共享 baseUrl,web 注入 '' 时同源,故 URL 与原调用完全一致、基址未改。
 */
import type { ApiResult } from '@ihui/types'

import { fetchAiServiceJson } from '../client.js'
import { buildQs } from '../utils.js'

export interface CloudRunListQuery {
  page?: number
  page_size?: number
  status?: string
}

export interface CloudRunItem {
  run_id: string
  task: string
  status: 'running' | 'done' | 'error'
  agent_type?: string
  output_summary?: string
  output?: string
  error?: string
  session_alias?: string
  user_id?: string
  started_at?: string
  ended_at?: string
}

export interface CloudRunList<T = CloudRunItem> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

/** 云运行历史列表 — GET /api/cloud-runs */
export async function listCloudRuns<T = CloudRunItem>(
  query: CloudRunListQuery = {},
): Promise<ApiResult<CloudRunList<T>>> {
  return fetchAiServiceJson<CloudRunList<T>>(`/api/cloud-runs${buildQs(query)}`)
}

/** 云运行详情 — GET /api/cloud-runs/{run_id} */
export async function getCloudRun<T = CloudRunItem>(id: string): Promise<ApiResult<T>> {
  return fetchAiServiceJson<T>(`/api/cloud-runs/${encodeURIComponent(id)}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
