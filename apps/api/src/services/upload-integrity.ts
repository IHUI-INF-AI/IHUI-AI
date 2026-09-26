// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * A9R12-G1 · 分片上传完整性账(集合式进度 + 校验和兑现 + TTL 回收)
 *
 * 三条纪律对应本仓 HEAD 实测到的三个错误语义(净室重写,只吸收纪律不吸收代码):
 *  ① 进度是**集合**不是计数器 —— 重复上传同一片不得虚增计数、提前判定"全片到齐"。
 *     判据来自磁盘上真实收到的 `<n>.part` 索引集合,与 `uploadedChunks` 列同源。
 *  ② 声明的摘要**必须被兑现** —— `fileMd5` 此前是只写不读的装饰字段(守门 121
 *     「声明无消费者」同型)。合并后按服务端实算摘要逐字比对,不符即 4xx + 删除
 *     已合并文件 + **不返回 url**(本仓「失败必须响」口径,禁止只记日志不返错)。
 *  ③ 账有寿命 —— 半途而废的分片会话永久占盘 + 占行,`expiresAt` 列早在 schema 里
 *     却零读写;现由 init/upload 写入、由 `cleanupExpiredUploadSessions` 消费,
 *     挂进既有调度入口(scheduler.ts / scheduler-worker.ts)。
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, rmSync, createReadStream } from 'node:fs'
import { join } from 'node:path'
import { inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  uploadSessions,
  UPLOAD_SESSION_TERMINAL_STATUSES,
  UPLOAD_SESSION_REAPABLE_STATUSES,
} from '@ihui/database'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads')
/** 分片临时目录根:reaper 只允许删 `<CHUNKS_ROOT>/<uploadId>`,绝不允许整片删 uploads/。 */
export const CHUNKS_ROOT = join(UPLOAD_DIR, 'chunks')

/** 协议档位(与守门 123 的 TOOL_EXEC_BUDGET_* 三件套同形态:常量档 + 单一取用口)。 */
export const PROTOCOL_UPLOAD_LIMITS = {
  /** 单片字节上限:超过即拒收,不允许"先收下再说"。 */
  maxChunkBytes: 10 * 1024 * 1024,
  /** 分片会话寿命:超时即由 reaper 回收行 + 磁盘目录。 */
  ttlMs: 24 * 60 * 60 * 1000,
} as const

/** 本仓 uploadId 由服务端 randomUUID() 生成;reaper 用它做"只删自己产的目录"的守卫。 */
const UPLOAD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUploadSessionId(value: string): boolean {
  return UPLOAD_ID_RE.test(value)
}

/** 会话目录里已收到的分片编号(仅认 `<正整数>.part`,其余文件不计)。 */
export function listReceivedChunkNumbers(chunkDir: string): number[] {
  let names: string[]
  try {
    names = readdirSync(chunkDir)
  } catch {
    return []
  }
  const out: number[] = []
  for (const name of names) {
    const m = /^(\d+)\.part$/.exec(name)
    if (m) out.push(Number(m[1]))
  }
  return out
}

/** 集合去重后落在 1..totalChunks 内的分片数 —— 这就是"进度"的唯一算法。 */
export function countUniqueReceivedChunks(received: Iterable<number>, totalChunks: number): number {
  const set = new Set<number>()
  for (const n of received) if (Number.isInteger(n) && n >= 1 && n <= totalChunks) set.add(n)
  return set.size
}

/** 缺失分片编号(升序)。空数组 = 1..totalChunks 每一片都真的在磁盘上。 */
export function findMissingChunkNumbers(received: Iterable<number>, totalChunks: number): number[] {
  const set = new Set<number>()
  for (const n of received) if (Number.isInteger(n) && n >= 1 && n <= totalChunks) set.add(n)
  const missing: number[] = []
  for (let i = 1; i <= totalChunks; i++) if (!set.has(i)) missing.push(i)
  return missing
}

/** 流式实算成品摘要:不把整份文件读进内存(成品可能是几百 MB)。 */
export function hashFile(filePath: string): Promise<{ sha256: string; md5: string }> {
  return new Promise((resolve, reject) => {
    const sha = createHash('sha256')
    const md5 = createHash('md5')
    const stream = createReadStream(filePath)
    stream.on('error', reject)
    stream.on('data', (chunk) => {
      sha.update(chunk)
      md5.update(chunk)
    })
    stream.on('end', () => resolve({ sha256: sha.digest('hex'), md5: md5.digest('hex') }))
  })
}

