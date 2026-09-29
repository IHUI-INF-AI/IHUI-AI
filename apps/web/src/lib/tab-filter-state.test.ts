// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { resolveTabState, resolveFilterState } from '@/lib/tab-filter-state'

describe('tab-filter-state(b75-1#4)', () => {
  type Tab = 'all' | 'active' | 'done'
  type Filter = string

  const DEFAULT_FILTER: Filter = ''

  it('tab 相同返回原引用(Object.is)', () => {
    const prev = { tab: 'all' as Tab, filter: 'x' }
    const next = resolveTabState(prev, 'all', DEFAULT_FILTER)
    expect(Object.is(next, prev)).toBe(true)
  })

  it('tab 变更后 filter 重置为默认', () => {
    const prev = { tab: 'all' as Tab, filter: 'keyword' }
    const next = resolveTabState(prev, 'active', DEFAULT_FILTER)
    expect(next.tab).toBe('active')
    expect(next.filter).toBe('')
    expect(Object.is(next, prev)).toBe(false)
  })

  it('setState 传函数式更新时归约仍生效', () => {
    const prev = { tab: 'all' as Tab, filter: 'kw' }
    const next = resolveTabState(prev, (t) => (t === 'all' ? 'active' : 'all'), DEFAULT_FILTER)
    expect(next.tab).toBe('active')
    expect(next.filter).toBe('')
  })

  it('函数式更新返回同 tab ⇒ 原引用', () => {
    const prev = { tab: 'all' as Tab, filter: 'kw' }
    const next = resolveTabState(prev, (t) => t, DEFAULT_FILTER)
    expect(Object.is(next, prev)).toBe(true)
  })

  it('resolveFilterState:filter 未变返回原引用,变了返回新对象 tab 不变', () => {
    const prev = { tab: 'active' as Tab, filter: 'a' }
    expect(Object.is(resolveFilterState(prev, 'a'), prev)).toBe(true)
    const next = resolveFilterState(prev, 'b')
    expect(next.tab).toBe('active')
    expect(next.filter).toBe('b')
    expect(Object.is(next, prev)).toBe(false)
  })
})

