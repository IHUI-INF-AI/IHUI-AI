import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
  preHandlerHookHandler,
} from 'fastify'
import fp from 'fastify-plugin'

/**
 * 上传内容安全扫描。
 *
 * 能力：
 *  - 文件类型白名单（扩展名校验）
 *  - 文件大小限制
 *  - 文件头魔数校验（防伪装，检测真实 MIME）
 *  - 危险特征检测（HTML/JS/PE/ELF 脚本/可执行）
 *  - 文件名安全化（防路径穿越）
 *
 * 集成方式：作为 preHandler 钩子挂到上传端点。
 *  - multipart 请求：读取文件 buffer 做魔数校验，校验通过后将 buffer 挂到
 *    request.scannedFile，供 handler 直接使用（避免重复消费 stream）
 *  - JSON 请求（如 oss /oss/upload 代理）：校验 body.filename + body.size
 */

// 已知魔数签名：[magic bytes, MIME, 对应扩展名（用于一致性校验）]
const MAGIC_SIGNATURES: ReadonlyArray<readonly [Buffer, string, readonly string[]]> = [
  [Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg', ['jpg', 'jpeg']],
  [Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'), 'image/png', ['png']],
  [Buffer.from('GIF87a', 'latin1'), 'image/gif', ['gif']],
  [Buffer.from('GIF89a', 'latin1'), 'image/gif', ['gif']],
  [Buffer.from('RIFF', 'latin1'), 'image/webp', ['webp']],
  [Buffer.from('%PDF-', 'latin1'), 'application/pdf', ['pdf']],
  [Buffer.from('PK\x03\x04', 'latin1'), 'application/zip', ['zip']],
  [Buffer.from([0x1f, 0x8b]), 'application/gzip', ['gz', 'gzip']],
  [Buffer.from('BM', 'latin1'), 'image/bmp', ['bmp']],
  [Buffer.from([0x00, 0x00, 0x01, 0xba]), 'video/mpeg', ['mpg', 'mpeg']],
  // MP4: 'ftyp' 位于偏移 4-7（容器头 4 字节 size + 'ftyp' 品牌）
  [Buffer.from('ftyp', 'latin1'), 'video/mp4', ['mp4', 'm4v']],
]

// 危险特征（脚本/可执行）
const DANGEROUS_SIGNATURES: ReadonlyArray<Buffer> = [
  Buffer.from('<%', 'latin1'),
  Buffer.from('<script', 'latin1'),
  Buffer.from('<?php', 'latin1'),
  Buffer.from('<!DOCTYPE', 'latin1'),
  Buffer.from('MZ', 'latin1'),
  Buffer.from([0x7f, 0x45, 0x4c, 0x46]), // ELF
]

const DEFAULT_ALLOWED_EXTS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'pdf',
  'docx',
  'xlsx',
  'pptx',
  'txt',
  'mp3',
  'wav',
  'ogg',
  'm4a',
  'mp4',
  'webm',
  'mov',
])

const DEFAULT_MAX_SIZE = 50 * 1024 * 1024 // 50MB

export interface UploadScanOptions {
  /** 允许的扩展名集合（小写，不含点）。 */
  allowedExts?: ReadonlySet<string>
  /** 最大文件大小（字节）。 */
  maxSize?: number
  /** 是否强制魔数校验（multipart 时）。默认 true。 */
  requireMagicCheck?: boolean
}

export interface ScannedFile {
  buffer: Buffer
  filename: string
  mimetype: string
  size: number
}

/** 用文件头魔数推断真实 MIME。 */
export function detectMimeFromBytes(data: Buffer): string | null {
  if (!data || data.length < 1) return null
  for (const [sig, mime] of MAGIC_SIGNATURES) {
    if (sig.length === 4 && sig.toString('latin1') === 'ftyp' && data.length >= 8) {
      // MP4 特殊：'ftyp' 在偏移 4
      if (data.subarray(4, 8).equals(sig)) return mime
    } else if (data.length >= sig.length && data.subarray(0, sig.length).equals(sig)) {
      return mime
    }
  }
  return null
}

/** 检测文件是否含危险特征（脚本/可执行）。 */
export function hasDangerousSignature(data: Buffer): boolean {
  if (!data) return false
  // 检查窗口：4096 字节 + 最长签名长度（<script 7 字节），确保边界签名能命中
  const window = data.subarray(0, 4096 + 16)
  return DANGEROUS_SIGNATURES.some((sig) => window.includes(sig))
}

/** 清理文件名：防路径穿越 + 防特殊字符 + 长度限制。 */
export function sanitizeFilename(filename: string, maxLen = 128): string {
  if (!filename) return ''
  // 取 basename（Win + POSIX）
  let name = filename.replace(/\\/g, '/').split('/').pop() ?? ''
  name = name.replace(/\x00/g, '')
  while (name.includes('..')) name = name.replace(/\.\./g, '')
  name = name.replace(/[^A-Za-z0-9._-]/g, '_')
  while (name.includes('..')) name = name.replace(/\.\./g, '.')
  if (name.length > maxLen) {
    const idx = name.lastIndexOf('.')
    if (idx > 0) {
      const ext = name.slice(idx)
      name = name.slice(0, maxLen - ext.length) + ext
    } else {
      name = name.slice(0, maxLen)
    }
  }
  return name
}

