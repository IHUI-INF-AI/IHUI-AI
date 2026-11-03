// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  OPEN_IN_APPS,
  WRITING_BLOCK_ACTIONS,
  WRITING_BLOCK_PHASES,
  WRITING_BLOCK_STATUSES,
  acceptAllRejection,
  applyWritingBlockAction,
  canAccept,
  canAcceptAll,
  canRevert,
  isWritingBlockAction,
  isWritingBlockStatus,
  openInLabel,
  writingBlockActionKey,
  writingBlockPhaseKey,
  writingBlockPhaseOf,
  writingBlockStatusKey,
  type OpenInApp,
  type WritingBlock,
  type WritingBlockState,
  type WritingBlockStatus,
} from '../writing-block'

const block = (
  id: string,
  status: WritingBlockStatus,
  original = `原文-${id}`,
  draft = `草稿-${id}`,
): WritingBlock => ({ id, status, original, draft })

const state = (...blocks: WritingBlock[]): WritingBlockState => ({ blocks })

const statusesOf = (next: WritingBlockState): string[] => next.blocks.map((b) => b.status)

describe('writing-block / 枚举卫生', () => {
  it('五态完整且无重复', () => {
    expect(WRITING_BLOCK_STATUSES.length).toBe(5)
    expect(new Set(WRITING_BLOCK_STATUSES).size).toBe(5)
    expect([...WRITING_BLOCK_STATUSES].sort()).toEqual(
      ['accepted', 'editing', 'failed', 'idle', 'reverted'].sort(),
    )
  })

  it('三动作恰为 accept / acceptAll / revert', () => {
    expect([...WRITING_BLOCK_ACTIONS]).toEqual(['accept', 'acceptAll', 'revert'])
  })

  it('三相位 inProgress / completed / failed', () => {
    expect([...WRITING_BLOCK_PHASES]).toEqual(['inProgress', 'completed', 'failed'])
  })

  it('打开方式至少含 email(台账原文形态)', () => {
    expect(OPEN_IN_APPS.length).toBeGreaterThanOrEqual(1)
    expect([...OPEN_IN_APPS]).toContain('email')
    expect(new Set(OPEN_IN_APPS).size).toBe(OPEN_IN_APPS.length)
  })

  it('isWritingBlockStatus 只认五态', () => {
    for (const s of WRITING_BLOCK_STATUSES) expect(isWritingBlockStatus(s)).toBe(true)
    for (const raw of ['', 'acceptedAll', 'Accepted', 'done']) {
      expect(isWritingBlockStatus(raw)).toBe(false)
    }
  })

  it('isWritingBlockAction 只认三动作(动作 id 会经回调往返)', () => {
    for (const a of WRITING_BLOCK_ACTIONS) expect(isWritingBlockAction(a)).toBe(true)
    for (const raw of ['', 'acceptall', 'undo', 'revertAll']) {
      expect(isWritingBlockAction(raw)).toBe(false)
    }
  })
})

describe('writing-block / 键名生成(各端据此拼 ai.pane.writingBlock)', () => {
  it('三动作 → action.<id>', () => {
    expect(writingBlockActionKey('accept')).toBe('action.accept')
    expect(writingBlockActionKey('acceptAll')).toBe('action.acceptAll')
    expect(writingBlockActionKey('revert')).toBe('action.revert')
  })

  it('五态 → status.<id>', () => {
    for (const s of WRITING_BLOCK_STATUSES) {
      expect(writingBlockStatusKey(s)).toBe(`status.${s}`)
    }
    expect(writingBlockStatusKey('failed')).toBe('status.failed')
  })

  it('动作 × 三相位 → phase.<action>.<phase>(9 键全覆盖)', () => {
    for (const a of WRITING_BLOCK_ACTIONS) {
      for (const p of WRITING_BLOCK_PHASES) {
        expect(writingBlockPhaseKey(a, p)).toBe(`phase.${a}.${p}`)
      }
    }
  })

  it('打开方式 → openIn.<app>(email 即台账「使用默认电子邮箱应用打开电子邮件」)', () => {
    expect(openInLabel('email')).toBe('openIn.email')
    for (const app of OPEN_IN_APPS) expect(openInLabel(app)).toBe(`openIn.${app}`)
  })

  it('五态 → 相位映射:editing=inProgress / accepted=completed / failed=failed,idle 与 reverted 无相位', () => {
    expect(writingBlockPhaseOf('editing')).toBe('inProgress')
    expect(writingBlockPhaseOf('accepted')).toBe('completed')
    expect(writingBlockPhaseOf('failed')).toBe('failed')
    expect(writingBlockPhaseOf('idle')).toBeNull()
    expect(writingBlockPhaseOf('reverted')).toBeNull()
  })
})

