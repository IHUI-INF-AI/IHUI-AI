// 访问埋点 API
// 迁移自 H:\edu client\web\web\src\api\visittracking\index.js
// 用于前端 SDK 记录用户访问行为

import { request } from '@/utils/request'

const VISIT_PATH = '/visit-tracking/public-api/visit-log'

/**
 * 保存访问埋点日志
 * - 入参：访问行为数据（含页面 URL、来源、停留时长、设备信息等）
 * - 后端对应：Python ihui-ai-edu-behavior-service 的 VisitTracking 写入
 */
export function saveVisitTracking(data: Record<string, unknown>) {
  return request.post(VISIT_PATH, data)
}

/**
 * 查询访问埋点日志（admin 后台）
 */
export function listVisitTracking(params: Record<string, unknown>) {
  return request.get('/visit-tracking/visit-log/page', { params })
}

/**
 * 查询访问埋点统计
 */
export function getVisitTrackingStats(params: Record<string, unknown>) {
  return request.get('/visit-tracking/visit-log/stats', { params })
}
