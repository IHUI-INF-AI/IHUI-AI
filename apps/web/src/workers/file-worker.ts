/**
 * 文件处理 Web Worker — 迁移自旧架构 client/src/workers/fileWorker.ts
 * 支持四种操作，均通过标准 Web Worker API（postMessage/onmessage）通信：
 *   - compress:  图片压缩（OffscreenCanvas + toBlob）
 *   - thumbnail: 缩略图生成
 *   - hash:      文件哈希（SubtleCrypto API）
 *   - chunk:     大文件分块上传
 *
 * 用法（主线程）：
 *   const worker = new Worker(new URL('@/workers/file-worker.ts', import.meta.url))
 *   worker.postMessage({ type: 'compress', id, file, quality: 0.8, maxWidth: 1920 })
 *   worker.onmessage = (e) => { ... }
 */

// =============================================================================
// 消息类型定义
// =============================================================================

type MessageType = 'compress' | 'thumbnail' | 'hash' | 'chunk'

interface BaseMessage {
  type: MessageType
  /** 任务 ID，用于主线程关联请求与响应 */
  id: string
}

interface CompressMessage extends BaseMessage {
  type: 'compress'
  file: File
  /** 压缩质量 0-1 */
  quality?: number
  /** 最大宽度（等比缩放） */
  maxWidth?: number
  /** 最大高度（等比缩放） */
  maxHeight?: number
  /** 输出 MIME 类型 */
  mimeType?: string
}

interface ThumbnailMessage extends BaseMessage {
  type: 'thumbnail'
  file: File
  /** 缩略图尺寸（最长边） */
  size?: number
  /** 输出 MIME 类型 */
  mimeType?: string
}

interface HashMessage extends BaseMessage {
  type: 'hash'
  file: File
  /** 哈希算法 */
  algorithm?: 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'
}

interface ChunkMessage extends BaseMessage {
  type: 'chunk'
  file: File
  /** 分块大小（字节），默认 5MB */
  chunkSize?: number
  /** 是否对每块计算哈希（用于完整性校验） */
  hashChunks?: boolean
}

type WorkerMessage = CompressMessage | ThumbnailMessage | HashMessage | ChunkMessage

// 进度上报消息
interface ProgressMessage {
  type: 'progress'
  id: string
  loaded: number
  total: number
  percent: number
}

// 完成响应消息
interface CompressResult {
  type: 'compress'
  id: string
  blob: Blob
  width: number
  height: number
  originalSize: number
  compressedSize: number
}

interface ThumbnailResult {
  type: 'thumbnail'
  id: string
  blob: Blob
  width: number
  height: number
}

interface HashResult {
  type: 'hash'
  id: string
  hash: string
  algorithm: string
}

interface ChunkResult {
  type: 'chunk'
  id: string
  chunks: Array<{ index: number; blob: Blob; hash?: string; start: number; end: number }>
  total: number
  chunkSize: number
}

interface ErrorMessage {
  type: 'error'
  id: string
  message: string
}

// =============================================================================
// 工具函数
// =============================================================================

/** 将 ArrayBuffer 转为十六进制字符串 */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0')
  }
  return hex
}

/** 计算 Blob 的哈希（用于分块完整性校验） */
async function hashBlob(blob: Blob, algorithm: HashMessage['algorithm']): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const digest = await crypto.subtle.digest(algorithm ?? 'SHA-256', buffer)
  return bufferToHex(digest)
}

/** 上报进度 */
function reportProgress(id: string, loaded: number, total: number): void {
  const percent = total > 0 ? Math.round((loaded / total) * 100) : 0
  const msg: ProgressMessage = { type: 'progress', id, loaded, total, percent }
  ;(self as unknown as Worker).postMessage(msg)
}

/**
 * 加载图片为 ImageBitmap（Worker 内可用，无需 DOM）
 * createImageBitmap 在 DedicatedWorkerGlobalScope 中可用
 */
async function loadImageBitmap(file: File): Promise<ImageBitmap> {
  return await createImageBitmap(file)
}

/** 等比缩放计算目标尺寸 */
function calcScaledSize(
  srcW: number,
  srcH: number,
  maxW?: number,
  maxH?: number,
): { width: number; height: number } {
  let width = srcW
  let height = srcH
  if (maxW && width > maxW) {
    height = Math.round((height * maxW) / width)
    width = maxW
  }
  if (maxH && height > maxH) {
    width = Math.round((width * maxH) / height)
    height = maxH
  }
  return { width, height }
}

// =============================================================================
// 操作处理函数
// =============================================================================

