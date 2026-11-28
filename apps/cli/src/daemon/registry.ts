// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B4-04 daemon 跨进程注册表 —— pid/身份/端口/host 登记 + 存活→身份→host→端口三判据过滤
 * + 陈旧条目回收。
 *
 * 对照 WorkBuddy 5.11.3 的 daemon 会话注册表（取证见
 * docs/benchmark-evidence/2026-11/deep-native-2026-11-23/block4-workbuddy.md §B4-04）：
 * 对方在 sessionsDir 散落 `<pid>.json`，`findRunningDaemon` 按 存活 → 身份当前 → host 过滤，
 * 锁文件按 pid 不活 / 端口不通回收。本仓复现同一行为，三轴超越：
 *   ① 三谓词全部可注入（存活 / 身份 / 端口），判据层零真实副作用，单测逐维断言；
 *   ② store 是接口而不是裸 Map：内存实现供测试，JSON 文件实现供本地台账，
 *      接口只列 list/upsert/remove 三枚原语，将来可整体替换为 PostgreSQL 实现
 *      （项目数据层唯一允许 PG；本仓禁止 sqlite，任何实现不得引入本地嵌入式数据库）；
 *   ③ 观测取不到一律落 `unjudged`，绝不拿「没观测到」冒成「死了 / 不通 / 无实例」。
 *
 * 与 `../tools/background-registry.ts` 的分工：那份是后台任务台账（只报不恢复，重启后
 * detached-unknown）；本份是 daemon 单例探测与状态发现，启动前先用同一套判据查在跑实例。
 */

import net from 'node:net'
import * as fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { writeFileAtomicSync } from '../util/atomic-write.js'
import { observeProcessAlive } from '../util/parent-bound.js'

export const REGISTRY_FILE_ENV = 'IHUI_DAEMON_REGISTRY_FILE'
export const REGISTRY_SCHEMA_VERSION = 1

// ---------------------------------------------------------------------------
// 条目形状与判据输入
// ---------------------------------------------------------------------------

/** 一条 daemon 登记。identity 为启动时刻或镜像指纹（版本 / 启动命令哈希），用于 PID 复用与身份漂移复核。 */
export interface DaemonRegistryEntry {
  readonly pid: number
  readonly identity: string
  readonly port: number
  readonly host: string
  readonly kind: string
  readonly registeredAtMs: number
}

export interface RegistryQuery {
  readonly kind?: string
  readonly host?: string
}

/**
 * 三谓词全部可注入。返回 `null` = 观测取不到（未判定），判据侧绝不猜。
 * 端口谓词可为异步（真实 net.connect 带超时）；存活 / 身份谓词保持同步。
 */
export interface RegistryProbes {
  readonly isAlive: (pid: number) => boolean | null
  readonly isIdentityCurrent: (entry: DaemonRegistryEntry) => boolean | null
  readonly isPortOpen: (host: string, port: number) => boolean | null | Promise<boolean | null>
}

export type StaleReason = 'dead' | 'identity-mismatch' | 'host-mismatch' | 'port-closed'
export type UnjudgedReason = 'alive-unmeasured' | 'identity-unmeasured' | 'port-unmeasured'

export type EntryVerdict =
  | { readonly status: 'running'; readonly entry: DaemonRegistryEntry }
  | { readonly status: 'stale'; readonly reason: StaleReason }
  | { readonly status: 'unjudged'; readonly reason: UnjudgedReason }

export type EntryValidation =
  | { readonly ok: true; readonly entry: DaemonRegistryEntry }
  | { readonly ok: false; readonly reason: string }

