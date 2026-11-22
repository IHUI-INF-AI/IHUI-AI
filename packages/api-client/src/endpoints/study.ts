// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Study 学习记录跨端共享类型
 *
 * 从 apps/miniapp-taro/src/api/index.ts 下沉,供 web/miniapp-taro/mobile-rn 等端复用。
 * 后端 GET /study/records 返回的学习记录列表项。
 */

export interface StudyRecord {
  id: string
  courseId: string
  courseTitle: string
  progress: number
  duration: number
  time: string
}

export type StudyRecordList = StudyRecord[]

// ── B 桶上提(2026-11-08):study×4 的 URL/方法/回包形状按 apps/api 的 success(...) 实参钉死 ──

import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

export interface StudyInfo {
  todayMinutes: number
  totalMinutes: number
  continuousDays: number
  courses: number
  totalLessons: number
  completedLessons: number
}

export interface StudyPlanItem {
  id: string
  title: string
  target: number
  minutes: number
  progress: number
  createdAt: string
}

export interface StudyPlan {
  list: StudyPlanItem[]
  todayMinutes: number
}

/** 列名保持后端 SQL 的蛇形,端内不得改名(改名即把排行榜读成空)。 */
export interface StudyRankRow {
  user_id: string
  nickname: string
  avatar: string | null
  watch_duration: number
  minutes: number
  completed_count: number
  progress: number
}

export interface StudyVideoChapter {
  id: string
  title: string
  duration: string
}

export interface StudyVideoDetail {
  id: string
  title: string
  url: string | null
  playUrl: string | null
  duration: number
  content: string | null
  isFree: boolean
  chapterId: string | null
  courseId: string | null
  courseName: string
  coverUrl: string | null
  description: string | null
  teacher: string | null
  tags: string[]
  amount: number
  payType: number
  chapters: StudyVideoChapter[]
}

export function getStudyInfo(): Promise<ApiResult<StudyInfo>> {
  return fetchApi<StudyInfo>('/api/study/info')
}

export function getStudyPlan(): Promise<ApiResult<StudyPlan>> {
  return fetchApi<StudyPlan>('/api/study/plan')
}

export function getStudyRank(params: { limit?: number } = {}): Promise<ApiResult<{ list: StudyRankRow[] }>> {
  return fetchApi<{ list: StudyRankRow[] }>(`/api/study/rank${buildQs(params)}`)
}

export function getStudyVideoDetail(id: string): Promise<ApiResult<StudyVideoDetail>> {
  return fetchApi<StudyVideoDetail>(`/api/study/videos/${encodeURIComponent(id)}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
