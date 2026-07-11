/**
 * 学习相关 API
 * 合并迁移自旧架构：learn, study, schedule, member
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

// ===================== 类型定义 =====================

export interface PageQuery {
  page?: number
  pageSize?: number
  [key: string]: string | number | undefined | null
}

/** 学习课程 */
export interface LearnCourse {
  id: string
  title: string
  description?: string
  cover?: string
  category?: string
  teacherId?: string
  teacherName?: string
  lessonCount?: number
  duration?: number
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  status?: number
  enrolledCount?: number
  createdAt: string
  [key: string]: unknown
}

/** 学习记录 */
export interface LearnRecord {
  id: string
  userId: string
  courseId?: string
  courseTitle?: string
  lessonId?: string
  lessonTitle?: string
  duration?: number
  progress?: number
  status?: 'in_progress' | 'completed' | 'paused'
  lastStudyAt?: string
  createdAt: string
  [key: string]: unknown
}

/** 学习计划 */
export interface Schedule {
  id: string
  userId?: string
  title: string
  description?: string
  courseId?: string
  lessonId?: string
  startDate?: string
  endDate?: string
  startTime?: string
  endTime?: string
  remind?: boolean
  repeatType?: 'none' | 'daily' | 'weekly' | 'monthly'
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority?: 'low' | 'medium' | 'high'
  createdAt: string
  [key: string]: unknown
}

/** 会员 */
export interface Member {
  id: string
  userId: string
  userNickname?: string
  userAvatar?: string
  level: number
  levelName?: string
  points: number
  totalPoints?: number
  expireAt?: string
  status?: 'active' | 'expired' | 'suspended'
  privileges?: string[]
  createdAt: string
  [key: string]: unknown
}

/** 会员等级 */
export interface MemberLevel {
  id: string
  level: number
  name: string
  description?: string
  icon?: string
  minPoints: number
  maxPoints?: number
  privileges?: string[]
  discount?: number
  [key: string]: unknown
}

/** 学习进度 */
export interface StudyProgress {
  courseId: string
  courseTitle?: string
  totalLessons: number
  completedLessons: number
  progress: number
  totalDuration?: number
  studiedDuration?: number
  lastStudyAt?: string
  [key: string]: unknown
}

// ===================== learn（学习） =====================

/** 获取学习课程列表 */
export async function getLearnCourses(
  query: PageQuery & {
    category?: string
    difficulty?: LearnCourse['difficulty']
    keyword?: string
  } = {},
): Promise<ApiResult<PageData<LearnCourse>>> {
  return fetchApi<PageData<LearnCourse>>(`/api/learn${buildQs(query)}`)
}

/** 获取学习课程详情 */
export async function getLearnCourseDetail(id: string): Promise<ApiResult<LearnCourse>> {
  return fetchApi<LearnCourse>(`/api/learn/${id}`)
}

