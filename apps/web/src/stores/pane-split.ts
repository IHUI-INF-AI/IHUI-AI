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
// **SSR / hydration 纪律(2026-09-24 立,G-935 补持久化后仍成立)**:
// ① 首帧 state **必须**是默认单叶树,不许在初始 state / selector 里读 localStorage;
//    持久化恢复由宿主挂载后调用 `rehydratePaneSplitLayout()` 完成(skipHydration),
//    否则 SSR(messages 单叶)与客户端 hydrate(多叶)不一致即 hydration mismatch。
// ② 初始树 id **必须**是 `ROOT_PANE_ID` 常量而不是自增计数器:服务端与客户端各自
//    维护计数器,首屏 `data-pane-leaf` 两侧不一致就是 hydration mismatch(实测这类
//    bug 只在生产 SSR 暴露,dev 客户端渲染看不出来)。拆分产生的新 id 用计数器即可,
//    因为拆分只会发生在挂载之后。
// ③ 持久化只含 `tree` / `maximizedPaneId`(forkFailures 是渲染态,不进持久层);
//    恢复前必须过结构校验,坏 blob 回落默认单叶树并清键(G-935 缺口B)。

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import {
  type ForkFailureReason,
  ROOT_PANE_ID,
  type PaneLayoutState,
  type PaneNode,
  type PaneSplitDirection,
  closePaneInLayout,
  collectPaneLeaves,
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

/** 布局持久键(只存 tree / maximizedPaneId;G-935 缺口B) */
export const PANE_SPLIT_PERSIST_KEY = 'ihui-pane-split'

const PERSIST_VERSION = 1

const noopPaneStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 持久 blob 的结构校验(纯函数)。
 * 判据:节点形制合法 + id 非空且全树唯一 + split 有 ≥2 子节点且 sizes 同长、均为正、和为 1。
 * 任何一条不满足即整棵树不可信(宁可回落默认单叶,也不拿半截结构画窗格)。
 */
function isPaneNode(value: unknown, seen: Set<string>): value is PaneNode {
  if (!isRecord(value)) return false
  const id = value.id
  if (typeof id !== 'string' || id.trim().length === 0 || seen.has(id)) return false
  if (value.kind === 'leaf') {
    const conversationId = value.conversationId
    if (conversationId !== null && typeof conversationId !== 'string') return false
    seen.add(id)
    return true
  }
  if (value.kind !== 'split') return false
  if (value.direction !== 'right' && value.direction !== 'down') return false
  const { children, sizes } = value
  if (!Array.isArray(children) || children.length < 2) return false
  if (!Array.isArray(sizes) || sizes.length !== children.length) return false
  if (!sizes.every((size) => typeof size === 'number' && Number.isFinite(size) && size > 0))
    return false
  const total = sizes.reduce((sum: number, size: number) => sum + size, 0)
  if (Math.abs(total - 1) > 0.01) return false
  seen.add(id)
  return children.every((child) => isPaneNode(child, seen))
}

/**
 * 解析持久 blob(zustand persist 形态 `{state:{tree,maximizedPaneId},version}`,
 * 也兼容裸 state)。不合法 → null。纯函数:不读 storage、不碰 store,便于单测。
 */
export function parsePaneSplitPersisted(raw: string | null): PaneLayoutState | null {
  if (raw === null || raw.trim() === '') return null
  let blob: unknown
  try {
    blob = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(blob)) return null
  const state = isRecord(blob.state) ? blob.state : blob
  const tree = state.tree
  if (!isPaneNode(tree, new Set())) return null
  const leaves = collectPaneLeaves(tree)
  if (leaves.length === 0) return null
  const leafIds = new Set(leaves.map((leaf) => leaf.id))
  const maximized = state.maximizedPaneId
  return {
    tree,
    maximizedPaneId: typeof maximized === 'string' && leafIds.has(maximized) ? maximized : null,
  }
}

/** 纯解析入口:合法 blob 还原;任何坏数据一律回落默认单叶树(G-935 验收口径) */
export function parsePaneSplitLayout(raw: string | null): PaneLayoutState {
  return parsePaneSplitPersisted(raw) ?? createPaneLayout(null, ROOT_PANE_ID)
}

/** 本页面会话发放过的窗格 id(关格后 id 会离开树;不复用 = 新窗格不继承旧格的持久快照) */
const issuedPaneIds = new Set<string>()

function collectNodeIds(node: PaneNode, out: Set<string>): void {
  out.add(node.id)
  if (node.kind === 'split') {
    for (const child of node.children) collectNodeIds(child, out)
  }
}

/**
 * 取"当前树未用 + 本会话未发放"的最小 `pane-N`(G-935 缺口B 防撞)。
 * 判定层 `generatePaneId()` 的模块计数器 reload 后归零,恢复出的 pane-N 会与新发 id 相撞 ⇒
 * 两窗格共用一份 chat store 实例(chat-panes.ts 按 paneId 键)。真相源不可改,防撞只能在 store 层做。
 */
export function nextFreePaneId(tree: PaneNode): string {
  const taken = new Set<string>(issuedPaneIds)
  collectNodeIds(tree, taken)
  let n = 1
  while (taken.has('pane-' + n)) n += 1
  const id = 'pane-' + n
  issuedPaneIds.add(id)
  return id
}

/**
 * 全树 id 唯一性兜底(后序:叶 id 先登记,split 节点撞已登记 id 才改名)。
 * 判定层 splitPane 给中间 split 节点也用计数器生成 id,同样会撞恢复出的叶 id;
 * 未撞时输出与输入逐字节同形(既有单测零回归)。
 */
export function ensureUniqueNodeIds(tree: PaneNode): PaneNode {
  const taken = new Set<string>()
  collectNodeIds(tree, taken)
  const seen = new Set<string>()
  const visit = (node: PaneNode): PaneNode => {
    if (node.kind === 'leaf') {
      seen.add(node.id)
      return node
    }
    const children = node.children.map(visit)
    if (!seen.has(node.id)) {
      seen.add(node.id)
      return { ...node, children }
    }
    let n = 1
    while (taken.has('pane-' + n) || seen.has('pane-' + n)) n += 1
    const id = 'pane-' + n
    taken.add(id)
    seen.add(id)
    return { ...node, id, children }
  }
  return visit(tree)
}

export const usePaneSplitStore = create<PaneSplitStore>()(
  persist(
    (set) => {
      const initial: PaneLayoutState = createPaneLayout(null, ROOT_PANE_ID)
      return {
        tree: initial.tree,
        maximizedPaneId: null,
        forkFailures: {} as ForkFailures,

        splitPane: (paneId, direction, conversationId = null) =>
          set((state) => {
            // 新叶 id 由 store 层防撞指定;判定层给中间 split 节点自造的 id 再过一遍唯一性兜底
            const next = splitPane(
              state.tree,
              paneId,
              direction,
              conversationId,
              nextFreePaneId(state.tree),
            )
            return next ? { tree: ensureUniqueNodeIds(next) } : state
          }),

        closePane: (paneId) =>
          set((state) => {
            // 布局态一并交给判定层算(关掉最大化的那一格时必须同时清标记,否则悬空)
            const next = closePaneInLayout(
              { tree: state.tree, maximizedPaneId: state.maximizedPaneId },
              paneId,
            )
            if (next.tree === state.tree && next.maximizedPaneId === state.maximizedPaneId)
              return state
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
    },
    {
      name: PANE_SPLIT_PERSIST_KEY,
      version: PERSIST_VERSION,
      // SSR 安全:无 window 时 noop;首帧不读 storage,恢复交给挂载后的 rehydrate
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : noopPaneStorage,
      ),
      skipHydration: true,
      // forkFailures 属渲染态,永不落盘
      partialize: (state) => ({
        tree: state.tree,
        maximizedPaneId: state.maximizedPaneId,
      }),
    },
  ),
)

/**
 * 挂载后恢复布局(G-935 缺口B)。调用点:AISidePanel 的 mount effect(布局宿主,
 * 单叶时 PaneSplitContainer 尚未挂载,不能把恢复放在容器里)。
 * 坏 blob ⇒ 回落默认单叶树并清掉坏键;storage 不可用 ⇒ 静默保持默认(不影响交互)。
 */
export function rehydratePaneSplitLayout(): void {
  if (typeof window === 'undefined') return
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(PANE_SPLIT_PERSIST_KEY)
  } catch {
    return
  }
  if (raw === null) return
  const parsed = parsePaneSplitPersisted(raw)
  if (parsed) {
    // 恢复出的 id 登记为"本会话已发放"——关格后这些 id 也不得被新窗格复用(旧格持久快照会串进来)
    collectNodeIds(parsed.tree, issuedPaneIds)
    usePaneSplitStore.setState(parsed)
    return
  }
  usePaneSplitStore.setState(createPaneLayout(null, ROOT_PANE_ID))
  try {
    window.localStorage.removeItem(PANE_SPLIT_PERSIST_KEY)
  } catch {
    /* storage 不可用:内存已回落默认,清键失败只影响下次启动 */
  }
}

/** 测试/宿主重置布局态(树形纯函数不持有全局态,重置只发生在 store 层;发放台账一并清空) */
export function resetPaneSplitLayout(tree: PaneNode, maximizedPaneId: string | null = null): void {
  issuedPaneIds.clear()
  usePaneSplitStore.setState({ tree, maximizedPaneId, forkFailures: {} })
}
