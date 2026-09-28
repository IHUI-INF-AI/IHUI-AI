// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 学习相关 API
 * 合并迁移自旧架构：learn, study, schedule, member
 */
import type { ApiResult, LessonDifficulty, LessonPriceAxis } from '@ihui/types'

export type { LessonDifficulty, LessonPriceAxis }

import { fetchApi } from '../client.js'
import { buildQs, type PageData } from '../utils.js'

// ===================== 类型定义 =====================

export interface PageQuery {
  page?: number
  pageSize?: number
  [key: string]: string | number | undefined | null
}

/**
 * 课程难度档 = `@ihui/types` 的 LessonDifficulty(与 packages/database 的 LESSON_DIFFICULTIES
 * 同形;列与写入校验只有一份取值域)。
 * 刻意不带 `| null`:`lessons.difficulty` 可空,未标注的行 JSON 里真是 null,但把 null 写进
 * 本类型会让两个既有消费点在**本票改不了的射程外**红 —— apps/mobile-rn/src/screens/LearnScreen.tsx:135
 * 与 packages/app/src/features/learn/LearnScreen.tsx:181 的 `difficultyLabel(d?: string)`
 * 都只接 `string | undefined`。要收这一格得连 LearnScreenProps 一起改,已写进交付报告。
 */
export type LearnCourseDifficulty = LessonDifficulty

/** 课程列表的价格筛选轴(服务端 findPublishedLessons 实现,不再由端内二次过滤)。 */
export type LearnCoursePriceAxis = LessonPriceAxis

/** GET /api/learn/lessons 的查询轴 —— 每根都必须与服务端 lessonsQuerySchema 同名,否则被 Zod 静默剥掉。 */
export interface LearnCoursesQuery {
  page?: number
  pageSize?: number
  /** learn_categories.id(UUID);中文分类名不是它的键 */
  categoryId?: string
  search?: string
  difficulty?: LearnCourseDifficulty
  price?: LearnCoursePriceAxis
}

/**
 * 学习课程行。**逐字段按服务端实际返回写**:
 *  - 列本身:GET /api/learn/lessons 走 `select({ lesson: lessons, categoryName })` ⇒ 整行 + 分类名
 *  - adaptLesson 追加:instructor / description / students / cover
 *    (routes/learn.ts:519;GET /learn/my-lessons **不经**该适配,所以这四个是可选)
 *  - numeric(10,2) 经 Drizzle 回传是**字符串**("0.00"),不是 number
 *  - 已删除的假字段:category / teacherId / enrolledCount(服务端从不返回,全仓零读取)
 *  - 仍然保留但**服务端从不返回**的遗留字段:teacherName / duration —— 见各自注释,
 *    它们的存在是为了 apps/web(HomeModules 三处)与 RN LearnScreen 当前仍能编译,
 *    属"知道是假的、但删它要先改别人的文件"的在账残留,不得读成"这些字段是真的"。
 */
