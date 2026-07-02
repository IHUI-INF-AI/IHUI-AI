/**
 * 通知公告管理 API
 * 对接后端: app/api/v1/admin_panel.py (notice_router)
 * 路由前缀: /api/v1/notice
 *
 * 后端列表返回 {code, msg, data:[...], total};
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 */
import http from '@/utils/request'
import type { ApiResponse } from '@/types'

export interface NoticeListParams {
  current?: number
  size?: number
  keyword?: string
  noticeType?: string
  status?: string
  [k: string]: unknown
}

export interface AdminNotice {
  /** 公告ID */
  noticeId: number
  /** 公告标题 */
  noticeTitle: string
  /** 公告类型 (1=通知 2=公告) */
  noticeType: string
  /** 公告内容 */
  noticeContent?: string
  /** 状态 (0=正常 1=关闭) */
  status: string
  /** 创建者 */
  createBy?: string
  /** 创建时间 */
  createTime?: string | null
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

/** 通知公告列表 (分页) */
export async function noticeList(params: NoticeListParams = {}): Promise<ApiResponse<{ records: AdminNotice[]; total: number }>> {
  const res = await http.get('/api/v1/notice/list', {
    params: {
      page: params.current ?? 1,
      size: params.size ?? 20,
      noticeTitle: params.keyword || undefined,
      noticeType: params.noticeType || undefined,
      status: params.status || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<{ records: AdminNotice[]; total: number }>
}

/** 通知公告详情 */
export async function noticeDetail(noticeId: number): Promise<ApiResponse<AdminNotice | null>> {
  const res = await http.get(`/api/v1/notice/${noticeId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminNotice | null>
}

/** 新增通知公告 */
export async function noticeCreate(payload: Partial<AdminNotice>): Promise<ApiResponse<AdminNotice>> {
  const res = await http.post('/api/v1/notice', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminNotice>
}

/** 修改通知公告 */
export async function noticeUpdate(payload: Partial<AdminNotice> & { noticeId: number }): Promise<ApiResponse<AdminNotice>> {
  const res = await http.put('/api/v1/notice', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AdminNotice>
}

/** 删除通知公告 (批量, 逗号分隔) */
export async function noticeDelete(noticeIds: (string | number)[]): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/notice/${noticeIds.join(',')}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const adminNoticeApi = {
  noticeList,
  noticeDetail,
  noticeCreate,
  noticeUpdate,
  noticeDelete,
}

export default adminNoticeApi
