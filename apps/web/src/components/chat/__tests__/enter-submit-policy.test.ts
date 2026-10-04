// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// enter-submit-policy 的纯函数用例(G-843/G-844 验收用例⑤及各判据的成对对照)。
// 组件级键序用例在 web-input-core-enter-key-ordering.test.tsx;这里逐输入穷尽判据本身。
import { describe, expect, it } from 'vitest'

import { shouldSubmitOnEnter, type EnterSubmitInputs } from '@/components/chat/enter-submit-policy'

const base: EnterSubmitInputs = {
  key: 'Enter',
  shiftKey: false,
  defaultPrevented: false,
  localComposing: false,
  nativeComposing: false,
  justEndedComposing: false,
  hasContent: true,
}
const decide = (over: Partial<EnterSubmitInputs> = {}) => shouldSubmitOnEnter({ ...base, ...over })

describe('enter-submit-policy — 外部否决权(G-843)', () => {
  it('外部已 preventDefault ⇒ 判"不提交"(验收用例⑤)', () => {
    expect(decide({ defaultPrevented: true })).toBe(false)
  })
  it('成对对照:外部未消费的同一条 Enter ⇒ 判"提交"', () => {
    expect(decide({ defaultPrevented: false })).toBe(true)
  })
})

describe('enter-submit-policy — IME 双腿取或(G-844)', () => {
  it('只置本地腿(nativeComposing=false)⇒ 不提交 —— 双保险的第二条腿', () => {
    expect(decide({ localComposing: true, nativeComposing: false })).toBe(false)
  })
  it('只置事件腿(localComposing=false)⇒ 不提交', () => {
    expect(decide({ localComposing: false, nativeComposing: true })).toBe(false)
  })
  it('成对对照:两腿皆清 ⇒ 提交(双保险不得把 Enter 整个废掉)', () => {
    expect(decide({ localComposing: false, nativeComposing: false })).toBe(true)
  })
})

describe('enter-submit-policy — 键序既有语义不变', () => {
  it('Shift+Enter 是换行 ⇒ 不提交', () => {
    expect(decide({ shiftKey: true })).toBe(false)
  })
  it('非 Enter 键不归本判据消费', () => {
    expect(decide({ key: 'ArrowUp' })).toBe(false)
    expect(decide({ key: 'a' })).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
