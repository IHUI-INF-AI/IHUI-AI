// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 新文件(票 G-935 缺口B 补测):普通注释头,不伪造溯源水印。

// @vitest-environment jsdom

/**
 * G-935 缺口B:窗格布局持久化的三格验收(拆分落盘 / 解析与坏数据回落 / 关格后只剩一叶)。
 * 断言一律走纯解析函数与 localStorage 实际 blob,不依赖模块重载。
 */
import { beforeEach, describe, expect, it } from 'vitest'

import {
  type PaneNode,
  ROOT_PANE_ID,
  collectPaneLeaves,
  createPaneLayout,
  splitPane,
} from '@ihui/shared/chat/multi-pane'

import {
  PANE_SPLIT_PERSIST_KEY,
  ensureUniqueNodeIds,
  nextFreePaneId,
  parsePaneSplitLayout,
  parsePaneSplitPersisted,
  rehydratePaneSplitLayout,
  resetPaneSplitLayout,
  usePaneSplitStore,
} from '@/stores/pane-split'

function readBlob(): { state: { tree: unknown; maximizedPaneId: unknown }; version: number } {
  const raw = window.localStorage.getItem(PANE_SPLIT_PERSIST_KEY)
  if (!raw) throw new Error('持久键缺失:' + PANE_SPLIT_PERSIST_KEY)
  return JSON.parse(raw) as { state: { tree: unknown; maximizedPaneId: unknown }; version: number }
}

beforeEach(() => {
  window.localStorage.clear()
  resetPaneSplitLayout(createPaneLayout(null, ROOT_PANE_ID).tree)
})

describe('G-935 窗格布局持久化', () => {
  it('拆分后持久键出现,且 blob 含两叶、不含 forkFailures', () => {
    usePaneSplitStore.getState().setForkFailure(ROOT_PANE_ID, 'capacityFull')
    usePaneSplitStore.getState().splitPane(ROOT_PANE_ID, 'right', 'conv-b')

    const blob = readBlob()
    expect(blob.version).toBe(1)
    const tree = blob.state.tree as Parameters<typeof collectPaneLeaves>[0]
    expect(collectPaneLeaves(tree).map((leaf) => leaf.conversationId)).toEqual([null, 'conv-b'])
    expect(blob.state).not.toHaveProperty('forkFailures')
  })

  it('合法 blob 还原树与最大化标记;非法最大值回落 null', () => {
    const single = createPaneLayout(null, ROOT_PANE_ID).tree
    const tree = splitPane(single, ROOT_PANE_ID, 'right', 'conv-b', 'pane-b')
    if (!tree) throw new Error('setup: split failed')

    const ok = parsePaneSplitLayout(
      JSON.stringify({ state: { tree, maximizedPaneId: 'pane-b' }, version: 1 }),
    )
    expect(collectPaneLeaves(ok.tree).map((leaf) => leaf.id)).toEqual([ROOT_PANE_ID, 'pane-b'])
    expect(ok.maximizedPaneId).toBe('pane-b')

    const dangling = parsePaneSplitLayout(
      JSON.stringify({ state: { tree, maximizedPaneId: 'pane-missing' }, version: 1 }),
    )
    expect(dangling.maximizedPaneId).toBeNull()
  })

  it('坏 blob 一律回落默认单叶树(非法 JSON / 空 id / 份额和不为 1 / 重复 id)', () => {
    const cases = [
      '{not-json',
      JSON.stringify({ state: { tree: { kind: 'leaf', id: '', conversationId: null } } }),
      JSON.stringify({
        state: {
          tree: {
            kind: 'split',
            id: 's1',
            direction: 'right',
            children: [
              { kind: 'leaf', id: ROOT_PANE_ID, conversationId: null },
              { kind: 'leaf', id: 'pane-b', conversationId: null },
            ],
            sizes: [0.5, 0.2],
          },
        },
      }),
      JSON.stringify({
        state: {
          tree: {
            kind: 'split',
            id: 's1',
            direction: 'right',
            children: [
              { kind: 'leaf', id: ROOT_PANE_ID, conversationId: null },
              { kind: 'leaf', id: ROOT_PANE_ID, conversationId: null },
            ],
            sizes: [0.5, 0.5],
          },
        },
      }),
    ]

    for (const raw of cases) {
      expect(parsePaneSplitPersisted(raw), raw).toBeNull()
      const fallback = parsePaneSplitLayout(raw)
      expect(fallback.tree.kind).toBe('leaf')
      expect(fallback.tree.id).toBe(ROOT_PANE_ID)
      expect(fallback.maximizedPaneId).toBeNull()
    }
  })

  it('rehydrate:合法 blob 把两叶写回 store;坏 blob 回落单叶并清掉坏键', () => {
    const single = createPaneLayout(null, ROOT_PANE_ID).tree
    const tree = splitPane(single, ROOT_PANE_ID, 'right', 'conv-b', 'pane-b')
    if (!tree) throw new Error('setup: split failed')
    window.localStorage.setItem(
      PANE_SPLIT_PERSIST_KEY,
      JSON.stringify({ state: { tree, maximizedPaneId: 'pane-b' }, version: 1 }),
    )

    rehydratePaneSplitLayout()

    const restored = usePaneSplitStore.getState()
    expect(collectPaneLeaves(restored.tree).map((leaf) => leaf.id)).toEqual([
      ROOT_PANE_ID,
      'pane-b',
    ])
    expect(restored.maximizedPaneId).toBe('pane-b')

    window.localStorage.setItem(PANE_SPLIT_PERSIST_KEY, '{not-json')
    rehydratePaneSplitLayout()

    const fallback = usePaneSplitStore.getState()
    expect(collectPaneLeaves(fallback.tree).map((leaf) => leaf.id)).toEqual([ROOT_PANE_ID])
    expect(fallback.maximizedPaneId).toBeNull()
    expect(window.localStorage.getItem(PANE_SPLIT_PERSIST_KEY)).toBeNull()
  })

  it('关闭一格后持久键只剩一叶', () => {
    usePaneSplitStore.getState().splitPane(ROOT_PANE_ID, 'right', null)
    const tree = usePaneSplitStore.getState().tree
    if (tree.kind !== 'split') throw new Error('setup: 期望 split 树')
    const closingId = tree.children[1]!.id

    usePaneSplitStore.getState().closePane(closingId)

    const blob = readBlob()
    const persisted = blob.state.tree as Parameters<typeof collectPaneLeaves>[0]
    const leaves = collectPaneLeaves(persisted)
    expect(leaves).toHaveLength(1)
    expect(leaves[0]!.id).toBe(ROOT_PANE_ID)
  })
})

