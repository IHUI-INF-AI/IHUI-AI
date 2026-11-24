// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工作区文件监听(2026-11-23 立,对齐 WorkBuddy `/api/v1/fs/watcher/*`)。
 *
 * 本仓原先只有「读一次」的文件桥,没有任何"文件变了告诉我"的通道。这里补的是
 * **有界、可撤销、可补课**的进程内监听:
 *  - 每个 watcher 用 `fs.watch`(Windows 支持递归),事件按单调 `seq` 记账;
 *  - 事件队列有上限,溢出时记 `dropped`,客户端用 `cursor` 续读,不会静默丢事件;
 *  - 每个用户最多 10 个、全局最多 30 个;30 分钟无访问自动回收,避免孤儿持有句柄;
 *  - 只监听登记根内的目录,路径解析复用 FSBridge 的 `resolvePath`,不另造一把尺子。
 *
 * 不提供"事件里带文件内容":事件只是变更通知,读取仍走 `/fs/read` —— 避免把任意
 * 文件内容经监听通道绕过观察态与读前写保护。
 */

import { watch, type FSWatcher } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { relative, sep } from 'node:path'
import { fsBridge } from './workspace-ai-service.js'

export type FsWatchEventType = 'change' | 'rename' | 'error'

export interface FsWatchEvent {
  seq: number
  type: FsWatchEventType
  path: string
  at: number
}

interface WatchEntry {
  id: string
  owner: string
  root: string
  watcher: FSWatcher
  events: FsWatchEvent[]
  nextSeq: number
  dropped: number
  createdAt: number
  lastAccessAt: number
  closed: boolean
  debounce: Map<string, number>
}

export interface CreateWatcherInput {
  owner: string
  path: string
  workspacePath: string
  recursive?: boolean
  debounceMs?: number
}

export interface WatcherEventsInput {
  owner: string
  watcherId: string
  cursor?: number
  limit?: number
  waitMs?: number
}

export class FsWatcherError extends Error {
  constructor(
    message: string,
    readonly code: 'WATCHER_NOT_FOUND' | 'WATCHER_LIMIT' | 'WATCHER_INVALID',
  ) {
    super(message)
    this.name = 'FsWatcherError'
  }
}

const MAX_TOTAL_WATCHERS = 30
const MAX_WATCHERS_PER_OWNER = 10
const MAX_EVENTS = 500
const MAX_LIMIT = 200
const MAX_WAIT_MS = 2_000
const DEFAULT_DEBOUNCE_MS = 40
const IDLE_TTL_MS = 30 * 60 * 1000
const SWEEP_INTERVAL_MS = 5 * 60 * 1000

export class FsWatcherRegistry {
  private readonly entries = new Map<string, WatchEntry>()
  private readonly sweeper: NodeJS.Timeout

  constructor(private readonly now: () => number = Date.now) {
    this.sweeper = setInterval(() => this.sweepIdle(), SWEEP_INTERVAL_MS)
    this.sweeper.unref?.()
  }

  create(input: CreateWatcherInput): { watcherId: string; root: string; recursive: boolean } {
    if (this.entries.size >= MAX_TOTAL_WATCHERS)
      throw new FsWatcherError('监听器数量已达全局上限(30)', 'WATCHER_LIMIT')
    const ownerCount = [...this.entries.values()].filter(
      (e) => e.owner === input.owner && !e.closed,
    ).length
    if (ownerCount >= MAX_WATCHERS_PER_OWNER)
      throw new FsWatcherError('监听器数量已达用户上限(10)', 'WATCHER_LIMIT')

    const recursive = input.recursive !== false
    const root = fsBridge.resolvePath(input.path, input.workspacePath)
    const debounceMs = Math.max(
      0,
      Math.min(500, Math.trunc(input.debounceMs ?? DEFAULT_DEBOUNCE_MS)),
    )
    const id = randomUUID()
    const entry: WatchEntry = {
      id,
      owner: input.owner,
      root,
      watcher: undefined as unknown as FSWatcher,
      events: [],
      nextSeq: 1,
      dropped: 0,
      createdAt: this.now(),
      lastAccessAt: this.now(),
      closed: false,
      debounce: new Map(),
    }

    const watcher = watch(root, { recursive, persistent: false }, (eventType, filename) => {
      const type: FsWatchEventType = eventType === 'change' ? 'change' : 'rename'
      const rel = filename
        ? relative(root, `${root}${sep}${filename.toString()}`).split(sep).join('/')
        : ''
      const key = `${type}:${rel}`
      const last = entry.debounce.get(key) ?? 0
      const at = this.now()
      if (debounceMs > 0 && at - last < debounceMs) return
      entry.debounce.set(key, at)
      this.push(entry, type, rel)
    })
    watcher.on('error', () => this.push(entry, 'error', ''))
    entry.watcher = watcher
    this.entries.set(id, entry)
    return { watcherId: id, root, recursive }
  }

