// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 教育管理端点(2026-11-05 立,门 300 存量裁决 A 类)。
 *
 * 后端真源 `apps/api/src/routes/edu-ai-management.ts`(前缀 `/api/edu-ai-management`)。
 * 按域分组:attendance / class / student / enrollment / finance / exam / homework /
 * meal / schedule / study-plan / parent。
 *
 * 不解包、不 try/catch:401/续期/超时由共享 fetchApi 统一处理。
 */
import type { ApiResult } from '@ihui/types'
import { fetchApi, fetchRaw } from '../client.js'

type QueryValue = string | number | undefined

function withQuery(path: string, params?: Record<string, QueryValue>): string {
  if (!params) return path
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v))
  }
  const qs = sp.toString()
  return qs ? `${path}?${qs}` : path
}

function segment(value: string): string {
  return encodeURIComponent(value)
}

/* ────────────────────────────── attendance ────────────────────────────── */

/** 考勤清单 — GET /api/edu-ai-management/attendance */
export async function eduAttendanceList<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/attendance', params))
}

/** 考勤统计/趋势 — GET /api/edu-ai-management/attendance/stats */
export async function eduAttendanceStats<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/attendance/stats', params))
}

/** 本人考勤 — GET /api/edu-ai-management/attendance/me */
export async function eduMyAttendance<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/attendance/me', params))
}

