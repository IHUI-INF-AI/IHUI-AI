// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  POLISH_ACTIONS,
  POLISH_EMPTY_RESULT,
  POLISH_FIXED_KEYS,
  POLISH_PHASES,
  POLISH_REJECTIONS,
  POLISH_RESTART_REASONS,
  applyPolishResult,
  beginPolish,
  canRetry,
  canStartPolish,
  createPolishState,
  isPolishPhase,
  polishActionKey,
  polishDraftAfter,
  polishFixedKey,
  polishPhaseKey,
  polishRejection,
  polishRejectionKey,
  restartHintNeeded,
  type PolishFixedKey,
  type PolishPhase,
  type PromptPolishState,
} from '../prompt-polish'

const ORIGINAL = '帮我写个总结'
const POLISHED = '请帮我撰写一份条理清晰的总结，覆盖要点并给出结论。'

/** 造一个"已发起润色"的 state(非空草稿 → polishing) */
function polishing(draft = ORIGINAL): PromptPolishState {
  return beginPolish(createPolishState(draft))
}

describe('D82 prompt-polish / 枚举卫生', () => {
  it('四相位完整且无重复(idle / polishing / succeeded / failed)', () => {
    expect([...POLISH_PHASES]).toEqual(['idle', 'polishing', 'succeeded', 'failed'])
    expect(new Set(POLISH_PHASES).size).toBe(4)
  })

  it('入口动作恰为 polish / retry', () => {
    expect([...POLISH_ACTIONS]).toEqual(['polish', 'retry'])
  })

  it('拒绝原因至少含 emptyDraft', () => {
    expect([...POLISH_REJECTIONS]).toContain('emptyDraft')
    expect(new Set(POLISH_REJECTIONS).size).toBe(POLISH_REJECTIONS.length)
  })

  it('固定文案键齐备(入口标签 / ariaLabel / 失败保稿 / 重启保稿)', () => {
    expect([...POLISH_FIXED_KEYS].sort()).toEqual(
      ['entryLabel', 'ariaLabel', 'failureDraftKept', 'restartHint'].sort(),
    )
  })

  it('isPolishPhase 只认四相位', () => {
    for (const p of POLISH_PHASES) expect(isPolishPhase(p)).toBe(true)
    for (const raw of ['', 'Polish', 'succeed', 'done', 'running']) {
      expect(isPolishPhase(raw), raw).toBe(false)
    }
  })

  it('「需重启生效」原因白名单非空且无重复', () => {
    expect(POLISH_RESTART_REASONS.length).toBeGreaterThanOrEqual(1)
    expect(new Set(POLISH_RESTART_REASONS).size).toBe(POLISH_RESTART_REASONS.length)
  })
})

describe('D82 prompt-polish / 键名生成(各端据此拼 ai.pane.promptPolish)', () => {
  it('四相位 → phase.<key>', () => {
    for (const p of POLISH_PHASES) expect(polishPhaseKey(p)).toBe(`phase.${p}`)
    expect(polishPhaseKey('failed')).toBe('phase.failed')
  })

  it('两动作 → action.<key>', () => {
    expect(polishActionKey('polish')).toBe('action.polish')
    expect(polishActionKey('retry')).toBe('action.retry')
  })

  it('拒绝原因 → rejection.<key>', () => {
    expect(polishRejectionKey('emptyDraft')).toBe('rejection.emptyDraft')
  })

  it('固定键 → 键名即取值(可被 UI 直接 t())', () => {
    for (const k of POLISH_FIXED_KEYS) {
      const key: PolishFixedKey = k
      expect(polishFixedKey(key)).toBe(k)
    }
  })
})

describe('D82 prompt-polish / ① 成功 = 就地改写(替换草稿)', () => {
  it('succeeded → draft 被润色结果**替换**,且 original 保留改前快照', () => {
    const before = polishing(ORIGINAL)
    const after = applyPolishResult(before, { kind: 'succeeded', text: POLISHED })

    expect(after.phase).toBe('succeeded')
    expect(after.draft).toBe(POLISHED)
    expect(after.original).toBe(ORIGINAL)
    expect(after.error).toBeNull()
    expect(after.rejection).toBeNull()
  })

  it('不是"插入模板"、也不是"拼接":结果就是草稿本身(逐字节)', () => {
    const before = polishing(ORIGINAL)
    const after = applyPolishResult(before, { kind: 'succeeded', text: POLISHED })

    // 既不等于"原稿 + 结果",也不等于"结果 + 原稿",也不含模板前缀
    expect(after.draft).not.toBe(`${ORIGINAL}${POLISHED}`)
    expect(after.draft).not.toBe(`${POLISHED}${ORIGINAL}`)
    expect(after.draft).not.toContain('请润色以下文本')
    expect(after.draft.length).toBe(POLISHED.length)
  })

  it('成功不改写 original(改前快照可供 UI 展示 diff)', () => {
    const before = polishing(ORIGINAL)
    expect(applyPolishResult(before, { kind: 'succeeded', text: POLISHED }).original).toBe(ORIGINAL)
  })

  it('成功结果含前导 / 尾随空白时按原样落库(不做 trim 改写)', () => {
    const text = `  ${POLISHED}  `
    expect(applyPolishResult(polishing(ORIGINAL), { kind: 'succeeded', text }).draft).toBe(text)
  })
})