describe('writing-block / 逐块「接受」', () => {
  it('editing → accepted,并用 ctx.draft 覆盖定稿文本', () => {
    const s = state(block('b1', 'editing', '原文', '草稿'))
    const next = applyWritingBlockAction(s, 'accept', { draft: '用户改后的文本' })
    expect(statusesOf(next)).toEqual(['accepted'])
    expect(next.blocks[0]?.draft).toBe('用户改后的文本')
  })

  it('接受不覆盖 original(撤销的唯一依据必须留存)', () => {
    const s = state(block('b1', 'editing', '原始流内文本', '草稿'))
    const next = applyWritingBlockAction(s, 'accept', { draft: '定稿' })
    expect(next.blocks[0]?.original).toBe('原始流内文本')
  })

  it('不传 ctx.draft → 用当前 draft 定稿', () => {
    const next = applyWritingBlockAction(state(block('b1', 'editing', '原', '当前草稿')), 'accept')
    expect(next.blocks[0]?.draft).toBe('当前草稿')
  })

  it('idle / reverted 也可接受(canAccept 为真)', () => {
    for (const st of ['idle', 'reverted'] as const) {
      const next = applyWritingBlockAction(state(block('b1', st)), 'accept')
      expect(statusesOf(next), st).toEqual(['accepted'])
    }
  })

  it('accept 只作用于 ctx.blockId 指定的块,其余块引用不变', () => {
    const other = block('b2', 'editing')
    const s = state(block('b1', 'editing'), other)
    const next = applyWritingBlockAction(s, 'accept', { blockId: 'b2', draft: 'X' })
    expect(statusesOf(next)).toEqual(['editing', 'accepted'])
    expect(next.blocks[0]).toBe(s.blocks[0])
  })

  it('已 accepted 的块不再可接受(需先 revert),原样返回且引用相等', () => {
    const s = state(block('b1', 'accepted'))
    expect(canAccept(s.blocks[0]!)).toBe(false)
    expect(applyWritingBlockAction(s, 'accept')).toBe(s)
  })

  it('目标块不存在 → 原样返回(引用相等),不抛错、不误伤其他块', () => {
    const s = state(block('b1', 'editing'))
    expect(applyWritingBlockAction(s, 'accept', { blockId: 'nope' })).toBe(s)
  })

  it('空批 → 原样返回(引用相等)', () => {
    const s = state()
    expect(applyWritingBlockAction(s, 'accept')).toBe(s)
  })
})

