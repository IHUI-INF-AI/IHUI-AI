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
  /**
   * 续传句柄(G-816032)。传入上一次中断留下的 uploadId 时,本函数**不再 init**,
   * 而是先问 GET /api/chunked-upload/status,跳过服务端已收到的片、从续点继续。
   * 只在"会话仍处 uploading 且分片参数逐字相同"时可续(否则当场报错,绝不猜)。
   * 注意:每次失败都会发 cancel 把会话置终态,所以可续的会话是那些**没走到本函数
   * 失败出口**就被外部中断的(浏览器被关/进程被杀),这正是本选项要救的那一种。
   */
  uploadId?: string
}

export interface ChunkUploadResult {
  fileId: string
  url: string
  size: number
}

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024 // 5MB

/** 撤销请求的超时:比"发出去就没人等"的默认 30s 短,比"彻底发不出去"的 0 长。 */
const CANCEL_TIMEOUT_MS = 15_000

/**
 * GET /api/chunked-upload/status 的 data 载荷。
 * 服务端返回的是 upload_sessions 整行(仅剥掉 filePath),这里**只声明本文件要读的字段**
 * —— 复述整张表就是第二份真相,服务端加一列就得跟着改。
 *
 * ⚠️ 契约里没有 `nextChunkIndex`(票面那个名字来自上游第三方实现
 * `packages/ui/src/v4/attachmentUploadTransaction.ts`,不是我方后端字段)。
 * 后端给的是 `uploadedChunks` = **磁盘上实收分片的去重计数**
 * (apps/api/src/services/upload-integrity.ts 的 countUniqueReceivedChunks),
 * 所以续点只能按"已收 N 片 ⇒ 从第 N+1 片起"推算。该推算在"已收片是 1..N 的连续前缀"
 * 时才严格成立;若前缀有洞(并发批次中途被外部中断),merge 会由服务端点名缺哪几片
 * (findMissingChunkNumbers ⇒ 400 带缺片清单),不会出现"静默合出坏文件"。
 */
interface ChunkUploadSessionView {
  uploadId?: unknown
  status?: unknown
  totalChunks?: unknown
  chunkSize?: unknown
  fileName?: unknown
  fileSize?: unknown
  /** 服务端实收分片的去重计数(见上方说明)。 */
  uploadedChunks?: unknown
}

/** POST /api/chunked-upload/upload 的 data 载荷(服务端逐片回报实收进度 + 回显片号)。 */
interface ChunkUploadPartAck {
  chunkNumber?: unknown
  uploadedChunks?: unknown
}

function readIntAtLeast(value: unknown, min: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min ? value : null
}

/**
 * 读服务端续点。返回判读结果而不是直接抛,由调用方决定"这一段还没有可撤会话"
 * 的措辞 —— 续点读不到就等于还没开始写,失败时不该发 cancel。
 */
async function readResumePoint(
  uploadId: string,
  expectedTotalChunks: number,
  expectedChunkSize: number,
  expectedFileName: string,
  expectedFileSize: number,
  signal?: AbortSignal,
): Promise<{ ok: true; uploadedChunks: number } | { ok: false; reason: string }> {
  const res = await fetchApi<ChunkUploadSessionView>(
    `/api/chunked-upload/status${buildQs({ uploadId })}`,
    { signal },
  )
  if (!res.success) {
    return { ok: false, reason: res.error ?? '查询上传进度失败' }
  }
  const view = res.data
  if (!view || typeof view !== 'object') {
    return { ok: false, reason: '上传进度响应缺少会话载荷' }
  }
  if (view.status !== 'uploading') {
    return { ok: false, reason: `上传会话状态为 ${String(view.status ?? '未知')}，无法续传` }
  }
  const totalChunks = readIntAtLeast(view.totalChunks, 1)
  const chunkSize = readIntAtLeast(view.chunkSize, 1)
  if (totalChunks === null || chunkSize === null) {
    return { ok: false, reason: '上传进度响应里的分片参数不可用' }
  }
  // 分片参数不一致 ⇒ 服务端那 N 片是按另一套切法存的,直接续会把成品切错。
  if (totalChunks !== expectedTotalChunks || chunkSize !== expectedChunkSize) {
    return {
      ok: false,
      reason:
        `续传参数与会话不一致(会话 ${totalChunks} 片 × ${chunkSize} B,本次 ${expectedTotalChunks} 片 × ${expectedChunkSize} B)` +
        '，请用相同 chunkSize 重试',
    }
  }
  // 文件身份也必须是同一份:两个不同文件可以有相同的 size 与切法,那种情况下
  // "跳过已传片"会把 A 文件的前 N 片接到 B 文件上,合出一个谁都不是的成品。
  // 字段读不到或不一致一律拒绝(fail closed)—— 认不出身份就不能声称"这是同一次上传"。
  if (view.fileName !== expectedFileName || view.fileSize !== expectedFileSize) {
    return {
      ok: false,
      reason: `续传句柄指向的会话与本次文件不是同一份(会话 ${String(view.fileName ?? '?')} / ${String(view.fileSize ?? '?')} B,本次 ${expectedFileName} / ${expectedFileSize} B)`,
    }
  }
  const uploadedChunks = readIntAtLeast(view.uploadedChunks, 0)
  if (uploadedChunks === null || uploadedChunks > totalChunks) {
    return { ok: false, reason: '上传进度响应里的已收片数不可用' }
  }
  return { ok: true, uploadedChunks }
}

/**
 * 撤销上传会话。**永不抛** —— 撤销是善后动作,它失败只能让主错误继续走。
 * 刻意不接调用方的 AbortSignal:主故障常由用户 abort 触发,那一支 signal 已经 aborted,
 * 带上就等于撤销请求刚发出即被掐掉,会话留在服务端等 TTL(24h)收 —— 正是本票要根治的形态。
 */
