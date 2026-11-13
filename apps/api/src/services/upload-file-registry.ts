// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 上传文件归属登记(F-536)。
 *
 * 为什么需要:`/api/files/*` 的上传端点把字节写进 `uploads/public`(或 `UPLOAD_DIR`)就算完,
 * **不写任何归属元数据**;而 `workbook-service.openWorkbook` 只认 storage-service 的 sidecar
 * `ownerId`(那只有 `/workbook/save` 会写)。于是"先 /files 上传 xlsx,再 /workbook/open"
 * 这条主用例恒 404 —— 文件明明在盘上,判据却只存在于另一条链路。
 *
 * 本模块是上传侧的**唯一**归属登记处,同时给 open 提供"按 fileId 解析真实路径 + 归属"的读口:
 * - 记录落 `uploads/private/.file-meta/<fileId>.json`(不在任何静态前缀下,也不在
 *   `/api/files/assets/:owner/:filename` 可达的 `assets/` 子树内 ⇒ 不可被匿名读取);
 * - 归属只信登记侧写入的 `ownerId`(由承载层 `request.userId` 提供),不从客户端自报反推;
 * - 读回时复核 `storedPath` 必须落在已知上传根内(防登记文件被篡改成任意路径读取)。
 *
 * 失败语义:登记写失败不影响上传本身成功,但会让该文件**永远无法被 workbook 打开**
 * (open 侧 fail-closed:没有归属就不认领)。调用方据此打日志,不假装登记成功。
 */

import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'

/** fileId 形态闸:它直接参与文件名拼接,只接受 UUID 一族字符。 */
const FILE_ID_RE = /^[0-9a-fA-F-]{16,64}$/

export interface UploadedFileRecord {
  fileId: string
  /** 上传者(user_third_party 之外唯一可信的归属来源:承载层注入的 request.userId)。 */
  ownerId: string
  /** 原始文件名(扩展名白名单判据用)。 */
  name: string
  mimeType: string
  /** 服务端写入的绝对路径(不是客户端提供的路径)。 */
  storedPath: string
  size: number
  createdAt: string
}

function registryDir(): string {
  return join(process.cwd(), 'uploads', 'private', '.file-meta')
}

function recordPath(fileId: string): string {
  return join(registryDir(), `${fileId}.json`)
}

/** 已知上传根:登记里的 storedPath 必须落在其中之一(否则视为被篡改)。 */
function allowedUploadRoots(): string[] {
  const roots = [
    process.env.UPLOAD_DIR ?? '',
    join(process.cwd(), 'uploads', 'public'),
    join(process.cwd(), 'uploads', 'private'),
  ].filter(Boolean)
  return roots.map((r) => resolve(r))
}

function isInsideAnyRoot(target: string, roots: string[]): boolean {
  const p = resolve(target)
  return roots.some((root) => p === root || p.startsWith(root + sep))
}

/**
 * 登记一次上传。`storedPath` 必须是**服务端刚写入**的路径(调用方拼的),不接受客户端输入。
 * 写盘用 `tmp + rename`,避免并发读回时读到半截 JSON。
 */
export function registerUploadedFile(record: {
  fileId: string
  ownerId: string
  name: string
  mimeType: string
  storedPath: string
}): UploadedFileRecord {
  const { fileId, ownerId, name, mimeType, storedPath } = record
  if (!FILE_ID_RE.test(fileId)) throw new Error('fileId 形态非法')
  if (!ownerId) throw new Error('ownerId 不能为空')
  const roots = allowedUploadRoots()
  if (!isInsideAnyRoot(storedPath, roots)) throw new Error('storedPath 不在允许的上传根内')

  const dir = registryDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 })
  const size = statSync(storedPath).size
  const full: UploadedFileRecord = {
    fileId,
    ownerId,
    name: String(name ?? ''),
    mimeType: String(mimeType ?? ''),
    storedPath: resolve(storedPath),
    size,
    createdAt: new Date().toISOString(),
  }
  const target = recordPath(fileId)
  const tmp = `${target}.tmp`
  writeFileSync(tmp, JSON.stringify(full), { encoding: 'utf-8', mode: 0o600 })
  renameSync(tmp, target)
  return full
}

/**
 * 按 fileId 读回登记。未登记 / 形态非法 / 记录损坏 / 路径越界 / 文件已被删 ⇒ `null`。
 * 只回 `null` 不抛:调用方(open)对"查不到"必须走与"文件不存在"同形的分支。
 */
export function findUploadedFile(fileId: string): UploadedFileRecord | null {
  if (!FILE_ID_RE.test(String(fileId ?? ''))) return null
  const file = recordPath(fileId)
  if (!existsSync(file)) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(file, 'utf-8'))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const rec = parsed as Partial<UploadedFileRecord>
  if (typeof rec.ownerId !== 'string' || rec.ownerId.length === 0) return null
  if (typeof rec.storedPath !== 'string' || rec.storedPath.length === 0) return null
  if (rec.fileId !== fileId) return null
  const roots = allowedUploadRoots()
  if (!isInsideAnyRoot(rec.storedPath, roots)) return null
  if (!existsSync(rec.storedPath)) return null
  return {
    fileId,
    ownerId: rec.ownerId,
    name: typeof rec.name === 'string' ? rec.name : '',
    mimeType: typeof rec.mimeType === 'string' ? rec.mimeType : '',
    storedPath: resolve(rec.storedPath),
    size: typeof rec.size === 'number' && Number.isFinite(rec.size) ? rec.size : 0,
    createdAt: typeof rec.createdAt === 'string' ? rec.createdAt : '',
  }
}