describe('writing-block / 逐块「撤销」可逆(核心判据)', () => {
  it('accepted → reverted,draft 回到 accepted 前的原文', () => {
    const s = state(block('b1', 'editing', '接受前原文', '编辑后草稿'))
    const accepted = applyWritingBlockAction(s, 'accept', { draft: '编辑后草稿' })
    expect(accepted.blocks[0]?.draft).toBe('编辑后草稿')

    const reverted = applyWritingBlockAction(accepted, 'revert')
    expect(statusesOf(reverted)).toEqual(['reverted'])
    expect(reverted.blocks[0]?.draft).toBe('接受前原文')
    expect(reverted.blocks[0]?.original).toBe('接受前原文')
  })

  it('撤销后可再次接受(accept → revert → accept 往返,三步都不丢文本)', () => {
    const s = state(block('b1', 'editing', '原文', '草稿'))
    const a1 = applyWritingBlockAction(s, 'accept', { draft: '第一次定稿' })
    const r1 = applyWritingBlockAction(a1, 'revert')
    expect(canAccept(r1.blocks[0]!)).toBe(true)

    const a2 = applyWritingBlockAction(r1, 'accept', { draft: '第二次定稿' })
    expect(statusesOf(a2)).toEqual(['accepted'])
    expect(a2.blocks[0]?.draft).toBe('第二次定稿')
    expect(a2.blocks[0]?.original).toBe('原文')

    // 第二次撤销仍回到同一份原文 —— 往返任意次都不漂移
    const r2 = applyWritingBlockAction(a2, 'revert')
    expect(r2.blocks[0]?.draft).toBe('原文')
  })

  it('撤销可反复往返 5 次且状态收敛(无累积漂移)', () => {
    let cur = state(block('b1', 'editing', '锚点原文', '锚点草稿'))
    for (let i = 0; i < 5; i += 1) {
      cur = applyWritingBlockAction(cur, 'accept', { draft: `第${i}稿` })
      expect(statusesOf(cur), `accept#${i}`).toEqual(['accepted'])
      expect(cur.blocks[0]?.draft).toBe(`第${i}稿`)
      cur = applyWritingBlockAction(cur, 'revert')
      expect(statusesOf(cur), `revert#${i}`).toEqual(['reverted'])
      expect(cur.blocks[0]?.draft, `revert#${i}`).toBe('锚点原文')
    }
  })

  it('revert 只作用于 ctx.blockId 指定的块', () => {
    const s = state(block('b1', 'accepted'), block('b2', 'accepted'))
    const next = applyWritingBlockAction(s, 'revert', { blockId: 'b2' })
    expect(statusesOf(next)).toEqual(['accepted', 'reverted'])
  })

  it('未接受的块不可撤销(无"接受前原文"可回),原样返回', () => {
    for (const st of ['idle', 'editing', 'reverted', 'failed'] as const) {
      const s = state(block('b1', st))
      expect(canRevert(s.blocks[0]!), st).toBe(false)
      expect(applyWritingBlockAction(s, 'revert'), st).toBe(s)
    }
  })

  it('canRevert / canAccept 互斥于 accepted 一态(逐态断言)', () => {
    const expected: Record<WritingBlockStatus, [accept: boolean, revert: boolean]> = {
      idle: [true, false],
      editing: [true, false],
      accepted: [false, true],
      reverted: [true, false],
      failed: [false, false],
    }
    for (const st of WRITING_BLOCK_STATUSES) {
      const b = block('b1', st)
      expect([canAccept(b), canRevert(b)], st).toEqual(expected[st])
    }
  })
})

describe('writing-block / 失败态「无法更新此写作块」', () => {
  it('failed 既不可接受也不可撤销,两个动作都原样返回', () => {
    const s = state(block('b1', 'failed', '原文', '草稿'))
    expect(canAccept(s.blocks[0]!)).toBe(false)
    expect(canRevert(s.blocks[0]!)).toBe(false)
    expect(applyWritingBlockAction(s, 'accept')).toBe(s)
    expect(applyWritingBlockAction(s, 'revert')).toBe(s)
  })

  it('failed 的相位是 failed(供 UI 取 phase.*.failed 文案)', () => {
    expect(writingBlockPhaseOf('failed')).toBe('failed')
  })

  it('失败不吞掉文本:original / draft 原样保留,便于重试', () => {
    const s = state(block('b1', 'failed', '原文', '草稿'))
    const next = applyWritingBlockAction(s, 'accept')
    expect(next.blocks[0]?.original).toBe('原文')
    expect(next.blocks[0]?.draft).toBe('草稿')
  })
})

