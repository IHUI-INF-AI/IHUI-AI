// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type {
  ApiResult,
  CourseCatalogItem,
  CourseCommentItem,
  LessonDifficulty,
  LessonPriceAxis,
} from '@ihui/types'

import { fetchApi } from '../client.js'
import type { PageData } from '../utils.js'
import { enrollLearnCourse, getLearnCourses, getMyLearnCourses, type LearnCourse } from './learn.js'

/**
 * 课程域出口(列表 / 详情 / 进度 / 心跳 / 报名)。
 *
 * 取数只走**唯一那套** `/api/learn/*` 端点,不再打 `/api/course/*`:
 *  - `GET /api/course` 虽已注册,但它的字段是零填充的(categoryName/lessonCount/
 *    studentCount/rating/level 恒为常量),而且**不过滤 is_published** ⇒ 公开面会把草稿课也吐出来;
 *  - `GET /api/course/:id` **从未注册**(404);
 *  - `GET /api/course/:id/progress` 返回的是 {progress,status,completedLessons,totalLessons},
 *    与真实进度(按小节记的 sectionProgress[])不同形;
 *  - `POST /api/course/lesson-complete` 把 body.lessonId 当**课程**id 用(学习记录是按**小节**记的)。
 * URL 与取数实现在 learn.ts 一处;本文件只做"服务端行 → 端内展示形状"的适配。
 */

/**
 * 课程行 —— 逐字段按服务端真实返回写。
 *
 *  - 列本身:lessons 整行 + learn_categories.name(LEFT JOIN)
 *  - adaptLesson 追加(instructor / description / students / cover);`/learn/my-lessons`
 *    **不经**该适配 ⇒ 这四根各有回退(lecturerName / intro / signupCount / coverImage)
 *  - numeric(10,2) 的 price 经 Drizzle 回传是**字符串**("0.00")⇒ 适配层读成 number
 * 已删除的假字段(旧 /api/course 那套从未实现的契约):instructorAvatar / rating / tags
 * —— 服务端列表行里没有它们,留在类型里就是"看着有、其实恒空"。
 */
export interface Course {
  id: string
  title: string
  cover: string | null
  description: string
  categoryId: string | null
  categoryName: string | null
  instructor: string
  price: number
  originalPrice: number | null
  lessonCount: number
  studentCount: number
  isFree: boolean
  /** 难度档(= lessons.difficulty)。**可空**:历史行没有可信来源,按标题猜等于造数据。 */
  difficulty: LessonDifficulty | null
  /** 难度档的展示形态(端内既有消费点读的是这一根);未标注时是空串。 */
  level: string
  isEnrolled: boolean
  createdAt: string
  updatedAt: string
}

/**
 * lessons.price 是 numeric(10,2),经 Drizzle 回传是**字符串**("0.00"/"99.50")。
 * 非数、缺值、负数一律按免费看。**本函数是价格读法的唯一实现** ——
 * 端内(app/mobile-rn/src/lib/course-filter-price.ts)从这儿转出,不再各写一份。
 * 筛选判据本身住在服务端 `lessonFreeCondition()` 一处,端内不重算。
 */
