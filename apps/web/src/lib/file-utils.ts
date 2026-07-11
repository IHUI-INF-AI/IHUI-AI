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

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
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

export async function chunkUpload(
  file: File,
  url: string,
  options: ChunkUploadOptions = {},
): Promise<ChunkUploadResult> {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE
  const concurrent = options.concurrent ?? 3
  const total = Math.ceil(file.size / chunkSize)
  let uploaded = 0

  const uploadChunk = async (index: number): Promise<void> => {
    if (options.signal?.aborted) throw new Error('上传已取消')
    const start = index * chunkSize
    const end = Math.min(start + chunkSize, file.size)
    const blob = file.slice(start, end)
    const formData = new FormData()
    formData.append('file', blob)
    formData.append('index', String(index))
    formData.append('total', String(total))
    formData.append('fileId', file.name)
    const resp = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: options.signal,
    })
    if (!resp.ok) throw new Error(`分片 ${index} 上传失败: ${resp.status}`)
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

  // 通知后端合并
  const mergeResp = await fetch(`${url}?merge=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId: file.name, total, filename: file.name, size: file.size }),
    signal: options.signal,
  })
  if (!mergeResp.ok) throw new Error('合并分片失败')
  const data = (await mergeResp.json()) as { fileId: string; url: string }
  return { fileId: data.fileId, url: data.url, size: file.size }
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
