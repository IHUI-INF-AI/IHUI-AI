// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 鉴权窗口消息缓冲回归锁(2026-11-12 立)。
 *
 * 钉住的是「握手成功但永远等不到 start」这一线上形状的根因:
 * `ws` 库在没有 message 监听器时丢弃到达帧,而 wsAuth 是异步的 ⇒ 客户端在 onopen 即发
 * 必然丢首帧(本机 8802 实测 120s 零帧)。本缓冲保证:鉴权期间到达的帧不丢、保序、有上限、
 * 鉴权失败即丢弃、交接后直通。
 */
import { describe, it, expect } from 'vitest'
import { createAuthWindowBuffer, DEFAULT_AUTH_WINDOW_BUFFER } from '../auth-window-buffer.js'

const buf = (s: string): Buffer => Buffer.from(s, 'utf8')
const text = (b: Buffer): string => b.toString('utf8')

describe('createAuthWindowBuffer', () => {
  it('鉴权期间缓冲、交接后按到达顺序回放', () => {
    const w = createAuthWindowBuffer()
    w.sink(buf('a'))
    w.sink(buf('b'))
    w.sink(buf('c'))
    expect(w.size).toBe(3)
    expect(w.handedOff).toBe(false)

    const seen: string[] = []
    w.handoff((raw) => seen.push(text(raw)))

    expect(seen).toEqual(['a', 'b', 'c'])
    expect(w.size).toBe(0)
    expect(w.handedOff).toBe(true)
  })

  it('交接后到达的帧直通,不再进缓冲', () => {
    const w = createAuthWindowBuffer()
    const seen: string[] = []
    w.handoff((raw) => seen.push(text(raw)))
    w.sink(buf('late-1'))
    w.sink(buf('late-2'))
    expect(seen).toEqual(['late-1', 'late-2'])
    expect(w.size).toBe(0)
  })

  it('无缓冲时 handoff 也能正常交接', () => {
    const w = createAuthWindowBuffer()
    const seen: string[] = []
    w.handoff((raw) => seen.push(text(raw)))
    w.sink(buf('x'))
    expect(seen).toEqual(['x'])
    expect(w.handedOff).toBe(true)
  })

  it('超过上限即丢弃(未鉴权连接不配当内存放大器),且不影响已缓冲帧', () => {
    const w = createAuthWindowBuffer(3)
    for (const s of ['1', '2', '3', '4', '5']) w.sink(buf(s))
    expect(w.size).toBe(3)

    const seen: string[] = []
    w.handoff((raw) => seen.push(text(raw)))
    // 保序保留最早的 3 条:上限只管数量,不重排、不覆盖
    expect(seen).toEqual(['1', '2', '3'])
  })

  it('单帧回放抛错不阻断后续帧(坏帧不吞整批)', () => {
    const w = createAuthWindowBuffer()
    w.sink(buf('ok-1'))
    w.sink(buf('bad'))
    w.sink(buf('ok-2'))

    const seen: string[] = []
    w.handoff((raw) => {
      const s = text(raw)
      if (s === 'bad') throw new Error('坏帧')
      seen.push(s)
    })
    expect(seen).toEqual(['ok-1', 'ok-2'])
    expect(w.size).toBe(0)
  })

  it('dispose 后丢弃缓冲、sink 不再接收、handoff 不再生效', () => {
    const w = createAuthWindowBuffer()
    w.sink(buf('a'))
    w.dispose()
    expect(w.size).toBe(0)

    w.sink(buf('b'))
    expect(w.size).toBe(0)

    const seen: string[] = []
    w.handoff((raw) => seen.push(text(raw)))
    expect(seen).toEqual([])
    expect(w.handedOff).toBe(false)
  })

  it('非法上限退化为不缓冲(不抛、不无限堆)', () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const w = createAuthWindowBuffer(bad)
      w.sink(buf('a'))
      expect(w.size, `上限 ${String(bad)} 应退化为 0`).toBe(0)
    }
  })

  it('默认上限是 16(与单连接在途请求上限同量级)', () => {
    expect(DEFAULT_AUTH_WINDOW_BUFFER).toBe(16)
    const w = createAuthWindowBuffer()
    for (let i = 0; i < DEFAULT_AUTH_WINDOW_BUFFER + 5; i += 1) w.sink(buf(String(i)))
    expect(w.size).toBe(DEFAULT_AUTH_WINDOW_BUFFER)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