export function priceOf(row: { price?: string | number | null }): number {
  const n = typeof row.price === 'string' ? Number(row.price) : row.price
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * 详情页的课程行 —— 服务端在 adaptLesson 之外还挂了两根**只在详情端点**有的列:
 * signedUp(当前用户是否报名)与 rating(已发布评价的真实聚合)。
 * progress 一根 LearnCourse 已有(详情端点才赋值)。
 */
interface WireDetailLesson extends LearnCourse {
  signedUp?: boolean
  rating?: number
}

/** 服务端章节(章节为顶层,小节挂在 sections 里) */
interface WireChapter {
  id: string
  title: string
  sortOrder?: number
  sections?: WireSection[]
}

/** 服务端小节(可播放项) */
interface WireSection {
  id: string
  chapterId: string
  title: string
  videoUrl?: string | null
  /** 展示用 "mm:ss"(未标注时长时是 undefined) */
  duration?: string
  /** 时长(秒)—— 库里就是秒,播放器上报的 position/duration 也必须是秒 */
  durationSeconds?: number
  sortOrder?: number
  isFree?: boolean
}

/** 小节(可播放项)—— 端内形状 */
export interface CourseSection {
  id: string
  chapterId: string
  title: string
  videoUrl: string | null
  /** 时长(秒) */
  durationSeconds: number
  /** 展示用 "mm:ss";未标注时长时是 undefined */
  durationText: string | undefined
  sortOrder: number
  isFree: boolean
}

/** 章节 —— 端内形状 */
export interface CourseChapter {
  id: string
  title: string
  sortOrder: number
  sections: CourseSection[]
}

/** 课程详情(GET /api/learn/lessons/:id 的适配结果) */
export interface CourseDetail {
  id: string
  title: string
  cover: string | null
  description: string
  categoryId: string | null
  categoryName: string | null
  instructor: string
  price: number
  originalPrice: number | null
  lessonCount: number
  studentCount: number
  isFree: boolean
  difficulty: LessonDifficulty | null
  level: string
  isEnrolled: boolean
  /** 报名后的整体进度(0-100);未报名/未登录是 0 */
  progress: number
  /** 评分(已发布评价的真实聚合;无评价是 0)—— 列表行不带这一根,只有详情端点有。 */
  rating: number
  chapters: CourseChapter[]
}

/** 单个小节的学习进度 */
export interface SectionProgress {
  sectionId: string | null
  progress: number
  /** 0=未开始 1=进行中 2=已完成 */
  status: number
  watchDuration: number
  lastPosition: number
}

/** 课程学习进度(GET /api/learn/lessons/:id/progress 的适配结果) */
export interface LessonProgress {
  courseId: string
  progress: number
  status: number
  watchDuration: number
  totalDuration: number
  lastPosition: number
  sectionProgress: SectionProgress[]
}

/** 心跳上报结果 */
export interface LessonHeartbeatResult {
  recordId: string
  progress: number
  status: number
  watchDuration: number
  totalDuration: number
  lastPosition: number
  /** 本次心跳是否触发了自动完成(进度 ≥90% 且观看时长 ≥ 总时长 90%) */
  autoCompleted: boolean
}

export interface CourseCategory {
  id: string
  name: string
  icon: string | null
  sort: number
  courseCount: number
}

export type CourseListQuery = {
  page?: number
  pageSize?: number
  categoryId?: string
  /** 标题模糊搜索;服务端那根轴叫 search(旧 /api/course 的 keyword 从未被服务端读过) */
  keyword?: string
  /** 难度筛选;服务端那根轴叫 difficulty */
  difficulty?: LessonDifficulty
  /** 价格筛选;服务端那根轴叫 price */
  price?: LessonPriceAxis
}

/** 服务端行 → 端内课程行。缺 adaptLesson 的那四根各有回退(见 Course 的字段说明)。 */
function toCourse(row: LearnCourse, isEnrolled = false): Course {
  const difficulty = row.difficulty ?? null
  return {
    id: row.id,
    title: row.title,
    cover: row.cover ?? row.coverImage ?? null,
    description: row.description ?? row.intro ?? '',
    categoryId: row.categoryId ?? null,
    categoryName: row.categoryName ?? null,
    instructor: row.instructor ?? row.lecturerName ?? '',
    price: priceOf(row),
    originalPrice:
      row.originalPrice === null || row.originalPrice === undefined
        ? null
        : priceOf({ price: row.originalPrice }),
    lessonCount: row.lessonCount ?? 0,
    studentCount: row.students ?? row.signupCount ?? 0,
    isFree: row.isFree ?? false,
    difficulty,
    level: difficulty ?? '',
    isEnrolled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? row.createdAt,
  }
}

/** 已发布课程列表(公开;筛选轴全部在服务端实现,端内不做二次过滤)。 */
export async function getCourses(
  query: CourseListQuery = {},
): Promise<ApiResult<PageData<Course>>> {
  const { keyword, difficulty, price, ...rest } = query
  const res = await getLearnCourses({ ...rest, search: keyword, difficulty, price })
  if (!res.success) return res
  return {
    ...res,
    data: {
      ...res.data,
      list: (res.data.list ?? []).map((row) => toCourse(row)),
    },
  }
}

/**
 * 课程详情(章节为顶层,小节挂在章节的 sections 里)。
 * 未登录也读得到(公开端点);已登录时服务端附带 signedUp / progress。
 */
export async function getCourseById(id: string): Promise<ApiResult<CourseDetail>> {
  const res = await fetchApi<{ lesson?: WireDetailLesson; chapters?: WireChapter[] }>(
    `/api/learn/lessons/${encodeURIComponent(id)}`,
  )
  if (!res.success) return res
  const lesson = res.data.lesson
  if (!lesson) return { success: false, error: '课程不存在', status: 404 }
  const row = toCourse(lesson, lesson.signedUp === true)
  const chapters: CourseChapter[] = (res.data.chapters ?? []).map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    sortOrder: chapter.sortOrder ?? 0,
    sections: (chapter.sections ?? []).map((section) => ({
      id: section.id,
      chapterId: section.chapterId,
      title: section.title,
      videoUrl: section.videoUrl ?? null,
      durationSeconds: section.durationSeconds ?? 0,
      durationText: section.duration,
      sortOrder: section.sortOrder ?? 0,
      isFree: section.isFree ?? false,
    })),
  }))
  return {
    success: true,
    data: {
      ...row,
      progress: lesson.progress ?? 0,
      rating: lesson.rating ?? 0,
      chapters,
    },
  }
}

