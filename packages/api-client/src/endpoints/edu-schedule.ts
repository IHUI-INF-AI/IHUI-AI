// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 我的课程表端点(补 RN 承载用,2026-10-27 后端契约现读)
 *
 *  - GET /api/edu/schedule
 *    → 信封 success({ list, total })(apps/api/src/routes/edu-frontend-routes.ts:461-543,
 *      最后一行 return reply.send(success({ list: items, total: items.length })) 在 :542)
 *    注册前缀 `/api` = apps/api/src/routes/index.ts:1109
 *    (`server.register(eduFrontendRoutes, { prefix: '/api' })`);
 *    插件级 preHandler 全量强制登录 checkAuth(apps/api/src/routes/edu-frontend-routes.ts:140-142),
 *    未带 token 直接 401 —— web 侧因此用 useAuthGate 拦在请求之前。
 *  - 行形状(apps/api/src/routes/edu-frontend-routes.ts:463-472 声明的 items 元素):
 *    id / title / instructor / weekday / startTime / endTime / location? / type。
 *    weekday 语义是 **0 = 周一**(:493 `(d.getDay() + 6) % 7`),与 JS 原生 0=周日 不同,勿混用;
 *    endTime 可为空串(考试报名项 :495)、instructor 可为空串(:492);
 *    location 仅班级课程项存在(:534),考试项无该字段。
 *  - web 消费方:apps/web/app/(main)/edu/schedule/page.tsx:38(同路径同信封,读 d.list)。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/** GET /api/edu/schedule → data.list 元素 */
export interface EduScheduleItem {
  id: string
  title: string
  /** 考试报名项为空串(apps/api/src/routes/edu-frontend-routes.ts:492) */
  instructor: string
  /** 0 = 周一 … 6 = 周日(apps/api/src/routes/edu-frontend-routes.ts:493) */
  weekday: number
  /** HH:mm(apps/api/src/routes/edu-frontend-routes.ts:494) */
  startTime: string
  /** HH:mm;考试报名项为空串(:495) */
  endTime: string
  location?: string
  /** 'exam' | 'class'(:496 / :535) */
  type: string
}

export interface EduScheduleResult {
  list: EduScheduleItem[]
  total: number
}

export async function getEduSchedule(): Promise<ApiResult<EduScheduleResult>> {
  return fetchApi<EduScheduleResult>('/api/edu/schedule')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
