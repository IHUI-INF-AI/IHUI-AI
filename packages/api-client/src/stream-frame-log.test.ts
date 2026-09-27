// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D116 原始 SSE 全帧采集器行为测试(纯内存,无网络):
// 断言"关闭零记录 / 开启逐行入环 / 环形截断保最新 / kind 提取 / JSONL 导出形状"。
import { afterEach, describe, expect, it } from 'vitest'
import {
  clearStreamFrames,
  countStreamFrames,
  exportStreamFramesJsonl,
  getStreamFrames,
  isStreamFrameCaptureOn,
  recordStreamFrame,
  setStreamFrameCapture,
} from './stream-frame-log'

afterEach(() => {
  setStreamFrameCapture(false)
  clearStreamFrames()
})

describe('stream-frame-log — D116 原始帧采集器', () => {
  it('默认关闭:recordStreamFrame 零记录(零开销契约)', () => {
    expect(isStreamFrameCaptureOn()).toBe(false)
    recordStreamFrame('data: {"type":"chunk"}')
    expect(countStreamFrames()).toBe(0)
  })

  it('开启后逐行入环;kind 从 data JSON 的 type 提取,id: 行记 id', () => {
    setStreamFrameCapture(true)
    recordStreamFrame('data: {"type":"chunk","content":"hi"}')
    recordStreamFrame('id: 42')
    recordStreamFrame('data: {"other":1}')
    recordStreamFrame('')
    const frames = getStreamFrames()
    expect(frames.map((f) => f.kind)).toEqual(['chunk', 'id', 'raw'])
    expect(frames[0]!.raw).toContain('"type":"chunk"')
    expect(frames.every((f) => f.seq > 0)).toBe(true)
    expect(frames[1]!.seq).toBe(frames[0]!.seq + 1)
  })

  it('环形截断:超过 2000 帧丢最旧,保最新(快照只读)', () => {
    setStreamFrameCapture(true)
    for (let i = 0; i < 2005; i++) recordStreamFrame(`data: {"type":"chunk","n":${i}}`)
    expect(countStreamFrames()).toBe(2000)
    const frames = getStreamFrames()
    expect(frames[0]!.raw).toContain('"n":5')
    expect(frames[frames.length - 1]!.raw).toContain('"n":2004')
  })

  it('exportStreamFramesJsonl:每行一个 JSON 且字段齐全', () => {
    setStreamFrameCapture(true)
    recordStreamFrame('data: {"type":"done"}')
    const jsonl = exportStreamFramesJsonl()
    const lines = jsonl.split('\n')
    expect(lines).toHaveLength(1)
    const parsed = JSON.parse(lines[0]!) as {
      seq: number
      kind: string
      atMs: number
      bytes: number
      raw: string
    }
    expect(parsed.kind).toBe('done')
    expect(parsed.raw).toContain('done')
    expect(typeof parsed.atMs).toBe('number')
    expect(parsed.bytes).toBeGreaterThan(0)
  })

  it('clearStreamFrames 清空;开关切换不清帧', () => {
    setStreamFrameCapture(true)
    recordStreamFrame('data: {"type":"chunk"}')
    setStreamFrameCapture(false)
    expect(countStreamFrames()).toBe(1)
    clearStreamFrames()
    expect(countStreamFrames()).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
