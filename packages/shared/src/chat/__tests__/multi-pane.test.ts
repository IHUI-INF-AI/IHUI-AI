// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  FORK_FAILURE_REASONS,
  MIN_PANE_SIZE,
  PANE_CONVERSATION_DRAG_TYPE,
  PANE_RESIZE_STEP,
  PANE_SPLIT_DIRECTIONS,
  ROOT_PANE_ID,
  canClosePane,
  canDropToPane,
  closePane,
  closePaneInLayout,
  collectPaneLeaves,
  createPaneLayout,
  createPaneTree,
  dropConversationToPane,
  findPane,
  forkFailureView,
  maximizePane,
  type PaneNode,
  paneResizeKeyDelta,
  paneSplitAxis,
  resizePanes,
  restorePanes,
  splitPane,
} from '../multi-pane'

/** 建一棵两级树:根 split(right) 下挂 leafA / leafB,可继续嵌套 */
function buildTwoLeafTree() {
  const root = createPaneTree('conv-a')
  const leafA = root
  const split = splitPane(root, leafA.id, 'right', 'conv-b', 'pane-b')
  if (!split || split.kind !== 'split') throw new Error('split failed')
  const leafB = split.children[1]
  if (leafB?.kind !== 'leaf') throw new Error('split failed: 右子不是叶窗格')
  return { root: split, leafA, leafB }
}

/** 相邻两窗格份额之和(sizes 与 children 等长是建树不变式;取不到即 setup 失败,不猜份额) */
function pairSum(sizes: readonly number[]): number {
  const [first, second] = sizes
  if (first === undefined || second === undefined) {
    throw new Error('setup failed: sizes 长度不足 2')
  }
  return first + second
}

describe('D73 splitPane / 拆分', () => {
  it('向右拆分:原叶变成 split(right),原会话留在原位,新窗格承载新会话,均分 0.5/0.5', () => {
    const root = createPaneTree('conv-a')
    const next = splitPane(root, root.id, 'right', 'conv-b', 'pane-b')
    expect(next).not.toBeNull()
    if (!next || next.kind !== 'split') return
    expect(next.direction).toBe('right')
    expect(next.sizes).toEqual([0.5, 0.5])
    expect(next.children[0]).toMatchObject({ kind: 'leaf', id: root.id, conversationId: 'conv-a' })
    expect(next.children[1]).toMatchObject({ kind: 'leaf', id: 'pane-b', conversationId: 'conv-b' })
  })

  it('向下拆分:direction=down,两叶并占', () => {
    const root = createPaneTree(null)
    const next = splitPane(root, root.id, 'down', null, 'pane-empty')
    if (!next || next.kind !== 'split') return
    expect(next.direction).toBe('down')
    expect(next.children[1]).toMatchObject({ kind: 'leaf', id: 'pane-empty', conversationId: null })
  })

  it('嵌套拆分:对 split 内的叶子继续拆,不影响兄弟子树', () => {
    const { root, leafB } = buildTwoLeafTree()
    const next = splitPane(root, leafB.id, 'down', 'conv-c', 'pane-c')
    if (!next || next.kind !== 'split') return
    // 根仍是 right split,children[1] 变成 down split
    expect(next.direction).toBe('right')
    const inner = next.children[1]
    expect(inner?.kind).toBe('split')
    if (inner?.kind !== 'split') return
    expect(inner.direction).toBe('down')
    expect(collectPaneLeaves(next).map((l) => l.conversationId)).toEqual([
      'conv-a',
      'conv-b',
      'conv-c',
    ])
  })

  it('目标不存在 / 目标是拆分节点 → 返回 null(不炸)', () => {
    const { root } = buildTwoLeafTree()
    expect(splitPane(root, 'nope', 'right', null)).toBeNull()
    expect(splitPane(root, root.id, 'right', null)).toBeNull()
  })

  it('不可变:拆分不改原树', () => {
    const root = createPaneTree('conv-a')
    const before = JSON.stringify(root)
    splitPane(root, root.id, 'right', 'conv-b', 'pane-b')
    expect(JSON.stringify(root)).toBe(before)
  })
})

