// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D73 多任务窗格判定层(G-100,2026-09-24 立)
//
// **自证结论(改本文件前先读)**:
//   · 当前会话完全由 `useChatStore.conversationId` 单例驱动,AISidePanel 是全局
//     docked 组件(GlobalShell flex 流内挂载),**没有**任何多窗格会话承载;
//   · D22 已建 `application/x-ihui-conversation` 拖拽通道(sidebar-chat-history
//     dragstart 写 `{id,title}` JSON,message-input drop 消费),但只用于"拖入输入框
//     作引用",**没有**"拖入窗格承载会话"的落点;
//   · Fork(把会话在第二窗格打开/复制一份)失败时没有任何统一文案判定。
// 因此本票的真实缺口是:**窗格树没有真相源**,拆分/并占/联动调整全靠现场手写。
//
// 本模块是多任务窗格的**唯一真相源**,与 D71 `turn-status` / D72 `worktree-lifecycle`
// 同范式:常量 + 树形纯函数 + 穷尽 switch 零 default + `assertNever`。
// 端内不得再建第二套窗格树判定(禁止在组件里手写拆分/并占逻辑)。
//
// **禁止新建第二套会话承载(与 D52/D68 协同)**:
// 本模块只管**布局树**(哪个窗格占多少、放哪个会话 id),不管会话消息流本身;
// 每个窗格的会话承载由宿主把既有会话渲染件(如 AISidePanel 的内容委托)传进来,
// 组件层不得自建第二套消息流状态。

/** 拆分方向(向右 = 纵列两个窗格;向下 = 横排两个窗格) */
export const PANE_SPLIT_DIRECTIONS = ['right', 'down'] as const
export type PaneSplitDirection = (typeof PANE_SPLIT_DIRECTIONS)[number]

/** 排布轴向('x' = 沿横轴切分,'y' = 沿纵轴切分);组件据此选坐标/游标,禁止自写方向判定 */
export const PANE_SPLIT_AXES = ['x', 'y'] as const
export type PaneSplitAxis = (typeof PANE_SPLIT_AXES)[number]

/** 方向 → 轴(穷尽 switch 零 default;新增方向漏配 case 由 assertNeverAxis 编译拦截) */
export function paneSplitAxis(direction: PaneSplitDirection): PaneSplitAxis {
  switch (direction) {
    case 'right':
      return 'x'
    case 'down':
      return 'y'
  }
  return assertNeverAxis(direction)
}

/** 窗格最小份额(占父节点总面积的比例);联动调整时低于此值不再压缩 */
export const MIN_PANE_SIZE = 0.15

/** 键盘微调步长(份额制,与指针拖拽同一量纲);端内不得另写第二个数值 */
export const PANE_RESIZE_STEP = 0.05

/** 各轴生效的按键与方向(Record 键为 PaneSplitAxis ⇒ 编译期强制穷尽两轴) */
export const PANE_RESIZE_KEY_SIGN: Record<PaneSplitAxis, Readonly<Record<string, 1 | -1>>> = {
  x: { ArrowLeft: -1, ArrowRight: 1 },
  y: { ArrowUp: -1, ArrowDown: 1 },
}

/** 键 → 份额增量(0 表示该键在本向无意义,组件据此决定拦截与否) */
export function paneResizeKeyDelta(direction: PaneSplitDirection, key: string): number {
  return (PANE_RESIZE_KEY_SIGN[paneSplitAxis(direction)][key] ?? 0) * PANE_RESIZE_STEP
}

/** 词包命名空间(web 侧 `useTranslations('ai.pane.multiPane')`) */
export const PANE_MULTI_NAMESPACE = 'ai.pane.multiPane' as const

/** D22 会话拖拽通道(与 sidebar-chat-history / message-input 保持同一键名) */
export const PANE_CONVERSATION_DRAG_TYPE = 'application/x-ihui-conversation'

/**
 * 根窗格固定 id(SSR 纪律,2026-09-24 补)。
 * 初始布局树**必须**用这个常量而不是自增计数器:服务端与客户端各自维护
 * `paneIdCounter`,首屏 id 必然不同 ⇒ `data-pane-leaf` 两侧不一致 ⇒ hydration mismatch。
 * 后续交互(拆分)产生的 id 用 `generatePaneId()` 即可 —— 那只会发生在挂载之后。
 */
export const ROOT_PANE_ID = 'pane-root'

/** 叶子窗格:承载一个会话;conversationId 为 null 即"空窗格"(可从侧栏拖入) */
export interface PaneLeaf {
  readonly kind: 'leaf'
  readonly id: string
  readonly conversationId: string | null
}

/** 拆分节点:按 direction 排布 children;sizes 与 children 等长、归一化后总和为 1 */
export interface PaneSplitNode {
  readonly kind: 'split'
  readonly id: string
  readonly direction: PaneSplitDirection
  readonly children: readonly PaneNode[]
  readonly sizes: readonly number[]
}