/** 本人签到 — POST /api/edu-ai-management/attendance/self-check-in */
export async function eduAttendanceSelfCheckIn<T = unknown>(
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/attendance/self-check-in', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 整班点名 — POST /api/edu-ai-management/attendance/batch-check-in */
export async function eduAttendanceBatchCheckIn<T = unknown>(
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/attendance/batch-check-in', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 签到 — POST /api/edu-ai-management/attendance/check-in */
export async function eduAttendanceCheckIn<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/attendance/check-in', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 签退 — PUT /api/edu-ai-management/attendance/check-out */
export async function eduAttendanceCheckOut<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/attendance/check-out', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/** 扫码取码 — GET /api/edu-ai-management/attendance/qrcode */
export async function eduAttendanceQrcode<T = unknown>(
  params: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/attendance/qrcode', params))
}

/** 扫码签到 — POST /api/edu-ai-management/attendance/qrcode-check-in */
export async function eduAttendanceQrcodeCheckIn<T = unknown>(
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/attendance/qrcode-check-in', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 考勤规则 — GET /api/edu-ai-management/attendance/rule */
export async function eduAttendanceRule<T = unknown>(
  params: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/attendance/rule', params))
}

/** 保存考勤规则 — PUT /api/edu-ai-management/attendance/rule */
export async function eduAttendanceRuleSave<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/attendance/rule', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/** 轮换扫码密钥 — POST /api/edu-ai-management/attendance/rule/rotate-qr-secret */
export async function eduAttendanceRuleRotateQrSecret<T = unknown>(
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/attendance/rule/rotate-qr-secret', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 删除考勤记录 — DELETE /api/edu-ai-management/attendance/:id */
export async function eduAttendanceDelete<T = unknown>(id: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/attendance/${segment(id)}`, { method: 'DELETE' })
}

/** 考勤导出(CSV Blob) — GET /api/edu-ai-management/attendance/export */
export async function eduAttendanceExport(
  params: Record<string, QueryValue>,
): Promise<Blob> {
  return fetchRaw(withQuery('/api/edu-ai-management/attendance/export', params))
}

/** 请假清单 — GET /api/edu-ai-management/leave */
export async function eduLeaveList<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/leave', params))
}

/** 新建请假 — POST /api/edu-ai-management/leave */
export async function eduLeaveCreate<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/leave', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 审批请假 — PUT /api/edu-ai-management/leave/:id/approve */
export async function eduLeaveApprove<T = unknown>(
  id: string,
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/leave/${segment(id)}/approve`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/** 删除请假 — DELETE /api/edu-ai-management/leave/:id */
export async function eduLeaveDelete<T = unknown>(id: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/leave/${segment(id)}`, { method: 'DELETE' })
}

/* ───────────────────────────── class / term ───────────────────────────── */

/** 班级清单 — GET /api/edu-ai-management/class */
export async function eduClassList<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/class', params))
}

/** 新建班级 — POST /api/edu-ai-management/class */
export async function eduClassCreate<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/class', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 学期清单 — GET /api/edu-ai-management/term */
export async function eduTermList<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/term', params))
}

/** 新建学期 — POST /api/edu-ai-management/term */
export async function eduTermCreate<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/term', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 更新学期 — PUT /api/edu-ai-management/term/:id */
export async function eduTermUpdate<T = unknown>(
  id: string,
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/term/${segment(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/** 学生名册 — GET /api/edu-ai-management/student-roster */
export async function eduStudentRoster<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/student-roster', params))
}

/* ────────────────────── enrollment / lead / trial ────────────────────── */

/** 报名清单 — GET /api/edu-ai-management/enrollment */
export async function eduEnrollmentList<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/enrollment', params))
}

/** 新建报名 — POST /api/edu-ai-management/enrollment */
export async function eduEnrollmentCreate<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/enrollment', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 线索清单 — GET /api/edu-ai-management/lead */
export async function eduLeadList<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/lead', params))
}

/** 新建线索 — POST /api/edu-ai-management/lead */
export async function eduLeadCreate<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/lead', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 更新线索 — PUT /api/edu-ai-management/lead/:id */
export async function eduLeadUpdate<T = unknown>(
  id: string,
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/lead/${segment(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/** 试听预约清单 — GET /api/edu-ai-management/trial-reservation */
export async function eduTrialReservationList<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/trial-reservation', params))
}

/** 新建试听预约 — POST /api/edu-ai-management/trial-reservation */
export async function eduTrialReservationCreate<T = unknown>(
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/trial-reservation', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 更新试听预约 — PUT /api/edu-ai-management/trial-reservation/:id */
export async function eduTrialReservationUpdate<T = unknown>(
  id: string,
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/trial-reservation/${segment(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/* ─────────────────────────────── finance ─────────────────────────────── */

/** 收费计划 — GET /api/edu-ai-management/fee-schedule */
export async function eduFeeSchedule<T = unknown>(
  params: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/fee-schedule', params))
}

/** 生成收费计划 — POST /api/edu-ai-management/fee-schedule/generate */
export async function eduFeeScheduleGenerate<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/fee-schedule/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 收费标准清单 — GET /api/edu-ai-management/tuition-standard */
export async function eduTuitionStandardList<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/tuition-standard', params))
}

/** 新建收费标准 — POST /api/edu-ai-management/tuition-standard */
export async function eduTuitionStandardCreate<T = unknown>(
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/tuition-standard', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 更新收费标准 — PUT /api/edu-ai-management/tuition-standard/:id */
export async function eduTuitionStandardUpdate<T = unknown>(
  id: string,
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/tuition-standard/${segment(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/** 删除收费标准 — DELETE /api/edu-ai-management/tuition-standard/:id */
export async function eduTuitionStandardDelete<T = unknown>(id: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/tuition-standard/${segment(id)}`, {
    method: 'DELETE',
  })
}

/** 缴费记录清单 — GET /api/edu-ai-management/payment-record */
export async function eduPaymentRecordList<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/payment-record', params))
}

/** 新建缴费记录 — POST /api/edu-ai-management/payment-record */
export async function eduPaymentRecordCreate<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/payment-record', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 删除缴费记录 — DELETE /api/edu-ai-management/payment-record/:id */
export async function eduPaymentRecordDelete<T = unknown>(id: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/payment-record/${segment(id)}`, { method: 'DELETE' })
}

/** 缴费汇总 — GET /api/edu-ai-management/payment-record/summary */
export async function eduPaymentRecordSummary<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/payment-record/summary', params))
}

/** 无归属流水 — GET /api/edu-ai-management/payment-record/unattributed */
export async function eduPaymentRecordUnattributed<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/payment-record/unattributed', params))
}

/** 退款清单 — GET /api/edu-ai-management/refund */
export async function eduRefundList<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/refund', params))
}

/** 新建退款 — POST /api/edu-ai-management/refund */
export async function eduRefundCreate<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/refund', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 审批退款 — PUT /api/edu-ai-management/refund/:id/approve */
export async function eduRefundApprove<T = unknown>(
  id: string,
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/refund/${segment(id)}/approve`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/** 催缴记录 — GET /api/edu-ai-management/fee-reminder */
export async function eduFeeReminderList<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/fee-reminder', params))
}

/** 催缴统计 — GET /api/edu-ai-management/fee-reminder/stats */
export async function eduFeeReminderStats<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/fee-reminder/stats', params))
}

/** 批量催缴 — POST /api/edu-ai-management/fee-reminder/batch */
export async function eduFeeReminderBatch<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/fee-reminder/batch', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/* ──────────────────────────────── exam ──────────────────────────────── */

/** 成绩清单 — GET /api/edu-ai-management/exam-score */
export async function eduExamScoreList<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/exam-score', params))
}

/** 录入成绩 — POST /api/edu-ai-management/exam-score */
export async function eduExamScoreCreate<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/exam-score', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 删除成绩 — DELETE /api/edu-ai-management/exam-score/:id */
export async function eduExamScoreDelete<T = unknown>(id: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/exam-score/${segment(id)}`, { method: 'DELETE' })
}

/** 成绩快照 — POST /api/edu-ai-management/exam-score/snapshot */
export async function eduExamScoreSnapshot<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/exam-score/snapshot', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 成绩统计 — GET /api/edu-ai-management/exam-score/stats */
export async function eduExamScoreStats<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/exam-score/stats', params))
}

/** 成绩排名 — GET /api/edu-ai-management/exam-score/ranking */
export async function eduExamScoreRanking<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/exam-score/ranking', params))
}

/** 个人成绩趋势 — GET /api/edu-ai-management/exam-score/trend/:id */
export async function eduExamScoreTrend<T = unknown>(
  studentId: string,
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(
    withQuery(`/api/edu-ai-management/exam-score/trend/${segment(studentId)}`, params),
  )
}

/** 个人薄弱项 — GET /api/edu-ai-management/exam-score/weakness/:id */
export async function eduExamScoreWeakness<T = unknown>(
  studentId: string,
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(
    withQuery(`/api/edu-ai-management/exam-score/weakness/${segment(studentId)}`, params),
  )
}

/* ────────────────────────────── homework ────────────────────────────── */

/** 作业提交清单 — GET /api/edu-ai-management/homework-submission */
export async function eduHomeworkSubmissionList<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/homework-submission', params))
}

/** 作业提交统计 — GET /api/edu-ai-management/homework-submission/stats */
export async function eduHomeworkSubmissionStats<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/homework-submission/stats', params))
}

/** 批改作业 — PUT /api/edu-ai-management/homework-submission/:id/grade */
export async function eduHomeworkSubmissionGrade<T = unknown>(
  id: string,
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/homework-submission/${segment(id)}/grade`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/* ──────────────────────────────── meal ──────────────────────────────── */

/** 食谱清单 — GET /api/edu-ai-management/meal */
export async function eduMealList<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/meal', params))
}

/** 新建食谱 — POST /api/edu-ai-management/meal */
export async function eduMealCreate<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/meal', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 更新食谱 — PUT /api/edu-ai-management/meal/:id */
export async function eduMealUpdate<T = unknown>(
  id: string,
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/meal/${segment(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/** 删除食谱 — DELETE /api/edu-ai-management/meal/:id */
export async function eduMealDelete<T = unknown>(id: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/meal/${segment(id)}`, { method: 'DELETE' })
}

/** 食谱模板清单 — GET /api/edu-ai-management/meal/template */
export async function eduMealTemplateList<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/meal/template', params))
}

/** 食谱模板名 — GET /api/edu-ai-management/meal/template-names */
export async function eduMealTemplateNames<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/meal/template-names', params))
}

/** 新建模板条目 — POST /api/edu-ai-management/meal/template */
export async function eduMealTemplateCreate<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/meal/template', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 删除模板条目 — DELETE /api/edu-ai-management/meal/template/:id */
export async function eduMealTemplateDelete<T = unknown>(id: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/meal/template/${segment(id)}`, {
    method: 'DELETE',
  })
}

/** 套用模板 — POST /api/edu-ai-management/meal/apply-template */
export async function eduMealApplyTemplate<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/meal/apply-template', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 营养汇总 — GET /api/edu-ai-management/meal/nutrition-summary */
export async function eduMealNutritionSummary<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/meal/nutrition-summary', params))
}

/** 生成采购清单 — POST /api/edu-ai-management/meal/generate-shopping-list */
export async function eduMealGenerateShoppingList<T = unknown>(
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/meal/generate-shopping-list', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/* ─────────────────────────────── schedule ─────────────────────────────── */

/** 课表清单 — GET /api/edu-ai-management/schedule */
export async function eduScheduleList<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/schedule', params))
}

/** 新建课表 — POST /api/edu-ai-management/schedule */
export async function eduScheduleCreate<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/schedule', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 更新课表 — PUT /api/edu-ai-management/schedule/:id */
export async function eduScheduleUpdate<T = unknown>(
  id: string,
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/schedule/${segment(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/** 删除课表 — DELETE /api/edu-ai-management/schedule/:id */
export async function eduScheduleDelete<T = unknown>(id: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/schedule/${segment(id)}`, { method: 'DELETE' })
}

/** 复制上周课表 — POST /api/edu-ai-management/schedule/copy-last-week */
export async function eduScheduleCopyLastWeek<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/schedule/copy-last-week', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 导出课表 — GET /api/edu-ai-management/schedule/export */
export async function eduScheduleExport<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/schedule/export', params))
}

/** 排班规则清单 — GET /api/edu-ai-management/scheduling-rule */
export async function eduSchedulingRuleList<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/scheduling-rule', params))
}

/** 新建排班规则 — POST /api/edu-ai-management/scheduling-rule */
export async function eduSchedulingRuleCreate<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/scheduling-rule', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 更新排班规则 — PUT /api/edu-ai-management/scheduling-rule/:id */
export async function eduSchedulingRuleUpdate<T = unknown>(
  id: string,
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/scheduling-rule/${segment(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/** 删除排班规则 — DELETE /api/edu-ai-management/scheduling-rule/:id */
export async function eduSchedulingRuleDelete<T = unknown>(id: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/scheduling-rule/${segment(id)}`, {
    method: 'DELETE',
  })
}

/** 教师清单 — GET /api/edu-ai-management/teachers */
export async function eduTeacherList<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/teachers', params))
}

/** 教师时段清单 — GET /api/edu-ai-management/teacher-schedule */
export async function eduTeacherScheduleList<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/teacher-schedule', params))
}

/** 新建教师时段 — POST /api/edu-ai-management/teacher-schedule */
export async function eduTeacherScheduleCreate<T = unknown>(
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/teacher-schedule', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 更新教师时段 — PUT /api/edu-ai-management/teacher-schedule/:id */
export async function eduTeacherScheduleUpdate<T = unknown>(
  id: string,
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/teacher-schedule/${segment(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/** 删除教师时段 — DELETE /api/edu-ai-management/teacher-schedule/:id */
export async function eduTeacherScheduleDelete<T = unknown>(id: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/teacher-schedule/${segment(id)}`, {
    method: 'DELETE',
  })
}

/** 调课清单 — GET /api/edu-ai-management/schedule-change */
export async function eduScheduleChangeList<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/schedule-change', params))
}

/** 调课审批 — PUT /api/edu-ai-management/schedule-change/:id/:action */
export async function eduScheduleChangeAction<T = unknown>(
  id: string,
  action: string,
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/schedule-change/${segment(id)}/${action}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/** 自动排课 — POST /api/edu-ai-management/scheduling/auto-generate */
export async function eduSchedulingAutoGenerate<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/scheduling/auto-generate', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 冲突检查 — POST /api/edu-ai-management/scheduling/check-conflicts */
export async function eduSchedulingCheckConflicts<T = unknown>(
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/scheduling/check-conflicts', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/* ────────────────────────────── study-plan ────────────────────────────── */

/** 学习计划清单 — GET /api/edu-ai-management/study-plan */
export async function eduStudyPlanList<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/study-plan', params))
}

/** 新建学习计划 — POST /api/edu-ai-management/study-plan */
export async function eduStudyPlanCreate<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/study-plan', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 更新学习计划 — PUT /api/edu-ai-management/study-plan/:id */
export async function eduStudyPlanUpdate<T = unknown>(
  id: string,
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/study-plan/${segment(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/** 删除学习计划 — DELETE /api/edu-ai-management/study-plan/:id */
export async function eduStudyPlanDelete<T = unknown>(id: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/study-plan/${segment(id)}`, {
    method: 'DELETE',
  })
}

/** 计划条目清单 — GET /api/edu-ai-management/study-plan/:id/items */
export async function eduStudyPlanItems<T = unknown>(id: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/study-plan/${segment(id)}/items`)
}

/** 新建计划条目 — POST /api/edu-ai-management/study-plan/:id/items */
export async function eduStudyPlanItemCreate<T = unknown>(
  id: string,
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/study-plan/${segment(id)}/items`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 自动拆解计划 — POST /api/edu-ai-management/study-plan/:id/auto-split */
export async function eduStudyPlanAutoSplit<T = unknown>(id: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/study-plan/${segment(id)}/auto-split`, {
    method: 'POST',
  })
}

/** 更新计划条目 — PUT /api/edu-ai-management/plan-item/:id */
export async function eduPlanItemUpdate<T = unknown>(
  id: string,
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/plan-item/${segment(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/** 删除计划条目 — DELETE /api/edu-ai-management/plan-item/:id */
export async function eduPlanItemDelete<T = unknown>(id: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/plan-item/${segment(id)}`, { method: 'DELETE' })
}

/** 完成度统计 — GET /api/edu-ai-management/study-plan/completion-stats */
export async function eduStudyPlanCompletionStats<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/study-plan/completion-stats', params))
}

/** 进度时间线 — GET /api/edu-ai-management/study-plan/progress-timeline */
export async function eduStudyPlanProgressTimeline<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/study-plan/progress-timeline', params))
}

/* ──────────────────────────────── parent ──────────────────────────────── */

/** 家长孩子清单 — GET /api/edu-ai-management/parent/children */
export async function eduParentChildren<T = unknown>(
  params?: Record<string, QueryValue>,
): Promise<ApiResult<T>> {
  return fetchApi<T>(withQuery('/api/edu-ai-management/parent/children', params))
}

/** 孩子课表 — GET /api/edu-ai-management/parent/child/:childId/schedule */
export async function eduParentChildSchedule<T = unknown>(childId: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/parent/child/${segment(childId)}/schedule`)
}

/** 孩子成绩 — GET /api/edu-ai-management/parent/child/:childId/grades */
export async function eduParentChildGrades<T = unknown>(childId: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/parent/child/${segment(childId)}/grades`)
}

/** 孩子考勤 — GET /api/edu-ai-management/parent/child/:childId/attendance */
export async function eduParentChildAttendance<T = unknown>(
  childId: string,
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/parent/child/${segment(childId)}/attendance`)
}

/** 孩子课程 — GET /api/edu-ai-management/parent/children/:childId/courses */
export async function eduParentChildCourses<T = unknown>(childId: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/parent/children/${segment(childId)}/courses`)
}

/** 孩子餐食 — GET /api/edu-ai-management/parent/children/:childId/meals */
export async function eduParentChildMeals<T = unknown>(childId: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/parent/children/${segment(childId)}/meals`)
}

/** 孩子账单 — GET /api/edu-ai-management/parent/children/:childId/bills */
export async function eduParentChildBills<T = unknown>(childId: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/parent/children/${segment(childId)}/bills`)
}

