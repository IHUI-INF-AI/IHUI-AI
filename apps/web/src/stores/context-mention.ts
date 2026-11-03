// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// 多维提及的唯一那份状态(V3 第 61 票,2026-09-27 收口)。
//
// 61 票之前:这里定义了 addMention / setActiveType,但**全仓零调用方** ——
// 于是下面 mentions 恒是空数组,`MentionChips` 的「无提及即返回 null」那条早退永远成立,
// 而 `#` 侧的选择另存在 message-input 的局部 state。即「两个组件各持一份提及状态」。
// 现在 `@` 与 `#` 的选择都落到这一份 store,元素类型是引擎的 MentionSelection,
// 增删的合并语义由 packages/shared/src/chat/mention-engine 的纯函数决定(此处不再算第二遍)。
//
// 票60 普查(2026-10-21):提及草稿按窗格分家 —— 此前是全局单例,而每个非根窗格的
// MessageInput 都挂一份消费面,pane-1 选的 @file 会出现在 pane-2 输入框上方(反向亦然)。
// 形态逐字对齐 stores/ai-tools-panel.ts:工厂 + 根单例原导出名不变(useContextMentionStore
// 既有消费面零改动可回退)+ Map<paneId, 实例> 懒建 + 空 paneId 抛错 + usePaneMentionStore()。

import * as React from 'react'
import { create } from 'zustand'

import {
  dimensionsForSigil,
  withoutSelection,
  withSelection,
  type MentionSelection,
} from '@ihui/shared/chat/mention-engine'
import { useOptionalPaneId } from '@/stores/chat-pane-context'

/** 默认激活维度 = 引擎表里 `@` 侧的第一条(顺序即面板分组顺序,不在端内写死 id) */
const DEFAULT_DIMENSION_ID = dimensionsForSigil('@')[0]?.id ?? ''

interface ContextMentionState {
  /** 已选提及(`@` 与 `#` 同一份;chips 显示在输入框上方) */
  mentions: MentionSelection[]
  /** 当前激活的提及维度 tab(默认 `@` 的文件维度) */
  activeDimensionId: string
  /** 添加提及(去重:同 id 不重复添加) */
  addMention: (mention: MentionSelection) => void
  /** 移除指定提及 */
  removeMention: (id: string) => void
  /** 清空所有提及(发送消息后调用) */
  clearMentions: () => void
  /** 切换激活维度 tab */
  setActiveDimension: (id: string) => void
}

function buildContextMentionStore() {
  return create<ContextMentionState>((set) => ({
    mentions: [],
    activeDimensionId: DEFAULT_DIMENSION_ID,

    addMention: (mention) => set((s) => ({ mentions: withSelection(s.mentions, mention) })),

    removeMention: (id) => set((s) => ({ mentions: withoutSelection(s.mentions, id) })),

    clearMentions: () => set({ mentions: [] }),

    setActiveDimension: (id) => set({ activeDimensionId: id }),
  }))
}

type ContextMentionStore = ReturnType<typeof buildContextMentionStore>

/** 根单例(原导出名、原形态不变;既有消费面零改动可回退) */
export const useContextMentionStore = buildContextMentionStore()

/** paneId → 独立实例;默认单例不进表(与 chat-panes.ts / ai-tools-panel.ts 的注册表同形) */
const paneStores = new Map<string, ContextMentionStore>()

/**
 * 取某窗格的提及草稿实例(懒建 + 复用)。
 * paneId 空/空白直接抛:静默回落单例 = 两窗格共用一份提及草稿,正是本票要消灭的缺陷形态
 * (与 getAiToolsPanelStoreForPane 同一判据)。
 */
export function getContextMentionStoreForPane(paneId: string): ContextMentionStore {
  const key = paneId.trim()
  if (!key) throw new Error('getContextMentionStoreForPane: paneId 不能为空(回落单例 = 窗格间互串)')
  const existing = paneStores.get(key)
  if (existing) return existing
  const created = buildContextMentionStore()
  paneStores.set(key, created)
  return created
}

/** 关闭窗格时回收实例(提及草稿是临时态,不持久化;重开同 paneId 从空草稿开始) */
export function disposeContextMentionForPane(paneId: string): void {
  paneStores.delete(paneId.trim())
}

/** 测试/宿主重置:清空全部窗格实例(默认单例不受影响) */
export function resetContextMentionPaneStores(): void {
  paneStores.clear()
}

/** 当前窗格实例数(测试断言用,不进生产判定) */
export function contextMentionPaneCount(): number {
  return paneStores.size
}

/**
 * 窗格寻址的提及草稿解析 hook(与 usePaneAiToolsPanelStore 同一身份来源 useOptionalPaneId)。
 * - Provider 内:该窗格的独立实例;
 * - 无 Provider:根单例本尊(恒同一引用 ⇒ 既有单窗格消费面零变化)。
 */
export function usePaneMentionStore(): ContextMentionStore {
  const paneId = useOptionalPaneId()
  return React.useMemo(
    () => (paneId === null ? useContextMentionStore : getContextMentionStoreForPane(paneId)),
    [paneId],
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
