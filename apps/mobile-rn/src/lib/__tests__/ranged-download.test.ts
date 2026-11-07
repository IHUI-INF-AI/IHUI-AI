// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ranged-download 的判据。
 *
 * 取材纪律:传输层与文件层都是**注入的替身**,本模块要证明的是"切窗/并发/定位写/失败口径"
 * 这套调度,而不是 XHR 或 FileChannel 本身。替身刻意保留两条真实约束,否则绿是假的:
 *   1. `writeBytes` 按 `offset` **定位写**且越界补零(真实实现是 FileChannel.position()+write);
 *   2. 分片必须回 206 且长度正确,否则实现必须报错,而不是照写。
 *
 * 为什么 FILE_MOCK 要在 `vi.hoisted` 里建:vi.mock 的工厂会被提升到 import 之前执行,
 * 直接引用模块级 class 会撞 "Cannot access before initialization"(2026-11-04 实测)。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const FILE_MOCK = vi.hoisted(() => {
  const registry = new Map<string, FakeFile>()

  class FakeHandle {
    offset: number | null = 0
    constructor(private readonly file: FakeFile) {}

    get size(): number | null {
      return this.file.buf.length
    }

    writeBytes(bytes: Uint8Array): void {
      const at = this.offset ?? 0
      this.file.ensure(at + bytes.byteLength)
      this.file.buf.set(bytes, at)
      this.offset = at + bytes.byteLength
    }

    readBytes(length: number): Uint8Array {
      const at = this.offset ?? 0
      this.offset = at + length
      return this.file.buf.slice(at, at + length)
    }

    close(): void {
      this.file.closed = true
    }
  }

  class FakeFile {
    buf = new Uint8Array(0)
    closed = false

    constructor(readonly uri: string) {
      registry.set(uri, this)
    }

    ensure(size: number): void {
      if (size <= this.buf.length) return
      const next = new Uint8Array(size)
      next.set(this.buf)
      this.buf = next
    }

    open(): FakeHandle {
      return new FakeHandle(this)
    }
  }

  return { registry, FakeFile }
})

vi.mock('expo-file-system', () => ({
  File: FILE_MOCK.FakeFile,
  FileMode: { ReadWrite: 'rw', ReadOnly: 'r', WriteOnly: 'w', Append: 'wa', Truncate: 'wt' },
}))

import {
  createSpeedMeter,
  DEFAULT_CONCURRENCY,
  downloadRanged,
  DownloadCancellation,
  DownloadCancelledError,
  normalizeConcurrency,
  parseContentRange,
  planRanges,
  RangeStalledError,
  RangeUnsupportedError,
  type RangeResponse,
  type RangeTransport,
} from '../ranged-download'

const CHUNK = 64 * 1024 // 实现侧有 64KB 下限:更小的 chunkBytes 会被抬到 64KB(防碎片请求风暴)
const TOTAL = 3 * CHUNK + 7 // 故意不整除,覆盖末片截断
const URL = 'https://example.test/ihui-ai.apk'
const URI = 'file:///cache/ihui-ai-test.apk'

/** 确定性字节图案:第 i 字节 = (i*31+7)&0xff,便于逐字节校验落盘位置。 */
function payload(total: number): Uint8Array {
  const out = new Uint8Array(total)
  for (let i = 0; i < total; i += 1) out[i] = (i * 31 + 7) & 0xff
  return out
}

const FULL = payload(TOTAL)

function bodyFor(start: number, end: number): ArrayBuffer {
  const slice = FULL.slice(start, end + 1)
  return slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength) as ArrayBuffer
}

interface Call {
  range: string
}

type Override = (
  start: number,
  end: number,
  attempt: number,
) => RangeResponse | Promise<RangeResponse>

/** 假传输:按 Range 头切真实字节;override 可注入 200 / 缺头 / 长度篡改 / 抛错。 */
function makeTransport(override?: Override): { transport: RangeTransport; calls: Call[] } {
  const calls: Call[] = []
  const transport: RangeTransport = {
    async get(_url, headers) {
      const range = headers.Range ?? ''
      calls.push({ range })
      const m = /^bytes=(\d+)-(\d+)$/.exec(range)
      if (!m) throw new Error(`非法 Range: ${range}`)
      const start = Number(m[1])
      const end = Number(m[2])
      if (override) return override(start, end, calls.length)
      return {
        status: 206,
        body: bodyFor(start, end),
        contentRange: `bytes ${start}-${end}/${TOTAL}`,
      }
    },
  }
  return { transport, calls }
}

