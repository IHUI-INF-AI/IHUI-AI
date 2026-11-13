// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D6(2026-11-12) 流式兜底文本解码缺陷回归测试。
 *
 * 被测实现:apps/miniapp-taro/src/utils/taro-stream-transport.ts 的 `text()`(L119-129)。
 * 缺陷:旧实现逐 chunk `new TextDecoder().decode(c)` 不带 {stream:true},一个 UTF-8 多字节
 * 字符被 chunk 边界劈开时,每半各出一个 U+FFFD(兜底全量文本在汉字/emoji 上必花脸)。
 * 修复:单 decoder 带 {stream:true} 连续解码 + 末次 `decoder.decode()` 冲刷残缺尾序列。
 *
 * 本测试调用**真实导出** createTaroStreamTransport:mock @tarojs/taro 的 Taro.request,
 * 用 task.onChunkReceived 把多字节字符的 UTF-8 字节从中间劈成两个 chunk 喂进去,
 * 再触发 success 拿到响应对象,调用其 text() 断言结果完整、不含 U+FFFD;
 * 并同时断言「旧逻辑(逐 chunk 独立 decode)确实产出 U+FFFD」,把缺陷钉住(判别力)。
 */
import { describe, it, expect, vi } from 'vitest'

// === vi.hoisted 提升 mock 状态容器(vi.mock 工厂被 hoist,不能引用外部变量) ===
const mocks = vi.hoisted(() => {
  return {
    chunkCallback: null as ((res: { data: ArrayBuffer }) => void) | null,
    requestOpts: null as
      | (Record<string, unknown> & {
          success?: (res: {
            statusCode: number
            data: unknown
            header?: Record<string, string>
          }) => void
        })
      | null,
  }
})

vi.mock('@tarojs/taro', () => {
  const ENV_TYPE = { WEB: 'WEB', WEAPP: 'WEAPP' }
  const Taro = {
    ENV_TYPE,
    getEnv: () => 'WEAPP', // 非 WEB ⇒ 走小程序 enableChunked 分支(被测路径)
    request: (opts: Record<string, unknown>) => {
      mocks.requestOpts = opts as typeof mocks.requestOpts
      const task = {
        abort: () => {},
        onChunkReceived: (cb: (res: { data: ArrayBuffer }) => void) => {
          mocks.chunkCallback = cb
        },
      }
      return task
    },
  }
  return { default: Taro }
})

import { createTaroStreamTransport } from '../taro-stream-transport'

/** 把一个多字节字符的 UTF-8 字节从中间劈成两个 chunk(缺陷触发形态) */
function splitBytes(s: string): [Uint8Array, Uint8Array] {
  const bytes = new TextEncoder().encode(s)
  const mid = Math.floor(bytes.length / 2)
  return [bytes.slice(0, mid), bytes.slice(mid)]
}

/** 通过真实 transport 喂两个 chunk 并取回 text() 结果 */
async function decodeViaTransport(chunks: Uint8Array[]): Promise<string> {
  const transport = createTaroStreamTransport()
  const responsePromise = transport('https://example.invalid/sse', {
    method: 'GET',
    headers: {},
    signal: undefined,
  })
  for (const c of chunks) {
    const ab = new ArrayBuffer(c.byteLength)
    new Uint8Array(ab).set(c)
    mocks.chunkCallback?.({ data: ab })
  }
  mocks.requestOpts?.success?.({ statusCode: 200, data: '' })
  const response = await responsePromise
  expect(response.ok).toBe(true)
  return response.text()
}

describe('taro-stream-transport text() D6 多字节跨界解码', () => {
  it('新逻辑:连续 stream:true 解码 + 末次冲刷 ⇒ emoji 跨 chunk 边界完整还原,无 U+FFFD', async () => {
    const expected = '👍🏽中文'
    const [a, b] = splitBytes(expected)
    const out = await decodeViaTransport([a, b])
    expect(out).toBe(expected)
    expect(out).not.toContain('\uFFFD')
  })

  it('新逻辑:汉字跨 chunk 边界同样完整(多组连续 chunk)', async () => {
    const expected = '智汇AI流式解码'
    const bytes = new TextEncoder().encode(expected)
    // 逐字节切,最大化 chunk 边界落在多字节序列中间的概率
    const chunks = Array.from(bytes, (b) => new Uint8Array([b]))
    const out = await decodeViaTransport(chunks)
    expect(out).toBe(expected)
    expect(out).not.toContain('\uFFFD')
  })

  it('判别力:旧逻辑(逐 chunk 独立 decode)在同样输入下会产出 U+FFFD', () => {
    const expected = '👍🏽中文'
    const [a, b] = splitBytes(expected)
    // 旧实现逐 chunk 各自 new 一个 decoder 独立 decode
    const legacyOut =
      new TextDecoder('utf-8', { fatal: false }).decode(a) +
      new TextDecoder('utf-8', { fatal: false }).decode(b)
    expect(legacyOut).toContain('\uFFFD')
    expect(legacyOut).not.toBe(expected)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
