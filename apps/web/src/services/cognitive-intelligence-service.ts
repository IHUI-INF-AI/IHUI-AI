/**
 * 认知智能服务（合并版）
 *
 * 合并自旧架构 services/cognitive-intelligence.ts。
 * 新架构基于 fetchApi 与纯 TypeScript，无 Vue 依赖。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

/* ------------------------------------------------------------------ */
/* 类型定义                                                            */
/* ------------------------------------------------------------------ */

export type CognitiveDomain =
  | 'reasoning'
  | 'memory'
  | 'attention'
  | 'language'
  | 'perception'
  | 'learning'
  | 'decision'
  | 'creativity'

export interface CognitiveProfile {
  id: string
  userId: string
  domains: Record<
    CognitiveDomain,
    {
      score: number
      level: 'low' | 'average' | 'high' | 'exceptional'
      trend: 'up' | 'down' | 'stable'
      lastAssessedAt: string
    }
  >
  overallScore: number
  strengths: CognitiveDomain[]
  weaknesses: CognitiveDomain[]
  createdAt: string
  updatedAt: string
}

export interface CognitiveAssessment {
  id: string
  userId: string
  domain: CognitiveDomain
  taskType: string
  score: number
  maxScore: number
  durationMs: number
  difficulty: 1 | 2 | 3 | 4 | 5
  completedAt: string
  metadata?: Record<string, unknown>
}

export interface CognitiveTask {
  id: string
  domain: CognitiveDomain
  taskType: string
  difficulty: 1 | 2 | 3 | 4 | 5
  prompt: string
  options?: string[]
  correctAnswer?: string
  expectedDurationMs: number
  tags: string[]
}

export interface CognitiveTraining {
  id: string
  userId: string
  domain: CognitiveDomain
  plan: Array<{ taskId: string; scheduledAt: string; completed: boolean }>
  progress: number
  startedAt: string
  expectedEndAt: string
  completedAt: string | null
}

export interface AssessmentInput {
  domain: CognitiveDomain
  taskType: string
  score: number
  maxScore: number
  durationMs: number
  difficulty: 1 | 2 | 3 | 4 | 5
  metadata?: Record<string, unknown>
}

/* ------------------------------------------------------------------ */
/* 评测                                                                */
/* ------------------------------------------------------------------ */

export async function submitAssessment(
  input: AssessmentInput,
): Promise<ApiResult<CognitiveAssessment>> {
  return fetchApi<CognitiveAssessment>('/cognitive/assessments', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getAssessments(
  query: {
    page?: number
    pageSize?: number
    domain?: CognitiveDomain
    startDate?: string
    endDate?: string
  } = {},
): Promise<ApiResult<PageData<CognitiveAssessment>>> {
  return fetchApi<PageData<CognitiveAssessment>>(`/cognitive/assessments${buildQs(query)}`)
}

/* ------------------------------------------------------------------ */
/* 用户画像                                                            */
/* ------------------------------------------------------------------ */

export async function getMyProfile(): Promise<ApiResult<CognitiveProfile>> {
  return fetchApi<CognitiveProfile>('/cognitive/profile')
}

export async function getUserProfile(userId: string): Promise<ApiResult<CognitiveProfile>> {
  return fetchApi<CognitiveProfile>(`/cognitive/profile/${encodeURIComponent(userId)}`)
}

export async function refreshProfile(): Promise<ApiResult<CognitiveProfile>> {
  return fetchApi<CognitiveProfile>('/cognitive/profile/refresh', {
    method: 'POST',
  })
}

/* ------------------------------------------------------------------ */
/* 任务库                                                              */
/* ------------------------------------------------------------------ */

export async function listTasks(
  query: {
    page?: number
    pageSize?: number
    domain?: CognitiveDomain
    difficulty?: number
    keyword?: string
  } = {},
): Promise<ApiResult<PageData<CognitiveTask>>> {
  return fetchApi<PageData<CognitiveTask>>(`/cognitive/tasks${buildQs(query)}`)
}

export async function getTask(id: string): Promise<ApiResult<CognitiveTask>> {
  return fetchApi<CognitiveTask>(`/cognitive/tasks/${encodeURIComponent(id)}`)
}

export async function recommendTasks(limit = 5): Promise<ApiResult<CognitiveTask[]>> {
  return fetchApi<CognitiveTask[]>(`/cognitive/tasks/recommend${buildQs({ limit })}`)
}

/* ------------------------------------------------------------------ */
/* 训练计划                                                            */
/* ------------------------------------------------------------------ */

export async function startTraining(
  domain: CognitiveDomain,
  durationDays: number,
): Promise<ApiResult<CognitiveTraining>> {
  return fetchApi<CognitiveTraining>('/cognitive/training', {
    method: 'POST',
    body: JSON.stringify({ domain, durationDays }),
  })
}

export async function getTraining(id: string): Promise<ApiResult<CognitiveTraining>> {
  return fetchApi<CognitiveTraining>(`/cognitive/training/${encodeURIComponent(id)}`)
}

export async function completeTrainingTask(
  trainingId: string,
  taskId: string,
  assessment: AssessmentInput,
): Promise<ApiResult<CognitiveTraining>> {
  return fetchApi<CognitiveTraining>(
    `/cognitive/training/${encodeURIComponent(trainingId)}/tasks/${encodeURIComponent(taskId)}/complete`,
    { method: 'POST', body: JSON.stringify(assessment) },
  )
}

export async function listMyTrainings(): Promise<ApiResult<CognitiveTraining[]>> {
  return fetchApi<CognitiveTraining[]>('/cognitive/training/mine')
}

/* ------------------------------------------------------------------ */
/* 本地辅助：等级计算 / 推荐算法                                       */
/* ------------------------------------------------------------------ */

export function scoreToLevel(score: number): CognitiveProfile['domains'][CognitiveDomain]['level'] {
  if (score >= 90) return 'exceptional'
  if (score >= 75) return 'high'
  if (score >= 50) return 'average'
  return 'low'
}

export function computeOverallScore(domains: CognitiveProfile['domains']): number {
  const values = Object.values(domains).map((d) => d.score)
  if (values.length === 0) return 0
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length)
}

export function recommendDomains(profile: CognitiveProfile): CognitiveDomain[] {
  const entries = Object.entries(profile.domains)
  return entries
    .filter(([, v]) => v.level === 'low' || v.level === 'average')
    .sort((a, b) => a[1].score - b[1].score)
    .map(([k]) => k as CognitiveDomain)
    .slice(0, 3)
}
