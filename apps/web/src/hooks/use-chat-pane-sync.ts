// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 票60(2026-10-18,步序五):multi-pane 布局树 ⇆ chat-panes 注册表的对齐层。
 *
 * shared/chat/multi-pane(禁碰面)只管布局树;本 hook 在 **web 侧**把两套账对齐:
 * 注册表的 paneId 恒取布局树的**树叶 id**(PaneLeaf.id,与 data-pane-leaf 同源),
 * 树里消失的叶子(关闭/兄弟并占)其 chat store 实例随之回收 —— 不回收则长会话
 * 内存只增不减(chat-panes.ts disposeChatStoreForPane 的既定语义)。
 *
 * 对齐是**单向只回收**:树上有而注册表没有的叶子**不**在此预建实例 —— 注册表是
 * 懒建语义(第一次消费时创建),预建会让空窗格也 hydrate 一份 persist 快照。
 * 消费侧经 ChatPaneProvider + usePaneChatStore 按叶 id 取实例(见 chat-pane-context.tsx)。
 *
 * **挂载(2026-10-25 解禁)**:本 hook 只做实例生命周期对齐,Provider 挂载点在
 * 宿主(ai-side-panel.tsx 的 PaneSplitContainer renderPaneContent:非根窗格
 * paneConversationId 非空时挂 ChatPaneProvider + ChatPaneBody)。早先的挂载门禁
 * ("发送链路窗格化落地前禁挂,防读写不对称")已随步序四发送链全参数化解除 ——
 * send-message/send-answer/斜杠命令/manual-compact/persistence(失败草稿)/
 * mergeAgentTools(工具选择)均按调用方 store 实例寻址,挂 Provider 不再造成
 * "读窗格写单例"的窗格流式回复消失缺陷。
 */

import * as React from 'react'
import { collectPaneLeaves, type PaneNode } from '@ihui/shared/chat/multi-pane'
import { disposeChatStoreForPane } from '@/stores/chat-panes'
// 票60 普查批(2026-10-21):伴生 store 与 chat store 同一生命周期 —— 叶子消失时
// 五座窗格实例一并回收,否则实例表只增不减(与 disposeChatStoreForPane 同一理由)。
// 各 dispose 均按键收窄,不动根单例与 localStorage 快照。
import { disposeAiToolsPanelForPane } from '@/stores/ai-tools-panel'
import { disposeContextMentionForPane } from '@/stores/context-mention'
import { disposeConversationDetailModeForPane } from '@/stores/conversation-detail-mode'
import { disposeModeStoreForPane } from '@/stores/mode'
import { disposeTimelineStoreForPane } from '@/stores/timeline-store'

/** 一个窗格的全部实例回收(chat store + 五座伴生 store),两个回收点共用一份清单 */
function disposePaneInstances(paneId: string): void {
  disposeChatStoreForPane(paneId)
  disposeAiToolsPanelForPane(paneId)
  disposeContextMentionForPane(paneId)
  disposeConversationDetailModeForPane(paneId)
  disposeModeStoreForPane(paneId)
  disposeTimelineStoreForPane(paneId)
}

/** 纯 diff:prev 里有而 next 里没有的叶 id(= 需要回收注册表实例的窗格) */
export function removedPaneIds(
  prev: readonly string[],
  next: readonly string[],
): readonly string[] {
  const alive = new Set(next)
  return prev.filter((id) => !alive.has(id))
}

/** 布局树 → 注册表生命周期对齐(挂载于布局树宿主;树引用变化即对账一次) */
export function useChatPaneSync(tree: PaneNode): void {
  const prevIdsRef = React.useRef<readonly string[]>([])

  React.useEffect(() => {
    const nextIds = collectPaneLeaves(tree).map((leaf) => leaf.id)
    for (const id of removedPaneIds(prevIdsRef.current, nextIds)) {
      disposePaneInstances(id)
    }
    prevIdsRef.current = nextIds
  }, [tree])

  // 宿主卸载 = 整棵树消失:全部回收(只出注册表,persist 快照留在 localStorage,
  // 重开同 id 窗格按既定语义恢复上一会话 —— chat-store-factory.test.ts 已钉)
  React.useEffect(() => {
    return () => {
      for (const id of prevIdsRef.current) disposePaneInstances(id)
    }
  }, [])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
