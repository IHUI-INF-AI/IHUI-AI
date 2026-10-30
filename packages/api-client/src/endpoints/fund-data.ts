// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 基金数据端点封装（fund-data 域）
 *
 * 承载 web 路由 /fund-data
 * (apps/web/app/(main)/fund-data/page.tsx)。
 *
 * 后端契约（现读 apps/api，2026-10-27）：
 *  - GET /api/fund?page&pageSize&search
 *    → 信封 success({ list, total, page, pageSize })
 *      (apps/api/src/routes/user/fund-routes.ts:146-153)
 *    查询见 findFunds(apps/api/src/db/fund-queries.ts:9-30)：
 *      只取 funds.status = 1 的行，按 code 升序，search 走 ilike(funds.name)
 *    分页参数由 parsePagination 解析
 *      (apps/api/src/routes/user/_shared.ts:14-18,23-30)，
 *      page 默认 1、pageSize 默认 20 且上限 100
 *  - GET /api/fund/:code/history?page&pageSize
 *    → 信封 success({ list, total, page, pageSize })
 *      (apps/api/src/routes/user/fund-routes.ts:163-174)，
 *      基金不存在时 404（error 信封）
 *    查询见 findFundNetValues(apps/api/src/db/fund-queries.ts:41-57)，按 date 倒序
 *
 * 鉴权：fundRoutes 注册在 missingUserRoutes 内
 * (apps/api/src/routes/user/index.ts:26,51)，
 * 该插件整体挂 userAuthPreHandler
 * (apps/api/src/routes/user/index.ts:36 → apps/api/src/routes/user/_shared.ts:50-53)，
 * 且 missingUserRoutes 以 prefix /api 注册
 * (apps/api/src/routes/index.ts:1088)，故 /api/fund* 需登录。
 *
 * 行字段（packages/database/src/schema/funds.ts:18-33,36-48）：
 *  - funds: id / code / name / type(可空) / status(1=活跃) / createdAt
 *  - fund_net_values: id / fundId / date(YYYY-MM-DD) / value(numeric(10,4)，可空) / createdAt
 *
 * 与既有封装的关系（不可互相顶替）：
 *  - endpoints/business.ts 的 getFunds 返回 PageData<Fund>（items/total 形状），
 *    getFundNetValueHistory 返回裸数组，与后端真实的
 *    { list, total, page, pageSize } 信封不符；本文件为 fund-data 域另建细域名件，
 *    导出名统一 FundData* 前缀，避免 barrel `export *` 重名。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

/** funds 行（GET /api/fund → data.list） */
export interface FundDataItem {
  id: string
  code: string
  name: string
  /** 基金类型，可空 */
  type: string | null
  /** 1=活跃（后端只返回 status=1 的行） */
  status: number
  createdAt: string
}

/** fund_net_values 行（GET /api/fund/:code/history → data.list） */
export interface FundNetValueItem {
  id: string
  fundId: string
  /** YYYY-MM-DD */
  date: string
  /** numeric(10,4)，可空；web 侧按 toFixed(4) 展示 */
  value: string | null
  createdAt: string
}

export interface FundDataListResult {
  list: FundDataItem[]
  total: number
  page: number
  pageSize: number
}

export interface FundNetValueListResult {
  list: FundNetValueItem[]
  total: number
  page: number
  pageSize: number
}

export interface FundDataListQuery {
  page?: number
  /** 后端上限 100（apps/api/src/routes/user/_shared.ts:16） */
  pageSize?: number
  /** 后端只对基金名称做 ilike（apps/api/src/db/fund-queries.ts:13） */
  search?: string
}

/** GET /api/fund —— 基金列表（需登录） */
export async function getFundDataList(
  query: FundDataListQuery = {},
): Promise<ApiResult<FundDataListResult>> {
  return fetchApi<FundDataListResult>(`/api/fund${buildQs(query)}`)
}

/** GET /api/fund/:code/history —— 基金净值历史（需登录；基金不存在时 404） */
export async function getFundDataHistory(
  code: string,
  query: Pick<FundDataListQuery, 'page' | 'pageSize'> = {},
): Promise<ApiResult<FundNetValueListResult>> {
  const path = `/api/fund/${encodeURIComponent(code)}/history`
  return fetchApi<FundNetValueListResult>(`${path}${buildQs(query)}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
