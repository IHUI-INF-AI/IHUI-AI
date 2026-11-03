// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData } from '../utils.js'

export interface Exam {
  id: string
  title: string
  description: string
  courseId: string | null
  duration: number
  totalScore: number
  passScore: number
  questionCount: number
  attemptCount: number
  maxAttempts: number
  startTime: string | null
  endTime: string | null
  status: string
  createdAt: string
}

export interface ExamQuestion {
  id: string
  examId: string
  type: 'single' | 'multiple' | 'judge' | 'fill' | 'essay'
  title: string
  options: { key: string; value: string }[] | null
  score: number
  analysis: string | null
}

/**
 * 考试作答的跨端判据(web / RN / 小程序三端共用,端内不得再各抄一份)。
 *
 * 仓里同时住着两套题型词表,换算只许在这一处发生:
 *  - 后端五档 `single|multiple|judge|fill|essay` —— `apps/api/src/routes/exam.ts` 的
 *    `toApiQuestionType`(出参再过 `normalizeOptionsForApi` 把选项摊成 `{key,value}[]`);
 *  - 共享屏五档 `single|multi|fill|subjective|judgment` —— `packages/types`
 *    `ExamQuestionItem`,RN 共享屏 `typeLabel` 就按这一套逐 case 分派。
 * 端内旧词表(`single_choice|multi_choice|judgment|fill_blank|subjective`)一并接受,
 * 免得调用方为了「猜后端这次回了哪套」再写第二张表。
 */
export type ShellQuestionType = 'single' | 'multi' | 'fill' | 'subjective' | 'judgment'

const SHELL_QUESTION_TYPE_ALIAS: Record<string, ShellQuestionType> = {
  single: 'single',
  single_choice: 'single',
  multiple: 'multi',
  multi_choice: 'multi',
  multi: 'multi',
  judge: 'judgment',
  judgment: 'judgment',
  fill: 'fill',
  fill_blank: 'fill',
  essay: 'subjective',
  subjective: 'subjective',
}

/** 后端/端内题型 → 共享屏题型。认不出的一律按单选题(与共享屏 `typeLabel` 的 default 同落点)。 */
export function toShellQuestionType(type: string): ShellQuestionType {
  return SHELL_QUESTION_TYPE_ALIAS[type] ?? 'single'
}

/** 选项文案(纯文本)。渲染侧只吃这一份:后端交 `{key,value}[]`,共享屏吃 `string[]`。 */
export function toShellOptionTexts(question: Pick<ExamQuestion, 'options'>): string[] {
  return (question.options ?? []).map((option) => option.value)
}

/** 选项 key(`"A"`/`"B"`…,与 `toShellOptionTexts` 的下标一一对齐)。判分比的是它,不是下标。 */
export function toShellOptionKeys(question: Pick<ExamQuestion, 'options'>): string[] {
  return (question.options ?? []).map((option) => option.key)
}

/**
 * 作答模型:键 = questionId;选项题存 0-based 下标(多选为下标数组),判断题存布尔,
 * 填空/主观题存文本 —— 与 `ExamQuestionScreenProps['answers']` 同形。
 */
export type ExamAnswerValue = number | number[] | string | boolean

/**
 * 把端内作答模型序列化成 `POST /exam/records/:id/submit` 的入参。
 *
 * 为什么必须过这一层:题库 `answer` 列存的是**选项 key**("A" / ["A","B"]),后端
 * `submitExamRecord`(`apps/api/src/db/exam-queries.ts`)对 single_choice/judgment 走
 * `contentEqual(a.answer, q.answer)`、对 multi_choice 排序后逐元素比 ⇒ 直接交下标
 * (0/1/…)恒为 false,客观题会整卷判错。填空题逐空 trim 后比,主观题不自动判分。
 *
 * 未作答的题不进数组(后端据此算 `unansweredCount`)。
 */
export function serializeExamAnswers(
  questions: readonly Pick<ExamQuestion, 'id' | 'type' | 'options'>[],
  answers: Readonly<Record<string, unknown>>,
): { questionId: string; answer: string | string[] | boolean }[] {
  const payload: { questionId: string; answer: string | string[] | boolean }[] = []
  for (const question of questions) {
    const value = answers[question.id]
    if (value === undefined) continue
    const keys = toShellOptionKeys(question)
    if (question.type === 'single') {
      if (typeof value !== 'number') continue
      payload.push({ questionId: question.id, answer: keys[value] ?? String(value) })
    } else if (question.type === 'multiple') {
      if (!Array.isArray(value)) continue
      const picked = value.filter((item): item is number => typeof item === 'number')
      if (picked.length === 0) continue
      payload.push({ questionId: question.id, answer: picked.map((i) => keys[i] ?? String(i)) })
    } else if (question.type === 'judge') {
      if (typeof value !== 'boolean') continue
      payload.push({ questionId: question.id, answer: value })
    } else {
      if (typeof value !== 'string' || value.trim() === '') continue
      payload.push({ questionId: question.id, answer: value })
    }
  }
  return payload
}

