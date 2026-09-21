// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 文件工具集（合并版）
 *
 * 合并自旧架构 utils/ 下的 7 个文件相关文件：
 * - chunkUpload / fileConverter / fileShare / fileTypes / fileValidation
 * - fileVersion / folderUpload
 *
 * 新架构基于纯 TypeScript + Web API，无 Vue 依赖。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'
import { buildQs } from '@/lib/edu'

export { formatFileSize } from '@ihui/shared/utils/format'

/* ------------------------------------------------------------------ */
/* 文件类型（fileTypes）                                               */
/* ------------------------------------------------------------------ */

export type FileCategory =
  'image' | 'video' | 'audio' | 'document' | 'archive' | 'code' | 'data' | 'other'

const EXT_CATEGORY: Record<string, FileCategory> = {
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  svg: 'image',
  bmp: 'image',
  ico: 'image',
  mp4: 'video',
  avi: 'video',
  mov: 'video',
  wmv: 'video',
  flv: 'video',
  mkv: 'video',
  webm: 'video',
  mp3: 'audio',
  wav: 'audio',
  ogg: 'audio',
  flac: 'audio',
  aac: 'audio',
  m4a: 'audio',
  pdf: 'document',
  doc: 'document',
  docx: 'document',
  xls: 'document',
  xlsx: 'document',
  ppt: 'document',
  pptx: 'document',
  txt: 'document',
  md: 'document',
  rtf: 'document',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  tar: 'archive',
  gz: 'archive',
  js: 'code',
  ts: 'code',
  tsx: 'code',
  jsx: 'code',
  json: 'code',
  html: 'code',
  css: 'code',
  py: 'code',
  go: 'code',
  java: 'code',
  csv: 'data',
  xml: 'data',
  yaml: 'data',
  yml: 'data',
}

export function getFileCategory(filename: string): FileCategory {
  const ext = getExtension(filename).toLowerCase()
  return EXT_CATEGORY[ext] ?? 'other'
}

export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.')
  return idx >= 0 ? filename.slice(idx + 1) : ''
}

export function getBaseName(filename: string): string {
  const idx = filename.lastIndexOf('.')
  return idx >= 0 ? filename.slice(0, idx) : filename
}

export function isImage(filename: string): boolean {
  return getFileCategory(filename) === 'image'
}

export function isVideo(filename: string): boolean {
  return getFileCategory(filename) === 'video'
}

export function isAudio(filename: string): boolean {
  return getFileCategory(filename) === 'audio'
}

/* ------------------------------------------------------------------ */
/* 文件校验（fileValidation）                                          */
/* ------------------------------------------------------------------ */

export interface ValidationOptions {
  maxSize?: number
  allowedExtensions?: string[]
  allowedCategories?: FileCategory[]
  forbiddenExtensions?: string[]
}

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

export function validateFile(
  file: { name: string; size: number },
  options: ValidationOptions = {},
): ValidationResult {
  const errors: string[] = []
  if (options.maxSize && file.size > options.maxSize) {
    errors.push(`文件大小超过 ${(options.maxSize / 1024 / 1024).toFixed(2)} MB`)
  }
  const ext = getExtension(file.name).toLowerCase()
  if (options.allowedExtensions && !options.allowedExtensions.includes(ext)) {
    errors.push(`不支持的扩展名: .${ext}`)
  }
  if (options.forbiddenExtensions?.includes(ext)) {
    errors.push(`禁止上传的扩展名: .${ext}`)
  }
  if (options.allowedCategories) {
    const cat = getFileCategory(file.name)
    if (!options.allowedCategories.includes(cat)) {
      errors.push(`不支持的文件类别: ${cat}`)
    }
  }
  return { ok: errors.length === 0, errors }
}

/* ------------------------------------------------------------------ */
/* 分片上传（chunkUpload）                                             */
/* ------------------------------------------------------------------ */

export interface ChunkUploadOptions {
  chunkSize?: number
  concurrent?: number
  onProgress?: (uploaded: number, total: number) => void
  signal?: AbortSignal
}

export interface ChunkUploadResult {
  fileId: string
  url: string
  size: number
}

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024 // 5MB

/**
 * 分片上传(三步协议,对齐后端 apps/api/src/routes/chunked-upload.ts):
 *  1. POST /api/chunked-upload/init —— JSON {fileName, fileSize, totalChunks, mimeType, chunkSize}
 *  2. POST /api/chunked-upload/upload —— application/octet-stream 原始分片,
 *     headers 带 x-upload-id / x-chunk-number(1-based),支持并发
 *  3. POST /api/chunked-upload/merge —— JSON {uploadId} → {fileId, url}
 *
 * 2026-09-09 0-5 直接 fetch 清单化迁移:原实现把 FormData 直接 POST 到
 * /api/upload/chunk(后端不存在该端点,协议亦不符,上传必 404 走 fallback)。
 * 迁移到共享 fetchApi 的同时修复协议对齐,获得统一鉴权/CSRF/设备指纹/超时能力。
 */
