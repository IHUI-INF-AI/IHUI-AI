// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‌​​‌​​‌‍‌​​‌​‌‌​‍‌​​‌​‌​‍‌​‌​​‌​‍‌‌​​‌​​‌‍​‌​‌​‌​​‍​‌‌‌​‌​‌‍​​‌​​‌​‌‍‌​‌​‌‌​‍​‌​​‌​‌‍​‌​‌​‌‌​‍‌​‌​‌​​‌‍​‌​​‌‌​‍‌​‌​‌​​​‍​‌‌​‌‌‌‍​‌​​‌​​‍​⁠

/**
 * 回合载荷缓冲 —— W4-04 的净室复现层。
 *
 * 背景(Qoder):`chat-session-turn-payload-buffer.sqlite` 与 `sessionMigration.sqlite`
 * 并存,说明"流式回合的载荷"是单独一层,不从消息历史反推。断线重连时按回合
 * 补发已产生的帧,不重新请求模型。
 *
 * IHUI 现状:ACP `prompt` 把 `session/update` 直接 `cx.notify` 出去;断线后
 * `session/resume` 只能按消息历史重放,拿不到"这一回合已经流到哪里"。如果客户端
 * 重连时回合仍在跑,它要么等最终消息,要么重发 prompt —— 后者会重复计费。
 *
 * 本模块只做缓冲与读回,不改会话历史、不碰模型:
 *   - 帧按 `seq` 严格递增,`update` 必须是带非空 `sessionUpdate` 的对象;
 *   - 超出 `maxBytes` 不再追加,置 `truncated=true`,不丢已经流出的前段;
 *   - 每 32 帧/flush/complete 落一次原子快照(JSON 一次写,不用逐行追加),
 *     进程崩溃后可按 `sessionId + turnId` 读回;
 *   - 持久化失败不抛给调用方,只记 `persistError`,内存缓冲仍可重放 ——
 *     "能续传"比"落盘成功"更不能被一个磁盘错误拖死。
 *
 * 超越点(对照 Qoder):`nextCursor` 是**最后一条已缓冲帧的 seq**,不是页码;
 * 客户端拿到 `hasMore=false` 时明确知道"已经追平当前流",不会把空页当成结束。
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path'

import { sanitizeSessionSegment } from '../tools/result-envelope/artifact-store.js'
import { assertPathInside } from '../util/path-guard.js'
import { writeFileAtomicSync } from '../util/atomic-write.js'

/** 载荷目录环境变量(测试隔离/人工排障用) */
export const TURN_PAYLOAD_DIR_ENV = 'IHUI_TURN_PAYLOAD_DIR'
/** 默认单回合载荷上限:4MB,超出即截断(不丢前段) */
export const DEFAULT_TURN_PAYLOAD_MAX_BYTES = 4_000_000
/** 默认载荷保留期:24h;断线补发不应无限期留全量帧 */
export const DEFAULT_TURN_PAYLOAD_TTL_MS = 24 * 60 * 60_000
/** 单回合保留期环境变量(测试/部署按需覆盖) */
export const TURN_PAYLOAD_TTL_ENV = 'IHUI_TURN_PAYLOAD_TTL_MS'
/** 全局载荷目录软上限:64MB;超出按 updatedAt 最旧优先回收 */
export const DEFAULT_TURN_PAYLOAD_TOTAL_BYTES = 64_000_000
/** 全局上限环境变量 */
export const TURN_PAYLOAD_TOTAL_BYTES_ENV = 'IHUI_TURN_PAYLOAD_TOTAL_BYTES'
/** 每次 flush 之间的帧数上限(避免每个 token 都 fsync) */
const FLUSH_EVERY_FRAMES = 32

export interface TurnPayloadFrame {
  readonly seq: number
  readonly at: number
  readonly update: Record<string, unknown>
}

export interface TurnPayloadReplay {
  /** 是否真的找到了对应回合缓冲;false 时其余字段为空壳,不代表"回合已结束" */
  readonly found: boolean
  readonly turnId: string | null
  readonly frames: readonly TurnPayloadFrame[]
  /** 最后一条已缓冲帧的 seq;没有帧时等于请求的 afterSeq */
  readonly nextCursor: number
  readonly hasMore: boolean
  readonly complete: boolean
  readonly stopReason?: string
  readonly truncated: boolean
  readonly persistError?: string
}

