// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * multipart-download 的判据。
 *
 * 取材纪律与 ranged-download.test.ts 同源:传输层与文件层都是注入替身,本模块要证明的是
 * "清单校验 / 偏移拼接 / 逐份对账 / 取消"这套调度,而不是 XHR 或 FileChannel 本身。
 * 替身刻意保留两条真实约束:
 *   1. `writeBytes` 按 `offset` 定位写(真实实现是 FileChannel.position()+write);
 *   2. 每份长度必须与清单声明一致,否则实现必须报错,而不是照写。
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

    open(mode?: string): FakeHandle {
      if (mode === 'wt') this.buf = new Uint8Array(0)
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
  downloadApkParts,
  PARTS_MANIFEST_SCHEMA,
  parsePartsManifest,
  PartsUnavailableError,
  planPartLayout,
  type ManifestTransport,
  type PartTransport,
} from '../multipart-download'
import { DownloadCancellation, DownloadCancelledError } from '../ranged-download'

const VERSION = '9.9.9'
const BASE = 'https://gitee.com/example/repo/releases/download/tag'
const MANIFEST_URL = `${BASE}/ihui-ai-parts.json`
const URI = 'file:///cache/ihui-ai-9.9.9.apk'

/** 两份故意不等长,证明"末份截断"与偏移累加都不是等长假设。 */
const SIZE_A = 64 * 1024
const SIZE_B = 13
const TOTAL = SIZE_A + SIZE_B
const NAME_A = `ihui-ai-${VERSION}-part-00.bin`
const NAME_B = `ihui-ai-${VERSION}-part-01.bin`

function manifestText(
  overrides: { version?: string; totalBytes?: number; parts?: unknown[] } = {},
): string {
  return JSON.stringify({
    schema: PARTS_MANIFEST_SCHEMA,
    version: overrides.version ?? VERSION,
    totalBytes: overrides.totalBytes ?? TOTAL,
    parts: overrides.parts ?? [
      { name: NAME_A, size: SIZE_A },
      { name: NAME_B, size: SIZE_B },
    ],
  })
}

/** 确定性字节图案:第 i 字节 = (i*31+7)&0xff,便于逐字节校验落盘位置。 */
function payload(total: number): Uint8Array {
  const out = new Uint8Array(total)
  for (let i = 0; i < total; i += 1) out[i] = (i * 31 + 7) & 0xff
  return out
}

const FULL = payload(TOTAL)

const manifestTransport: ManifestTransport = {
  async get(url, _timeout, cancellation) {
    if (cancellation.isCancelled) throw new DownloadCancelledError()
    expect(url).toBe(MANIFEST_URL)
    return manifestText()
  },
}

function makePartTransport(overrides: { short?: boolean } = {}): PartTransport {
  return {
    async get(url, _timeout, cancellation) {
      if (cancellation.isCancelled) throw new DownloadCancelledError()
      const index = [NAME_A, NAME_B].findIndex((name) => url === `${BASE}/${name}`)
      if (index < 0) throw new Error(`未知分片地址:${url}`)
      const start = index === 0 ? 0 : SIZE_A
      const size = index === 0 ? SIZE_A : SIZE_B
      const slice = FULL.slice(start, start + size)
      const body = slice.buffer.slice(
        slice.byteOffset,
        slice.byteOffset + slice.byteLength,
      ) as ArrayBuffer
      return {
        status: 200,
        // short:模拟"服务端给的文件比清单短" ⇒ 必须判死,不许把残包拼出来
        body: overrides.short ? body.slice(0, Math.max(1, body.byteLength - 1)) : body,
      }
    },
  }
}

beforeEach(() => {
  FILE_MOCK.registry.clear()
})

