// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  WAITING_FALLBACK_EN,
  WAITING_LOCALES,
  WAITING_PHASES,
  WAITING_QUADRANTS,
  WAITING_VIVID_TAIL_EN,
  resolveWaitingPersonaSetting,
  resolveWaitingText,
  shouldAnnounceWaitingText,
  waitingI18nKey,
  waitingI18nKeyList,
  waitingPoolSize,
  type WaitingPhase,
  type WaitingQuadrant,
  type WaitingTextLookup,
} from '../../src/chat/waiting-pool'

// 五语言抽检期望值:与原内联表逐字一致,防搬运错位。
// 中文串只出现在测试断言里(测试目录不进硬编码中文守门),源码里绝不内联。
const ZH_CN_AGENT_FIRST = [
  '正在准备回复…',
  '正在组织回答思路…',
  '收到，正在思考如何回复…',
  '正在为你生成回复…',
  '已收到问题，正在处理…',
] as const
const ZH_CN_VIVID_TAIL = '，马上就好'

const ZH_TW_COMPUTER_MIDDLE = [
  '正在執行中…',
  '計算進行中，請稍候…',
  '正在處理中間結果…',
  '執行未中斷，正在推進…',
  '正在運算，請稍候…',
] as const
const ZH_TW_VIVID_TAIL = '，馬上就好'

const EN_CONTEXT_FOLLOWUP = [
  'Reading your follow-up in context…',
  'Looking back at relevant context…',
  'Linking to earlier discussion…',
  'Checking against the thread…',
  'Working on it with context…',
] as const
const EN_VIVID_TAIL = ', almost there'

const JA_PLAN_FIRST = [
  '対応プランを立てています…',
  'ご要望を分解しています…',
  '実行手順を計画しています…',
  'タスクの要点を分析しています…',
  '返答の概要を作成しています…',
] as const
const JA_VIVID_TAIL = '、まもなくです'

const KO_DETAIL_FOLLOWUP = [
  '질문하신 세부 사항을 보충하고 있습니다…',
  '추가 질문의 요점을 확장하고 있습니다…',
  '설명을 자세히 다듬고 있습니다…',
  '보충 내용을 준비하고 있습니다…',
  '추가 질문에 대한 답변을 마무리하고 있습니다…',
] as const
const KO_VIVID_TAIL = ', 금방 끝납니다'

const EN_AGENT_FIRST_0 = 'Preparing a reply…'

// 按 waiting.<象限>.<阶段>.<下标> 组 mock 词典,缺键返回 undefined。
function dictFromPool(
  quadrant: WaitingQuadrant,
  phase: WaitingPhase,
  values: readonly string[],
  vividTail: string,
): Record<string, string> {
  const dict: Record<string, string> = {}
  values.forEach((value, index) => {
    dict[waitingI18nKey(quadrant, phase, index)] = value
  })
  dict['waiting.vividTail'] = vividTail
  return dict
}

function mockT(dict: Record<string, string>): WaitingTextLookup {
  return (key: string) => dict[key]
}

describe('waitingPoolSize 每池 ≥5 变体', () => {
  it('五语言 × 五象限 × 三阶段全部达标', () => {
    for (const locale of WAITING_LOCALES) {
      for (const quadrant of WAITING_QUADRANTS) {
        for (const phase of WAITING_PHASES) {
          expect(
            waitingPoolSize(locale, quadrant, phase),
            `${locale}.${quadrant}.${phase}`,
          ).toBeGreaterThanOrEqual(5)
        }
      }
    }
  })

  it('同池变体互不相同(近义而非重复)', () => {
    const seen = new Set<string>()
    for (let seed = 0; seed < 5; seed += 1) {
      seen.add(resolveWaitingText({ quadrant: 'agent', phase: 'first', seed }))
    }
    expect(seen.size).toBe(5)
  })
})

