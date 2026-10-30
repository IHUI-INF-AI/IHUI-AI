// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 定时任务(排课任务)端点(补 RN 承载用,后端契约现读)
 *
 *  - GET /api/schedule/tasks?page&pageSize&enabled&name
 *    → 信封 success({ list, total, page, pageSize, totalPages })
 *      (apps/api/src/routes/schedule.ts:83-113 + apps/api/src/db/schedule-queries.ts:23-55)
 *    鉴权:插件 preHandler checkAuth(apps/api/src/routes/schedule.ts:74-77),
 *    注册前缀 /api = apps/api/src/routes/index.ts:655。
 *    查询参数:page ≥1 默认 1、pageSize 1..100 默认 20、enabled 布尔、name 为任务名模糊匹配
 *    (schedule.ts:92-99 → schedule-queries.ts:38 用 ilike %name%);排序 priority desc, id desc。
 *  - 行 = schedule_tasks 全列,这里只声明展示层消费列(与 web 页 ScheduleTask 同集,
 *    apps/web/app/(main)/schedule/page.tsx:29-41);时间字段为 ISO 字符串,格式化交薄壳。
 *  - 建前已 ls endpoints/:无 schedule.ts 同名件;`edu.ts` / `study.ts` 数据源不同,不复用。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

export interface ScheduleTaskItem {
  id: string
  name: string
  description: string | null
  cronExpression: string
  targetService: string | null
  targetMethod: string | null
  priority: number
  enabled: boolean
  lastRunTime: string | null
  /** 后端原值直出:null / success / failed / timeout / running(web 同口径,page.tsx:165) */
  lastRunStatus: string | null
  createdAt: string
}

export interface ScheduleTaskListResult {
  list: ScheduleTaskItem[]
  total: number
  page: number
  pageSize: number
  /** web 同页用 Math.ceil(total / PAGE_SIZE) 自算,后端也回传,优先采信后端 */
  totalPages?: number
}

export interface ScheduleTaskQuery {
  page?: number
  /** 后端上限 100(schedule.ts:95) */
  pageSize?: number
  enabled?: boolean
  name?: string
}

export async function getScheduleTasks(
  query: ScheduleTaskQuery = {},
): Promise<ApiResult<ScheduleTaskListResult>> {
  return fetchApi<ScheduleTaskListResult>(`/api/schedule/tasks${buildQs(query)}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
