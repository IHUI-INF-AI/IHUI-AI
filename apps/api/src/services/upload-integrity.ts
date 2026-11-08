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
import { existsSync, readdirSync, rmSync, createReadStream, statSync } from 'node:fs'
import { join } from 'node:path'
import { inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  uploadSessions,
  UPLOAD_SESSION_TERMINAL_STATUSES,
  UPLOAD_SESSION_REAPABLE_STATUSES,
  UPLOAD_SESSION_RECLAIMABLE_TERMINAL_STATUSES,
} from '@ihui/database'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads')
/** 分片临时目录根:reaper 只允许删 `<CHUNKS_ROOT>/<uploadId>`,绝不允许整片删 uploads/。 */
export const CHUNKS_ROOT = join(UPLOAD_DIR, 'chunks')

/** 协议档位(与守门 123 的 TOOL_EXEC_BUDGET_* 三件套同形态:常量档 + 单一取用口)。 */
export const PROTOCOL_UPLOAD_LIMITS = {
  /** 单片字节上限:超过即拒收,不允许"先收下再说"。 */
  maxChunkBytes: 10 * 1024 * 1024,
  /**
   * 单会话分片数上限(2026-11-08,修 F-28)。
   * 缺陷:totalChunks 只有 min(1),`findMissingChunkNumbers` 按 1..totalChunks 线性遍历并 push,
   * 传 2^31 即把进程内存打满。上限取 4096(= 40GiB / 10MiB),覆盖 2GiB 文件按 1MiB 分片的
   * 正常极端形态,同时把该循环的迭代次数钉死在可忽略量级。
   */
  maxTotalChunks: 4096,
  /**
   * 单文件声明字节上限(2026-11-08,修 F-28):= maxTotalChunks × maxChunkBytes,与两档自洽。
   * 只约束 init 的声明值;真实占盘另由 maxStagedBytesGlobal 兜底,不靠这个声明值防磁盘。
   */
  maxFileBytes: 4096 * 10 * 1024 * 1024,
  /** 分片会话寿命:超时即由 reaper 回收行 + 磁盘目录。 */
  ttlMs: 24 * 60 * 60 * 1000,
  /**
   * 失败终态(checksum_mismatch/content_rejected)的分片目录保留窗口(2026-11-08,修 F-381)。
   * 合并产物已被删除,目录只用于短期取证/误判申诉;1h 后由同一 reaper 回收,不再占
   * 24h 且不再计入全局暂存预算。
   */
  terminalTtlMs: 60 * 60 * 1000,
  /** 合并阶段并发上限(2026-09-26 补上登记遗留的最后一格,消费者 = services/upload-merge-gate.ts)。
   *  为什么是 2:合并 = 读全部 .part + 流式写最终文件 + md5/sha256 实算,全是磁盘 IO 与哈希
   *  CPU 工作,且与**全部业务请求同在一个 Node 进程**(nssm 单实例)—— 流式拷贝已不占整档
   *  内存,真正的争抢资源是哈希计算(吃满单核即拖累事件循环)与磁盘队列;2 路并发已能把这两项
   *  打满,再多合并只增排队不增吞吐。第 3 路起**排队等待,不拒绝**(拒绝 = 把正常用户挡在门外)。
   *  env 出口 UPLOAD_MERGE_MAX_CONCURRENCY 只调数值,0 = 显式不限(台账必须喊出来),非法值回落本档。 */
  maxConcurrentUploads: 2,
  /**
   * 单用户并发活跃分片会话上限(2026-09-30,跨会话聚合预算第一档)。
   * 三依据(写法样板:apps/ai-service/app/services/command_streamer.py「下界/上界/取值」):
   *  - 下界:正常用户一次大文件上传只需 1 个会话;相册/多文件并行的极端正常形态 4 个也够 ——
   *    档位必须落在正常流量上界之下才在防守,否则等于没档。
   *  - 上界:`ttlMs = 24h` 意味着每个会话的占盘窗口是一整天;单用户档若无限,一个账号
   *    就能把全局暂存预算(maxStagedBytesGlobal)整档独占,聚合预算形同虚设。
   *  - 取值:5 = 覆盖"多文件并行 + 1 个重试余量"的正常形态,同时把单账号最坏占盘
   *    压在全局预算的约 1/4 以内;超档 429(可重试)且**不建目录不建行**,零资源占用。
   *  消费点:routes/chunked-upload.ts 的 begin 处(新建装配检,对齐上游两处检的"新建"半边)。
   */
  maxActiveSessionsPerUser: 5,
  /**
   * 进程级全局暂存字节预算(uploads/chunks 下全部 .part 的总和,2026-09-30 立)。
   * 三依据:
   *  - 下界:单会话最大合法占用 = fileSize(声明值,init 处已按 maxChunkBytes 与
   *    totalChunks 的自洽性钳过),预算若装不下"数个正常大文件并行暂存"就没有业务价值;
   *    挡量不挡功能,档位必须高于正常业务的最坏并行形态。
   *  - 上界:API 是同机单实例(nssm),uploads/ 与业务库、日志同盘 —— 占满磁盘等于整站故障,
   *    本档必须远小于部署盘的最小剩余空间承诺(现部署 ≥ 20GiB 余量)。
   *  - 取值:2GiB ≈ 8 个 256MiB 或 2 个 1GiB 大文件的并行暂存余量;超档即**拒收新片**(429),
   *    既有会话一律不清(清存量 = 把无辜用户的在途上传打掉,fail closed 只挡增量)。
   *  消费点:routes/chunked-upload.ts 的每片落盘处(追加分片检,对齐上游"追加"半边)。
   */
  maxStagedBytesGlobal: 2 * 1024 * 1024 * 1024,
} as const

