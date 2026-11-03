// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D174(2026-09-30 立)常驻回归:帧级 traceId 的**归一规则**与**认领位置**。
 *
 * 两格各自都有存在的理由:
 *  ① 归一(小写 32 hex、全 0 非法)与 Python 侧
 *     `apps/ai-service/app/core/trace_context.py::normalize_trace_id` 是同一条规则的
 *     两份语言实现 —— 跨语言无法共用一份代码,所以**判例表逐字同形**,谁改规则另一边必红
 *     (对应用例:`apps/ai-service/tests/test_sse_trace_frame_d174.py::test_normalization_case_table`)。
 *  ② 认领位置:`packages/shared/src/utils/sse-parse.ts` 尾部有一条泛化兜底
 *     `typeof json?.sessionId === 'string' ⇒ {type:'meta', sessionId}`。内层分支 return 的
 *     是已经收窄完的对象,兜底之后再去补 traceId 就补不上了。本仓同型已栽三次
 *     (terminal_delta=D19-A1 / tool-delta=D113 / terminal_interaction=D151),
 *     判据 `scripts/check-sse-parser-parity.mjs`。下面那两条"被折成 meta 仍带着
 *     自己的 traceId"的用例钉的就是这一格。
 *
 * 消费纪律:值缺席 = 本轮没有有效 trace(**不是**空串、**不是** null),所以判据一律
 * `typeof === 'string'`,禁止 `?? ''`。它也不是授权输入 —— 归属判定不得读它
 * (阳性对照在 Python 侧的 test_foreign_trace_id_does_not_change_ownership)。
 */

import { describe, expect, it } from 'vitest'

import { parseSSEChunk } from '../../utils/sse-parse'
import {
  normalizeSSEFrameTraceId,
  type SSEEventPayload,
  SSE_EVENT_NAMES,
  SSE_TRACE_ID_PAYLOAD_KEY,
} from '../contract'

const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736'
/** 阳性对照用:一条**属于别人**的合法形态 trace id(格式完全合格,只是不是本轮的) */
const FOREIGN_TRACE_ID = '0123456789abcdef0123456789abcdef'
const ALL_ZERO_TRACE_ID = '0'.repeat(32)

function one(line: string) {
  const { events } = parseSSEChunk(`data: ${line}\n`)
  return events[0]
}

describe('normalizeSSEFrameTraceId(D174 归一判例表,与 Python 侧同形)', () => {
  // (输入, 期望) —— 期望 undefined 表示"这个值不得被采信"
  const cases: Array<[unknown, string | undefined]> = [
    [TRACE_ID, TRACE_ID],
    // 大写归一为小写
    ['4BF92F3577B34DA6A3CE929D0E0E4736', TRACE_ID],
    [`  ${TRACE_ID}  `, TRACE_ID],
    [`${TRACE_ID.toUpperCase()} `, TRACE_ID],
    // W3C:全 0 trace-id 表示"没有 trace"
    [ALL_ZERO_TRACE_ID, undefined],
    ['0000000000000000000000000000000f', '0000000000000000000000000000000f'],
    // 长度不对 / 非 hex / 类型不对 ⇒ 一律不是 trace id
    ['', undefined],
    ['   ', undefined],
    ['abc', undefined],
    [TRACE_ID.slice(0, 31), undefined],
    [`${TRACE_ID}0`, undefined],
    ['g'.repeat(32), undefined],
    [TRACE_ID.replace('4', '-'), undefined],
    [undefined, undefined],
    [null, undefined],
    [12345, undefined],
    [{ id: TRACE_ID }, undefined],
  ]

  it.each(cases)('输入 %j ⇒ %j', (raw, expected) => {
    expect(normalizeSSEFrameTraceId(raw)).toStrictEqual(expected)
  })

  it('不合格输入绝不得归一成空串("没有"与"有一个空的"必须可分)', () => {
    for (const [raw] of cases) {
      expect(normalizeSSEFrameTraceId(raw)).not.toBe('')
    }
  })
})