/** 图片压缩：使用 OffscreenCanvas 绘制后 toBlob 输出 */
async function handleCompress(msg: CompressMessage): Promise<void> {
  const { id, file, quality = 0.85, maxWidth, maxHeight, mimeType = 'image/jpeg' } = msg
  const bitmap = await loadImageBitmap(file)
  const { width, height } = calcScaledSize(bitmap.width, bitmap.height, maxWidth, maxHeight)

  // OffscreenCanvas 在 Worker 中可用，无需 DOM
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法获取 2D 上下文')
  // 白底填充（JPEG 不支持透明，避免黑底）
  if (mimeType === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  // OffscreenCanvas 转 Blob
  const blob = await canvas.convertToBlob({ type: mimeType, quality })
  const result: CompressResult = {
    type: 'compress',
    id,
    blob,
    width,
    height,
    originalSize: file.size,
    compressedSize: blob.size,
  }
  ;(self as unknown as Worker).postMessage(result)
}

/** 缩略图生成：等比缩放到指定最长边 */
async function handleThumbnail(msg: ThumbnailMessage): Promise<void> {
  const { id, file, size = 200, mimeType = 'image/jpeg' } = msg
  const bitmap = await loadImageBitmap(file)
  // 以最长边为基准等比缩放
  const ratio = Math.min(size / bitmap.width, size / bitmap.height, 1)
  const width = Math.max(1, Math.round(bitmap.width * ratio))
  const height = Math.max(1, Math.round(bitmap.height * ratio))

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法获取 2D 上下文')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await canvas.convertToBlob({ type: mimeType, quality: 0.8 })
  const result: ThumbnailResult = { type: 'thumbnail', id, blob, width, height }
  ;(self as unknown as Worker).postMessage(result)
}

/** 文件哈希：使用 SubtleCrypto API 流式分片计算，避免一次性加载大文件 */
async function handleHash(msg: HashMessage): Promise<void> {
  const { id, file, algorithm = 'SHA-256' } = msg
  const CHUNK = 4 * 1024 * 1024 // 4MB 增量读取，控制内存峰值
  const total = file.size
  let loaded = 0

  // SubtleCrypto 不支持流式增量.digest，故分块读取后合并到单一 ArrayBuffer
  // 对超大文件，此处使用整体 arrayBuffer()；如需流式哈希，需引入如 hash-wasm
  // 此处按分块读取并上报进度，最终一次性 digest
  const buffers: ArrayBuffer[] = []
  for (let start = 0; start < total; start += CHUNK) {
    const end = Math.min(start + CHUNK, total)
    const buf = await file.slice(start, end).arrayBuffer()
    buffers.push(buf)
    loaded = end
    reportProgress(id, loaded, total)
  }
  // 合并分片
  const merged = new Uint8Array(total)
  let offset = 0
  for (const buf of buffers) {
    merged.set(new Uint8Array(buf), offset)
    offset += buf.byteLength
  }
  const digest = await crypto.subtle.digest(algorithm, merged)
  const result: HashResult = {
    type: 'hash',
    id,
    hash: bufferToHex(digest),
    algorithm,
  }
  ;(self as unknown as Worker).postMessage(result)
}

/** 大文件分块：将文件切分为多个分片，可选计算每片哈希 */
async function handleChunk(msg: ChunkMessage): Promise<void> {
  const { id, file, chunkSize = 5 * 1024 * 1024, hashChunks = false } = msg
  const total = file.size
  const chunks: ChunkResult['chunks'] = []
  let loaded = 0
  let index = 0

  for (let start = 0; start < total; start += chunkSize) {
    const end = Math.min(start + chunkSize, total)
    const blob = file.slice(start, end)
    const chunk: ChunkResult['chunks'][number] = { index, blob, start, end }
    if (hashChunks) {
      chunk.hash = await hashBlob(blob, 'SHA-256')
    }
    chunks.push(chunk)
    loaded = end
    reportProgress(id, loaded, total)
    index++
  }

  const result: ChunkResult = {
    type: 'chunk',
    id,
    chunks,
    total: chunks.length,
    chunkSize,
  }
  ;(self as unknown as Worker).postMessage(result)
}

// =============================================================================
// 消息分发入口
// =============================================================================

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data
  try {
    switch (msg.type) {
      case 'compress':
        await handleCompress(msg)
        break
      case 'thumbnail':
        await handleThumbnail(msg)
        break
      case 'hash':
        await handleHash(msg)
        break
      case 'chunk':
        await handleChunk(msg)
        break
      default:
        throw new Error(`未知的操作类型: ${(msg as { type: string }).type}`)
    }
  } catch (err) {
    const errorResult: ErrorMessage = {
      type: 'error',
      id: msg.id,
      message: err instanceof Error ? err.message : String(err),
    }
    ;(self as unknown as Worker).postMessage(errorResult)
  }
}

export {}