describe('parsePartsManifest:残缺/冒名清单一律判不可用', () => {
  it('合法清单 ⇒ 逐份尺寸与总量对上', () => {
    const m = parsePartsManifest(manifestText(), VERSION, 1)
    expect(m.totalBytes).toBe(TOTAL)
    expect(m.parts.map((p) => p.name)).toEqual([NAME_A, NAME_B])
    expect(m.parts.map((p) => p.size)).toEqual([SIZE_A, SIZE_B])
  })

  it('版本不符(旧包冒名)⇒ 抛 PartsUnavailableError', () => {
    expect(() => parsePartsManifest(manifestText({ version: '9.9.8' }), VERSION, 1)).toThrow(
      PartsUnavailableError,
    )
  })

  it('分片合计 ≠ totalBytes ⇒ 抛错(不拼半个包)', () => {
    expect(() => parsePartsManifest(manifestText({ totalBytes: TOTAL + 1 }), VERSION, 1)).toThrow(
      PartsUnavailableError,
    )
  })

  it('分片名越界(路径/陌生形态)⇒ 抛错', () => {
    const parts = [{ name: '../evil.bin', size: TOTAL }]
    expect(() => parsePartsManifest(manifestText({ parts }), VERSION, 1)).toThrow(
      PartsUnavailableError,
    )
  })

  it('schema 不是本协议 ⇒ 抛错,不猜旧格式', () => {
    const raw = JSON.stringify({ version: VERSION, totalBytes: TOTAL, parts: [] })
    expect(() => parsePartsManifest(raw, VERSION, 1)).toThrow(PartsUnavailableError)
  })
})

describe('planPartLayout', () => {
  it('按声明顺序累加偏移,末份不补齐', () => {
    const out = planPartLayout([
      { name: NAME_A, size: SIZE_A },
      { name: NAME_B, size: SIZE_B },
    ])
    expect(out.map((p) => p.start)).toEqual([0, SIZE_A])
    expect(out[1]!.start + out[1]!.size).toBe(TOTAL)
  })
})

describe('downloadApkParts', () => {
  it('全部到货 ⇒ 按偏移拼成整包,字节与清单总长一致', async () => {
    const result = await downloadApkParts({
      manifestUrl: MANIFEST_URL,
      expectedVersion: VERSION,
      uri: URI,
      minTotalBytes: 1,
      concurrency: 2,
      manifestTransport,
      transport: makePartTransport(),
    })
    const file = FILE_MOCK.registry.get(URI)
    expect(file).toBeTruthy()
    expect(file?.buf.length).toBe(TOTAL)
    expect(Array.from(file!.buf)).toEqual(Array.from(FULL))
    expect(result.bytes).toBe(TOTAL)
    expect(result.connections).toBe(2)
  })

  it('并发上限受份数约束(2 份要 8 路 ⇒ 只开 2 条)', async () => {
    const result = await downloadApkParts({
      manifestUrl: MANIFEST_URL,
      expectedVersion: VERSION,
      uri: URI,
      minTotalBytes: 1,
      concurrency: 8,
      manifestTransport,
      transport: makePartTransport(),
    })
    expect(result.connections).toBe(2)
  })

  it('某份长度与清单不符 ⇒ 抛错,不产出"看起来完整"的残包', async () => {
    await expect(
      downloadApkParts({
        manifestUrl: MANIFEST_URL,
        expectedVersion: VERSION,
        uri: URI,
        minTotalBytes: 1,
        concurrency: 1,
        manifestTransport,
        transport: makePartTransport({ short: true }),
      }),
    ).rejects.toThrow(/长度不符/)
  })

  it('取消 ⇒ DownloadCancelledError,不伪装成普通失败', async () => {
    const cancellation = new DownloadCancellation()
    const transport: PartTransport = {
      get: (_u, _t, c) =>
        new Promise((_resolve, reject) => {
          c.onCancel(() => reject(new DownloadCancelledError()))
        }),
    }
    const pending = downloadApkParts({
      manifestUrl: MANIFEST_URL,
      expectedVersion: VERSION,
      uri: URI,
      minTotalBytes: 1,
      cancellation,
      manifestTransport,
      transport,
      stallTimeoutMs: 1000,
    })
    cancellation.cancel()
    await expect(pending).rejects.toBeInstanceOf(DownloadCancelledError)
  })

  it('清单不在 gitee 域 ⇒ 直接判不可用(降级),不发任何请求', async () => {
    await expect(
      downloadApkParts({
        manifestUrl: 'https://evil.test/ihui-ai-parts.json',
        expectedVersion: VERSION,
        uri: URI,
        manifestTransport,
        transport: makePartTransport(),
      }),
    ).rejects.toBeInstanceOf(PartsUnavailableError)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
