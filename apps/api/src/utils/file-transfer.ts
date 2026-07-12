/**
 * 文件传输工具 —— HTTP 文件下载/上传。
 *
 * 迁移自旧架构 app/utils/file_transfer.py（基于 httpx）。
 * 新架构使用 Node.js 原生 fetch API（Node 18+）+ 流式传输。
 *
 * 核心能力：
 * - downloadFileFromUrl：从 URL 下载文件（流式，100MB 限制）
 * - uploadFileToServer：上传文件到服务器（支持文件内容或网络 URL 转存）
 * - 流式传输，避免大文件占满内存
 */

import { Readable } from 'node:stream'
import { extname } from 'node:path'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import { logger } from './logger.js'

// =============================================================================
// 常量
// =============================================================================

/** 最大文件大小：100MB */
export const MAX_FILE_SIZE = 100 * 1024 * 1024

/** 下载超时（毫秒） */
const DOWNLOAD_TIMEOUT_MS = 60_000

/** 上传超时（毫秒） */
const UPLOAD_TIMEOUT_MS = 60_000

/** 网络转存超时（毫秒） */
const NETWORK_TRANSFER_TIMEOUT_MS = 30_000

/** 默认 User-Agent */
const DEFAULT_USER_AGENT = 'Mozilla/5.0 IHUI-Agent/1.0'

// =============================================================================
// 类型定义
// =============================================================================

/** 下载结果。 */
export interface DownloadResult {
  /** 文件内容（Buffer） */
  content: Buffer
  /** 实际下载字节数 */
  size: number
  /** Content-Type */
  contentType: string
}

/** 上传结果。 */
export interface UploadResult {
  /** 上传后的文件 URL */
  url: string
  /** 上传字节数 */
  size: number
}

/** 文件上传配置（从环境变量读取）。 */
export interface FileTransferConfig {
  /** 文件上传 URL */
  uploadUrl?: string
  /** 网络 URL 转存接口 */
  networkUploadUrl?: string
}

// =============================================================================
// 配置
// =============================================================================

/**
 * 获取文件传输配置。
 *
 * 优先从环境变量读取：
 * - FILE_UPLOAD_URL：文件上传接口
 * - FILE_UPLOAD_NETWORK_URL：网络 URL 转存接口
 */
export function getFileTransferConfig(): FileTransferConfig {
  return {
    uploadUrl: process.env.FILE_UPLOAD_URL,
    networkUploadUrl: process.env.FILE_UPLOAD_NETWORK_URL,
  }
}

// =============================================================================
// MIME 类型猜测
// =============================================================================

/** 根据文件扩展名猜测 Content-Type。 */
export function guessContentType(filename: string): string {
  const ext = extname(filename).toLowerCase()
  const typeMap: Record<string, string> = {
    '.obj': 'application/octet-stream',
    '.glb': 'model/gltf-binary',
    '.stl': 'application/octet-stream',
    '.mp4': 'video/mp4',
    '.zip': 'application/zip',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.json': 'application/json',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
    '.html': 'text/html',
  }
  return typeMap[ext] ?? 'application/octet-stream'
}

// =============================================================================
// 下载
// =============================================================================

/**
 * 从 URL 下载文件（流式传输，100MB 限制）。
 *
 * 迁移自 Python download_file_from_url。
 *
 * @param url 文件 URL
 * @returns 下载结果，失败返回 null
 */
export async function downloadFileFromUrl(url: string): Promise<DownloadResult | null> {
  try {
    logger.info(`[file-transfer] downloading: ${url}`)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)

    const resp = await fetch(url, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: '*/*',
      },
      signal: controller.signal,
      redirect: 'follow',
    })

    clearTimeout(timeout)

    if (!resp.ok) {
      logger.error(`[file-transfer] download HTTP error: ${resp.status} - ${url}`)
      return null
    }

    // 检查 Content-Length（若提供）
    const contentLength = resp.headers.get('content-length')
    if (contentLength) {
      const size = parseInt(contentLength, 10)
      if (size > MAX_FILE_SIZE) {
        logger.error(`[file-transfer] file too large: ${size} bytes > ${MAX_FILE_SIZE} - ${url}`)
        return null
      }
    }

    // 流式读取到 Buffer（带大小检查）
    if (!resp.body) {
      logger.error(`[file-transfer] empty response body - ${url}`)
      return null
    }

    const chunks: Buffer[] = []
    let totalSize = 0
    const reader = resp.body.getReader()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          totalSize += value.byteLength
          if (totalSize > MAX_FILE_SIZE) {
            logger.error(`[file-transfer] stream exceeded max size ${MAX_FILE_SIZE} - ${url}`)
            await reader.cancel()
            return null
          }
          chunks.push(Buffer.from(value))
        }
      }
    } finally {
      reader.releaseLock()
    }

    const content = Buffer.concat(chunks)
    const contentType = resp.headers.get('content-type') ?? 'application/octet-stream'

    logger.info(`[file-transfer] download OK: ${totalSize} bytes - ${url}`)
    return { content, size: totalSize, contentType }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      logger.error(`[file-transfer] download timeout - ${url}`)
    } else {
      logger.error(`[file-transfer] download failed: ${String(err)} - ${url}`)
    }
    return null
  }
}

/**
 * 从 URL 下载文件并以流的方式返回（适用于大文件代理传输）。
 *
 * 注意：流式下载不做 100MB 大小限制，调用方需自行控制。
 *
 * @param url 文件 URL
 * @returns 可读流与 Content-Type，失败返回 null
 */
