// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 访问埋点上报端点(2026-10-26 立)。
 *
 * 端内(RN / 小程序 / 浏览器插件)的页面埋点必须走这里,不得各自手拼 baseUrl 直连后端 ——
 * 那是守门 184「端内绕过 @ihui/api-client」明令拦的形态。web 端仍用 sendBeacon
 * 独立直发(页面卸载场景要的是同步投递,共享 client 保证不了),本函数服务端内。
 */

import type { ApiResult, HistoryItem } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

export interface VisitLogPayload {
  /** 页面路径;RN 为 `/rn/<screen>`,小程序为 `/mp/<route>`,插件为 `/ex/<view>` */
  url: string
  referer?: string
  sessionId?: string
}

export interface VisitLogResult {
  visitLog?: { id?: string }
}

/** 上报一条页面访问(匿名可用,不要求登录)。 */
export function recordVisitLog(payload: VisitLogPayload) {
  return fetchApi<VisitLogResult>('/visit-tracking/visit-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

/**
 * 浏览历史域(2026-11-05 立,门 300 存量 A 类:web / RN 端内直拼 `/api/browse-history` 收口)。
 *
 * 后端真值:`apps/api/src/routes/other/history-routes.ts`(前缀 /api)。
 *  - GET    /api/browse-history        回 `{ list, total, page, pageSize }`(web / RN 都读 `.list`)
 *  - POST   /api/browse-history/visit  上报体 `{ targetType, targetId, title? }`(authenticate)
 *  - DELETE /api/browse-history        清空(web 浏览历史页的写入侧用)
 */

/** GET /api/browse-history 的查询参数。 */
export interface BrowseHistoryQuery {
  page?: number
  pageSize?: number
}

/** GET /api/browse-history 的分页回包。 */
export interface BrowseHistoryResult {
  list: HistoryItem[]
  total: number
  page?: number
  pageSize?: number
}

/** POST /api/browse-history/visit 的上报体。 */
export interface BrowseVisitInput {
  targetType: string
  targetId: string
  title?: string
}

/** GET /api/browse-history —— 当前用户的浏览历史(分页)。 */
export async function listBrowseHistory(
  query: BrowseHistoryQuery = {},
): Promise<ApiResult<BrowseHistoryResult>> {
  return fetchApi<BrowseHistoryResult>(`/api/browse-history${buildQs(query)}`)
}

/** POST /api/browse-history/visit —— 记录一条浏览。 */
export async function recordBrowseVisit(input: BrowseVisitInput): Promise<ApiResult<unknown>> {
  return fetchApi<unknown>('/api/browse-history/visit', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** DELETE /api/browse-history —— 清空浏览历史。 */
export async function clearBrowseHistory(): Promise<ApiResult<{ deletedCount: number }>> {
  return fetchApi<{ deletedCount: number }>('/api/browse-history', { method: 'DELETE' })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
