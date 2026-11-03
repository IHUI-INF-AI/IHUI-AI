// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 侧栏会话「批量选择」的选中集唯一真相源(V3 #62 第 62 票)。
//
// 为什么需要一个独立的引擎而不是把 Set 摆在组件里:
// 侧栏的选中集被两处界面消费 —— 行内复选框与底部批量动作条。两处各存一份
// 就会分叉(一处显示"已选 3 项"、另一处复选框只亮 2 个),而批量动作按其中
// 一份发请求,就是"删的不是你勾的那几行"。所以状态只允许有一个持有者:
// SidebarChatHistory 调用本 hook,复选框与动作条都只读同一份 props。
//
// 与 apps/web/src/components/chat/conversation-list.tsx(/chat/history 整页列表)
// 的关系如实登记:那份是并行发展的第二处选中集实现,不在本票可改文件清单内,
// 所以这里没有把两处合并成一份引擎。合并属另一票(把本 hook 上提为共享出口、
// 两处同时改用),登记为未闭环项,不得读成"两端已同源"。

import { useCallback, useMemo, useState } from 'react'

/** 选中集形态:Set 保证「同一会话被勾两次」在结构上不可能,且顺序无关 */
export type ConversationSelection = ReadonlySet<string>

/** 可变形态:仅 hook 内部持有,对外一律以 ConversationSelection 暴露 */
type MutableSelection = Set<string>

/**
 * 勾选/取消单个会话(纯函数,不改动入参)。
 * checked 省略时按"未勾即勾、已勾即取消"取反 —— 复选框受控时传显式值。
 */
export function toggleConversationSelection(
  selected: ConversationSelection,
  id: string,
  checked?: boolean,
): MutableSelection {
  const next: MutableSelection = new Set(selected)
  const shouldSelect = checked ?? !next.has(id)
  if (shouldSelect) next.add(id)
  else next.delete(id)
  return next
}

/** 全选 / 全不选:集合来自"当前可见列表"的顺序数组,不含已被筛掉的项 */
export function selectAllConversationSelection(orderedIds: readonly string[]): MutableSelection {
  return new Set(orderedIds)
}

/** 反选:可见集合内取补集;集合外的历史 id 一并丢弃(与 restrict 同一语义) */
export function invertConversationSelection(
  selected: ConversationSelection,
  orderedIds: readonly string[],
): MutableSelection {
  const next: MutableSelection = new Set()
  for (const id of orderedIds) {
    if (!selected.has(id)) next.add(id)
  }
  return next
}

/**
 * 把选中集裁剪到"当前可见列表"(纯函数)。
 * 为什么必须有这一步:批量删除成功后后端把那几行移除,列表随之变短;若选中集
 * 还留着那些 id,"已选 3 项"会挂在已经不存在的项目上,下一次批量动作就打到
 * 空气里(后端只会回 missedIds,前端却是无声的)。这里在派生层裁,不写回 state,
 * 因此清空关键词恢复完整列表时勾过的项仍在。
 */
export function restrictConversationSelection(
  selected: ConversationSelection,
  orderedIds: readonly string[],
): MutableSelection {
  const visible = new Set(orderedIds)
  const next: MutableSelection = new Set()
  for (const id of orderedIds) {
    if (selected.has(id) && visible.has(id)) next.add(id)
  }
  return next
}

/** hook 对外契约:只暴露只读集合与动作,调用方拿不到可变引用 */
export interface ConversationSelectionApi {
  /** 是否处于多选态(行内复选框与动作条的显示开关) */
  readonly selectionMode: boolean
  /** 当前可见列表中被选中的集合(单一真相源,已裁剪) */
  readonly selectedIds: ConversationSelection
  /** selectedIds.size 的显式投影,省去调用方各算一遍 */
  readonly selectedCount: number
  /** 可见列表非空且全部被选中 */
  readonly allSelected: boolean
  /** 有选中但未全选(复选框的 indeterminate 态) */
  readonly someSelected: boolean
  /** 按列表顺序排好的选中 id(发批量请求用,顺序稳定可读) */
  readonly orderedSelectedIds: readonly string[]
  /** 进入多选态 */
  enterSelectionMode: () => void
  /** 切换多选态(退出时清空选中;这是唯一的出口,不另设 exit —— 见下方注释) */
  toggleSelectionMode: () => void
  /** 勾选/取消某一行 */
  toggleSelected: (id: string, checked?: boolean) => void
  /** 全选(true) / 全不选(false) */
  selectAll: (checked: boolean, orderedIds: readonly string[]) => void
  /** 反选 */
  invert: (orderedIds: readonly string[]) => void
  /** 仅清空选中,保持多选态 */
  clear: () => void
  /** 某行是否被选中 */
  isSelected: (id: string) => boolean
}

/**
 * 侧栏会话多选态与选中集的唯一持有者。
 *
 * @param orderedIds 当前**可见**会话 id 列表(已按搜索/文件夹筛选与置顶排序)。
 *   必须来自渲染层实际展示的那一份,否则"全选"会勾上用户看不见的项。
 */
export function useConversationSelection(orderedIds: readonly string[]): ConversationSelectionApi {
  const [selectionMode, setSelectionMode] = useState(false)
  const [selected, setSelected] = useState<MutableSelection>(() => new Set())

  // 派生而非写回:见 restrictConversationSelection 的说明
  const visibleSelected = useMemo(
    () => restrictConversationSelection(selected, orderedIds),
    [selected, orderedIds],
  )

  const enterSelectionMode = useCallback(() => setSelectionMode(true), [])
  // 唯一的退出路径:退出即清空选中。
  // 刻意不写成 setSelectionMode(prev => { if (prev) setSelected(...); return !prev }) ——
  // state updater 必须是纯函数,在里面再发一次 setState 在 StrictMode 下会跑两遍。
  const toggleSelectionMode = useCallback(() => {
    if (selectionMode) {
      setSelectionMode(false)
      setSelected(new Set())
    } else {
      setSelectionMode(true)
    }
  }, [selectionMode])
  const toggleSelected = useCallback((id: string, checked?: boolean) => {
    setSelected((prev) => toggleConversationSelection(prev, id, checked))
  }, [])
  const selectAll = useCallback(
    (checked: boolean, ids: readonly string[]) =>
      setSelected(checked ? selectAllConversationSelection(ids) : new Set()),
    [],
  )
  const invert = useCallback(
    (ids: readonly string[]) => setSelected((prev) => invertConversationSelection(prev, ids)),
    [],
  )
  const clear = useCallback(() => setSelected(new Set()), [])

  const selectedIds: ConversationSelection = visibleSelected
  const selectedCount = visibleSelected.size
  const allSelected = orderedIds.length > 0 && selectedCount === orderedIds.length
  const someSelected = selectedCount > 0 && !allSelected
  const orderedSelectedIds = useMemo(
    () => orderedIds.filter((id) => visibleSelected.has(id)),
    [orderedIds, visibleSelected],
  )
  const isSelected = useCallback((id: string) => visibleSelected.has(id), [visibleSelected])

  return {
    selectionMode,
    selectedIds,
    selectedCount,
    allSelected,
    someSelected,
    orderedSelectedIds,
    enterSelectionMode,
    toggleSelectionMode,
    toggleSelected,
    selectAll,
    invert,
    clear,
    isSelected,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
