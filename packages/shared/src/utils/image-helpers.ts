/**
 * 跨端共享 image 辅助(2026-07-30 立)
 *
 * 设计目标:消除 apps/mobile-rn/src/hooks/useChatInput.ts 中
 * inferTypeFromMime/buildFileFromAsset 与 apps/miniapp-taro/src/utils/upload-image.ts
 * 中 chooseImages/uploadImage 的纯逻辑部分(URL 处理、文件名生成、mime 推断)。
 *
 * 平台无关:本文件不 import 任何平台 API,纯函数 + 纯类型。
 * 平台相关(选图/上传/读取)由各端自行实现,本文件只提供"输入归一化 + URL 处理"。
 *
 * 与 file-helpers.ts(getExt/getMimeType)的关系:
 * - file-helpers:基于扩展名的 URL/路径解析
 * - image-helpers:基于 mime/type 字段的文件类型推断 + URL 拼接 + 缩略图尺寸
 */

import { getExt, getMimeType } from './file-helpers'

/** 跨端统一的 file type(对齐 @ihui/types MessageInputFileType) */
export type FileType = 'image' | 'video' | 'document' | 'audio'

/**
 * 从 mime 推断 file type
 *
 * @param mime MIME 类型(如 'image/jpeg' / 'video/mp4' / 'application/pdf')
 * @param fallback 推断失败时的默认类型
 *
 * @example
 * inferTypeFromMime('image/jpeg', 'document') // 'image'
 * inferTypeFromMime('application/pdf', 'document') // 'document'
 * inferTypeFromMime(null, 'image') // 'image'
 */
export function inferTypeFromMime(mime: string | null | undefined, fallback: FileType): FileType {
  if (!mime) return fallback
  const lower = mime.toLowerCase()
  if (lower.startsWith('image/')) return 'image'
  if (lower.startsWith('video/')) return 'video'
  if (lower.startsWith('audio/')) return 'audio'
  return fallback === 'image' ||
    fallback === 'video' ||
    fallback === 'audio' ||
    fallback === 'document'
    ? fallback
    : 'document'
}

/**
 * 平台无关的文件资源抽象(用于 buildFileFromAsset 等纯函数)
 *
 * 各端 picker 的返回结构差异很大(RN:expo-image-picker 的 assets 数组,
 * Taro:chooseImage 的 tempFilePaths 数组),但都可归一化为这个统一结构。
 */
export interface AssetLike {
  uri?: string | null
  fileName?: string | null
  mimeType?: string | null
  /** picker 返回的原始 type('image' / 'video' 等,某些平台无) */
  type?: string | null
  /** 文件大小(字节,可选) */
  fileSize?: number | null
}

/**
 * 平台无关的 file 抽象(对齐 @ihui/types MessageInputFile)
 *
 * id 由调用方生成(buildFileFromAsset 内部用时间戳 + 计数),
 * 持久化前可改用 uuid。
 */
export interface FileLike {
  /** 唯一 id(本地生成) */
  id: string
  /** 资源 url(本地路径或远端 URL) */
  url: string
  /** 文件名 */
  filename?: string
  /** 文件类型(已推断) */
  type: FileType
  /** 文件大小(字节) */
  size?: number
  /** mime 类型 */
  mimeType?: string
}

let fileIdCounter = 0
function nextFileId(): string {
  return `file-${Date.now()}-${++fileIdCounter}`
}

/**
 * 从 AssetLike 构造 FileLike(type 推断 + filename 兜底)
 *
 * @example
 * buildFileFromAsset({ uri: 'file://a.jpg', mimeType: 'image/jpeg' }, 'image')
 * // { id: 'file-...', url: 'file://a.jpg', filename: undefined, type: 'image', mimeType: 'image/jpeg' }
 */
