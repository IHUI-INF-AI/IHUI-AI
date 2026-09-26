// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// V3 第 61 票 判据①②:`@` 提及在对话输入链路的三段(出候选 / 能选中 / 选中后进消息),
// 以及 MentionChips 的「有提及必渲染、无提及必 null」+ 它读的是唯一那份 mention engine 状态。
//
// 全部跑生产出口:FileMentionPopover(真实渲染,只有取数 hook 被替身)、
// useMentionWiring(真实 hook + 真实 store)、MentionChips(真实组件)。
// 断言里没有一处复制实现的判定逻辑(§22c)。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, act, renderHook, cleanup } from '@testing-library/react'

import type { ContextMention } from '@ihui/types'

/** 取数面替身:只把 fetch/react-query 那一层换掉,组件与 store 都是真的 */
const searchState = vi.hoisted(() => ({
  current: {
    mentions: [] as ContextMention[],
    isFetching: false,
    isError: false,
  },
  calls: [] as Array<{ query: string; type: string; enabled: boolean }>,
}))

vi.mock('next-intl', () => ({
  // 无 ns 调用时键是完整路径;带 ns 调用时拼一层。两条都是生产端会用到的形态。
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}))

vi.mock('@/hooks/use-context-mention', () => ({
  useSearchMentions: (query: string, type: string, _ws?: string, enabled = true) => {
    searchState.calls.push({ query, type, enabled })
    return {
      data: { mentions: searchState.current.mentions, total: searchState.current.mentions.length },
      isFetching: searchState.current.isFetching,
      isError: searchState.current.isError,
    }
  },
}))

vi.mock('@/lib/workspace-context-loader', () => ({
  getBrowserWorkspaceHandle: () => null,
}))

vi.mock('@/stores/ai-panel', () => ({
  useAiPanelStore: Object.assign(
    (selector: (s: { activeWorkspace: { path: string; name: string } }) => unknown) =>
      selector({ activeWorkspace: { path: '/work/demo', name: 'demo' } }),
    { getState: () => ({ activeWorkspace: { path: '/work/demo', name: 'demo' } }) },
  ),
}))

// PortalPanel 要量锚点位置;happy-dom 拿不到布局,直接把子节点就地渲染
vi.mock('@/components/feedback/portal-panel', () => ({
  PortalPanel: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? React.createElement('div', { 'data-testid': 'portal-panel' }, children) : null,
}))

import { FileMentionPopover } from '@/components/ai/file-mention-popover'
import { MentionChips } from '@/components/chat/mention-popover'
import { useMentionWiring } from '@/hooks/use-mention-wiring'
import { useContextMentionStore } from '@/stores/context-mention'
import { findDimension, selectionFromDimension } from '@ihui/shared/chat/mention-engine'

const FILES = [{ id: 'f1', name: 'a.ts', path: 'src/a.ts' }]

/** 读那份唯一状态(不经组件,免得把"store 有值"与"组件渲染了"混成一件事) */
const selections = () => useContextMentionStore.getState().mentions

beforeEach(() => {
  // store 是模块级单例:清 mentions 之外还要把维度 tab 复位,否则上一条用例切到的维度
  // 会漏到下一条,把"默认维度不白打接口"这条断言测成别的东西。
  act(() => useContextMentionStore.setState({ mentions: [], activeDimensionId: 'at-file' }))
  searchState.current = { mentions: [], isFetching: false, isError: false }
  searchState.calls.length = 0
})

// 本仓 vitest 未开 globals ⇒ @testing-library 的自动 cleanup 不会注册(与其它
// tests/*.test.tsx 同形,须显式 afterEach(cleanup))。少了它,上一条用例的浮层会
// 留在 DOM 里,下一条的 getByTestId('mention-dimension-tab-…') 就命中多个元素。
afterEach(cleanup)

describe('判据①-1 @ 出候选:非文件维度必须真的向统一检索出口取数', () => {
  it('打开时默认文件维度不触发检索(不白打接口)', () => {
    render(
      <FileMentionPopover
        files={FILES}
        open
        anchorRef={{ current: null }}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    )
    const call = searchState.calls.at(-1)
    expect(call?.enabled).toBe(false)
    expect(screen.getByText('src/a.ts')).toBeTruthy()
  })

  it('切到「符号」维度后才取数,且后端候选真的出现在面板里', () => {
    searchState.current.mentions = [
      {
        id: 'symbol:parseMentionTrigger',
        type: 'symbol',
        label: 'parseMentionTrigger',
        detail: 'packages/shared/src/chat/mention-engine.ts',
        insertText: '@symbol:parseMentionTrigger',
      },
    ]
    render(
      <FileMentionPopover
        files={FILES}
        open
        anchorRef={{ current: null }}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    )
    fireEvent.click(screen.getByTestId('mention-dimension-tab-chat.mentionEngine.tabSymbol'))

    const call = searchState.calls.at(-1)
    expect(call?.enabled).toBe(true)
    expect(call?.type).toBe('symbol')
    expect(screen.getByText('parseMentionTrigger')).toBeTruthy()
  })

  it('取数中 / 失败 / 空结果三态都可见(静默变空等于伪造完整性)', () => {
    // 取数面是替身:它内部的三态翻转不会自己触发重渲染,必须显式 rerender 才有新 DOM。
    // 每次都造一枚新元素 —— React 对"同一个元素引用"会 bail out,rerender 会变成空转
    // (那样这条断言读到的永远是上一次渲染的 DOM,即假绿)。
    const make = () => (
      <FileMentionPopover
        files={FILES}
        open
        anchorRef={{ current: null }}
        onSelect={() => {}}
        onClose={() => {}}
      />
    )
    const view = render(make())
    fireEvent.click(screen.getByTestId('mention-dimension-tab-chat.mentionEngine.tabDatabase'))

    searchState.current.isFetching = true
    act(() => view.rerender(make()))
    expect(screen.getByTestId('mention-dimension-state').textContent).toContain(
      'mentionEngine.searching',
    )

    searchState.current.isFetching = false
    searchState.current.isError = true
    act(() => view.rerender(make()))
    expect(screen.getByTestId('mention-dimension-state').textContent).toContain(
      'mentionEngine.loadFailed',
    )

    // 第三态:取数结束而结果为空 ⇒ 必须明写"无匹配",不得静默变空
    searchState.current.isError = false
    act(() => view.rerender(make()))
    expect(screen.getByTestId('mention-dimension-state').textContent).toContain(
      'mentionEngine.noMatch',
    )
  })
})

