// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  invertConversationSelection,
  restrictConversationSelection,
  selectAllConversationSelection,
  toggleConversationSelection,
  useConversationSelection,
} from '../sidebar/use-conversation-selection'

/**
 * V3 #62:侧栏批量选择的选中集引擎单测。
 *
 * 判据来自被测源文件本身(import 真实实现,§22c —— 不在测试里另抄一份选择逻辑),
 * 覆盖两件事:
 *  1. 四个纯函数的集合语义(勾选/全选/反选/裁剪);
 *  2. hook 的"单一真相源"契约 —— 行内复选框与动作条读的是同一份 selectedIds,
 *     且列表变短后选中集不会挂在已消失的项上。
 */

describe('toggleConversationSelection', () => {
  it('未勾即勾:返回新集合且不含入参引用改动', () => {
    const base = new Set(['a'])
    const next = toggleConversationSelection(base, 'b')
    expect([...next].sort()).toEqual(['a', 'b'])
    // 入参不得被就地改写(React state 可变共享会让上一次渲染读到脏集合)
    expect([...base]).toEqual(['a'])
  })

  it('已勾即取消', () => {
    const next = toggleConversationSelection(new Set(['a', 'b']), 'a')
    expect([...next]).toEqual(['b'])
  })

  it('显式 checked=false 对未勾项是幂等的(不会凭空加进去)', () => {
    expect([...toggleConversationSelection(new Set<string>(), 'x', false)]).toEqual([])
  })

  it('显式 checked=true 对已勾项同样是幂等', () => {
    expect([...toggleConversationSelection(new Set(['x']), 'x', true)]).toEqual(['x'])
  })
})

describe('selectAllConversationSelection / invertConversationSelection', () => {
  it('全选取自可见列表,重复 id 只留一枚', () => {
    expect([...selectAllConversationSelection(['a', 'b', 'a'])]).toEqual(['a', 'b'])
  })

  it('反选只在可见集合内取补集,集合外的历史 id 一并丢弃', () => {
    const next = invertConversationSelection(new Set(['a', 'ghost']), ['a', 'b', 'c'])
    expect([...next].sort()).toEqual(['b', 'c'])
  })

  it('全选后再反选得到空集(与动作条上"再点一次"的观感一致)', () => {
    const all = selectAllConversationSelection(['a', 'b'])
    expect([...invertConversationSelection(all, ['a', 'b'])]).toEqual([])
  })
})

describe('restrictConversationSelection', () => {
  it('把选中集裁剪到当前可见列表:已删除项不再计入', () => {
    const next = restrictConversationSelection(new Set(['a', 'b', 'gone']), ['a', 'b', 'c'])
    expect([...next].sort()).toEqual(['a', 'b'])
  })

  it('顺序按可见列表而非勾选顺序(批量请求的 ids 稳定可读)', () => {
    const next = restrictConversationSelection(new Set(['c', 'a']), ['a', 'b', 'c'])
    expect([...next]).toEqual(['a', 'c'])
  })

  it('可见列表为空时一律裁成空集', () => {
    expect([...restrictConversationSelection(new Set(['a']), [])]).toEqual([])
  })
})

describe('useConversationSelection', () => {
  it('初始不在多选态,选中集为空,全选/半选都为 false', () => {
    const { result } = renderHook(() => useConversationSelection(['a', 'b']))
    expect(result.current.selectionMode).toBe(false)
    expect(result.current.selectedCount).toBe(0)
    expect(result.current.allSelected).toBe(false)
    expect(result.current.someSelected).toBe(false)
  })

  it('勾一项 → someSelected;勾满 → allSelected(两处消费面读到的是同一份集合)', () => {
    const { result } = renderHook(() => useConversationSelection(['a', 'b']))
    act(() => result.current.toggleSelected('a'))
    expect(result.current.selectedCount).toBe(1)
    expect(result.current.someSelected).toBe(true)
    expect(result.current.allSelected).toBe(false)
    // 行内复选框与动作条读同一个 selectedIds:此处只可能有一个真相源
    expect(result.current.isSelected('a')).toBe(result.current.selectedIds.has('a'))

    act(() => result.current.toggleSelected('b'))
    expect(result.current.allSelected).toBe(true)
    expect(result.current.someSelected).toBe(false)
    expect(result.current.orderedSelectedIds).toEqual(['a', 'b'])
  })

  it('可见列表变短(删除/搜索后)选中集当场裁剪,不出现"已选 3 项而列表只剩 2 行"', () => {
    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => useConversationSelection(ids),
      { initialProps: { ids: ['a', 'b', 'c'] } },
    )
    act(() => {
      result.current.selectAll(true, ['a', 'b', 'c'])
    })
    expect(result.current.selectedCount).toBe(3)

    // 后端删掉了 c(列表回源后少一项),选中数必须跟着降到 2
    rerender({ ids: ['a', 'b'] })
    expect(result.current.selectedCount).toBe(2)
    expect(result.current.orderedSelectedIds).toEqual(['a', 'b'])
  })

  it('退出多选态清空选中;重新进入时是干净的空集(唯一出口 toggle)', () => {
    const { result } = renderHook(() => useConversationSelection(['a', 'b']))
    act(() => result.current.enterSelectionMode())
    act(() => result.current.toggleSelected('a'))
    expect(result.current.selectedCount).toBe(1)

    act(() => result.current.toggleSelectionMode())
    expect(result.current.selectionMode).toBe(false)
    expect(result.current.selectedCount).toBe(0)

    act(() => result.current.enterSelectionMode())
    expect(result.current.selectedCount).toBe(0)
  })

  it('toggleSelectionMode 在"退出"那一支等价于 exit(同样清空)', () => {
    const { result } = renderHook(() => useConversationSelection(['a']))
    act(() => result.current.toggleSelectionMode())
    expect(result.current.selectionMode).toBe(true)
    act(() => result.current.toggleSelected('a'))
    act(() => result.current.toggleSelectionMode())
    expect(result.current.selectionMode).toBe(false)
    expect(result.current.selectedCount).toBe(0)
  })

  it('clear 只清选中、不改多选态(动作条上的"取消选择"不是退出)', () => {
    const { result } = renderHook(() => useConversationSelection(['a']))
    act(() => result.current.enterSelectionMode())
    act(() => result.current.toggleSelected('a'))
    act(() => result.current.clear())
    expect(result.current.selectedCount).toBe(0)
    expect(result.current.selectionMode).toBe(true)
  })

  it('空可见列表下 allSelected 恒 false(否则 0/0 会被读成"已全选")', () => {
    const { result } = renderHook(() => useConversationSelection([]))
    expect(result.current.allSelected).toBe(false)
    expect(result.current.someSelected).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
