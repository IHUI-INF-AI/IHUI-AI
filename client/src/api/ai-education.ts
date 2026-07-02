/**
 * AI 教育模块 API
 * 对接后端: app/api/v1/ai_education/
 * 路由前缀: /api/v1/ai-education
 *
 * 包含 5 个资源:
 *   - Policy 政策法规            /policy
 *   - TeacherCertification 教师认证  /teacher-certification
 *   - AigcTool AIGC 工具          /aigc-tool
 *   - K12Curriculum K12 课程      /k12-curriculum
 *   - UniversityCourse 高校课程    /university-course
 *
 * 后端列表响应为 { code, msg, data: [...], total },
 * 本文件统一转换为 { records, total } 以适配 useAdminTable 默认提取器。
 * 注意: 后端创建/更新接口均使用 Query 参数传值。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

// ===========================================================================
// 类型定义
// ===========================================================================

/** AI 教育政策法规 */
export interface AiEduPolicy {
  pid: number
  policyName: string
  issuingAuthority: string
  createTime?: string | null
}

/** 教师认证 */
export interface TeacherCertification {
  cid: number
  certName: string
  issuingAuthority: string
  trainingHours?: number
  createTime?: string | null
}

/** AIGC 工具 */
export interface AigcTool {
  tid: number
  name: string
  category: string
  subcategory?: string
  provider?: string
  description?: string
  createTime?: string | null
}

/** K12 课程 */
export interface K12Curriculum {
  kid: number
  stage: string
  gradeRange: string
  courseName: string
  createTime?: string | null
}

