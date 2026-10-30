// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 教务-学习计划管理端点(补 RN 承载用,后端契约现读)
 *
 * 注册:apps/api/src/routes/index.ts:934 `server.register(eduAiManagementRoutes, { prefix: '/api/edu-ai-management' })`。
 * 鉴权:只读 GET 一律 `requireEduView` = requireAnyPermission(['edu:view','edu:manage'])
 * (apps/api/src/routes/edu-ai-management.ts:102-104,89-93),admin(roleId>=1)自动豁免;
 * 普通学生账号命中 403,消费端按错误态渲染,不做无权限的静默空列表。
 *
 *  - GET /api/edu-ai-management/term?page&pageSize
 *    → success({ list, total, page, pageSize, totalPages })(edu-ai-management.ts:859-871,
 *    行 = edu_term 全列,排序 isCurrent desc, startDate desc;page/pageSize 默认 1/20,上限 100:816-819)。
 *  - GET /api/edu-ai-management/class?termId
 *    → success({ list })(edu-ai-management.ts:947-958,裸数组不分页,按 createdAt desc)。
 *  - GET /api/edu-ai-management/study-plan?termId&classId&planType&status&page&pageSize
 *    → success({ list, total, page, pageSize, totalPages })(edu-ai-management.ts:1619-1633,
 *    paginate 实现在同文件 823-844;过滤均走 deletedAt IS NULL)。
 *  - GET /api/edu-ai-management/study-plan/:id/items
 *    → success({ items })(edu-ai-management.ts:1776-1788,排序 sortOrder, createdAt)。
 *  - GET /api/edu-ai-management/study-plan/completion-stats?classId&termId
 *    → success({ classId, termId, overallRate, totalItems, totalCompleted, plans })(edu-ai-management.ts:1864-1925),
 *    plans[i] = { planId, planTitle, planType, status, startDate, endDate, totalItems, completedItems, completionRate }。
 *  - 未承载(如实登记):GET /study-plan/progress-timeline(1932)、POST /study-plan/:id/auto-split(1708)、
 *    PUT /plan-item/:id(1806)、POST/PUT/DELETE term/class/study-plan 写端点 —— RN 首版只读列表 + 详情 + 统计。
 *  - 建前已 ls endpoints/:无同名件;edu-ai.ts 是 AIGC 工具、edu.ts 是报告导出,数据源不同,不复用。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

/** edu_term 行(GET /api/edu-ai-management/term → data.list) */
export interface EduTermItem {
  id: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
  createdAt: string
  updatedAt: string
}

/** edu_class 行(GET /api/edu-ai-management/class → data.list) */
export interface EduClassItem {
  id: string
  termId: string
  name: string
  grade: string | null
  businessLine: string
  createdAt: string
  updatedAt: string
}

export type EduPlanType = 'monthly' | 'weekly'
export type EduPlanStatus = 'draft' | 'active' | 'completed' | 'archived'

/** edu_study_plan 行(GET /api/edu-ai-management/study-plan → data.list) */
export interface EduStudyPlanItem {
  id: string
  title: string
  planType: string
  creatorId: string
  classId: string
  termId: string
  startDate: string
  endDate: string
  description: string | null
  status: string
  parentPlanId: string | null
  createdAt: string
  updatedAt: string
}

/** edu_plan_item 行(GET /api/edu-ai-management/study-plan/:id/items → data.items) */
export interface EduPlanItemRow {
  id: string
  planId: string
  content: string
  objective: string | null
  notes: string | null
  dueDate: string | null
  studentId: string | null
  parentItemId: string | null
  completed: boolean
  completedAt: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface EduPageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  totalPages?: number
}

export interface EduPlanStatsRow {
  planId: string
  planTitle: string
  planType: string
  status: string
  startDate: string
  endDate: string
  totalItems: number
  completedItems: number
  /** 后端已按 Math.round(completed/total*100) 取整,消费端不再二次换算 */
  completionRate: number
}

export interface EduPlanCompletionStats {
  classId: string
  termId: string
  overallRate: number
  totalItems: number
  totalCompleted: number
  plans: EduPlanStatsRow[]
}

export interface EduStudyPlanQuery {
  termId?: string
  classId?: string
  planType?: string
  status?: string
  page?: number
  /** 后端上限 100(edu-ai-management.ts:818) */
  pageSize?: number
}

export async function listEduTerms(
  page = 1,
  pageSize = 100,
): Promise<ApiResult<EduPageResult<EduTermItem>>> {
  return fetchApi<EduPageResult<EduTermItem>>(
    `/api/edu-ai-management/term${buildQs({ page, pageSize })}`,
  )
}

export async function listEduClasses(
  termId?: string,
): Promise<ApiResult<{ list: EduClassItem[] }>> {
  return fetchApi<{ list: EduClassItem[] }>(
    `/api/edu-ai-management/class${buildQs({ termId })}`,
  )
}

export async function listEduStudyPlans(
  query: EduStudyPlanQuery = {},
): Promise<ApiResult<EduPageResult<EduStudyPlanItem>>> {
  return fetchApi<EduPageResult<EduStudyPlanItem>>(
    `/api/edu-ai-management/study-plan${buildQs(query)}`,
  )
}

export async function listEduPlanItems(
  planId: string,
): Promise<ApiResult<{ items: EduPlanItemRow[] }>> {
  return fetchApi<{ items: EduPlanItemRow[] }>(
    `/api/edu-ai-management/study-plan/${encodeURIComponent(planId)}/items`,
  )
}

export async function getEduPlanCompletionStats(
  classId: string,
  termId: string,
): Promise<ApiResult<EduPlanCompletionStats>> {
  return fetchApi<EduPlanCompletionStats>(
    `/api/edu-ai-management/study-plan/completion-stats${buildQs({ classId, termId })}`,
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