  async events(input: WatcherEventsInput): Promise<{
    events: FsWatchEvent[]
    nextCursor: number
    dropped: number
  }> {
    const entry = this.requireEntry(input.owner, input.watcherId)
    entry.lastAccessAt = this.now()
    const cursor = Math.max(0, Math.trunc(input.cursor ?? 0))
    const limit = Math.max(1, Math.min(MAX_LIMIT, Math.trunc(input.limit ?? 50)))
    const waitMs = Math.max(0, Math.min(MAX_WAIT_MS, Math.trunc(input.waitMs ?? 0)))
    const deadline = this.now() + waitMs
    while (true) {
      const pending = entry.events.filter((e) => e.seq > cursor).slice(0, limit)
      const missed = Math.max(0, (entry.events[0]?.seq ?? entry.nextSeq) - 1 - cursor)
      if (pending.length > 0 || this.now() >= deadline || entry.closed) {
        return {
          events: pending,
          nextCursor: pending.length > 0 ? (pending[pending.length - 1]?.seq ?? cursor) : cursor,
          dropped: entry.dropped + missed,
        }
      }
      // 长轮询:每 25ms 复看一次,上限 2s;不把请求永久挂住
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  }

  remove(owner: string, watcherId: string): { removed: boolean } {
    const entry = this.requireEntry(owner, watcherId)
    this.dispose(entry)
    return { removed: true }
  }

  list(owner: string): Array<{ watcherId: string; root: string; createdAt: number }> {
    return [...this.entries.values()]
      .filter((e) => e.owner === owner && !e.closed)
      .map((e) => ({ watcherId: e.id, root: e.root, createdAt: e.createdAt }))
  }

  closeAll(): void {
    for (const entry of [...this.entries.values()]) this.dispose(entry)
    clearInterval(this.sweeper)
  }

  private push(entry: WatchEntry, type: FsWatchEventType, path: string): void {
    if (entry.closed) return
    if (entry.events.length >= MAX_EVENTS) {
      entry.events.shift()
      entry.dropped += 1
    }
    entry.events.push({ seq: entry.nextSeq++, type, path, at: this.now() })
  }

  private sweepIdle(): void {
    const cutoff = this.now() - IDLE_TTL_MS
    for (const entry of [...this.entries.values()]) {
      if (entry.lastAccessAt < cutoff) this.dispose(entry)
    }
  }

  private dispose(entry: WatchEntry): void {
    if (entry.closed) return
    entry.closed = true
    try {
      entry.watcher.close()
    } catch {
      // 已关闭/平台不支持 close 时忽略:状态已置 closed,不会再产出事件
    }
    this.entries.delete(entry.id)
  }

  private requireEntry(owner: string, watcherId: string): WatchEntry {
    const entry = this.entries.get(watcherId)
    if (!entry || entry.closed || entry.owner !== owner)
      throw new FsWatcherError('监听器不存在或不属于当前用户', 'WATCHER_NOT_FOUND')
    return entry
  }
}

export const fsWatcherRegistry = new FsWatcherRegistry()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
