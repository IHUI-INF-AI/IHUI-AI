// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * edu-ai 域端点(Wave2 2026-10-26 立,台账 web-rn-screen-map.jsonl:292-296 五条 gap 路由收口):
 * 覆盖 web apps/web/app/(main)/edu-ai/{aigc-tools,certification,courses,policy,video-compose} 五页取数。
 *
 * 与 ai.ts:311-323 的关系:ai.ts 的 getAiEducations/getAiEducationDetail 只封装 /api/ai-education 主表
 * (本仓零屏消费),本文件的五个子资源路径(aigc-tool、teacher-certification、k12-curriculum、
 * university-course、policy)与 /api/ai-video-compose 任务域均为新增封装,导出名与既有 barrel 零冲突(逐名核验)。
 *
 * 后端事实源:apps/api/src/routes/ai-education.ts(列表/详情 GET 公开,POST/PUT/DELETE 挂 requireAdmin);
 * apps/api/src/routes/ai-video-compose.ts(POST/GET/:id/POST/:id/regenerate 均需登录态 userId)。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData, type PageQuery } from '../utils.js'

// ===================== aigc-tool =====================

/** 单条 AIGC 工具(对齐 GET /api/ai-education/aigc-tool 行形,web aigc-tools/page.tsx:39 同源)。 */
export interface AigcTool {
  id: string
  name: string
  nameCn?: string
  category: string
  subcategory?: string
  provider?: string
  url?: string
  description?: string
  coreFeatures?: string[] | null
  useCases?: string[] | null
  pricingModel?: string
  pricingDetail?: string
  freeTier?: string
  apiAvailable?: boolean
  mobileApp?: boolean
  pros?: string[] | null
  cons?: string[] | null
  tips?: string[] | null
  alternatives?: string[] | null
  rating?: number
  userCount?: number
}

/** AIGC 工具分页列表(web aigc-tools/page.tsx:174 同址;query 传 page/pageSize/status/keyword/category)。 */
export async function getAigcTools(query: PageQuery = {}): Promise<ApiResult<PageData<AigcTool>>> {
  return fetchApi<PageData<AigcTool>>(`/api/ai-education/aigc-tool${buildQs(query)}`)
}

/** AIGC 工具详情(公开 GET,ai-education.ts:437;信封 data 为 { tool })。 */
export async function getAigcToolDetail(id: string): Promise<ApiResult<{ tool: AigcTool }>> {
  return fetchApi<{ tool: AigcTool }>(`/api/ai-education/aigc-tool/${id}`)
}

// ===================== teacher-certification =====================

/** 单条教师认证(ai-education.ts:292-334 行形,web certification/page.tsx:46 同源)。 */
export interface TeacherCertificationItem {
  id: string
  certName: string
  issuingAuthority: string
  targetTeachers?: string | null
  level?: string | null
  trainingHours?: number | null
  trainingContent?: string | null
  assessmentMethod?: string | null
  certificationRequirements?: string | null
  validity?: string | null
  benefits?: string | null
  status?: string | null
}

/** 教师认证分页列表(web certification/page.tsx:113 同址;query 传 page/pageSize/status/keyword/level)。 */
export async function getTeacherCertifications(
  query: PageQuery = {},
): Promise<ApiResult<PageData<TeacherCertificationItem>>> {
  return fetchApi<PageData<TeacherCertificationItem>>(
    `/api/ai-education/teacher-certification${buildQs(query)}`,
  )
}

/** 教师认证详情(公开 GET,ai-education.ts:318;信封 data 为 { certification })。 */
export async function getTeacherCertificationDetail(
  id: string,
): Promise<ApiResult<{ certification: TeacherCertificationItem }>> {
  return fetchApi<{ certification: TeacherCertificationItem }>(
    `/api/ai-education/teacher-certification/${id}`,
  )
}

// ===================== k12-curriculum =====================

/** 单条 K12 AI 课程(ai-education.ts:512 域行形,web courses/page.tsx:42 同源)。 */
export interface K12CurriculumItem {
  id: string
  stage?: string
  gradeRange?: string
  courseName?: string
  hoursPerYear?: number
  courseType?: string
  learningObjectives?: string
  contentModules?: string
  keyConcepts?: string
  skillRequirements?: string
  teachingMethods?: string
  assessmentMethods?: string
  toolsResources?: string
}

/** K12 课程分页列表(web courses/page.tsx:85 同址;query 传 page/pageSize/status/keyword)。 */
export async function getK12Curriculums(
  query: PageQuery = {},
): Promise<ApiResult<PageData<K12CurriculumItem>>> {
  return fetchApi<PageData<K12CurriculumItem>>(`/api/ai-education/k12-curriculum${buildQs(query)}`)
}

