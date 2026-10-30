// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 教育积分端点(补 RN 承载用,后端契约现读)
 *
 *  - GET /api/edu-points/channels
 *    → 信封 success({ list })(apps/api/src/routes/point.ts:160-169),
 *    行 = edu_point_channels 全列、仅 status=1 且按 sort 升序
 *    (apps/api/src/db/point-queries.ts:58-64);注册前缀 /api = apps/api/src/routes/index.ts:649。
 *    注意:该插件的 preHandler 是 checkAuth(apps/api/src/routes/point.ts:156-158),
 *    故 channels 实际也需登录 —— web 页当作公开配置未加门(apps/web/app/(main)/edu-points/page.tsx:40-51),
 *    本封装如实按需登录调用,并把「未登录不发注定 401 的请求」交给薄壳门。
 *  - GET /api/edu-points/my-points
 *    → 信封 success({ points })(apps/api/src/routes/point.ts:208-217),
 *    points 为当前用户余额整数(findUserPointsBalance)。
 *  - GET /api/points/mall/redeem
 *    → 信封 success({ list, balance? })(apps/api/src/routes/points-mall-user.ts:62-95);
 *    list 仅 status='on' 且落在 start/end 时间窗内,balance 仅登录时附带(查失败则缺省)。
 *  - POST /api/points/mall/redeem/:id
 *    → 信封 success({ orderId, points, redeemed })(apps/api/src/routes/points-mall-user.ts:166-171);
 *    库存/限购/余额三类拒绝均为 400/409 + error(message),不做静默成功。
 *  - 建前已 ls endpoints/:无 edu-points / points-mall 同名件;既有 edu.ts(报告导出)、
 *    edu-ai.ts(AIGC 工具)数据源不同,不复用。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/** edu_point_channels 行(GET /api/edu-points/channels → data.list),只声明展示层消费列 */
export interface EduPointChannel {
  id: string
  name: string
  code: string | null
  description: string | null
  sort: number
}

/** GET /api/points/mall/redeem → data.list 行(points-mall-user.ts:70-86 投影) */
export interface PointsMallGoods {
  id: string
  name: string
  cover: string | null
  pointsCost: number
  stock: number
  sold: number
  limitPerUser: number
}

export interface PointsMallGoodsResult {
  list: PointsMallGoods[]
  /** 仅登录请求时后端附带;查失败会缺省,消费方按 undefined 处理 */
  balance?: number
}

export interface PointsMallRedeemResult {
  orderId: string
  /** 兑换后剩余积分 */
  points: number
  /** 本次消耗积分 */
  redeemed: number
}

export async function getEduPointChannels(): Promise<ApiResult<{ list: EduPointChannel[] }>> {
  return fetchApi<{ list: EduPointChannel[] }>('/api/edu-points/channels')
}

export async function getMyEduPoints(): Promise<ApiResult<{ points: number }>> {
  return fetchApi<{ points: number }>('/api/edu-points/my-points')
}

export async function getPointsMallGoods(): Promise<ApiResult<PointsMallGoodsResult>> {
  return fetchApi<PointsMallGoodsResult>('/api/points/mall/redeem')
}

export async function redeemPointsMallGoods(
  id: string,
): Promise<ApiResult<PointsMallRedeemResult>> {
  return fetchApi<PointsMallRedeemResult>(
    `/api/points/mall/redeem/${encodeURIComponent(id)}`,
    { method: 'POST' },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