/** 高校课程 */
export interface UniversityCourse {
  uid: number
  courseName: string
  hours: number
  university: string
  description?: string
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
// 政策法规 Policy
// ===========================================================================

/** 政策法规列表 */
export async function policyList(params: { page: number; limit: number }): Promise<ApiResponse<PaginationResponse<AiEduPolicy>>> {
  const res = await http.get('/api/v1/ai-education/policy', {
    params: { page: params.page, limit: params.limit },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<AiEduPolicy>>
}

/** 政策法规详情 (pid 走路径参数) */
export async function policyDetail(pid: number): Promise<ApiResponse<AiEduPolicy | null>> {
  const res = await http.get(`/api/v1/ai-education/policy/${pid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AiEduPolicy | null>
}

/** 新增政策法规 (后端使用 Query 参数) */
export async function policyCreate(params: { policyName: string; issuingAuthority: string }): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/ai-education/policy', null, {
    params: {
      policy_name: params.policyName,
      issuing_authority: params.issuingAuthority,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 修改政策法规 (pid 走路径参数, 其余走 Query) */
export async function policyUpdate(pid: number, params: { policyName?: string; issuingAuthority?: string }): Promise<ApiResponse<unknown>> {
  const res = await http.put(`/api/v1/ai-education/policy/${pid}`, null, {
    params: {
      policy_name: params.policyName || undefined,
      issuing_authority: params.issuingAuthority || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 删除政策法规 (pid 走路径参数) */
export async function policyDelete(pid: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/ai-education/policy/${pid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

// ===========================================================================
// 教师认证 TeacherCertification
// ===========================================================================

/** 教师认证列表 */
export async function teacherCertList(params: { page: number; limit: number }): Promise<ApiResponse<PaginationResponse<TeacherCertification>>> {
  const res = await http.get('/api/v1/ai-education/teacher-certification', {
    params: { page: params.page, limit: params.limit },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<TeacherCertification>>
}

/** 教师认证详情 (cid 走路径参数) */
export async function teacherCertDetail(cid: number): Promise<ApiResponse<TeacherCertification | null>> {
  const res = await http.get(`/api/v1/ai-education/teacher-certification/${cid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<TeacherCertification | null>
}

/** 新增教师认证 (后端使用 Query 参数) */
export async function teacherCertCreate(params: {
  certName: string
  issuingAuthority: string
  trainingHours?: number
}): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/ai-education/teacher-certification', null, {
    params: {
      cert_name: params.certName,
      issuing_authority: params.issuingAuthority,
      training_hours: params.trainingHours ?? undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 修改教师认证 (cid 走路径参数, 其余走 Query) */
export async function teacherCertUpdate(cid: number, params: {
  certName?: string
  issuingAuthority?: string
  trainingHours?: number
}): Promise<ApiResponse<unknown>> {
  const res = await http.put(`/api/v1/ai-education/teacher-certification/${cid}`, null, {
    params: {
      cert_name: params.certName || undefined,
      issuing_authority: params.issuingAuthority || undefined,
      training_hours: params.trainingHours ?? undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 删除教师认证 (cid 走路径参数) */
export async function teacherCertDelete(cid: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/ai-education/teacher-certification/${cid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

// ===========================================================================
// AIGC 工具 AigcTool
// ===========================================================================

/** AIGC 工具列表 */
export async function aigcToolList(params: { page: number; limit: number; category?: string }): Promise<ApiResponse<PaginationResponse<AigcTool>>> {
  const res = await http.get('/api/v1/ai-education/aigc-tool', {
    params: {
      page: params.page,
      limit: params.limit,
      category: params.category || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<AigcTool>>
}

/** AIGC 工具详情 (tid 走路径参数) */
export async function aigcToolDetail(tid: number): Promise<ApiResponse<AigcTool | null>> {
  const res = await http.get(`/api/v1/ai-education/aigc-tool/${tid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<AigcTool | null>
}

/** 新增 AIGC 工具 (后端使用 Query 参数) */
export async function aigcToolCreate(params: {
  name: string
  category: string
  subcategory?: string
  provider?: string
  description?: string
}): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/ai-education/aigc-tool', null, {
    params: {
      name: params.name,
      category: params.category,
      subcategory: params.subcategory || undefined,
      provider: params.provider || undefined,
      description: params.description || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 修改 AIGC 工具 (tid 走路径参数, 其余走 Query) */
export async function aigcToolUpdate(tid: number, params: {
  name?: string
  category?: string
  subcategory?: string
  provider?: string
  description?: string
}): Promise<ApiResponse<unknown>> {
  const res = await http.put(`/api/v1/ai-education/aigc-tool/${tid}`, null, {
    params: {
      name: params.name || undefined,
      category: params.category || undefined,
      subcategory: params.subcategory || undefined,
      provider: params.provider || undefined,
      description: params.description || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 删除 AIGC 工具 (tid 走路径参数) */
export async function aigcToolDelete(tid: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/ai-education/aigc-tool/${tid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

// ===========================================================================
// K12 课程 K12Curriculum
// ===========================================================================

/** K12 课程列表 */
export async function k12CurriculumList(params: { page: number; limit: number; stage?: string }): Promise<ApiResponse<PaginationResponse<K12Curriculum>>> {
  const res = await http.get('/api/v1/ai-education/k12-curriculum', {
    params: {
      page: params.page,
      limit: params.limit,
      stage: params.stage || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<K12Curriculum>>
}

/** K12 课程详情 (kid 走路径参数) */
export async function k12CurriculumDetail(kid: number): Promise<ApiResponse<K12Curriculum | null>> {
  const res = await http.get(`/api/v1/ai-education/k12-curriculum/${kid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<K12Curriculum | null>
}

/** 新增 K12 课程 (后端使用 Query 参数) */
export async function k12CurriculumCreate(params: {
  stage: string
  gradeRange: string
  courseName: string
}): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/ai-education/k12-curriculum', null, {
    params: {
      stage: params.stage,
      grade_range: params.gradeRange,
      course_name: params.courseName,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 修改 K12 课程 (kid 走路径参数, 其余走 Query) */
export async function k12CurriculumUpdate(kid: number, params: {
  stage?: string
  gradeRange?: string
  courseName?: string
}): Promise<ApiResponse<unknown>> {
  const res = await http.put(`/api/v1/ai-education/k12-curriculum/${kid}`, null, {
    params: {
      stage: params.stage || undefined,
      grade_range: params.gradeRange || undefined,
      course_name: params.courseName || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 删除 K12 课程 (kid 走路径参数) */
export async function k12CurriculumDelete(kid: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/ai-education/k12-curriculum/${kid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

// ===========================================================================
// 高校课程 UniversityCourse
// ===========================================================================

/** 高校课程列表 */
export async function universityCourseList(params: { page: number; limit: number; university?: string }): Promise<ApiResponse<PaginationResponse<UniversityCourse>>> {
  const res = await http.get('/api/v1/ai-education/university-course', {
    params: {
      page: params.page,
      limit: params.limit,
      university: params.university || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<UniversityCourse>>
}

/** 高校课程详情 (uid 走路径参数) */
export async function universityCourseDetail(uid: number): Promise<ApiResponse<UniversityCourse | null>> {
  const res = await http.get(`/api/v1/ai-education/university-course/${uid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<UniversityCourse | null>
}

/** 新增高校课程 (后端使用 Query 参数) */
export async function universityCourseCreate(params: {
  courseName: string
  hours: number
  university: string
  description?: string
}): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/ai-education/university-course', null, {
    params: {
      course_name: params.courseName,
      hours: params.hours,
      university: params.university,
      description: params.description || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 修改高校课程 (uid 走路径参数, 其余走 Query) */
export async function universityCourseUpdate(uid: number, params: {
  courseName?: string
  hours?: number
  university?: string
  description?: string
}): Promise<ApiResponse<unknown>> {
  const res = await http.put(`/api/v1/ai-education/university-course/${uid}`, null, {
    params: {
      course_name: params.courseName || undefined,
      hours: params.hours ?? undefined,
      university: params.university || undefined,
      description: params.description || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 删除高校课程 (uid 走路径参数) */
export async function universityCourseDelete(uid: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/ai-education/university-course/${uid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const aiEducationApi = {
  // Policy
  policyList,
  policyDetail,
  policyCreate,
  policyUpdate,
  policyDelete,
  // TeacherCert
  teacherCertList,
  teacherCertDetail,
  teacherCertCreate,
  teacherCertUpdate,
  teacherCertDelete,
  // AigcTool
  aigcToolList,
  aigcToolDetail,
  aigcToolCreate,
  aigcToolUpdate,
  aigcToolDelete,
  // K12
  k12CurriculumList,
  k12CurriculumDetail,
  k12CurriculumCreate,
  k12CurriculumUpdate,
  k12CurriculumDelete,
  // University
  universityCourseList,
  universityCourseDetail,
  universityCourseCreate,
  universityCourseUpdate,
  universityCourseDelete,
}

export default aiEducationApi
