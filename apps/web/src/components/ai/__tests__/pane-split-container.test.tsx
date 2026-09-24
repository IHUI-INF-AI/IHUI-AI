// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D73 多任务窗格分屏容器用例(G-100,2026-09-24)
//
// **自证结论**:本文件是 PaneSplitContainer 的**唯一消费点**(宿主挂载由主 agent
// 按 .ihui-agent/tmp/d73-mount/README.md 落),覆盖 D73 验收三用例(拆分 / 拖入 /
// Fork 失败),外加"联动调整相邻窗格"与最大化还原往返。
// 纪律:组件层零判定逻辑 ⇒ 份额、叶数、钳制一律回到判定层算出来的值上断言,
// 不在用例里复制第二套树算法。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  FORK_FAILURE_REASONS,
  MIN_PANE_SIZE,
  PANE_MULTI_NAMESPACE,
  PANE_RESIZE_STEP,
  ROOT_PANE_ID,
  type PaneNode,
  type PaneSplitDirection,
  type PaneSplitNode,
  collectPaneLeaves,
  createPaneLayout,
  forkFailureView,
  splitPane,
} from '@ihui/shared/chat/multi-pane'

import {
  PANE_DROP_CONVERSATION_TYPE,
  PANE_FORK_FAILURE_KEYS,
  PaneSplitContainer,
} from '../pane-split-container'
import { resetPaneSplitLayout, usePaneSplitStore } from '@/stores/pane-split'

// 文案键原样回显(mock 语义:渲染出的文本 == 键名),据此可断言"组件确实在问判定层给的键"
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

/** 叶子的会话 id(非叶 → null);判"没落格"用 null,不用 && 短路表达式(leaf+null 会返回 null 而非 false) */
function conversationOf(node: PaneNode): string | null {
  return node.kind === 'leaf' ? node.conversationId : null
}

/** 取当前树(拆分节点形态),断言份额/叶数一律用它,不在用例里重算 */
function currentSplit(): PaneSplitNode {
  const tree = usePaneSplitStore.getState().tree
  if (tree.kind !== 'split') throw new Error('期望 split 树,实际为 ' + tree.kind)
  return tree
}

/** 建两格布局:根格 pane-root + 新格 pane-b,两格都是空窗格(等拖入) */
function mountTwoPanes(direction: PaneSplitDirection = 'right') {
  const single = createPaneLayout(null, ROOT_PANE_ID).tree
  const tree = splitPane(single, ROOT_PANE_ID, direction, null, 'pane-b')
  if (!tree) throw new Error('setup: split failed')
  resetPaneSplitLayout(tree)
  return tree
}

const leafEl = (paneId: string) => document.querySelector(`[data-pane-leaf="${paneId}"]`)
const emptyEl = (paneId: string) =>
  document.querySelector(`[data-pane-leaf="${paneId}"] [data-pane-empty]`)
const resizerEl = (paneId: string) => document.querySelector(`[data-pane-resizer-for="${paneId}"]`)
const actionEl = (name: string, index = 0) =>
  document.querySelectorAll(`[data-action="${name}"]`)[index]

/** 拖拽载荷:与 D22 sidebar-chat-history dragstart 同形态({id,title} JSON) */
function transferFor(payload: string | null, type = PANE_DROP_CONVERSATION_TYPE) {
  return {
    types: payload === null ? ['text/plain'] : [type],
    getData: (t: string) => (payload !== null && t === type ? payload : ''),
    dropEffect: 'copy',
  }
}

function dropOn(paneId: string, payload: string | null, type?: string) {
  const target = emptyEl(paneId)
  if (!target) throw new Error('drop 落点不存在(窗格非空?)')
  fireEvent.drop(target, { dataTransfer: transferFor(payload, type) })
}