export interface TurnPayloadBufferOptions {
  readonly sessionId: string
  readonly turnId: string
  readonly maxBytes?: number
  /** 注入 now,便于测试;缺省 Date.now */
  readonly now?: () => number
  /** 注入持久化,便于测试失败路径;缺省写原子快照 */
  readonly persist?: (file: string, content: string) => void
  /** W4-04:本回合载荷保留期;缺省环境变量/24h */
  readonly ttlMs?: number
}

interface PersistedTurnPayload {
  version: 1
  sessionId: string
  turnId: string
  frames: TurnPayloadFrame[]
  complete: boolean
  stopReason?: string
  truncated: boolean
  updatedAt: number
  /** 过期时刻;缺省旧文件按 updatedAt + 默认 TTL 兼容,不把老格式当"永不过期" */
  expiresAt?: number
}

export function getTurnPayloadDir(): string {
  if (process.env[TURN_PAYLOAD_DIR_ENV]) return process.env[TURN_PAYLOAD_DIR_ENV]!
  return path.join(os.homedir(), '.ihui', 'turn-payloads')
}

/** 单回合载荷文件路径;两段都先收敛成安全文件名,再断言仍在载荷根目录内。 */
export function turnPayloadPath(sessionId: string, turnId: string): string {
  const root = getTurnPayloadDir()
  const target = path.join(
    root,
    sanitizeSessionSegment(sessionId),
    `${sanitizeSessionSegment(turnId)}.json`,
  )
  return assertPathInside(root, target, '回合载荷')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `update` 必须是 ACP session/update 的载荷;空壳/非对象一律拒。 */
function normalizeUpdate(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('turn payload update 必须是对象')
  const kind = value.sessionUpdate
  if (typeof kind !== 'string' || kind.trim().length === 0) {
    throw new Error('turn payload update 必须带非空 sessionUpdate')
  }
  return value
}

function requireAfterSeq(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error('afterSeq 必须是非负有限数')
  return Math.floor(value)
}

function requireLimit(value: number): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error('limit 必须是正有限数')
  return Math.min(500, Math.floor(value))
}

/** TTL 解析唯一出口:未设/非法 ⇒ 默认;显式 0 不允许(0 会让载荷写后即过期)。 */
function resolveTtlMs(raw: number | undefined): number {
  if (raw === undefined) {
    const env = process.env[TURN_PAYLOAD_TTL_ENV]
    if (env === undefined || env.trim() === '') return DEFAULT_TURN_PAYLOAD_TTL_MS
    const parsed = Number(env)
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_TURN_PAYLOAD_TTL_MS
  }
  if (!Number.isFinite(raw) || raw <= 0) throw new Error('ttlMs 必须是正有限数')
  return Math.floor(raw)
}

/**
 * 载荷目录回收:先删过期(含坏 JSON 按 mtime 兜底),再按全局字节上限从最旧开始删。
 * 只动 `getTurnPayloadDir()` 下的 `.json`;空会话目录一并移除。返回可审计计数。
 */
export interface TurnPayloadCleanupResult {
  readonly scanned: number
  readonly expired: number
  readonly quotaRemoved: number
  readonly bytesAfter: number
}

