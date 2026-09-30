// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { fetchApi } from '@/lib/api' // AI 助教已统一切到同源 /api 代理(G-978072)

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

// ===== AI 助教(经 apps/api 同源代理 /api/ai-tutor/*,2026-09-30 弃直连 8803,G-978072)=====
// 直连的问题:浏览器必须可达 ai-service 端口,生产不暴露即假死;且问答不落库、
// 学-练-测-评不可回收。代理侧(apps/api/src/routes/ai-tutor-routes.ts)统一信封并落 ai_tutor_logs。

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
/** AI 助教历史问答(ai_tutor_logs 投影) */
export interface TutorHistoryItem {
  id: string
  mode: 'explain' | 'hint' | 'quiz'
  subject?: string | null
  question: string
  answer: unknown
  createdAt: string
}

/** 上下文注入:章节 + 知识点(渲染进 ai-service 学科 persona prompt) */
export interface TutorContext {
  chapter?: string
  knowledge_points?: string[]
  difficulty?: string
}

async function aiPost<T>(path: string, body: unknown): Promise<T> {
  const r = await fetchApi<T>(`/api/ai-tutor${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.success) throw new Error(r.error)
  return r.data
}

/** 概念讲解 */
export async function explainConcept(
  subject: string,
  question: string,
  context?: TutorContext,
): Promise<ExplainResult> {
  return aiPost<ExplainResult>('/explain', { subject, question, context })
}

/** 提示引导 */
export async function getHint(
  subject: string,
  question: string,
  context?: TutorContext,
): Promise<HintResult> {
  return aiPost<HintResult>('/hint', { subject, question, context })
}

/** 生成练习题 */
export async function generateQuiz(
  subject: string,
  context?: TutorContext,
  count = 1,
): Promise<QuizResult> {
  return aiPost<QuizResult>('/quiz', { subject, context, count })
}

/** 当前用户最近问答(倒序) */
export async function getAiTutorHistory(limit = 5): Promise<{ list: TutorHistoryItem[] }> {
  return srsGet<{ list: TutorHistoryItem[] }>(`/api/ai-tutor/history?limit=${limit}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
