// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D147(2026-09-29 立):traceparent 编解码与注入出口的常驻回归。
 *
 * 这一份为什么必须在仓库里而不是一次性证据跑:trace id 是"跨四个执行体拼一条链"的
 * 唯一把手,而它的形状判据(W3C `00-<32hex>-<16hex>-<2hex>`)一旦放松,表现不是报错,
 * 而是"某一跳静默没带上"——四段里少一段,而每一段自己看都是好的。
 * 所以每一条"应当拒"的输入都有用例钉住(尤其**不得把非法值原样透传**)。
 */
import { describe, expect, it } from 'vitest'

import {
  TRACE_ID_RESPONSE_HEADER,
  TRACEPARENT_HEADER,
  createTraceId,
  createTraceparent,
  isValidTraceparent,
  parseW3cTraceparent,
  readTraceIdFromResponse,
  traceIdFromTraceparent,
  withTraceparentHeader,
} from '../src/traceparent.js'

const VALID = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'

describe('D147 traceparent 解码', () => {
  it('① 合法值逐字段解出', () => {
    const p = parseW3cTraceparent(VALID)
    expect(p).not.toBeNull()
    expect(p?.version).toBe('00')
    expect(p?.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736')
    // W3C 规范把第二个字段叫 parent-id(它指向调用侧的 span),这里刻意跟规范同名 ——
    // 改成 spanId 会与 traceparent 字符串的官方术语脱节,而那一格只有读规范的人能发现。
    expect(p?.parentId).toBe('00f067aa0ba902b7')
    expect(p?.flags).toBe('01')
  })

  it('② 非法形态一律 null(不得"尽力解析"后把脏值传下去)', () => {
    for (const raw of [
      null,
      undefined,
      '',
      'garbage',
      '00-xyz-00f067aa0ba902b7-01', // trace id 非 hex
      '00-4bf92f3577b34da6a3ce929d0e0e473-00f067aa0ba902b7-01', // 31 位
      '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b-01', // span 15 位
      '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7', // 缺 flags
      // 全 0 的 trace id 在 W3C 里是无效值(它等于"没有 trace"),不得当成一条链的把手
      '00-00000000000000000000000000000000-00f067aa0ba902b7-01',
    ]) {
      expect(isValidTraceparent(raw), `应判非法:${String(raw)}`).toBe(false)
      expect(traceIdFromTraceparent(raw)).toBeNull()
    }
  })

  it('③ createTraceparent 产出自己可解(自证闭环)', () => {
    const tp = createTraceparent()
    expect(isValidTraceparent(tp)).toBe(true)
    expect(traceIdFromTraceparent(tp)).toHaveLength(32)
    expect(createTraceId()).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('D147 出站注入(唯一咽喉)', () => {
  it('④ 没带 ⇒ 新起一条;带了合法值 ⇒ 原样保留(延续同一条 trace)', () => {
    const fresh = withTraceparentHeader({})
    expect(isValidTraceparent(fresh[TRACEPARENT_HEADER])).toBe(true)

    const kept = withTraceparentHeader({ traceparent: VALID })
    expect(kept[TRACEPARENT_HEADER]).toBe(VALID)
  })

  it('⑤ 带的是非法值 ⇒ 换新,不得把脏头透传出去', () => {
    const out = withTraceparentHeader({ traceparent: 'not-a-traceparent' })
    expect(out[TRACEPARENT_HEADER]).not.toBe('not-a-traceparent')
    expect(isValidTraceparent(out[TRACEPARENT_HEADER])).toBe(true)
  })

  it('⑥ 大小写历史写法都算"已带"(Traceparent / traceparent 不得各起一条)', () => {
    const out = withTraceparentHeader({ Traceparent: VALID })
    expect(Object.keys(out).filter((k) => k.toLowerCase() === TRACEPARENT_HEADER)).toHaveLength(1)
    expect(out['Traceparent']).toBe(VALID)
  })

  it('⑦ 不原地改调用方对象(端上 headers 常被复用/冻结)', () => {
    const input: Record<string, string> = { accept: 'application/json' }
    const out = withTraceparentHeader(input)
    expect(input).toEqual({ accept: 'application/json' })
    expect(out).not.toBe(input)
  })
})

describe('D147 回带', () => {
  it('⑧ X-Trace-Id 优先;两种头对象(fetch Headers 与纯对象)同结论', () => {
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736'
    const asMap = { [TRACE_ID_RESPONSE_HEADER]: traceId }
    expect(readTraceIdFromResponse(asMap)).toBe(traceId)
    expect(
      readTraceIdFromResponse({
        get: (n: string) => (n.toLowerCase() === 'x-trace-id' ? traceId.toUpperCase() : null),
      }),
    ).toBe(traceId) // 归一成小写:同一 id 不得因大小写被读成两条链
  })

  it('⑨ 只有 traceparent 回显时从它取;两个都没有 ⇒ null(不得拿请求侧值冒充服务端确认)', () => {
    expect(readTraceIdFromResponse({ traceparent: VALID })).toBe(
      '4bf92f3577b34da6a3ce929d0e0e4736',
    )
    expect(readTraceIdFromResponse({})).toBeNull()
    expect(readTraceIdFromResponse(null)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