/** 摘要比对:`md5:<hex>` / 裸 hex 两种声明形态同视,大小写不敏感。 */
export function normalizeDeclaredDigest(declared: string): string {
  const trimmed = declared.trim().toLowerCase()
  const colon = trimmed.lastIndexOf(':')
  return colon >= 0 ? trimmed.slice(colon + 1) : trimmed
}

/**
 * 未声明摘要 → 视为无可验证项放过(该字段 schema 上是 optional,不能凭空要求)。
 * 声明了不等 → false。调用方拿到 false 必须返错并删除半成品,不得降级成"只记日志"。
 */
export function digestMatches(declared: string | null | undefined, actualHex: string): boolean {
  if (declared === undefined || declared === null || declared.trim() === '') return true
  return normalizeDeclaredDigest(declared) === actualHex.trim().toLowerCase()
}

// =============================================================================
// ③ TTL 回收:可注入端口 + 纯判据,便于在无 DB 环境下单测
// =============================================================================

export interface ExpirableUploadSession {
  uploadId: string
  status: string
  expiresAt: Date | null
  updatedAt: Date
}

export interface UploadReapPort {
  /** 取回尚未终结的会话(未过期者由判据再筛一遍,端口不得代替判据)。 */
  listOpenSessions(): Promise<ExpirableUploadSession[]>
  /** 按 uploadId 批量删行。 */
  removeSessions(ids: readonly string[]): Promise<void>
}

export const dbUploadReapPort: UploadReapPort = {
  async listOpenSessions() {
    return await db
      .select({
        uploadId: uploadSessions.uploadId,
        status: uploadSessions.status,
        expiresAt: uploadSessions.expiresAt,
        updatedAt: uploadSessions.updatedAt,
      })
      .from(uploadSessions)
      .where(inArray(uploadSessions.status, [...UPLOAD_SESSION_REAPABLE_STATUSES]))
  },
  async removeSessions(ids) {
    if (ids.length === 0) return
    await db.delete(uploadSessions).where(inArray(uploadSessions.uploadId, [...ids]))
  },
}

/** 终态永不回收:completed 行要留着给业务查文件,cancelled 的目录已由 cancel 清过,
 *  checksum_mismatch 是合并校验失败后的终态(清单取自 `@ihui/database`,不在这里重列)。 */
const TERMINAL_STATUSES = new Set<string>(UPLOAD_SESSION_TERMINAL_STATUSES)

/** 单个会话是否该被回收。expiresAt 缺失的行(本票之前建的旧数据)退回 updatedAt + ttl。 */
export function isUploadSessionExpired(
  row: ExpirableUploadSession,
  now: Date = new Date(),
  ttlMs: number = PROTOCOL_UPLOAD_LIMITS.ttlMs,
): boolean {
  if (TERMINAL_STATUSES.has(row.status)) return false
  const deadline = row.expiresAt ?? new Date(row.updatedAt.getTime() + ttlMs)
  return deadline.getTime() <= now.getTime()
}

/** 待回收的 uploadId 清单(纯判据,不碰 IO)。 */
export function selectReapableUploadIds(
  rows: readonly ExpirableUploadSession[],
  now: Date = new Date(),
  ttlMs: number = PROTOCOL_UPLOAD_LIMITS.ttlMs,
): string[] {
  return rows.filter((r) => isUploadSessionExpired(r, now, ttlMs)).map((r) => r.uploadId)
}

export interface UploadReapResult {
  /** 删掉的会话行数 */
  sessions: number
  /** 删掉的分片目录数 */
  dirs: number
  /** 因 uploadId 不合本表 uuid 形态而被拒删的目录数(必须 >0 时有人来看,不得静默) */
  dirsRejected: number
}

/**
 * TTL 回收器。消费者 = `plugins/scheduler.ts` 的 `upload-session-reap-hourly`
 * (守门 121 判的正是"cleanup* 导出函数有无生产面调用方",故命名以 cleanup 开头)。
 */
export async function cleanupExpiredUploadSessions(
  port: UploadReapPort = dbUploadReapPort,
  now: Date = new Date(),
  chunksRoot: string = CHUNKS_ROOT,
  ttlMs: number = PROTOCOL_UPLOAD_LIMITS.ttlMs,
): Promise<UploadReapResult> {
  const rows = await port.listOpenSessions()
  const ids = selectReapableUploadIds(rows, now, ttlMs)
  let dirs = 0
  let dirsRejected = 0
  for (const id of ids) {
    if (!isUploadSessionId(id)) {
      dirsRejected += 1
      continue
    }
    const dir = join(chunksRoot, id)
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true })
      dirs += 1
    }
  }
  await port.removeSessions(ids)
  return { sessions: ids.length, dirs, dirsRejected }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
