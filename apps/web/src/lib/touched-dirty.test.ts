// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { isTouchedDirty, diffTouchedFields } from '@/lib/touched-dirty'

describe('touched-dirty(b75-1#2)', () => {
  it('touched 为空 ⇒ dirty=false,即使值已被初始化归一化', () => {
    const baseline = { name: '' }
    const current = { name: '默认名' } // 初始化把 "" 归一为默认值
    expect(isTouchedDirty(current, baseline, new Set())).toBe(false)
  })

  it('baseline 缺席字段不算修改(防初始化回填误报 dirty)', () => {
    // 场景:后端返回 {} ,前端初始化把 email 回填为 "a@b.com";用户碰过 email 但未改
    const baseline = {}
    const current = { email: 'a@b.com' }
    expect(isTouchedDirty(current, baseline, new Set(['email']))).toBe(false)
    expect(diffTouchedFields(current, baseline, ['email'])).toEqual([])
  })

  it('用户改过字段 ⇒ dirty=true', () => {
    const baseline = { name: 'old' }
    const current = { name: 'new' }
    expect(isTouchedDirty(current, baseline, new Set(['name']))).toBe(true)
    expect(diffTouchedFields(current, baseline, ['name'])).toEqual(['name'])
  })

  it('用户改过又改回原值 ⇒ dirty=false(clean)', () => {
    const baseline = { name: 'old' }
    const current = { name: 'old' }
    expect(isTouchedDirty(current, baseline, new Set(['name']))).toBe(false)
  })

  it('多字段:只 touched 一个且未变 ⇒ false;另一个变了但未 touched ⇒ 不算', () => {
    const baseline = { a: 1, b: 2 }
    const current = { a: 1, b: 99 }
    // 只 touched a(a 未变),b 变了但用户没碰 ⇒ 不算 dirty
    expect(isTouchedDirty(current, baseline, new Set(['a']))).toBe(false)
    expect(diffTouchedFields(current, baseline, ['a'])).toEqual([])
    // touched b ⇒ dirty
    expect(isTouchedDirty(current, baseline, new Set(['b']))).toBe(true)
  })

  it('支持数组形式 touchedFields', () => {
    const baseline = { x: '1' }
    const current = { x: '2' }
    expect(isTouchedDirty(current, baseline, ['x'])).toBe(true)
  })
})

