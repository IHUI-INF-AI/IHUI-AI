// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D73 宿主挂载接线断言(G-100,2026-09-24)
//
// 本文件钉死的是**宿主委托契约本身**(不是容器行为的复读):
// `ai-side-panel.tsx` 挂进 PaneSplitContainer 的两个回调形态 ——
//   renderPaneContent:仅"承载会话 == 全局当前会话"的窗格得到主体,其余窗格只给承载标记;
//   forkIntoPane:capacityFull / conversationMissing 容量与存在性判定。
// 下面 d73ForkIntoPane / d73RenderPaneContent 与宿主候选
// (.ihui-agent/tmp/mount-d73/ai-side-panel.candidate.tsx 的 D73 段)逐字同构 ——
// 镜像纪律:宿主侧改契约,这里必须同步。真实端到端证据(私有端口 dev + DOM 数值)见交付报告。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react'

import {
  type ForkFailureReason,
  PANE_CONVERSATION_DRAG_TYPE,
  type PaneNode,
  ROOT_PANE_ID,
  collectPaneLeaves,
  createPaneLayout,
  dropConversationToPane,
  splitPane,
} from '@ihui/shared/chat/multi-pane'

import { PANE_DROP_CONVERSATION_TYPE, PaneSplitContainer } from '../pane-split-container'
import { resetPaneSplitLayout, usePaneSplitStore } from '@/stores/pane-split'

// 文案键原样回显(与组件用例同一 mock 语义)
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

/** 与宿主逐字同构:窗格承载上限(容量判定留在宿主,容器只画 forkFailureView) */
const D73_MAX_PANES = 4

function d73ForkIntoPane(
  conversationId: string,
  _paneId: string,
  knownConversations?: ReadonlySet<string>,
): ForkFailureReason | null {
  if (knownConversations && !knownConversations.has(conversationId)) return 'conversationMissing'
  if (collectPaneLeaves(usePaneSplitStore.getState().tree).length >= D73_MAX_PANES)
    return 'capacityFull'
  return null
}

/** 与宿主逐字同构的委托(v2):主体唯一、固定渲染在根窗格;其余窗格 = 承载标记(诚实降级) */
function d73RenderPaneContent() {
  function D73PaneContent({ conversationId, paneId }: { conversationId: string | null; paneId: string }) {
    return paneId === ROOT_PANE_ID ? (
      <div data-testid="pane-body" data-body-pane={paneId} />
    ) : (
      <div data-pane-marker={paneId}>
        <span>{paneId}</span>
        <span>{conversationId}</span>
      </div>
    )
  }
  return (conversationId: string | null, paneId: string) => (
    <D73PaneContent conversationId={conversationId} paneId={paneId} />
  )
}

/** 用判定层纯函数搭树(显式窗格 id,不依赖 store 计数器),再整树注入 store */
function layoutTwoPanes(conversations: Partial<Record<string, string>> = {}): PaneNode {
  let tree: PaneNode = createPaneLayout(null, ROOT_PANE_ID).tree
  const split = splitPane(tree, ROOT_PANE_ID, 'right', null, 'pane-b')
  if (!split) throw new Error('setup: split failed')
  tree = split
  for (const [paneId, conversationId] of Object.entries(conversations)) {
    if (!conversationId) continue
    const next = dropConversationToPane(tree, paneId, conversationId)
    if (!next) throw new Error(`setup: drop to ${paneId} failed`)
    tree = next
  }
  resetPaneSplitLayout(tree)
  return tree
}

function dropOn(paneId: string, payload: string) {
  const el = document.querySelector(`[data-pane-leaf="${paneId}"] [data-pane-empty]`)
  if (!el) throw new Error(`未找到 ${paneId} 的空窗格落点`)
  fireEvent.drop(el as HTMLElement, {
    dataTransfer: {
      types: [PANE_CONVERSATION_DRAG_TYPE],
      getData: (t: string) => (t === PANE_CONVERSATION_DRAG_TYPE ? payload : ''),
      dropEffect: 'copy',
    },
  })
}

