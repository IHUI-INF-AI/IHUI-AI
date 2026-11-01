// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D75 侧任务生命周期 · web 侧投影单源(2026-11-01 装腿)。
//
// 存在理由:队列条目(`SideQueueItem`)与共享判定层的任务对象(`SideTask`)之间需要一次投影
// 与一次"是否待答"判定。这两件判据**必须只有一份** —— 但它们的主家 `@/stores/chat` 在组件测试里
// 常被整体 mock 掉(见 turn-status-line.test.tsx),把判据放那边会让消费方在测试里拿到 undefined。
// 因此判据住在本模块:store / 卡片宿主 / 状态行三处都 import 同一份,谁 mock 都 mock 不掉判据。
//
// 纪律:本模块**不判过期、不算 TTL、不写状态**。过期与清理一律走
// `@ihui/shared/chat/side-task-lifecycle` 的 isSideTaskExpired / collectExpiredSideTasks。

import type { SideTask, SideTaskRunLocation } from '@ihui/shared/chat/side-task-lifecycle'

/** 侧问队列条目在本模块眼里的最小形状(与 `@/stores/chat` 的 SideQueueItem 字段同源) */
export interface SideQueueItemLike {
  readonly id: string
  readonly text: string
  readonly createdAt: number
  readonly state?: SideTask['state']
  readonly location?: SideTaskRunLocation
}

/** 侧问任务在本端的并行运行位置(单值事实:侧问走单副本 REST 即答,不另开检出) */
export const SIDE_QUESTION_RUN_LOCATION: SideTaskRunLocation = 'sameEnvironment'

/**
 * 队列条目 → 共享 SideTask 投影(渲染卡与过期/清理判定的唯一入参来源)。
 *
 * 三个计数恒 0 是**实测事实**:侧问回答只经 addMessage 落本地消息流
 * (slash-commands.ts 的 meta.sidechat 分支),既不写工作区文件、不起子进程、也不留未落盘产物。
 * `expiresAt` 刻意不填 ⇒ 保留窗口回落到共享默认档 DEFAULT_SIDE_TASK_TTL_MS(端内不重算)。
 */
export function sideTaskFromQueueItem(item: SideQueueItemLike): SideTask {
  return {
    id: item.id,
    title: item.text,
    state: item.state ?? 'running',
    createdAt: item.createdAt,
    location: item.location ?? SIDE_QUESTION_RUN_LOCATION,
    changedFiles: 0,
    unsavedArtifacts: 0,
    runningChildProcesses: 0,
  }
}

/** 尚未产出回答的条目 = 可被补答取用的那一格(无 state 的老快照按待答处理,不臆造已完成) */
export function isPendingSideQueueItem(item: SideQueueItemLike): boolean {
  return (item.state ?? 'running') === 'running'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
