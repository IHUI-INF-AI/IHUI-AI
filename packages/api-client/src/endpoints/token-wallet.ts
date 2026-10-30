// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 代币钱包(margin)端点封装(补 RN 承载用,2026-10-27 后端契约现读)
 *
 *  - GET /api/finance/margin/balance
 *    → 信封 success({ balance })(apps/api/src/routes/finance.ts:40-45,authenticate)
 *    与既有 endpoints/token.ts 的 getTokenBalance(GET /api/user/token-balance)是不同数据源,不可顶替。
 *  - GET /api/finance/margin/flows?page&limit&opType
 *    → 信封 success({ items, total })(apps/api/src/routes/finance.ts:139-153,authenticate)
 *    page ≥1 默认 1、limit 1..100 默认 20、opType 可选数字(finance.ts:142-147)。
 *  - 行形状 = listTokenFlows 结果(listTokenFlows 见 commission-queries,字段 id/opType/quantity/
 *    balanceAfter/remark/createdAt),opType 取值 0=充值 1=扣减 2=过期
 *    (web 同表 apps/web/app/(main)/distribution/token/page.tsx:56-60)。
 *  - web 消费方:apps/web/app/(main)/distribution/token/page.tsx:90-101。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

/** GET /api/finance/margin/balance → data */
export interface TokenWalletBalance {
  balance: number
}

/** token_flows 表行(GET /api/finance/margin/flows → data.items) */
export interface TokenFlowItem {
  id: string
  /** 0=充值 1=扣减 2=过期 */
  opType: number
  quantity: number
  balanceAfter: number
  remark: string | null
  createdAt: string
}

export interface TokenFlowListResult {
  items: TokenFlowItem[]
  total: number
}

export interface TokenFlowQuery {
  page?: number
  /** 后端上限 100(apps/api/src/routes/finance.ts:145) */
  limit?: number
  /** 0=充值 1=扣减 2=过期 */
  opType?: number
}

export async function getMarginBalance(): Promise<ApiResult<TokenWalletBalance>> {
  return fetchApi<TokenWalletBalance>('/api/finance/margin/balance')
}

export async function getMarginFlows(
  query: TokenFlowQuery = {},
): Promise<ApiResult<TokenFlowListResult>> {
  return fetchApi<TokenFlowListResult>(`/api/finance/margin/flows${buildQs(query)}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
