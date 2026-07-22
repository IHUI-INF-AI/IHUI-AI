import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ChatMode } from '@ihui/types'

/**
 * 对话模式 store(2026-07-22 立,对标 Trae IDE Plan/Spec 双模式)。
 *
 * 四态(对齐 CLI apps/cli/src/tui/mode-manager.ts 的 WorkMode,扩展 spec):
 * - build:  正常执行(默认,全工具开放)
 * - plan:   只读分析(deny write 工具:edit_file/write_file/bash 等)
 * - review: 只读审查(deny write 工具 + 强化代码审查 prompt)
 * - spec:   从代码反向生成 spec 文档
 *
 * currentMode 持久化到 localStorage(key: ihui-mode),刷新页面保留。
 */

interface ModeState {
  /** 当前模式 */
  currentMode: ChatMode
  /** 设置当前模式 */
  setMode: (mode: ChatMode) => void
}

/** SSR 安全的 localStorage 替代存储 */
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

export const useModeStore = create<ModeState>()(
  persist(
    (set) => ({
      currentMode: 'build',

      setMode: (currentMode) => set({ currentMode }),
    }),
    {
      name: 'ihui-mode',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : noopStorage,
      ),
      // 仅持久化 currentMode(setMode 是函数,由 store 自动重建)
      partialize: (state) => ({ currentMode: state.currentMode }),
    },
  ),
)
