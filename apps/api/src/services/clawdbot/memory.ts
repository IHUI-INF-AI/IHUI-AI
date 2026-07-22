/**
 * Clawdbot Memory - 记忆服务
 *
 * 短期记忆、长期记忆、工作记忆管理。
 *
 * 持久化策略(2026-07-22 升级):
 *   - 默认桶(this.memories):无 userId 的系统级调用(self-evolution 等),仅内存
 *   - 用户桶(this.userMemories[userId]):用户短期/工作/情景记忆,会话级 LRU
 *   - long_term:异步持久化到 `user_memories` 表,跨会话/重启可检索
 *   - 同步 API(store/retrieve/search 等)保留兼容,仅操作默认桶
 *   - 异步 API(storeForUser/searchForUser/forgetForUser)操作用户桶 + DB
 */
import { EventEmitter } from 'node:events'
import { and, desc, eq, gte, ilike, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { userMemories } from '@ihui/database'
import { logger } from './logger.js'
import { generateCompactId } from '../../utils/crypto-random.js'

export type MemoryType = 'short_term' | 'long_term' | 'working' | 'episodic'

export interface MemoryItem {
  id: string
  type: MemoryType
  content: string
  metadata?: Record<string, unknown>
  importance: number
  createdAt: number
  lastAccessedAt: number
  accessCount: number
  expiresAt?: number
  tags?: string[]
  embedding?: number[]
}

export interface MemoryQuery {
  type?: MemoryType
  tags?: string[]
  keyword?: string
  limit?: number
  minImportance?: number
}

/** user_memories.memoryType 与 MemoryType 的映射(long_term 持久化) */
const DB_MEMORY_TYPE = 'long_term' as const

/** user_memories.importance 缩放(0-1 → 0-100) */
const scaleImportanceToDb = (v: number): number => Math.round(Math.max(0, Math.min(1, v)) * 100)
const scaleImportanceFromDb = (v: number): number => v / 100

export class MemoryService extends EventEmitter {
  /** 默认桶:系统级调用(无 userId),仅内存 */
  private memories = new Map<string, MemoryItem>()
  /** 用户桶:userId → 记忆 Map(短期/工作/情景,会话级 LRU) */
  private userMemories = new Map<string, Map<string, MemoryItem>>()
  private shortTermTTL = 1000 * 60 * 30
  private maxShortTermItems = 100

  // ============ 同步 API(默认桶,向后兼容)============

  store(item: Omit<MemoryItem, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>): MemoryItem {
    const memory: MemoryItem = {
      ...item,
      // 2026-07-21 安全审计加固:用 CSPRNG 替换 Math.random 生成记忆 ID
      id: generateCompactId('mem'),
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0,
    }
    if (memory.type === 'short_term' && !memory.expiresAt) {
      memory.expiresAt = Date.now() + this.shortTermTTL
    }
    this.memories.set(memory.id, memory)
    this.emit('stored', memory)
    if (memory.type === 'short_term') this.evictShortTerm(this.memories)
    logger.debug({ id: memory.id, type: memory.type }, '[Memory] Stored')
    return memory
  }

  retrieve(id: string): MemoryItem | null {
    const memory = this.memories.get(id)
    if (!memory) return null
    if (memory.expiresAt && memory.expiresAt < Date.now()) {
      this.memories.delete(id)
      return null
    }
    memory.lastAccessedAt = Date.now()
    memory.accessCount++
    return memory
  }

  search(query: MemoryQuery): MemoryItem[] {
    let results = Array.from(this.memories.values())
    if (query.type) results = results.filter((m) => m.type === query.type)
    if (query.minImportance !== undefined)
      results = results.filter((m) => m.importance >= query.minImportance!)
    if (query.tags?.length)
      results = results.filter((m) => query.tags!.some((t) => m.tags?.includes(t)))
    if (query.keyword) {
      const kw = query.keyword.toLowerCase()
      results = results.filter((m) => m.content.toLowerCase().includes(kw))
    }
    results.sort((a, b) => {
      if (b.importance !== a.importance) return b.importance - a.importance
      return b.lastAccessedAt - a.lastAccessedAt
    })
    return results.slice(0, query.limit ?? 10)
  }

  update(id: string, patch: Partial<MemoryItem>): boolean {
    const memory = this.memories.get(id)
    if (!memory) return false
    Object.assign(memory, patch)
    this.emit('updated', memory)
    return true
  }

  forget(id: string): boolean {
    const removed = this.memories.delete(id)
    if (removed) this.emit('forgotten', id)
    return removed
  }

  consolidate(): number {
    const threshold = Date.now() - 1000 * 60 * 60 * 24
    let consolidated = 0
    for (const [, memory] of this.memories) {
      if (memory.type === 'short_term' && memory.createdAt < threshold && memory.importance > 0.5) {
        memory.type = 'long_term'
        memory.expiresAt = undefined
        consolidated++
        this.emit('consolidated', memory)
      }
    }
    logger.info({ consolidated }, '[Memory] Consolidated')
    return consolidated
  }

  private evictShortTerm(bucket: Map<string, MemoryItem>): void {
    const shortTerm = Array.from(bucket.values())
      .filter((m) => m.type === 'short_term')
      .sort((a, b) => a.createdAt - b.createdAt)
    while (shortTerm.length > this.maxShortTermItems) {
      const oldest = shortTerm.shift()!
      bucket.delete(oldest.id)
    }
  }

  getStats() {
    const items = Array.from(this.memories.values())
    return {
      total: items.length,
      byType: {
        short_term: items.filter((m) => m.type === 'short_term').length,
        long_term: items.filter((m) => m.type === 'long_term').length,
        working: items.filter((m) => m.type === 'working').length,
        episodic: items.filter((m) => m.type === 'episodic').length,
      },
    }
  }

  // ============ 异步 API(用户桶 + DB 持久化,2026-07-22 新增)============

  private getBucket(userId: string): Map<string, MemoryItem> {
    let bucket = this.userMemories.get(userId)
    if (!bucket) {
      bucket = new Map()
      this.userMemories.set(userId, bucket)
    }
    return bucket
  }

  /**
   * 为用户存储记忆。
   * - short_term / working / episodic:仅写入用户桶(内存 LRU)
   * - long_term:写入用户桶 + 异步持久化到 user_memories 表
   */
  async storeForUser(
    userId: string,
    item: Omit<MemoryItem, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>,
  ): Promise<MemoryItem> {
    const memory: MemoryItem = {
      ...item,
      id: generateCompactId('mem'),
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0,
    }
    if (memory.type === 'short_term' && !memory.expiresAt) {
      memory.expiresAt = Date.now() + this.shortTermTTL
    }
    const bucket = this.getBucket(userId)
    bucket.set(memory.id, memory)
    if (memory.type === 'short_term') this.evictShortTerm(bucket)
    this.emit('stored', memory)

    if (memory.type === 'long_term') {
      try {
        await db
          .insert(userMemories)
          .values({
            userId,
            memoryType: DB_MEMORY_TYPE,
            content: memory.content,
            importance: scaleImportanceToDb(memory.importance),
            status: 'active',
            metadata: {
              tags: memory.tags ?? [],
              ...(memory.metadata ?? {}),
              internalId: memory.id,
            },
            accessCount: 0,
          })
          .returning({ id: userMemories.id })
        logger.debug({ id: memory.id, userId, type: memory.type }, '[Memory] Persisted to DB')
      } catch (err) {
        logger.warn({ err, id: memory.id, userId }, '[Memory] DB persist failed, memory only')
      }
    } else {
      logger.debug({ id: memory.id, userId, type: memory.type }, '[Memory] Stored (in-memory)')
    }
    return memory
  }

  /**
   * 检索用户记忆(优先内存,miss 时查 DB)。
   */
  async retrieveForUser(userId: string, id: string): Promise<MemoryItem | null> {
    const bucket = this.getBucket(userId)
    const cached = bucket.get(id)
    if (cached) {
      if (cached.expiresAt && cached.expiresAt < Date.now()) {
        bucket.delete(id)
        return null
      }
      cached.lastAccessedAt = Date.now()
      cached.accessCount++
      return cached
    }
    // DB fallback:按 metadata.internalId 查
    try {
      const rows = await db
        .select()
        .from(userMemories)
        .where(
          and(
            eq(userMemories.userId, userId),
            eq(userMemories.memoryType, DB_MEMORY_TYPE),
            eq(userMemories.status, 'active'),
            sql`${userMemories.metadata}->>'internalId' = ${id}`,
          ),
        )
        .limit(1)
      if (rows.length === 0) return null
      const row = rows[0]!
      const item: MemoryItem = {
        id: (row.metadata as { internalId?: string })?.internalId ?? row.id,
        type: 'long_term',
        content: row.content,
        importance: scaleImportanceFromDb(row.importance),
        createdAt: row.createdAt.getTime(),
        lastAccessedAt: row.lastAccessedAt?.getTime() ?? row.createdAt.getTime(),
        accessCount: row.accessCount,
        tags: (row.metadata as { tags?: string[] })?.tags,
        metadata: row.metadata as Record<string, unknown>,
      }
      // 回填内存桶
      bucket.set(item.id, item)
      // 异步更新访问计数(不阻塞读)
      void db
        .update(userMemories)
        .set({ lastAccessedAt: new Date(), accessCount: row.accessCount + 1 })
        .where(eq(userMemories.id, row.id))
      return item
    } catch (err) {
      logger.warn({ err, id, userId }, '[Memory] DB retrieve failed')
      return null
    }
  }

  /**
   * 搜索用户记忆(合并内存 + DB)。
   */
  async searchForUser(userId: string, query: MemoryQuery): Promise<MemoryItem[]> {
    const bucket = this.getBucket(userId)
    const memResults = Array.from(bucket.values()).filter((m) => {
      if (query.type && m.type !== query.type) return false
      if (query.minImportance !== undefined && m.importance < query.minImportance) return false
      if (query.tags?.length && !query.tags.some((t) => m.tags?.includes(t))) return false
      if (query.keyword && !m.content.toLowerCase().includes(query.keyword.toLowerCase()))
        return false
      return true
    })

    // DB 查询 long_term
    const dbResults: MemoryItem[] = []
    try {
      const conditions = [
        eq(userMemories.userId, userId),
        eq(userMemories.memoryType, DB_MEMORY_TYPE),
        eq(userMemories.status, 'active'),
      ]
      if (query.minImportance !== undefined) {
        conditions.push(gte(userMemories.importance, scaleImportanceToDb(query.minImportance)))
      }
      if (query.keyword) {
        conditions.push(ilike(userMemories.content, `%${query.keyword}%`))
      }
      const rows = await db
        .select()
        .from(userMemories)
        .where(and(...conditions))
        .orderBy(desc(userMemories.importance), desc(userMemories.lastAccessedAt))
        .limit(query.limit ?? 50)
      for (const row of rows) {
        dbResults.push({
          id: (row.metadata as { internalId?: string })?.internalId ?? row.id,
          type: 'long_term',
          content: row.content,
          importance: scaleImportanceFromDb(row.importance),
          createdAt: row.createdAt.getTime(),
          lastAccessedAt: row.lastAccessedAt?.getTime() ?? row.createdAt.getTime(),
          accessCount: row.accessCount,
          tags: (row.metadata as { tags?: string[] })?.tags,
          metadata: row.metadata as Record<string, unknown>,
        })
      }
    } catch (err) {
      logger.warn({ err, userId }, '[Memory] DB search failed, returning memory-only results')
    }

    // 合并去重(以 id 为准,内存优先)
    const seen = new Set(memResults.map((m) => m.id))
    const merged = [...memResults, ...dbResults.filter((m) => !seen.has(m.id))]
    merged.sort((a, b) => {
      if (b.importance !== a.importance) return b.importance - a.importance
      return b.lastAccessedAt - a.lastAccessedAt
    })
    return merged.slice(0, query.limit ?? 10)
  }

  /**
   * 更新用户记忆(内存 + DB)。
   */
  async updateForUser(
    userId: string,
    id: string,
    patch: Partial<MemoryItem>,
  ): Promise<boolean> {
    const bucket = this.getBucket(userId)
    const memory = bucket.get(id)
    if (memory) {
      Object.assign(memory, patch)
      this.emit('updated', memory)
    }
    // DB 更新(content/importance/tags 变更时)
    try {
      const dbPatch: Record<string, unknown> = {}
      if (patch.content !== undefined) dbPatch.content = patch.content
      if (patch.importance !== undefined) dbPatch.importance = scaleImportanceToDb(patch.importance)
      if (patch.tags !== undefined || patch.metadata !== undefined) {
        const existing = memory?.metadata ?? {}
        const existingTags = memory?.tags ?? []
        dbPatch.metadata = {
          ...existing,
          tags: patch.tags ?? existingTags,
          ...(patch.metadata ?? {}),
          internalId: id,
        }
      }
      if (Object.keys(dbPatch).length > 0) {
        dbPatch.lastAccessedAt = new Date()
        await db
          .update(userMemories)
          .set(dbPatch)
          .where(
            and(
              eq(userMemories.userId, userId),
              eq(userMemories.memoryType, DB_MEMORY_TYPE),
              sql`${userMemories.metadata}->>'internalId' = ${id}`,
            ),
          )
      }
      return memory !== undefined
    } catch (err) {
      logger.warn({ err, id, userId }, '[Memory] DB update failed')
      return memory !== undefined
    }
  }

  /**
   * 遗忘用户记忆(内存 + DB 软删除:status → forgotten)。
   */
  async forgetForUser(userId: string, id: string): Promise<boolean> {
    const bucket = this.getBucket(userId)
    const removed = bucket.delete(id)
    try {
      await db
        .update(userMemories)
        .set({ status: 'forgotten' })
        .where(
          and(
            eq(userMemories.userId, userId),
            eq(userMemories.memoryType, DB_MEMORY_TYPE),
            sql`${userMemories.metadata}->>'internalId' = ${id}`,
          ),
        )
      if (removed) this.emit('forgotten', id)
      return removed
    } catch (err) {
      logger.warn({ err, id, userId }, '[Memory] DB forget failed')
      return removed
    }
  }

  /**
   * 整合用户记忆:将 24h 前高重要性的 short_term 升级为 long_term 并持久化。
   */
  async consolidateForUser(userId: string): Promise<number> {
    const bucket = this.getBucket(userId)
    const threshold = Date.now() - 1000 * 60 * 60 * 24
    let consolidated = 0
    for (const [, memory] of bucket) {
      if (memory.type === 'short_term' && memory.createdAt < threshold && memory.importance > 0.5) {
        memory.type = 'long_term'
        memory.expiresAt = undefined
        consolidated++
        this.emit('consolidated', memory)
        // 持久化到 DB
        try {
          await db
            .insert(userMemories)
            .values({
              userId,
              memoryType: DB_MEMORY_TYPE,
              content: memory.content,
              importance: scaleImportanceToDb(memory.importance),
              status: 'active',
              metadata: {
                tags: memory.tags ?? [],
                ...(memory.metadata ?? {}),
                internalId: memory.id,
              },
              accessCount: memory.accessCount,
            })
            .onConflictDoNothing()
        } catch (err) {
          logger.warn({ err, id: memory.id, userId }, '[Memory] DB consolidate failed')
        }
      }
    }
    if (consolidated > 0) {
      logger.info({ consolidated, userId }, '[Memory] Consolidated for user')
    }
    return consolidated
  }

  /**
   * 用户记忆统计(内存 + DB 总数)。
   */
  async getStatsForUser(userId: string): Promise<{
    total: number
    byType: Record<MemoryType, number>
  }> {
    const bucket = this.getBucket(userId)
    const memItems = Array.from(bucket.values())
    const byType: Record<MemoryType, number> = {
      short_term: 0,
      long_term: 0,
      working: 0,
      episodic: 0,
    }
    for (const m of memItems) byType[m.type]++
    // DB long_term 计数(去重内存中已有的)
    try {
      const rows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(userMemories)
        .where(
          and(
            eq(userMemories.userId, userId),
            eq(userMemories.memoryType, DB_MEMORY_TYPE),
            eq(userMemories.status, 'active'),
          ),
        )
      const dbLongTerm = rows[0]?.count ?? 0
      // 内存中的 long_term 已包含部分 DB 数据,取 max 避免重复计数
      byType.long_term = Math.max(byType.long_term, dbLongTerm)
    } catch (err) {
      logger.warn({ err, userId }, '[Memory] DB stats failed')
    }
    return {
      total: byType.short_term + byType.long_term + byType.working + byType.episodic,
      byType,
    }
  }
}

let instance: MemoryService | null = null

export function getMemoryService(): MemoryService {
  if (!instance) instance = new MemoryService()
  return instance
}
