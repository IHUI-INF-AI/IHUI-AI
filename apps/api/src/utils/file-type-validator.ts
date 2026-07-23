/**
 * 文件类型校验工具(CWE-434 防护)。
 * 校验扩展名白名单 + MIME 类型一致性 + magic number 文件头签名 + 大小限制。
 * 仅依赖 Node.js 内置 Buffer,不引入第三方依赖。
 */

import { extname } from 'node:path'

/** 默认上传大小上限 10MB(无既有限制时使用)。 */
export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024
/** multipart 上传大小上限 100MB(对齐 server.ts @fastify/multipart 配置)。 */
export const MAX_MULTIPART_UPLOAD_SIZE = 100 * 1024 * 1024

/**
 * 扩展名 -> 允许的 MIME 集合。集合首项为该扩展名的 canonical MIME。
 * svg / html / htm 等危险类型故意不在白名单中(XSS / RCE 风险)。
 */
const EXT_MIME_MAP: Record<string, string[]> = {
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  gif: ['image/gif'],
  webp: ['image/webp'],
  pdf: ['application/pdf'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xls: ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ppt: ['application/vnd.ms-powerpoint'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  txt: ['text/plain'],
  csv: ['text/csv', 'text/plain'],
  zip: ['application/zip', 'application/x-zip-compressed'],
}

export const ALLOWED_EXTENSIONS = Object.keys(EXT_MIME_MAP)

/** 提取小写无点扩展名。 */
export function extractExt(filename: string): string {
  return extname(filename).toLowerCase().replace(/^\./, '')
}

/** 去掉 MIME 的 charset 等参数后缀(如 text/plain; charset=utf-8)。 */
function normalizeMime(mime: string): string {
  return (mime.split(';')[0] ?? '').trim().toLowerCase()
}

/** 获取扩展名对应的 canonical MIME(未命中返回 undefined)。 */
export function getCanonicalMime(ext: string): string | undefined {
  return EXT_MIME_MAP[ext]?.[0]
}

/** 校验 buffer 是否匹配任一签名(从指定偏移开始)。 */
function matchesAny(buf: Buffer, signatures: number[][], offset = 0): boolean {
  return signatures.some((sig) => {
    if (buf.length < sig.length + offset) return false
    for (let i = 0; i < sig.length; i++) {
      if (buf[offset + i] !== sig[i]) return false
    }
    return true
  })
}

/**
 * 校验文件头 magic number。返回 true 表示签名匹配(或该类型无需 magic 校验)。
 * 读取前 8-16 字节,覆盖任务要求的全部签名:
 *   JPEG  FF D8 FF
 *   PNG   89 50 4E 47 0D 0A 1A 0A
 *   GIF   47 49 46 38 (37 61 / 39 61)
 *   WebP  52 49 46 46 ... 57 45 42 50  (RIFF....WEBP)
 *   PDF   25 50 44 46
 *   ZIP   50 4B 03 04  (docx/xlsx/pptx 共用)
 *   OLE2  D0 CF 11 E0 A1 B1 1A E1  (doc/xls/ppt 共用)
 */
function checkMagicNumber(ext: string, buf: Buffer): boolean {
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return matchesAny(buf, [[0xff, 0xd8, 0xff]])
    case 'png':
      return matchesAny(buf, [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]])
    case 'gif':
      return matchesAny(buf, [
        [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
        [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
      ])
    case 'webp': {
      if (buf.length < 12) return false
      const riff = buf.subarray(0, 4).toString('latin1') === 'RIFF'
      const webp = buf.subarray(8, 12).toString('latin1') === 'WEBP'
      return riff && webp
    }
    case 'pdf':
      return matchesAny(buf, [[0x25, 0x50, 0x44, 0x46]])
    case 'zip':
    case 'docx':
    case 'xlsx':
    case 'pptx':
      // docx/xlsx/pptx 基于 OOXML,物理结构为 ZIP;空归档与跨卷归档亦放行
      return matchesAny(buf, [
        [0x50, 0x4b, 0x03, 0x04],
        [0x50, 0x4b, 0x05, 0x06],
        [0x50, 0x4b, 0x07, 0x08],
      ])
    case 'doc':
    case 'xls':
    case 'ppt':
      // OLE2 Compound Document(legacy Office 二进制格式)
      return matchesAny(buf, [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]])
    case 'txt':
    case 'csv':
      // 纯文本无固定 magic number,跳过文件头校验
      return true
    default:
      return false
  }
}

export interface ValidationResultOk {
  ok: true
  extension: string
  mimeType: string
}

export interface ValidationResultErr {
  ok: false
  reason: string
}

export type ValidationResult = ValidationResultOk | ValidationResultErr

/**
 * 校验上传文件:扩展名白名单 + MIME 一致性 + magic number + 大小限制。
 * @param buffer       文件二进制内容
 * @param filename     原始文件名(用于提取扩展名)
 * @param declaredMime 客户端声明的 MIME 类型
 * @param maxSize      最大字节数(默认 10MB)
 * @returns 校验通过返回 canonical extension + mimeType,失败返回 reason
 */
export function validateUploadFile(
  buffer: Buffer,
  filename: string,
  declaredMime: string,
  maxSize: number = MAX_UPLOAD_SIZE,
): ValidationResult {
  if (buffer.length === 0) {
    return { ok: false, reason: '文件内容为空' }
  }
  if (buffer.length > maxSize) {
    const mb = (maxSize / (1024 * 1024)).toFixed(0)
    return { ok: false, reason: `文件大小超过 ${mb}MB 限制` }
  }

  const ext = extractExt(filename)
  if (!ext) {
    return { ok: false, reason: '文件名缺少扩展名' }
  }
  const allowedMimes = EXT_MIME_MAP[ext]
  if (!allowedMimes) {
    return { ok: false, reason: `不支持的文件类型: .${ext}` }
  }

  const normalizedMime = normalizeMime(declaredMime)
  if (!allowedMimes.includes(normalizedMime)) {
    return { ok: false, reason: `MIME 类型 ${declaredMime} 与扩展名 .${ext} 不匹配` }
  }

  if (!checkMagicNumber(ext, buffer)) {
    return { ok: false, reason: '文件内容与声明的类型不一致(magic number 校验失败)' }
  }

  const canonicalMime = allowedMimes[0]
  if (!canonicalMime) {
    return { ok: false, reason: '内部错误:文件类型映射异常' }
  }
  return { ok: true, extension: ext, mimeType: canonicalMime }
}

/**
 * 净化存储文件名:取 basename、去控制字符与空字节、去前导点。
 * 丢弃路径分隔符,防止路径穿越;保留原始名用于展示。
 */
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[\/\\]/).pop() ?? filename
  const cleaned = base.replace(/[\x00-\x1f]/g, '').replace(/^\.+/, '')
  return cleaned || 'unnamed'
}
