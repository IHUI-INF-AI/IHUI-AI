// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 直播讲师域「列表 + 详情」两屏的形状单源(web `/lecturers` ↔ `/lecturers/[id]` ↔
 * RN `LecturerList` / `LecturerProfile`)。
 *
 * 2026-10-28 立(工单 web-rn-gap:lecturers/[id],gap-tickets 第 7 行):
 * - RN 此前**连讲师列表都没有**,详情也没有;`TeacherDetailScreen` 走的是 `/teacher/:id`
 *   (教师域,不同物),不可复用 —— 故本域两屏独立建档,名字前缀统一 `Live*`,
 *   避免与 `packages/app/src/features/lecturer-list/`(教师域,已占用 `LecturerListItem`)撞名。
 *
 * ⚠️ 端点实回(读 apps/api/src/routes/live.ts:251-270 与 db/live-queries.ts:264-291 实测):
 * - `GET /api/live/lecturers` → `success({ list, total, page, pageSize })`,`list` 是
 *   `live_lecturers` 表裸行(id/name/avatar/title/intro/sort/status/createdAt);
 *   端点默认 `status=1`,已按 `sort asc, id desc` 排好 ⇒ 端内不再重排、不再筛状态。
 * - `GET /api/live/lecturers/:id` → `success({ lecturer })`;查不到时**是 404 + error**,
 *   不是 `{ lecturer: null }` ⇒ 宿主必须把 404 归一成「讲师不存在」而不是「加载失败」。
 * - `GET /api/live/channels?lecturerId=` → `success({ list, total, page, pageSize })`,
 *   `list` 是 `live_channels` 裸行;`lecturerName` / `coverImage` 可为 null(表列可空),
 *   渲染时按「未知讲师」兜底,**不得**拿 lecturerId 冒充讲师名。
 *
 * 只经 `@ihui/types` 主入口导出(同 exam / search-history 的口径,不新增子路径)。
 */
import type { TFunction } from './app-shared.js'

/**
 * 讲师列表/详情卡的行形状。
 * 除 `id` / `name` 外都可缺省:`avatar` / `title` / `intro` 是表里的可空列,
 * 没有就是 null(屏上跳过整块,不渲染 "-" 假值)。
 */
export interface LiveLecturerListItem {
  id: string
  name: string
  avatar: string | null
  /** 头衔(web 列表卡片里的小字,详情页的品牌色一行) */
  title: string | null
  /** 简介(web 详情页 `whitespace-pre-line` 保留换行) */
  intro: string | null
  /** 排序权重;后端已排行,端内不重排,仅透传(可选,避免宿主为凑字段而编值) */
  sort?: number
  /** 1=启用;列表端点已过滤,详情端点原样回(可选,同上) */
  status?: number
}

/** 讲师详情页「讲师课程」区的频道行(`live_channels` 裸行,只留渲染所需) */
export interface LiveLecturerChannelItem {
  id: string
  title: string
  coverImage: string | null
  /** 频道行自带的讲师名字段;为 null 时屏上用 `lecturer.unknownLecturer` 兜底 */
  lecturerName: string | null
  isLive: boolean
  /** 观看数(表列 notNull default 0;宿主归一后按 0 兜底) */
  viewCount: number
  intro?: string | null
}

/**
 * 列表屏受控 props。平台无关:取数/导航/登录态全部由 wrapper 注入;
 * 搜索框是屏内 UI 状态(与 web 一致:纯前端过滤 name/title/intro,不重发请求)。
 */
export interface LiveLecturerListScreenProps {
  t: TFunction
  /** 已归一的行(宿主负责 `{ list }` → 数组) */
  items: LiveLecturerListItem[]
  /** 首屏加载中(列表为空时渲染骨架屏,header 保持可见) */
  loading: boolean
  /** 下拉刷新中 */
  refreshing?: boolean
  /** 加载失败文案(空串 = 无错误) */
  error: string
  /** 下拉刷新 / 错误态重试 */
  onRefresh: () => void
  /** 点卡片进详情(导航由宿主给,共享层不碰路由) */
  onSelect: (item: LiveLecturerListItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/**
 * 详情屏受控 props。
 * `lecturer === null` 且 `error === ''` ⇒ 渲染「讲师不存在」(对应后端 404);
 * `error !== ''` ⇒ 渲染错误态 + 重试。两者语义不同,不得合并成一格。
 */
export interface LecturerProfileScreenProps {
  t: TFunction
  lecturer: LiveLecturerListItem | null
  /** 「讲师课程」区;与讲师本体分开加载(web 是两个独立 query) */
  channels: LiveLecturerChannelItem[]
  /** 讲师本体首屏加载中 */
  loading: boolean
  /** 频道区加载中(仅影响课程区,不遮整屏) */
  channelsLoading?: boolean
  /** 讲师本体加载失败文案 */
  error: string
  /** 频道区加载失败文案(空串 = 无错误) */
  channelsError?: string
  onBack: () => void
  /** 讲师本体重试(不存在时也用它重拉) */
  onRetry: () => void
  /** 频道区单独重试;未接线则课程区错误态退化为 onRetry */
  onRetryChannels?: () => void
  /** 打开频道直播页(web `/live/[id]`);未接线则卡片不可点 */
  onOpenChannel?: (item: LiveLecturerChannelItem) => void
  colorScheme?: 'light' | 'dark'
}
