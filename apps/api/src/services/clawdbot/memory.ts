/**
 * Clawdbot Memory - 记忆服务
 *
 * 短期记忆、长期记忆、工作记忆管理。
 */
import { EventEmitter } from 'node:events'
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

export class MemoryService extends EventEmitter {
  /** 内存记忆存储 — 需后续建表持久化(userMemories 表需 userId,当前接口未传 userId) */
  private memories = new Map<string, MemoryItem>()
  private shortTermTTL = 1000 * 60 * 30
  private maxShortTermItems = 100

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
    if (memory.type === 'short_term') this.evictShortTerm()
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

  private evictShortTerm(): void {
    const shortTerm = Array.from(this.memories.values())
      .filter((m) => m.type === 'short_term')
      .sort((a, b) => a.createdAt - b.createdAt)
    while (shortTerm.length > this.maxShortTermItems) {
      const oldest = shortTerm.shift()!
      this.memories.delete(oldest.id)
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
}

let instance: MemoryService | null = null

export function getMemoryService(): MemoryService {
  if (!instance) instance = new MemoryService()
  return instance
}
