// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-248 R1 第三格:顶层注入字段的**挑字段镜像锁**(2026-10-19 立)
 *
 * 锁的是什么:契约 `sse/contract.ts::SSEEventMeta` 声明的顶层注入字段集,与端上
 * `utils/sse-parse.ts::SSEEvent` 实际认领的字段集,必须**逐字段等值**。
 *
 * 为什么必须双向(只锁一边会漏另一半):
 *   ① 契约有、端上不认领 ⇒ 帧带着这个键到端上却被解析面丢掉 —— 正是本仓已记过的
 *      [[contract-and-view-green-while-parser-drops-fields]](契约与视图全绿而解析面丢字段)。
 *      本门立门时现读就抓到一枚真漏:`agentId` 在契约里、在端上 `SSEEvent` 里**一个都没有**,
 *      而 api-client 那条链的 `extractTopLevelAgentId` 一直在认 ⇒ 同一根线同一个键,
 *      一条链拿得到一条链拿不到。修法 = `parseLine` 最外层一并认领(与 traceId 同点)。
 *   ② 端上认领、契约没声明 ⇒ 端上自造字段。那会让"线格式"出现第二份真相源,后续加字段
 *      的人不知道该改哪边,通常的结局是两份各自漂。
 *
 * 判据面为什么读源码文本而不是 import:本文件读的是"声明面",要判的正是**两个文件之间
 * 的集合关系**;import 只能拿到运行期的对象形状(而且接口类型在运行期不存在)。
 * 与 `packages/api-client/tests/stream-error-report-trace-id.test.ts` 的合同面锁同构
 * (那份锁的是 SSEErrorInfo ↔ 上报体白名单,这份锁的是 SSEEventMeta ↔ SSEEvent)。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { parseSSEChunk } from '../../utils/sse-parse'

const SHARED_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const CONTRACT_SRC = readFileSync(`${SHARED_ROOT}sse/contract.ts`, 'utf8')
const PARSE_SRC = readFileSync(`${SHARED_ROOT}utils/sse-parse.ts`, 'utf8')

/** 取一个 interface 块的顶层字段名(两空格缩进、可选 `?`),与合同面锁同一形状。 */
function interfaceFields(src: string, name: string): string[] {
  const start = src.indexOf(`export interface ${name} {`)
  expect(start, `${name} 接口在源码里找不到`).toBeGreaterThan(0)
  const end = src.indexOf('\n}', start)
  expect(end, `${name} 接口块没找到收口`).toBeGreaterThan(start)
  return [...src.slice(start, end).matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]!).sort()
}

describe('G-248 R1 / 顶层注入字段镜像锁(契约 ⇄ 端上挑字段名单)', () => {
  const contractMeta = interfaceFields(CONTRACT_SRC, 'SSEEventMeta')
  const parserEvent = interfaceFields(PARSE_SRC, 'SSEEvent')

  it('契约声明的每个顶层注入字段,端上 SSEEvent 都认领(漏键即红)', () => {
    expect(contractMeta, 'SSEEventMeta 一个字段都没解析到 ⇒ 判据本身坏了,不是绿').not.toHaveLength(
      0,
    )
    const missing = contractMeta.filter((f) => !parserEvent.includes(f))
    expect(
      missing,
      `契约声明了但端上解析面不认领的顶层注入字段: ${missing.join(', ')}` +
        '(该型即"契约与视图全绿而解析面丢字段")',
    ).toEqual([])
  })

  it('端上认领的顶层注入字段都在契约里(端上不得自造线格式字段)', () => {
    // 只审"认领点那一层"的字段:SSEEvent 里大量字段是各事件自己的载荷键,不是顶层注入键,
    // 所以反向判据取"认领点实际会写的键"而不是整个 SSEEvent 字段集。
    const claimed = ['agentId', 'traceId'].sort()
    const invented = claimed.filter((f) => !contractMeta.includes(f))
    expect(invented, `端上认领了契约未声明的顶层注入字段: ${invented.join(', ')}`).toEqual([])
  })

  it('认领点实际写的键 == 契约声明的顶层注入字段(改一处不改另一处即红)', () => {
    const written = new Set<string>()
    const re = /frameMetaOfLine\(/g
    expect(PARSE_SRC.match(re), 'parseLine 的认领点(frameMetaOfLine)不见了 ⇒ 判据失效').not.toBeNull()
    // 认领点的返回形状就是"端上真正会写到事件上的顶层键"全集
    const block = PARSE_SRC.slice(
      PARSE_SRC.indexOf('function frameMetaOfLine'),
      PARSE_SRC.indexOf('function parseLineEvent'),
    )
    for (const m of block.matchAll(/\{ (\w+) \}/g)) written.add(m[1]!)
    expect([...written].sort(), 'frameMetaOfLine 实际写出的键与契约声明不一致').toEqual(contractMeta)
  })
})

describe('G-248 R1 / 顶层注入字段的运行时行为(认领点在最外层)', () => {
  it('具名帧带 agentId + traceId ⇒ 两个键都到事件上', () => {
    const line =
      'data: {"type":"chunk","content":"hi","agentId":"agent-42","traceId":"0af7651916cd43dd8448eb211c80319c"}'
    const { events } = parseSSEChunk(`${line}\n\n`)
    expect(events).toHaveLength(1)
    expect(events[0]?.agentId).toBe('agent-42')
    expect(events[0]?.traceId).toBe('0af7651916cd43dd8448eb211c80319c')
  })

  it('被泛化兜底折成 meta 的帧也带着顶层键(认领点在兜底之外)', () => {
    // 该帧不带 content/delta/text,会被 sessionId 兜底折成 {type:'meta', sessionId};
    // 顶层注入字段必须在折叠之前就挂上,否则整帧被折后反而丢了键。
    const line = 'data: {"sessionId":"s-1","agentId":"agent-7"}'
    const { events } = parseSSEChunk(`${line}\n\n`)
    expect(events).toHaveLength(1)
    expect(events[0]?.type).toBe('meta')
    expect(events[0]?.agentId).toBe('agent-7')
  })

  it('两个键都缺席 ⇒ 事件上一个都不写(缺席不是空串/null)', () => {
    const line = 'data: {"type":"chunk","content":"hi"}'
    const { events } = parseSSEChunk(`${line}\n\n`)
    expect(events).toHaveLength(1)
    expect('agentId' in (events[0] ?? {})).toBe(false)
    expect('traceId' in (events[0] ?? {})).toBe(false)
  })

  it('空串 agentId 不当值采信(缺席与空值必须可分)', () => {
    const line = 'data: {"type":"chunk","content":"hi","agentId":""}'
    const { events } = parseSSEChunk(`${line}\n\n`)
    expect(events).toHaveLength(1)
    expect('agentId' in (events[0] ?? {})).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