describe('G-935 缺口B 窗格 id 防撞(store 层)', () => {
  /** 模拟 reload 后恢复出的布局:split 节点与叶都占好了 pane-N 档,而计数器已归零 */
  const restoredTree: PaneNode = {
    kind: 'split',
    id: 's-restored',
    direction: 'right',
    children: [
      { kind: 'leaf', id: ROOT_PANE_ID, conversationId: 'conv-a' },
      { kind: 'leaf', id: 'pane-1', conversationId: 'conv-b' },
    ],
    sizes: [0.5, 0.5],
  }

  function allNodeIds(node: PaneNode, out: Set<string>): void {
    out.add(node.id)
    if (node.kind === 'split') for (const child of node.children) allNodeIds(child, out)
  }

  it('恢复布局后再拆分:新叶不撞恢复出的 pane-1,全树 id 唯一', () => {
    resetPaneSplitLayout(restoredTree)
    usePaneSplitStore.getState().splitPane('pane-1', 'right', 'conv-c')

    const tree = usePaneSplitStore.getState().tree
    const leaves = collectPaneLeaves(tree)
    expect(leaves).toHaveLength(3)
    const ids = new Set<string>()
    allNodeIds(tree, ids)
    // 3 叶 + 2 split = 5 节点,id 必须一个不少地唯一(撞名即两窗格共用一份 store 实例)
    expect(ids.size).toBe(5)
    const newLeaf = leaves.find((leaf) => leaf.conversationId === 'conv-c')
    expect(newLeaf?.id).toBeDefined()
    expect(newLeaf?.id).not.toBe('pane-1')
    expect(newLeaf?.id).not.toBe(ROOT_PANE_ID)
  })

  it('nextFreePaneId:跳过树内已用与本会话已发放的 id;重置台账后重新起算', () => {
    resetPaneSplitLayout(restoredTree)
    expect(nextFreePaneId(restoredTree)).toBe('pane-2')
    // 同一棵树再取:pane-2 已被上一行"发放",必须让位
    expect(nextFreePaneId(restoredTree)).toBe('pane-3')
    resetPaneSplitLayout(restoredTree)
    expect(nextFreePaneId(restoredTree)).toBe('pane-2')
  })

  it('ensureUniqueNodeIds:未撞逐字节同形,撞名只改 split 节点', () => {
    const clean: PaneNode = {
      kind: 'split',
      id: 's1',
      direction: 'right',
      children: [
        { kind: 'leaf', id: 'pane-1', conversationId: null },
        { kind: 'leaf', id: 'pane-2', conversationId: null },
      ],
      sizes: [0.5, 0.5],
    }
    expect(ensureUniqueNodeIds(clean)).toEqual(clean)

    const collided: PaneNode = { ...clean, id: 'pane-1' }
    const fixed = ensureUniqueNodeIds(collided)
    expect(fixed.kind === 'split' && fixed.id).toBe('pane-3')
    if (fixed.kind === 'split') {
      expect(fixed.children).toEqual(clean.children)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
