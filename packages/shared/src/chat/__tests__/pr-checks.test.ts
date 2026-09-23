// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  CI_CHECK_STATES,
  CI_CHECKS_SUMMARIES,
  PR_CHECK_ACTIONS,
  checksSummaryKey,
  ciCheckStateKey,
  countChecksByState,
  deriveChecksSummary,
  isCiCheckState,
  normalizeCiCheckState,
  prCheckActionKey,
  shouldOfferFix,
  type CiCheck,
} from '../pr-checks'

const check = (name: string, state: CiCheck['state']): CiCheck => ({ name, state })

describe('pr-checks / 枚举卫生', () => {
  it('六态完整且无重复', () => {
    expect(CI_CHECK_STATES.length).toBe(6)
    expect(new Set(CI_CHECK_STATES).size).toBe(6)
    expect([...CI_CHECK_STATES].sort()).toEqual(
      ['failed', 'neutral', 'passed', 'pending', 'skipped', 'unknown'].sort(),
    )
  })

  it('聚合态含空态 none', () => {
    expect([...CI_CHECKS_SUMMARIES].sort()).toEqual(['failing', 'none', 'pending', 'successful'])
  })

  it('动作族四键(与 D15/G-135 交叉引用)', () => {
    expect([...PR_CHECK_ACTIONS]).toEqual(['checksFix', 'checksRemove', 'commentsAddress', 'commentsRemove'])
  })

  it('isCiCheckState 只认六态', () => {
    for (const s of CI_CHECK_STATES) expect(isCiCheckState(s)).toBe(true)
    expect(isCiCheckState('success')).toBe(false)
    expect(isCiCheckState('')).toBe(false)
  })
})

describe('pr-checks / 状态归一化(平台形态 → 六态)', () => {
  it('成功类同义词归 passed', () => {
    for (const raw of ['success', 'SUCCEEDED', 'passed', ' Passed ']) {
      expect(normalizeCiCheckState(raw)).toBe('passed')
    }
  })

  it('失败类同义词归 failed', () => {
    for (const raw of ['failure', 'errored', 'error', 'FAILED']) {
      expect(normalizeCiCheckState(raw)).toBe('failed')
    }
  })

  it('进行中类同义词归 pending', () => {
    for (const raw of ['queued', 'in_progress', 'running', 'pending']) {
      expect(normalizeCiCheckState(raw)).toBe('pending')
    }
  })

  it('取消/跳过归 skipped', () => {
    for (const raw of ['cancelled', 'canceled', 'skipped']) {
      expect(normalizeCiCheckState(raw)).toBe('skipped')
    }
  })

  it('neutral / stale 归 neutral', () => {
    for (const raw of ['neutral', 'stale']) expect(normalizeCiCheckState(raw)).toBe('neutral')
  })

  it('认不出的形态与空值一律归 unknown —— 不编造、不抛错', () => {
    for (const raw of ['', '   ', null, undefined, 'wat', 'нечто']) {
      expect(normalizeCiCheckState(raw)).toBe('unknown')
    }
  })
})

describe('pr-checks / 聚合判定', () => {
  it('无检查(undefined / null / 空数组)→ none', () => {
    expect(deriveChecksSummary(undefined)).toBe('none')
    expect(deriveChecksSummary(null)).toBe('none')
    expect(deriveChecksSummary([])).toBe('none')
  })

  it('存在 failed → failing(失败压过其他一切)', () => {
    expect(deriveChecksSummary([check('a', 'failed')])).toBe('failing')
    expect(
      deriveChecksSummary([check('a', 'passed'), check('b', 'failed'), check('c', 'pending')]),
    ).toBe('failing')
  })

  it('无 failed 但有 pending → pending', () => {
    expect(deriveChecksSummary([check('a', 'passed'), check('b', 'pending')])).toBe('pending')
  })

  it('无 failed/pending 但有 unknown → pending(状态未知不得宣称成功)', () => {
    expect(deriveChecksSummary([check('a', 'passed'), check('b', 'unknown')])).toBe('pending')
    expect(deriveChecksSummary([check('a', 'unknown')])).toBe('pending')
  })

  it('skipped / neutral 不阻塞成功', () => {
    expect(deriveChecksSummary([check('a', 'passed')])).toBe('successful')
    expect(deriveChecksSummary([check('a', 'passed'), check('b', 'skipped')])).toBe('successful')
    expect(deriveChecksSummary([check('a', 'neutral')])).toBe('successful')
    expect(
      deriveChecksSummary([check('a', 'passed'), check('b', 'skipped'), check('c', 'neutral')]),
    ).toBe('successful')
  })

  it('单条 pending 也算 pending(不因数量少而降级)', () => {
    expect(deriveChecksSummary([check('only', 'pending')])).toBe('pending')
  })
})

describe('pr-checks / 计数与键名', () => {
  it('按六态计数,缺失态记 0', () => {
    const counts = countChecksByState([
      check('a', 'passed'),
      check('b', 'passed'),
      check('c', 'failed'),
      check('d', 'unknown'),
    ])
    expect(counts).toEqual({ failed: 1, passed: 2, pending: 0, skipped: 0, neutral: 0, unknown: 1 })
  })

  it('空输入计数全 0', () => {
    expect(countChecksByState(undefined)).toEqual({
      failed: 0,
      passed: 0,
      pending: 0,
      skipped: 0,
      neutral: 0,
      unknown: 0,
    })
  })

  it('键名生成稳定(各端据此拼命名空间)', () => {
    expect(ciCheckStateKey('neutral')).toBe('state.neutral')
    expect(ciCheckStateKey('unknown')).toBe('state.unknown')
    expect(checksSummaryKey('none')).toBe('summary.none')
    expect(prCheckActionKey('checksFix')).toBe('action.checksFix')
  })

  it('每个六态 / 每个聚合态都能产出键名(无遗漏)', () => {
    for (const s of CI_CHECK_STATES) expect(ciCheckStateKey(s)).toMatch(/^state\.[a-z]+$/)
    for (const s of CI_CHECKS_SUMMARIES) expect(checksSummaryKey(s)).toMatch(/^summary\.[a-z]+$/)
  })
})

describe('pr-checks / 动作可见性', () => {
  it('只有确有失败时才提供「修复」入口', () => {
    expect(shouldOfferFix('failing')).toBe(true)
    for (const s of ['none', 'pending', 'successful'] as const) {
      expect(shouldOfferFix(s)).toBe(false)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
