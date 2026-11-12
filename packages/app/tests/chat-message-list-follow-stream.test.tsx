// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// D3 流式跟底守门(共享 ChatMessageList 的 followStream)
//
// 这一组钉的是"用户能看见"的三件事:
// ① 不传 followStream ⇒ 列表零滚动调用(群聊/直播等既有宿主零回归);
// ② 流式中内容增长 ⇒ 自动贴底(RN 此前完全不跟,新内容长在视口下方);
// ③ **用户上滑后不再拽回** —— 这是第一版的真实缺陷:无条件 scrollToEnd 让流式期间
//    根本滑不动,与 web 端 scroll-authority 的行为完全相反。恢复要等用户自己滑回底部。
// 另有两例钉边界:切会话后上一轮的"上翻"账目作废、非流式态不再振荡。
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import { createElement, forwardRef, useImperativeHandle, type ForwardedRef } from 'react'
import type { ChatScreenMessage, TFunction } from '../src/types'

const t: TFunction = (key) => key

/**
 * FlatList 替身必须**接住 ref**:被测组件把实例句柄同时交给内部 listRef 与 onListRef,
 * 真 RN 的 FlatList 是带实例方法的类组件,而共享 mock 里是普通函数(React 会剥掉 ref)——
 * 不补这一层的话 `listRef.current` 恒为 null,`scrollToEnd` 永远不被调用,
 * 于是"用户上滑后不滚"这条断言在**任何实现**下都绿(假绿)。这里直接把句柄暴露成 spy。
 */
const scrollSpy = vi.fn()

/**
 * 替身把 props 上的两个 handler 存到模块级槽位。
 * 不能靠读 DOM 元素属性取 handler:`createElement('div', {onScroll})` 在 React DOM 里是
 * 合成事件,元素本身没有 `onScroll` 属性 ⇒ 用例取到 undefined、`userScroll` 变成空操作,
 * 于是"上滑后不滚"在**任何实现**下都绿(本文件第一版就是这么假绿的)。
 */
const handlers: { onScroll?: (e: unknown) => void; onEndReached?: () => void } = {}

vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  const FlatList = forwardRef(function FlatListStub(
    props: Record<string, unknown>,
    ref: ForwardedRef<unknown>,
  ) {
    useImperativeHandle(ref, () => ({ scrollToEnd: scrollSpy, scrollToOffset: vi.fn() }), [])
    handlers.onScroll = props.onScroll as ((e: unknown) => void) | undefined
    handlers.onEndReached = props.onEndReached as (() => void) | undefined
    const data = (props.data ?? []) as readonly unknown[]
    const renderItem = props.renderItem as
      | ((info: { item: unknown; index: number }) => unknown)
      | undefined
    const keyExtractor = props.keyExtractor as
      | ((item: unknown, index: number) => string)
      | undefined
    return createElement(
      'div',
      {
        'data-role': 'flatlist',
        'data-on-scroll': props.onScroll ? '1' : '',
        'data-on-end-reached': props.onEndReached ? '1' : '',
      },
      data.map((item, index) =>
        createElement(
          'div',
          { key: keyExtractor ? keyExtractor(item, index) : index },
          renderItem ? (renderItem({ item, index }) as never) : null,
        ),
      ),
    )
  })
  return { ...actual, FlatList }
})

const { ChatMessageList } = await import('../src/features/chat/ChatMessageList')

function msg(id: string, content: string): ChatScreenMessage {
  return { id, role: 'assistant', content } as ChatScreenMessage
}

function listProps(): { onScroll?: (e: unknown) => void; onEndReached?: () => void } {
  return handlers
}

function mount(data: ChatScreenMessage[], streaming: boolean, followStream?: boolean) {
  const r = render(
    createElement(ChatMessageList, {
      t,
      data,
      isStreaming: streaming,
      showThinkingPlaceholder: false,
      ...(followStream === undefined ? {} : { followStream }),
    } as never),
  )
  return r
}

function rerenderWith(
  r: { rerender: (el: unknown) => void },
  data: ChatScreenMessage[],
  streaming: boolean,
  followStream?: boolean,
) {
  act(() => {
    r.rerender(
      createElement(ChatMessageList, {
        t,
        data,
        isStreaming: streaming,
        showThinkingPlaceholder: false,
        ...(followStream === undefined ? {} : { followStream }),
      } as never),
    )
  })
}

function userScroll(scrollTop: number) {
  const { onScroll } = listProps()
  act(() => {
    onScroll?.({ nativeEvent: { contentOffset: { y: scrollTop } } })
  })
}

function reachBottom() {
  const { onEndReached } = listProps()
  act(() => {
    onEndReached?.()
  })
}

beforeEach(() => {
  scrollSpy.mockClear()
})

afterEach(() => {
  cleanup()
})

describe('ChatMessageList · followStream', () => {
  it('不传 followStream:列表不挂 onScroll/onEndReached,且零滚动调用', () => {
    const r = mount([msg('a1', 'x')], true)
    rerenderWith(r, [msg('a1', 'xx')], true)
    expect(scrollSpy).not.toHaveBeenCalled()
    expect(listProps().onScroll).toBeUndefined()
    expect(r.container.textContent).toContain('xx')
  })

  it('流式中内容增长 ⇒ 自动贴底', () => {
    const r = mount([msg('a1', 'x')], true, true)
    const first = scrollSpy.mock.calls.length
    expect(first).toBeGreaterThan(0)
    rerenderWith(r, [msg('a1', '增长了一段')], true, true)
    expect(scrollSpy.mock.calls.length).toBeGreaterThan(first)
  })

  it('用户上滑后内容继续增长 ⇒ 不再拽回底部;滑回底部后才恢复', () => {
    const r = mount([msg('a1', 'x')], true, true)
    userScroll(900)
    userScroll(1000)

    userScroll(200) // 用户上翻
    const afterDetach = scrollSpy.mock.calls.length

    rerenderWith(r, [msg('a1', '用户正在读历史时的又一段增长')], true, true)
    expect(scrollSpy.mock.calls.length).toBe(afterDetach)

    reachBottom() // 用户自己滑回底部
    rerenderWith(r, [msg('a1', '用户正在读历史时的又一段增长再加一段')], true, true)
    expect(scrollSpy.mock.calls.length).toBeGreaterThan(afterDetach)
  })

  it('切会话(首条 id 变化)后上一轮的上翻账目作废,恢复跟底', () => {
    const r = mount([msg('s1-a', 'first')], true, true)
    userScroll(1000)
    userScroll(200)
    const afterDetach = scrollSpy.mock.calls.length

    rerenderWith(r, [msg('s2-a', '另一个会话')], true, true)
    expect(scrollSpy.mock.calls.length).toBeGreaterThan(afterDetach)
  })

  it('非流式态不再振荡:内容变化不触发滚动', () => {
    const r = mount([msg('a1', 'x'), msg('a2', 'y')], false, true)
    const before = scrollSpy.mock.calls.length
    rerenderWith(r, [msg('a1', 'x'), msg('a2', 'y more')], false, true)
    expect(scrollSpy.mock.calls.length).toBe(before)
  })
})
