/**
 * 管理后台 - OAuth 审计日志聚合统计 API (Round 31-C 新增)
 * 后端约定: GET /api/v1/agents/oauth-apps/audit-logs/stats
 *
 * 用途: admin 仪表盘展示审计日志趋势 (按 event / 按日 / 按 client_id Top N)
 */
import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { normalizeApiResponse } from '@/utils/api-response'

/** 按 event 分组统计 (含成功/失败分布) */
export interface AuditLogStatByEvent {
  event: string
  total: number
  success: number
  failure: number
}

/** 按日统计趋势 */
export interface AuditLogStatByDay {
  date: string
  count: number
}

/** 按 client_id 分组 Top 10 */
export interface AuditLogStatByClient {
  client_id: string
  count: number
}

/** 聚合统计响应 */
export interface AuditLogStats {
  days: number
  start: string
  end: string
  total: number
  by_event: AuditLogStatByEvent[]
  by_day: AuditLogStatByDay[]
  by_client: AuditLogStatByClient[]
}

/** 查询参数 */
export interface AuditLogStatsParams {
  /** 统计近 N 天数据 (默认 30, 范围 1-365) */
  days?: number
}

/** 获取审计日志聚合统计 */
export async function getOAuthAuditLogStats(
  params?: AuditLogStatsParams
): Promise<ApiResponse<AuditLogStats>> {
  try {
    const response = await request.get<AuditLogStats>(
      '/api/v1/agents/oauth-apps/audit-logs/stats',
      { params }
    )
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '请求失败',
      data: {
        days: 30,
        start: '',
        end: '',
        total: 0,
        by_event: [],
        by_day: [],
        by_client: [],
      },
      success: false,
      timestamp: Date.now(),
    }
  }
}
