// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D73 多任务窗格布局 store(G-100,2026-09-24 立)
//
// **只管布局,不管会话**:树形结构与全部树操作纯函数都在
// `@ihui/shared/chat/multi-pane`(唯一真相源),本 store 只是把它接进 React 生命周期。
// 禁止在这里出现消息流 / 会话消息状态(不建第二套会话承载,与 D52/D68 协同;
// 每个窗格的会话内容由宿主经 PaneSplitContainer 的 render 委托复用既有承载件)。
//
// **SSR / hydration 纪律(2026-09-24 核对结论,本 store 现状即合规)**:
// ① 不做任何持久化 —— 全文件零 `window` / `localStorage` 读取,render 期自然安全;
//    跨刷新恢复窗格布局不属 D73 范围(要先定"刷新后哪个会话落在哪个窗格"的语义),
//    将来接入必须走"挂载后 hydrate"或 `useSyncExternalStore` 的服务端快照,禁止在
//    selector 里读 storage。
// ② 初始树 id **必须**是 `ROOT_PANE_ID` 常量而不是自增计数器:服务端与客户端各自
//    维护计数器,首屏 `data-pane-leaf` 两侧不一致就是 hydration mismatch(实测这类
//     bug 只在生产 SSR 暴露,dev 客户端渲染看不出来)。拆分产生的新 id 用计数器即可,
//    因为拆分只会发生在挂载之后。

import { create } from 'zustand'

import {
  type ForkFailureReason,
  ROOT_PANE_ID,
  type PaneLayoutState,
  type PaneNode,
  type PaneSplitDirection,
  closePaneInLayout,
  createPaneLayout,
  dropConversationToPane,
  maximizePane,
  resizePanes,
  restorePanes,
  splitPane,
} from '@ihui/shared/chat/multi-pane'

interface PaneSplitStore extends PaneLayoutState {
  /** Fork 失败标记表(paneId → reason);属渲染态,不进 PaneLayoutState */
  readonly forkFailures: ForkFailures
  /** 拆分:新窗格为空(等侧栏拖入)或直接承载指定会话 */
  splitPane: (paneId: string, direction: PaneSplitDirection, conversationId?: string | null) => void
  /** 关闭窗格(兄弟并占;最后一格不可关) */
  closePane: (paneId: string) => void
  /** 最大化窗格 */
  maximizePane: (paneId: string) => void
  /** 还原全部窗格 */
  restorePanes: () => void
  /** 联动调整:delta>0 扩大该窗格,相邻窗格等量吸收(判定层钳制) */
  resizePanes: (paneId: string, delta: number) => void
  /** 空窗格落格:把侧栏拖入的会话承载到该窗格 */
  dropConversation: (paneId: string, conversationId: string) => void
  /** 记录某窗格的 Fork 失败原因(容器渲染 forkFailureView) */
  setForkFailure: (paneId: string, reason: ForkFailureReason) => void
  /** 清除 Fork 失败标记(重试成功 / 用户关闭提示) */
  clearForkFailure: (paneId: string) => void
}

/** Fork 失败标记表(paneId → reason);不在 PaneLayoutState 里,属渲染态 */
type ForkFailures = Record<string, ForkFailureReason>

export const usePaneSplitStore = create<PaneSplitStore>((set) => {
  const initial: PaneLayoutState = createPaneLayout(null, ROOT_PANE_ID)
  return {
    tree: initial.tree,
    maximizedPaneId: null,
    forkFailures: {} as ForkFailures,

    splitPane: (paneId, direction, conversationId = null) =>
      set((state) => {
        const next = splitPane(state.tree, paneId, direction, conversationId)
        return next ? { tree: next } : state
      }),

    closePane: (paneId) =>
      set((state) => {
        // 布局态一并交给判定层算(关掉最大化的那一格时必须同时清标记,否则悬空)
        const next = closePaneInLayout(
          { tree: state.tree, maximizedPaneId: state.maximizedPaneId },
          paneId,
        )
        if (next.tree === state.tree && next.maximizedPaneId === state.maximizedPaneId) return state
        // 被关窗格的 Fork 失败标记一并清掉
        const forkFailures = { ...state.forkFailures }
        delete forkFailures[paneId]
        return { tree: next.tree, maximizedPaneId: next.maximizedPaneId, forkFailures }
      }),

    maximizePane: (paneId) =>
      set((state) => {
        const next = maximizePane(
          { tree: state.tree, maximizedPaneId: state.maximizedPaneId },
          paneId,
        )
        return { maximizedPaneId: next.maximizedPaneId }
      }),

    restorePanes: () =>
      set((state) => ({
        // 还原规则也在判定层(restorePanes 只清标记不动树),端内不重写
        maximizedPaneId: restorePanes({
          tree: state.tree,
          maximizedPaneId: state.maximizedPaneId,
        }).maximizedPaneId,
      })),

    resizePanes: (paneId, delta) =>
      set((state) => {
        const next = resizePanes(state.tree, paneId, delta)
        return next === state.tree ? state : { tree: next }
      }),

    dropConversation: (paneId, conversationId) =>
      set((state) => {
        const next = dropConversationToPane(state.tree, paneId, conversationId)
        if (!next) return state
        const forkFailures = { ...state.forkFailures }
        delete forkFailures[paneId]
        return { tree: next, forkFailures }
      }),

    setForkFailure: (paneId, reason) =>
      set((state) => ({ forkFailures: { ...state.forkFailures, [paneId]: reason } })),

    clearForkFailure: (paneId) =>
      set((state) => {
        const forkFailures = { ...state.forkFailures }
        delete forkFailures[paneId]
        return { forkFailures }
      }),
  }
})

/** 测试/宿主重置布局态(树形纯函数不持有全局态,重置只发生在 store 层) */
export function resetPaneSplitLayout(tree: PaneNode, maximizedPaneId: string | null = null): void {
  usePaneSplitStore.setState({ tree, maximizedPaneId, forkFailures: {} })
}
