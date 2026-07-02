/**
 * 证书体系 API (模板/证书实例/状态流转)
 * 对接后端: app/api/v1/certificate/certificate.py
 * 路由前缀: /api/v1/certificate
 *
 * 后端列表响应为 {code, msg, data:[...], total},
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 * 注意: 后端 create/update 等接口均使用 Query 参数传值。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

export interface CertificateListParams {
  current?: number
  size?: number
  keyword?: string
  status?: string
  companyId?: number
  memberId?: string
  lessonId?: number
  [k: string]: unknown
}

/** 证书模板 */
export interface CertificateTemplate {
  tid: number
  name: string
  description?: string
  awardingOrganization?: string
  awarderName?: string
  awarderPosition?: string
  design?: string
  awardConditions?: string
  validityPolicy?: string
  status: string
  companyId?: number
  createTime?: string | null
}

/** 证书实例 */
export interface Certificate {
  cid: number
  name: string
  code?: string
  description?: string
  awardingOrganization?: string
  awarderName?: string
  awarderPosition?: string
  design?: string
  awardConditions?: string
  validityPolicy?: string
  awardDate?: string | null
  validity?: string | null
  status: string
  memberId?: string
  lessonId?: number
  score?: number
  companyId?: number
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
// 证书模板
// ===========================================================================

/** 证书模板列表 */
export async function certificateTemplateList(params: CertificateListParams = {}): Promise<ApiResponse<PaginationResponse<CertificateTemplate>>> {
  const res = await http.get('/api/v1/certificate/template/list', {
    params: {
      page: params.current ?? 1,
      limit: params.size ?? 20,
      keyword: params.keyword || undefined,
      status: params.status || undefined,
      companyId: params.companyId,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<CertificateTemplate>>
}

/** 证书模板详情 (tid 走路径参数) */
export async function certificateTemplateDetail(tid: number): Promise<ApiResponse<CertificateTemplate | null>> {
  const res = await http.get(`/api/v1/certificate/template/${tid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<CertificateTemplate | null>
}

/** 创建证书模板 */
export async function certificateTemplateCreate(params: {
  name: string
  description?: string
  awardingOrganization?: string
  awarderName?: string
  awarderPosition?: string
  design?: string
  awardConditions?: string
  validityPolicy?: string
  status?: string
  companyId?: number
}): Promise<ApiResponse<CertificateTemplate>> {
  const res = await http.post('/api/v1/certificate/template', null, {
    params: {
      name: params.name,
      description: params.description || undefined,
      awardingOrganization: params.awardingOrganization || undefined,
      awarderName: params.awarderName || undefined,
      awarderPosition: params.awarderPosition || undefined,
      design: params.design || undefined,
      awardConditions: params.awardConditions || undefined,
      validityPolicy: params.validityPolicy || undefined,
      status: params.status || undefined,
      companyId: params.companyId,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<CertificateTemplate>
}

/** 修改证书模板 (tid 走路径参数,其余走 Query) */
export async function certificateTemplateUpdate(tid: number, params: {
  name?: string
  description?: string
  awardingOrganization?: string
  awarderName?: string
  awarderPosition?: string
  design?: string
  awardConditions?: string
  validityPolicy?: string
  status?: string
  companyId?: number
}): Promise<ApiResponse<CertificateTemplate>> {
  const res = await http.put(`/api/v1/certificate/template/${tid}`, null, {
    params: {
      name: params.name || undefined,
      description: params.description || undefined,
      awardingOrganization: params.awardingOrganization || undefined,
      awarderName: params.awarderName || undefined,
      awarderPosition: params.awarderPosition || undefined,
      design: params.design || undefined,
      awardConditions: params.awardConditions || undefined,
      validityPolicy: params.validityPolicy || undefined,
      status: params.status || undefined,
      companyId: params.companyId,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<CertificateTemplate>
}

/** 删除证书模板 (tid 走路径参数) */
export async function certificateTemplateDelete(tid: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/certificate/template/${tid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}
// ===========================================================================
// 证书实例
// ===========================================================================

/** 证书实例列表 */
export async function certificateList(params: CertificateListParams = {}): Promise<ApiResponse<PaginationResponse<Certificate>>> {
  const res = await http.get('/api/v1/certificate/list', {
    params: {
      page: params.current ?? 1,
      limit: params.size ?? 20,
      memberId: params.memberId || undefined,
      lessonId: params.lessonId,
      status: params.status || undefined,
      companyId: params.companyId,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<Certificate>>
}

/** 证书实例详情 (cid 走路径参数) */
export async function certificateDetail(cid: number): Promise<ApiResponse<Certificate | null>> {
  const res = await http.get(`/api/v1/certificate/${cid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<Certificate | null>
}

/** 创建证书实例 */
export async function certificateCreate(params: {
  name: string
  code?: string
  description?: string
  awardingOrganization?: string
  awarderName?: string
  awarderPosition?: string
  design?: string
  awardConditions?: string
  validityPolicy?: string
  status?: string
  memberId?: string
  lessonId?: number
  score?: number
  companyId?: number
}): Promise<ApiResponse<Certificate>> {
  const res = await http.post('/api/v1/certificate', null, {
    params: {
      name: params.name,
      code: params.code || undefined,
      description: params.description || undefined,
      awardingOrganization: params.awardingOrganization || undefined,
      awarderName: params.awarderName || undefined,
      awarderPosition: params.awarderPosition || undefined,
      design: params.design || undefined,
      awardConditions: params.awardConditions || undefined,
      validityPolicy: params.validityPolicy || undefined,
      status: params.status || undefined,
      memberId: params.memberId || undefined,
      lessonId: params.lessonId,
      score: params.score,
      companyId: params.companyId,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<Certificate>
}

/** 修改证书实例 (cid 走路径参数,其余走 Query) */
export async function certificateUpdate(cid: number, params: {
  name?: string
  code?: string
  description?: string
  awardingOrganization?: string
  awarderName?: string
  awarderPosition?: string
  design?: string
  awardConditions?: string
  validityPolicy?: string
  status?: string
  memberId?: string
  lessonId?: number
  score?: number
  companyId?: number
}): Promise<ApiResponse<Certificate>> {
  const res = await http.put(`/api/v1/certificate/${cid}`, null, {
    params: {
      name: params.name || undefined,
      code: params.code || undefined,
      description: params.description || undefined,
      awardingOrganization: params.awardingOrganization || undefined,
      awarderName: params.awarderName || undefined,
      awarderPosition: params.awarderPosition || undefined,
      design: params.design || undefined,
      awardConditions: params.awardConditions || undefined,
      validityPolicy: params.validityPolicy || undefined,
      status: params.status || undefined,
      memberId: params.memberId || undefined,
      lessonId: params.lessonId,
      score: params.score,
      companyId: params.companyId,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<Certificate>
}

/** 删除证书实例 (cid 走路径参数) */
export async function certificateDelete(cid: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/certificate/${cid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}
// ===========================================================================
// 证书状态流转 (PUT /{cid}/{status})
// ===========================================================================

/** 设置证书为有效 */
export async function certificateSetValid(cid: number): Promise<ApiResponse<unknown>> {
  const res = await http.put(`/api/v1/certificate/${cid}/valid`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 设置证书为停用 */
export async function certificateSetSuspended(cid: number): Promise<ApiResponse<unknown>> {
  const res = await http.put(`/api/v1/certificate/${cid}/suspended`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 设置证书为撤销 */
export async function certificateSetRevoked(cid: number): Promise<ApiResponse<unknown>> {
  const res = await http.put(`/api/v1/certificate/${cid}/revoked`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 设置证书为取消 */
export async function certificateSetCancelled(cid: number): Promise<ApiResponse<unknown>> {
  const res = await http.put(`/api/v1/certificate/${cid}/cancelled`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 设置证书为过期 */
export async function certificateSetExpired(cid: number): Promise<ApiResponse<unknown>> {
  const res = await http.put(`/api/v1/certificate/${cid}/expired`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const certificateApi = {
  certificateTemplateList,
  certificateTemplateDetail,
  certificateTemplateCreate,
  certificateTemplateUpdate,
  certificateTemplateDelete,
  certificateList,
  certificateDetail,
  certificateCreate,
  certificateUpdate,
  certificateDelete,
  certificateSetValid,
  certificateSetSuspended,
  certificateSetRevoked,
  certificateSetCancelled,
  certificateSetExpired,
}

export default certificateApi