export interface ExamResult {
  examId: string
  score: number
  totalScore: number
  isPassed: boolean
  correctCount: number
  wrongCount: number
  unansweredCount: number
  duration: number
  submittedAt: string
  details: ExamResultDetail[]
}

export interface ExamResultDetail {
  questionId: string
  title: string
  userAnswer: string | string[]
  correctAnswer: string | string[]
  isCorrect: boolean
  score: number
  analysis: string | null
}

export interface WrongQuestion {
  id: string
  examId: string
  questionId: string
  title: string
  userAnswer: string | string[]
  correctAnswer: string | string[]
  type: string
  wrongCount: number
  lastWrongAt: string
}

export type ExamListQuery = {
  page?: number
  pageSize?: number
  courseId?: string
  status?: string
}

export async function getExams(query: ExamListQuery = {}): Promise<ApiResult<PageData<Exam>>> {
  return fetchApi<PageData<Exam>>(`/exam/papers${buildQs(query)}`)
}

export async function getExamById(
  id: string,
): Promise<ApiResult<{ exam: Exam; questions: ExamQuestion[] }>> {
  return fetchApi<{ exam: Exam; questions: ExamQuestion[] }>(
    `/exam/papers/${encodeURIComponent(id)}/questions`,
  )
}

export async function submitAnswer(input: {
  examId: string
  answers: { questionId: string; answer: string | string[] }[]
}): Promise<ApiResult<ExamResult>> {
  return fetchApi<ExamResult>(`/exam/papers/${encodeURIComponent(input.examId)}/submit-answers`, {
    method: 'POST',
    body: JSON.stringify({ answers: input.answers }),
  })
}

export async function getResult(id: string): Promise<ApiResult<ExamResult>> {
  return fetchApi<ExamResult>(`/exam/records/${encodeURIComponent(id)}`)
}

export async function getWrongBook(
  query: { page?: number; pageSize?: number; examId?: string } = {},
): Promise<ApiResult<PageData<WrongQuestion>>> {
  return fetchApi<PageData<WrongQuestion>>(`/exam/wrong/list${buildQs(query)}`)
}

export interface ExamChapter {
  id: string
  examId: string
  title: string
  description: string
  questionCount: number
  sort: number
}

export async function getExamChapters(examId: string): Promise<ApiResult<ExamChapter[]>> {
  return fetchApi<ExamChapter[]>(`/exam/papers/${encodeURIComponent(examId)}/chapters`)
}

// ----- 报名域契约:`:sid` 路径参数 ≠ examId(不得混用)-----
//
// 后端 GET / PUT / DELETE `/exam/composition/signup/:sid` 三条路由的 where 条件全部是
// `eq(examSignUp.id, Number(sid))`(apps/api/src/routes/exam.ts:1358 / 1448 / 1465,
// 参数模式 `sidParam` 见 :466),而 `exam_sign_up.id` 是 serial **行主键**
// (packages/database/src/schema/relation-tables.ts:60)。
// 把 examId 塞进这一格,即便权限档位放开,作用到的也是**另一场考试或别人的报名行**
// —— 这是数据正确性缺陷,与"能不能操作"无关。
// 取 signupId 的正规途径:GET /signup/my 与 POST /signup 的扁平返回里 `id` 字段
// (exam.ts:1322-1328 / :1413-1419 两处 map 的都是 `String(s.id)`)。
// POST /exam/composition/signup 是唯一按 examId 走**请求体**的一条(exam.ts:1367-1384),
// 语义不同由后端决定,不是端内随手选的。

/** 扁平返回形状(GET /signup/my 的 list 项、POST /signup 的响应)。 */
export interface ExamSignUp {
  /** 报名行主键(exam_sign_up.id)。**撤报名 / 查详情传这一格**,不要传 examId。 */
  id: string
  /** 考试 id(exam_sign_up.exam_id)→ 只作为 POST /signup 的 body 键。 */
  examId: string
  /** 报名表沿用的历史会员编号(exam_sign_up.member_id),与 users.id(uuid)不同空间。 */
  userId: string
  status: string
  signedAt: string
}

/**
 * GET /exam/composition/signup/:sid 的返回形状 —— 与上面的扁平 `ExamSignUp` **不是同一份**:
 * 详情路由把 drizzle 整行原样交出(`success({ signup: result[0] })`,exam.ts:1361),
 * 所以列名按表原名、integer/serial 是 number、时间戳由 Fastify 序列化成 ISO 串。
 */