beforeEach(() => {
  FILE_MOCK.registry.clear()
})

describe('parseContentRange', () => {
  it('解析常规形态并保留含端点', () => {
    expect(parseContentRange('bytes 0-1023/84915649')).toEqual({
      start: 0,
      end: 1023,
      total: 84915649,
    })
  })

  it('总长为 * 时 total 记 null(不是 0)', () => {
    expect(parseContentRange('bytes 0-0/*')).toEqual({ start: 0, end: 0, total: null })
  })

  it('畸形/缺失/端点倒挂/总长不合法一律 null', () => {
    expect(parseContentRange(null)).toBeNull()
    expect(parseContentRange('')).toBeNull()
    expect(parseContentRange('items 0-1/2')).toBeNull()
    expect(parseContentRange('bytes 9-3/100')).toBeNull()
    expect(parseContentRange('bytes 0-1023/1023')).toBeNull()
  })
})

describe('planRanges', () => {
  it('整除时最后一片正好收尾', () => {
    expect(planRanges(300, 100)).toEqual([
      { start: 0, end: 99 },
      { start: 100, end: 199 },
      { start: 200, end: 299 },
    ])
  })

  it('不整除时末片截断到剩余长度', () => {
    const ranges = planRanges(TOTAL, CHUNK)
    expect(ranges).toHaveLength(4)
    expect(ranges.at(-1)).toEqual({ start: 3 * CHUNK, end: TOTAL - 1 })
  })

  it('总量非法时给空表,不给"半片"', () => {
    expect(planRanges(0, 100)).toEqual([])
    expect(planRanges(Number.NaN, 100)).toEqual([])
  })
})

describe('normalizeConcurrency', () => {
  it('片数少于请求并发时按片数收敛', () => {
    expect(normalizeConcurrency(300, 100, 8)).toBe(3)
  })

  it('请求值非法时回落默认并发,且永不为 0', () => {
    expect(normalizeConcurrency(TOTAL, 1024, Number.NaN)).toBe(DEFAULT_CONCURRENCY)
    expect(normalizeConcurrency(TOTAL, TOTAL * 2, 0)).toBe(1)
  })
})

describe('createSpeedMeter', () => {
  it('只统计窗口内的样本', () => {
    const meter = createSpeedMeter(1000)
    meter.push(1000, 1000)
    meter.push(1000, 1500)
    expect(meter.bytesPerSecond(2000)).toBe(2000)
    expect(meter.bytesPerSecond(3000)).toBe(0) // 两个样本都已滑出窗口
  })

  it('非正字节数不入账', () => {
    const meter = createSpeedMeter(1000)
    meter.push(0, 0)
    meter.push(-5, 0)
    expect(meter.totalBytes()).toBe(0)
  })
})

