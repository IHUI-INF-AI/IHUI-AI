// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 佣金订单端点(补 RN 承载用,2026-10-27 后端契约现读)
 *
 *  - GET /api/finance/commission/orders?page&limit&status&orderType
 *    → 信封 success({ items, total })(apps/api/src/routes/finance.ts:174-201)
 *    鉴权 authenticate(apps/api/src/routes/finance.ts:175);
 *    page ≥1 默认 1、limit 1..100 默认 20(apps/api/src/routes/finance.ts:179-180);
 *    status 打在 orders.status、orderType 打在 orders.payment_method
 *    (apps/api/src/routes/finance.ts:187-188,后者是字面实现的列错位,本封装如实透传不修正)。
 *  - 行形状 = drizzle db.select().from(orders) 全列(packages/database/src/schema/billing.ts:79-108),
 *    这里只声明展示层实际消费的列(金额单位为「分」,billing.ts:85)。
 *  - web 同参数消费方:apps/web/app/(main)/distribution/orders/page.tsx:85。
 *  - 与既有 packages/api-client/src/endpoints/distribution.ts:94 getCommissionList
 *    (GET /distribution/list,commission_flows 表)是两个数据源,不可互相顶替。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

/** orders 表行(GET /api/finance/commission/orders → data.items) */
export interface CommissionOrderItem {
  id: string
  orderNo: string
  userId: string | null
  /** 金额(分,packages/database/src/schema/billing.ts:85) */
  amount: number
  currency: string
  /** varchar(16) 默认 'pending';可取 pending/paid/cancelled/refunded */
  status: string
  paymentMethod: string | null
  paidAt: string | null
  createdAt: string
}

export interface CommissionOrderListResult {
  items: CommissionOrderItem[]
  total: number
}

export interface CommissionOrderQuery {
  page?: number
  /** 后端上限 100(apps/api/src/routes/finance.ts:180) */
  limit?: number
  status?: string
  orderType?: string
}

export async function getCommissionOrders(
  query: CommissionOrderQuery = {},
): Promise<ApiResult<CommissionOrderListResult>> {
  return fetchApi<CommissionOrderListResult>(`/api/finance/commission/orders${buildQs(query)}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