export async function downloadFileAsStream(
  url: string,
): Promise<{ stream: Readable; contentType: string } | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)

    const resp = await fetch(url, {
      headers: { 'User-Agent': DEFAULT_USER_AGENT, Accept: '*/*' },
      signal: controller.signal,
      redirect: 'follow',
    })

    clearTimeout(timeout)

    if (!resp.ok || !resp.body) {
      logger.error(`[file-transfer] stream download failed: ${resp.status} - ${url}`)
      return null
    }

    const contentType = resp.headers.get('content-type') ?? 'application/octet-stream'
    const stream = Readable.fromWeb(resp.body as WebReadableStream)
    return { stream, contentType }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      logger.error(`[file-transfer] stream download timeout - ${url}`)
    } else {
      logger.error(`[file-transfer] stream download failed: ${String(err)} - ${url}`)
    }
    return null
  }
}

// =============================================================================
// 上传
// =============================================================================

/**
 * 上传文件到服务器。
 *
 * 迁移自 Python upload_file_to_server。
 * 支持两种模式：
 * - 传入 URL 字符串（http:// 开头）：走网络转存接口
 * - 传入 Buffer / Uint8Array：走文件上传接口
 *
 * @param fileContentOrUrl 文件内容或网络 URL
 * @param filename 文件名
 * @returns 上传后的文件 URL，失败返回 null
 */
export async function uploadFileToServer(
  fileContentOrUrl: string | Buffer | Uint8Array,
  filename: string,
): Promise<string | null> {
  if (typeof fileContentOrUrl === 'string' && isHttpUrl(fileContentOrUrl)) {
    return uploadFromNetworkUrl(fileContentOrUrl)
  }
  if (fileContentOrUrl instanceof Buffer || fileContentOrUrl instanceof Uint8Array) {
    return uploadFromFileContent(fileContentOrUrl, filename)
  }
  logger.error('[file-transfer] invalid upload input type')
  return null
}

/**
 * 通过网络 URL 转存文件。
 *
 * 迁移自 Python _upload_from_network_url。
 * 调用 FILE_UPLOAD_NETWORK_URL 接口，将网络 URL 转存到文件服务器。
 */
async function uploadFromNetworkUrl(url: string): Promise<string | null> {
  const { networkUploadUrl } = getFileTransferConfig()
  if (!networkUploadUrl) {
    logger.error('[file-transfer] FILE_UPLOAD_NETWORK_URL not configured')
    return null
  }

  try {
    logger.info(`[file-transfer] network transfer: ${url}`)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), NETWORK_TRANSFER_TIMEOUT_MS)

    const resp = await fetch(networkUploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: url }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!resp.ok) {
      logger.error(`[file-transfer] network upload failed: ${resp.status}`)
      return null
    }

    const result = (await resp.json()) as Record<string, unknown>
    if (String(result.code ?? result.status ?? '') === '200' && result.data) {
      const data = result.data
      const fileUrl =
        typeof data === 'string' ? data : ((data as Record<string, unknown>).url ?? '')
      if (typeof fileUrl === 'string' && fileUrl) {
        logger.info(`[file-transfer] network transfer OK: ${url} -> ${fileUrl}`)
        return fileUrl
      }
    }

    logger.error('[file-transfer] network upload: unexpected response')
    return null
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      logger.error(`[file-transfer] network upload timeout - ${url}`)
    } else {
      logger.error(`[file-transfer] network upload error: ${String(err)}`)
    }
    return null
  }
}

/**
 * 上传文件内容到文件服务器。
 *
 * 迁移自 Python _upload_from_file_content。
 * 使用 multipart/form-data 格式上传，调用 FILE_UPLOAD_URL 接口。
 *
 * @param fileContent 文件内容
 * @param filename 文件名
 * @returns 上传后的文件 URL，失败返回 null
 */
async function uploadFromFileContent(
  fileContent: Buffer | Uint8Array,
  filename: string,
): Promise<string | null> {
  const { uploadUrl } = getFileTransferConfig()
  if (!uploadUrl) {
    logger.error('[file-transfer] FILE_UPLOAD_URL not configured')
    return null
  }

  // 大小检查
  const size = fileContent.byteLength
  if (size > MAX_FILE_SIZE) {
    logger.error(`[file-transfer] file too large: ${size} > ${MAX_FILE_SIZE} - ${filename}`)
    return null
  }

  try {
    logger.info(`[file-transfer] uploading: ${filename} (${size} bytes)`)

    const contentType = guessContentType(filename)
    const formData = new FormData()
    const blob = new Blob([fileContent], { type: contentType })
    formData.append('file', blob, filename)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS)

    const resp = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'User-Agent': DEFAULT_USER_AGENT },
      body: formData,
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!resp.ok) {
      logger.error(`[file-transfer] upload failed: ${resp.status}`)
      return null
    }

    const result = (await resp.json()) as Record<string, unknown>
    if (String(result.code ?? result.status ?? '') === '200' && result.data) {
      const data = result.data
      const fileUrl =
        typeof data === 'string' ? data : ((data as Record<string, unknown>).url ?? '')
      if (typeof fileUrl === 'string' && fileUrl) {
        logger.info(`[file-transfer] upload OK: ${filename} -> ${fileUrl}`)
        return fileUrl
      }
    }

    logger.error('[file-transfer] upload: unexpected response')
    return null
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      logger.error(`[file-transfer] upload timeout - ${filename}`)
    } else {
      logger.error(`[file-transfer] upload error: ${String(err)}`)
    }
    return null
  }
}

// =============================================================================
// 辅助
// =============================================================================

/** 判断字符串是否为 HTTP(S) URL。 */
function isHttpUrl(s: string): boolean {
  return s.startsWith('http://') || s.startsWith('https://')
}