export function cleanupTurnPayloads(opts: {
  now?: () => number
  ttlMs?: number
  maxTotalBytes?: number
} = {}): TurnPayloadCleanupResult {
  const root = getTurnPayloadDir()
  const now = (opts.now ?? Date.now)()
  const ttlMs = resolveTtlMs(opts.ttlMs)
  const envTotal = process.env[TURN_PAYLOAD_TOTAL_BYTES_ENV]
  const maxTotalBytes =
    opts.maxTotalBytes ??
    (envTotal !== undefined && Number.isFinite(Number(envTotal)) && Number(envTotal) > 0
      ? Math.floor(Number(envTotal))
      : DEFAULT_TURN_PAYLOAD_TOTAL_BYTES)
  let scanned = 0
  let expired = 0
  let quotaRemoved = 0
  const entries: Array<{ file: string; updatedAt: number; bytes: number }> = []
  let sessionDirs: fs.Dirent[]
  try {
    sessionDirs = fs.readdirSync(root, { withFileTypes: true })
  } catch {
    return { scanned: 0, expired: 0, quotaRemoved: 0, bytesAfter: 0 }
  }
  for (const sessionDir of sessionDirs) {
    if (!sessionDir.isDirectory()) continue
    const dir = path.join(root, sessionDir.name)
    let files: fs.Dirent[]
    try {
      files = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.json')) continue
      scanned += 1
      const full = path.join(dir, file.name)
      let updatedAt = 0
      let expiresAt: number | undefined
      try {
        const stat = fs.statSync(full)
        updatedAt = stat.mtimeMs
        const parsed: unknown = JSON.parse(fs.readFileSync(full, 'utf8'))
        if (isRecord(parsed)) {
          if (typeof parsed.updatedAt === 'number') updatedAt = parsed.updatedAt
          if (typeof parsed.expiresAt === 'number') expiresAt = parsed.expiresAt
        }
      } catch {
        // 坏文件按 mtime + TTL 兜底，不让一条脏 JSON 永久占位。
      }
      const expiry = expiresAt ?? updatedAt + ttlMs
      if (expiry <= now) {
        try {
          fs.unlinkSync(full)
          expired += 1
        } catch {
          continue
        }
        continue
      }
      let bytes = 0
      try {
        bytes = fs.statSync(full).size
      } catch {
        continue
      }
      entries.push({ file: full, updatedAt, bytes })
    }
    try {
      if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir)
    } catch {
      // 目录删不掉不是载荷层要报的错。
    }
  }
  let total = entries.reduce((sum, e) => sum + e.bytes, 0)
  entries.sort((a, b) => a.updatedAt - b.updatedAt)
  for (const entry of entries) {
    if (total <= maxTotalBytes) break
    try {
      fs.unlinkSync(entry.file)
      total -= entry.bytes
      quotaRemoved += 1
    } catch {
      // 单文件失败不改变已统计的总额：下一轮还会再试。
    }
  }
  return { scanned, expired, quotaRemoved, bytesAfter: total }
}

/**
 * 单回合载荷缓冲。一个实例只服务一个 `sessionId + turnId`;
 * 不跨回合复用 seq,避免"回合 A 的游标读到回合 B 的帧"。
 */
export class TurnPayloadBuffer {
  readonly sessionId: string
  readonly turnId: string
  readonly maxBytes: number
  readonly ttlMs: number
  private readonly now: () => number
  private readonly persist: (file: string, content: string) => void
  private readonly filePath: string
  private frames: TurnPayloadFrame[] = []
  private bytes = 0
  private persistedFrames = 0
  private completeState = false
  private stopReason: string | undefined
  private truncated = false
  private persistError: string | undefined

  constructor(opts: TurnPayloadBufferOptions) {
    this.sessionId = sanitizeSessionSegment(opts.sessionId)
    this.turnId = sanitizeSessionSegment(opts.turnId)
    this.maxBytes = opts.maxBytes ?? DEFAULT_TURN_PAYLOAD_MAX_BYTES
    if (!Number.isFinite(this.maxBytes) || this.maxBytes <= 0) {
      throw new Error('maxBytes 必须是正有限数')
    }
    this.ttlMs = resolveTtlMs(opts.ttlMs)
    this.now = opts.now ?? Date.now
    this.persist = opts.persist ?? writeFileAtomicSync
    this.filePath = turnPayloadPath(this.sessionId, this.turnId)
  }

  /**
   * 追加一帧。超过上限返回 null 并置 truncated,不抛 ——
   * 载荷缓冲是旁路,不能因为缓冲满了就把正在跑的回合打断。
   */
  append(update: unknown): TurnPayloadFrame | null {
    if (this.completeState) throw new Error('回合载荷已结束,拒绝追加迟到帧')
    const normalized = normalizeUpdate(update)
    const size = Buffer.byteLength(JSON.stringify(normalized), 'utf8')
    if (this.bytes + size > this.maxBytes) {
      this.truncated = true
      return null
    }
    const frame: TurnPayloadFrame = { seq: this.frames.length + 1, at: this.now(), update: normalized }
    this.frames.push(frame)
    this.bytes += size
    if (this.frames.length - this.persistedFrames >= FLUSH_EVERY_FRAMES) this.flush()
    return frame
  }