/**
 * 上限钳制器(2026-09-30,语义照 zcode-protocol-v4 wire-assembler 的 hardBound):
 * 调用方传入的上限**只可收紧、不可放宽** —— 取 `Math.min(Math.floor(incoming), 协议档)`;
 * 非有限或非正直接抛(0 = 关闸不是合法"收紧",NaN/负数是 bug 不是配置)。
 * `PROTOCOL_UPLOAD_LIMITS` 的每个读取口都应经过它:任何"spread 后改大"的常量表
 * 在这里都会被钳回协议档,任何想绕过档位的调用在这里当场红。
 */
export function clampUploadLimit<K extends keyof typeof PROTOCOL_UPLOAD_LIMITS>(
  name: K,
  incoming: number,
): (typeof PROTOCOL_UPLOAD_LIMITS)[K] {
  if (!Number.isFinite(incoming) || incoming <= 0) {
    throw new Error(
      `clampUploadLimit(${String(name)}): 非有限或非正的传入值 ${String(incoming)} 直接抛(上限只可收紧不可放宽,0/NaN/负数均不合法)`,
    )
  }
  return Math.min(
    Math.floor(incoming),
    PROTOCOL_UPLOAD_LIMITS[name],
  ) as (typeof PROTOCOL_UPLOAD_LIMITS)[K]
}

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

// =============================================================================
// 跨会话聚合预算(2026-09-30):单会话三档之外的两条全局档
// =============================================================================

/**
 * 全局暂存字节:遍历 `<chunksRoot>/<uploadId>/<n>.part` 实测字节总和。
 * 只认 uuid 形态目录与 `<正整数>.part` 文件(与 reaper 的删目录护栏同一口径,
 * 非本链产物不计入,也不能被它们撑爆预算);目录不存在 = 0,读不动 = 0(空集语义)。
 */
export function measureStagedBytes(
  chunksRoot: string = CHUNKS_ROOT,
  onlyUploadIds?: ReadonlySet<string>,
): number {
  let sessionDirs: string[]
  try {
    sessionDirs = readdirSync(chunksRoot)
  } catch {
    return 0
  }
  let total = 0
  for (const dir of sessionDirs) {
    if (!isUploadSessionId(dir)) continue
    // F-381:预算只统计仍在 uploading/merging 的活跃会话;失败终态目录按短 TTL 回收,
    // 不得继续挤占 2GiB 预算(否则少量失败大文件即可把正常上传长期挡在门外)。
    if (onlyUploadIds && !onlyUploadIds.has(dir)) continue
    let names: string[]
    try {
      names = readdirSync(join(chunksRoot, dir))
    } catch {
      continue // 并发窗口内目录被 reaper 收走 = 该会话贡献 0,不是错误
    }
    for (const name of names) {
      if (!/^(\d+)\.part$/.test(name)) continue
      try {
        total += statSync(join(chunksRoot, dir, name)).size
      } catch {
        // 并发窗口内分片被合并/回收 = 贡献 0;宁可低估也不让度量本身把上传链打挂
      }
    }
  }
  return total
}

/** 纯判据:单用户活跃会话数是否超档(超 = begin 处 4xx/429 且不得建目录建行)。 */
export function isPerUserSessionBudgetExceeded(
  activeSessions: number,
  limit: number = PROTOCOL_UPLOAD_LIMITS.maxActiveSessionsPerUser,
): boolean {
  return activeSessions >= limit
}

