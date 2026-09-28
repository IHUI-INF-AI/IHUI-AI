// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// 多维提及的唯一那份状态(V3 第 61 票,2026-09-27 收口)。
//
// 61 票之前:这里定义了 addMention / setActiveType,但**全仓零调用方** ——
// 于是下面 mentions 恒是空数组,`MentionChips` 的「无提及即返回 null」那条早退永远成立,
// 而 `#` 侧的选择另存在 message-input 的局部 state。即「两个组件各持一份提及状态」。
// 现在 `@` 与 `#` 的选择都落到这一份 store,元素类型是引擎的 MentionSelection,
// 增删的合并语义由 packages/shared/src/chat/mention-engine 的纯函数决定(此处不再算第二遍)。

import { create } from 'zustand'

import {
  dimensionsForSigil,
  withoutSelection,
  withSelection,
  type MentionSelection,
} from '@ihui/shared/chat/mention-engine'

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

export const useContextMentionStore = create<ContextMentionState>((set) => ({
  mentions: [],
  activeDimensionId: DEFAULT_DIMENSION_ID,

  addMention: (mention) => set((s) => ({ mentions: withSelection(s.mentions, mention) })),

  removeMention: (id) => set((s) => ({ mentions: withoutSelection(s.mentions, id) })),

  clearMentions: () => set({ mentions: [] }),

  setActiveDimension: (id) => set({ activeDimensionId: id }),
}))
