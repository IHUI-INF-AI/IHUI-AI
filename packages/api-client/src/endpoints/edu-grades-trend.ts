// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 学生成绩趋势 / 薄弱点端点(补 RN 承载用,2026-10-27 后端契约现读)
 *
 * 前缀 `/api/edu-ai-management`(apps/api/src/routes/index.ts:934),鉴权 requireEduView =
 * requireAnyPermission(['edu:view','edu:manage'])(apps/api/src/routes/edu-ai-management.ts:102-103)
 * ⇒ 未登录 401、登录但无教务权限 403(apps/api/src/plugins/require-permission.ts:118-120)。
 *
 *  - GET /exam-score/trend/:studentId?subject=
 *    → success({ list })(apps/api/src/routes/edu-ai-management.ts:4948-4977,:4976)
 *    :studentId 走 uuidParamSchema(:4951-4953 + :111),**非 UUID 直接 400**;
 *    subject 为可选精确过滤(:4955-4962);排序 examDate asc → subject(:4974-4975);
 *    行字段见 :4964-4971 的 select 投影:id / examName / subject / score / totalScore / examDate。
 *  - GET /exam-score/weakness/:studentId
 *    → success({ studentId, weaknesses })(:4980-5012,:5012)
 *    ⚠ 键名是 `weaknesses`,*不是* web 页读的 `weakness`
 *    (apps/web/app/(main)/edu/edu-management/grades/trend/[studentId]/PageClient.tsx:111-113)
 *    行字段(:5004-5010):subject / avgScore(1 位小数)/ examCount / totalScore / weak;
 *    **后端已只返回 weak=true 的科目**(:5011 `.filter((w) => w.weak)`),
 *    且**不返回 percentage** —— web 雷达图读 w.percentage 恒 undefined,RN 用
 *    avgScore/totalScore 现算得分率(派生自后端真值,不伪造)。
 *  - web 消费方:同目录 PageClient.tsx:96-115。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

const BASE = '/api/edu-ai-management'

/** GET /exam-score/trend/:studentId → data.list 元素 */
export interface ExamTrendItem {
  id: string
  examName: string
  subject: string
  score: number
  totalScore: number
  /** 考试日期(apps/api/src/routes/edu-ai-management.ts:4970) */
  examDate: string
}

/** GET /exam-score/weakness/:studentId → data.weaknesses 元素 */
export interface ExamWeaknessItem {
  subject: string
  /** 该科目均分,已保留 1 位小数(:5007) */
  avgScore: number
  examCount: number
  totalScore: number
  /** 后端布尔键名是 weak(:5009);保留 isWeak 兜底读法以防字段改名 */
  weak: boolean
  isWeak?: boolean
}

export interface ExamWeaknessResult {
  studentId: string
  weaknesses: ExamWeaknessItem[]
}

export async function getExamScoreTrend(
  studentId: string,
  subject?: string,
): Promise<ApiResult<{ list: ExamTrendItem[] }>> {
  return fetchApi<{ list: ExamTrendItem[] }>(
    `${BASE}/exam-score/trend/${encodeURIComponent(studentId)}${buildQs({ subject })}`,
  )
}

export async function getExamScoreWeakness(
  studentId: string,
): Promise<ApiResult<ExamWeaknessResult>> {
  return fetchApi<ExamWeaknessResult>(
    `${BASE}/exam-score/weakness/${encodeURIComponent(studentId)}`,
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
