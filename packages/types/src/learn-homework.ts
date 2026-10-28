// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 课程作业屏的形状单源(web `/learn/[id]/homework` ↔ RN `CourseHomework`)。
 *
 * 2026-10-28 立:web 有课程作业页(列表 + 提交),RN 侧此前只有 `LearnReviewScreen`
 * —— 那是 **SRS 间隔重复复习**(`/api/srs-review/*`),数据源与交互都不是同一物,
 * 不能拿复习屏顶作业屏。这里把两侧共用的行形状与受控 props 收成一份,共享屏
 * `packages/app/src/features/learn-homework/CourseHomeworkScreen.tsx` 直取。
 *
 * ⚠️ 端点现状(读 apps/api/src/routes/edu-frontend-routes.ts:724-761 实测):
 * - `GET /api/learn/:id/homework` 回 `success({ list, total })`,**`list` 是
 *   `learn_homework` 表的裸行**(id/lessonId/chapterId/title/description/content/
 *   dueDate/sort/status/createdAt/updatedAt),既无 `deadline` / `endTime`,
 *   也无任何**按人**的 `submitted` —— web 页读的 `deadline`、`endTime`、`submitted`
 *   与「0/1/2/3 数字状态」在这条端点上恒为 undefined,是既有的假字段。
 * - `POST /api/learn/:id/homework/:hwId/submit` 的 body 是
 *   `{ url: string(1..3000) }`(edu-frontend-routes.ts:100),**不传 url 必 400**;
 *   web 页 `apiOrThrow(url, { method: 'POST' })` 裸着发 ⇒ 该按钮在 web 侧本就打不通。
 *   故 RN 侧必须把「作答链接」做成显式输入,而不是照抄一个只会失败的按钮。
 *
 * 因此本文件的 `dueDate` 用后端真名,`submitted` 声明为「宿主知道才给」的三态:
 * `true` / `false` 才渲染徽标,`undefined` 就不渲染 —— 不拿「未提交」冒充未知。
 */
import type { TFunction } from './app-shared.js'

/**
 * 作业行。`id` / `title` 来自后端必有列,其余缺失即留空。
 */
export interface CourseHomeworkItem {
  id: string
  title: string
  /** 作业说明(后端 `description`,可空) */
  description?: string | null
  /** 截止时间 ISO 串(后端 `dueDate`;不是 `deadline` / `endTime`) */
  dueDate?: string | null
  /** 作业自身的发布状态(draft / published),非提交状态 */
  status?: string | null
  /**
   * 当前用户是否已提交。后端列表**不返回**该信息 ⇒ 未知时传 undefined,
   * 只有宿主确实知道(例如本次会话内提交成功)才给布尔值。
   */
  submitted?: boolean | null
}

/**
 * CourseHomeworkScreen 受控 props 契约。
 * 平台无关:取数、提交、登录态、导航全部由 wrapper 注入;颜色走 colorScheme 语义 token。
 */
export interface CourseHomeworkScreenProps {
  t: TFunction
  /** 作业列表;空数组 + 非 loading 且无 error ⇒ 渲染「暂无作业」 */
  items: CourseHomeworkItem[]
  /** 首屏加载中(整屏骨架) */
  loading: boolean
  /** 加载失败文案(非空渲染错误态 + 重试) */
  error: string
  /** 当前展开作答的作业 id;`null` = 全部收起 */
  selectedId: string | null
  /** 作答链接输入草稿(即提交 body 的 `url`) */
  answerUrl: string
  /** 正在提交的作业 id;`null` = 无提交进行中 */
  submittingId: string | null
  /** 提交失败文案(空串不渲染) */
  submitError: string
  /** 点作业卡:展开/收起作答区(由宿主做 toggle 并清空草稿) */
  onSelect: (id: string) => void
  /** 作答链接输入 */
  onChangeAnswer: (text: string) => void
  /** 提交选中作业 */
  onSubmit: (id: string) => void
  /** 顶部返回 */
  onBack: () => void
  /** 错误态重试 */
  onRetry: () => void
  colorScheme?: 'light' | 'dark'
}