/** K12 课程详情(公开 GET,ai-education.ts:549;信封 data 为 { curriculum })。 */
export async function getK12CurriculumDetail(
  id: string,
): Promise<ApiResult<{ curriculum: K12CurriculumItem }>> {
  return fetchApi<{ curriculum: K12CurriculumItem }>(`/api/ai-education/k12-curriculum/${id}`)
}

// ===================== university-course =====================

/** 单条高校 AI 课程(ai-education.ts:613 域行形,web courses/page.tsx:58 同源;isRequired 线格式三态由消费侧 isTruthy 归一)。 */
export interface UniversityCourseItem {
  id: string
  courseName?: string
  courseType?: string
  targetMajor?: string
  credits?: number
  hours?: number
  university?: string
  description?: string
  modules?: string
  prerequisites?: string
  textbooks?: string
  teachingTeam?: string
  assessment?: string
  isRequired?: boolean | number | string
}

/** 高校课程分页列表(web courses/page.tsx:86 同址;query 传 page/pageSize/status/keyword)。 */
export async function getUniversityCourses(
  query: PageQuery = {},
): Promise<ApiResult<PageData<UniversityCourseItem>>> {
  return fetchApi<PageData<UniversityCourseItem>>(
    `/api/ai-education/university-course${buildQs(query)}`,
  )
}

/** 高校课程详情(公开 GET,ai-education.ts:651;信封 data 为 { course })。 */
export async function getUniversityCourseDetail(
  id: string,
): Promise<ApiResult<{ course: UniversityCourseItem }>> {
  return fetchApi<{ course: UniversityCourseItem }>(`/api/ai-education/university-course/${id}`)
}

// ===================== policy =====================

/** 单条 AI 教育政策(ai-education.ts:190-229 行形,web policy/page.tsx:47 同源)。 */
export interface EduPolicyItem {
  id: string
  policyName: string
  issuingAuthority: string
  issueDate?: string | null
  effectiveDate?: string | null
  policyLevel?: string | null
  targetGroup?: string | null
  summary?: string | null
  keyPoints?: string | null
  implementation?: string | null
  goals?: string | null
  sourceUrl?: string | null
  status?: string | null
}

/** 政策分页列表(web policy/page.tsx:116 同址;query 传 page/pageSize/status/keyword/policyLevel)。 */
export async function getEduPolicies(
  query: PageQuery = {},
): Promise<ApiResult<PageData<EduPolicyItem>>> {
  return fetchApi<PageData<EduPolicyItem>>(`/api/ai-education/policy${buildQs(query)}`)
}

/** 政策详情(公开 GET,ai-education.ts:217;信封 data 为 { policy })。 */
export async function getEduPolicyDetail(
  id: string,
): Promise<ApiResult<{ policy: EduPolicyItem }>> {
  return fetchApi<{ policy: EduPolicyItem }>(`/api/ai-education/policy/${id}`)
}

// ===================== ai-video-compose =====================

export type VideoComposeStepName = 'script' | 'material' | 'compose' | 'subtitle'
export type VideoComposeStepStatus = 'pending' | 'running' | 'succeeded' | 'failed'

/** 编排单步(ai-video-compose.ts 行形,web video-compose/page.tsx:33 同源;result 为透传 JSON,消费侧防御性提取)。 */
export interface VideoComposeStep {
  name: VideoComposeStepName
  status: VideoComposeStepStatus
  result?: unknown
  error?: string
  startedAt?: number
  finishedAt?: number
}

/** 编排任务(需登录态;GET /:id 校验 task.userId === request.userId)。 */
export interface VideoComposeTask {
  id: string
  userId: string
  prompt: string
  model?: string
  status: VideoComposeStepStatus
  steps: Record<VideoComposeStepName, VideoComposeStep>
  createdAt: number
  updatedAt: number
}

/** 创建视频编排任务(web video-compose/page.tsx:257 同址 POST /api/ai-video-compose)。 */
export async function createVideoComposeTask(input: {
  prompt: string
  model?: string
}): Promise<ApiResult<VideoComposeTask>> {
  return fetchApi<VideoComposeTask>('/api/ai-video-compose', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 查询任务最新状态(轮询用,web video-compose/page.tsx:232 同址)。 */
export async function getVideoComposeTask(id: string): Promise<ApiResult<VideoComposeTask>> {
  return fetchApi<VideoComposeTask>(`/api/ai-video-compose/${id}`)
}

/** 重生成失败步骤(web video-compose/page.tsx:276 同址 POST /api/ai-video-compose/:id/regenerate)。 */
export async function regenerateVideoComposeTask(
  id: string,
  step: VideoComposeStepName,
): Promise<ApiResult<VideoComposeTask>> {
  return fetchApi<VideoComposeTask>(`/api/ai-video-compose/${id}/regenerate`, {
    method: 'POST',
    body: JSON.stringify({ step }),
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
