// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// WATERMARK-PLACEHOLDER(本行由 scripts/watermark.mjs inject 替换为横幅)

import { describe, it, expect } from 'vitest'
import {
  applyTurnFallbackAnswer,
  currentTurnAnswerRows,
  hasTurnAnswerText,
  shouldAppendTurnFallback,
  TURN_FALLBACK_KINDS,
  type TurnAnswerEntry,
} from '../turn-answer-integrity'
import { isTerminalTurnState, TURN_STATES } from '../turn-status'

/**
 * 回合答案完整性(见 `../turn-answer-integrity.ts` 头注的现读定位)。
 *
 * 判据一律走导出的那一份实现 —— 本文件不得内联第二份判定(§22c:镜像只复读实现就是复读机),
 * 所以断言只写在"输入形状 → 期望输出形状"上:期望数组是**oracle**,不是判据。
 *
 * 组面覆盖(与票面四条成对用例一一对应,外加三条票面没写但判据必须站得住的形态):
 * K1 幂等(答案在尾 / 答案不在尾 —— 后者正是按时序或位置判会漏的那一型)
 * K2 空响应不伪造(四种"空"的写法各一条,并要求呈现态是非 completed 的终态)
 * K3 只有工具调用无文本 ⇒ 补出唯一答案且只一条
 * K4 正常一条答案 ⇒ 与改动前逐字同形(同引用 + 同序列化)
 * K5 本轮窗口:同文本在上一轮出现过 ⇒ 仍补(不跨轮误判成重复);通知驱动回合无 user 行 ⇒ 仍判
 * K6 失败轮不被改写,兜底答案作为独立一行
 * K7 判据面:三态封闭 + 判定与追加的结论一致(追加口不得自己再判一次)
 */

/** 一条真实的端上消息形状(比最小结构多字段,用来证明泛型 T 的额外字段不被丢) */
interface Row extends TurnAnswerEntry {
  readonly id: string
  readonly createdAt: number
  /** 与 `stream-error` 的 `ErrorAwareMessage` / `@ihui/types` 的 `ChatMessage` 同字段 */
  readonly errorCode?: string
  readonly toolCalls?: { readonly name: string }[]
}

const ANSWER = '今天多云转晴,气温 23 度。'

const user = (id: string, content: string): Row => ({ id, role: 'user', content, createdAt: 1 })
const assistant = (id: string, content: string, extra: Partial<Row> = {}): Row => ({
  id,
  role: 'assistant',
  content,
  createdAt: 2,
  ...extra,
})

/** 端上注入的行工厂:共享层不生成 id,所以工厂在这里造 */
const host = {
  createAnswerRow: (content: string): Row => ({
    id: `a-fallback-${content.length}`,
    role: 'assistant',
    content,
    createdAt: 3,
  }),
}

describe('K1 内容幂等:同一文本已在转写里 ⇒ 绝不追加第二遍', () => {
  it('答案行在尾部 ⇒ duplicate,数组原样不动', () => {
    const entries = [user('u1', '天气如何'), assistant('a1', ANSWER)]

    expect(shouldAppendTurnFallback(entries, ANSWER).kind).toBe('duplicate')

    const applied = applyTurnFallbackAnswer(entries, ANSWER, host)
    expect(applied.decision.kind).toBe('duplicate')
    expect(applied.entries).toBe(entries)
    expect(applied.entries).toHaveLength(2)
  })

  it('答案行不在尾部(后面还跟着别的行)⇒ 仍判 duplicate', () => {
    // 这一条专门用来否证"按时序/位置判":若判据写成"最后一条是不是它",
    // 这里会判成没答过并再补一条,同一段回答出现两次。
    const entries = [
      user('u1', '天气如何'),
      assistant('a1', ANSWER),
      assistant('a2', '', { toolCalls: [{ name: 'get_weather' }] }),
    ]

    expect(shouldAppendTurnFallback(entries, ANSWER).kind).toBe('duplicate')
    expect(applyTurnFallbackAnswer(entries, ANSWER, host).entries).toBe(entries)
    expect(hasTurnAnswerText(entries, ANSWER)).toBe(true)
  })

  it('只有首尾空白不同 ⇒ 同一条文本(判定时规范化)', () => {
    const entries = [user('u1', '天气如何'), assistant('a1', `  ${ANSWER}\n`)]

    expect(shouldAppendTurnFallback(entries, `${ANSWER}  `).kind).toBe('duplicate')
  })

  it('本轮确实没有这段文本 ⇒ append,并把上游原文逐字交回(判据不顺手 trim 掉换行/缩进)', () => {
    const entries = [user('u1', '天气如何'), assistant('a1', '正在查天气')]

    const decision = shouldAppendTurnFallback(entries, ANSWER)
    expect(decision.kind).toBe('append')
    expect(decision.content).toBe(ANSWER)
  })
})