describe('D73 closePane / 关闭并占', () => {
  it('双叶关一叶:兄弟整体上提并占(面积 100% 归还相邻)', () => {
    const { root, leafA, leafB } = buildTwoLeafTree()
    const next = closePane(root, leafB.id)
    expect(next.kind).toBe('leaf')
    if (next.kind !== 'leaf') return
    expect(next.id).toBe(leafA.id)
    expect(next.conversationId).toBe('conv-a')
  })

  it('关闭另一侧同样并占(留下的是兄弟)', () => {
    const { root, leafA, leafB } = buildTwoLeafTree()
    expect(leafA.kind).toBe('leaf')
    const next = closePane(root, leafA.id)
    expect(next.kind).toBe('leaf')
    if (next.kind !== 'leaf') return
    expect(next.id).toBe(leafB.id)
  })

  it('三叶关一叶:剩余兄弟按份额归一化吸收(总面积守恒)', () => {
    // 直接构造单层三子拆分节点,覆盖"多兄弟归一化吸收"路径(双叶场景走上提)
    const three = {
      kind: 'split' as const,
      id: 'root3',
      direction: 'right' as const,
      children: [
        { kind: 'leaf' as const, id: 'leaf-a', conversationId: 'conv-a' },
        { kind: 'leaf' as const, id: 'pane-c', conversationId: 'conv-c' },
        { kind: 'leaf' as const, id: 'leaf-b', conversationId: 'conv-b' },
      ],
      sizes: [0.25, 0.25, 0.5],
    }
    // 三叶:conv-a(0.25) / conv-c(0.25) / conv-b(0.5);关掉 conv-c
    const next = closePane(three, 'pane-c')
    if (next.kind !== 'split') return
    expect(next.children.map((c) => c.id)).toEqual(['leaf-a', 'leaf-b'])
    expect(pairSum(next.sizes)).toBeCloseTo(1, 10)
    expect(next.sizes[0]).toBeCloseTo(0.25 / 0.75, 10)
    expect(next.sizes[1]).toBeCloseTo(0.5 / 0.75, 10)
  })

  it('根叶子(最后一格)不可关,原样返回', () => {
    const root = createPaneTree('conv-a')
    expect(closePane(root, root.id)).toBe(root)
  })

  it('关闭不存在的窗格:原样返回', () => {
    const { root } = buildTwoLeafTree()
    expect(closePane(root, 'nope')).toBe(root)
  })
})

describe('D73 maximizePane / restorePanes / 最大化还原', () => {
  it('最大化只记 id 不动树;还原置空', () => {
    const { root, leafB } = buildTwoLeafTree()
    const before = JSON.stringify(root)
    const maxed = maximizePane({ tree: root, maximizedPaneId: null }, leafB.id)
    expect(maxed.maximizedPaneId).toBe(leafB.id)
    expect(JSON.stringify(maxed.tree)).toBe(before)
    const restored = restorePanes(maxed)
    expect(restored.maximizedPaneId).toBeNull()
    expect(JSON.stringify(restored.tree)).toBe(before)
  })

  it('最大化不存在的 id / 拆分节点 → 视为未最大化(null)', () => {
    const { root } = buildTwoLeafTree()
    expect(maximizePane({ tree: root, maximizedPaneId: null }, 'nope').maximizedPaneId).toBeNull()
    expect(maximizePane({ tree: root, maximizedPaneId: null }, root.id).maximizedPaneId).toBeNull()
  })
})