/** 从文件名提取小写扩展名（不含点）。 */
export function extractExt(filename: string): string {
  if (!filename || !filename.includes('.')) return ''
  return filename.split('.').pop()!.toLowerCase().trim()
}

export interface ScanResult {
  ok: boolean
  error?: string
  realMime?: string
}

/**
 * 校验文件 buffer：扩展名白名单 + 大小限制 + 魔数校验 + 危险特征检测。
 */
export function scanFileBuffer(
  buffer: Buffer,
  filename: string,
  opts: UploadScanOptions = {},
): ScanResult {
  const allowedExts = opts.allowedExts ?? DEFAULT_ALLOWED_EXTS
  const maxSize = opts.maxSize ?? DEFAULT_MAX_SIZE
  const requireMagic = opts.requireMagicCheck ?? true

  if (!buffer || buffer.length === 0) {
    return { ok: false, error: '文件为空' }
  }
  if (buffer.length > maxSize) {
    return { ok: false, error: `文件大小超过 ${Math.floor(maxSize / 1024 / 1024)} MB` }
  }

  const ext = extractExt(filename)
  if (!ext || !allowedExts.has(ext)) {
    return { ok: false, error: '文件扩展名不在白名单' }
  }

  // 危险特征检测：放在魔数校验前，确保脚本文件无论扩展名都被拒
  if (hasDangerousSignature(buffer)) {
    return { ok: false, error: '文件含可疑脚本/二进制特征，拒绝上传' }
  }

  if (requireMagic) {
    const realMime = detectMimeFromBytes(buffer)
    if (!realMime) {
      return { ok: false, error: '无法识别文件类型，拒绝上传' }
    }
    // 扩展名与魔数类型必须严格匹配（按 MAGIC_SIGNATURES 的 exts 列表校验）
    const match = MAGIC_SIGNATURES.find(([, , exts]) => exts.includes(ext))
    if (match && match[1] !== realMime) {
      return { ok: false, error: `扩展名 ${ext} 与实际类型 ${realMime} 不一致` }
    }
  }

  return { ok: true, realMime: detectMimeFromBytes(buffer) ?? undefined }
}

/**
 * 创建上传扫描 preHandler。
 *
 * - multipart 请求：读取首个文件 buffer 扫描，通过后挂到 request.scannedFile
 * - JSON 请求：校验 body.filename 扩展名 + body.size 大小
 */
export function createUploadPreHandler(opts: UploadScanOptions = {}): preHandlerHookHandler {
  const allowedExts = opts.allowedExts ?? DEFAULT_ALLOWED_EXTS
  const maxSize = opts.maxSize ?? DEFAULT_MAX_SIZE

  return async (request: FastifyRequest, reply: FastifyReply) => {
    // multipart 上传：读取 buffer 做魔数校验
    if (typeof request.isMultipart === 'function' && request.isMultipart()) {
      const file = await request.file()
      if (!file) {
        return reply.status(400).send({ code: 400, message: '未检测到上传文件' })
      }
      const buffer = await file.toBuffer()
      const result = scanFileBuffer(buffer, file.filename ?? 'unnamed', opts)
      if (!result.ok) {
        return reply.status(400).send({ code: 400, message: result.error })
      }
      // 挂载扫描结果供 handler 使用（避免重复消费 stream）
      ;(request as FastifyRequest & { scannedFile?: ScannedFile }).scannedFile = {
        buffer,
        filename: sanitizeFilename(file.filename ?? 'unnamed'),
        mimetype: result.realMime ?? file.mimetype ?? 'application/octet-stream',
        size: buffer.length,
      }
      return
    }

    // JSON 上传代理（如 oss /oss/upload）：校验声明的 filename + size
    const body = (request.body ?? {}) as { filename?: string; size?: number }
    const filename = body.filename ?? ''
    const size = Number(body.size ?? 0)
    const ext = extractExt(filename)
    if (!ext || !allowedExts.has(ext)) {
      return reply.status(400).send({ code: 400, message: '文件扩展名不在白名单' })
    }
    if (!Number.isFinite(size) || size <= 0 || size > maxSize) {
      return reply.status(400).send({
        code: 400,
        message: `文件大小无效或超过 ${Math.floor(maxSize / 1024 / 1024)} MB`,
      })
    }
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    createUploadPreHandler: typeof createUploadPreHandler
  }
  interface FastifyRequest {
    scannedFile?: ScannedFile
  }
}

const uploadScannerPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.decorate('createUploadPreHandler', createUploadPreHandler)
  server.decorateRequest('scannedFile', undefined)
}

export default fp(uploadScannerPlugin, {
  name: 'upload-scanner-plugin',
  fastify: '5.x',
})