describe('D82 prompt-polish / ② 失败 = 保稿(草稿字节级不变)', () => {
  it('failed → draftAfter 恒等于原稿(逐字节),且 original 不动', () => {
    const before = polishing(ORIGINAL)
    const after = applyPolishResult(before, { kind: 'failed', error: 'network down' })

    expect(after.phase).toBe('failed')
    expect(polishDraftAfter(after)).toBe(ORIGINAL)
    expect(after.draft).toBe(ORIGINAL)
    expect(after.original).toBe(ORIGINAL)
    expect(after.error).toBe('network down')
  })

  it('失败不吞掉文本:含换行 / 前后空白的草稿逐字节保留', () => {
    const draft = '  第一行\n第二行\n\n  结尾两个空格  '
    const before = polishing(draft)
    const after = applyPolishResult(before, { kind: 'failed' })
    expect(polishDraftAfter(after)).toBe(draft)
    expect(after.error).toBeNull()
  })

  it('失败不消耗 state:失败态上再次失败,草稿仍是同一字节序', () => {
    const first = applyPolishResult(polishing(ORIGINAL), { kind: 'failed', error: 'e1' })
    const second = applyPolishResult(first, { kind: 'failed', error: 'e2' })
    expect(polishDraftAfter(second)).toBe(ORIGINAL)
    expect(second.error).toBe('e2')
  })

  it('③ 空结果不得覆盖原稿:"成功"但返回纯空白 → 落 failed + emptyResult 哨兵,草稿不变', () => {
    for (const empty of ['', ' ', '\n\t  ']) {
      const after = applyPolishResult(polishing(ORIGINAL), { kind: 'succeeded', text: empty })
      expect(after.phase, JSON.stringify(empty)).toBe('failed')
      expect(after.error, JSON.stringify(empty)).toBe(POLISH_EMPTY_RESULT)
      expect(polishDraftAfter(after), JSON.stringify(empty)).toBe(ORIGINAL)
    }
  })
})

describe('D82 prompt-polish / ③ 空草稿不得发起润色', () => {
  it('空 / 纯空白草稿 → polishRejection 给出 emptyDraft 拒绝理由', () => {
    for (const empty of ['', '   ', '\n', '\t \n ']) {
      expect(polishRejection(empty), JSON.stringify(empty)).toBe('emptyDraft')
      expect(canStartPolish(empty), JSON.stringify(empty)).toBe(false)
    }
  })

  it('非空草稿 → 无拒绝理由,可发起', () => {
    expect(polishRejection(ORIGINAL)).toBeNull()
    expect(polishRejection('  x  ')).toBeNull()
    expect(canStartPolish(ORIGINAL)).toBe(true)
  })

  it('beginPolish 对空草稿不进入 polishing(相位留在 idle),并写下拒绝理由', () => {
    const before = createPolishState('   ')
    const after = beginPolish(before)
    expect(after.phase).toBe('idle')
    expect(after.rejection).toBe('emptyDraft')
    expect(polishDraftAfter(after)).toBe('   ')
  })

  it('空草稿被拒后原文不被空结果覆盖(端到端:拒绝 → 空成功也不落库)', () => {
    const idle = createPolishState('')
    const rejected = beginPolish(idle)
    expect(rejected.phase).toBe('idle')
    // 即便调用方误把空结果喂进来,也不得覆盖仅剩原文
    const after = applyPolishResult(rejected, { kind: 'succeeded', text: '' })
    expect(polishDraftAfter(after)).toBe('')
    expect(after.phase).toBe('failed')
  })

  it('有内容草稿 → beginPolish 进入 polishing 并刷新快照(不加不减一字)', () => {
    const idle = createPolishState(ORIGINAL)
    const started = beginPolish(idle)
    expect(started.phase).toBe('polishing')
    expect(started.original).toBe(ORIGINAL)
    expect(started.draft).toBe(ORIGINAL)
    expect(started.rejection).toBeNull()
  })
})