beforeEach(() => {
  layoutTwoPanes()
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

describe('D73 宿主委托:主体唯一固定根窗格(第二窗格诚实降级)', () => {
  it('两格各承载一个会话:主体恰好 1 份,另一格只给承载标记(不伪造第二消息流)', () => {
    layoutTwoPanes({ [ROOT_PANE_ID]: 'conv-current', 'pane-b': 'conv-other' })
    const { container } = render(
      <PaneSplitContainer renderPaneContent={d73RenderPaneContent()} />,
    )
    const bodies = container.querySelectorAll('[data-testid="pane-body"]')
    expect(bodies).toHaveLength(1)
    expect(bodies[0]?.getAttribute('data-body-pane')).toBe(ROOT_PANE_ID)
    expect(container.querySelector('[data-pane-marker="pane-b"]')).not.toBeNull()
    expect(container.querySelectorAll('[data-pane-leaf]').length).toBe(2)
  })

  it('全局当前会话切换不影响主体归属(v2):主体恒在根窗格,副格只显承载标记', () => {
    layoutTwoPanes({ [ROOT_PANE_ID]: 'conv-current', 'pane-b': 'conv-other' })
    const { container, rerender } = render(
      <PaneSplitContainer renderPaneContent={d73RenderPaneContent()} />,
    )
    rerender(<PaneSplitContainer renderPaneContent={d73RenderPaneContent()} />)
    const bodies = container.querySelectorAll('[data-testid="pane-body"]')
    expect(bodies).toHaveLength(1)
    expect(bodies[0]?.getAttribute('data-body-pane')).toBe(ROOT_PANE_ID)
    const marker = container.querySelector('[data-pane-marker="pane-b"]')
    expect(marker?.textContent).toContain('pane-b')
    expect(marker?.textContent).toContain('conv-other')
  })
})

describe('D73 宿主 Fork 判定(经容器端到端走真实拖入链)', () => {
  it('容量未达上限:拖入成功 → 该窗格承载会话并以标记(非主体)呈现', async () => {
    layoutTwoPanes({ [ROOT_PANE_ID]: 'conv-current' })
    render(
      <PaneSplitContainer
        renderPaneContent={d73RenderPaneContent()}
        onForkConversation={d73ForkIntoPane}
      />,
    )
    dropOn('pane-b', JSON.stringify({ id: 'conv-dropped', title: 'T' }))
    await waitFor(() =>
      expect(document.querySelector('[data-pane-leaf="pane-b"]')?.getAttribute('data-pane-conversation')).toBe(
        'conv-dropped',
      ),
    )
    expect(document.querySelector('[data-pane-marker="pane-b"]')).not.toBeNull()
    expect(document.querySelectorAll('[data-testid="pane-body"]')).toHaveLength(1)
    expect(document.querySelector('[data-pane-fork-failure]')).toBeNull()
  })

  it('叶数达 D73_MAX_PANES=4 → capacityFull:失败横幅 + 重试入口,不落格(不静默吞)', async () => {
    let tree: PaneNode = createPaneLayout(null, ROOT_PANE_ID).tree
    let i = 0
    while (collectPaneLeaves(tree).length < D73_MAX_PANES) {
      const first = collectPaneLeaves(tree)[0]
      if (!first) throw new Error('setup: no leaf')
      const next = splitPane(tree, first.id, 'down', null, `pane-x-${(i += 1)}`)
      if (!next) throw new Error('setup: split failed')
      tree = next
    }
    expect(collectPaneLeaves(tree)).toHaveLength(D73_MAX_PANES)
    resetPaneSplitLayout(tree)
    render(
      <PaneSplitContainer
        renderPaneContent={d73RenderPaneContent()}
        onForkConversation={d73ForkIntoPane}
      />,
    )
    dropOn('pane-x-3', JSON.stringify({ id: 'conv-z' }))
    const banner = await waitFor(() => {
      const el = document.querySelector('[data-pane-fork-failure]')
      expect(el).not.toBeNull()
      return el as Element
    })
    expect(banner.getAttribute('data-pane-fork-failure')).toBe('capacityFull')
    expect(document.querySelector('[data-action="retryFork"]')).not.toBeNull()
    expect(
      collectPaneLeaves(usePaneSplitStore.getState().tree).find((l) => l.id === 'pane-x-3')
        ?.conversationId,
    ).toBe(null)
  })

  it('knownConversations 不含该 id → conversationMissing(danger 态,不给重试)', async () => {
    layoutTwoPanes()
    const fork = (id: string, paneId: string) => d73ForkIntoPane(id, paneId, new Set(['conv-known']))
    render(<PaneSplitContainer onForkConversation={fork} />)
    dropOn('pane-b', JSON.stringify({ id: 'conv-ghost' }))
    const banner = await waitFor(() => {
      const el = document.querySelector('[data-pane-fork-failure]')
      expect(el).not.toBeNull()
      return el as Element
    })
    expect(banner.getAttribute('data-pane-fork-failure')).toBe('conversationMissing')
    expect(document.querySelector('[data-action="retryFork"]')).toBeNull()
    expect(PANE_DROP_CONVERSATION_TYPE).toBe('application/x-ihui-conversation')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