export interface ExamSignUpRecord {
  id: number
  memberId: number
  examId: number
  status: string
  completedTime: string | null
  createdAt: string
  updatedAt: string
}

export async function getSignUp(
  signupId: string,
): Promise<ApiResult<{ signup: ExamSignUpRecord }>> {
  return fetchApi<{ signup: ExamSignUpRecord }>(
    `/exam/composition/signup/${encodeURIComponent(signupId)}`,
  )
}

/**
 * POST /exam/composition/signup/:sid/submit —— 会员提交答卷(把本人报名标 completed)。
 *
 * 后端判据(exam.ts:1538-1576,C 方案):`eq(examSignUp.id, sid) AND eq(user_id, request.userId)`
 * —— 归属由 JWT 决定,`sid` 是**报名行主键**(不是 examId);NULL 归属的历史行与他人的行
 * 都不命中 ⇒ 404。调用方拿 `id` 的正规途径与上面相同:`ExamSignUp.id`。
 */
export async function submitSignUp(
  signupId: string,
): Promise<ApiResult<{ signup: ExamSignUpRecord }>> {
  return fetchApi<{ signup: ExamSignUpRecord }>(
    `/exam/composition/signup/${encodeURIComponent(signupId)}/submit`,
    {
      method: 'POST',
    },
  )
}

export async function saveSignUp(examId: string): Promise<ApiResult<ExamSignUp>> {
  return fetchApi<ExamSignUp>(`/exam/composition/signup`, {
    method: 'POST',
    body: JSON.stringify({ eid: examId }),
  })
}

export async function cancelSignUp(signupId: string): Promise<ApiResult<void>> {
  return fetchApi<void>(`/exam/composition/signup/${encodeURIComponent(signupId)}`, {
    method: 'DELETE',
  })
}

export async function getMySignUps(
  query: { page?: number; pageSize?: number } = {},
): Promise<ApiResult<PageData<ExamSignUp>>> {
  return fetchApi<PageData<ExamSignUp>>(`/exam/composition/signup/my${buildQs(query)}`)
}

export async function getMyRecords(
  query: { page?: number; pageSize?: number; examId?: string } = {},
): Promise<ApiResult<PageData<ExamResult>>> {
  return fetchApi<PageData<ExamResult>>(`/exam/records${buildQs(query)}`)
}

export async function checkSubmitted(examId: string): Promise<ApiResult<boolean>> {
  return fetchApi<boolean>(`/exam/records/check-submitted${buildQs({ examId })}`)
}

export async function getFavoriteExams(
  query: { page?: number; pageSize?: number } = {},
): Promise<ApiResult<PageData<Exam>>> {
  return fetchApi<PageData<Exam>>(`/exam/papers${buildQs({ ...query, favorite: '1' })}`)
}

export async function getRecommendExams(
  query: { limit?: number } = {},
): Promise<ApiResult<Exam[]>> {
  return fetchApi<Exam[]>(`/exam/papers${buildQs({ ...query, recommend: '1' })}`)
}

export async function getHotExams(query: { limit?: number } = {}): Promise<ApiResult<Exam[]>> {
  return fetchApi<Exam[]>(`/exam/papers${buildQs({ ...query, hot: '1' })}`)
}

export async function getExamsByIds(ids: string[]): Promise<ApiResult<Exam[]>> {
  return fetchApi<Exam[]>(`/exam/papers/by-ids${buildQs({ ids: ids.join(',') })}`)
}

/**
 * 试卷类型(跨端共享,从 miniapp-taro 下沉)
 *
 * 与 Exam 的区别:ExamPaper 是试卷元信息(管理端用),
 * Exam 是考试入口信息(学员端列表用)。字段差异:ExamPaper 有 paperType/isRandom/isPublished。
 */
export interface ExamPaper {
  id: string
  title: string
  description?: string | null
  categoryId?: string
  paperType?: 'normal' | 'random' | 'mock' | 'exam'
  totalScore?: string
  passScore?: string
  duration?: number
  isPublished?: boolean
  isRandom?: boolean
  status?: number
}

/**
 * 考试记录类型(跨端共享,从 miniapp-taro 下沉)
 *
 * 与 ExamResult 的区别:ExamRecord 是一次考试的记录条目(列表用),
 * ExamResult 是提交后的详细结果(含 details 明细)。
 */
export interface ExamRecord {
  id: string
  paperId: string
  score: string
  isPassed: boolean
  status: string
  startedAt: string
  submittedAt?: string | null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
