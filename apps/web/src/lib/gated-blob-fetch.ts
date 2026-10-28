// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 受字节上限闸的取体出口(G-851 / G-852,2026-09-29 立)。
 *
 * 平台特有:依赖浏览器 fetch 与响应流,跨端不共用(AGENTS §3)。
 *
 * 两条判据不许漂:
 *  1. 最终判定**只看累计真实字节**。`Content-Length` 最多用来提前收手省流量
 *     (那是优化,不是闸)—— 谎报小值的上游/CDN 正是 G-852 的立项原因。
 *  2. 拒绝是结构化的(`field` + `reasonCode`),message 不回显 URL 原文与正文;
 *     调用方按码分档,不得解析 message 文本。
 */

/** 单次取体的字节上限(唯一一处;改档只改这里)。 */
export const GATED_BLOB_MAX_BYTES = 50 * 1024 * 1024

/** 拒绝落在哪一层。 */
export type GatedBlobField = 'request' | 'response' | 'body'

/** 拒绝原因(封闭集)。 */
export type GatedBlobReasonCode =
  'network' | 'httpStatus' | 'noStream' | 'declaredTooLarge' | 'tooLarge'

/** 取体被拒:只带计数与档位,不带 URL 与正文。 */
export class GatedBlobError extends Error {
  readonly field: GatedBlobField
  readonly reasonCode: GatedBlobReasonCode
  readonly readBytes: number
  readonly maxBytes: number

  constructor(
    field: GatedBlobField,
    reasonCode: GatedBlobReasonCode,
    readBytes: number,
    maxBytes: number,
  ) {
    super(`gated blob ${field} rejected: ${reasonCode} (${readBytes}/${maxBytes} bytes)`)
    this.name = 'GatedBlobError'
    this.field = field
    this.reasonCode = reasonCode
    this.readBytes = readBytes
    this.maxBytes = maxBytes
  }
}

/** 越界判据:数值闸只有这一份。量不到(readBytes 非有限)不得当成"没超"。 */
export function isOverByteLimit(readBytes: number, maxBytes: number): boolean {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) return true
  if (!Number.isFinite(readBytes)) return true
  return readBytes > maxBytes
}

/** 只声明用到的三件事;真实 Response 结构上满足,测试可直接喂夹具。 */
export interface GatedBlobStreamResponse {
  readonly ok: boolean
  readonly headers: { get(name: string): string | null }
  readonly body: { getReader(): GatedBlobStreamReader } | null
}

/** 流块按 ArrayBuffer 支撑的精度声明 —— BlobPart 只收这一型(lib.dom 同形)。 */
type ByteChunk = Uint8Array<ArrayBuffer>

export interface GatedBlobStreamReader {
  read(): Promise<{ done?: boolean; value?: ByteChunk }>
}

export interface GatedBlobAborter {
  abort(): void
}

/** 取声明体积;缺失/非法一律 null(不得猜大小)。 */
export function declaredContentLength(headers: {
  get(name: string): string | null
}): number | null {
  const raw = headers.get('content-length')
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

/**
 * 逐块累加真实字节,越界即 `abort()` 并抛结构化拒绝。
 * 上限只在本函数内生效一次,调用方不得再抄一份判据。
 */
export async function readGatedBlob(
  response: GatedBlobStreamResponse,
  controller: GatedBlobAborter,
  maxBytes: number = GATED_BLOB_MAX_BYTES,
): Promise<Blob> {
  if (!response.ok) throw new GatedBlobError('response', 'httpStatus', 0, maxBytes)

  const declared = declaredContentLength(response.headers)
  if (declared !== null && isOverByteLimit(declared, maxBytes)) {
    controller.abort()
    throw new GatedBlobError('response', 'declaredTooLarge', declared, maxBytes)
  }

  const stream = response.body
  if (!stream) throw new GatedBlobError('response', 'noStream', 0, maxBytes)

  const reader = stream.getReader()
  const chunks: ByteChunk[] = []
  let readBytes = 0
  for (;;) {
    let next: { done?: boolean; value?: ByteChunk }
    try {
      next = await reader.read()
    } catch {
      controller.abort()
      throw new GatedBlobError('body', 'network', readBytes, maxBytes)
    }
    if (next.done) break
    const value = next.value
    if (!value) continue
    readBytes += value.byteLength
    if (isOverByteLimit(readBytes, maxBytes)) {
      controller.abort()
      throw new GatedBlobError('body', 'tooLarge', readBytes, maxBytes)
    }
    chunks.push(value)
  }

  return new Blob(chunks, { type: response.headers.get('content-type') ?? '' })
}

/**
 * 取体入口:自持 AbortController 并把 signal 交给 fetch,越界时由 readGatedBlob 收手。
 * `<img>` 显示得出来不代表 fetch 能过 CORS,所以取体失败必须原样抛给调用方(G-851)。
 */
export async function fetchGatedBlob(
  url: string,
  maxBytes: number = GATED_BLOB_MAX_BYTES,
): Promise<Blob> {
  const controller = new AbortController()
  let response: GatedBlobStreamResponse
  try {
    response = await fetch(url, { signal: controller.signal })
  } catch {
    throw new GatedBlobError('request', 'network', 0, maxBytes)
  }
  return readGatedBlob(response, controller, maxBytes)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