/** 报名学习课程 */
export async function enrollLearnCourse(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/learn/${id}/enroll`, { method: 'POST' })
}

/** 获取我的学习课程 */
export async function getMyLearnCourses(
  query: PageQuery & { status?: LearnRecord['status'] } = {},
): Promise<ApiResult<PageData<LearnCourse>>> {
  return fetchApi<PageData<LearnCourse>>(`/api/learn/my${buildQs(query)}`)
}

/** 创建学习课程 */
export async function createLearnCourse(
  input: Partial<LearnCourse>,
): Promise<ApiResult<LearnCourse>> {
  return fetchApi<LearnCourse>('/api/learn', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新学习课程 */
export async function updateLearnCourse(
  id: string,
  input: Partial<LearnCourse>,
): Promise<ApiResult<LearnCourse>> {
  return fetchApi<LearnCourse>(`/api/learn/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除学习课程 */
export async function deleteLearnCourse(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/learn/${id}`, { method: 'DELETE' })
}

// ===================== study（学习记录/进度） =====================

/** 获取学习记录列表 */
export async function getStudyRecords(
  query: PageQuery & { courseId?: string; status?: LearnRecord['status'] } = {},
): Promise<ApiResult<PageData<LearnRecord>>> {
  return fetchApi<PageData<LearnRecord>>(`/api/study/records${buildQs(query)}`)
}

/** 获取学习记录详情 */
export async function getStudyRecordDetail(id: string): Promise<ApiResult<LearnRecord>> {
  return fetchApi<LearnRecord>(`/api/study/records/${id}`)
}

/** 记录学习 */
export async function recordStudy(input: {
  courseId?: string
  lessonId?: string
  duration?: number
  progress?: number
}): Promise<ApiResult<LearnRecord>> {
  return fetchApi<LearnRecord>('/api/study/records', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新学习进度 */
export async function updateStudyProgress(
  id: string,
  input: { progress?: number; status?: LearnRecord['status'] },
): Promise<ApiResult<LearnRecord>> {
  return fetchApi<LearnRecord>(`/api/study/records/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 获取学习进度 */
export async function getStudyProgress(courseId: string): Promise<ApiResult<StudyProgress>> {
  return fetchApi<StudyProgress>(`/api/study/progress${buildQs({ courseId })}`)
}

/** 获取所有课程学习进度 */
export async function getAllStudyProgress(
  query: PageQuery = {},
): Promise<ApiResult<PageData<StudyProgress>>> {
  return fetchApi<PageData<StudyProgress>>(`/api/study/progress/all${buildQs(query)}`)
}

/** 获取学习统计 */
export async function getStudyStatistics(query: { start?: string; end?: string } = {}): Promise<
  ApiResult<{
    totalDuration: number
    totalCourses: number
    completedCourses: number
    totalLessons: number
    completedLessons: number
    continuousDays: number
    [key: string]: unknown
  }>
> {
  return fetchApi<{
    totalDuration: number
    totalCourses: number
    completedCourses: number
    totalLessons: number
    completedLessons: number
    continuousDays: number
    [key: string]: unknown
  }>(`/api/study/statistics${buildQs(query)}`)
}

// ===================== schedule（学习计划） =====================

/** 获取学习计划列表 */
export async function getSchedules(
  query: PageQuery & { status?: Schedule['status']; startDate?: string; endDate?: string } = {},
): Promise<ApiResult<PageData<Schedule>>> {
  return fetchApi<PageData<Schedule>>(`/api/schedule${buildQs(query)}`)
}

/** 获取学习计划详情 */
export async function getScheduleDetail(id: string): Promise<ApiResult<Schedule>> {
  return fetchApi<Schedule>(`/api/schedule/${id}`)
}

/** 创建学习计划 */
export async function createSchedule(input: Partial<Schedule>): Promise<ApiResult<Schedule>> {
  return fetchApi<Schedule>('/api/schedule', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新学习计划 */
export async function updateSchedule(
  id: string,
  input: Partial<Schedule>,
): Promise<ApiResult<Schedule>> {
  return fetchApi<Schedule>(`/api/schedule/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除学习计划 */
export async function deleteSchedule(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/schedule/${id}`, { method: 'DELETE' })
}

/** 标记学习计划完成 */
export async function completeSchedule(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/schedule/${id}/complete`, { method: 'POST' })
}

// ===================== member（会员） =====================

/** 获取当前用户会员信息 */
export async function getMyMemberInfo(): Promise<ApiResult<Member>> {
  return fetchApi<Member>('/api/member/me')
}

/** 获取会员列表 */
export async function getMembers(
  query: PageQuery & { level?: number; status?: Member['status'] } = {},
): Promise<ApiResult<PageData<Member>>> {
  return fetchApi<PageData<Member>>(`/api/member${buildQs(query)}`)
}

/** 获取会员详情 */
export async function getMemberDetail(id: string): Promise<ApiResult<Member>> {
  return fetchApi<Member>(`/api/member/${id}`)
}

/** 更新会员信息 */
export async function updateMember(id: string, input: Partial<Member>): Promise<ApiResult<Member>> {
  return fetchApi<Member>(`/api/member/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 获取会员等级列表 */
export async function getMemberLevels(): Promise<ApiResult<MemberLevel[]>> {
  return fetchApi<MemberLevel[]>('/api/member/levels')
}

/** 获取会员等级详情 */
export async function getMemberLevelDetail(id: string): Promise<ApiResult<MemberLevel>> {
  return fetchApi<MemberLevel>(`/api/member/levels/${id}`)
}

/** 创建会员等级 */
export async function createMemberLevel(
  input: Partial<MemberLevel>,
): Promise<ApiResult<MemberLevel>> {
  return fetchApi<MemberLevel>('/api/member/levels', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新会员等级 */
export async function updateMemberLevel(
  id: string,
  input: Partial<MemberLevel>,
): Promise<ApiResult<MemberLevel>> {
  return fetchApi<MemberLevel>(`/api/member/levels/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除会员等级 */
export async function deleteMemberLevel(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/member/levels/${id}`, { method: 'DELETE' })
}
