/**
 * 监控模块 API
 * 对接后端: app/api/v1/monitor/
 * 路由前缀: /api/v1/monitor (含 /alerts, /backfill 子前缀)
 *
 * 涵盖: 告警历史 / 回填 / 抑制规则 / 金丝雀推进器 / 金丝雀审计
 * 注意: 已排除 test/webhook 测试端点。
 *
 * 后端列表响应为 { code, msg, data: [...], total },
 * 本文件统一转换为 { records, total } 以适配 useAdminTable 默认提取器。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

/** 告警历史 */
export interface AlertHistory {
  id: number | string
  alertname: string
  severity: string
  status: string
  startsAt?: string | null
  endsAt?: string | null
  summary?: string
  description?: string
}

/** 回填状态 */
export interface BackfillStatus {
  status?: string
  progress?: number
  current?: number
  total?: number
}

/** 金丝雀审计记录 */
export interface CanaryAudit {
  id: number | string
  name?: string
  action?: string
  status?: string
  timestamp?: string | null
  user?: string
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
// 告警历史 Alerts
// ===========================================================================

/** 告警历史列表 */
export async function monitorAlertHistory(params: { page?: number; limit?: number }): Promise<ApiResponse<PaginationResponse<AlertHistory>>> {
  const res = await http.get('/api/v1/monitor/alerts/history', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<AlertHistory>>
}

// ===========================================================================
// 回填 Backfill
// ===========================================================================

/** 回填状态 */
export async function monitorBackfillStatus(): Promise<ApiResponse<BackfillStatus | null>> {
  const res = await http.get('/api/v1/monitor/backfill/status')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<BackfillStatus | null>
}

/** 回填历史记录 */
export async function monitorBackfillHistory(params: { limit?: number }): Promise<ApiResponse<unknown>> {
  const res = await http.get('/api/v1/monitor/backfill/history', {
    params: { limit: params.limit ?? undefined },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 重置回填 */
export async function monitorBackfillReset(): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/monitor/backfill/reset')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/**
 * 回填进度 (SSE 流)
 * 注意: 该接口返回 Server-Sent Events 流, 此处使用 http.get 获取,
 * 调用方需自行处理流式响应数据。
 */
export async function monitorBackfillProgress(): Promise<ApiResponse<unknown>> {
  const res = await http.get('/api/v1/monitor/backfill/progress', {
    headers: { Accept: 'text/event-stream' },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

// ===========================================================================
// 抑制规则 Inhibition
// ===========================================================================

/** 抑制规则试运行 (Body 参数) */
export async function monitorInhibitionDryRun(data: object): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/monitor/inhibition/dry-run', data)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 抑制规则预设 */
export async function monitorInhibitionPresets(): Promise<ApiResponse<unknown>> {
  const res = await http.get('/api/v1/monitor/inhibition/presets')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

// ===========================================================================
// 金丝雀推进器 CanaryPromoter
// ===========================================================================

/** 金丝雀推进器状态 */
export async function monitorCanaryPromoterStatus(): Promise<ApiResponse<unknown>> {
  const res = await http.get('/api/v1/monitor/canary-promoter/status')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 金丝雀推进器覆盖配置 */
export async function monitorCanaryPromoterOverride(): Promise<ApiResponse<unknown>> {
  const res = await http.get('/api/v1/monitor/canary-promoter/override')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 暂停金丝雀推进 (Body 参数) */
export async function monitorCanaryPromoterPause(data: object): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/monitor/canary-promoter/pause', data)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 恢复金丝雀推进 (Body 参数) */
export async function monitorCanaryPromoterResume(data: object): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/monitor/canary-promoter/resume', data)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 强制推进金丝雀 (Body 参数) */
export async function monitorCanaryPromoterForcePromote(data: object): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/monitor/canary-promoter/force-promote', data)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 强制回滚金丝雀 (Body 参数) */
export async function monitorCanaryPromoterForceRollback(data: object): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/monitor/canary-promoter/force-rollback', data)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

// ===========================================================================
// 金丝雀审计 CanaryAudit
// ===========================================================================

/** 金丝雀审计查询 (Query 参数) */
export async function monitorCanaryAuditQuery(params: object): Promise<ApiResponse<PaginationResponse<CanaryAudit>>> {
  const res = await http.get('/api/v1/monitor/canary-audit', {
    params,
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<CanaryAudit>>
}

/** 金丝雀审计统计 */
export async function monitorCanaryAuditStats(): Promise<ApiResponse<unknown>> {
  const res = await http.get('/api/v1/monitor/canary-audit/stats')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 金丝雀审计清理 (Body 参数) */
export async function monitorCanaryAuditCleanup(data: object): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/monitor/canary-audit/cleanup', data)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const monitorApi = {
  // Alerts
  monitorAlertHistory,
  // Backfill
  monitorBackfillStatus,
  monitorBackfillHistory,
  monitorBackfillReset,
  monitorBackfillProgress,
  // Inhibition
  monitorInhibitionDryRun,
  monitorInhibitionPresets,
  // CanaryPromoter
  monitorCanaryPromoterStatus,
  monitorCanaryPromoterOverride,
  monitorCanaryPromoterPause,
  monitorCanaryPromoterResume,
  monitorCanaryPromoterForcePromote,
  monitorCanaryPromoterForceRollback,
  // CanaryAudit
  monitorCanaryAuditQuery,
  monitorCanaryAuditStats,
  monitorCanaryAuditCleanup,
}

export default monitorApi
