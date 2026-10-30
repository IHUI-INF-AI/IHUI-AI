// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 教务 · 作业管理端点(补 RN 承载用,2026-10-27 后端契约现读)
 *
 * 全部挂在 `/api/edu-ai-management` 前缀下(apps/api/src/routes/index.ts:934
 * `server.register(eduAiManagementRoutes, { prefix: '/api/edu-ai-management' })`),
 * 鉴权是**权限级**不是登录级:只读走 requireEduView = requireAnyPermission(['edu:view','edu:manage'])
 * (apps/api/src/routes/edu-ai-management.ts:102-103),写走 requireEduManage = requirePermission('edu:manage')(:95-96);
 * 未登录 401(apps/api/src/plugins/require-permission.ts:118-120),已登录但无教务权限 403 ⇒ RN 侧如实透出错误态。
 *
 *  - GET /term
 *    → success({ list, total, page, pageSize, totalPages })
 *    (routes/edu-ai-management.ts:859-870 调 paginate,信封形状由 paginate 决定,:823-849;
 *     排序 isCurrent desc → startDate desc :864-869,故 list[0] 即当前学期优先)
 *  - GET /class?termId=
 *    → success({ list })(:947-958;termId 可选过滤 :952-953;无分页,整表返回 :955)
 *  - GET /homework-submission?classId=&homeworkId=&page=&pageSize=
 *    → success({ list, total, page, pageSize, totalPages })(:3705-3724,paginate :3709-3722;
 *      **query 只认 homeworkId / classId**(schema :546-549),web 传的 `status` 被 zod 丢弃 ⇒
 *      状态过滤只能客户端做,本封装不声明 status 参数以免制造"传了但无效"的假象)
 *  - GET /homework-submission/stats?classId=
 *    → success({ totalCount, gradedCount, avgScore, completionRate })(:3774-3805,:3802)
 *    ⚠ 字段名是 totalCount / avgScore,*不是* web 页读的 totalSubmissions / averageScore
 *    (apps/web/app/(main)/edu/edu-management/homework/PageClient.tsx:273-275)—— web 四张统计卡
 *    线上恒为 '-';RN 按后端真字段取值,不回抄 web 的错位。
 *  - PUT /homework-submission/:id/grade  body { score:int>=0, comment? }
 *    → success({ submission })(:3738-3770;schema gradeHomeworkSubmissionSchema :559-562,
 *      score 为**整数**且必填,comment 可选;成功即把 status 置 'graded' :3761)
 *  - 行形状 = edu_homework_submission 全列(packages/database/src/schema/edu-ai-management.ts:523-548);
 *    **该表没有 studentName 列**(只有 studentId :528-531),web 表头「学生姓名」列线上恒空白 ——
 *    RN 以 studentId 前 8 位兜底显示,不伪造姓名。
 *  - web 消费方:apps/web/app/(main)/edu/edu-management/homework/PageClient.tsx:206-265。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

const BASE = '/api/edu-ai-management'

/** edu_term 行(packages/database/src/schema/edu-ai-management.ts:25-39) */
export interface EduTermItem {
  id: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
}

/** edu_class 行(packages/database/src/schema/edu-ai-management.ts:46-63) */
export interface EduClassItem {
  id: string
  termId: string
  name: string
  grade: string | null
  /** after_school_care / kindergarten / academic / ai_course / other(:56) */
  businessLine: string
}

/** edu_homework_submission 行(展示层实际消费的列) */
export interface HomeworkSubmissionItem {
  id: string
  homeworkId: string
  studentId: string
  classId: string
  content: string | null
  attachment: string | null
  submittedAt: string
  score: number | null
  comment: string | null
  teacherId: string | null
  gradedAt: string | null
  /** submitted / graded / late / resubmit(:539) */
  status: string
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PagedList<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** 统计卡:后端真字段名(见头注 ⚠) */
export interface HomeworkStatsResult {
  totalCount: number
  gradedCount: number
  avgScore: number
  completionRate: number
}

export async function getEduTerms(): Promise<ApiResult<PagedList<EduTermItem>>> {
  return fetchApi<PagedList<EduTermItem>>(`${BASE}/term`)
}

export async function getEduClasses(
  termId?: string,
): Promise<ApiResult<{ list: EduClassItem[] }>> {
  return fetchApi<{ list: EduClassItem[] }>(`${BASE}/class${buildQs({ termId })}`)
}

export interface HomeworkSubmissionQuery {
  classId?: string
  homeworkId?: string
  page?: number
  pageSize?: number
}

export async function getHomeworkSubmissions(
  query: HomeworkSubmissionQuery = {},
): Promise<ApiResult<PagedList<HomeworkSubmissionItem>>> {
  return fetchApi<PagedList<HomeworkSubmissionItem>>(
    `${BASE}/homework-submission${buildQs(query)}`,
  )
}

export async function getHomeworkSubmissionStats(
  classId?: string,
): Promise<ApiResult<HomeworkStatsResult>> {
  return fetchApi<HomeworkStatsResult>(`${BASE}/homework-submission/stats${buildQs({ classId })}`)
}

/** 批改(edu:manage 权限;score 为 0..100 的整数,见 schema :559-562) */
export async function gradeHomeworkSubmission(
  id: string,
  body: { score: number; comment?: string },
): Promise<ApiResult<{ submission: HomeworkSubmissionItem }>> {
  return fetchApi<{ submission: HomeworkSubmissionItem }>(
    `${BASE}/homework-submission/${id}/grade`,
    { method: 'PUT', body: JSON.stringify(body) },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