describe('writing-block / 「全部接受」只作用于整批可接受态(核心判据)', () => {
  it('全批可接受 → 全部落 accepted', () => {
    const s = state(block('b1', 'idle'), block('b2', 'editing'), block('b3', 'reverted'))
    const next = applyWritingBlockAction(s, 'acceptAll')
    expect(statusesOf(next)).toEqual(['accepted', 'accepted', 'accepted'])
    expect(canAcceptAll(s)).toBe(true)
    expect(acceptAllRejection(s)).toBeNull()
  })

  it('存在 failed 块 → 拒绝整批:引用相等,且已可接受的块也不被部分接受(不得静默跳过)', () => {
    const s = state(block('b1', 'idle'), block('b2', 'failed'), block('b3', 'editing'))
    const next = applyWritingBlockAction(s, 'acceptAll')
    // 整批未生效:同一引用
    expect(next).toBe(s)
    // 逐块核查:没有任何块被改成 accepted(尤其 b1 / b3 这两个"本可接受"的块)
    expect(statusesOf(next)).toEqual(['idle', 'failed', 'editing'])
    expect(next.blocks.filter((b) => b.status === 'accepted').length).toBe(0)
    // 拒绝原因可机检
    expect(acceptAllRejection(s)).toBe('failed')
    expect(canAcceptAll(s)).toBe(false)
  })

  it('failed 在末位同样拒绝整批(failed 位置不影响判定)', () => {
    const s = state(block('b1', 'editing'), block('b2', 'idle'), block('b3', 'failed'))
    expect(applyWritingBlockAction(s, 'acceptAll')).toBe(s)
  })

  it('存在已 accepted 的块 → 同样拒绝整批(它不在可接受态,静默忽略等于撒谎)', () => {
    const s = state(block('b1', 'accepted'), block('b2', 'idle'))
    expect(applyWritingBlockAction(s, 'acceptAll')).toBe(s)
    expect(acceptAllRejection(s)).toBe('notAcceptable')
  })

  it('failed 优先于 notAcceptable 作为拒绝原因(失败信息更有价值)', () => {
    const s = state(block('b1', 'accepted'), block('b2', 'failed'))
    expect(acceptAllRejection(s)).toBe('failed')
  })

  it('空批 → 拒绝原因 empty,且原样返回', () => {
    const s = state()
    expect(acceptAllRejection(s)).toBe('empty')
    expect(canAcceptAll(s)).toBe(false)
    expect(applyWritingBlockAction(s, 'acceptAll')).toBe(s)
  })

  it('failed 块修好后(重新落到 editing)→ 整批可再次接受', () => {
    const blocked = state(block('b1', 'idle'), block('b2', 'failed'))
    expect(applyWritingBlockAction(blocked, 'acceptAll')).toBe(blocked)

    const recovered = state(block('b1', 'idle'), { ...block('b2', 'editing') })
    expect(canAcceptAll(recovered)).toBe(true)
    expect(statusesOf(applyWritingBlockAction(recovered, 'acceptAll'))).toEqual([
      'accepted',
      'accepted',
    ])
  })

  it('acceptAll 不改写任何 original(撤销依据不被整批操作污染)', () => {
    const s = state(block('b1', 'editing', '原一'), block('b2', 'editing', '原二'))
    const next = applyWritingBlockAction(s, 'acceptAll')
    expect(next.blocks.map((b) => b.original)).toEqual(['原一', '原二'])
  })

  it('acceptAll 后可逐块撤销(整批接受与逐块撤销不冲突)', () => {
    const s = state(block('b1', 'editing', '原一'), block('b2', 'editing', '原二'))
    const accepted = applyWritingBlockAction(s, 'acceptAll')
    const next = applyWritingBlockAction(accepted, 'revert', { blockId: 'b2' })
    expect(statusesOf(next)).toEqual(['accepted', 'reverted'])
    expect(next.blocks[1]?.draft).toBe('原二')
  })
})

describe('writing-block / 打开方式键名与枚举对齐', () => {
  it('OPEN_IN_APPS 每一项都能产出键名,且 email 项即台账原文键', () => {
    const keys = OPEN_IN_APPS.map((app: OpenInApp) => openInLabel(app))
    expect(keys).toContain('openIn.email')
    expect(new Set(keys).size).toBe(OPEN_IN_APPS.length)
    for (const k of keys) expect(k).toMatch(/^openIn\.[a-zA-Z]+$/)
  })
})