export function buildFileFromAsset(asset: AssetLike, fallback: FileType): FileLike {
  const mime = asset.mimeType ?? null
  const explicitType = (asset.type ?? '').toLowerCase()
  let type: FileType = fallback
  if (
    explicitType === 'image' ||
    explicitType === 'video' ||
    explicitType === 'audio' ||
    explicitType === 'document'
  ) {
    type = explicitType
  } else if (mime) {
    type = inferTypeFromMime(mime, fallback)
  }
  const result: FileLike = {
    id: nextFileId(),
    url: asset.uri ?? '',
    type,
  }
  if (asset.fileName) result.filename = asset.fileName
  if (mime) result.mimeType = mime
  if (typeof asset.fileSize === 'number') result.size = asset.fileSize
  return result
}

/**
 * 生成默认文件名
 *
 * 规则:`{prefix}_{timestamp}_{index}.{ext}`
 * - prefix 为空时,默认使用 'img'
 * - ext 为空时(实际不会发生,getExt 默认返回 'jpg'),省略 `.xxx`
 *
 * @example
 * buildFileName('img', 'photo.jpg', 0) // 'img_1700000000_0.jpg'
 * buildFileName('', 'unknown', 0)     // 'img_1700000000_0.jpg'
 */
export function buildFileName(prefix: string, filePath: string, index = 0): string {
  const ext = getExt(filePath)
  const ts = Date.now()
  const p = prefix || 'img'
  return ext ? `${p}_${ts}_${index}.${ext}` : `${p}_${ts}_${index}`
}

/**
 * 拼装 base64 data URL
 *
 * @example
 * toBase64DataUrl('abc', 'image/jpeg') // 'data:image/jpeg;base64,abc'
 * toBase64DataUrl('abc', 'jpg')        // 'data:image/jpeg;base64,abc'
 */
export function toBase64DataUrl(base64: string, mimeOrExt: string): string {
  const mime = mimeOrExt.includes('/') ? mimeOrExt : getMimeType(mimeOrExt)
  return `data:${mime};base64,${base64}`
}

/**
 * URL 拼接:相对路径追加 baseUrl,绝对 URL(http/https/file:)原样返回
 */
export function joinUrl(baseUrl: string, path: string): string {
  if (!path) return baseUrl
  if (/^(https?:|file:|data:|blob:|wxfile:|ph:)/i.test(path)) return path
  if (!baseUrl) return path
  if (path.startsWith('/')) return baseUrl.replace(/\/$/, '') + path
  return baseUrl.replace(/\/$/, '') + '/' + path
}

/**
 * 判断 URL 是否为本地路径(file/wxfile/ph/相对路径)
 */
export function isLocalUrl(url: string): boolean {
  if (!url) return false
  return (
    url.startsWith('file:') ||
    url.startsWith('wxfile:') ||
    url.startsWith('ph:') ||
    url.startsWith('blob:') ||
    (!/^https?:\/\//i.test(url) && !url.startsWith('data:'))
  )
}

/**
 * 缩略图尺寸工具:按最长边等比缩放
 *
 * @param origWidth  原始宽度
 * @param origHeight 原始高度
 * @param maxSide    最长边目标值
 * @returns { width, height }
 */
export function fitThumbnailSize(
  origWidth: number,
  origHeight: number,
  maxSide: number,
): { width: number; height: number } {
  if (origWidth <= 0 || origHeight <= 0) return { width: 0, height: 0 }
  if (maxSide <= 0) return { width: origWidth, height: origHeight }
  const longer = Math.max(origWidth, origHeight)
  if (longer <= maxSide) return { width: origWidth, height: origHeight }
  const ratio = maxSide / longer
  return { width: Math.round(origWidth * ratio), height: Math.round(origHeight * ratio) }
}

/**
 * 文件大小格式化(1024 进制,1 位小数,B/KB/MB/GB/TB)
 * 与 format.ts 的 formatFileSize 行为一致;本文件不重新导出,调用方请从
 * '@ihui/shared/utils/format' 或 '@ihui/shared/utils'(index 合并)导入。
 */