/**
 * 课程目录(章节为顶层,小节挂 children)—— 详情端点的再投影,不新开取数。
 * 旧 `/api/courses/:id/catalog`(course-mobile-routes)整个注册面正被别席清除
 * ⇒ 目录屏/章节屏换源到这一根,与 `/api/learn` 注册面同生共死。
 * duration 口径与旧端点逐字同:秒 → 分钟(Math.round);空 videoUrl 不打字段
 * (章节行本身没有视频地址,只有小节行有)。
 */
export async function getCourseCatalog(id: string): Promise<ApiResult<CourseCatalogItem[]>> {
  const res = await getCourseById(id)
  if (!res.success) return res
  const toMinutes = (seconds: number) => Math.round(seconds / 60)
  const data: CourseCatalogItem[] = res.data.chapters.map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    type: 'chapter',
    duration: toMinutes(chapter.sections.reduce((sum, section) => sum + section.durationSeconds, 0)),
    children: chapter.sections.map((section) => ({
      id: section.id,
      title: section.title,
      type: 'section',
      duration: toMinutes(section.durationSeconds),
      ...(section.videoUrl ? { videoUrl: section.videoUrl } : {}),
    })),
  }))
  return { success: true, data }
}

/** 服务端评价行(GET /learn/lessons/:lessonId/rates;三个分项与 isAnonymous 都可空) */
interface WireRate {
  id: string
  content?: string | null
  contentUtilityScore?: number | null
  teacherScore?: number | null
  serviceScore?: number | null
  isAnonymous?: boolean
  createdAt: string
}

/**
 * 课程评价列表 —— 打已注册的 `GET /api/learn/lessons/:lessonId/rates`
 * (旧 `/api/courses/:id/comments` 随 course-mobile-routes 一并被摘,换源到这一根)。
 * 投影与旧端点逐字同口径:rating = 有值分项的均值取一位小数(一项都没有 → 0),
 * 匿名行 user = 「匿名用户」否则「学员」;服务端 findRateList 只出 status='published' 行。
 * pageSize=50 与旧端点写死的 50 同档,首页一次拉齐。
 */
