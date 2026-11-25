// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 朋友圈本地媒体「脱离桥」直读：归档行已记下真实落盘目录时，API 直接从磁盘读，
 * 不再要求 bridge 在线；路径必须落在显式配置的 WECHAT_HUB_MEDIA_ROOT 之内。
 * 只返回真实文件，不补占位图，不扫描微信目录。
 */

import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { and, eq } from 'drizzle-orm'
import { dbRead } from '../../db/index.js'
import { wechatHubMoments } from '@ihui/database'
import { AppError } from '../../errors/AppError.js'
import type { WechatMomentMediaFile, WechatMomentMediaRead } from './types.js'

const MEDIA_MAX_BYTES = 50 * 1024 * 1024
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.webm': 'video/webm',
}

export function mediaContentType(name: string): string {
  return CONTENT_TYPES[path.extname(name).toLowerCase()] ?? 'application/octet-stream'
}

export function configuredMediaRoot(): string | null {
  const raw = process.env.WECHAT_HUB_MEDIA_ROOT?.trim()
  return raw ? path.resolve(raw) : null
}

/** 把已归档的 mediaLocalDir 收紧到配置根目录内；越界/未配置一律不读。 */
export function confinedMediaDir(root: string, mediaLocalDir: string): string | null {
  const dir = path.resolve(mediaLocalDir)
  const rel = path.relative(root, dir)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null
  return dir
}

async function archivedMediaDir(accountId: string, momentId: string): Promise<string | null> {
  const root = configuredMediaRoot()
  if (!root || !SAFE_SEGMENT.test(momentId)) return null
  const [row] = await dbRead
    .select({ metadata: wechatHubMoments.metadata })
    .from(wechatHubMoments)
    .where(and(eq(wechatHubMoments.accountId, accountId), eq(wechatHubMoments.momentKey, momentId)))
    .limit(1)
  const metadata = (row?.metadata ?? {}) as Record<string, unknown>
  const mediaLocalDir = typeof metadata.mediaLocalDir === 'string' ? metadata.mediaLocalDir : ''
  return mediaLocalDir ? confinedMediaDir(root, mediaLocalDir) : null
}

async function listDir(dir: string): Promise<WechatMomentMediaFile[] | null> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    const files: WechatMomentMediaFile[] = []
    for (const entry of entries) {
      if (!entry.isFile() || !SAFE_SEGMENT.test(entry.name)) continue
      const info = await stat(path.join(dir, entry.name))
      if (!info.isFile()) continue
      files.push({
        name: entry.name,
        size: info.size,
        contentType: mediaContentType(entry.name),
      })
    }
    files.sort((a, b) => a.name.localeCompare(b.name))
    return files
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT') return null
    throw e
  }
}

/** 归档本地媒体列表；无配置/无目录返回 null，交回调用方走桥。 */
export async function listArchivedMomentMedia(
  accountId: string,
  momentId: string,
): Promise<WechatMomentMediaFile[] | null> {
  const dir = await archivedMediaDir(accountId, momentId)
  return dir ? listDir(dir) : null
}

/**
 * 按归档行里的绝对目录直接统计真实文件数；只用于“原件是否可得”的展示。
 * 不读数据库、不扫描微信目录；目录必须落在配置根内，否则返回 null。
 */
export async function countArchivedMediaDir(mediaLocalDir: string): Promise<number | null> {
  const root = configuredMediaRoot()
  if (!root) return null
  const dir = confinedMediaDir(root, mediaLocalDir)
  if (!dir) return null
  try {
    const files = await listDir(dir)
    return files?.length ?? 0
  } catch {
    return null
  }
}

/** 归档本地媒体二进制；无配置/无文件返回 null，交回调用方走桥。 */
export async function readArchivedMomentMedia(
  accountId: string,
  momentId: string,
  name: string,
): Promise<WechatMomentMediaRead | null> {
  if (!SAFE_SEGMENT.test(name)) return null
  const dir = await archivedMediaDir(accountId, momentId)
  if (!dir) return null
  const target = path.join(dir, name)
  const rel = path.relative(dir, target)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null
  try {
    const info = await stat(target)
    if (!info.isFile()) return null
    if (info.size > MEDIA_MAX_BYTES) {
      throw new AppError('媒体超过 50MB 上限', 413, 'WECHAT_MOMENT_MEDIA_TOO_LARGE')
    }
    const data = await readFile(target)
    return { contentType: mediaContentType(name), data }
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT') return null
    throw e
  }
}
