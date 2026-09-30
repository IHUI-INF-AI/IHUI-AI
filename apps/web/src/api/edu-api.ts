// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { fetchApi, fetchAiServiceJson } from '@/lib/api'

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
export async function submitReview(questionId: string, quality: number): Promise<ReviewResult> {
  return srsPost<ReviewResult>('/api/srs-review/review', { questionId, quality })
}

/** 复习统计 */
export async function getReviewStats(): Promise<ReviewStats> {
  return srsGet<ReviewStats>('/api/srs-review/stats')
}

// ===== AI 助教(直连 ai-service 8803 端口)=====

const AI_SERVICE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL ?? 'http://localhost:8803'

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
  question_text: string
  options?: string[]
  answer?: string
  explanation?: string
  knowledge_points?: string[]
  difficulty?: string
}
export interface QuizResult {
  quizzes: QuizItem[]
}

async function aiPost<T>(path: string, body: unknown): Promise<T> {
  // 2026-08-31 修复:ai-service 全局 JWT 中间件强制鉴权,不带 token 直连 8803 → 401。
  // 2026-09-09 0-5 迁移:统一走 fetchAiServiceJson(共享层 tokenProvider 注入 Bearer,
  // 附带 X-Requested-With CSRF / 设备指纹 / 30s 超时),AI_SERVICE_URL 为绝对 URL 直通。
  const res = await fetchAiServiceJson<unknown>(`${AI_SERVICE_URL}${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!res.success) throw new Error(res.error ?? `AI 助教请求失败`)
  // 兼容两种响应:标准 {code,data} 包装取 data,非标准直接整体返回(与旧 json?.data ?? json 语义一致)
  const json = res.data
  return (isRecord(json) ? (json.data ?? json) : json) as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** 概念讲解 */
export async function explainConcept(
  subject: string,
  question: string,
  context?: unknown,
): Promise<ExplainResult> {
  return aiPost<ExplainResult>('/api/ai-tutor/explain', { subject, question, context }) // method: POST
}

/** 提示引导 */
export async function getHint(
  subject: string,
  question: string,
  context?: unknown,
): Promise<HintResult> {
  return aiPost<HintResult>('/api/ai-tutor/hint', { subject, question, context }) // method: POST
}

/** 生成练习题 */
export async function generateQuiz(
  subject: string,
  context?: unknown,
  count = 1,
): Promise<QuizResult> {
  return aiPost<QuizResult>('/api/ai-tutor/quiz', { subject, context, count }) // method: POST
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