describe('resolveWaitingText 确定性(seed 取模)', () => {
  it('同 seed 同输出(数字与 turnId 字符串均稳定)', () => {
    const first = resolveWaitingText({ quadrant: 'plan', phase: 'middle', seed: 3 })
    expect(resolveWaitingText({ quadrant: 'plan', phase: 'middle', seed: 3 })).toBe(first)
    const byTurn = resolveWaitingText({ quadrant: 'context', phase: 'followup', seed: 'turn-42' })
    expect(resolveWaitingText({ quadrant: 'context', phase: 'followup', seed: 'turn-42' })).toBe(
      byTurn,
    )
  })

  it('seed 按池长取模轮换(seed 与 seed+池长同输出)', () => {
    const size = waitingPoolSize('zh-CN', 'agent', 'first')
    expect(size).toBe(5)
    const a = resolveWaitingText({ quadrant: 'agent', phase: 'first', seed: 1 })
    expect(resolveWaitingText({ quadrant: 'agent', phase: 'first', seed: 1 + size })).toBe(a)
  })

  it('非法 seed(负数/NaN/缺省)不抛错且确定', () => {
    expect(() => resolveWaitingText({ quadrant: 'detail', phase: 'first', seed: -7 })).not.toThrow()
    expect(resolveWaitingText({ quadrant: 'detail', phase: 'first', seed: Number.NaN })).toBe(
      resolveWaitingText({ quadrant: 'detail', phase: 'first' }),
    )
  })

  it('无 t 时各语言一律回退英文(中文走词表,不再内联)', () => {
    const zh = resolveWaitingText({
      quadrant: 'computer',
      phase: 'first',
      locale: 'zh-CN',
      seed: 0,
    })
    const en = resolveWaitingText({ quadrant: 'computer', phase: 'first', locale: 'en', seed: 0 })
    expect(zh).toBe(en)
    expect(zh).toBe('Allocating compute…')
  })
})

describe('人格开关与档位', () => {
  it('关闭开关回退英文固定串(无 t 时)', () => {
    expect(
      resolveWaitingText({ quadrant: 'agent', phase: 'first', seed: 2, personaEnabled: false }),
    ).toBe(WAITING_FALLBACK_EN)
    expect(
      resolveWaitingText({
        quadrant: 'agent',
        phase: 'first',
        locale: 'en',
        seed: 2,
        personaEnabled: false,
      }),
    ).toBe('Waiting for model response…')
  })

  it('关闭开关支持自定义 fallback', () => {
    expect(
      resolveWaitingText({
        quadrant: 'agent',
        phase: 'first',
        personaEnabled: false,
        fallback: '请稍候',
      }),
    ).toBe('请稍候')
  })

  it('默认保守档;vivid 档在保守文案后加英文尾缀(无 t 时)', () => {
    const conservative = resolveWaitingText({ quadrant: 'agent', phase: 'first', seed: 0 })
    expect(resolveWaitingText({ quadrant: 'agent', phase: 'first', seed: 0 })).toBe(conservative)
    const vivid = resolveWaitingText({
      quadrant: 'agent',
      phase: 'first',
      seed: 0,
      persona: 'vivid',
    })
    expect(vivid).toBe(`${conservative}${WAITING_VIVID_TAIL_EN}`)
    expect(vivid.length).toBeGreaterThan(conservative.length)
  })

  it('设置值解析:非法回退保守', () => {
    expect(resolveWaitingPersonaSetting('off')).toBe('off')
    expect(resolveWaitingPersonaSetting('vivid')).toBe('vivid')
    expect(resolveWaitingPersonaSetting('conservative')).toBe('conservative')
    expect(resolveWaitingPersonaSetting('unknown')).toBe('conservative')
    expect(resolveWaitingPersonaSetting(undefined)).toBe('conservative')
    expect(resolveWaitingPersonaSetting(42)).toBe('conservative')
  })
})

describe('shouldAnnounceWaitingText 读屏去重', () => {
  it('文本无变化不播报,变化才播报,空串不播报', () => {
    expect(shouldAnnounceWaitingText('a', 'a')).toBe(false)
    expect(shouldAnnounceWaitingText('a', 'b')).toBe(true)
    expect(shouldAnnounceWaitingText('a', '   ')).toBe(false)
  })

  it('轮换池相邻 seed 文案不同时会播报一次(不重复刷屏由调用方节流)', () => {
    const first = resolveWaitingText({ quadrant: 'agent', phase: 'first', seed: 0 })
    const second = resolveWaitingText({ quadrant: 'agent', phase: 'first', seed: 1 })
    expect(shouldAnnounceWaitingText(first, second)).toBe(true)
    expect(shouldAnnounceWaitingText(second, second)).toBe(false)
  })
})

describe('waitingI18nKeyList 词表键清单', () => {
  it('75 条正文键 + 1 条 vividTail,无重复', () => {
    const keys = waitingI18nKeyList()
    expect(keys).toHaveLength(76)
    expect(new Set(keys).size).toBe(76)
    expect(keys).toContain('waiting.agent.first.0')
    expect(keys).toContain('waiting.detail.followup.4')
    expect(keys).toContain('waiting.vividTail')
  })
})