describe('K2 空响应绝不伪造回复:转写不新增 agent 行', () => {
  const empties: readonly (readonly [string, string | null | undefined])[] = [
    ['空串', ''],
    ['纯空白', '   \n\t '],
    ['null', null],
    ['undefined', undefined],
  ]

  for (const [label, value] of empties) {
    it(`${label} ⇒ 不新增任何行,且给出非"完成"的终态呈现`, () => {
      const entries = [user('u1', '随便说点什么'), assistant('a1', '')]

      const decision = shouldAppendTurnFallback(entries, value)
      expect(decision.kind).toBe('empty')
      expect(decision.content).toBeNull()

      const applied = applyTurnFallbackAnswer(entries, value, host)
      expect(applied.entries).toBe(entries)
      expect(applied.entries).toHaveLength(2)
      expect(applied.entries.filter((row) => row.role === 'assistant')).toHaveLength(1)
    })
  }

  it('空响应的呈现态必须是十态之一、终态、且绝不是 completed', () => {
    const decision = shouldAppendTurnFallback([user('u1', 'hi')], '')

    expect(decision.presentationState).not.toBeNull()
    const state = decision.presentationState
    if (!state) throw new Error('空响应必须给出呈现态')
    expect(TURN_STATES).toContain(state)
    expect(state).not.toBe('completed')
    expect(isTerminalTurnState(state)).toBe(true)
  })

  it('空响应判定不看"本轮是否已有空占位行"(空文本不参与幂等比较)', () => {
    // 若把空 answer 送进幂等比较,它会和"空白占位行"逐字相等而判成 duplicate,
    // 于是这一格被读成"答案已在",呈现侧就把没内容的一轮当完成了(§30 那一型)。
    expect(shouldAppendTurnFallback([assistant('a1', '')], '').kind).toBe('empty')
    expect(hasTurnAnswerText([assistant('a1', '')], '')).toBe(false)
  })
})

describe('K3 只有工具调用、没有文本 ⇒ 补出唯一答案且只一条', () => {
  it('空的 assistant 工具行就地补字:行数不变、工具字段与 id 逐字保留', () => {
    const entries = [
      user('u1', '帮我查一下'),
      assistant('a1', '', { toolCalls: [{ name: 'grep' }] }),
    ]

    const applied = applyTurnFallbackAnswer(entries, ANSWER, host)

    expect(applied.decision.kind).toBe('append')
    expect(applied.entries).toHaveLength(2)
    const agentRows = applied.entries.filter((row) => row.role === 'assistant')
    expect(agentRows).toHaveLength(1)
    expect(agentRows[0]).toEqual({
      id: 'a1',
      role: 'assistant',
      content: ANSWER,
      createdAt: 2,
      toolCalls: [{ name: 'grep' }],
    })
    // 原数组不得被就地改动(纯函数)
    expect(entries).toEqual([
      user('u1', '帮我查一下'),
      assistant('a1', '', { toolCalls: [{ name: 'grep' }] }),
    ])
  })

  it('本轮连一条 assistant 行都没有(流根本没起来)⇒ 经 host 追加恰好一条', () => {
    const entries = [user('u1', '帮我查一下')]

    const applied = applyTurnFallbackAnswer(entries, ANSWER, host)

    expect(applied.entries).toHaveLength(2)
    expect(applied.entries[1]?.role).toBe('assistant')
    expect(applied.entries.filter((row) => row.role === 'assistant')).toHaveLength(1)
  })

  it('补过第二次 ⇒ 判成 duplicate,一条也不加(兜底与流式两条路径谁先到都不双写)', () => {
    const once = applyTurnFallbackAnswer([user('u1', 'hi'), assistant('a1', '')], ANSWER, host)
    const twice = applyTurnFallbackAnswer(once.entries, ANSWER, host)

    expect(twice.decision.kind).toBe('duplicate')
    expect(twice.entries).toBe(once.entries)
    expect(twice.entries.filter((row) => row.role === 'assistant')).toHaveLength(1)
  })
})

