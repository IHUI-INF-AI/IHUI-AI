// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票60 普查@2026-10-21:提及草稿(@ / # chips + 维度 tab)必须按窗格分家。
// 缺陷本体:context-mention 曾是全局单例,而每个非根窗格的 MessageInput 都挂一份
// 消费面 ⇒ pane-1 选的 @file 会出现在 pane-2 输入框上方(反向亦然)。
// 成对留证:
//  ① 正向 = 两窗格各自 addMention 互不顶,根单例一个字节没被写;
//  ② 反证 = Provider 外(根窗格 / 单窗格调用面)回落根单例且恒同一引用(既有消费面零回归);
//  ③ 空 / 空白 paneId 当场抛(静默回落单例 = 窗格间互串回潮)。

// @vitest-environment jsdom

import * as React from 'react'
import { cleanup, fireEvent, render, renderHook, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'

import { ChatPaneProvider } from '@/stores/chat-pane-context'
import {
  contextMentionPaneCount,
  getContextMentionStoreForPane,
  resetContextMentionPaneStores,
  useContextMentionStore,
  usePaneMentionStore,
} from '@/stores/context-mention'
import { dimensionsForSigil, type MentionSelection } from '@ihui/shared/chat/mention-engine'

const DEFAULT_DIMENSION_ID = dimensionsForSigil('@')[0]?.id ?? ''
const AT_DIM = dimensionsForSigil('@')[0]!

/** 引擎形状的合法提及(维度取引擎表第一条,不在端内写死 id) */
function sel(file: string): MentionSelection {
  return {
    id: `${AT_DIM.id}:${file}`,
    sigil: AT_DIM.sigil,
    dimensionId: AT_DIM.id,
    label: `file-${file}`,
    insertText: `\`src/${file}.ts\``,
  }
}

/**
 * 最小消费面:用法形态与生产面逐字同形 —— 先 `const mentionStore = usePaneMentionStore()`
 * 再 `mentionStore((s) => …)` 读、`mentionStore.getState()` 写。
 */
function MentionProbe({ seed }: { seed: string }) {
  const mentionStore = usePaneMentionStore()
  const labels = mentionStore((s) => s.mentions.map((m) => m.label).join('|'))
  return (
    <div>
      <button type="button" onClick={() => mentionStore.getState().addMention(sel(seed))}>
        add-{seed}
      </button>
      <span data-testid="labels">{labels}</span>
    </div>
  )
}

function wrapperFor(paneId: string) {
  // 具名组件:eslint react/display-name 不认匿名箭头(与其余 pane-scope 测试同形)
  function PaneWrapper({ children }: { children: ReactNode }) {
    return <ChatPaneProvider paneId={paneId}>{children}</ChatPaneProvider>
  }
  return PaneWrapper
}

/** render 的绑定查询走 baseElement(整 document.body),两窗格同刻在场时必须收进各自 container */
function viewOf(v: ReturnType<typeof render>) {
  return within(v.container)
}

beforeEach(() => {
  resetContextMentionPaneStores()
  useContextMentionStore.setState({ mentions: [], activeDimensionId: DEFAULT_DIMENSION_ID })
})

afterEach(() => {
  cleanup()
  resetContextMentionPaneStores()
  useContextMentionStore.setState({ mentions: [], activeDimensionId: DEFAULT_DIMENSION_ID })
})

describe('context-mention 按窗格分家(票60 普查)', () => {
  it('① 正向:两窗格各自 addMention 互不顶,根单例一个字节没被写', () => {
    const viewA = render(
      <ChatPaneProvider paneId="pane-ma">
        <MentionProbe seed="a" />
      </ChatPaneProvider>,
    )
    const viewB = render(
      <ChatPaneProvider paneId="pane-mb">
        <MentionProbe seed="b" />
      </ChatPaneProvider>,
    )

    fireEvent.click(viewOf(viewA).getByRole('button'))
    fireEvent.click(viewOf(viewB).getByRole('button'))

    // 各自只看得见自己那份(互不顶:pane-a 选的不出现在 pane-b,反向亦然)
    expect(viewOf(viewA).getByTestId('labels').textContent).toBe('file-a')
    expect(viewOf(viewB).getByTestId('labels').textContent).toBe('file-b')
    // 写落在两个窗格实例上,根单例未被写入一个字节
    expect(useContextMentionStore.getState().mentions).toEqual([])
    expect(
      getContextMentionStoreForPane('pane-ma')
        .getState()
        .mentions.map((m) => m.label),
    ).toEqual(['file-a'])
    expect(
      getContextMentionStoreForPane('pane-mb')
        .getState()
        .mentions.map((m) => m.label),
    ).toEqual(['file-b'])
    expect(contextMentionPaneCount()).toBe(2)
  })

  it('② 反证:Provider 外回落根单例且恒同一引用(既有单窗格消费面零回归)', () => {
    const one = renderHook(() => usePaneMentionStore())
    const other = renderHook(() => usePaneMentionStore())
    expect(one.result.current).toBe(useContextMentionStore)
    expect(other.result.current).toBe(useContextMentionStore)
    // 重渲染不换引用(否则订阅面每帧重挂)
    one.rerender()
    expect(one.result.current).toBe(useContextMentionStore)

    // 顺带:窗格内取到的是独立实例,且与注册表同一引用(① 的前提)
    const inPane = renderHook(() => usePaneMentionStore(), { wrapper: wrapperFor('pane-ref') })
    expect(inPane.result.current).not.toBe(useContextMentionStore)
    expect(inPane.result.current).toBe(getContextMentionStoreForPane('pane-ref'))
    expect(contextMentionPaneCount()).toBe(1)
  })

  it('③ 空/空白 paneId 当场抛(静默回落单例 = 窗格间互串回潮)', () => {
    expect(() => getContextMentionStoreForPane('')).toThrow(/回落单例 = 窗格间互串/)
    expect(() => getContextMentionStoreForPane('   ')).toThrow(/回落单例 = 窗格间互串/)
    expect(() => renderHook(() => usePaneMentionStore(), { wrapper: wrapperFor('  ') })).toThrow(
      /paneId 不能为空/,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