export type PaneNode = PaneLeaf | PaneSplitNode

/** 布局态:窗格树 + 最大化窗格(最大化不污染树本身,还原即置空) */
export interface PaneLayoutState {
  readonly tree: PaneNode
  readonly maximizedPaneId: string | null
}

/** Fork 失败原因(conversationMissing / capacityFull 必判,unknown 兜底) */
export const FORK_FAILURE_REASONS = ['conversationMissing', 'capacityFull', 'unknown'] as const
export type ForkFailureReason = (typeof FORK_FAILURE_REASONS)[number]

/** 语义色档(判定层只给语义,具体样式由渲染件决定) */
export const FORK_FAILURE_TONES = ['neutral', 'warning', 'danger'] as const
export type ForkFailureTone = (typeof FORK_FAILURE_TONES)[number]

export interface ForkFailureView {
  readonly reason: ForkFailureReason
  readonly tone: ForkFailureTone
  /** `ai.pane.multiPane` 内的文案键 */
  readonly titleKey: string
  /** 是否给"重试"入口 */
  readonly retryable: boolean
}

let paneIdCounter = 0

/** 窗格 id 键名生成器(测试可注入固定前缀场景由调用方自拼) */
export function generatePaneId(): string {
  paneIdCounter += 1
  return 'pane-' + paneIdCounter
}

/** 建一棵单窗格树(conversationId 传 null 即空窗格;id 可注入,初始布局必须注入 ROOT_PANE_ID) */
export function createPaneTree(
  conversationId: string | null = null,
  id: string = generatePaneId(),
): PaneLeaf {
  return { kind: 'leaf', id, conversationId }
}

/** 建一个布局态(单窗格 + 未最大化;rootPaneId 同上,SSR 两侧须一致) */
export function createPaneLayout(
  conversationId: string | null = null,
  rootPaneId: string = generatePaneId(),
): PaneLayoutState {
  return { tree: createPaneTree(conversationId, rootPaneId), maximizedPaneId: null }
}

export function isPaneLeaf(node: PaneNode): node is PaneLeaf {
  return node.kind === 'leaf'
}

/** 按 id 找窗格(叶或拆分节点均可命中) */
export function findPane(tree: PaneNode, paneId: string): PaneNode | null {
  if (tree.id === paneId) return tree
  if (tree.kind === 'split') {
    for (const child of tree.children) {
      const hit = findPane(child, paneId)
      if (hit) return hit
    }
  }
  return null
}

/** 展开全部叶子窗格(渲染层按序画) */
export function collectPaneLeaves(tree: PaneNode): readonly PaneLeaf[] {
  if (tree.kind === 'leaf') return [tree]
  return tree.children.flatMap(collectPaneLeaves)
}

/**
 * 拆分:把目标叶子窗格按 direction 一分为二,原会话留在原位,新窗格承载 newConversationId
 * (传 null 即拆出一个空窗格)。目标不存在 / 不是叶子 → 返回 null。
 * newPaneId 由调用方预生成(便于拆完立即聚焦新窗格)。
 */
export function splitPane(
  tree: PaneNode,
  paneId: string,
  direction: PaneSplitDirection,
  newConversationId: string | null,
  newPaneId: string = generatePaneId(),
): PaneNode | null {
  const target = findPane(tree, paneId)
  if (!target || target.kind !== 'leaf') return null

  const visit = (node: PaneNode): PaneNode => {
    if (node.kind === 'leaf') {
      if (node.id !== paneId) return node
      return {
        kind: 'split',
        id: generatePaneId(),
        direction,
        children: [node, { kind: 'leaf', id: newPaneId, conversationId: newConversationId }],
        sizes: [0.5, 0.5],
      }
    }
    return { ...node, children: node.children.map(visit) }
  }
  return visit(tree)
}

/**
 * 关闭:被关窗格的面积归还相邻 —— 兄弟只剩一个时整体上提并占(100% 吸收),
 * 多兄弟时按剩余份额归一化吸收。根叶子(最后一格)不可关,原树原样返回。
 */
export function closePane(tree: PaneNode, paneId: string): PaneNode {
  if (tree.kind === 'leaf') return tree

  const visit = (node: PaneSplitNode): PaneNode => {
    const index = node.children.findIndex((child) => child.id === paneId)
    if (index >= 0) {
      const removedSize = node.sizes[index]
      const children = node.children.filter((_, i) => i !== index)
      const only = children[0]
      if (children.length === 1 && only) return only
      // sizes 与 children 同长是建树不变式;取不到即视为不变返回原树,不猜一个份额
      if (removedSize === undefined) return node
      const sizes = node.sizes.filter((_, i) => i !== index).map((size) => size / (1 - removedSize))
      return { ...node, children, sizes }
    }
    let changed = false
    const children = node.children.map((child) => {
      if (child.kind !== 'split') return child
      const next = visit(child)
      if (next !== child) changed = true
      return next
    })
    return changed ? { ...node, children } : node
  }
  return visit(tree)
}

