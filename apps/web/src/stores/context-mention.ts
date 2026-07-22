import { create } from 'zustand'

import type { ContextMention, MentionType } from '@ihui/types'

interface ContextMentionState {
  /** 已选提及列表(chips 显示在输入框上方) */
  mentions: ContextMention[]
  /** 当前激活的提及类型 tab(默认 file) */
  activeType: MentionType
  /** 添加提及(去重:同 id 不重复添加) */
  addMention: (mention: ContextMention) => void
  /** 移除指定提及 */
  removeMention: (id: string) => void
  /** 清空所有提及(发送消息后调用) */
  clearMentions: () => void
  /** 切换激活类型 tab */
  setActiveType: (type: MentionType) => void
}

export const useContextMentionStore = create<ContextMentionState>((set) => ({
  mentions: [],
  activeType: 'file',

  addMention: (mention) =>
    set((s) => {
      if (s.mentions.some((m) => m.id === mention.id)) return s
      return { mentions: [...s.mentions, mention] }
    }),

  removeMention: (id) =>
    set((s) => ({
      mentions: s.mentions.filter((m) => m.id !== id),
    })),

  clearMentions: () => set({ mentions: [] }),

  setActiveType: (type) => set({ activeType: type }),
}))