/** 纯判据:收下这一片后全局暂存是否突破预算(超 = 拒收**新片**,既有会话一律不清)。 */
export function wouldStagedBudgetOverflow(
  currentStagedBytes: number,
  incomingChunkBytes: number,
  budget: number = PROTOCOL_UPLOAD_LIMITS.maxStagedBytesGlobal,
): boolean {
  return currentStagedBytes + incomingChunkBytes > budget
}

/** 缺失分片编号(升序)。空数组 = 1..totalChunks 每一片都真的在磁盘上。
 *  totalChunks 先被协议档钳住(修 F-28):即便库里有历史超档行,这里的线性遍历也不会失控。 */
export function findMissingChunkNumbers(received: Iterable<number>, totalChunks: number): number[] {
  const boundedTotal = Math.min(
    Math.max(0, Math.floor(totalChunks)),
    PROTOCOL_UPLOAD_LIMITS.maxTotalChunks,
  )
  const set = new Set<number>()
  for (const n of received) if (Number.isInteger(n) && n >= 1 && n <= boundedTotal) set.add(n)
  const missing: number[] = []
  for (let i = 1; i <= boundedTotal; i++) if (!set.has(i)) missing.push(i)
  return missing
}

/** 缺失分片在响应里的展示上限:超档时只列前 N 片,避免 `join('、')` 构造巨串(修 F-28)。 */
export const MAX_REPORTED_MISSING_CHUNKS = 50

/** 缺失分片编号 → 响应文案片段(超过展示上限时截断并给出剩余片数)。 */
export function formatMissingChunkNumbers(
  missing: readonly number[],
  max: number = MAX_REPORTED_MISSING_CHUNKS,
): string {
  if (missing.length <= max) return missing.join('、')
  return `${missing.slice(0, max).join('、')}…(其余 ${missing.length - max} 片略)`
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
      .where(
        inArray(uploadSessions.status, [
          ...UPLOAD_SESSION_REAPABLE_STATUSES,
          ...UPLOAD_SESSION_RECLAIMABLE_TERMINAL_STATUSES,
        ]),
      )
  },
  async removeSessions(ids) {
    if (ids.length === 0) return
    await db.delete(uploadSessions).where(inArray(uploadSessions.uploadId, [...ids]))
  },
}

/** 终态永不回收:completed 行要留着给业务查文件,cancelled 的目录已由 cancel 清过。
 *  checksum_mismatch/content_rejected 例外:按 terminalTtlMs 短 TTL 回收(修 F-381),
 *  清单取自 `@ihui/database`,不在这里重列。 */
const TERMINAL_STATUSES = new Set<string>(UPLOAD_SESSION_TERMINAL_STATUSES)
const RECLAIMABLE_TERMINAL_STATUSES = new Set<string>(UPLOAD_SESSION_RECLAIMABLE_TERMINAL_STATUSES)

/** 单个会话是否该被回收。expiresAt 缺失的行(本票之前建的旧数据)退回 updatedAt + ttl。
 *  失败终态用 updatedAt + terminalTtlMs(合并失败时刻起算),不沿用 24h 的 expiresAt。
 *  ttl 走钳制器:调用方传入值只可收紧,试图放宽(或传入 0/NaN)当场抛。 */
export function isUploadSessionExpired(
  row: ExpirableUploadSession,
  now: Date = new Date(),
  ttlMs: number = PROTOCOL_UPLOAD_LIMITS.ttlMs,
  terminalTtlMs: number = PROTOCOL_UPLOAD_LIMITS.terminalTtlMs,
): boolean {
  if (RECLAIMABLE_TERMINAL_STATUSES.has(row.status)) {
    const effectiveTerminalTtl = clampUploadLimit('terminalTtlMs', terminalTtlMs)
    return row.updatedAt.getTime() + effectiveTerminalTtl <= now.getTime()
  }
  if (TERMINAL_STATUSES.has(row.status)) return false
  const effectiveTtl = clampUploadLimit('ttlMs', ttlMs)
  const deadline = row.expiresAt ?? new Date(row.updatedAt.getTime() + effectiveTtl)
  return deadline.getTime() <= now.getTime()
}

/** 待回收的 uploadId 清单(纯判据,不碰 IO)。ttl 同走钳制器(只可收紧)。 */
export function selectReapableUploadIds(
  rows: readonly ExpirableUploadSession[],
  now: Date = new Date(),
  ttlMs: number = PROTOCOL_UPLOAD_LIMITS.ttlMs,
  terminalTtlMs: number = PROTOCOL_UPLOAD_LIMITS.terminalTtlMs,
): string[] {
  return rows
    .filter((r) =>
      isUploadSessionExpired(
        r,
        now,
        clampUploadLimit('ttlMs', ttlMs),
        clampUploadLimit('terminalTtlMs', terminalTtlMs),
      ),
    )
    .map((r) => r.uploadId)
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