/** 条目形状准入：任一维不合规都给具名原因，不把脏条目写进注册表。 */
export function validateEntry(raw: unknown): EntryValidation {
  if (typeof raw !== 'object' || raw === null) return { ok: false, reason: 'entry-not-object' }
  const r = raw as Record<string, unknown>
  if (!Number.isInteger(r.pid) || (r.pid as number) <= 0) return { ok: false, reason: 'pid-invalid' }
  if (typeof r.identity !== 'string' || r.identity.trim() === '') {
    return { ok: false, reason: 'identity-empty' }
  }
  if (!Number.isInteger(r.port) || (r.port as number) < 1 || (r.port as number) > 65535) {
    return { ok: false, reason: 'port-invalid' }
  }
  if (typeof r.host !== 'string' || r.host.trim() === '') return { ok: false, reason: 'host-empty' }
  if (typeof r.kind !== 'string' || r.kind.trim() === '') return { ok: false, reason: 'kind-empty' }
  if (typeof r.registeredAtMs !== 'number' || !Number.isFinite(r.registeredAtMs)) {
    return { ok: false, reason: 'registered-at-invalid' }
  }
  return {
    ok: true,
    entry: {
      pid: r.pid as number,
      identity: (r.identity as string).trim(),
      port: r.port as number,
      host: (r.host as string).trim(),
      kind: (r.kind as string).trim(),
      registeredAtMs: r.registeredAtMs as number,
    },
  }
}

/**
 * 单条裁决（纯判据：零 spawn / 零网络 / 零 fs，形状由镜像测试锁死）。
 * 过滤顺序固定：① 存活 → ② 身份当前 → ③ host → ④ 端口可达。
 * 前一维未过不再问后一维（顺序即短路顺序，测试用 spy 断言后维未被调用）。
 */
export async function evaluateEntry(
  entry: DaemonRegistryEntry,
  query: RegistryQuery,
  probes: RegistryProbes,
): Promise<EntryVerdict> {
  const alive = probes.isAlive(entry.pid)
  if (alive === null) return { status: 'unjudged', reason: 'alive-unmeasured' }
  if (!alive) return { status: 'stale', reason: 'dead' }

  const identityCurrent = probes.isIdentityCurrent(entry)
  if (identityCurrent === null) return { status: 'unjudged', reason: 'identity-unmeasured' }
  if (!identityCurrent) return { status: 'stale', reason: 'identity-mismatch' }

  if (query.host !== undefined && query.host !== entry.host) {
    return { status: 'stale', reason: 'host-mismatch' }
  }

  const portOpen = await probes.isPortOpen(entry.host, entry.port)
  if (portOpen === null) return { status: 'unjudged', reason: 'port-unmeasured' }
  if (!portOpen) return { status: 'stale', reason: 'port-closed' }

  return { status: 'running', entry }
}

// ---------------------------------------------------------------------------
// 存储接口与两套实现
// ---------------------------------------------------------------------------

/**
 * 注册表持久化接口。现阶段：MemoryRegistryStore（测试 / 进程内）、JsonFileRegistryStore（本地台账）。
 * 接口刻意只列 list/upsert/remove 三枚原语 —— 将来可整体替换为 PostgreSQL 实现
 * （项目数据层唯一允许 PG；禁止 sqlite，任何实现不得引入本地嵌入式数据库）。
 */
export interface RegistryStore {
  list(): Promise<DaemonRegistryEntry[]> | DaemonRegistryEntry[]
  upsert(entry: DaemonRegistryEntry): Promise<void> | void
  remove(pid: number): Promise<void> | void
}

export class RegistryStoreError extends Error {
  readonly reason: 'corrupt' | 'io'

  constructor(reason: 'corrupt' | 'io', message: string) {
    super(message)
    this.name = 'RegistryStoreError'
    this.reason = reason
  }
}

/** 进程内内存实现；Map 在进程退出时消失，跨进程对账靠文件 / 将来的 PG 实现。 */
export class MemoryRegistryStore implements RegistryStore {
  private readonly map = new Map<number, DaemonRegistryEntry>()

  list(): DaemonRegistryEntry[] {
    return [...this.map.values()].map((entry) => ({ ...entry }))
  }

  upsert(entry: DaemonRegistryEntry): void {
    this.map.set(entry.pid, { ...entry })
  }

  remove(pid: number): void {
    this.map.delete(pid)
  }

  clear(): void {
    this.map.clear()
  }
}

interface PersistedShape {
  readonly v: number
  readonly entries: DaemonRegistryEntry[]
}

