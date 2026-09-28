// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 课程筛选屏的**轴映射纯逻辑**(2026-09-28 起不止价格一根轴:分类 / 难度 / 价格)。
// 单独成文件的理由不是"整洁":屏文件整体 import 会拉起 @react-navigation(它的字体资源在
// vitest 下无法 transform ⇒ 收集期就炸),而"点这一档到底会不会把参数发给服务端"是
// **可判定的行为** —— 真机只能拍到空态(生产库已发布课程 total=0),拍不到"点了付费会不会少",
// 所以必须能被单测。
//
// 2026-09-28 的改动:`matchesPriceTab`(端内对已取回的一页做二次过滤)已删 —— 价格轴现在
// 由服务端 `findPublishedLessons` 实现,端内再判一次就是"两处算同一件事",而且症状是
// 「分页与筛选互斥」:第二页根本没取回来,过滤却按第一页算。
import type { LearnCourse, LearnCoursesQuery } from '@ihui/api-client'
import type {
  CourseDifficultyFilter,
  CoursePriceFilter,
  LessonDifficulty,
  LessonPriceAxis,
} from '@ihui/types'

export type CoursePriceTab = CoursePriceFilter
export type CourseDifficultyTab = CourseDifficultyFilter

/** 分类轴的"未选"哨兵(与共享屏 / 服务端之间互转:选 'all' 就等于不下传 categoryId)。 */
export const ALL_SENTINEL = 'all'

/** 三根轴的草稿态与已应用态同形,所以只需要这一个类型。 */
export interface CourseFilterAxes {
  price: CoursePriceTab
  difficulty: CourseDifficultyTab
  /** learn_categories.id 或 ALL_SENTINEL */
  categoryId: string
}

export const DEFAULT_COURSE_FILTER_AXES: CourseFilterAxes = {
  price: 'all',
  difficulty: 'all',
  categoryId: ALL_SENTINEL,
}

/** 后端行上本屏真正读到的字段(整行 lessons + adaptLesson 追加的 instructor)。
 *  刻意是别名而不是 `interface extends {}`:空扩展会被 lint 判 no-empty-interface,
 *  而这里的语义本来就是"服务端返回什么就是什么",端内不再加任何字段。 */
export type LessonPriceRow = LearnCourse

/**
 * lessons.price 是 numeric(10,2),经 Drizzle 回传是**字符串**("0.00"/"99.50")。
 * 非数、缺值、负数一律按免费看。这里只负责"把行上的价格读成展示用的数字"——
 * 筛选判据本身住在服务端 `lessonFreeCondition()` 一处,端内不再算第二遍。
 */
export function priceOf(row: LessonPriceRow): number {
  const n = typeof row.price === 'string' ? Number(row.price) : row.price
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0
}

/** 档位 → 服务端参数:'all' 必须是"不下传",而不是传一个服务端会 400 的值。 */
export function priceAxisOf(tab: CoursePriceTab): LessonPriceAxis | undefined {
  return tab === 'all' ? undefined : tab
}

export function difficultyAxisOf(tab: CourseDifficultyTab): LessonDifficulty | undefined {
  return tab === 'all' ? undefined : tab
}

export function categoryAxisOf(categoryId: string): string | undefined {
  return categoryId === ALL_SENTINEL ? undefined : categoryId
}

/**
 * 把三根轴 + 分页落成 GET /api/learn/lessons 的查询对象。
 *
 * 键名必须与服务端 lessonsQuerySchema **逐字同形**(page/pageSize/categoryId/difficulty/price):
 * Zod 会静默剥掉未知键,拼错一个键名的症状是"200 + 什么都没筛",而不是报错。
 * 这条映射是纯函数,所以它能在单测里被逐键钉住 —— 真机拍不到(生产无已发布课程)。
 */
export function buildCourseFilterQuery(
  axes: CourseFilterAxes,
  page: number,
  pageSize: number,
): LearnCoursesQuery {
  return {
    page,
    pageSize,
    price: priceAxisOf(axes.price),
    difficulty: difficultyAxisOf(axes.difficulty),
    categoryId: categoryAxisOf(axes.categoryId),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
