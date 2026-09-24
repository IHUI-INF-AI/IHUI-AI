// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * D45 会话详情聚合档位(2026-09-24 立,G-53)。
 *
 * 三档语义(对标 Codex `conversationDetailMode=STEPS_COMMANDS`,精确 union):
 *   - 'steps'     步骤视图:全部步骤,完整时间线(默认,等价于无过滤)
 *   - 'commands'  命令视图:仅命令执行与文件写入类条目,隐藏叙述性内容
 *   - 'narrative' 叙述视图:只保留叙述性正文,隐藏全部工具/步骤活动条目
 *
 * 与 D21 fold-policy 语义正交:fold 管单个 section 的展开/折叠,
 * 档位管信息聚合粒度(过滤哪些类别的活动条目呈现)。互不覆盖。
 *
 * 同时承载 G-54 ambient suggestions 的整体开关(可关 + 持久化)。
 */
export type ConversationDetailMode = 'steps' | 'commands' | 'narrative'

export const CONVERSATION_DETAIL_MODES: readonly ConversationDetailMode[] = [
  'steps',
  'commands',
  'narrative',
]

interface ConversationDetailModeState {
  /** 当前聚合档位 */
  mode: ConversationDetailMode
  setMode: (mode: ConversationDetailMode) => void
  /** ambient suggestions 建议条整体开关(持久化) */
  suggestionsEnabled: boolean
  setSuggestionsEnabled: (enabled: boolean) => void
}

/** SSR / 无 window 环境下的安全 storage 兜底(与 ai-tools-panel 同模板) */
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

export const useConversationDetailModeStore = create<ConversationDetailModeState>()(
  persist(
    (set) => ({
      mode: 'steps',
      setMode: (mode) => set({ mode }),
      suggestionsEnabled: true,
      setSuggestionsEnabled: (suggestionsEnabled) => set({ suggestionsEnabled }),
    }),
    {
      name: 'ihui-conversation-detail-mode',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : noopStorage,
      ),
      partialize: (s) => ({ mode: s.mode, suggestionsEnabled: s.suggestionsEnabled }),
    },
  ),
)
