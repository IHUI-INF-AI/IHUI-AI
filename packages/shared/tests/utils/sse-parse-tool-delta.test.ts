// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * D113(2026-09-27):共享解析器接 tool-delta 帧的认领自证。
 *
 * 立因:同一协议两处解析(api-client/client.ts 与 shared/sse-parse.ts),api-client 侧早已解析、
 * 本解析器既无变体也无分支 ⇒ 帧走到函数末尾 `return null`,小程序端**能收到却静默丢掉**
 * (由守门 scripts/check-sse-parser-parity.mjs 判红现形,本文件钉住修好的那一半)。
 *
 * 夹具帧的字段与值**逐字取自生产者** apps/ai-service/app/routers/llm.py 的 _pv_evt 构造
 * (type/toolCallId/seq/partialText [+ truncated]),不按前端想象造数据。
 */
import { describe, expect, it } from 'vitest'

import { parseSSEChunk, type SSEEvent } from '../../src/utils/sse-parse'

/** llm.py::_SSE_TOOL_DELTA 的真实线格式(event + data 两行) */
const TOOL_DELTA_FRAME =
  'event: tool-delta\n' +
  'data: {"type":"tool-delta","toolCallId":"call-1","seq":1,"partialText":"+line1\\n+line2"}\n\n'

function one(line: string): SSEEvent | undefined {
  const { events } = parseSSEChunk(`data: ${line}\n`)
  return events[0]
}

describe('sse-parse tool-delta(D113:帧不得被静默丢掉,也不得污染正文)', () => {
  it('认领:合法 tool-delta 解析出载荷,且 content 未被填充(不是正文增量)', () => {
    const evt = one(
      '{"type":"tool-delta","toolCallId":"call-1","seq":1,"partialText":"+line1\\n+line2"}',
    )
    expect(evt?.type).toBe('tool-delta')
    expect(evt?.type).not.toBe('chunk')
    expect(evt?.content).toBeUndefined()
    expect(evt?.toolDelta).toEqual({
      toolCallId: 'call-1',
      seq: 1,
      partialText: '+line1\n+line2',
    })
  })

  it('真实线格式(带 event 行)同样解析 —— 逐字取自 llm.py 的 yield 形态', () => {
    const { events } = parseSSEChunk(TOOL_DELTA_FRAME)
    expect(events).toHaveLength(1)
    expect(events[0]?.toolDelta).toMatchObject({ toolCallId: 'call-1', seq: 1 })
  })

  it('同 seq 重放幂等:同一帧解析两次得到逐字段等值的载荷(消费端覆盖写天然幂等)', () => {
    const frame = '{"type":"tool-delta","toolCallId":"call-1","seq":3,"partialText":"accumulated"}'
    const first = one(frame)?.toolDelta
    const second = one(frame)?.toolDelta
    expect(first).toBeDefined()
    expect(second).toEqual(first)
    // 粘包两帧(同 seq 与递增 seq)各自解析,互不合并、互不覆盖
    const { events } = parseSSEChunk(`data: ${frame}\ndata: ${frame}\n`)
    expect(events).toHaveLength(2)
    expect(events[1]?.toolDelta).toEqual(events[0]?.toolDelta)
  })

  it('字段类型不对一律丢弃,绝不回落成 chunk(宁可不显示也绝不喷正文)', () => {
    // toolCallId 非 string(缺 / null / 数字)
    expect(one('{"type":"tool-delta","seq":1,"partialText":"x"}')).toBeUndefined()
    expect(one('{"type":"tool-delta","toolCallId":null,"seq":1,"partialText":"x"}')).toBeUndefined()
    expect(one('{"type":"tool-delta","toolCallId":7,"seq":1,"partialText":"x"}')).toBeUndefined()
    // partialText 非 string(缺 / null / 数组)
    expect(one('{"type":"tool-delta","toolCallId":"c1","seq":1}')).toBeUndefined()
    expect(
      one('{"type":"tool-delta","toolCallId":"c1","seq":1,"partialText":null}'),
    ).toBeUndefined()
    expect(
      one('{"type":"tool-delta","toolCallId":"c1","seq":1,"partialText":["a"]}'),
    ).toBeUndefined()
  })

  it('字段收窄口径与 api-client tryParseToolDelta 一致:seq 非 number 归 0,truncated 仅 true 才带键', () => {
    const bare = one('{"type":"tool-delta","toolCallId":"c1","partialText":"x"}')?.toolDelta
    expect(bare).toEqual({ toolCallId: 'c1', seq: 0, partialText: 'x' })
    expect(bare && 'truncated' in bare).toBe(false)
    // 后端只在截断时置 true(llm.py: if _pv_trunc: _pv_evt["truncated"] = True)
    const trunc = one(
      '{"type":"tool-delta","toolCallId":"c1","seq":10,"partialText":"x","truncated":true}',
    )?.toolDelta
    expect(trunc).toEqual({ toolCallId: 'c1', seq: 10, partialText: 'x', truncated: true })
    // 非 true 值不得凭空造出该键
    const falsy = one(
      '{"type":"tool-delta","toolCallId":"c1","seq":1,"partialText":"x","truncated":false}',
    )?.toolDelta
    expect(falsy && 'truncated' in falsy).toBe(false)
  })

  it('多帧混流:tool-delta 夹在正文与工具事件之间,正文与工具卡都不被它改写', () => {
    const raw =
      'data: {"type":"chunk","content":"我来改这个文件"}\n' +
      'data: {"type":"tool-call-start","toolCallId":"call-1","toolName":"write_file"}\n' +
      'data: {"type":"tool-delta","toolCallId":"call-1","seq":1,"partialText":"+a\\n"}\n' +
      'data: {"type":"chunk","content":"改完了"}\n'
    const { events } = parseSSEChunk(raw)
    expect(events.map((e) => e.type)).toEqual(['chunk', 'tool-call-start', 'tool-delta', 'chunk'])
    expect(events.map((e) => e.content).filter(Boolean)).toEqual(['我来改这个文件', '改完了'])
  })

  it('不回退:terminal_delta(D19-A1 同一位置的同族分支)行为逐字不变', () => {
    const evt = one(
      '{"type":"terminal_delta","terminalId":"tc-1","command":"pnpm test","stream":"stdout","text":"ok\\n","iteration":3}',
    )
    expect(evt?.type).toBe('terminal_delta')
    expect(evt?.toolDelta).toBeUndefined()
    expect(evt?.terminalDelta).toMatchObject({ terminalId: 'tc-1', text: 'ok\n', iteration: 3 })
  })

  it('不回退:泛化兜底仍服务非 tool-delta 的裸 content/delta/text 帧', () => {
    expect(one('{"content":"普通增量"}')?.type).toBe('chunk')
    expect(one('{"delta":"普通增量"}')?.type).toBe('chunk')
    expect(one('{"text":"普通增量"}')?.type).toBe('chunk')
  })
})