  /** 读回 `afterSeq` 之后的帧;limit 上限 500,防止一次拉爆客户端。 */
  replay(afterSeq = 0, limit = 200): TurnPayloadReplay {
    const cursor = requireAfterSeq(afterSeq)
    const page = this.frames.filter((f) => f.seq > cursor).slice(0, requireLimit(limit))
    const lastSeq = this.frames.length > 0 ? this.frames[this.frames.length - 1]!.seq : cursor
    return {
      found: true,
      turnId: this.turnId,
      frames: page,
      nextCursor: page.length > 0 ? page[page.length - 1]!.seq : Math.max(cursor, lastSeq),
      hasMore: this.frames.some((f) => f.seq > (page.length > 0 ? page[page.length - 1]!.seq : cursor)),
      complete: this.completeState,
      ...(this.stopReason !== undefined ? { stopReason: this.stopReason } : {}),
      truncated: this.truncated,
      ...(this.persistError !== undefined ? { persistError: this.persistError } : {}),
    }
  }

  /** 标记回合结束并落盘。重复调用幂等,不会写第二条 complete。 */
  complete(stopReason: string): void {
    if (this.completeState) return
    this.completeState = true
    this.stopReason = stopReason
    this.flush()
    // 回合结束是唯一可以安全回收的时点（活跃回合可能还要续传）；清理失败不得反噬完成态。
    try {
      cleanupTurnPayloads({ now: this.now, ttlMs: this.ttlMs })
    } catch {
      // cleanup 是旁路。
    }
  }

  get isComplete(): boolean {
    return this.completeState
  }

  get frameCount(): number {
    return this.frames.length
  }

  get overflowed(): boolean {
    return this.truncated
  }

  /** 落一次完整快照;持久化失败只记录,不抛给 agent 流。 */
  flush(): void {
    if (this.persistedFrames >= this.frames.length && !this.completeState) return
    const payload: PersistedTurnPayload = {
      version: 1,
      sessionId: this.sessionId,
      turnId: this.turnId,
      frames: this.frames,
      complete: this.completeState,
      ...(this.stopReason !== undefined ? { stopReason: this.stopReason } : {}),
      truncated: this.truncated,
      updatedAt: this.now(),
      expiresAt: this.now() + this.ttlMs,
    }
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true, mode: 0o700 })
      this.persist(this.filePath, JSON.stringify(payload))
      this.persistedFrames = this.frames.length
      this.persistError = undefined
    } catch (error) {
      this.persistError = error instanceof Error ? error.message : String(error)
    }
  }

  /**
   * 从磁盘读回一个回合。文件不存在/坏 JSON 返回 null;
   * 帧按 seq 去重并升序,防止旧版本重复写导致的回放错位。
   */
  static read(sessionId: string, turnId: string, opts: { now?: () => number; ttlMs?: number } = {}): TurnPayloadBuffer | null {
    const file = turnPayloadPath(sessionId, turnId)
    let raw: string
    try {
      raw = fs.readFileSync(file, 'utf8')
    } catch {
      return null
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return null
    }
    if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.frames)) return null
    const now = (opts.now ?? Date.now)()
    const updatedAt = typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0
    const expiresAt =
      typeof parsed.expiresAt === 'number'
        ? parsed.expiresAt
        : updatedAt + resolveTtlMs(opts.ttlMs)
    if (expiresAt <= now) {
      // 过期即视为不存在;文件本身留给 cleanupTurnPayloads 统一回收,读路径不做副作用删除。
      return null
    }
    const buffer = new TurnPayloadBuffer({
      sessionId,
      turnId,
      ...(opts.ttlMs === undefined ? {} : { ttlMs: opts.ttlMs }),
      ...(opts.now === undefined ? {} : { now: opts.now }),
    })
    const bySeq = new Map<number, TurnPayloadFrame>()
    for (const item of parsed.frames) {
      if (!isRecord(item) || typeof item.seq !== 'number' || !Number.isFinite(item.seq)) continue
      if (typeof item.at !== 'number') continue
      try {
        const update = normalizeUpdate(item.update)
        bySeq.set(item.seq, { seq: item.seq, at: item.at, update })
      } catch {
        continue
      }
    }
    buffer.frames = [...bySeq.values()].sort((a, b) => a.seq - b.seq)
    buffer.bytes = buffer.frames.reduce((n, f) => n + Buffer.byteLength(JSON.stringify(f.update), 'utf8'), 0)
    buffer.persistedFrames = buffer.frames.length
    buffer.completeState = parsed.complete === true
    buffer.stopReason = typeof parsed.stopReason === 'string' ? parsed.stopReason : undefined
    buffer.truncated = parsed.truncated === true
    return buffer
  }
}