describe('SSE 契约登记(D174:帧级元信息键,不是某个事件的必填字段)', () => {
  it('线格式键名与 Python 侧常量逐字同值', () => {
    // 对侧:`apps/ai-service/app/core/sse_contract.py::SSE_TRACE_ID_PAYLOAD_KEY = "traceId"`
    expect(SSE_TRACE_ID_PAYLOAD_KEY).toBe('traceId')
  })

  it('SSEEventMeta 上的 traceId 是可选键 ⇒ 缺席合法', () => {
    // 类型层面的判据用**契约类型本身**做可赋值断言:tsc 若不接受这两行,说明该键没进
    // `SSEEventMeta`(写成必填则第一行会红 —— 那等于把"本轮没有有效 trace"这一合法形态
    // 判成不合法)。这里刻意不另造一个 `{ traceId?: string }` 的替身类型 —— 那只会
    // 断言我自己写的那份形状,证不了契约登记过它。
    type ChunkFrame = Extract<SSEEventPayload, { type: 'chunk' }>
    const without: ChunkFrame = { type: 'chunk', content: 'x' }
    const withTrace: ChunkFrame = { type: 'chunk', content: 'x', traceId: TRACE_ID }
    expect(without.traceId).toBeUndefined()
    expect(withTrace.traceId).toBe(TRACE_ID)
  })

  it('traceId 不得被当成事件名(判据输入面没被污染)', () => {
    expect(SSE_EVENT_NAMES).not.toContain(SSE_TRACE_ID_PAYLOAD_KEY as (typeof SSE_EVENT_NAMES)[number])
  })
})

describe('sse-parse 帧级 traceId 认领(D174:必须在泛化兜底之前/之上)', () => {
  it('具名帧带 traceId ⇒ 事件上原样保留', () => {
    const evt = one(`{"type":"terminal_delta","terminalId":"t-1","stream":"stdout","text":"ok","traceId":"${TRACE_ID}"}`)
    expect(evt?.type).toBe('terminal_delta')
    expect(evt?.traceId).toBe(TRACE_ID)
  })

  it('增量帧(chunk)同样保留 —— 一条流里几千帧共用一个头,靠头定位不到具体帧', () => {
    const evt = one(`{"type":"chunk","content":"你好","traceId":"${TRACE_ID}"}`)
    expect(evt?.type).toBe('chunk')
    expect(evt?.content).toBe('你好')
    expect(evt?.traceId).toBe(TRACE_ID)
  })

  it('被 sessionId 泛化兜底折成 meta 的帧,也必须带着自己的 traceId', () => {
    // 未知 type 而带 string sessionId ⇒ 走尾部兜底;这一格正是三次复发的坑位
    const evt = one(`{"type":"brand_new_frame","sessionId":"s-9","traceId":"${TRACE_ID}"}`)
    expect(evt?.type).toBe('meta')
    expect(evt?.sessionId).toBe('s-9')
    expect(evt?.traceId).toBe(TRACE_ID)
  })

  it('没有 traceId 的帧 ⇒ 该键整个缺席(不写空串、不写 undefined 之外的值)', () => {
    const evt = one('{"type":"chunk","content":"x"}')
    expect(evt).toBeDefined()
    expect(evt?.traceId).toBeUndefined()
    expect('traceId' in (evt as object)).toBe(false)
  })

  it('畸形 traceId(全 0 / 短 / 非 hex)按"没有"处理,不得被采信', () => {
    for (const bad of [ALL_ZERO_TRACE_ID, 'abc', TRACE_ID.replace('4', '-'), '']) {
      const evt = one(`{"type":"chunk","content":"x","traceId":"${bad}"}`)
      expect(evt?.traceId).toBeUndefined()
    }
  })

  it('大写值归一为小写后交出(与生产侧同一规则)', () => {
    const evt = one(`{"type":"chunk","content":"x","traceId":"${TRACE_ID.toUpperCase()}"}`)
    expect(evt?.traceId).toBe(TRACE_ID)
  })

  it('[DONE] 与 Vercel data-stream 协议帧不带我方 trace', () => {
    expect(one('[DONE]')?.traceId).toBeUndefined()
    expect(one('0:"hello"')?.traceId).toBeUndefined()
  })

  it('非 JSON 文本帧不因取 trace 而改变原有语义(仍按 chunk 兜底)', () => {
    const evt = one('plain text without braces')
    expect(evt?.type).toBe('chunk')
    expect(evt?.traceId).toBeUndefined()
  })

  it('阳性对照:别人的 traceId 原样透传(它是关联键,认领层不做归属判定)', () => {
    const evt = one(`{"type":"chunk","content":"x","traceId":"${FOREIGN_TRACE_ID}"}`)
    expect(evt?.traceId).toBe(FOREIGN_TRACE_ID)
  })

  it('SSE id: 控制行仍不产出事件(包装层没有改变行分流)', () => {
    const { events } = parseSSEChunk('id: 42\nevent: chunk\ndata: {"type":"chunk","content":"x"}\n')
    expect(events).toHaveLength(1)
    expect(events[0]?.content).toBe('x')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
