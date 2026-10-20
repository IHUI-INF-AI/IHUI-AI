// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useOptionalPaneId } from '@/stores/chat-pane-context'

/**
 * AI 工具面板显隐状态(2026-09-14 立)
 *
 * 背景:原「工具面板」独立折叠按钮(ai-tools-toggle)与模式切换器菜单功能重复,
 * 统一由 ModeSwitcher 下拉菜单中的「工具面板」项管理。
 * 状态通过 persist 持久化到 localStorage,刷新页面后保持。
 *
 * 票60 片3(2026-10-21):open 态按窗格分家 —— 此前全局只有一个键
 * (`ihui-ai-tools-panel`),一个窗格展开会点亮所有窗格。窗格实例走同一份 persist 写法,
 * 只是键含窗格身份(`ihui-ai-tools-panel-<paneId>`,与 chat-panes 的实例注册表同形);
 * 根窗格/Provider 外仍用单例与原键 ⇒ 既有消费面(mode-switcher 等)零回归。
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

/** 根窗格/单窗格的持久化键(历史键,不得改:改了等于把用户既有偏好清掉) */
export const AI_TOOLS_PANEL_STORAGE_KEY = 'ihui-ai-tools-panel'

/** 窗格实例的持久化键前缀(键 = 前缀 + 窗格叶 id) */
export const AI_TOOLS_PANEL_PANE_KEY_PREFIX = `${AI_TOOLS_PANEL_STORAGE_KEY}-`

function buildAiToolsPanelStore(persistName: string) {
  return create<AiToolsPanelState>()(
    persist(
      (set) => ({
        open: false,
        toggle: () => set((s) => ({ open: !s.open })),
        openPanel: () => set({ open: true }),
        closePanel: () => set({ open: false }),
      }),
      {
        name: persistName,
        storage: createJSONStorage(() =>
          typeof window !== 'undefined' ? window.localStorage : noopStorage,
        ),
        partialize: (s) => ({ open: s.open }),
      },
    ),
  )
}

type AiToolsPanelStore = ReturnType<typeof buildAiToolsPanelStore>

/** 根单例(原键、原形态);Provider 外的消费面继续用它 ⇒ 零回归 */
export const useAiToolsPanelStore = buildAiToolsPanelStore(AI_TOOLS_PANEL_STORAGE_KEY)

/** paneId → 独立实例;默认单例不进表(与 chat-panes.ts 的注册表同形) */
const paneStores = new Map<string, AiToolsPanelStore>()

/**
 * 取某窗格的面板展开态实例(懒建 + 复用)。
 * paneId 空/空白直接抛:静默回落单例 = 两窗格共用一份展开态,正是本票要消灭的缺陷形态
 * (与 getChatStoreForPane 同一判据)。
 */
export function getAiToolsPanelStoreForPane(paneId: string): AiToolsPanelStore {
  const key = paneId.trim()
  if (!key) throw new Error('getAiToolsPanelStoreForPane: paneId 不能为空(回落单例 = 窗格间互串)')
  const existing = paneStores.get(key)
  if (existing) return existing
  const created = buildAiToolsPanelStore(`${AI_TOOLS_PANEL_PANE_KEY_PREFIX}${key}`)
  paneStores.set(key, created)
  return created
}

/** 关闭窗格时回收实例(持久化快照留在 localStorage,重开同 paneId 会恢复) */
export function disposeAiToolsPanelForPane(paneId: string): void {
  paneStores.delete(paneId.trim())
}

/** 测试/宿主重置:清空全部窗格实例(默认单例不受影响) */
export function resetAiToolsPanelPaneStores(): void {
  paneStores.clear()
}

/** 当前窗格实例数(测试断言用,不进生产判定) */
export function aiToolsPanelPaneCount(): number {
  return paneStores.size
}

/**
 * 窗格寻址的面板展开态解析 hook(与 usePaneChatStore 同一身份来源 useOptionalPaneId)。
 * - Provider 内:该窗格的独立实例;
 * - 无 Provider:根单例本尊(恒同一引用 ⇒ 既有单窗格消费面零变化)。
 */
export function usePaneAiToolsPanelStore(): AiToolsPanelStore {
  const paneId = useOptionalPaneId()
  return React.useMemo(
    () => (paneId === null ? useAiToolsPanelStore : getAiToolsPanelStoreForPane(paneId)),
    [paneId],
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
