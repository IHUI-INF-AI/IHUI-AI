// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D38 侧问队列**宿主**(小程序端)—— 队列状态与五个动词的唯一持有者。
 *
 * 为什么单开一个宿主:web 的队列住在 chat store 的 `sideQueueByConversation`,RN 住在
 * ChatScreen 的本地态;小程序既没有 store 层也不该把这一段塞进 1873 行的 chat.tsx。
 * 四个写动词(入队/编辑/撤回/重排)做成**纯函数**再被 hook 包一层 —— 队列演算必须能
 * 脱离 React 单测(否则"重排有没有打乱 W27 出队顺序"只能靠真机点)。
 *
 * **只消费不改(AGENTS §3 共享层优先)**:重排用 `@ihui/shared` 的 `reorderQueue`、
 * 编辑用 `applyQueueEdit`;许可判定用 D69 `queueInteractionPerms` + D38 `interactionAllowed`
 * (在 queue-interaction-bar 里过门),端内**不另立第二套判定** —— 判定一旦分叉,
 * "为什么不能按"的解释就会与真实约束脱节(守门 138 同族)。
 *
 * **W27 纪律**:本模块只写自己的队列数组,不动队首选择语义 —— 出队永远取 `items[0]`,
 * 由调用方(chat.tsx 流结束 effect)决定何时取、取了发给谁。
 */

import { useCallback, useRef, useState } from 'react'
import {
  applyQueueEdit,
  reorderQueue,
  type FollowUpMode,
} from '@ihui/shared/chat/queue-interactions'

/** 队列项(与 web SideQueueItem / RN 本地队列项同形:id/text/createdAt) */
export interface SideQueueItem {
  readonly id: string
  readonly text: string
  readonly createdAt: number
}

/** 入队:trim 后为空 ⇒ 不入队(返回 null,调用方据此不发"已排队"的假反馈) */
export function enqueueItem(
  items: readonly SideQueueItem[],
  text: string,
  idFactory: (seq: number) => string,
  seq: number,
  now: number,
): { items: readonly SideQueueItem[]; item: SideQueueItem | null } {
  const trimmed = text.trim()
  if (!trimmed) return { items, item: null }
  const item: SideQueueItem = { id: idFactory(seq), text: trimmed, createdAt: now }
  return { items: [...items, item], item }
}

/** 编辑:只改目标项 text(经 shared applyQueueEdit,元数据引用不动);空文本 ⇒ 原样返回 */
export function editQueueItem(
  items: readonly SideQueueItem[],
  itemId: string,
  text: string,
): readonly SideQueueItem[] {
  const trimmed = text.trim()
  if (!trimmed) return items
  return [...applyQueueEdit(items, itemId, { text: trimmed })]
}

/** 撤回(= 删除):返回新队列与被撤文本(调用方据此把文本退回输入框,与 RN 同形) */
export function removeQueueItem(
  items: readonly SideQueueItem[],
  itemId: string,
): { items: readonly SideQueueItem[]; removedText: string | null } {
  const target = items.find((q) => q.id === itemId)
  return {
    items: items.filter((q) => q.id !== itemId),
    removedText: target ? target.text : null,
  }
}

/** 重排:先摘后插;越界/同位由 shared reorderQueue 判(返回同一引用) */
export function reorderQueueItems(
  items: readonly SideQueueItem[],
  fromIndex: number,
  toIndex: number,
): readonly SideQueueItem[] {
  return [...reorderQueue(items, fromIndex, toIndex)]
}

/** 出队队首:返回队首与剩余队列;空队列 ⇒ { head: null } 且队列不动 */
export function takeHeadItem(items: readonly SideQueueItem[]): {
  head: SideQueueItem | null
  rest: readonly SideQueueItem[]
} {
  const head = items[0]
  if (!head) return { head: null, rest: items }
  return { head, rest: items.filter((q) => q.id !== head.id) }
}

export interface SideQueueHost {
  /** 当前队列(顺序即排队顺序) */
  readonly items: readonly SideQueueItem[]
  /** 队列模式偏好(steer 插话优先 / queue 排队优先) */
  readonly mode: FollowUpMode
  /** 入队(trim 后的空文本不入队) */
  enqueue: (text: string) => SideQueueItem | null
  /** 编辑:只改目标项文本 */
  edit: (itemId: string, text: string) => void
  /** 撤回:移除目标项并返回它的文本(供调用方退回输入框) */
  remove: (itemId: string) => string | null
  /** 重排:fromIndex → toIndex */
  reorder: (fromIndex: number, toIndex: number) => void
  /** 模式切换(用户偏好恒可切;不支持插话时的降级由 effectiveMode 渲染,不在门里拦) */
  setMode: (mode: FollowUpMode) => void
  /** 出队队首;空队列返回 null(队首选择逻辑不在本模块) */
  takeHead: () => SideQueueItem | null
}

/**
 * 宿主 hook:只做"纯动词 × React 状态"这一层。
 * 队列是本端本地态(无跨会话持久化)—— 会话一结束队列即无意义,持久化反而会把
 * "上一轮没发出去的话"带进下一次进屏(web/RN 的队列同样是会话态)。
 */
export function useSideQueue(): SideQueueHost {
  const [items, setItems] = useState<readonly SideQueueItem[]>([])
  const [mode, setMode] = useState<FollowUpMode>('queue')
  // 序号只在本会话内单调:队列是本地态,不需要全局唯一 id(与 RN 同形)
  const seq = useRef(0)

  // 三个"要拿返回值"的动词都从**渲染闭包的 items** 现算,而不是在 setItems 的 updater 里
  // 偷偷写外部变量:React 18 的 updater 在渲染阶段才跑,setState 返回时它还没执行 ——
  // 靠它回填返回值必然读到 null(那是一条"看起来成功、实际没动"的假路径)。
  const enqueue = useCallback(
    (text: string): SideQueueItem | null => {
      if (!text.trim()) return null
      seq.current += 1
      const next = enqueueItem(items, text, (n) => `sq-${n}`, seq.current, Date.now())
      if (!next.item) return null
      setItems(next.items)
      return next.item
    },
    [items],
  )

  const edit = useCallback((itemId: string, text: string): void => {
    setItems((prev) => editQueueItem(prev, itemId, text))
  }, [])

  const remove = useCallback(
    (itemId: string): string | null => {
      const next = removeQueueItem(items, itemId)
      if (next.removedText === null) return null
      setItems(next.items)
      return next.removedText
    },
    [items],
  )

  const reorder = useCallback((fromIndex: number, toIndex: number): void => {
    setItems((prev) => reorderQueueItems(prev, fromIndex, toIndex))
  }, [])

  const takeHead = useCallback((): SideQueueItem | null => {
    const next = takeHeadItem(items)
    if (!next.head) return null
    setItems(next.rest)
    return next.head
  }, [items])

  return { items, mode, enqueue, edit, remove, reorder, setMode, takeHead }
}
