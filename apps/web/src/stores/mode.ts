// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ChatMode } from '@ihui/types'
import * as React from 'react'
import { useOptionalPaneId } from '@/stores/chat-pane-context'
import { paneIdForChatStore, type ChatStore } from '@/stores/chat-panes'

/**
 * 对话模式 store(2026-07-22 立,对标 自研 IDE Plan/Spec 双模式)。
 *
 * 五态(对齐 CLI apps/cli/src/tui/mode-manager.ts 的 WorkMode,扩展 spec;2026-09-13 #24 补 ask):
 * - ask:    纯问答(禁工具,ai-service 注入 Ask Mode 引导并跳过 tool loop)
 * - build:  正常执行(默认,全工具开放)
 * - plan:   只读分析(deny write 工具:edit_file/write_file/bash 等)
 * - review: 只读审查(deny write 工具 + 强化代码审查 prompt)
 * - spec:   从代码反向生成 spec 文档
 *
 * currentMode 持久化到 localStorage(key: ihui-mode),刷新页面保留。
 *
 * 票60 普查批(2026-10-21):按窗格分家 —— 此前全局一个键,pane-1 切模式会把根窗格
 * 一起切走(且发送链读到的 mode 与用户在本窗格看到的档不一致)。窗格实例同一份 persist
 * 写法、键含窗格身份(`ihui-mode-<paneId>`);根窗格/Provider 外仍用单例与原键
 * `ihui-mode` ⇒ 既有消费面(全局快捷键/命令面板/AI 面板)零回归。
 * 非 React 面(发送链)手里只有 chatStore ⇒ 走 getModeStoreForChatStore 反查,
 * 根单例 chatStore 查得 null ⇒ 回落根单例,与 useOptionalPaneId 同一条回落判据。
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

export const MODE_STORAGE_KEY = 'ihui-mode'

export const MODE_PANE_KEY_PREFIX = `${MODE_STORAGE_KEY}-`

function buildModeStore(persistName: string) {
  return create<ModeState>()(
    persist(
      (set) => ({
        currentMode: 'build',

        setMode: (currentMode) => set({ currentMode }),
      }),
      {
        name: persistName,
        storage: createJSONStorage(() =>
          typeof window !== 'undefined' ? window.localStorage : noopStorage,
        ),
        // 仅持久化 currentMode(setMode 是函数,由 store 自动重建)
        partialize: (state) => ({ currentMode: state.currentMode }),
      },
    ),
  )
}

export type ModeStore = ReturnType<typeof buildModeStore>

/** 根单例(原键 `ihui-mode`、原形态);Provider 外与非 React 全局面继续用它 ⇒ 零回归 */
export const useModeStore = buildModeStore(MODE_STORAGE_KEY)

/** paneId → 独立实例;默认单例不进表(与 chat-panes / ai-tools-panel 的注册表同形) */
const paneModeStores = new Map<string, ModeStore>()

/**
 * 取某窗格的模式实例(懒建 + 复用)。
 * paneId 空/空白直接抛:静默回落单例 = 两窗格共用一份模式档,正是本批要消灭的互串形态
 * (与 getChatStoreForPane / getAiToolsPanelStoreForPane 同一判据)。
 */
export function getModeStoreForPane(paneId: string): ModeStore {
  const key = paneId.trim()
  if (!key) throw new Error('getModeStoreForPane: paneId 不能为空(回落单例 = 窗格间互串)')
  const existing = paneModeStores.get(key)
  if (existing) return existing
  const created = buildModeStore(`${MODE_PANE_KEY_PREFIX}${key}`)
  paneModeStores.set(key, created)
  return created
}

/**
 * 发送链等非 React 面的寻址:按 chatStore 反查 paneId 取窗格实例;
 * 根单例 chatStore(或未登记实例)⇒ null ⇒ 回落根单例(与 useOptionalPaneId 同判据)。
 */
export function getModeStoreForChatStore(chatStore: ChatStore): ModeStore {
  const paneId = paneIdForChatStore(chatStore)
  return paneId === null ? useModeStore : getModeStoreForPane(paneId)
}

/** 关闭窗格时回收实例(persist 快照留在 localStorage,重开同 paneId 会恢复) */
export function disposeModeStoreForPane(paneId: string): void {
  paneModeStores.delete(paneId.trim())
}

/** 测试/宿主重置:清空全部窗格实例(默认单例不受影响) */
export function resetModePaneStores(): void {
  paneModeStores.clear()
}

/**
 * 窗格寻址的模式解析 hook(与 usePaneAiToolsPanelStore 同一身份来源 useOptionalPaneId):
 * Provider 内 = 该窗格的独立实例;无 Provider = 根单例本尊(恒同一引用 ⇒ 单窗格形态逐字不变)。
 */
export function usePaneModeStore(): ModeStore {
  const paneId = useOptionalPaneId()
  return React.useMemo(
    () => (paneId === null ? useModeStore : getModeStoreForPane(paneId)),
    [paneId],
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
