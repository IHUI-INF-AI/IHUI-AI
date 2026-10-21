// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useOptionalPaneId } from '@/stores/chat-pane-context'

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
 *
 * 票60 普查批(2026-10-21):按窗格分家。实现里存的两样 —— mode(消息列表的
 * 显示档位偏好,不随会话恢复、状态里没有任何 conversationId)与 suggestionsEnabled
 * (建议条显隐偏好)—— 都是**显示偏好**而非会话数据,故按台账判据走"能按窗格寻址的"
 * 一侧:根单例/原键不动(既有消费面零回归),非根窗格各自一份实例(键含窗格身份)。
 * 此前是全局单值 ⇒ pane-1 切档位会把根窗格的消息渲染档位一起改掉,双窗格互顶。
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

/** 根窗格/单窗格的持久化键(历史键,不得改:改了等于把用户既有偏好清掉) */
export const CONVERSATION_DETAIL_MODE_STORAGE_KEY = 'ihui-conversation-detail-mode'

/** 窗格实例的持久化键前缀(键 = 前缀 + 窗格叶 id) */
export const CONVERSATION_DETAIL_MODE_PANE_KEY_PREFIX = `${CONVERSATION_DETAIL_MODE_STORAGE_KEY}-`

function buildConversationDetailModeStore(persistName: string) {
  return create<ConversationDetailModeState>()(
    persist(
      (set) => ({
        mode: 'steps',
        setMode: (mode) => set({ mode }),
        suggestionsEnabled: true,
        setSuggestionsEnabled: (suggestionsEnabled) => set({ suggestionsEnabled }),
      }),
      {
        name: persistName,
        storage: createJSONStorage(() =>
          typeof window !== 'undefined' ? window.localStorage : noopStorage,
        ),
        partialize: (s) => ({ mode: s.mode, suggestionsEnabled: s.suggestionsEnabled }),
      },
    ),
  )
}

type ConversationDetailModeStore = ReturnType<typeof buildConversationDetailModeStore>

/** 根单例(原键、原形态);Provider 外的消费面继续用它 ⇒ 零回归 */
export const useConversationDetailModeStore = buildConversationDetailModeStore(
  CONVERSATION_DETAIL_MODE_STORAGE_KEY,
)

/** paneId → 独立实例;默认单例不进表(与 chat-panes.ts / ai-tools-panel.ts 的注册表同形) */
const paneStores = new Map<string, ConversationDetailModeStore>()

/**
 * 取某窗格的档位实例(懒建 + 复用)。
 * paneId 空/空白直接抛:静默回落单例 = 两窗格共用一份档位,正是本票要消灭的缺陷形态
 * (与 getAiToolsPanelStoreForPane 同一判据)。
 */
export function getConversationDetailModeStoreForPane(paneId: string): ConversationDetailModeStore {
  const key = paneId.trim()
  if (!key)
    throw new Error('getConversationDetailModeStoreForPane: paneId 不能为空(回落单例 = 窗格间互串)')
  const existing = paneStores.get(key)
  if (existing) return existing
  const created = buildConversationDetailModeStore(
    `${CONVERSATION_DETAIL_MODE_PANE_KEY_PREFIX}${key}`,
  )
  paneStores.set(key, created)
  return created
}

/** 关闭窗格时回收实例(持久化快照留在 localStorage,重开同 paneId 会恢复) */
export function disposeConversationDetailModeForPane(paneId: string): void {
  paneStores.delete(paneId.trim())
}

/** 测试/宿主重置:清空全部窗格实例(默认单例不受影响) */
export function resetConversationDetailModePaneStores(): void {
  paneStores.clear()
}

/** 当前窗格实例数(测试断言用,不进生产判定) */
export function conversationDetailModePaneCount(): number {
  return paneStores.size
}

/**
 * 窗格寻址的档位解析 hook(与 usePaneAiToolsPanelStore 同一身份来源 useOptionalPaneId)。
 * - Provider 内:该窗格的独立实例;
 * - 无 Provider:根单例本尊(恒同一引用 ⇒ 既有单窗格消费面零变化)。
 */
export function usePaneConversationDetailModeStore(): ConversationDetailModeStore {
  const paneId = useOptionalPaneId()
  return React.useMemo(
    () =>
      paneId === null
        ? useConversationDetailModeStore
        : getConversationDetailModeStoreForPane(paneId),
    [paneId],
  )
}
