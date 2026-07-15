import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

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
  return fetchApi<PageData<Exam>>(`/exams${buildQs(query)}`)
}

export async function getExamById(
  id: string,
): Promise<ApiResult<{ exam: Exam; questions: ExamQuestion[] }>> {
  return fetchApi<{ exam: Exam; questions: ExamQuestion[] }>(`/exams/${encodeURIComponent(id)}`)
}

export async function submitAnswer(input: {
  examId: string
  answers: { questionId: string; answer: string | string[] }[]
}): Promise<ApiResult<ExamResult>> {
  return fetchApi<ExamResult>(`/exams/${encodeURIComponent(input.examId)}/submit`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getResult(id: string): Promise<ApiResult<ExamResult>> {
  return fetchApi<ExamResult>(`/exams/${encodeURIComponent(id)}/result`)
}

export async function getWrongBook(
  query: { page?: number; pageSize?: number; examId?: string } = {},
): Promise<ApiResult<PageData<WrongQuestion>>> {
  return fetchApi<PageData<WrongQuestion>>(`/exams/wrong-book${buildQs(query)}`)
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
  return fetchApi<ExamChapter[]>(`/exams/${encodeURIComponent(examId)}/chapters`)
}

export interface ExamSignUp {
  id: string
  examId: string
  userId: string
  status: string
  signedAt: string
}

export async function getSignUp(examId: string): Promise<ApiResult<ExamSignUp | null>> {
  return fetchApi<ExamSignUp | null>(`/exams/${encodeURIComponent(examId)}/signup`)
}

export async function saveSignUp(examId: string): Promise<ApiResult<ExamSignUp>> {
  return fetchApi<ExamSignUp>(`/exams/${encodeURIComponent(examId)}/signup`, { method: 'POST' })
}

export async function cancelSignUp(examId: string): Promise<ApiResult<void>> {
  return fetchApi<void>(`/exams/${encodeURIComponent(examId)}/signup`, { method: 'DELETE' })
}

export async function getMySignUps(
  query: { page?: number; pageSize?: number } = {},
): Promise<ApiResult<PageData<ExamSignUp>>> {
  return fetchApi<PageData<ExamSignUp>>(`/exams/my/signups${buildQs(query)}`)
}

export async function getMyRecords(
  query: { page?: number; pageSize?: number; examId?: string } = {},
): Promise<ApiResult<PageData<ExamResult>>> {
  return fetchApi<PageData<ExamResult>>(`/exams/my/records${buildQs(query)}`)
}

export async function checkSubmitted(examId: string): Promise<ApiResult<boolean>> {
  return fetchApi<boolean>(`/exams/${encodeURIComponent(examId)}/check-submitted`)
}

export async function getFavoriteExams(
  query: { page?: number; pageSize?: number } = {},
): Promise<ApiResult<PageData<Exam>>> {
  return fetchApi<PageData<Exam>>(`/exams/favorites${buildQs(query)}`)
}

export async function getRecommendExams(
  query: { limit?: number } = {},
): Promise<ApiResult<Exam[]>> {
  return fetchApi<Exam[]>(`/exams/recommend${buildQs(query)}`)
}

export async function getHotExams(query: { limit?: number } = {}): Promise<ApiResult<Exam[]>> {
  return fetchApi<Exam[]>(`/exams/hot${buildQs(query)}`)
}

export async function getExamsByIds(ids: string[]): Promise<ApiResult<Exam[]>> {
  return fetchApi<Exam[]>(`/exams/by-ids${buildQs({ ids: ids.join(',') })}`)
}
