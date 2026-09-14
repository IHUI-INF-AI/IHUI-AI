// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​​‌‍‍​‌​​‌​​‌‍‍​‌​​‌​​​‌‍‍​‌​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌​‌​‌​‌‍‍​‌​​​​‌‍‍‌​‌​‌​‌‌‍‍​‌​​​‌‌‌‍‍‌‌​​‌‌​‌‌﻿

'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * AI 工具面板显隐状态(2026-09-14 立)
 *
 * 背景:原「工具面板」独立折叠按钮(ai-tools-toggle)与模式切换器菜单功能重复,
 * 统一由 ModeSwitcher 下拉菜单中的「工具面板」项管理。
 * 状态通过 persist 持久化到 localStorage,刷新页面后保持。
 */
interface AiToolsPanelState {
  /** 工具面板是否展开 */
  open: boolean
  toggle: () => void
  openPanel: () => void
  closePanel: () => void
}

/** SSR / 无 window 环境下的安全 storage 兜底 */
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

export const useAiToolsPanelStore = create<AiToolsPanelState>()(
  persist(
    (set) => ({
      open: false,
      toggle: () => set((s) => ({ open: !s.open })),
      openPanel: () => set({ open: true }),
      closePanel: () => set({ open: false }),
    }),
    {
      name: 'ihui-ai-tools-panel',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : noopStorage,
      ),
      partialize: (s) => ({ open: s.open }),
    },
  ),
)
