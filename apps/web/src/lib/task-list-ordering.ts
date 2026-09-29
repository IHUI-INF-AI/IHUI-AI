// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 任务列表 running-first 稳定排序(2026-09-30 立,吸收批次 74 W1 票 G-977978)。
 *
 * 机制(吸收自上游任务列表两层排序):
 *  - 两层结构:运行任务整体置顶,非运行任务再服从用户的时间偏好键;
 *  - 运行层只按 createdAt 降序稳定排序,**禁止以 updatedAt(含次级)决胜**——
 *    并发运行的任务会随流式/工具事件交替刷新 updatedAt,运行层一旦读 updatedAt,
 *    每个事件都会让两行互换位置;taskId 是不随事件变化的稳定 tie-break;
 *  - 运行层成员口径(回合在跑 + 挂后台工作的任务)由 isActive 回调注入,
 *    本模块只管排序结构,不绑具体活动字段。
 */

export type TaskRowSortKey = 'created-at' | 'updated-at'

export interface TaskListSortableRow {
  taskId: string
  createdAt: number
  updatedAt: number
}

export interface TaskRowSortContext<T> {
  /** 用户时间偏好:created-at / updated-at(只作用于非运行层) */
  sortKey: TaskRowSortKey
  /** 运行层成员判定:回合在跑或挂后台工作的任务都应返回 true */
  isActive: (row: T) => boolean
}

/** 比较器约定:负数 = left 排在 right 前 */
export function compareTaskRows<T extends TaskListSortableRow>(
  left: T,
  right: T,
  ctx: TaskRowSortContext<T>,
): number {
  const leftActive = ctx.isActive(left)
  const rightActive = ctx.isActive(right)

  // 运行层整体置顶
  if (leftActive !== rightActive) {
    return leftActive ? -1 : 1
  }

  if (leftActive) {
    // 运行层:只按 createdAt 降序 + taskId 稳定决胜。
    // 判据:updatedAt 完全不参与(含次级)——并发运行任务交替 touch updatedAt 时,
    // 排序输出必须逐字节不变。
    if (right.createdAt !== left.createdAt) {
      return right.createdAt - left.createdAt
    }
    return right.taskId.localeCompare(left.taskId)
  }

  // 非运行层:服从用户时间偏好键;静态行没有流式刷新,updatedAt 作次级不会引发抖动
  if (ctx.sortKey === 'created-at') {
    if (right.createdAt !== left.createdAt) {
      return right.createdAt - left.createdAt
    }
    if (right.updatedAt !== left.updatedAt) {
      return right.updatedAt - left.updatedAt
    }
    return right.taskId.localeCompare(left.taskId)
  }

  if (right.updatedAt !== left.updatedAt) {
    return right.updatedAt - left.updatedAt
  }
  if (right.createdAt !== left.createdAt) {
    return right.createdAt - left.createdAt
  }
  return right.taskId.localeCompare(left.taskId)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
