// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  countInvisibleForTransport,
  countOrphanZwj,
  sanitizeMessagesForTransport,
  stripInvisibleForTransport,
  stripOrphanZwj,
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

describe('invisible-transport(自治会话自毒病灶,2026-11-05 三次修正同一条)', () => {
  it('① 剥掉零宽族,可见字节一字不动', () => {
    const src = `def f(a):${ZWJ}${ZWSP} pass${BOM}`
    expect(stripInvisibleForTransport(src)).toBe('def f(a): pass')
    expect(countInvisibleForTransport(src)).toBe(3)
  })

  it('② 命中数为 0 ⇒ 返回同一引用', () => {
    const src = '普通文本,含中文与一家'
    expect(countInvisibleForTransport(src)).toBe(0)
    expect(stripInvisibleForTransport(src)).toBe(src)
  })

  it('③ 有语义的空白不被误伤', () => {
    expect(stripInvisibleForTransport('a\tb\nc d')).toBe('a\tb\nc d')
    for (const ch of [cp(0x200a), cp(0x2028), cp(0x2065), cp(0x2066)])
      expect(countInvisibleForTransport(`a${ch}b`), U(ch)).toBe(0)
  })

  it('④ 幂等', () => {
    const once = stripInvisibleForTransport(WATERMARK_LIKE)
    expect(once).toBe('xxx')
    expect(stripInvisibleForTransport(once)).toBe(once)
  })

  it('⑤′ 射程第三格:零宽藏在 tool_calls[].function.arguments 里也必须剥(2026-11-06)', () => {
    // 立因:旧读数只覆盖 `content`,而会话读到带三层水印的源文件后会把内容抄进工具参数,
    // 载荷就换这一格出口 ⇒ `sent=0` 其实是仪器与病灶同盲一格。
    const ZW = String.fromCharCode(0x200b)
    const cleanCall = { function: { name: 'list_dir', arguments: '{"path":"clean"}' } }
    const dirtyCall = { function: { name: 'read_file', arguments: `{"path":"a${ZW}b.ts"}` } }
    const msgs = [
      { role: 'user', content: '干净正文' },
      { role: 'assistant', content: null, tool_calls: [dirtyCall, cleanCall] },
      { role: 'tool', content: '无参数的 tool 档' },
    ]
    const out = sanitizeMessagesForTransport(msgs, 'test')
    const args = (out[1].tool_calls ?? []).map((c) => c?.function?.arguments).join('|')
    expect(args).not.toContain(ZW)
    expect(args).toContain('{"path":"ab.ts"}')
    // 成对反向:参数本来就干净的调用**不得被重写**(引用相等 = 不复制、不重排)
    expect(out[1].tool_calls?.[1]).toBe(cleanCall)
    // content 为 null 的助手消息保持 null(不得把"没有正文"洗成空串)
    expect(out[1].content).toBeNull()
    // 只在参数格命中(content 干净)也必须触发清洗
    const onlyArgs = [{ role: 'assistant', content: '正常正文', tool_calls: [dirtyCall] }]
    expect(
      (sanitizeMessagesForTransport(onlyArgs, 'test')[0].tool_calls?.[0]?.function?.arguments ??
        '') as string,
    ).not.toContain(ZW)
    expect(onlyArgs[0].content).toBe('正常正文')
  })

  it('⑤ 非字符串/空值不炸', () => {
    const loose = stripInvisibleForTransport as unknown as (v: unknown, k?: boolean) => unknown
    expect(loose(undefined)).toBe(undefined)
    expect(loose(null)).toBe(null)
    expect(stripInvisibleForTransport('')).toBe('')
  })

  it('⑥ 整族逐码点都被认出', () => {
    const inRange = [ZWSP, ZWNJ, ZWJ, LRM, RLM, WJ, ...INVISIBLE_OPS, BOM, SHY]
    expect(inRange.length).toBe(12)
    for (const ch of inRange) expect(ch.length).toBe(1)
    for (const ch of inRange) {
      expect(countInvisibleForTransport(`a${ch}b`), U(ch)).toBe(1)
      expect(stripInvisibleForTransport(`a${ch}b`), U(ch)).toBe('ab')
    }
  })

  it('⑦ keepZwj 档只保 emoji 家族里那一枚,孤零 ZWJ 一样算命中', () => {
    const family = `👩${ZWJ}👩${ZWJ}👧`
    expect(countInvisibleForTransport(family, true)).toBe(0)
    expect(stripInvisibleForTransport(family, true)).toBe(family)
    const mixed = family + ZWSP + BOM + ZWJ
    expect(countInvisibleForTransport(mixed, true)).toBe(3)
    expect(stripInvisibleForTransport(mixed, true)).toBe(family)
    expect(countInvisibleForTransport(family, false)).toBe(2)
  })

  it('⑧ 表级:每一档都过;干净那条连对象引用都不换', () => {
    const tool = { role: 'tool', content: `read_file 结果${ZWSP}${ZWJ}`, tool_call_id: 'c1' }
    const user = { role: 'user', content: `工具输出改走这档${ZWSP}${ZWJ}` }
    const summary = { role: 'system', content: `上下文摘要${BOM}` }
    const clean = { role: 'assistant', content: family0() }
    const out = sanitizeMessagesForTransport([user, clean, tool, summary])
    expect(out[2]!.content).toBe('read_file 结果')
    expect(out[2]!.tool_call_id).toBe('c1')
    // 收窄后的契约:user 档也清到底(ZWJ 两侧非图画字符 ⇒ 剥)
    expect(out[0]!.content).toBe('工具输出改走这档')
    expect(out[3]!.content).toBe('上下文摘要')
    expect(out[1]).toBe(clean)
    function family0(): string {
      return `👩${ZWJ}👩${ZWJ}👧`
    }
  })

  it('⑨ 全表零命中 ⇒ 返回入参数组本身', () => {
    const arr = [
      { role: 'user', content: 'a' },
      { role: 'tool', content: 'b' },
      { role: 'assistant', content: null },
    ]
    expect(sanitizeMessagesForTransport(arr)).toBe(arr)
  })

  it('⑩ 三个 provider 出口全部带清洗(摘掉任一即翻红)', () => {
    const src = SRC('src/commands/agent.ts')
    const exits =
      (src.match(/streamChat\(\{/g) ?? []).length +
      (src.match(/streamOpenAiCompatible\(\{/g) ?? []).length
    expect(exits).toBe(3)
    expect((src.match(/messages:\s*sanitizeMessagesForTransport\(/g) ?? []).length).toBe(3)
    expect(src).toMatch(
      /messages:\s*sanitizeMessagesForTransport\(\s*opts\.messages\s*,\s*'streamChat'/,
    )
    expect(src).toMatch(/messages:\s*sanitizeMessagesForTransport\(\s*\[\s*\{ role: 'system'/)
    expect(src).toMatch(/messages:\s*sanitizeMessagesForTransport\(\s*toOpenAiMessages\(/)
    const mutant = 'await streamChat({ model, messages: opts.messages, signal })'
    expect((mutant.match(/messages:\s*sanitizeMessagesForTransport\(/g) ?? []).length).toBe(0)
  })

  it('⑪ 判据单源:agent.ts 不得出现第二份零宽实现', () => {
    const src = SRC('src/commands/agent.ts')
    expect(src).toMatch(/from '\.\.\/util\/invisible-transport\.js'/)
    expect(/\\u200[B-F]/.test(src)).toBe(false)
  })

  it('⑫ 载荷确实会从非 tool 档漏出去', () => {
    expect(SRC('src/commands/agent.ts')).toMatch(
      /opts\.messages\.push\(\{ role: 'user', content \}\)/,
    )
    expect(SRC('src/compaction-v2.ts')).toMatch(/content: `\[上下文摘要/)
  })

  it('⑬ 自查仪器:缺省静默,开档报 raw/sent/zwj/extra 四格', () => {
    const writes: string[] = []
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => {
      writes.push(String(c))
      return true
    })
    try {
      const msgs = [
        { role: 'user', content: `带载荷${ZWSP}` },
        { role: 'tool', content: `工具结果${ZWJ}` },
      ]
      sanitizeMessagesForTransport(msgs, 'unit')
      expect(writes.length).toBe(0)
      process.env.IHUI_TRANSPORT_AUDIT = '1'
      sanitizeMessagesForTransport(msgs, 'streamChat')
      expect(writes[0]).toContain('exit=streamChat')
      expect(writes[0]).toMatch(/raw=2 sent=0 zwj=0/)
      writes.length = 0
      sanitizeMessagesForTransport([{ role: 'user', content: 'clean' }], 'streamChat', {
        tools: [{ desc: `带载荷${ZWSP}` }],
      })
      expect(writes[0]).toMatch(/sent=0 zwj=0 extra=1/)
    } finally {
      spy.mockRestore()
      delete process.env.IHUI_TRANSPORT_AUDIT
    }
  })

  it('⑭ 孤零 ZWJ 也要剥(第三次修正:88 枚 ZWJ 曾随 role:user 出去)', () => {
    const family = `👩${ZWJ}👩${ZWJ}👧`
    expect(countOrphanZwj(family)).toBe(0)
    expect(stripOrphanZwj(family)).toBe(family)
    const wm = `x${ZWJ}y${ZWJ}${ZWSP}`
    expect(countOrphanZwj(wm)).toBe(2)
    expect(stripOrphanZwj(wm)).toBe(`xy${ZWSP}`)
    expect(countInvisibleForTransport(wm, true)).toBe(3)
    expect(stripInvisibleForTransport(wm, true)).toBe('xy')
    const out = sanitizeMessagesForTransport([
      { role: 'user', content: `工具输出${ZWSP}${ZWJ}尾巴` },
      { role: 'assistant', content: family },
    ])
    expect(out[0]!.content).toBe('工具输出尾巴')
    expect(out[1]!.content).toBe(family)
  })

  it('⑮ zwj 那一格报的是" survivors ":出去的不含孤零 ZWJ', () => {
    const writes: string[] = []
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => {
      writes.push(String(c))
      return true
    })
    try {
      process.env.IHUI_TRANSPORT_AUDIT = '1'
      const before = [{ role: 'user', content: `a${ZWJ}b` }]
      const out = sanitizeMessagesForTransport(before, 'streamChat')
      expect(out[0]!.content).toBe('ab')
      expect(writes[0]).toMatch(/raw=1 sent=0 zwj=0/)
    } finally {
      spy.mockRestore()
      delete process.env.IHUI_TRANSPORT_AUDIT
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
