// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 钱包提现记录端点封装（wallet 域提现流水）
 *
 * 承载 web 路由 /wallet/withdraw/records
 * (apps/web/app/(main)/wallet/withdraw/records/page.tsx)。
 *
 * 后端契约（现读 apps/api，2026-10-27）：
 *  - GET /api/finance/withdrawal/list?page&limit
 *    → 信封 success({ items, total })
 *      (apps/api/src/routes/finance.ts:288-294，authenticate)
 *    行来自 listWithdrawals(apps/api/src/db/commission-queries.ts:529-544，
 *    withdrawal_flows 全列,createdAt 倒序)
 *    financeRoutes 挂 prefix /api(apps/api/src/routes/index.ts:741)
 *  - GET /api/finance/withdrawal/summary
 *    → 信封 success({ totalWithdrawn, pendingAmount })
 *      (apps/api/src/routes/finance.ts:296-301，authenticate)
 *    计算见 withdrawalSummary(apps/api/src/db/commission-queries.ts:643-656):
 *      totalWithdrawn = sum(amount) where status=2（已完成）
 *      pendingAmount   = sum(amount) where status in (0,1)（待审核+处理中）
 *  - GET /api/finance/withdrawal/available
 *    → 信封 success({ available })
 *      (apps/api/src/routes/finance.ts:303-308，authenticate)
 *    计算见 availableWithdrawal(apps/api/src/db/commission-queries.ts:658-666)
 *
 * 行字段单位与含义（packages/database/src/schema/commission.ts:53-79）：
 *  - amount         实际到账金额（分，已扣手续费）
 *  - fee            手续费（分）
 *  - originalAmount 原始申请金额（分）
 *  - status         0=待审核 1=处理中 2=已完成 3=失败
 *  - method         wechat | alipay | bank
 *  - processedAt    可空；createdAt 创建时间
 *
 * 与既有封装的关系（不可互相顶替）：
 *  - endpoints/withdraw-records.ts 的 getWithdrawalRecords 打同一条
 *    GET /api/finance/withdrawal/list，但归属 distribution 域、导出名无前缀，
 *    且不含 summary/available；本文件为 wallet 域另起细域名件，导出名统一
 *    WalletWithdrawal* 前缀，避免 barrel `export *` 重名。
 *  - endpoints/wallet.ts 的 getWithdrawRecords 打 GET /api/wallet/withdraw/records，
 *    是另一个数据源（钱包账户流水），与 /api/finance/withdrawal/* 不同源。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

/** withdrawal_flows 行（GET /api/finance/withdrawal/list → data.items） */
export interface WalletWithdrawalItem {
  id: string
  /** 实际到账（分，已扣手续费） */
  amount: number
  /** 手续费（分） */
  fee: number
  /** 原始申请金额（分） */
  originalAmount: number
  /** 0=待审核 1=处理中 2=已完成 3=失败 */
  status: number
  /** wechat | alipay | bank */
  method: string
  createdAt: string
  processedAt: string | null
}

export interface WalletWithdrawalListResult {
  items: WalletWithdrawalItem[]
  total: number
}

/**
 * 提现汇总（GET /api/finance/withdrawal/summary → data）
 * totalWithdrawn = 已完成(status=2)金额合计；pendingAmount = 待审核+处理中合计
 */
export interface WalletWithdrawalSummary {
  totalWithdrawn: number
  pendingAmount: number
}

export interface WalletWithdrawalListQuery {
  page?: number
  /** 后端上限 100（apps/api/src/routes/finance.ts:31-35） */
  limit?: number
}

/** GET /api/finance/withdrawal/list —— 提现流水分页 */
export async function getWalletWithdrawalRecords(
  query: WalletWithdrawalListQuery = {},
): Promise<ApiResult<WalletWithdrawalListResult>> {
  return fetchApi<WalletWithdrawalListResult>(
    `/api/finance/withdrawal/list${buildQs(query)}`,
  )
}

/** GET /api/finance/withdrawal/summary —— 已到账 / 处理中金额 */
export async function getWalletWithdrawalSummary(): Promise<
  ApiResult<WalletWithdrawalSummary>
> {
  return fetchApi<WalletWithdrawalSummary>('/api/finance/withdrawal/summary')
}

/** GET /api/finance/withdrawal/available —— 当前可提现金额（分） */
export async function getWalletWithdrawalAvailable(): Promise<ApiResult<{ available: number }>> {
  return fetchApi<{ available: number }>('/api/finance/withdrawal/available')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