/** 孩子学习计划 — GET /api/edu-ai-management/parent/children/:childId/study-plans */
export async function eduParentChildStudyPlans<T = unknown>(
  childId: string,
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/parent/children/${segment(childId)}/study-plans`)
}

/** 孩子考勤(children 路径) — GET /api/edu-ai-management/parent/children/:childId/attendance */
export async function eduParentChildrenAttendance<T = unknown>(
  childId: string,
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/parent/children/${segment(childId)}/attendance`)
}

/** 孩子成绩(children 路径) — GET /api/edu-ai-management/parent/children/:childId/grades */
export async function eduParentChildrenGrades<T = unknown>(
  childId: string,
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/parent/children/${segment(childId)}/grades`)
}

/** 家长绑定清单 — GET /api/edu-ai-management/parent/binding */
export async function eduParentBindingList<T = unknown>(): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/parent/binding')
}

/** 家长绑定清单(扁平路径) — GET /api/edu-ai-management/parent-binding */
export async function eduParentBindingRecords<T = unknown>(): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/parent-binding')
}

/** 新建家长绑定 — POST /api/edu-ai-management/parent-binding */
export async function eduParentBindingCreate<T = unknown>(body: unknown): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu-ai-management/parent-binding', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 更新家长绑定 — PUT /api/edu-ai-management/parent/binding/:id */
export async function eduParentBindingUpdate<T = unknown>(
  id: string,
  body: unknown,
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/parent/binding/${segment(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/** 确认家长绑定 — PUT /api/edu-ai-management/parent-binding/:id/confirm */
export async function eduParentBindingConfirm<T = unknown>(id: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/parent-binding/${segment(id)}/confirm`, {
    method: 'PUT',
  })
}

/** 拒绝家长绑定 — PUT /api/edu-ai-management/parent-binding/:id/reject */
export async function eduParentBindingReject<T = unknown>(id: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/parent-binding/${segment(id)}/reject`, {
    method: 'PUT',
  })
}

/** 删除家长绑定(扁平路径) — DELETE /api/edu-ai-management/parent-binding/:id */
export async function eduParentBindingDelete<T = unknown>(id: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/edu-ai-management/parent-binding/${segment(id)}`, { method: 'DELETE' })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
