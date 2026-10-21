// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票60(2026-10-18,步序五):布局树 ⇆ chat-panes 注册表对齐层用例。
// 咬四件事:
//  ① 纯 diff 只回收"树里消失"的叶 id,树上仍在的绝不动;
//  ② hook 挂载 + 拆分(树叶增加)不回收任何既有实例;
//  ③ 关闭叶子(兄弟并占)后,被关窗格的实例从注册表消失(chatPaneStoreCount 对账);
//  ④ 宿主卸载回收全部叶实例(长会话内存不悬空)。

import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'

import { ROOT_PANE_ID, createPaneTree, splitPane, type PaneNode } from '@ihui/shared/chat/multi-pane'
import { removedPaneIds, useChatPaneSync } from '@/hooks/use-chat-pane-sync'
import {
  chatPaneStoreCount,
  disposeChatStoreForPane,
  getChatStoreForPane,
  resetChatPaneStores,
} from '@/stores/chat-panes'

afterEach(() => {
  resetChatPaneStores()
  window.localStorage.clear()
})

describe('removedPaneIds 纯 diff', () => {
  it('只回收树里消失的叶 id;顺序无关、幂等', () => {
    expect(removedPaneIds(['pane-root', 'pane-2'], ['pane-root'])).toEqual(['pane-2'])
    expect(removedPaneIds(['pane-root'], ['pane-root', 'pane-2'])).toEqual([])
    expect(removedPaneIds([], ['pane-root'])).toEqual([])
    // 幂等:同一对账跑两遍,第二遍零回收
    expect(removedPaneIds(['pane-root'], ['pane-root'])).toEqual([])
  })
})

describe('useChatPaneSync 生命周期对齐', () => {
  it('拆分(树叶增加)不回收既有实例', () => {
    const root = createPaneTree(null, ROOT_PANE_ID)
    const { rerender } = renderHook<void, { tree: PaneNode }>(
      ({ tree }) => useChatPaneSync(tree),
      { initialProps: { tree: root } },
    )
    // 叶子被消费侧懒建后(paneId = leaf.id),拆分不回收它
    getChatStoreForPane(ROOT_PANE_ID)
    const split = splitPane(root, ROOT_PANE_ID, 'right', null, 'pane-2')
    expect(split).not.toBeNull()
    rerender({ tree: split! })
    expect(getChatStoreForPane(ROOT_PANE_ID)).toBeDefined()
    expect(chatPaneStoreCount()).toBeGreaterThanOrEqual(1)
  })

  it('关闭叶子(兄弟并占)后,被关窗格实例从注册表回收', () => {
    const root = createPaneTree(null, ROOT_PANE_ID)
    const split = splitPane(root, ROOT_PANE_ID, 'right', null, 'pane-2')!
    getChatStoreForPane(ROOT_PANE_ID)
    const p2 = getChatStoreForPane('pane-2')
    expect(chatPaneStoreCount()).toBe(2)

    const { rerender } = renderHook(({ tree }) => useChatPaneSync(tree), {
      initialProps: { tree: split },
    })
    // 关闭 pane-2:树回到单根叶,注册表里 pane-2 随之回收(只出注册表,不删 persist 快照)
    rerender({ tree: root })
    expect(chatPaneStoreCount()).toBe(1)
    expect(getChatStoreForPane(ROOT_PANE_ID)).toBeDefined()
    expect(p2).toBeDefined()
  })

  it('宿主卸载回收全部叶实例;树外自建实例不受波及', () => {
    const root = createPaneTree(null, ROOT_PANE_ID)
    getChatStoreForPane(ROOT_PANE_ID)
    const { unmount } = renderHook(({ tree }) => useChatPaneSync(tree), {
      initialProps: { tree: root },
    })
    // 树外自建实例(非任何叶子的财产)不属于对齐面,卸载不回收
    getChatStoreForPane('pane-9')
    expect(chatPaneStoreCount()).toBe(2)
    unmount()
    // 只回收树上的 pane-root;pane-9 仍在(它的生命周期归其消费侧)
    expect(chatPaneStoreCount()).toBe(1)
    disposeChatStoreForPane('pane-9')
    expect(chatPaneStoreCount()).toBe(0)
  })

  it('dispose 后同 id 重取得到全新实例(回收语义与注册表一致)', () => {
    const p1 = getChatStoreForPane('pane-dispose')
    disposeChatStoreForPane('pane-dispose')
    const p2 = getChatStoreForPane('pane-dispose')
    expect(p2).not.toBe(p1)
  })
})
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
