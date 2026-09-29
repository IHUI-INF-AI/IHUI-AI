// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  declaredContentLength,
  fetchGatedBlob,
  GatedBlobError,
  GATED_BLOB_MAX_BYTES,
  isOverByteLimit,
  readGatedBlob,
  type GatedBlobStreamResponse,
} from '@/lib/gated-blob-fetch'

/**
 * G-851 / G-852 的字节闸判据。
 *
 * 核心一组是"Content-Length 谎报小值":声明 10 字节而流里真吐了 24 字节 ——
 * 声明侧全部放过、真实侧必须拦。把闸写成读一次 content-length 就收工,这组用例
 * 就是它唯一的反证(立项时仓内既有形态 `delimited-file-preview.tsx` 正是只看声明值;
 * 2026-09-29 G-815996 已把该站点接入本出口,这句留作史证)。
 */

/** 夹具:按 sizes 逐块吐字节;contentLength 可与它矛盾。 */
function streamResponse(
  sizes: readonly number[],
  contentLength: string | null,
  contentType = 'image/png',
  ok = true,
): GatedBlobStreamResponse & { readonly reads: () => number } {
  let cursor = 0
  const response: GatedBlobStreamResponse & { reads(): number } = {
    ok,
    headers: {
      get: (name: string) =>
        name === 'content-length' ? contentLength : name === 'content-type' ? contentType : null,
    },
    body: {
      getReader: () => ({
        read: async () => {
          if (cursor >= sizes.length) return { done: true, value: undefined }
          const size = sizes[cursor] ?? 0
          cursor += 1
          return { done: false, value: new Uint8Array(size) }
        },
      }),
    },
    reads: () => cursor,
  }
  return response
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('数值闸 isOverByteLimit', () => {
  it('上限本身不算越界,越界一位即判(闭集边界,与 classifyDelimitedText 同档)', () => {
    expect(isOverByteLimit(20, 20)).toBe(false)
    expect(isOverByteLimit(21, 20)).toBe(true)
    expect(isOverByteLimit(GATED_BLOB_MAX_BYTES + 1, GATED_BLOB_MAX_BYTES)).toBe(true)
  })

  it('量不到(非有限)不得当成"没超":NaN 一律越界;非法上限同样拒', () => {
    expect(isOverByteLimit(Number.NaN, 20)).toBe(true)
    expect(isOverByteLimit(10, Number.NaN)).toBe(true)
    expect(isOverByteLimit(10, 0)).toBe(true)
    expect(isOverByteLimit(10, -1)).toBe(true)
  })
})

describe('声明体积只当优化,不当放行依据(G-852)', () => {
  it('Content-Length 谎报 10 而真流吐 24 ⇒ 中止并拒绝,且拒绝码是真实字节那一档', async () => {
    const response = streamResponse([8, 8, 8], '10')
    const controller = new AbortController()

    const error = await readGatedBlob(response, controller, 20).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(GatedBlobError)
    const rejection = error as GatedBlobError
    expect(rejection.field).toBe('body')
    // 关键:不是 declaredTooLarge —— 谎报的小值没能提前收手,是真字节把它拦下的
    expect(rejection.reasonCode).toBe('tooLarge')
    expect(rejection.readBytes).toBe(24)
    expect(rejection.maxBytes).toBe(20)
    // abort 真被调用,不是"抛错了事"
    expect(controller.signal.aborted).toBe(true)
  })

  it('反向对照:真字节未超限 ⇒ 完整拿到 Blob 且不中止(闸不得写成恒失败)', async () => {
    const response = streamResponse([8, 8], '10')
    const controller = new AbortController()

    const blob = await readGatedBlob(response, controller, 20)

    expect(blob.size).toBe(16)
    expect(blob.type).toBe('image/png')
    expect(controller.signal.aborted).toBe(false)
  })

  it('声明值本身就超限 ⇒ 提前收手,一格字节都不读', async () => {
    const response = streamResponse([8, 8, 8], '1000')
    const controller = new AbortController()

    const error = await readGatedBlob(response, controller, 20).catch((e: unknown) => e)

    expect((error as GatedBlobError).reasonCode).toBe('declaredTooLarge')
    expect(response.reads()).toBe(0)
    expect(controller.signal.aborted).toBe(true)
  })

  it('声明缺失/非法 ⇒ 不猜大小,照常按真实字节判', async () => {
    expect(declaredContentLength({ get: () => null })).toBeNull()
    expect(declaredContentLength({ get: () => 'abc' })).toBeNull()
    expect(declaredContentLength({ get: () => '12' })).toBe(12)

    const blob = await readGatedBlob(streamResponse([4], null), new AbortController(), 20)
    expect(blob.size).toBe(4)
  })
})

describe('其余拒绝态与入口编排', () => {
  it('!ok ⇒ httpStatus(不带 URL 原文);body 为空 ⇒ noStream(不许"无脑 res.blob()"绕过闸)', async () => {
    const statusError = await readGatedBlob(
      streamResponse([8], '8', 'image/png', false),
      new AbortController(),
      20,
    ).catch((e: unknown) => e)
    expect((statusError as GatedBlobError).reasonCode).toBe('httpStatus')
    expect((statusError as GatedBlobError).field).toBe('response')

    const noStreamResponse: GatedBlobStreamResponse = {
      ok: true,
      headers: { get: () => null },
      body: null,
    }
    const noStreamError = await readGatedBlob(noStreamResponse, new AbortController(), 20).catch(
      (e: unknown) => e,
    )
    expect((noStreamError as GatedBlobError).reasonCode).toBe('noStream')
  })

  it('流中途报错 ⇒ 结构化 network 且中止读取', async () => {
    const broken: GatedBlobStreamResponse = {
      ok: true,
      headers: { get: () => null },
      body: {
        getReader: () => ({
          read: async () => {
            throw new TypeError('stream reset')
          },
        }),
      },
    }
    const controller = new AbortController()

    const error = await readGatedBlob(broken, controller, 20).catch((e: unknown) => e)

    expect((error as GatedBlobError).reasonCode).toBe('network')
    expect(controller.signal.aborted).toBe(true)
  })

  it('fetchGatedBlob:signal 交给 fetch,越界时该 signal 真的被 abort(端到端接线)', async () => {
    let seenSignal: AbortSignal | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: unknown, init?: { signal?: AbortSignal }) => {
        seenSignal = init?.signal
        return streamResponse([8, 8, 8], '10')
      }),
    )

    const error = await fetchGatedBlob('https://cdn.example.com/secret/photo.png', 20).catch(
      (e: unknown) => e,
    )

    expect(seenSignal).toBeInstanceOf(AbortSignal)
    expect((error as GatedBlobError).reasonCode).toBe('tooLarge')
    expect(seenSignal?.aborted).toBe(true)
  })

  it('fetch 被 CORS 拒时不落原异常文本:消息里没有 URL 与正文(G-851 的诚实前提)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch https://cdn.example.com/private/a.png')
      }),
    )

    const error = await fetchGatedBlob('https://cdn.example.com/private/a.png', 20).catch(
      (e: unknown) => e,
    )

    expect(error).toBeInstanceOf(GatedBlobError)
    expect((error as GatedBlobError).field).toBe('request')
    expect((error as GatedBlobError).reasonCode).toBe('network')
    expect((error as Error).message).not.toContain('cdn.example.com')
    expect((error as Error).message).not.toContain('private')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
