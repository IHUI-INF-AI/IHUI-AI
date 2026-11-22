// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-815941 —— 共享出口 enter-submit.ts 的纯函数用例。
// 组件级用例在各端(apps/web/src/components/chat/__tests__/web-input-core-enter-key-ordering.test.tsx);
// 这里逐输入穷尽判据本身,含腿三(收尾闩锁)这条最常见的漏点。
import { describe, expect, it } from 'vitest'
import {
  INITIAL_COMPOSITION_LATCH,
  noteCompositionEnd,
  noteCompositionStart,
  noteKeyDown,
  shouldSubmitOnEnter,
  type EnterSubmitSignals,
} from '../enter-submit'

const base: EnterSubmitSignals = {
  key: 'Enter',
  shiftKey: false,
  defaultPrevented: false,
  localComposing: false,
  nativeComposing: false,
  justEndedComposing: false,
  hasContent: true,
}
const decide = (over: Partial<EnterSubmitSignals> = {}) => shouldSubmitOnEnter({ ...base, ...over })

describe('shouldSubmitOnEnter — 腿一/腿二:合成期为 true ⇒ 绝不提交', () => {
  it('本地腿为 true(事件不带 isComposing)⇒ 不提交', () => {
    expect(decide({ localComposing: true })).toBe(false)
  })

  it('事件腿为 true(未触发 compositionstart)⇒ 不提交', () => {
    expect(decide({ nativeComposing: true })).toBe(false)
  })

  it('两条腿同时为 true ⇒ 不提交', () => {
    expect(decide({ localComposing: true, nativeComposing: true })).toBe(false)
  })
})

describe('shouldSubmitOnEnter — 腿三:compositionend 后第一次 Enter(关键漏点)', () => {
  // 这一组是本票的核心。部分引擎里"确认候选词"的那一次 Enter 排在 compositionend **之后**:
  // 此刻本地腿已被置回 false、事件腿也是 false,两腿并集放行 ⇒ 半截中文被当正文发出去。
  it('收尾闩锁为 true ⇒ 不提交(即便两条原生腿都已清)', () => {
    expect(
      decide({ localComposing: false, nativeComposing: false, justEndedComposing: true }),
    ).toBe(false)
  })

  it('真实序列:compositionstart → compositionend → 第一次 Enter ⇒ 不提交', () => {
    const latched = noteCompositionEnd()
    expect(latched.active).toBe(false)
    expect(latched.justEnded).toBe(true)
    // 这一次 keydown 的原生两腿都是 false,只有闩锁拦得住
    expect(
      decide({
        localComposing: latched.active,
        nativeComposing: false,
        justEndedComposing: latched.justEnded,
      }),
    ).toBe(false)
  })

  it('收尾闩锁消费过一次之后 ⇒ 恢复提交(闩锁只挡那一次,不得把 Enter 整个废掉)', () => {
    const first = noteCompositionEnd()
    expect(first.justEnded).toBe(true)
    // 第一次 Enter 被闩锁吃掉
    expect(decide({ justEndedComposing: first.justEnded })).toBe(false)
    // 该次 keydown 消费闩锁
    const second = noteKeyDown(first)
    expect(second.justEnded).toBe(false)
    // 用户再按一次 Enter(真的想发)⇒ 提交
    expect(decide({ justEndedComposing: second.justEnded })).toBe(true)
  })

  it('闩锁对任意键都消费(合成收尾后先按了别的键,不该把下一次真提交也吃掉)', () => {
    const latched = noteKeyDown(noteCompositionEnd())
    expect(latched.justEnded).toBe(false)
    expect(decide({ justEndedComposing: latched.justEnded })).toBe(true)
  })
})

describe('shouldSubmitOnEnter — 两腿都 false ⇒ 提交', () => {
  it('成对对照:无任何 IME 腿、无闩锁、有内容 ⇒ 提交', () => {
    expect(
      decide({
        localComposing: false,
        nativeComposing: false,
        justEndedComposing: false,
        hasContent: true,
      }),
    ).toBe(true)
  })
})

describe('shouldSubmitOnEnter — 空命令 + 无输入 ⇒ 不得提交(落回 awaiting/空态)', () => {
  it('无内容 ⇒ 不提交', () => {
    expect(decide({ hasContent: false })).toBe(false)
  })

  it('成对对照:同一形态下有内容 ⇒ 提交(不得把 Enter 整个废掉)', () => {
    expect(decide({ hasContent: true })).toBe(true)
  })

  it('空内容判据独立于 IME 三腿(组合期 + 无内容也是不提交,不两腿串味)', () => {
    expect(decide({ hasContent: false, localComposing: true })).toBe(false)
  })
})

describe('shouldSubmitOnEnter — 外部否决权与既有键序语义不变', () => {
  it('外部已 preventDefault ⇒ 不提交', () => {
    expect(decide({ defaultPrevented: true })).toBe(false)
  })

  it('Shift+Enter 是换行 ⇒ 不提交', () => {
    expect(decide({ shiftKey: true })).toBe(false)
  })

  it('非 Enter 键不归本判据消费', () => {
    expect(decide({ key: 'ArrowUp' })).toBe(false)
    expect(decide({ key: 'a' })).toBe(false)
  })

  it('组合期的 Backspace 不归本判据消费(附件删除是另一档判据)', () => {
    expect(decide({ key: 'Backspace' })).toBe(false)
  })
})

describe('闩锁 reducer — 状态转移只有这一处定义', () => {
  it('初态:两条腿皆清', () => {
    expect(INITIAL_COMPOSITION_LATCH).toEqual({ active: false, justEnded: false })
  })

  it('compositionstart ⇒ 进组合期,并清掉上一次组合可能残留的闩锁', () => {
    const stale = noteCompositionEnd()
    expect(stale.justEnded).toBe(true)
    const started = noteCompositionStart()
    expect(started).toEqual({ active: true, justEnded: false })
  })

  it('compositionend ⇒ 出组合期并置起闩锁', () => {
    expect(noteCompositionEnd()).toEqual({
      active: false,
      justEnded: true,
    })
  })

  it('闩锁已清时 keydown 是恒等转移(不改引用外的语义)', () => {
    const l = INITIAL_COMPOSITION_LATCH
    expect(noteKeyDown(l)).toEqual(l)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
