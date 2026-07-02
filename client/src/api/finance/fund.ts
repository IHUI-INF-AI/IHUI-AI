/**
 * 资金账户 API (使用 Token / 信息 / 统计 / 文件转流)
 * 对接后端: finance/fund 模块
 * 路由前缀: /api/v1/finance/fund
 *
 * 注意: 不包含回调端点 (notify/app/notify/agent/transfer/notify)。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

export interface FundInfo {
  userId: string
  balance: number
  frozenBalance: number
  totalUsed: number
}

export interface FundStatistics {
  totalToken: number
  usedToken: number
  remainingToken: number
}

// 统一构造 ApiResponse<{records, total}> 格式
function toListResult(rows: unknown[], total: number, msg = 'success'): ApiResponse<{ records: unknown[]; total: number }> {
  return {
    code: 0,
    message: msg,
    data: { records: rows, total },
    success: true,
    timestamp: Date.now(),
  } as unknown as ApiResponse<{ records: unknown[]; total: number }>
}

function toDataResult(data: unknown, msg = 'success'): ApiResponse<unknown> {
  return {
    code: 0,
    message: msg,
    data,
    success: true,
    timestamp: Date.now(),
  } as unknown as ApiResponse<unknown>
}

// ===========================================================================
// 资金账户操作
// ===========================================================================

/** 使用 Token (Body 传值) */
export async function fundUseToken(data: { uuid: string; quantity: number }): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/finance/fund/useToken', data)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 获取资金账户信息 */
export async function fundGetInfo(token: string): Promise<ApiResponse<FundInfo | null>> {
  const res = await http.get('/api/v1/finance/fund/getInfo', {
    params: { token },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<FundInfo | null>
}

/** 获取产品信息 */
export async function fundGetProduct(): Promise<ApiResponse<unknown>> {
  const res = await http.get('/api/v1/finance/fund/getProduct')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 获取统计数据 (GET, Body 传值) */
export async function fundGetStatistics(data: { now: string | number; uuid: string }): Promise<ApiResponse<FundStatistics | null>> {
  const res = await http.get('/api/v1/finance/fund/getStatistics', {
    data,
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<FundStatistics | null>
}

/** 文件转流 (Body 传值) */
export async function fundFileToStream(data: { file: File | string }): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/finance/fund/file/to/stream', data)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const financeFundApi = {
  fundUseToken,
  fundGetInfo,
  fundGetProduct,
  fundGetStatistics,
  fundFileToStream,
}

export default financeFundApi