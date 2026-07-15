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
  return fetchApi<ExamResult>(`/exam/records/${encodeURIComponent(input.examId)}/submit`, {
    method: 'POST',
    body: JSON.stringify(input),
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
  return fetchApi<ExamChapter[]>(`/exam/composition/rule/list${buildQs({ eid: examId })}`)
}

export interface ExamSignUp {
  id: string
  examId: string
  userId: string
  status: string
  signedAt: string
}

export async function getSignUp(examId: string): Promise<ApiResult<ExamSignUp | null>> {
  return fetchApi<ExamSignUp | null>(`/exam/composition/signup/${encodeURIComponent(examId)}`)
}

export async function saveSignUp(examId: string): Promise<ApiResult<ExamSignUp>> {
  return fetchApi<ExamSignUp>(`/exam/composition/signup`, {
    method: 'POST',
    body: JSON.stringify({ eid: examId }),
  })
}

export async function cancelSignUp(examId: string): Promise<ApiResult<void>> {
  return fetchApi<void>(`/exam/composition/signup/${encodeURIComponent(examId)}`, {
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
  return fetchApi<boolean>(`/exam/records${buildQs({ examId })}`)
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
