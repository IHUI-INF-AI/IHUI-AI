// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 课程详情的「课时目录行」契约(2026-11-14 立)。
 *
 * 治的是哪一族病:同一份课程大纲,三端各算一遍"哪一节已学完、哪一节锁着、哪一节是当前" ——
 *   · 小程序 `pkg-learn/course/detail.tsx` 算 `completed/locked/current` 三态;
 *   · 共享屏 `packages/app/src/features/course-detail/CourseDetailScreen.tsx` 只有 `isCompleted`
 *     (少了 `locked`/`current` 两态,所以它渲染不出"锁住"与"高亮当前节")。
 * 三态规则一旦分叉,同一门课在小程序与 RN 会出现"这节能点 / 那端点不动"。
 *
 * 本文件把规则钉成**纯函数**:
 *   · `completed` = 序号小于当前进度序号;
 *   · `current`   = 序号等于当前进度序号;
 *   · `locked`    = 非首节且课程收费(免费课的目录全开)。
 *
 * 归属:放在 `@ihui/shared` 而非 `packages/app/features/**` —— 后者 exports 只认 `.tsx`,
 * 纯 `.ts` 契约在那里解析不到(同 `social/post-actions.ts` 的归属理由)。
 *
 * 纪律:不 import 任何平台原语;视图各端自渲染,但**三态只在这里算**。
 */

/** 大纲原始行(后端 GET /api/content/course/:id 的 outline 项) */
export interface CourseOutlineItem {
  title: string
  duration?: string
  description?: string
}

/**
 * 目录行的**归一形态**。两端视图都消费它,不再各自散算三态。
 *
 * `id` 用序号字符串:本端点的大纲没有稳定主键(数组下标即身份),
 * 造一个 UUID 会让"同一节课"在两次请求间对不上。
 */
export interface CourseLessonRow {
  id: string
  title: string
  /** 已学完(序号 < 当前进度) */
  completed: boolean
  /** 锁住(非首节且课程收费) */
  locked: boolean
  /** 当前学习位置(序号 == 当前进度),端内用它做高亮 */
  current: boolean
  /** 时长文案(后端给才有) */
  duration?: string
}

/**
 * 把课程大纲投影成目录行。
 *
 * @param outline          后端 outline(可能为 undefined)
 * @param currentLessonIdx 当前学习到第几节(0 起);缺省 -1 = 未开始任何一节
 * @param price            课程价格(元);> 0 视为收费课,目录除首节外锁定
 *
 * 三条规则的**唯一实现**都在这里 —— 这就是"同一门课三端看到同样的锁与高亮"的保证。
 */
export function toCourseLessonRows(
  outline: readonly CourseOutlineItem[] | null | undefined,
  currentLessonIdx = -1,
  price = 0,
): CourseLessonRow[] {
  const items = outline ?? []
  const paid = price > 0
  return items.map((item, idx) => ({
    id: String(idx),
    title: item.title,
    completed: idx < currentLessonIdx,
    locked: idx > 0 && paid,
    current: idx === currentLessonIdx,
    duration: item.duration,
  }))
}

/**
 * 目录进度百分比(0-100)。
 *
 * 为什么单独给:两端都要展示"学了多少",而 0 节课时的除零是最容易各写各的错。
 * 空大纲 ⇒ 0,不是 NaN。
 */
export function courseLessonProgressPercent(
  outline: readonly CourseOutlineItem[] | null | undefined,
  currentLessonIdx = -1,
): number {
  const total = outline?.length ?? 0
  if (total <= 0) return 0
  const done = Math.min(Math.max(currentLessonIdx, 0), total)
  return Math.round((done / total) * 100)
}