export async function getCourseComments(id: string): Promise<ApiResult<CourseCommentItem[]>> {
  const res = await fetchApi<{ list?: WireRate[] }>(
    `/api/learn/lessons/${encodeURIComponent(id)}/rates?page=1&pageSize=50`,
  )
  if (!res.success) return res
  const data: CourseCommentItem[] = (res.data.list ?? []).map((row) => {
    const scores = [row.contentUtilityScore, row.teacherScore, row.serviceScore].filter(
      (score): score is number => typeof score === 'number',
    )
    const rating = scores.length
      ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10
      : 0
    return {
      id: row.id,
      user: row.isAnonymous ? '匿名用户' : '学员',
      content: row.content ?? '',
      rating,
      createdAt: row.createdAt,
    }
  })
  return { success: true, data }
}

/** 课程(学习)分类列表
 * 门 8 死调用清账(2026-09-28):上一版 GET /api/course/categories 从未注册;真路由 =
 * GET /learn/categories(learn.ts:555,公开,返回 { list })。O87b 实测过该端点回真实分类行。
 * 解包成数组是为守住本函数既有签名(消费方 category.ts getAllCategories 直接把 data 当 CategoryNode[] 用)。 */
export async function getCategories(): Promise<ApiResult<CourseCategory[]>> {
  const res = await fetchApi<{ list: CourseCategory[] }>('/api/learn/categories')
  return res.success ? { ...res, data: res.data.list } : res
}

/** 报名课程(免费课也要报名才有学习记录 —— 进度/心跳都挂在报名上)。 */
export async function enrollCourse(id: string): Promise<ApiResult<{ ok: boolean }>> {
  return enrollLearnCourse(id)
}

/** 学习进度(按小节记;未报名时服务端回 404,调用方据此提示先报名)。 */
export async function getProgress(id: string): Promise<ApiResult<LessonProgress>> {
  const res = await fetchApi<{
    progress?: number
    status?: number
    watchDuration?: number
    totalDuration?: number
    lastPosition?: number
    sectionProgress?: SectionProgress[]
  }>(`/api/learn/lessons/${encodeURIComponent(id)}/progress`)
  if (!res.success) return res
  const d = res.data
  return {
    success: true,
    data: {
      courseId: id,
      progress: d.progress ?? 0,
      status: d.status ?? 0,
      watchDuration: d.watchDuration ?? 0,
      totalDuration: d.totalDuration ?? 0,
      lastPosition: d.lastPosition ?? 0,
      sectionProgress: d.sectionProgress ?? [],
    },
  }
}

/**
 * 学习心跳上报 —— 学习记录**按小节记**,所以这里必须带 sectionId。
 * position/duration 的口径是**秒**(库里 lesson_records.watch_duration 也是秒)。
 * 服务端判自动完成:进度 ≥90% 且观看时长 ≥ 总时长 90%(AUTO_COMPLETE_PROGRESS / RATIO)。
 */
export async function reportLessonProgress(input: {
  courseId: string
  sectionId?: string
  chapterId?: string
  /** 已播放到的位置(秒) */
  position: number
  /** 本次播放时长(秒) */
  duration: number
}): Promise<ApiResult<LessonHeartbeatResult>> {
  const { courseId, sectionId, chapterId, position, duration } = input
  return fetchApi<LessonHeartbeatResult>(
    `/api/learn/lessons/${encodeURIComponent(courseId)}/heartbeat`,
    {
      method: 'POST',
      body: JSON.stringify({
        ...(sectionId ? { sectionId } : {}),
        ...(chapterId ? { chapterId } : {}),
        position: Math.max(0, Math.floor(position)),
        duration: Math.max(0, Math.floor(duration)),
      }),
    },
  )
}

/** 我报名的课程 */
export async function getMyCourses(
  query: { page?: number; pageSize?: number } = {},
): Promise<ApiResult<PageData<Course>>> {
  const res = await getMyLearnCourses(query)
  if (!res.success) return res
  return {
    ...res,
    data: {
      ...res.data,
      list: (res.data.list ?? []).map((row) => toCourse(row, true)),
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