describe('K4 正常一条答案(流式已到位)⇒ 与改动前逐字同形', () => {
  it('同引用 + 同序列化 + 同长度', () => {
    const entries = [
      user('u1', '天气如何'),
      assistant('a1', ANSWER, { toolCalls: [{ name: 'get_weather' }] }),
    ]
    const before = JSON.stringify(entries)

    const applied = applyTurnFallbackAnswer(entries, ANSWER, host)

    expect(applied.entries).toBe(entries)
    expect(JSON.stringify(applied.entries)).toBe(before)
    expect(applied.entries).toHaveLength(entries.length)
  })
})

describe('K5 本轮窗口:幂等只在同一轮内成立', () => {
  it('同一段文本出现在上一轮 ⇒ 本轮仍补(不跨轮误判成重复)', () => {
    // 本轮尾行有**不同**的文本(不是空白占位行,所以走追加而不是就地补字),
    // 与上一轮的逐字同值不得被当成"本轮已答"。
    const entries = [
      user('u1', '天气如何'),
      assistant('a1', ANSWER),
      user('u2', '再说一遍天气'),
      assistant('a2', '稍等'),
    ]

    expect(shouldAppendTurnFallback(entries, ANSWER).kind).toBe('append')

    const applied = applyTurnFallbackAnswer(entries, ANSWER, host)
    expect(applied.entries).toHaveLength(5)
    expect(applied.entries[4]).toMatchObject({ role: 'assistant', content: ANSWER })
    // 补完之后同一答案再来一次 ⇒ 本轮内判成重复(唯一一条,不双写)
    const again = applyTurnFallbackAnswer(applied.entries, ANSWER, host)
    expect(again.decision.kind).toBe('duplicate')
    expect(again.entries).toBe(applied.entries)
  })

  it('通知驱动回合:没有 user 行也照样判(整段即本轮)', () => {
    const entries = [assistant('a1', '', { toolCalls: [{ name: 'notify' }] })]

    expect(currentTurnAnswerRows(entries)).toHaveLength(1)
    expect(shouldAppendTurnFallback(entries, ANSWER).kind).toBe('append')
    expect(applyTurnFallbackAnswer(entries, ANSWER, host).entries[0]).toMatchObject({
      content: ANSWER,
    })
  })

  it('窗口切分本身:最后一条 user **之后**的行才算本轮(user 行自己不入窗口)', () => {
    const entries = [user('u1', 'a'), assistant('a1', 'b'), user('u2', 'c'), assistant('a2', 'd')]

    expect(currentTurnAnswerRows(entries).map((row) => row.content)).toEqual(['d'])
  })
})

describe('K6 失败轮不由本模块改写', () => {
  it('尾行是失败轮 ⇒ 兜底答案作为独立一行,失败行的内容与标记逐字不动', () => {
    const failed = assistant('a1', '⚠ 上游超时', { error: true, errorCode: 'E_TIMEOUT' })
    const entries = [user('u1', 'hi'), failed]

    const applied = applyTurnFallbackAnswer(entries, ANSWER, host)

    expect(applied.decision.kind).toBe('append')
    expect(applied.entries).toHaveLength(3)
    expect(applied.entries[1]).toBe(failed)
    expect(applied.entries[2]?.content).toBe(ANSWER)
  })

  it('失败轮的文案不得被读成"答案已在"(否则真答案永远补不进来)', () => {
    const entries = [user('u1', 'hi'), assistant('a1', '⚠ 上游超时', { error: true })]

    expect(shouldAppendTurnFallback(entries, '⚠ 上游超时').kind).toBe('append')
  })
})

describe('K7 判据面封闭性', () => {
  it('三态就是那三个取值,不新增也不缺', () => {
    expect([...TURN_FALLBACK_KINDS].sort()).toEqual(['append', 'duplicate', 'empty'])
  })

  it('追加口的结论只能来自判定(端上不存在第二个判据),两者逐例同结论', () => {
    const samples: readonly (readonly [Row[], string | null | undefined])[] = [
      [[user('u1', 'q'), assistant('a1', ANSWER)], ANSWER],
      [[user('u1', 'q'), assistant('a1', '')], ANSWER],
      [[user('u1', 'q'), assistant('a1', ANSWER)], ''],
      [[user('u1', 'q')], null],
    ]
    for (const [entries, answer] of samples) {
      const decided = shouldAppendTurnFallback(entries, answer)
      const applied = applyTurnFallbackAnswer(entries, answer, host)
      expect(applied.decision).toEqual(decided)
      if (decided.kind !== 'append') {
        expect(applied.entries).toBe(entries)
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
