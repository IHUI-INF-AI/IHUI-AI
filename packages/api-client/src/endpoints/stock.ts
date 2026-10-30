// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 股票分析端点封装（stock 域）
 *
 * 承载 web 路由 /stock
 * (apps/web/app/(main)/stock/page.tsx)。
 *
 * 后端契约（现读 apps/api，2026-10-27）：
 *  - GET /api/stock/token-balance
 *    → 信封 success({ total, used, remaining })
 *      (apps/api/src/routes/stock.ts:29-33，checkAuth)
 *    计算见 getTokenBalance(apps/api/src/services/stock-service.ts:161-178)：
 *      total=monthlyQuota、used=max(0, quota-balance)、remaining=balance；
 *      服务不可用时降级返回 {total:10000, used:0, remaining:10000}
 *  - POST /api/stock/analyse  body { symbol, question, conversationId? }
 *    → 201 信封 success(result)
 *      (apps/api/src/routes/stock.ts:36-50，checkAuth)
 *    body 校验 analysisSchema(apps/api/src/routes/stock.ts:15-19)：
 *      symbol 长度 1-20、question 长度 1-2000
 *    Token 余额不足 / 扣减失败 → 402；其他错误 → 400（error 信封）
 *    未配置股票 AI 服务时返回 mock 结果
 *      (apps/api/src/services/stock-service.ts:240-250)：
 *      { symbol, analysis:'', tokensUsed:0, error:'Stock API not configured', mock:true }
 *  - GET /api/stock/history?symbol&page&pageSize
 *    → 信封 success({ list, total })
 *      (apps/api/src/routes/stock.ts:53-63，checkAuth)
 *    查询见 getStockHistory(apps/api/src/services/stock-service.ts:312-348)，
 *    按 createdAt 倒序；表不存在或查询失败时降级返回空列表
 *  - stockRoutes 以 prefix /api/stock 注册
 *    (apps/api/src/routes/index.ts:806-807)
 *
 * 结果行字段（apps/api/src/services/stock-service.ts:30-38）：
 *  - symbol / analysis / conversationId / tokensUsed / createdAt
 *  - error（可选）/ mock（可选）
 *
 * 与既有封装的关系（不可互相顶替）：
 *  - endpoints/token.ts 的 getTokenBalance 打 GET /api/user/token-balance，
 *    是另一数据源；endpoints/business.ts 的 getStocks/getStockDetail 打的是
 *    基金/行情类端点，返回形状与本域不同。故为 stock 域另建细域名件，
 *    导出名统一 StockAnalyse* 前缀，避免 barrel `export *` 重名。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/** Token 余额（GET /api/stock/token-balance → data） */
export interface StockAnalyseTokenBalance {
  total: number
  used: number
  remaining: number
}

/** 单次分析结果（POST /api/stock/analyse → data；GET /api/stock/history → data.list[]） */
export interface StockAnalyseResult {
  symbol: string
  analysis: string
  conversationId: string
  tokensUsed: number
  /** JSON 序列化为 ISO 字符串 */
  createdAt: string
  /** 失败原因（mock 分支为 'Stock API not configured'） */
  error?: string
  /** true 表示分析服务未配置，返回的是演示数据 */
  mock?: boolean
}

export interface StockAnalyseHistoryResult {
  list: StockAnalyseResult[]
  total: number
}

export interface StockAnalyseHistoryQuery {
  symbol?: string
  page?: number
  /** 后端上限 100（apps/api/src/routes/stock.ts:24） */
  pageSize?: number
}

export interface StockAnalyseRequestBody {
  /** 1-20 字符（apps/api/src/routes/stock.ts:16） */
  symbol: string
  /** 1-2000 字符（apps/api/src/routes/stock.ts:17） */
  question: string
  conversationId?: string
}

/** GET /api/stock/token-balance —— Token 余额（需登录） */
export async function getStockAnalyseTokenBalance(): Promise<ApiResult<StockAnalyseTokenBalance>> {
  return fetchApi<StockAnalyseTokenBalance>('/api/stock/token-balance')
}

/** POST /api/stock/analyse —— 发起股票分析（需登录；余额不足 402） */
export async function postStockAnalyse(
  body: StockAnalyseRequestBody,
): Promise<ApiResult<StockAnalyseResult>> {
  return fetchApi<StockAnalyseResult>('/api/stock/analyse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** GET /api/stock/history —— 历史分析分页（需登录） */
export async function getStockAnalyseHistory(
  query: StockAnalyseHistoryQuery = {},
): Promise<ApiResult<StockAnalyseHistoryResult>> {
  const qs = new URLSearchParams()
  if (query.symbol) qs.set('symbol', query.symbol)
  if (query.page !== undefined) qs.set('page', String(query.page))
  if (query.pageSize !== undefined) qs.set('pageSize', String(query.pageSize))
  const s = qs.toString()
  return fetchApi<StockAnalyseHistoryResult>(`/api/stock/history${s ? `?${s}` : ''}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