export interface LearnCourse {
  id: string
  title: string
  createdAt: string
  intro?: string | null
  coverImage?: string | null
  categoryId?: string | null
  categoryName?: string | null
  lecturerId?: string | null
  lecturerName?: string | null
  difficulty?: LearnCourseDifficulty
  price?: string
  originalPrice?: string | null
  isFree?: boolean
  isPublished?: boolean
  sort?: number
  viewCount?: number
  signupCount?: number
  lessonCount?: number
  status?: number
  updatedAt?: string
  /** adaptLesson 追加(仅 /learn/lessons、/learn/recommend、/learn/hot、详情) */
  instructor?: string
  description?: string
  students?: number
  cover?: string | null
  /** 报名列表(GET /learn/my-lessons)独有的派生列 */
  signupStatus?: number
  progress?: number
  /** @deprecated 服务端从不返回该键;真实列名是 lecturerName / 适配名是 instructor。
   *  apps/web/src/components/home/HomeModules.tsx 三处仍读它 ⇒ 首页课程卡 meta 恒为空。
   *  保留仅为不让 web typecheck 因本票红,已列进交付报告待另票收口。 */
  teacherName?: string
  /** @deprecated lessons 表没有时长列;读它恒为 undefined(同上一条处置理由)。 */
  duration?: number
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

/** 获取学习课程列表(全部筛选轴由服务端实现:categoryId / difficulty / price / search) */
export async function getLearnCourses(
  query: LearnCoursesQuery = {},
): Promise<ApiResult<PageData<LearnCourse>>> {
  return fetchApi<PageData<LearnCourse>>(`/api/learn/lessons${buildQs(query)}`)
}

/**
 * GET /api/learn/categories 的行(公开,只回 status=1 的启用分类)。
 * 分类轴的**唯一**真相源:中文 name + UUID id —— 端内不得再硬编码分类名。
 * 服务端信封是 `{ list: [...] }`(routes/learn.ts:555),所以返回类型是 list 本身。
 */
export interface LearnCategoryRow {
  id: string
  name: string
  pid: string | null
  sort: number
  status: number
  createdAt: string
}

export async function getLearnCategories(): Promise<ApiResult<LearnCategoryRow[]>> {
  const res = await fetchApi<{ list?: LearnCategoryRow[] } | LearnCategoryRow[]>(
    '/api/learn/categories',
  )
  // 失败分支整份原样返回:errorCode / retryAfter 都是"这个错误的身份"(守门 135 同一族),
  // 重新拼一个 {error,status} 就等于把它们丢掉。
  if (!res.success) return res
  const data = res.data
  return { success: true as const, data: Array.isArray(data) ? data : (data?.list ?? []) }
}

/** 获取学习课程详情 */
export async function getLearnCourseDetail(id: string): Promise<ApiResult<LearnCourse>> {
  return fetchApi<LearnCourse>(`/api/learn/lessons/${id}`)
}

/** 报名学习课程 */
export async function enrollLearnCourse(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/learn/lessons/${id}/sign-up`, { method: 'POST' })
}

/** 获取我的学习课程 */
export async function getMyLearnCourses(
  query: PageQuery & { status?: LearnRecord['status'] } = {},
): Promise<ApiResult<PageData<LearnCourse>>> {
  return fetchApi<PageData<LearnCourse>>(`/api/learn/my-lessons${buildQs(query)}`)
}

/** 创建学习课程 */
export async function createLearnCourse(
  input: Partial<LearnCourse>,
): Promise<ApiResult<LearnCourse>> {
  return fetchApi<LearnCourse>('/api/learn/lessons', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新学习课程 */
export async function updateLearnCourse(
  id: string,
  input: Partial<LearnCourse>,
): Promise<ApiResult<LearnCourse>> {
  return fetchApi<LearnCourse>(`/api/learn/lessons/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除学习课程 */
export async function deleteLearnCourse(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/learn/lessons/${id}`, { method: 'DELETE' })
}

/** 推荐课程(按报名数降序) */
export async function getRecommendLearnCourses(limit = 10): Promise<ApiResult<LearnCourse[]>> {
  return fetchApi<LearnCourse[]>(`/api/learn/recommend${buildQs({ limit })}`)
}

/** 热门课程(按浏览数降序) */
export async function getHotLearnCourses(limit = 10): Promise<ApiResult<LearnCourse[]>> {
  return fetchApi<LearnCourse[]>(`/api/learn/hot${buildQs({ limit })}`)
}

/** 获取分类父级路径(递归到根) */
export async function getLearnCategoryParents(
  id: string,
): Promise<ApiResult<LearnCategoryParent[]>> {
  return fetchApi<LearnCategoryParent[]>(`/api/learn/categories/${id}/parents`)
}

export interface LearnCategoryParent {
  id: string
  name: string
  pid: string | null
  sort: number
  status: number
  createdAt: string
}

// ===================== study（学习记�?进度�?=====================

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

/** 获取所有课程学习进�?*/
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
  return fetchApi<Member>('/api/members/me')
}

/** 获取会员列表 */
export async function getMembers(
  query: PageQuery & { level?: number; status?: Member['status'] } = {},
): Promise<ApiResult<PageData<Member>>> {
  return fetchApi<PageData<Member>>(`/api/members${buildQs(query)}`)
}

/** 获取会员详情 */
export async function getMemberDetail(id: string): Promise<ApiResult<Member>> {
  return fetchApi<Member>(`/api/members/${id}`)
}

/** 更新会员信息 */
export async function updateMember(id: string, input: Partial<Member>): Promise<ApiResult<Member>> {
  return fetchApi<Member>(`/api/members/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 获取会员等级列表 */
export async function getMemberLevels(): Promise<ApiResult<MemberLevel[]>> {
  return fetchApi<MemberLevel[]>('/api/members/levels')
}

/** 获取会员等级详情 */
export async function getMemberLevelDetail(id: string): Promise<ApiResult<MemberLevel>> {
  return fetchApi<MemberLevel>(`/api/members/levels/${id}`)
}

/** 创建会员等级 */
export async function createMemberLevel(
  input: Partial<MemberLevel>,
): Promise<ApiResult<MemberLevel>> {
  return fetchApi<MemberLevel>('/api/members/levels', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新会员等级
 * 门 8 死调用清账(2026-09-28):后端真形态是 PUT /members/levels 且 **id 在体内**
 * (member.ts:746 updateLevelSchema 要求 body.id),上一版 PUT /members/levels/${id} 从未注册。 */
export async function updateMemberLevel(
  id: string,
  input: Partial<MemberLevel>,
): Promise<ApiResult<MemberLevel>> {
  return fetchApi<MemberLevel>('/api/members/levels', {
    method: 'PUT',
    body: JSON.stringify({ id, ...input }),
  })
}

/** 删除会员等级
 * 门 8 死调用清账(2026-09-28):后端 DELETE /members/levels 的 id 走 **query**
 * (member.ts:760 byIdQuery=request.query),上一版 DELETE /members/levels/${id} 从未注册。 */
export async function deleteMemberLevel(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/members/levels${buildQs({ id })}`, {
    method: 'DELETE',
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