describe('D82 prompt-polish / ④ 二次失败仍可重试(相位穷尽)', () => {
  it('canRetry 在 failed 恒为 true,其余三相恒为 false(逐相位穷尽断言)', () => {
    const expected: Record<PolishPhase, boolean> = {
      idle: false,
      polishing: false,
      succeeded: false,
      failed: true,
    }
    for (const phase of POLISH_PHASES) {
      const state: PromptPolishState = { ...createPolishState(ORIGINAL), phase }
      expect(canRetry(state), phase).toBe(expected[phase])
    }
  })

  it('二次失败:retry(beginPolish)不消耗 / 不改变草稿,且之后仍可再重试', () => {
    const failedOnce = applyPolishResult(polishing(ORIGINAL), { kind: 'failed', error: 'e1' })
    expect(canRetry(failedOnce)).toBe(true)

    // 重试:只刷新相位与快照,草稿一字不动
    const retrying = beginPolish(failedOnce)
    expect(retrying.phase).toBe('polishing')
    expect(polishDraftAfter(retrying)).toBe(ORIGINAL)
    expect(retrying.original).toBe(ORIGINAL)

    // 第二次仍失败 → 依然可重试
    const failedTwice = applyPolishResult(retrying, { kind: 'failed', error: 'e2' })
    expect(polishDraftAfter(failedTwice)).toBe(ORIGINAL)
    expect(canRetry(failedTwice)).toBe(true)
  })

  it('连续失败 5 次仍可重试,草稿零漂移', () => {
    let cur = polishing(ORIGINAL)
    for (let i = 0; i < 5; i += 1) {
      cur = applyPolishResult(cur, { kind: 'failed', error: `e${i}` })
      expect(polishDraftAfter(cur), `failed#${i}`).toBe(ORIGINAL)
      expect(canRetry(cur), `failed#${i}`).toBe(true)
      cur = beginPolish(cur)
      expect(polishDraftAfter(cur), `retry#${i}`).toBe(ORIGINAL)
    }
  })

  it('失败后重试成功:草稿被替换为润色结果(重试路径与首次同语义)', () => {
    const failed = applyPolishResult(polishing(ORIGINAL), { kind: 'failed', error: 'e1' })
    const succeeded = applyPolishResult(beginPolish(failed), { kind: 'succeeded', text: POLISHED })
    expect(succeeded.phase).toBe('succeeded')
    expect(succeeded.draft).toBe(POLISHED)
    expect(canRetry(succeeded)).toBe(false)
  })
})

describe('D82 prompt-polish / 重启生效保稿提示判定', () => {
  it('白名单原因 → 需要提示;其余一律不提示', () => {
    for (const reason of POLISH_RESTART_REASONS) {
      expect(restartHintNeeded(reason), reason).toBe(true)
    }
    for (const raw of [null, undefined, '', 'network', 'timeout', 'FeatureToggled']) {
      expect(restartHintNeeded(raw), String(raw)).toBe(false)
    }
  })

  it('失败结果带白名单原因 → state.restartHint 为真(且草稿仍保稿)', () => {
    const after = applyPolishResult(polishing(ORIGINAL), {
      kind: 'failed',
      error: 'restart needed',
      restartReason: 'featureToggled',
    })
    expect(after.restartHint).toBe(true)
    expect(polishDraftAfter(after)).toBe(ORIGINAL)
  })

  it('成功结果带白名单原因 → restartHint 为真;非白名单 → 假', () => {
    const yes = applyPolishResult(polishing(ORIGINAL), {
      kind: 'succeeded',
      text: POLISHED,
      restartReason: 'modelConfigChanged',
    })
    expect(yes.restartHint).toBe(true)

    const no = applyPolishResult(polishing(ORIGINAL), {
      kind: 'succeeded',
      text: POLISHED,
      restartReason: 'network',
    })
    expect(no.restartHint).toBe(false)
  })

  it('重新发起润色会清掉上一次的重启提示(不残留)', () => {
    const hinted = applyPolishResult(polishing(ORIGINAL), {
      kind: 'failed',
      restartReason: 'featureToggled',
    })
    expect(hinted.restartHint).toBe(true)
    expect(beginPolish(hinted).restartHint).toBe(false)
  })
})

describe('D82 prompt-polish / 初始状态', () => {
  it('createPolishState:相位 idle,快照 = 草稿,无错误/拒绝/重启提示', () => {
    const s = createPolishState(ORIGINAL)
    expect(s).toEqual({
      phase: 'idle',
      draft: ORIGINAL,
      original: ORIGINAL,
      error: null,
      rejection: null,
      restartHint: false,
    })
  })

  it('idle / polishing / succeeded 三态 canRetry 均为假(只有 failed 可重试)', () => {
    expect(canRetry(createPolishState(ORIGINAL))).toBe(false)
    expect(canRetry(polishing(ORIGINAL))).toBe(false)
    expect(
      canRetry(applyPolishResult(polishing(ORIGINAL), { kind: 'succeeded', text: POLISHED })),
    ).toBe(false)
  })
})