/**
 * 关闭可达性:根叶子(只剩最后一格)不可关 —— 渲染层据此**隐藏**关闭钮,
 * 免得留一个点了没反应的死控件(closePane 自身也幂等兜底,但 UI 不该骗人)。
 */
export function canClosePane(tree: PaneNode): boolean {
  return tree.kind === 'split'
}

/**
 * 关闭(布局态版):除树之外还必须处理"被关窗格正处于最大化"这一情况 ——
 * 否则 maximizedPaneId 悬空指向已不存在的窗格,渲染层按它找不到叶子会白屏。
 * 端内不得自己拼这两个字段(与 closePane 同一真相源)。
 */
export function closePaneInLayout(state: PaneLayoutState, paneId: string): PaneLayoutState {
  const tree = closePane(state.tree, paneId)
  const maximizedPaneId = state.maximizedPaneId === paneId ? null : state.maximizedPaneId
  if (tree === state.tree && maximizedPaneId === state.maximizedPaneId) return state
  return { tree, maximizedPaneId }
}

/** 最大化:只记 id,不动树;目标不存在或不是叶子 → 视为未最大化 */
export function maximizePane(state: PaneLayoutState, paneId: string): PaneLayoutState {
  const target = findPane(state.tree, paneId)
  return { ...state, maximizedPaneId: target && target.kind === 'leaf' ? paneId : null }
}

/** 还原:清掉最大化标记,树保持原样(最大化从不改树) */
export function restorePanes(state: PaneLayoutState): PaneLayoutState {
  return { ...state, maximizedPaneId: null }
}

/**
 * 联动调整:delta > 0 扩大目标窗格,由相邻窗格(优先右/下兄弟,末位则左/上兄弟)
 * 等量吸收;两侧各自钳制在 MIN_PANE_SIZE 之上,**父子两级总面积守恒**。
 * 目标不存在 / 无相邻 / 根叶子 → 原树原样返回。
 */
export function resizePanes(tree: PaneNode, paneId: string, delta: number): PaneNode {
  if (tree.kind === 'leaf') return tree

  const index = tree.children.findIndex((child) => child.id === paneId)
  if (index >= 0) {
    const siblingIndex = index + 1 < tree.children.length ? index + 1 : index - 1
    if (siblingIndex < 0) return tree
    const sizes = [...tree.sizes]
    const own = sizes[index]
    const adjacent = sizes[siblingIndex]
    // 份额数组与 children 同长是建树不变式;取不到就不动,绝不按 0 兜底(会把那格压没)
    if (own === undefined || adjacent === undefined) return tree
    const pairTotal = own + adjacent
    const clamped = Math.min(Math.max(own + delta, MIN_PANE_SIZE), pairTotal - MIN_PANE_SIZE)
    sizes[index] = clamped
    sizes[siblingIndex] = pairTotal - clamped
    return { ...tree, sizes }
  }
  let changed = false
  const children = tree.children.map((child) => {
    if (child.kind !== 'split') return child
    const next = resizePanes(child, paneId, delta)
    if (next !== child) changed = true
    return next
  })
  return changed ? { ...tree, children } : tree
}

/**
 * 拖入判定:只有**空窗格**(叶子且无会话 id)才接受侧栏拖入;
 * 已承载会话的窗格不接受(避免把正在跑的会话顶掉)。
 */
export function canDropToPane(pane: PaneNode): boolean {
  return pane.kind === 'leaf' && pane.conversationId === null
}

/** 拖入落格:目标必须是空窗格;不满足(不存在 / 非空 / 非叶)→ 返回 null */
export function dropConversationToPane(
  tree: PaneNode,
  paneId: string,
  conversationId: string,
): PaneNode | null {
  const target = findPane(tree, paneId)
  if (!target || !canDropToPane(target)) return null

  const visit = (node: PaneNode): PaneNode => {
    if (node.kind === 'leaf') {
      return node.id === paneId ? { ...node, conversationId } : node
    }
    return { ...node, children: node.children.map(visit) }
  }
  return visit(tree)
}

/** Fork 失败视图判定:穷尽 switch 零 default;新增 reason 未补 case 时 `assertNeverReason` 编译拦截 */
export function forkFailureView(reason: ForkFailureReason): ForkFailureView {
  switch (reason) {
    case 'conversationMissing':
      return {
        reason,
        tone: 'danger',
        titleKey: 'forkFailure.conversationMissing',
        retryable: false,
      }
    case 'capacityFull':
      return { reason, tone: 'warning', titleKey: 'forkFailure.capacityFull', retryable: true }
    case 'unknown':
      return { reason, tone: 'neutral', titleKey: 'forkFailure.unknown', retryable: true }
  }
  assertNeverReason(reason)
}

function assertNeverReason(reason: never): never {
  throw new Error('unhandled fork failure reason: ' + String(reason))
}

function assertNeverAxis(axis: never): never {
  throw new Error('unhandled pane split direction: ' + String(axis))
}
