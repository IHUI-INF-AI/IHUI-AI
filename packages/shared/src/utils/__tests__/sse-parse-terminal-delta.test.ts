// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { parseSSEChunk } from '../sse-parse'

function one(line: string) {
  const { events } = parseSSEChunk(`data: ${line}\n`)
  return events[0]
}

/** 后端 apps/ai-service/app/services/mcp_server.py::_emit_terminal_delta 的真实帧形态
 *  (带 text、不带 content/delta) —— 逐字段照抄,不按前端想象造数据 */
const TERMINAL_DELTA_FRAME =
  '{"type":"terminal_delta","terminalId":"tc-1","command":"pnpm test",' +
  '"stream":"stdout","text":"\\n✓ 7 passed\\n","iteration":3,"messageId":"m-1"}'

describe('sse-parse terminal_delta(D19-A1:终端输出不得混进聊天正文)', () => {
  it('阳性对照:合法 terminal_delta 不被判成 chunk,content 未被填充', () => {
    const evt = one(TERMINAL_DELTA_FRAME)
    expect(evt).toBeDefined()
    expect(evt?.type).not.toBe('chunk')
    expect(evt?.type).toBe('terminal_delta')
    // 污染面的直接断言:stdout 永远不得出现在 content 里
    expect(evt?.content).toBeUndefined()
    expect(evt?.terminalDelta).toEqual({
      terminalId: 'tc-1',
      command: 'pnpm test',
      stream: 'stdout',
      text: '\n✓ 7 passed\n',
      iteration: 3,
      messageId: 'm-1',
    })
  })

  it('缺 terminalId 的 terminal_delta 不被当成正文(丢弃,不回落 chunk)', () => {
    const evt = one('{"type":"terminal_delta","command":"ls","stream":"stdout","text":"a\\nb"}')
    expect(evt).toBeUndefined()
  })

  it('缺 text 的 terminal_delta 同样丢弃(不得凭空造一行正文)', () => {
    expect(one('{"type":"terminal_delta","terminalId":"tc-1","stream":"stdout"}')).toBeUndefined()
    expect(
      one('{"type":"terminal_delta","terminalId":"tc-1","text":null,"iteration":1}'),
    ).toBeUndefined()
  })

  it('字段收窄口径与 api-client tryParseTerminalDelta 一致', () => {
    // stream 非 stderr(含缺失/任意值)一律归 stdout;iteration 非 number 归 0
    const evt = one('{"type":"terminal_delta","terminalId":"tc-2","text":"x"}')
    expect(evt?.terminalDelta).toEqual({
      terminalId: 'tc-2',
      command: '',
      stream: 'stdout',
      text: 'x',
      iteration: 0,
    })
    // 刻意不写 messageId ⇒ 结果也不得凭空造该键(与注入帧同一纪律)
    expect(evt?.terminalDelta && 'messageId' in evt.terminalDelta).toBe(false)
    expect(
      one('{"type":"terminal_delta","terminalId":"t","text":"e","stream":"stderr"}')?.terminalDelta
        ?.stream,
    ).toBe('stderr')
  })

  it('不回退①:既有 chunk 帧(带 content)仍走正文增量', () => {
    const evt = one('{"type":"chunk","content":"你好"}')
    expect(evt?.type).toBe('chunk')
    expect(evt?.content).toBe('你好')
  })

  it('不回退②:泛化兜底仍服务非 terminal_delta 的裸 text 帧(防修过头)', () => {
    const evt = one('{"text":"普通增量"}')
    expect(evt?.type).toBe('chunk')
    expect(evt?.content).toBe('普通增量')
  })

  it('不回退③:terminal_start / terminal_end 行为不变', () => {
    const start = one(
      '{"type":"terminal_start","terminalId":"tc-1","command":"ls","startedAt":"t"}',
    )
    expect(start?.type).toBe('terminal_start')
    expect(start?.terminalStart).toEqual({
      terminalId: 'tc-1',
      command: 'ls',
      status: 'running',
      startedAt: 't',
      messageId: undefined,
    })
    expect(start?.content).toBeUndefined()

    const end = one(
      '{"type":"terminal_end","terminalId":"tc-1","status":"completed","output":"1.txt","exitCode":0,"durationMs":12}',
    )
    expect(end?.type).toBe('terminal_end')
    expect(end?.terminalEnd).toMatchObject({
      terminalId: 'tc-1',
      status: 'completed',
      output: '1.txt',
      exitCode: 0,
      durationMs: 12,
    })
    expect(end?.content).toBeUndefined()
  })

  it('多帧混流:delta 夹在正文中间也不会被喷进气泡', () => {
    const raw =
      'data: {"type":"chunk","content":"执行结果："}\n' +
      `data: ${TERMINAL_DELTA_FRAME}\n` +
      'data: {"type":"chunk","content":"如上。"}\n'
    const { events } = parseSSEChunk(raw)
    expect(events.map((e) => e.type)).toEqual(['chunk', 'terminal_delta', 'chunk'])
    expect(events.map((e) => e.content).filter(Boolean)).toEqual(['执行结果：', '如上。'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