describe('downloadRanged', () => {
  it('并发分片 + 定位写,落盘字节与源完全一致', async () => {
    const { transport, calls } = makeTransport()
    const progress: number[] = []
    const result = await downloadRanged({
      url: URL,
      uri: URI,
      chunkBytes: CHUNK,
      concurrency: 3,
      transport,
      progressIntervalMs: 50,
      onProgress: (p) => progress.push(p.downloadedBytes),
    })

    expect(result.bytes).toBe(TOTAL)
    expect(result.connections).toBe(3)
    const file = FILE_MOCK.registry.get(URI)
    expect(file?.buf.length).toBe(TOTAL)
    expect(Array.from(file?.buf ?? [])).toEqual(Array.from(FULL))
    expect(file?.closed).toBe(true)
    expect(calls[0]?.range).toBe('bytes=0-0')
    expect(calls.slice(1).every((c) => /^bytes=\d+-\d+$/.test(c.range))).toBe(true)
    expect(progress.at(-1)).toBe(TOTAL)
  })

  it('服务端回 200(无视 Range)⇒ 抛 RangeUnsupported,且一个字节都不写', async () => {
    const { transport } = makeTransport(() => ({
      status: 200,
      body: FULL.buffer.slice(0) as ArrayBuffer,
      contentRange: null,
    }))
    await expect(
      downloadRanged({ url: URL, uri: URI, chunkBytes: CHUNK, transport }),
    ).rejects.toBeInstanceOf(RangeUnsupportedError)
    expect(FILE_MOCK.registry.get(URI)?.buf.length ?? 0).toBe(0)
  })

  it('探针回 206 但总长未知(*)⇒ RangeUnsupported', async () => {
    const { transport } = makeTransport((start, end) => ({
      status: 206,
      body: bodyFor(start, end),
      contentRange: 'bytes 0-0/*',
    }))
    await expect(
      downloadRanged({ url: URL, uri: URI, chunkBytes: CHUNK, transport }),
    ).rejects.toBeInstanceOf(RangeUnsupportedError)
  })

  it('单片长度不符先重试,重试成功后整包仍一致', async () => {
    let truncated = false
    const { transport } = makeTransport((start, end) => {
      if (!truncated && start > 0) {
        truncated = true
        return {
          status: 206,
          body: new ArrayBuffer(1),
          contentRange: `bytes ${start}-${end}/${TOTAL}`,
        }
      }
      return {
        status: 206,
        body: bodyFor(start, end),
        contentRange: `bytes ${start}-${end}/${TOTAL}`,
      }
    })
    const result = await downloadRanged({ url: URL, uri: URI, chunkBytes: CHUNK, transport })
    expect(result.bytes).toBe(TOTAL)
    expect(Array.from(FILE_MOCK.registry.get(URI)?.buf ?? [])).toEqual(Array.from(FULL))
  })

  it('重试用尽后抛出,绝不把半包当成功', async () => {
    const { transport } = makeTransport(() => {
      throw new Error('连接重置')
    })
    await expect(
      downloadRanged({ url: URL, uri: URI, chunkBytes: CHUNK, transport }),
    ).rejects.toThrow('连接重置')
  })

  it('取消后抛 DownloadCancelledError,不在失败路径上继续派片', async () => {
    const cancellation = new DownloadCancellation()
    const { transport } = makeTransport((start, end, attempt) => {
      if (attempt === 1) {
        return { status: 206, body: bodyFor(start, end), contentRange: `bytes 0-0/${TOTAL}` }
      }
      cancellation.cancel()
      throw new Error('用户取消')
    })
    await expect(
      downloadRanged({ url: URL, uri: URI, chunkBytes: CHUNK, transport, cancellation }),
    ).rejects.toBeInstanceOf(DownloadCancelledError)
  })

  it('落盘长度与探针总长不符 ⇒ 绝不返回成功', async () => {
    const inflated = TOTAL + 1
    const { transport } = makeTransport((start, end) => {
      const clampedEnd = Math.min(end, TOTAL - 1)
      return {
        status: 206,
        body: bodyFor(start, clampedEnd),
        contentRange: `bytes ${start}-${clampedEnd}/${inflated}`,
      }
    })
    await expect(
      downloadRanged({ url: URL, uri: URI, chunkBytes: CHUNK, transport }),
    ).rejects.toThrow(/下载不完整|分片长度不符/)
  })

  it('首片一直不到货 ⇒ 看门狗撤单,不把 0% 伪装成「下载中」', async () => {
    // 真机形态:探针正常(206),但之后每条 Range 请求都挂到读超时,永不 settle。
    // 撤单必须能在请求仍挂着时发生(Promise.race),否则用户会一直盯着 0%。
    const transport: RangeTransport = {
      get(_url, headers, _timeoutMs, _cancellation) {
        if (String(headers.Range) === 'bytes=0-0') {
          return Promise.resolve({
            status: 206,
            body: new ArrayBuffer(1),
            contentRange: `bytes 0-0/${TOTAL}`,
          })
        }
        return new Promise<RangeResponse>(() => {})
      },
    }
    await expect(
      downloadRanged({
        url: URL,
        uri: URI,
        chunkBytes: CHUNK,
        transport,
        stallTimeoutMs: 1000,
      }),
    ).rejects.toBeInstanceOf(RangeStalledError)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
