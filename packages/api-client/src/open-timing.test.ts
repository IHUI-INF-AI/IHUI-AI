// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-998168 票5(2026-10-05 立):首帧耗时分段归因解析面测试(纯内存,无网络)。
// 契约:**回传不落库(机主拍板⑥)** —— 服务端把分段计时挂在首帧数据载荷的顶层可选字段
// openTiming 上(additive optional,非新增命名事件);端内经 extractOpenTiming 提取,
// 正文仍由 parseStreamLine 照常产出(字段级增量,不做帧级分流)。
// 断言面:完整字段集提取 / 非法形态整体拒收(半个分段对象比没有更误导,不做部分放行)/
// 带 openTiming 的 chunk 帧正文不被吞、字段不喷进正文。
import { describe, expect, it } from 'vitest'
import { extractOpenTiming, parseStreamLine, type StreamOpenTiming } from './client'

/** 合法分段对象(与网关侧 apps/api StreamOpenTiming 字段集同形) */
const VALID_OPEN_TIMING: StreamOpenTiming = {
  version: 1,
  prepareMs: 12,
  upstreamConnectMs: 34,
  firstByteMs: 56,
  storageReadMs: null,
  coldStart: true,
}

const chunkLineWithTiming = `data: ${JSON.stringify({
  type: 'chunk',
  content: '你好',
  openTiming: VALID_OPEN_TIMING,
})}`

describe('extractOpenTiming — G-998168 票5 首帧分段归因', () => {
  it('从带 openTiming 的 data: 行完整提取字段集', () => {
    expect(extractOpenTiming(chunkLineWithTiming)).toEqual(VALID_OPEN_TIMING)
  })

  it('各段为 null 的不可信样本照常提取(缺席语义,非零耗时)', () => {
    const line = `data: ${JSON.stringify({
      type: 'chunk',
      content: 'hi',
      openTiming: {
        version: 1,
        prepareMs: null,
        upstreamConnectMs: null,
        firstByteMs: null,
        storageReadMs: null,
        coldStart: false,
      },
    })}`
    expect(extractOpenTiming(line)).toEqual({
      version: 1,
      prepareMs: null,
      upstreamConnectMs: null,
      firstByteMs: null,
      storageReadMs: null,
      coldStart: false,
    })
  })

  it('无 openTiming 字段 / 非 JSON / Vercel 协议 / event:/id: 行 / [DONE] / 空行 ⇒ null', () => {
    expect(extractOpenTiming('data: {"type":"chunk","content":"hi"}')).toBe(null)
    expect(extractOpenTiming('data: not-json')).toBe(null)
    expect(extractOpenTiming('0:"vercel-token"')).toBe(null)
    expect(extractOpenTiming('event: chunk')).toBe(null)
    expect(extractOpenTiming('id: 42')).toBe(null)
    expect(extractOpenTiming('data: [DONE]')).toBe(null)
    expect(extractOpenTiming('')).toBe(null)
  })

  it('字段集/取值校验失败 ⇒ 整体拒收(不做部分放行)', () => {
    const base = { ...VALID_OPEN_TIMING }
    // version 非 1(未版本化的旧载荷/未来版本都不放行)
    expect(
      extractOpenTiming(
        `data: ${JSON.stringify({ type: 'chunk', openTiming: { ...base, version: 2 } })}`,
      ),
    ).toBe(null)
    expect(
      extractOpenTiming(
        `data: ${JSON.stringify({ type: 'chunk', openTiming: { ...base, version: '1' } })}`,
      ),
    ).toBe(null)
    // ms 非整数(浮点/字符串/undefined)/ 缺字段
    expect(
      extractOpenTiming(
        `data: ${JSON.stringify({ type: 'chunk', openTiming: { ...base, prepareMs: 1.5 } })}`,
      ),
    ).toBe(null)
    expect(
      extractOpenTiming(
        `data: ${JSON.stringify({ type: 'chunk', openTiming: { ...base, firstByteMs: '56' } })}`,
      ),
    ).toBe(null)
    const missing = { ...base } as Record<string, unknown>
    delete missing.upstreamConnectMs
    expect(
      extractOpenTiming(`data: ${JSON.stringify({ type: 'chunk', openTiming: missing })}`),
    ).toBe(null)
    // coldStart 非 boolean
    expect(
      extractOpenTiming(
        `data: ${JSON.stringify({ type: 'chunk', openTiming: { ...base, coldStart: 'true' } })}`,
      ),
    ).toBe(null)
    // openTiming 非对象(字符串/数组)/ 非法 JSON
    expect(extractOpenTiming(`data: ${JSON.stringify({ type: 'chunk', openTiming: 'x' })}`)).toBe(
      null,
    )
    expect(extractOpenTiming('data: {"openTiming":')).toBe(null)
  })
})

describe('parseStreamLine 与 openTiming 的字段级共存', () => {
  it('带 openTiming 的 chunk 帧:正文照常产出,归因字段不喷进正文、不丢帧', () => {
    expect(parseStreamLine(chunkLineWithTiming)).toBe('你好')
  })

  it('带 openTiming 的 OpenAI choices 帧:delta 正文照常产出', () => {
    const line = `data: ${JSON.stringify({
      choices: [{ delta: { content: 'delta 文本' } }],
      openTiming: VALID_OPEN_TIMING,
    })}`
    expect(parseStreamLine(line)).toBe('delta 文本')
    expect(extractOpenTiming(line)).toEqual(VALID_OPEN_TIMING)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
