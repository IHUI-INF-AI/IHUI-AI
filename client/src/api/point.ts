/**
 * 积分体系 API (账户/规则/流水/签到/商品/兑换)
 * 对接后端: app/api/v1/point/point.py
 * 路由前缀: /api/v1/point
 *
 * 后端列表响应为 {code, msg, data:[...], total},
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 * 注意: 后端 rule/goods/exchange/trigger 等接口均使用 Query 参数传值。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

export interface PointListParams {
  current?: number
  size?: number
  keyword?: string
  status?: string
  type?: string
  action?: string
  [k: string]: unknown
}

export interface PointAccount {
  userId: string
  total: number
  available: number
  frozen: number
  updateTime?: string | null
}

export interface PointLog {
  id: number
  userId: string
  delta: number
  type: string
  refType?: string | null
  refId?: string | null
  remark?: string | null
  createTime?: string | null
}

export interface PointRule {
  ruleId: number
  code: string
  name: string
  delta: number
  type: string
  status: string
  remark?: string | null
  createTime?: string | null
}

export interface PointGoods {
  goodsId: number
  name: string
  description?: string
  price: number
  stock: number
  image?: string
  status: string
  createTime?: string | null
}

export interface PointExchange {
  id: number
  userId: string
  goodsId: number
  quantity: number
  costPoints: number
  status: string
  createTime?: string | null
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
// 积分账户
// ===========================================================================

/** 我的积分账户 */
export async function pointAccount(): Promise<ApiResponse<PointAccount | null>> {
  const res = await http.get('/api/v1/point/account')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<PointAccount | null>
}

// ===========================================================================
// 积分流水
// ===========================================================================

/** 积分流水列表 */
export async function pointLogList(params: PointListParams = {}): Promise<ApiResponse<PaginationResponse<PointLog>>> {
  const res = await http.get('/api/v1/point/log/list', {
    params: {
      page: params.current ?? 1,
      limit: params.size ?? 20,
      type: params.type || undefined,
      action: params.action || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<PointLog>>
}

// ===========================================================================
// 签到
// ===========================================================================

/** 今日签到 (查询今日是否已签到) */
export async function pointTodaySign(): Promise<ApiResponse<unknown>> {
  const res = await http.get('/api/v1/point/signin/today')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 签到状态 */
export async function pointSignStatus(): Promise<ApiResponse<unknown>> {
  const res = await http.get('/api/v1/point/signin/status')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 每日签到 (执行签到动作) */
export async function pointSignin(): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/point/signin')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

// ===========================================================================
// 积分规则
// ===========================================================================

/** 积分规则列表 */
export async function pointRuleList(type?: string): Promise<ApiResponse<PointRule[]>> {
  const res = await http.get('/api/v1/point/rule/list', {
    params: { type: type || undefined },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<PointRule[]>
}

/** 新增规则 (后端使用 Query 参数) */
export async function pointRuleCreate(payload: {
  code: string
  name: string
  type?: string
  action: string
  delta?: number
  maxPerDay?: number
  remark?: string
}): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/point/rule', null, {
    params: {
      code: payload.code,
      name: payload.name,
      type: payload.type || 'add',
      action: payload.action,
      point: payload.delta ?? 0,
      max_per_day: payload.maxPerDay ?? 0,
      description: payload.remark || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 修改规则 (后端使用 Query 参数) */
export async function pointRuleUpdate(ruleId: number, payload: {
  name?: string
  delta?: number
  maxPerDay?: number
  status?: number
}): Promise<ApiResponse<unknown>> {
  const res = await http.put(`/api/v1/point/rule/${ruleId}`, null, {
    params: {
      name: payload.name || undefined,
      point: payload.delta,
      max_per_day: payload.maxPerDay,
      status: payload.status,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 删除规则 */
export async function pointRuleDelete(ruleId: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/point/rule/${ruleId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

// ===========================================================================
// 触发积分
// ===========================================================================

/** 触发积分行为 (后端使用 Query 参数) */
export async function pointTrigger(payload: {
  action: string
  description?: string
  refId?: string
  refType?: string
  userId?: string
}): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/point/trigger', null, {
    params: {
      action: payload.action,
      description: payload.description || undefined,
      ref_id: payload.refId || undefined,
      ref_type: payload.refType || undefined,
      user_id: payload.userId || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

// ===========================================================================
// 积分商品
// ===========================================================================

/** 积分商品列表 */
export async function pointGoodsList(params: PointListParams = {}): Promise<ApiResponse<PaginationResponse<PointGoods>>> {
  const res = await http.get('/api/v1/point/goods/list', {
    params: {
      page: params.current ?? 1,
      limit: params.size ?? 20,
      keyword: params.keyword || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<PointGoods>>
}

/** 积分商品详情 */
export async function pointGoodsDetail(goodsId: number): Promise<ApiResponse<PointGoods | null>> {
  const res = await http.get(`/api/v1/point/goods/${goodsId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<PointGoods | null>
}

/** 新增积分商品 (后端使用 Query 参数) */
export async function pointGoodsCreate(payload: {
  name: string
  description?: string
  image?: string
  price: number
  stock?: number
  limitPerUser?: number
  type?: string
  sortOrder?: number
}): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/point/goods', null, {
    params: {
      name: payload.name,
      description: payload.description || undefined,
      image: payload.image || undefined,
      point_cost: payload.price,
      stock: payload.stock ?? 0,
      limit_per_user: payload.limitPerUser ?? 1,
      type: payload.type || 'virtual',
      sort_order: payload.sortOrder ?? 0,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 修改积分商品 (后端使用 Query 参数) */
export async function pointGoodsUpdate(goodsId: number, payload: {
  name?: string
  description?: string
  price?: number
  stock?: number
  status?: number
}): Promise<ApiResponse<unknown>> {
  const res = await http.put(`/api/v1/point/goods/${goodsId}`, null, {
    params: {
      name: payload.name || undefined,
      description: payload.description || undefined,
      point_cost: payload.price,
      stock: payload.stock,
      status: payload.status,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 删除积分商品 */
export async function pointGoodsDelete(goodsId: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/point/goods/${goodsId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

// ===========================================================================
// 积分兑换
// ===========================================================================

/** 兑换商品 (后端使用 Query 参数) */
export async function pointExchange(payload: {
  goodsId: number
  quantity?: number
  address?: string
  contact?: string
}): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/point/exchange', null, {
    params: {
      goods_id: payload.goodsId,
      quantity: payload.quantity ?? 1,
      address: payload.address || undefined,
      contact: payload.contact || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 兑换记录列表 */
export async function pointExchangeList(params: PointListParams = {}): Promise<ApiResponse<PaginationResponse<PointExchange>>> {
  const res = await http.get('/api/v1/point/exchange/list', {
    params: {
      page: params.current ?? 1,
      limit: params.size ?? 20,
      status: params.status || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<PointExchange>>
}

export const pointApi = {
  pointAccount,
  pointLogList,
  pointTodaySign,
  pointSignStatus,
  pointRuleList,
  pointRuleCreate,
  pointRuleUpdate,
  pointRuleDelete,
  pointTrigger,
  pointSignin,
  pointGoodsList,
  pointGoodsDetail,
  pointGoodsCreate,
  pointGoodsUpdate,
  pointGoodsDelete,
  pointExchange,
  pointExchangeList,
}

export default pointApi
