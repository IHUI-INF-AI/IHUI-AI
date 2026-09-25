// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client'
import { buildQs, type PageData } from '../utils'

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