describe('D73 resizePanes / 联动调整相邻窗格', () => {
  it('扩大目标:相邻窗格等量压缩,两级总面积守恒', () => {
    const { root, leafA } = buildTwoLeafTree()
    const next = resizePanes(root, leafA.id, 0.1)
    if (next.kind !== 'split') return
    expect(next.sizes[0]).toBeCloseTo(0.6, 10)
    expect(next.sizes[1]).toBeCloseTo(0.4, 10)
    expect(pairSum(next.sizes)).toBeCloseTo(1, 10)
  })

  it('末位窗格扩大时由前一位(左/上)兄弟吸收', () => {
    const { root, leafB } = buildTwoLeafTree()
    const next = resizePanes(root, leafB.id, 0.2)
    if (next.kind !== 'split') return
    expect(next.sizes[0]).toBeCloseTo(0.3, 10)
    expect(next.sizes[1]).toBeCloseTo(0.7, 10)
  })

  it('钳制:低于 MIN_PANE_SIZE 不再压缩,且钳掉的量不丢失(相邻补齐,守恒)', () => {
    const { root, leafA } = buildTwoLeafTree()
    // 目标 0.5 - 0.9 = -0.4 → 钳到 MIN
    const next = resizePanes(root, leafA.id, -0.9)
    if (next.kind !== 'split') return
    expect(next.sizes[0]).toBeCloseTo(MIN_PANE_SIZE, 10)
    expect(next.sizes[1]).toBeCloseTo(1 - MIN_PANE_SIZE, 10)
    // 反向:相邻被钳到 MIN,目标吃满剩余
    const back = resizePanes(next, leafA.id, 0.9)
    if (back.kind !== 'split') return
    expect(back.sizes[0]).toBeCloseTo(1 - MIN_PANE_SIZE, 10)
    expect(back.sizes[1]).toBeCloseTo(MIN_PANE_SIZE, 10)
  })

  it('嵌套:深层叶子的 resize 只动它所在父级的份额,祖父级守恒', () => {
    const { root, leafB } = buildTwoLeafTree()
    const nested = splitPane(root, leafB.id, 'down', 'conv-c', 'pane-c')
    if (!nested || nested.kind !== 'split') return
    const inner = nested.children[1]
    if (inner?.kind !== 'split') return
    const innerLast = inner.children[1]
    if (!innerLast) throw new Error('setup failed: 内层 split 缺少第二个子窗格')
    const next = resizePanes(nested, innerLast.id, 0.1)
    if (next.kind !== 'split') return
    // 祖父级份额不动
    expect(next.sizes).toEqual(nested.sizes)
    const nextInner = next.children[1]
    if (nextInner?.kind !== 'split') return
    expect(pairSum(nextInner.sizes)).toBeCloseTo(1, 10)
    expect(nextInner.sizes[1]).toBeCloseTo(0.6, 10)
  })

  it('根叶子 / 不存在的 id:原样返回', () => {
    const root = createPaneTree('conv-a')
    expect(resizePanes(root, root.id, 0.1)).toBe(root)
    const { root: two } = buildTwoLeafTree()
    expect(resizePanes(two, 'nope', 0.1)).toBe(two)
  })
})

describe('D73 拖入判定(canDropToPane / dropConversationToPane)', () => {
  it('空窗格(叶子无会话)才接受拖入;已承载 / 拆分节点不接受', () => {
    const empty = createPaneTree(null)
    const full = createPaneTree('conv-a')
    const { root } = buildTwoLeafTree()
    expect(canDropToPane(empty)).toBe(true)
    expect(canDropToPane(full)).toBe(false)
    expect(canDropToPane(root)).toBe(false)
  })

  it('dropConversationToPane:空窗格落格成功,会话 id 写入', () => {
    const root = createPaneTree(null)
    const next = dropConversationToPane(root, root.id, 'conv-x')
    expect(next).not.toBeNull()
    if (!next || next.kind !== 'leaf') return
    expect(next.conversationId).toBe('conv-x')
  })

  it('非空窗格 / 不存在的窗格 → 返回 null(拒绝)', () => {
    const full = createPaneTree('conv-a')
    expect(dropConversationToPane(full, full.id, 'conv-x')).toBeNull()
    // 造一棵「右叶为空」的树:拆分根,右叶 conversationId=null
    const base = createPaneTree('conv-a')
    const withEmpty = splitPane(base, base.id, 'right', null, 'pane-empty')
    if (!withEmpty || withEmpty.kind !== 'split') throw new Error('setup failed')
    expect(dropConversationToPane(withEmpty, 'pane-empty', 'conv-x')).not.toBeNull()
    expect(dropConversationToPane(withEmpty, 'nope', 'conv-x')).toBeNull()
  })

  it('D22 通道键名与侧栏 dragstart 一致(application/x-ihui-conversation)', () => {
    expect(PANE_CONVERSATION_DRAG_TYPE).toBe('application/x-ihui-conversation')
  })
})

describe('D73 forkFailureView / Fork 失败穷尽判定', () => {
  it('三态逐个判定,零 default 穷尽:各占独立 case,文案键各不相同', () => {
    const views = FORK_FAILURE_REASONS.map((reason) => forkFailureView(reason))
    const keys = new Set(views.map((v) => v.titleKey))
    expect(keys.size).toBe(FORK_FAILURE_REASONS.length)
    expect(views.map((v) => v.reason)).toEqual(['conversationMissing', 'capacityFull', 'unknown'])
  })

  it('conversationMissing:danger,不给重试(会话没了,重试无意义)', () => {
    const view = forkFailureView('conversationMissing')
    expect(view.tone).toBe('danger')
    expect(view.titleKey).toBe('forkFailure.conversationMissing')
    expect(view.retryable).toBe(false)
  })

  it('capacityFull:warning,给重试', () => {
    const view = forkFailureView('capacityFull')
    expect(view.tone).toBe('warning')
    expect(view.titleKey).toBe('forkFailure.capacityFull')
    expect(view.retryable).toBe(true)
  })

  it('unknown:neutral 兜底,给重试', () => {
    const view = forkFailureView('unknown')
    expect(view.tone).toBe('neutral')
    expect(view.retryable).toBe(true)
  })

  it('方向常量与最小份额自证', () => {
    expect(PANE_SPLIT_DIRECTIONS).toEqual(['right', 'down'])
    expect(MIN_PANE_SIZE).toBeGreaterThan(0)
    expect(MIN_PANE_SIZE).toBeLessThan(0.5)
  })

  it('createPaneLayout 自证:单窗格 + 未最大化', () => {
    const layout = createPaneLayout('conv-a')
    expect(layout.maximizedPaneId).toBeNull()
    expect(findPane(layout.tree, layout.tree.id)).not.toBeNull()
  })
})

