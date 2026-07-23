import { fetchApi } from '@/lib/api'

/** SRS 复习题目 */
export interface ReviewQuestion {
  id: string
  question: string
  answer: string
  explanation?: string
  subject?: string
  easeFactor?: number
  interval?: number
  repetitions?: number
  nextReview?: string
}

/** SRS 复习统计 */
export interface ReviewStats {
  totalDue: number
  totalReviewed: number
  streak: number
  avgEaseFactor: number
}

/** 提交复习后返回的 SM-2 调度结果 */
export interface ReviewResult {
  nextReview: string
  interval: number
  easeFactor: number
  repetitions: number
}

async function srsGet<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

async function srsPost<T>(url: string, body: unknown): Promise<T> {
  const r = await fetchApi<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.success) throw new Error(r.error)
  return r.data
}

/** 今日待复习列表 */
export async function getDueReviews(
  page = 1,
  pageSize = 20,
): Promise<{ list: ReviewQuestion[]; total: number }> {
  return srsGet(`/api/srs-review/due?page=${page}&pageSize=${pageSize}`)
}

/** 提交复习结果(quality: 0-5 SM-2 评分) */
export async function submitReview(
  questionId: string,
  quality: number,
): Promise<ReviewResult> {
  return srsPost<ReviewResult>('/api/srs-review/review', { questionId, quality })
}

/** 复习统计 */
export async function getReviewStats(): Promise<ReviewStats> {
  return srsGet<ReviewStats>('/api/srs-review/stats')
}

// ===== AI 助教(直连 ai-service 8000 端口)=====

const AI_SERVICE_URL =
  process.env.NEXT_PUBLIC_AI_SERVICE_URL ?? 'http://localhost:8000'

export interface ExplainResult {
  answer: string
  knowledge_points?: string[]
  follow_up_questions?: string[]
}
export interface HintResult {
  hint: string
  next_step_hint?: string
  encouragement?: string
}
export interface QuizItem {
  question: string
  answer?: string
  explanation?: string
}
export interface QuizResult {
  quizzes: QuizItem[]
}

async function aiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${AI_SERVICE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`AI 助教请求失败:${res.status}`)
  const json = await res.json()
  return (json?.data ?? json) as T
}

/** 概念讲解 */
export async function explainConcept(
  subject: string,
  question: string,
  context?: unknown,
): Promise<ExplainResult> {
  return aiPost<ExplainResult>('/api/ai-tutor/explain', { subject, question, context })
}

/** 提示引导 */
export async function getHint(
  subject: string,
  question: string,
  context?: unknown,
): Promise<HintResult> {
  return aiPost<HintResult>('/api/ai-tutor/hint', { subject, question, context })
}

/** 生成练习题 */
export async function generateQuiz(
  subject: string,
  context?: unknown,
  count = 1,
): Promise<QuizResult> {
  return aiPost<QuizResult>('/api/ai-tutor/quiz', { subject, context, count })
}