/**
 * 本地 JSON 文件台账实现。单文件原子写（tmp + rename，复用 atomic-write 唯一出口）；
 * 文件不存在 ⇒ 空表；JSON 破损 / 形状坏 / 条目校验不过 ⇒ RegistryStoreError('corrupt')，
 * 门面落未判定，绝不把「台账读不出来」渲染成「没有在跑实例」。
 */
export class JsonFileRegistryStore implements RegistryStore {
  constructor(private readonly filePath: string) {}

  list(): DaemonRegistryEntry[] {
    let raw: string
    try {
      raw = fs.readFileSync(this.filePath, 'utf8')
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      if (code === 'ENOENT') return []
      throw new RegistryStoreError('io', `registry-file-read-failed: ${(e as Error).message}`)
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new RegistryStoreError('corrupt', 'registry-file-json-parse-failed')
    }
    if (typeof parsed !== 'object' || parsed === null) {
      throw new RegistryStoreError('corrupt', 'registry-file-shape-invalid')
    }
    const shape = parsed as Record<string, unknown>
    if (shape.v !== REGISTRY_SCHEMA_VERSION || !Array.isArray(shape.entries)) {
      throw new RegistryStoreError('corrupt', 'registry-file-schema-mismatch')
    }
    const entries: DaemonRegistryEntry[] = []
    for (const item of shape.entries) {
      const validation = validateEntry(item)
      if (!validation.ok) throw new RegistryStoreError('corrupt', `registry-entry-${validation.reason}`)
      entries.push(validation.entry)
    }
    return entries
  }

  upsert(entry: DaemonRegistryEntry): void {
    const entries = this.list().filter((existing) => existing.pid !== entry.pid)
    entries.push({ ...entry })
    this.writeAll(entries)
  }

  remove(pid: number): void {
    const entries = this.list().filter((existing) => existing.pid !== pid)
    this.writeAll(entries)
  }

  private writeAll(entries: DaemonRegistryEntry[]): void {
    const payload: PersistedShape = { v: REGISTRY_SCHEMA_VERSION, entries }
    writeFileAtomicSync(this.filePath, JSON.stringify(payload, null, 2), { mode: 0o600 })
  }
}

// ---------------------------------------------------------------------------
// 门面：登记 / 单例探测 / 陈旧回收
// ---------------------------------------------------------------------------

export interface StaleItem {
  readonly entry: DaemonRegistryEntry
  readonly reason: StaleReason
}

export interface UnjudgedItem {
  readonly entry: DaemonRegistryEntry
  readonly reason: UnjudgedReason
}

export interface FindResult {
  readonly status: 'running' | 'none' | 'unjudged'
  readonly entry: DaemonRegistryEntry | null
  readonly stale: readonly StaleItem[]
  readonly unjudged: readonly UnjudgedItem[]
  readonly storeError: string | null
}

export interface PruneReport {
  readonly removed: readonly StaleItem[]
  readonly keptRunning: readonly DaemonRegistryEntry[]
  readonly keptUnjudged: readonly UnjudgedItem[]
  readonly failed: readonly StaleItem[]
}

export class DaemonRegistry {
  constructor(
    private readonly store: RegistryStore,
    private readonly probes: RegistryProbes,
  ) {}

  /** 登记一条；形状不合规不落库，返回具名原因。 */
  register(raw: unknown): EntryValidation {
    const validation = validateEntry(raw)
    if (!validation.ok) return validation
    void this.store.upsert(validation.entry)
    return validation
  }

  /** 启动前查在跑实例：第一条 running 即命中；有未判定条目 ⇒ unjudged，不冒「无实例」。 */
  async findRunning(query: RegistryQuery = {}): Promise<FindResult> {
    let all: DaemonRegistryEntry[]
    try {
      all = await this.store.list()
    } catch (e) {
      return {
        status: 'unjudged',
        entry: null,
        stale: [],
        unjudged: [],
        storeError: e instanceof Error ? e.message : String(e),
      }
    }

    const stale: StaleItem[] = []
    const unjudged: UnjudgedItem[] = []
    let running: DaemonRegistryEntry | null = null

    for (const entry of all) {
      if (query.kind !== undefined && entry.kind !== query.kind) continue
      const verdict = await evaluateEntry(entry, query, this.probes)
      if (verdict.status === 'running') {
        if (running === null) running = verdict.entry
      } else if (verdict.status === 'stale') {
        stale.push({ entry, reason: verdict.reason })
      } else {
        unjudged.push({ entry, reason: verdict.reason })
      }
    }

    if (running !== null) {
      return { status: 'running', entry: running, stale, unjudged, storeError: null }
    }
    if (unjudged.length > 0) {
      return { status: 'unjudged', entry: null, stale, unjudged, storeError: null }
    }
    return { status: 'none', entry: null, stale, unjudged, storeError: null }
  }

