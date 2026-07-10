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

export async function getExams(
  query: ExamListQuery = {},
): Promise<ApiResult<PageData<Exam>>> {
  return fetchApi<PageData<Exam>>(`/exams${buildQs(query)}`)
}

export async function getExamById(
  id: string,
): Promise<ApiResult<{ exam: Exam; questions: ExamQuestion[] }>> {
  return fetchApi<{ exam: Exam; questions: ExamQuestion[] }>(
    `/exams/${encodeURIComponent(id)}`,
  )
}

export async function submitAnswer(input: {
  examId: string
  answers: { questionId: string; answer: string | string[] }[];
}): Promise<ApiResult<ExamResult>> {
  return fetchApi<ExamResult>(
    `/exams/${encodeURIComponent(input.examId)}/submit`,
    { method: 'POST', body: JSON.stringify(input) },
  )
}

export async function getResult(id: string): Promise<ApiResult<ExamResult>> {
  return fetchApi<ExamResult>(`/exams/${encodeURIComponent(id)}/result`)
}

export async function getWrongBook(
  query: { page?: number; pageSize?: number; examId?: string } = {},
): Promise<ApiResult<PageData<WrongQuestion>>> {
  return fetchApi<PageData<WrongQuestion>>(`/exams/wrong-book${buildQs(query)}`)
}
