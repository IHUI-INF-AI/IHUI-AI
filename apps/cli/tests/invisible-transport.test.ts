// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  countInvisibleForTransport,
  sanitizeMessagesForTransport,
  stripInvisibleForTransport,
} from '../src/util/invisible-transport.js'

// 夹具一律按码点构造,源码不落任何真实零宽字符 —— 否则测试文件自己就成了载荷源。
const cp = (...codes: number[]): string => String.fromCharCode(...codes)
const ZWSP = cp(0x200b)
const ZWNJ = cp(0x200c)
const ZWJ = cp(0x200d)
const LRM = cp(0x200e)
const RLM = cp(0x200f)
const WJ = cp(0x2060)
const INVISIBLE_OPS = [0x2061, 0x2062, 0x2063, 0x2064].map((n) => cp(n))
const BOM = cp(0xfeff)
const SHY = cp(0x00ad)
const U = (ch: string): string => `U+${ch.codePointAt(0)!.toString(16).toUpperCase()}`

const WATERMARK_LIKE = 'xxx' + ZWSP + ZWNJ + ZWJ + WJ + BOM + SHY

describe('stripInvisibleForTransport(自治会话自毒病灶,2026-11-05 立)', () => {
  it('① 剥掉零宽族,可见字节一字不动', () => {
    const src = `def compute_simhash(a):${ZWJ}${ZWSP} pass${BOM}`
    expect(stripInvisibleForTransport(src)).toBe('def compute_simhash(a): pass')
    expect(countInvisibleForTransport(src)).toBe(3)
  })

  it('② 命中数为 0 ⇒ 返回同一引用(不给每条消息造新串)', () => {
    const src = '普通文本,含中文与 emoji 一家'
    expect(countInvisibleForTransport(src)).toBe(0)
    expect(stripInvisibleForTransport(src)).toBe(src)
  })

  it('③ 有语义的空白不被误伤(射程只收零语义码点)', () => {
    expect(stripInvisibleForTransport('a\tb\nc d')).toBe('a\tb\nc d')
    const HAIR_SPACE = cp(0x200a)
    const LINE_SEP = cp(0x2028)
    const WORD_SEP = cp(0x2065)
    const LRI = cp(0x2066)
    for (const ch of [HAIR_SPACE, LINE_SEP, WORD_SEP, LRI])
      expect(countInvisibleForTransport(`a${ch}b`), U(ch)).toBe(0)
  })

  it('④ 幂等:剥过的文本再剥仍是它自己,计数归零', () => {
    const once = stripInvisibleForTransport(WATERMARK_LIKE)
    expect(once).toBe('xxx')
    expect(countInvisibleForTransport(once)).toBe(0)
    expect(stripInvisibleForTransport(once)).toBe(once)
  })

  it('⑤ 非字符串/空值不炸(工具结果可能没有正文)', () => {
    // 按 unknown 入口调用:签名收窄成 string 也不会让这条锁失效(它测的是运行面兜底)
    const loose = stripInvisibleForTransport as unknown as (v: unknown) => unknown
    expect(loose(undefined)).toBe(undefined)
    expect(loose(null)).toBe(null)
    expect(stripInvisibleForTransport('')).toBe('')
    expect(countInvisibleForTransport('')).toBe(0)
  })

  it('⑥ 整族逐码点都被认出(漏一档 = 该档载荷照样 400)', () => {
    const inRange = [ZWSP, ZWNJ, ZWJ, LRM, RLM, WJ, ...INVISIBLE_OPS, BOM, SHY]
    expect(inRange.length).toBe(12)
    // 夹具形状锁:cp() 若被 .map 直接接走(index/array 会当码点喂进去),这里当场翻红
    for (const ch of inRange) expect(ch.length).toBe(1)
    for (const ch of inRange) {
      expect(countInvisibleForTransport(`a${ch}b`), U(ch)).toBe(1)
      expect(stripInvisibleForTransport(`a${ch}b`), U(ch)).toBe('ab')
    }
  })

  it('⑦ 表级:只有 tool 档动刀,其余角色连对象引用都不换', () => {
    const tool = { role: 'tool', content: `read_file 结果${ZWSP}${BOM}`, tool_call_id: 'c1' }
    const user = { role: 'user', content: `用户原文${ZWSP}` }
    const assistant = { role: 'assistant', content: `助手原文${ZWJ}` }
    const out = sanitizeMessagesForTransport([user, assistant, tool])
    expect(out[2]!.content).toBe('read_file 结果')
    expect(out[2]!.tool_call_id).toBe('c1')
    // 反向锁:非 tool 档必须**不**被动 —— 动了就是静默改坏用户可见内容
    expect(out[0]).toBe(user)
    expect(out[1]).toBe(assistant)
    expect((out[0] as { content: string }).content).toBe(`用户原文${ZWSP}`)
  })

  it('⑧ 表级:全表零命中 ⇒ 返回入参数组本身(主循环每轮都过这里,不能白拷一遍)', () => {
    const clean = [
      { role: 'user', content: 'a' },
      { role: 'tool', content: 'b' },
    ]
    expect(sanitizeMessagesForTransport(clean)).toBe(clean)
  })

  it('⑨ 表级:content 为 null / 缺省不炸(assistant 只带 tool_calls 的那一档)', () => {
    const out = sanitizeMessagesForTransport([
      { role: 'assistant', content: null },
      { role: 'tool', content: undefined },
      { role: 'tool', content: `尾部带载荷${ZWSP}` },
    ] as never)
    expect(out[0]!.content).toBe(null)
    expect(out[2]!.content).toBe('尾部带载荷')
  })

  it('⑩ 接线锁:agent.ts 的三个 provider 出口全部带清洗(摘掉任一即翻红)', () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'commands', 'agent.ts'),
      'utf8',
    )
    // 出口清点:数的是真发请求的那三处(带大括号的调用形态),import 语句不计
    const exits =
      (src.match(/streamChat\(\{/g) ?? []).length +
      (src.match(/streamOpenAiCompatible\(\{/g) ?? []).length
    expect(exits, 'apps/cli 的出站调用点数量变了 ⇒ 本锁的射程要跟着逐处点名').toBe(3)
    expect((src.match(/messages:\s*sanitizeMessagesForTransport\(/g) ?? []).length).toBe(3)
    // 逐处点名:总数够了不算,一处写两遍会顶掉另一处漏接
    expect(src).toMatch(/messages:\s*sanitizeMessagesForTransport\(\s*opts\.messages\s*\)/)
    expect(src).toMatch(/messages:\s*sanitizeMessagesForTransport\(\s*\[\s*\{ role: 'system'/)
    expect(src).toMatch(/messages:\s*sanitizeMessagesForTransport\(\s*toOpenAiMessages\(/)
    // 变异自证:同一套模式必须认不出"未接线"的形态,否则上面三条是空断言
    const mutant = 'await streamChat({ model, messages: opts.messages, signal })'
    expect((mutant.match(/messages:\s*sanitizeMessagesForTransport\(/g) ?? []).length).toBe(0)
  })

  it('⑪ 判据单源:agent.ts 只许 import 复用,不得出现第二份零宽剥离实现', () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'commands', 'agent.ts'),
      'utf8',
    )
    expect(src).toMatch(/from '\.\.\/util\/invisible-transport\.js'/)
    expect(
      /\\u200[B-F]/.test(src),
      'agent.ts 内出现了零宽码点字面量 ⇒ 判据必须回到 invisible-transport.ts',
    ).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