describe('D73 SSR 纪律 / 初始布局 id 必须两侧一致', () => {
  it('注入 ROOT_PANE_ID 后两次建布局树逐字相同(服务端与客户端首屏同构)', () => {
    const a = createPaneLayout(null, ROOT_PANE_ID)
    const b = createPaneLayout(null, ROOT_PANE_ID)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(a.tree.id).toBe(ROOT_PANE_ID)
  })

  it('不注入 id 时才走自增计数器(仅挂载后交互路径可用)', () => {
    const first = createPaneLayout(null)
    const second = createPaneLayout(null)
    expect(first.tree.id).not.toBe(second.tree.id)
  })

  it('canClosePane:根叶子不可关,拆分树可关', () => {
    const single = createPaneTree('conv-a')
    const { root } = buildTwoLeafTree()
    expect(canClosePane(single)).toBe(false)
    expect(canClosePane(root)).toBe(true)
  })

  it('closePaneInLayout:关掉正在最大化的窗格时一并清 maximizedPaneId(不留悬空 id)', () => {
    const { root, leafA, leafB } = buildTwoLeafTree()
    const maxed = maximizePane({ tree: root, maximizedPaneId: null }, leafB.id)
    const next = closePaneInLayout(maxed, leafB.id)
    expect(next.maximizedPaneId).toBeNull()
    expect(next.tree.kind).toBe('leaf')
    expect(next.tree.id).toBe(leafA.id)
  })

  it('closePaneInLayout:关无关窗格不动最大化标记;最后一格不可关时整态原样返回', () => {
    const { root, leafA, leafB } = buildTwoLeafTree()
    const maxed = maximizePane({ tree: root, maximizedPaneId: null }, leafA.id)
    expect(closePaneInLayout(maxed, leafB.id).maximizedPaneId).toBe(leafA.id)
    const single = createPaneLayout('conv-a', ROOT_PANE_ID)
    expect(closePaneInLayout(single, single.tree.id)).toBe(single)
  })
})

describe('D73 轴向与键盘步长判定(端内不得自写第二套)', () => {
  it('方向 → 轴:向右拆沿横轴、向下拆沿纵轴', () => {
    expect(paneSplitAxis('right')).toBe('x')
    expect(paneSplitAxis('down')).toBe('y')
  })

  it('键盘增量:本向键给 ±PANE_RESIZE_STEP,异向键给 0(组件据此不拦截)', () => {
    expect(paneResizeKeyDelta('right', 'ArrowRight')).toBeCloseTo(PANE_RESIZE_STEP, 10)
    expect(paneResizeKeyDelta('right', 'ArrowLeft')).toBeCloseTo(-PANE_RESIZE_STEP, 10)
    expect(paneResizeKeyDelta('down', 'ArrowDown')).toBeCloseTo(PANE_RESIZE_STEP, 10)
    expect(paneResizeKeyDelta('down', 'ArrowUp')).toBeCloseTo(-PANE_RESIZE_STEP, 10)
    // 纵排窗格不接受横向键(否则分隔条方向与键向错配)
    expect(paneResizeKeyDelta('right', 'ArrowUp')).toBe(0)
    expect(paneResizeKeyDelta('down', 'ArrowLeft')).toBe(0)
    expect(paneResizeKeyDelta('down', 'Enter')).toBe(0)
  })

  it('键盘连按同向不会击穿 MIN_PANE_SIZE(钳制在判定层,组件只发增量)', () => {
    const { root, leafA } = buildTwoLeafTree()
    let tree: PaneNode = root
    for (let i = 0; i < 20; i += 1) tree = resizePanes(tree, leafA.id, -PANE_RESIZE_STEP)
    if (tree.kind !== 'split') throw new Error('setup failed')
    expect(tree.sizes[0]).toBeCloseTo(MIN_PANE_SIZE, 10)
    expect(pairSum(tree.sizes)).toBeCloseTo(1, 10)
  })
})