async function cancelChunkedUpload(uploadId: string): Promise<void> {
  try {
    const res = await fetchApi<unknown>('/api/chunked-upload/cancel', {
      method: 'DELETE',
      body: JSON.stringify({ uploadId }),
      timeoutMs: CANCEL_TIMEOUT_MS,
    })
    if (!res.success) {
      console.warn(
        `[chunkUpload] 撤销上传会话未成功(不影响主错误): uploadId=${uploadId} ${res.error ?? '未知错误'}`,
      )
    }
  } catch (err) {
    console.warn(`[chunkUpload] 撤销上传会话异常(不影响主错误): uploadId=${uploadId}`, err)
  }
}

/**
 * 分片上传(协议对齐后端 apps/api/src/routes/chunked-upload.ts,四条出口都用上了):
 *  1. POST /api/chunked-upload/init —— JSON {fileName, fileSize, totalChunks, mimeType, chunkSize}
 *     (或传 options.uploadId 跳过 init,改走下面第 2' 步续点)
 *  2. POST /api/chunked-upload/upload —— application/octet-stream 原始分片,
 *     headers 带 x-upload-id / x-chunk-number(1-based),支持并发;
 *     每片校验服务端回显的 chunkNumber,并把服务端实收计数记为"确认进度"
 *  2'. GET /api/chunked-upload/status?uploadId= —— 续点:跳过服务端已收到的片
 *  3. POST /api/chunked-upload/merge —— JSON {uploadId} → {fileId, url};
 *     **只有服务端确认收齐才提交**,不是"本地把循环跑完"就算传完
 *  4. DELETE /api/chunked-upload/cancel —— 从"已确立可写会话"起到发布成功之前,
 *     任何失败都必须撤销;撤销失败只 warn,原错误原样抛出
 *
 * 2026-09-09 0-5 直接 fetch 清单化迁移:原实现把 FormData 直接 POST 到
 * /api/upload/chunk(后端不存在该端点,协议亦不符,上传必 404 走 fallback)。
 * 迁移到共享 fetchApi 的同时修复协议对齐,获得统一鉴权/CSRF/设备指纹/超时能力。
 * 2026-10-05 G-816032:补上"提交后发布 + 失败必撤销 + 服务端续点" —— 此前客户端
 * 只调 init/upload/merge 三条,cancel/status 两条后端出口早已建好而零调用点。
 */
export async function chunkUpload(
  file: File,
  options: ChunkUploadOptions = {},
): Promise<ChunkUploadResult> {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE
  const concurrent = options.concurrent ?? 3
  const total = Math.ceil(file.size / chunkSize)

  /* ------------------------------------------------------------------ */
  /* 会话确立:这一段失败时**尚无会话可撤**,不得发 cancel               */
  /* ------------------------------------------------------------------ */
  let uploadId: string
  let startFrom = 0

  if (options.uploadId) {
    const resume = await readResumePoint(
      options.uploadId,
      total,
      chunkSize,
      file.name,
      file.size,
      options.signal,
    )
    if (!resume.ok) throw new Error(resume.reason)
    uploadId = options.uploadId
    startFrom = resume.uploadedChunks
  } else {
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
    uploadId = initRes.data.uploadId
  }

  /* ------------------------------------------------------------------ */
  /* 自此有了可撤会话:发布成功之前的任何失败都要先 cancel 再原样抛出     */
  /* ------------------------------------------------------------------ */
  let published = false
  try {
    let uploaded = startFrom
    // 服务端确认收到的片数(逐片响应回报的去重计数取大值)。合并的准入看它,
    // 不看本地计数器 —— 本地跑完循环 ≠ 服务端真的每片都收到了。
    let serverConfirmed = startFrom
    const uploadChunk = async (index: number): Promise<void> => {
      if (options.signal?.aborted) throw new Error('上传已取消')
      const start = index * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      const blob = file.slice(start, end)
      const res = await fetchApi<ChunkUploadPartAck>('/api/chunked-upload/upload', {
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
      // 每片序号回验:服务端回显的不是本片,说明这一路的响应对不上请求
      // (重试/缓存/串话),此时"成功"不可信,当场报错比继续传下去便宜。
      const acked = readIntAtLeast(res.data?.chunkNumber, 1)
      if (acked !== null && acked !== index + 1) {
        throw new Error(`分片 ${index} 响应回显片号为 ${acked}，与请求不符`)
      }
      const progress = readIntAtLeast(res.data?.uploadedChunks, 0)
      if (progress !== null && progress > serverConfirmed) serverConfirmed = progress
      uploaded += 1
      options.onProgress?.(uploaded, total)
    }

    // 并发上传(从续点起,已收到的片不再重传)
    for (let i = startFrom; i < total; i += concurrent) {
      const batch = Array.from({ length: Math.min(concurrent, total - i) }, (_, k) =>
        uploadChunk(i + k),
      )
      await Promise.all(batch)
    }

    // 提交前对账:服务端没确认收齐就不发起合并。merge 自身也会缺片报错,
    // 但那一趟是把整份文件白传完之后才发现,而且失败原因要等合并阶段才浮出。
    if (serverConfirmed !== total) {
      throw new Error(`服务端仅确认收到 ${serverConfirmed}/${total} 片，未提交合并`)
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
    published = true
    return { fileId: mergeRes.data.fileId, url: mergeRes.data.url, size: file.size }
  } catch (err) {
    if (!published) await cancelChunkedUpload(uploadId)
    throw err
  }
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
