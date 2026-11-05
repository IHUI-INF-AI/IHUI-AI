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
const SRC = (rel: string): string =>
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', rel), 'utf8')

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
    for (const ch of [cp(0x200a), cp(0x2028), cp(0x2065), cp(0x2066)])
      expect(countInvisibleForTransport(`a${ch}b`), U(ch)).toBe(0)
  })

  it('④ 幂等:剥过的文本再剥仍是它自己,计数归零', () => {
    const once = stripInvisibleForTransport(WATERMARK_LIKE)
    expect(once).toBe('xxx')
    expect(countInvisibleForTransport(once)).toBe(0)
    expect(stripInvisibleForTransport(once)).toBe(once)
  })

  it('⑤ 非字符串/空值不炸(工具结果可能没有正文)', () => {
    const loose = stripInvisibleForTransport as unknown as (v: unknown, k?: boolean) => unknown
    expect(loose(undefined)).toBe(undefined)
    expect(loose(null)).toBe(null)
    expect(stripInvisibleForTransport('')).toBe('')
    expect(countInvisibleForTransport('')).toBe(0)
  })

  it('⑥ 整族逐码点都被认出(漏一档 = 该档载荷照样 400)', () => {
    const inRange = [ZWSP, ZWNJ, ZWJ, LRM, RLM, WJ, ...INVISIBLE_OPS, BOM, SHY]
    expect(inRange.length).toBe(12)
    // 夹具形状锁:cp() 若被 .map 直接接走(index/array 会当码点喂进 String.fromCharCode)
    for (const ch of inRange) expect(ch.length).toBe(1)
    for (const ch of inRange) {
      expect(countInvisibleForTransport(`a${ch}b`), U(ch)).toBe(1)
      expect(stripInvisibleForTransport(`a${ch}b`), U(ch)).toBe('ab')
    }
  })

  it('⑦ keepZwj 档:ZWJ 是唯一被留下的码点(emoji 家族不得被拆散)', () => {
    const family = `👩${ZWJ}👩${ZWJ}👧`
    expect(countInvisibleForTransport(family, true)).toBe(0)
    expect(stripInvisibleForTransport(family, true)).toBe(family)
    // 同一段里混进水印字母表的其他码点 ⇒ 照样认出并剥掉,ZWJ 一个不动
    const mixed = family + ZWSP + BOM
    expect(countInvisibleForTransport(mixed, true)).toBe(2)
    expect(stripInvisibleForTransport(mixed, true)).toBe(family)
    // 反向锁:tool 档(keepZwj=false)仍按全族判,两把尺不可互换
    expect(countInvisibleForTransport(family, false)).toBe(2)
  })

  it('⑧ 表级:每一档都过,但非 tool 档留 ZWJ', () => {
    const tool = { role: 'tool', content: `read_file 结果${ZWSP}${ZWJ}`, tool_call_id: 'c1' }
    const user = { role: 'user', content: `用户原文${ZWSP}${ZWJ}` }
    const summary = { role: 'system', content: `上下文摘要${BOM}` }
    const clean = { role: 'assistant', content: '干净正文' }
    const out = sanitizeMessagesForTransport([user, clean, tool, summary])
    expect(out[2]!.content).toBe('read_file 结果') // tool:ZWJ 也剥
    expect(out[2]!.tool_call_id).toBe('c1')
    expect(out[0]!.content).toBe(`用户原文${ZWJ}`) // 非 tool:ZWJ 留,载荷剥
    expect(out[3]!.content).toBe('上下文摘要')
    expect(out[1]).toBe(clean) // 零命中的那条连对象引用都不换
  })

  it('⑨ 表级:全表零命中 ⇒ 返回入参数组本身(主循环每轮都过这里)', () => {
    const arr = [
      { role: 'user', content: 'a' },
      { role: 'tool', content: 'b' },
      { role: 'assistant', content: null },
    ]
    expect(sanitizeMessagesForTransport(arr)).toBe(arr)
  })

  it('⑩ 接线锁:三个 provider 出口全部带清洗(摘掉任一即翻红)', () => {
    const src = SRC('src/commands/agent.ts')
    const exits =
      (src.match(/streamChat\(\{/g) ?? []).length +
      (src.match(/streamOpenAiCompatible\(\{/g) ?? []).length
    expect(exits, 'apps/cli 的出站调用点数量变了 ⇒ 本锁的射程要跟着逐处点名').toBe(3)
    expect((src.match(/messages:\s*sanitizeMessagesForTransport\(/g) ?? []).length).toBe(3)
    expect(src).toMatch(/messages:\s*sanitizeMessagesForTransport\(\s*opts\.messages\s*\)/)
    expect(src).toMatch(/messages:\s*sanitizeMessagesForTransport\(\s*\[\s*\{ role: 'system'/)
    expect(src).toMatch(/messages:\s*sanitizeMessagesForTransport\(\s*toOpenAiMessages\(/)
    const mutant = 'await streamChat({ model, messages: opts.messages, signal })'
    expect((mutant.match(/messages:\s*sanitizeMessagesForTransport\(/g) ?? []).length).toBe(0)
  })

  it('⑪ 判据单源:agent.ts 只许 import 复用,不得出现第二份零宽实现', () => {
    const src = SRC('src/commands/agent.ts')
    expect(src).toMatch(/from '\.\.\/util\/invisible-transport\.js'/)
    expect(/\\u200[B-F]/.test(src), 'agent.ts 内出现零宽码点字面量 ⇒ 判据必须回到本模块').toBe(
      false,
    )
  })

  it('⑫ 载荷确实会从非 tool 档漏出去(这两条通路是判据要覆盖全部角色的依据)', () => {
    // 实测:工具输出被按 role:'user' 入历史;压缩摘要是一条非 tool 消息而它带压缩前原文。
    expect(SRC('src/commands/agent.ts')).toMatch(
      /opts\.messages\.push\(\{ role: 'user', content \}\)/,
    )
    expect(SRC('src/compaction-v2.ts')).toMatch(/content: `\[上下文摘要/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