beforeEach(() => {
  resetPaneSplitLayout(createPaneLayout(null, ROOT_PANE_ID).tree)
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

describe('D73 初始态与空窗格', () => {
  it('单窗格首屏:一个空窗格 + 占位文案 + 不渲染关闭钮(closable=false)', () => {
    render(<PaneSplitContainer />)
    expect(document.querySelectorAll('[data-pane-leaf]')).toHaveLength(1)
    expect(leafEl(ROOT_PANE_ID)).not.toBeUndefined()
    expect(emptyEl(ROOT_PANE_ID)).not.toBeNull()
    expect(document.querySelector('[data-pane-empty-placeholder]')?.textContent).toBe(
      'emptyPlaceholder',
    )
    expect(document.querySelector('[data-action="close"]')).toBeNull()
  })

  it('词包命名空间与判定层常量逐字同源(组件里写死的字面量不得漂移)', () => {
    expect(PANE_MULTI_NAMESPACE).toBe('ai.pane.multiPane')
  })

  it('SSR 纪律:首屏静态渲染两次逐字相同且带 ROOT_PANE_ID(两侧同构 ⇒ 无水合失配)', () => {
    const a = renderToStaticMarkup(<PaneSplitContainer />)
    const b = renderToStaticMarkup(<PaneSplitContainer />)
    expect(a).toBe(b)
    expect(a).toContain(`data-pane-leaf="${ROOT_PANE_ID}"`)
  })
})

describe('D73 拆分 / 叶数与份额', () => {
  it('向右拆:叶数 2、direction=right、初始份额均分且守恒 1', () => {
    mountTwoPanes('right')
    render(<PaneSplitContainer />)
    expect(document.querySelectorAll('[data-pane-leaf]')).toHaveLength(2)
    expect(
      document.querySelector('[data-pane-split-root]')?.getAttribute('data-pane-leaf-count'),
    ).toBe('2')
    expect(
      document.querySelector('[data-pane-direction]')?.getAttribute('data-pane-direction'),
    ).toBe('right')
    const tree = currentSplit()
    expect(tree.sizes).toEqual([0.5, 0.5])
    expect(tree.sizes.reduce((s, n) => s + n, 0)).toBeCloseTo(1, 10)
    expect(tree.children.map((c) => c.id)).toEqual([ROOT_PANE_ID, 'pane-b'])
  })

  it('向下拆:direction=down,分隔条走纵轴', () => {
    mountTwoPanes('down')
    render(<PaneSplitContainer />)
    expect(
      document.querySelector('[data-pane-direction]')?.getAttribute('data-pane-direction'),
    ).toBe('down')
    expect(resizerEl(ROOT_PANE_ID)?.getAttribute('data-pane-resizer-axis')).toBe('y')
  })

  it('拆分钮作用在**被点的那个**窗格上(嵌套拆不丢兄弟)', () => {
    mountTwoPanes('right')
    render(<PaneSplitContainer />)
    fireEvent.click(actionEl('splitDown')!)
    const tree = currentSplit()
    expect(collectPaneLeaves(tree)).toHaveLength(3)
    // 兄弟 pane-b 原样保留(拆分只就地替换被点的那一叶)
    expect(tree.children[1].id).toBe('pane-b')
    // 被点的那一格就地变成一个 down 拆分节点,原窗格仍在原位
    const inner = tree.children[0]
    expect(inner.kind).toBe('split')
    if (inner.kind !== 'split') return
    expect(inner.direction).toBe('down')
    expect(collectPaneLeaves(inner).map((l) => l.id)[0]).toBe(ROOT_PANE_ID)
  })
})

describe('D73 联动调整相邻窗格(拖分隔条 / 键盘微调)', () => {
  it('键盘同向键:目标份额 +步长,相邻窗格等量吸收,总和守恒', () => {
    mountTwoPanes('right')
    render(<PaneSplitContainer />)
    fireEvent.keyDown(resizerEl(ROOT_PANE_ID)!, { key: 'ArrowRight' })
    const tree = currentSplit()
    expect(tree.sizes[0]).toBeCloseTo(0.5 + PANE_RESIZE_STEP, 10)
    expect(tree.sizes[1]).toBeCloseTo(0.5 - PANE_RESIZE_STEP, 10)
    expect(tree.sizes[0] + tree.sizes[1]).toBeCloseTo(1, 10)
  })

  it('异向键不生效(纵排窗格不接受横向键),不产生虚假调整', () => {
    mountTwoPanes('down')
    render(<PaneSplitContainer />)
    const before = currentSplit().sizes
    fireEvent.keyDown(resizerEl(ROOT_PANE_ID)!, { key: 'ArrowRight' })
    expect(currentSplit().sizes).toEqual([...before])
  })

  it('连按到边界即停在 MIN_PANE_SIZE(钳制在判定层,份额不丢失)', () => {
    mountTwoPanes('right')
    render(<PaneSplitContainer />)
    const resizer = resizerEl(ROOT_PANE_ID)!
    for (let i = 0; i < 20; i += 1) fireEvent.keyDown(resizer, { key: 'ArrowLeft' })
    const tree = currentSplit()
    expect(tree.sizes[0]).toBeCloseTo(MIN_PANE_SIZE, 10)
    expect(tree.sizes[1]).toBeCloseTo(1 - MIN_PANE_SIZE, 10)
  })

  it('指针拖拽在量不到布局尺寸时不做换算(happy-dom 无 CSS ⇒ 不得把 1px 当 100%)', () => {
    mountTwoPanes('right')
    render(<PaneSplitContainer />)
    const resizer = resizerEl(ROOT_PANE_ID)!
    fireEvent.pointerDown(resizer, { clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(resizer, { clientX: 400, clientY: 100, pointerId: 1 })
    expect(currentSplit().sizes).toEqual([0.5, 0.5])
  })
})

describe('D73 最大化 / 还原往返与关闭', () => {
  it('最大化→还原:树不变、只切前景,还原后回到两格且关闭钮回来', () => {
    mountTwoPanes('right')
    render(<PaneSplitContainer />)
    fireEvent.click(actionEl('maximize')!)
    expect(
      document.querySelector('[data-pane-split-root]')?.getAttribute('data-pane-maximized'),
    ).toBe(ROOT_PANE_ID)
    expect(document.querySelectorAll('[data-pane-leaf]')).toHaveLength(1)
    expect(document.querySelector('[data-action="splitRight"]')).toBeNull()
    const treeWhileMax = usePaneSplitStore.getState().tree
    fireEvent.click(actionEl('restore')!)
    expect(
      document.querySelector('[data-pane-split-root]')?.getAttribute('data-pane-maximized'),
    ).toBe('')
    expect(usePaneSplitStore.getState().tree).toBe(treeWhileMax)
    expect(document.querySelectorAll('[data-pane-leaf]')).toHaveLength(2)
    expect(document.querySelector('[data-action="close"]')).not.toBeNull()
  })

  it('关闭一格:兄弟并占 100%,只剩最后一格时关闭钮消失', () => {
    mountTwoPanes('right')
    render(<PaneSplitContainer />)
    fireEvent.click(document.querySelector('[data-pane-leaf="pane-b"] [data-action="close"]')!)
    const tree = usePaneSplitStore.getState().tree
    expect(tree.kind).toBe('leaf')
    expect(tree.id).toBe(ROOT_PANE_ID)
    expect(document.querySelectorAll('[data-pane-leaf]')).toHaveLength(1)
    expect(document.querySelector('[data-action="close"]')).toBeNull()
  })

  it('关掉"正在最大化"的那格 ⇒ maximizedPaneId 不悬空(还原态一并清)', () => {
    mountTwoPanes('right')
    const state = usePaneSplitStore.getState()
    state.maximizePane('pane-b')
    render(<PaneSplitContainer />)
    expect(usePaneSplitStore.getState().maximizedPaneId).toBe('pane-b')
    fireEvent.click(document.querySelector('[data-pane-leaf="pane-b"] [data-action="restore"]')!)
    // 还原后再关(最大化态下不渲染关闭钮)
    fireEvent.click(document.querySelector('[data-pane-leaf="pane-b"] [data-action="close"]')!)
    const s = usePaneSplitStore.getState()
    expect(s.maximizedPaneId).toBeNull()
    expect(s.tree.id).toBe(ROOT_PANE_ID)
    expect(
      document.querySelector('[data-pane-maximized]')?.getAttribute('data-pane-maximized'),
    ).toBe('')
  })
})

describe('D73 空窗格拖入(D22 通道)与 Fork 失败显式渲染', () => {
  it('D22 通道键名:组件出口与判定层常量同源,且就是 application/x-ihui-conversation', () => {
    expect(PANE_DROP_CONVERSATION_TYPE).toBe('application/x-ihui-conversation')
  })

  it('非本通道拖拽不触发 Fork,也不落格', async () => {
    mountTwoPanes('right')
    const onForkConversation = vi.fn(() => null)
    render(<PaneSplitContainer onForkConversation={onForkConversation} />)
    dropOn('pane-b', '{"id":"conv-x"}', 'text/plain')
    await waitFor(() => expect(onForkConversation).not.toHaveBeenCalled())
    expect(currentSplit().children[1].kind).toBe('leaf')
    const child = currentSplit().children[1]
    expect(conversationOf(child)).toBe(null)
  })

  it('本通道拖入 + 宿主 Fork 成功 → 会话落到该窗格,承载委托被以该 id 调用', async () => {
    mountTwoPanes('right')
    const onForkConversation = vi.fn(() => null)
    const renderPaneContent = vi.fn(() => <div data-testid="pane-body" />)
    render(
      <PaneSplitContainer
        onForkConversation={onForkConversation}
        renderPaneContent={renderPaneContent}
      />,
    )
    dropOn('pane-b', JSON.stringify({ id: 'conv-x', title: '任务 X' }))
    await waitFor(() => expect(onForkConversation).toHaveBeenCalledWith('conv-x', 'pane-b'))
    const child = currentSplit().children[1]
    expect(conversationOf(child)).toBe('conv-x')
    expect(leafEl('pane-b')?.getAttribute('data-pane-conversation')).toBe('conv-x')
    expect(renderPaneContent).toHaveBeenCalledWith('conv-x', 'pane-b')
  })

  it('Fork 失败(capacityFull):失败文案按判定层键渲染 + tone=warning + 给重试入口', async () => {
    mountTwoPanes('right')
    const onForkConversation = vi.fn(() => 'capacityFull' as const)
    render(<PaneSplitContainer onForkConversation={onForkConversation} />)
    dropOn('pane-b', JSON.stringify({ id: 'conv-x' }))
    const banner = await waitFor(() => {
      const el = document.querySelector('[data-pane-fork-failure]')
      expect(el).not.toBeNull()
      return el as Element
    })
    expect(banner.getAttribute('data-pane-fork-failure')).toBe('capacityFull')
    expect(banner.getAttribute('data-pane-fork-tone')).toBe(forkFailureView('capacityFull').tone)
    // 渲染出的文本就是判定层给的键(mock 回显键名)⇒ 组件没有自立文案键
    expect(banner.textContent).toContain(forkFailureView('capacityFull').titleKey)
    expect(document.querySelector('[data-action="retryFork"]')).not.toBeNull()
    // 失败不得把会话塞进窗格(不静默假装成功)
    const child = currentSplit().children[1]
    expect(conversationOf(child)).toBe(null)
  })

  it('重试入口:清除失败标记并让窗格重新可拖入(不是一次性死提示)', async () => {
    mountTwoPanes('right')
    const onForkConversation = vi.fn(() => 'capacityFull' as const)
    render(<PaneSplitContainer onForkConversation={onForkConversation} />)
    dropOn('pane-b', JSON.stringify({ id: 'conv-x' }))
    await waitFor(() => expect(document.querySelector('[data-action="retryFork"]')).not.toBeNull())
    onForkConversation.mockReturnValue(null)
    fireEvent.click(document.querySelector('[data-action="retryFork"]')!)
    expect(document.querySelector('[data-pane-fork-failure]')).toBeNull()
    expect(emptyEl('pane-b')).not.toBeNull()
    dropOn('pane-b', JSON.stringify({ id: 'conv-y' }))
    await waitFor(() =>
      expect(leafEl('pane-b')?.getAttribute('data-pane-conversation')).toBe('conv-y'),
    )
  })

  it('Fork 失败(conversationMissing):tone=danger 且不给重试(会话已不存在)', async () => {
    mountTwoPanes('right')
    render(<PaneSplitContainer onForkConversation={() => 'conversationMissing'} />)
    dropOn('pane-b', JSON.stringify({ id: 'conv-gone' }))
    const banner = await waitFor(() => {
      const el = document.querySelector('[data-pane-fork-failure]')
      expect(el).not.toBeNull()
      return el as Element
    })
    expect(banner.getAttribute('data-pane-fork-tone')).toBe('danger')
    expect(document.querySelector('[data-action="retryFork"]')).toBeNull()
  })

  it('已承载会话的窗格不再是拖入落点(不顶掉正在跑的会话)', async () => {
    mountTwoPanes('right')
    usePaneSplitStore.getState().dropConversation('pane-b', 'conv-live')
    render(<PaneSplitContainer onForkConversation={vi.fn()} />)
    expect(emptyEl('pane-b')).toBeNull()
    expect(emptyEl(ROOT_PANE_ID)).not.toBeNull()
  })

  it('三态自证:判定层 reason 集 ↔ 组件出口 titleKey 集大小一致且互不相同', () => {
    expect(PANE_FORK_FAILURE_KEYS).toHaveLength(FORK_FAILURE_REASONS.length)
    expect(new Set(PANE_FORK_FAILURE_KEYS).size).toBe(FORK_FAILURE_REASONS.length)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