describe('判据①-2/-3 @ 选中并进消息', () => {
  it('点候选 → onSelect 收到引擎形态的 MentionSelection', () => {
    searchState.current.mentions = [
      {
        id: 'symbol:x',
        type: 'symbol',
        label: 'SymbolX',
        insertText: '@symbol:x',
        meta: { path: 'src/x.ts' },
      },
    ]
    const onSelect = vi.fn()
    render(
      <FileMentionPopover
        files={FILES}
        open
        anchorRef={{ current: null }}
        onSelect={onSelect}
        onClose={() => {}}
      />,
    )
    fireEvent.click(screen.getByTestId('mention-dimension-tab-chat.mentionEngine.tabSymbol'))
    fireEvent.click(screen.getByTestId('mention-item-at-symbol:symbol:x'))

    expect(onSelect).toHaveBeenCalledTimes(1)
    const sel = onSelect.mock.calls[0][0]
    expect(sel).toMatchObject({
      dimensionId: 'at-symbol',
      sigil: '@',
      insertText: '@symbol:x',
      label: 'SymbolX',
    })
  })

  it('选中后 insertText 真的落到正文(正文就是 submit 发出去的那个 value)', () => {
    let value = '帮我看 @'
    const setValue: React.Dispatch<React.SetStateAction<string>> = (v) => {
      value = typeof v === 'function' ? (v as (p: string) => string)(value) : v
    }
    const inputRef: React.RefObject<{ focus: () => void; resize: () => void } | null> = {
      current: { focus: () => {}, resize: () => {} },
    }
    const { result } = renderHook(() => useMentionWiring({ setValue, inputRef }))

    act(() => {
      result.current.applyAtSelection({
        id: 'at-file:f1',
        sigil: '@',
        dimensionId: 'at-file',
        label: 'src/a.ts',
        insertText: '`src/a.ts`',
      })
    })

    expect(value).toBe('帮我看 `src/a.ts` ')
    expect(selections().map((s) => s.id)).toEqual(['at-file:f1'])
  })

  it('# 侧与 @ 侧落进同一份状态(不是两套引擎各存一半)', () => {
    const { result } = renderHook(() =>
      useMentionWiring({
        setValue: () => {},
        inputRef: { current: { focus: () => {}, resize: () => {} } },
      }),
    )
    act(() => {
      result.current.addMention(selectionFromDimension(findDimension('hash-rule')!))
    })
    act(() => {
      result.current.applyAtSelection({
        id: 'at-symbol:s1',
        sigil: '@',
        dimensionId: 'at-symbol',
        label: 'SymbolX',
        insertText: '@symbol:s1',
      })
    })
    const list = selections()
    expect(list.map((s) => s.sigil).sort()).toEqual(['#', '@'])
    expect(new Set(list.map((s) => s.id)).size).toBe(2)
  })
})

describe('判据② MentionChips:有提及必渲染、无提及必 null,且只读那一份状态', () => {
  it('空状态 ⇒ 整个面不渲染(零占位)', () => {
    const { container } = render(<MentionChips />)
    expect(container.textContent).toBe('')
    expect(screen.queryByTestId('mention-chip-row')).toBeNull()
  })

  it('store 里有一条 ⇒ chip 出现,内容含插入文本', () => {
    act(() => {
      useContextMentionStore.getState().addMention({
        id: 'at-database:users',
        sigil: '@',
        dimensionId: 'at-database',
        label: 'users',
        insertText: '@database:users',
      })
    })
    render(<MentionChips />)
    const chip = screen.getByTestId('mention-chip-at-database:users')
    expect(chip.textContent).toContain('@database:users')
  })

  it('点 × 走调用方注入的完整落点:状态与正文一起收,不留分叉', () => {
    const selection = {
      id: 'hash-rule:#Rule',
      sigil: '#' as const,
      dimensionId: 'hash-rule',
      label: '#Rule',
      insertText: '#Rule',
    }
    act(() => {
      useContextMentionStore.getState().addMention(selection)
    })
    const onRemove = vi.fn((s: typeof selection) => {
      useContextMentionStore.getState().removeMention(s.id)
    })
    render(<MentionChips onRemove={onRemove} />)
    fireEvent.click(screen.getByRole('button', { name: 'contextSelector.removeChip' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(selections()).toHaveLength(0)
  })

  it('不传 onRemove 时仍会清状态(组件自身不依赖调用方才成立)', () => {
    act(() => {
      useContextMentionStore.getState().addMention({
        id: 'hash-doc:#Doc',
        sigil: '#',
        dimensionId: 'hash-doc',
        label: '#Doc',
        insertText: '#Doc',
      })
    })
    render(<MentionChips />)
    fireEvent.click(screen.getByRole('button', { name: 'contextSelector.removeChip' }))
    expect(selections()).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