describe('取词注入:五语言各抽 1 池与原内联逐字一致', () => {
  it('zh-CN agent.first 五串逐字一致', () => {
    const t = mockT(dictFromPool('agent', 'first', ZH_CN_AGENT_FIRST, ZH_CN_VIVID_TAIL))
    ZH_CN_AGENT_FIRST.forEach((expected, seed) => {
      expect(
        resolveWaitingText({ quadrant: 'agent', phase: 'first', seed, locale: 'zh-CN', t }),
      ).toBe(expected)
    })
  })

  it('zh-TW computer.middle 五串逐字一致', () => {
    const t = mockT(dictFromPool('computer', 'middle', ZH_TW_COMPUTER_MIDDLE, ZH_TW_VIVID_TAIL))
    ZH_TW_COMPUTER_MIDDLE.forEach((expected, seed) => {
      expect(
        resolveWaitingText({ quadrant: 'computer', phase: 'middle', seed, locale: 'zh-TW', t }),
      ).toBe(expected)
    })
  })

  it('en context.followup 五串逐字一致', () => {
    const t = mockT(dictFromPool('context', 'followup', EN_CONTEXT_FOLLOWUP, EN_VIVID_TAIL))
    EN_CONTEXT_FOLLOWUP.forEach((expected, seed) => {
      expect(
        resolveWaitingText({ quadrant: 'context', phase: 'followup', seed, locale: 'en', t }),
      ).toBe(expected)
    })
  })

  it('ja plan.first 五串逐字一致', () => {
    const t = mockT(dictFromPool('plan', 'first', JA_PLAN_FIRST, JA_VIVID_TAIL))
    JA_PLAN_FIRST.forEach((expected, seed) => {
      expect(resolveWaitingText({ quadrant: 'plan', phase: 'first', seed, locale: 'ja', t })).toBe(
        expected,
      )
    })
  })

  it('ko detail.followup 五串逐字一致', () => {
    const t = mockT(dictFromPool('detail', 'followup', KO_DETAIL_FOLLOWUP, KO_VIVID_TAIL))
    KO_DETAIL_FOLLOWUP.forEach((expected, seed) => {
      expect(
        resolveWaitingText({ quadrant: 'detail', phase: 'followup', seed, locale: 'ko', t }),
      ).toBe(expected)
    })
  })

  it('vivid 尾缀走词表(有 t 用本地化尾,无 t 用英文尾)', () => {
    const t = mockT(dictFromPool('agent', 'first', ZH_CN_AGENT_FIRST, ZH_CN_VIVID_TAIL))
    const vivid = resolveWaitingText({
      quadrant: 'agent',
      phase: 'first',
      seed: 0,
      locale: 'zh-CN',
      persona: 'vivid',
      t,
    })
    expect(vivid).toBe(`${ZH_CN_AGENT_FIRST[0]}${ZH_CN_VIVID_TAIL}`)
    const vividEn = resolveWaitingText({
      quadrant: 'agent',
      phase: 'first',
      seed: 0,
      persona: 'vivid',
    })
    expect(vividEn).toBe(`${EN_AGENT_FIRST_0}${WAITING_VIVID_TAIL_EN}`)
  })
})

describe('回退纪律:缺键/无 t 回退英文,绝不回显 raw key', () => {
  it('缺键 t(返回 undefined)回退英文', () => {
    const missingT: WaitingTextLookup = () => undefined
    expect(resolveWaitingText({ quadrant: 'agent', phase: 'first', seed: 0, t: missingT })).toBe(
      EN_AGENT_FIRST_0,
    )
  })

  it('回显 key 的 t(返回 key 本身)被拦死,回退英文', () => {
    const echoT: WaitingTextLookup = (key: string) => key
    expect(resolveWaitingText({ quadrant: 'agent', phase: 'first', seed: 0, t: echoT })).toBe(
      EN_AGENT_FIRST_0,
    )
  })

  it('空串 t 回退英文', () => {
    const emptyT: WaitingTextLookup = () => ''
    expect(resolveWaitingText({ quadrant: 'agent', phase: 'first', seed: 0, t: emptyT })).toBe(
      EN_AGENT_FIRST_0,
    )
  })

  it('抛错 t 回退英文', () => {
    const throwT: WaitingTextLookup = () => {
      throw new Error('boom')
    }
    expect(resolveWaitingText({ quadrant: 'agent', phase: 'first', seed: 0, t: throwT })).toBe(
      EN_AGENT_FIRST_0,
    )
  })

  it('全池×全 seed 回显型 t 下无一输出含 waiting.(防 key 泄漏)', () => {
    const echoT: WaitingTextLookup = (key: string) => key
    for (const quadrant of WAITING_QUADRANTS) {
      for (const phase of WAITING_PHASES) {
        for (let seed = 0; seed < 5; seed += 1) {
          const text = resolveWaitingText({ quadrant, phase, seed, t: echoT })
          expect(text.includes('waiting.')).toBe(false)
          expect(text.length).toBeGreaterThan(0)
          const vivid = resolveWaitingText({ quadrant, phase, seed, persona: 'vivid', t: echoT })
          expect(vivid.includes('waiting.')).toBe(false)
        }
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