  /**
   * 周期 / 启动时回收陈旧条目。只删判据确凿的 stale；unjudged 一律保留（观测不到不动手）；
   * 删除失败进 `failed` 清单，不抛断整批 —— 方向恒为宁可不删，绝不错删。
   */
  async pruneStale(query: RegistryQuery = {}): Promise<PruneReport> {
    const report: {
      removed: StaleItem[]
      keptRunning: DaemonRegistryEntry[]
      keptUnjudged: UnjudgedItem[]
      failed: StaleItem[]
    } = { removed: [], keptRunning: [], keptUnjudged: [], failed: [] }
    let all: DaemonRegistryEntry[]
    try {
      all = await this.store.list()
    } catch (e) {
      // 台账读不到 ⇒ 不删任何条目，错误上交由调用方观测。
      throw e
    }

    for (const entry of all) {
      if (query.kind !== undefined && entry.kind !== query.kind) {
        report.keptRunning.push(entry)
        continue
      }
      const verdict = await evaluateEntry(entry, query, this.probes)
      if (verdict.status === 'running') {
        report.keptRunning.push(entry)
      } else if (verdict.status === 'unjudged') {
        report.keptUnjudged.push({ entry, reason: verdict.reason })
      } else {
        try {
          await this.store.remove(entry.pid)
          report.removed.push({ entry, reason: verdict.reason })
        } catch {
          report.failed.push({ entry, reason: verdict.reason })
        }
      }
    }
    return report
  }
}

// ---------------------------------------------------------------------------
// 默认探针（runner 层副作用实现；判据层只认注入谓词）
// ---------------------------------------------------------------------------

/** 默认存活探针：复用 parent-bound 的 observeProcessAlive 单源（ESRCH=死 / EPERM=活 / 其余=null）。 */
export const defaultAliveProbe: RegistryProbes['isAlive'] = (pid) => observeProcessAlive(pid)

/** 身份谓词工厂：条目身份指纹必须等于当前进程身份；当前身份取不到时由调用方给返回 null 的探针。 */
export function matchIdentityProbe(expectedIdentity: string): RegistryProbes['isIdentityCurrent'] {
  return (entry) => entry.identity === expectedIdentity
}

/**
 * 端口可达探针。connect 成功 ⇒ true；ECONNREFUSED / ENOTFOUND / EHOSTUNREACH /
 * ENETUNREACH ⇒ false；超时或其余异常 ⇒ null（未判定，不把观测不到当成端口不通）。
 */
export function probePortOpen(host: string, port: number, timeoutMs = 1_000): Promise<boolean | null> {
  return new Promise((resolve) => {
    if (typeof host !== 'string' || host.trim() === '') return resolve(null)
    if (!Number.isInteger(port) || port < 1 || port > 65535) return resolve(null)

    let settled = false
    const socket = net.connect(port, host)
    const finish = (value: boolean | null): void => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(value)
    }

    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(null))
    socket.once('error', (err) => {
      const code = (err as NodeJS.ErrnoException).code
      if (
        code === 'ECONNREFUSED' ||
        code === 'ENOTFOUND' ||
        code === 'EHOSTUNREACH' ||
        code === 'ENETUNREACH'
      ) {
        finish(false)
      } else {
        finish(null)
      }
    })
  })
}

/** 本地台账默认路径；env 覆盖便于测试隔离与换机自适应（不写死盘符）。 */
export function defaultRegistryFilePath(): string {
  const env = process.env[REGISTRY_FILE_ENV]
  if (typeof env === 'string' && env.trim() !== '') return env
  return path.join(os.homedir(), '.ihui', 'daemon', 'registry.json')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
