/**
 * 需求广场管理端 API
 * 对接后端: app/api/v1/agent_need_task/agent_need_task.py
 * 路由前缀: /api/v1/agent-need-task
 *
 * 后端列表返回 {code, msg, data:[...], total};
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 *
 * 需求状态 (后端 AgentNeedTask.status):
 *   0=待认领 1=已认领 2=开发中 3=已完成 4=已取消
 * 审核语义映射: 通过 -> 1 (发布/已认领), 拒绝 -> 4 (已取消)
 */
import http from '@/utils/request'
import type { ApiResponse } from '@/types'

export interface DemandListParams {
  current?: number
  size?: number
  keyword?: string
  status?: number
  type?: string
  userId?: string
  [k: string]: unknown
}

export interface DemandItem {
  id: number
  user_id: string
  user_name?: string
  agent_id?: string
  agent_name?: string
  title: string
  description: string
  type?: string
  priority?: number
  budget?: number
  deadline?: string | null
  status: number
  developer_id?: string
  developer_name?: string
  accept_time?: string | null
  complete_time?: string | null
  deliverable?: string | null
  remark?: string | null
  create_time?: string | null
}

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

export async function demandList(params: DemandListParams = {}): Promise<ApiResponse<{ records: DemandItem[]; total: number }>> {
  const res = await http.get('/api/v1/agent-need-task/list', {
    params: {
      page: params.current ?? 1,
      limit: params.size ?? 20,
      keyword: params.keyword || undefined,
      status: params.status,
      type: params.type || undefined,
      user_id: params.userId || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<{ records: DemandItem[]; total: number }>
}

export async function demandDetail(tid: number): Promise<ApiResponse<DemandItem | null>> {
  const res = await http.get(`/api/v1/agent-need-task/${tid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<DemandItem | null>
}

export interface DemandUpdatePayload {
  tid: number
  title?: string
  description?: string
  priority?: number
  budget?: number
  status?: number
  deliverable?: string
  remark?: string
}

export async function demandUpdate(payload: DemandUpdatePayload): Promise<ApiResponse<unknown>> {
  const res = await http.put(`/api/v1/agent-need-task/${payload.tid}`, null, {
    params: {
      title: payload.title,
      description: payload.description,
      priority: payload.priority,
      budget: payload.budget,
      status: payload.status,
      deliverable: payload.deliverable,
      remark: payload.remark,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export async function demandDelete(tid: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/agent-need-task/${tid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 审核需求: pass=true 通过(状态1), pass=false 拒绝(状态4) */
export async function demandReview(payload: { tid: number; pass: boolean; remark?: string }): Promise<ApiResponse<unknown>> {
  return demandUpdate({
    tid: payload.tid,
    status: payload.pass ? 1 : 4,
    remark: payload.remark,
  })
}

export const demandApi = {
  demandList,
  demandDetail,
  demandUpdate,
  demandDelete,
  demandReview,
}

export default demandApi