export async function chunkUpload(
  file: File,
  options: ChunkUploadOptions = {},
): Promise<ChunkUploadResult> {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE
  const concurrent = options.concurrent ?? 3
  const total = Math.ceil(file.size / chunkSize)

  const initRes = await fetchApi<{ uploadId: string }>('/api/chunked-upload/init', {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      totalChunks: total,
      mimeType: file.type,
      chunkSize,
    }),
    signal: options.signal,
  })
  if (!initRes.success || !initRes.data?.uploadId) {
    throw new Error(initRes.error ?? '初始化上传会话失败')
  }
  const uploadId = initRes.data.uploadId

  let uploaded = 0
  const uploadChunk = async (index: number): Promise<void> => {
    if (options.signal?.aborted) throw new Error('上传已取消')
    const start = index * chunkSize
    const end = Math.min(start + chunkSize, file.size)
    const blob = file.slice(start, end)
    const res = await fetchApi('/api/chunked-upload/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-upload-id': uploadId,
        'x-chunk-number': String(index + 1),
      },
      body: blob,
      // 5MB 分片在慢网络下可能超过默认 30s,放宽到 120s
      timeoutMs: 120_000,
      signal: options.signal,
    })
    if (!res.success) throw new Error(`分片 ${index} 上传失败: ${res.error ?? '未知错误'}`)
    uploaded += 1
    options.onProgress?.(uploaded, total)
  }

  // 并发上传
  for (let i = 0; i < total; i += concurrent) {
    const batch = Array.from({ length: Math.min(concurrent, total - i) }, (_, k) =>
      uploadChunk(i + k),
    )
    await Promise.all(batch)
  }

  // 通知后端合并(大文件合并耗时,放宽超时)
  const mergeRes = await fetchApi<{ fileId: string; url: string }>('/api/chunked-upload/merge', {
    method: 'POST',
    body: JSON.stringify({ uploadId }),
    timeoutMs: 120_000,
    signal: options.signal,
  })
  if (!mergeRes.success || !mergeRes.data?.fileId || !mergeRes.data.url) {
    throw new Error(mergeRes.error ?? '合并分片失败')
  }
  return { fileId: mergeRes.data.fileId, url: mergeRes.data.url, size: file.size }
}

/* ------------------------------------------------------------------ */
/* 文件转换（fileConverter）                                           */
/* ------------------------------------------------------------------ */

export async function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export async function fileToText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

export async function fileToArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [metaRaw, base64] = dataUrl.split(',')
  const meta = metaRaw ?? ''
  const mime = meta.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream'
  const binary = atob(base64 ?? '')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/** 图片压缩 */
export async function compressImage(file: File, maxWidth = 1920, quality = 0.85): Promise<Blob> {
  const img = await loadImage(file)
  const scale = Math.min(1, maxWidth / img.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(img.width * scale)
  canvas.height = Math.floor(img.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D 上下文不可用')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', quality)
  })
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }
    img.src = url
  })
}

/* ------------------------------------------------------------------ */
/* 文件分享（fileShare）                                               */
/* ------------------------------------------------------------------ */

export interface ShareLink {
  id: string
  fileId: string
  url: string
  password?: string
  expiresAt: string | null
  maxDownloads: number | null
  downloadCount: number
  createdAt: string
}

export async function createShareLink(input: {
  fileId: string
  password?: string
  expiresInDays?: number
  maxDownloads?: number
}): Promise<ApiResult<ShareLink>> {
  return fetchApi<ShareLink>('/files/share', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getShareLink(id: string, password?: string): Promise<ApiResult<ShareLink>> {
  return fetchApi<ShareLink>(`/files/share/${encodeURIComponent(id)}${buildQs({ password })}`)
}

export async function revokeShareLink(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/files/share/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function listShareLinks(): Promise<ApiResult<ShareLink[]>> {
  return fetchApi<ShareLink[]>('/files/share')
}

/* ------------------------------------------------------------------ */
/* 文件版本（fileVersion）                                             */
/* ------------------------------------------------------------------ */

export interface FileVersion {
  id: string
  fileId: string
  version: number
  url: string
  size: number
  uploader: { id: string; nickname: string }
  changelog: string | null
  isCurrent: boolean
  createdAt: string
}

export async function listVersions(fileId: string): Promise<ApiResult<FileVersion[]>> {
  return fetchApi<FileVersion[]>(`/files/${encodeURIComponent(fileId)}/versions`)
}

export async function restoreVersion(
  fileId: string,
  versionId: string,
): Promise<ApiResult<FileVersion>> {
  return fetchApi<FileVersion>(
    `/files/${encodeURIComponent(fileId)}/versions/${encodeURIComponent(versionId)}/restore`,
    { method: 'POST' },
  )
}

export async function uploadNewVersion(
  fileId: string,
  file: File,
  changelog?: string,
): Promise<ApiResult<FileVersion>> {
  const formData = new FormData()
  formData.append('file', file)
  if (changelog) formData.append('changelog', changelog)
  return fetchApi<FileVersion>(`/files/${encodeURIComponent(fileId)}/versions`, {
    method: 'POST',
    body: formData,
  })
}

/* ------------------------------------------------------------------ */
/* 文件夹上传（folderUpload）                                          */
/* ------------------------------------------------------------------ */

export interface FolderUploadEntry {
  file: File
  relativePath: string
}

/** 从 input[type=file] webkitdirectory 读取所有文件并保留相对路径 */
export function extractFolderEntries(files: FileList | File[]): FolderUploadEntry[] {
  const result: FolderUploadEntry[] = []
  for (const file of Array.from(files)) {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath
    result.push({
      file,
      relativePath: rel || file.name,
    })
  }
  return result.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}

/** 计算文件夹的总大小 */
export function sumFolderSize(entries: FolderUploadEntry[]): number {
  return entries.reduce((s, e) => s + e.file.size, 0)
}

/** 按目录层级分组 */
export function groupByDirectory(entries: FolderUploadEntry[]): Map<string, FolderUploadEntry[]> {
  const groups = new Map<string, FolderUploadEntry[]>()
  for (const entry of entries) {
    const slashIdx = entry.relativePath.lastIndexOf('/')
    const dir = slashIdx >= 0 ? entry.relativePath.slice(0, slashIdx) : '/'
    const list = groups.get(dir) ?? []
    list.push(entry)
    groups.set(dir, list)
  }
  return groups
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
