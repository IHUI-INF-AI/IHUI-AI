/**
 * OpenClaw Memory System
 * 
 * 基于 Markdown 的持久化记忆系统:
 * - 每日笔记 (Daily Notes): memory/YYYY-MM-DD.md
 * - 长期记忆 (Long-term Memory): MEMORY.md
 * - 可搜索的记忆存储
 * - 上下文管理
 * 
 * 参考: https://docs.clawd.bot/memory
 */

import { ref, reactive } from 'vue'
import { logger } from '@/utils/logger'
import { EventEmitter } from '@/utils/event-emitter'

/**
 * 记忆条目
 */
export interface MemoryEntry {
  id: string
  type: MemoryType
  content: string
  metadata: MemoryMetadata
  embedding?: number[]
  createdAt: number
  updatedAt: number
}

/**
 * 记忆类型
 */
export type MemoryType = 
  | 'fact'           // 客观事实
  | 'preference'     // 用户偏好
  | 'event'          // 发生的事件
  | 'conversation'   // 对话记录
  | 'skill'          // 学习的技能
  | 'project'        // 进行中的项目
  | 'lesson'         // 经验教训
  | 'person'         // 人物信息
  | 'place'          // 地点信息
  | 'custom'         // 自定义

/**
 * 记忆元数据
 */
export interface MemoryMetadata {
  source?: string
  tags?: string[]
  importance?: 'low' | 'medium' | 'high' | 'critical'
  context?: string
  relatedIds?: string[]
  sessionId?: string
  userId?: string
  expiresAt?: number
}

/**
 * 每日笔记
 */
export interface DailyNote {
  date: string // YYYY-MM-DD
  entries: DailyNoteEntry[]
  summary?: string
  createdAt: number
  updatedAt: number
}

/**
 * 每日笔记条目
 */
export interface DailyNoteEntry {
  id: string
  time: string // HH:mm:ss
  type: 'activity' | 'decision' | 'learning' | 'note' | 'task' | 'reminder'
  content: string
  metadata?: Record<string, unknown>
}

/**
 * 长期记忆文件结构
 */
export interface LongTermMemory {
  version: string
  lastUpdated: number
  sections: {
    preferences: MemoryEntry[]
    facts: MemoryEntry[]
    projects: MemoryEntry[]
    people: MemoryEntry[]
    lessons: MemoryEntry[]
    skills: MemoryEntry[]
    custom: MemoryEntry[]
  }
}

/**
 * 记忆搜索选项
 */
export interface MemorySearchOptions {
  query: string
  types?: MemoryType[]
  tags?: string[]
  dateRange?: { start: number; end: number }
  limit?: number
  threshold?: number
  useEmbedding?: boolean
}

/**
 * 记忆搜索结果
 */
export interface MemorySearchResult {
  entry: MemoryEntry
  score: number
  highlights?: string[]
}

/**
 * 记忆系统配置
 */
export interface MemoryConfig {
  /** 存储路径 */
  storagePath?: string
  /** 最大记忆条目数 */
  maxEntries?: number
  /** 是否启用向量搜索 */
  enableEmbedding?: boolean
  /** 嵌入模型 */
  embeddingModel?: string
  /** 自动整理间隔 (ms) */
  consolidationInterval?: number
  /** 自动清理过期记忆 */
  autoCleanup?: boolean
}

/**
 * 记忆管理器
 */
export class MemoryManager extends EventEmitter {
  private config: Required<MemoryConfig>
  private memories = reactive<Map<string, MemoryEntry>>(new Map())
  private dailyNotes = reactive<Map<string, DailyNote>>(new Map())
  private longTermMemory = ref<LongTermMemory | null>(null)
  
  private initialized = ref(false)
  private consolidationTimer: ReturnType<typeof setInterval> | null = null

  constructor(config: MemoryConfig = {}) {
    super()
    this.config = {
      storagePath: config.storagePath || 'memory',
      maxEntries: config.maxEntries || 10000,
      enableEmbedding: config.enableEmbedding ?? true,
      embeddingModel: config.embeddingModel || 'text-embedding-ada-002',
      consolidationInterval: config.consolidationInterval || 24 * 60 * 60 * 1000, // 24小时
      autoCleanup: config.autoCleanup ?? true,
    }
  }

  /**
   * 初始化记忆系统
   */
  async initialize(): Promise<void> {
    if (this.initialized.value) return

    logger.info('[Memory] Initializing memory system...')

    // 加载持久化数据
    await this.loadFromStorage()

    // 加载今日笔记
    await this.loadTodayNote()

    // 启动自动整理
    if (this.config.consolidationInterval > 0) {
      this.startConsolidation()
    }

    this.initialized.value = true
    logger.info('[Memory] Memory system initialized')
    this.emit('initialized')
  }

  /**
   * 从存储加载数据
   */
  private async loadFromStorage(): Promise<void> {
    try {
      // 从 localStorage 加载
      const memoriesData = localStorage.getItem('openclaw_memories')
      if (memoriesData) {
        const parsed = JSON.parse(memoriesData)
        for (const [key, value] of Object.entries(parsed)) {
          this.memories.set(key, value as MemoryEntry)
        }
      }

      const longTermData = localStorage.getItem('openclaw_longterm_memory')
      if (longTermData) {
        this.longTermMemory.value = JSON.parse(longTermData)
      } else {
        this.longTermMemory.value = this.createEmptyLongTermMemory()
      }

      logger.info(`[Memory] Loaded memories`)
    } catch (error) {
      logger.error('[Memory] Failed to load storage data:', error)
    }
  }

  /**
   * 创建空的长期记忆结构
   */
  private createEmptyLongTermMemory(): LongTermMemory {
    return {
      version: '1.0.0',
      lastUpdated: Date.now(),
      sections: {
        preferences: [],
        facts: [],
        projects: [],
        people: [],
        lessons: [],
        skills: [],
        custom: [],
      },
    }
  }

  /**
   * 加载今日笔记
   */
  private async loadTodayNote(): Promise<void> {
    const today = this.getDateString(new Date())
    const yesterday = this.getDateString(new Date(Date.now() - 24 * 60 * 60 * 1000))

    // 加载今天和昨天的笔记
    for (const date of [today, yesterday]) {
      const noteData = localStorage.getItem(`openclaw_daily_${date}`)
      if (noteData) {
        this.dailyNotes.set(date, JSON.parse(noteData))
      }
    }
  }

  /**
   * 获取日期字符串
   */
  private getDateString(date: Date): string {
    return date.toISOString().split('T')[0]
  }

  /**
   * 获取时间字符串
   */
  private getTimeString(date: Date): string {
    return date.toISOString().split('T')[1].split('.')[0]
  }

  /**
   * 保存到存储
   */
  private async saveToStorage(): Promise<void> {
    try {
      // 保存记忆
      const memoriesObj: Record<string, MemoryEntry> = {}
      this.memories.forEach((value, key) => {
        memoriesObj[key] = value
      })
      localStorage.setItem('openclaw_memories', JSON.stringify(memoriesObj))

      // 保存长期记忆
      if (this.longTermMemory.value) {
        localStorage.setItem('openclaw_longterm_memory', JSON.stringify(this.longTermMemory.value))
      }

      // 保存每日笔记
      this.dailyNotes.forEach((note, date) => {
        localStorage.setItem(`openclaw_daily_${date}`, JSON.stringify(note))
      })
    } catch (error) {
      logger.error('[Memory] Failed to save storage data:', error)
    }
  }

  /**
   * 添加记忆
   */
  async addMemory(
    content: string,
    type: MemoryType,
    metadata: Partial<MemoryMetadata> = {}
  ): Promise<MemoryEntry> {
    const id = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const now = Date.now()

    const entry: MemoryEntry = {
      id,
      type,
      content,
      metadata: {
        importance: 'medium',
        ...metadata,
      },
      createdAt: now,
      updatedAt: now,
    }

    // 生成嵌入向量
    if (this.config.enableEmbedding) {
      entry.embedding = await this.generateEmbedding(content)
    }

    this.memories.set(id, entry)

    // 同时记录到每日笔记
    await this.addToDailyNote(content, 'note')

    // 保存
    await this.saveToStorage()

    logger.debug(`[Memory] Adding memory: ${id}`)
    this.emit('memoryAdded', entry)

    return entry
  }

  /**
   * 添加到每日笔记
   */
  async addToDailyNote(
    content: string,
    type: DailyNoteEntry['type'] = 'note',
    metadata?: Record<string, unknown>
  ): Promise<DailyNoteEntry> {
    const today = this.getDateString(new Date())
    const now = new Date()

    let note = this.dailyNotes.get(today)
    if (!note) {
      note = {
        date: today,
        entries: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      this.dailyNotes.set(today, note)
    }

    const entry: DailyNoteEntry = {
      id: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      time: this.getTimeString(now),
      type,
      content,
      metadata,
    }

    note.entries.push(entry)
    note.updatedAt = Date.now()

    await this.saveToStorage()

    logger.debug(`[Memory] Adding daily note entry: ${entry.id}`)
    this.emit('dailyNoteAdded', { date: today, entry })

    return entry
  }

  /**
   * 生成嵌入向量（模拟）
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // 实际实现应调用嵌入模型 API
    // 这里返回简单的哈希向量作为模拟
    const hash = text.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0)
    }, 0)

    const embedding: number[] = []
    for (let i = 0; i < 384; i++) {
      embedding.push(Math.sin(hash * (i + 1)) * 0.5 + 0.5)
    }

    return embedding
  }

  /**
   * 搜索记忆
   */
  async search(options: MemorySearchOptions): Promise<MemorySearchResult[]> {
    const {
      query,
      types,
      tags,
      dateRange,
      limit = 10,
      threshold = 0.5,
      useEmbedding = this.config.enableEmbedding,
    } = options

    let results: MemorySearchResult[] = []

    // 遍历所有记忆
    for (const entry of this.memories.values()) {
      // 类型过滤
      if (types && !types.includes(entry.type)) continue

      // 标签过滤
      if (tags && entry.metadata.tags) {
        const hasTag = tags.some(tag => entry.metadata.tags?.includes(tag))
        if (!hasTag) continue
      }

      // 日期范围过滤
      if (dateRange) {
        if (entry.createdAt < dateRange.start || entry.createdAt > dateRange.end) continue
      }

      // 计算相似度
      let score: number

      if (useEmbedding && entry.embedding) {
        const queryEmbedding = await this.generateEmbedding(query)
        score = this.cosineSimilarity(queryEmbedding, entry.embedding)
      } else {
        score = this.textSimilarity(query, entry.content)
      }

      if (score >= threshold) {
        results.push({
          entry,
          score,
          highlights: this.extractHighlights(query, entry.content),
        })
      }
    }

    // 按分数排序
    results.sort((a, b) => b.score - a.score)

    // 限制返回数量
    results = results.slice(0, limit)

    return results
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  /**
   * 文本相似度（简单实现）
   */
  private textSimilarity(query: string, text: string): number {
    const queryWords = query.toLowerCase().split(/\s+/)
    const textWords = text.toLowerCase().split(/\s+/)
    
    let matches = 0
    for (const word of queryWords) {
      if (textWords.some(tw => tw.includes(word) || word.includes(tw))) {
        matches++
      }
    }

    return matches / queryWords.length
  }

  /**
   * 提取高亮片段
   */
  private extractHighlights(query: string, text: string): string[] {
    const highlights: string[] = []
    const queryWords = query.toLowerCase().split(/\s+/)
    const sentences = text.split(/[.!?。！？]/)

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase()
      for (const word of queryWords) {
        if (lowerSentence.includes(word)) {
          highlights.push(sentence.trim())
          break
        }
      }
    }

    return highlights.slice(0, 3)
  }

  /**
   * 获取记忆
   */
  getMemory(id: string): MemoryEntry | undefined {
    return this.memories.get(id)
  }

  /**
   * 更新记忆
   */
  async updateMemory(id: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry | null> {
    const entry = this.memories.get(id)
    if (!entry) return null

    const updated: MemoryEntry = {
      ...entry,
      ...updates,
      id: entry.id, // 保持原 ID
      updatedAt: Date.now(),
    }

    // 如果内容变了，重新生成嵌入
    if (updates.content && updates.content !== entry.content && this.config.enableEmbedding) {
      updated.embedding = await this.generateEmbedding(updates.content)
    }

    this.memories.set(id, updated)
    await this.saveToStorage()

    this.emit('memoryUpdated', updated)
    return updated
  }

  /**
   * 删除记忆
   */
  async deleteMemory(id: string): Promise<boolean> {
    const deleted = this.memories.delete(id)
    if (deleted) {
      await this.saveToStorage()
      this.emit('memoryDeleted', id)
    }
    return deleted
  }

  /**
   * 获取所有记忆
   */
  getAllMemories(): MemoryEntry[] {
    return Array.from(this.memories.values())
  }

  /**
   * 按类型获取记忆
   */
  getMemoriesByType(type: MemoryType): MemoryEntry[] {
    return this.getAllMemories().filter(m => m.type === type)
  }

  /**
   * 获取每日笔记
   */
  getDailyNote(date: string): DailyNote | undefined {
    return this.dailyNotes.get(date)
  }

  /**
   * 获取今日笔记
   */
  getTodayNote(): DailyNote | undefined {
    return this.getDailyNote(this.getDateString(new Date()))
  }

  /**
   * 获取最近的每日笔记
   */
  getRecentNotes(days: number = 7): DailyNote[] {
    const notes: DailyNote[] = []
    const today = new Date()

    for (let i = 0; i < days; i++) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
      const dateStr = this.getDateString(date)
      const note = this.dailyNotes.get(dateStr)
      if (note) notes.push(note)
    }

    return notes
  }

  /**
   * 导出每日笔记为 Markdown
   */
  exportDailyNoteAsMarkdown(date: string): string {
    const note = this.dailyNotes.get(date)
    if (!note) return ''

    let markdown = `# 每日笔记 - ${date}\n\n`

    if (note.summary) {
      markdown += `## 摘要\n${note.summary}\n\n`
    }

    markdown += `## 活动记录\n\n`

    for (const entry of note.entries) {
      const typeEmoji = {
        activity: '🔵',
        decision: '⚡',
        learning: '📚',
        note: '📝',
        task: '✅',
        reminder: '⏰',
      }[entry.type] || '•'

      markdown += `- ${typeEmoji} **${entry.time}** [${entry.type}] ${entry.content}\n`
    }

    return markdown
  }

  /**
   * 获取长期记忆
   */
  getLongTermMemory(): LongTermMemory | null {
    return this.longTermMemory.value
  }

  /**
   * 提升记忆到长期记忆
   */
  async promoteToLongTerm(memoryId: string, section: keyof LongTermMemory['sections']): Promise<boolean> {
    const entry = this.memories.get(memoryId)
    if (!entry || !this.longTermMemory.value) return false

    // 更新重要性
    entry.metadata.importance = 'high'

    // 添加到长期记忆对应分区
    this.longTermMemory.value.sections[section].push(entry)
    this.longTermMemory.value.lastUpdated = Date.now()

    await this.saveToStorage()

    logger.info(`[Memory] Memory promoted to long-term memory`)
    this.emit('memoryPromoted', { memoryId, section })

    return true
  }

  /**
   * 导出长期记忆为 Markdown
   */
  exportLongTermMemoryAsMarkdown(): string {
    if (!this.longTermMemory.value) return ''

    const mem = this.longTermMemory.value
    let markdown = `# MEMORY.md\n\n`
    markdown += `> 最后更新: ${new Date(mem.lastUpdated).toLocaleString()}\n\n`

    const sectionNames: Record<string, string> = {
      preferences: '## 偏好设置',
      facts: '## 重要事实',
      projects: '## 进行中的项目',
      people: '## 联系人',
      lessons: '## 经验教训',
      skills: '## 技能知识',
      custom: '## 其他',
    }

    for (const [key, entries] of Object.entries(mem.sections)) {
      if (entries.length === 0) continue

      markdown += `${sectionNames[key] || `## ${key}`}\n\n`

      for (const entry of entries as MemoryEntry[]) {
        markdown += `- ${entry.content}`
        if (entry.metadata.tags && entry.metadata.tags.length > 0) {
          markdown += ` (${entry.metadata.tags.join(', ')})`
        }
        markdown += '\n'
      }

      markdown += '\n'
    }

    return markdown
  }

  /**
   * 启动自动整理
   */
  private startConsolidation(): void {
    this.consolidationTimer = setInterval(async () => {
      await this.consolidateMemories()
    }, this.config.consolidationInterval)
  }

  /**
   * 整理记忆
   */
  async consolidateMemories(): Promise<void> {
    logger.info('[Memory] Starting memory consolidation...')

    // 清理过期记忆
    if (this.config.autoCleanup) {
      const now = Date.now()
      for (const [id, entry] of this.memories) {
        if (entry.metadata.expiresAt && entry.metadata.expiresAt < now) {
          this.memories.delete(id)
        }
      }
    }

    // 限制记忆数量
    if (this.memories.size > this.config.maxEntries) {
      const entries = Array.from(this.memories.entries())
        .sort((a, b) => {
          // 按重要性和时间排序
          const importanceOrder = { critical: 0, high: 1, medium: 2, low: 3 }
          const aImportance = importanceOrder[a[1].metadata.importance || 'medium']
          const bImportance = importanceOrder[b[1].metadata.importance || 'medium']
          if (aImportance !== bImportance) return aImportance - bImportance
          return b[1].updatedAt - a[1].updatedAt
        })

      // 保留最重要的记忆
      const toKeep = entries.slice(0, this.config.maxEntries)
      this.memories.clear()
      for (const [id, entry] of toKeep) {
        this.memories.set(id, entry)
      }
    }

    // 生成每日笔记摘要
    const today = this.getDateString(new Date())
    const todayNote = this.dailyNotes.get(today)
    if (todayNote && todayNote.entries.length > 5 && !todayNote.summary) {
      todayNote.summary = await this.generateNoteSummary(todayNote)
    }

    await this.saveToStorage()

    logger.info('[Memory] Memory consolidation completed')
    this.emit('consolidated')
  }

  /**
   * 生成笔记摘要
   */
  private async generateNoteSummary(note: DailyNote): Promise<string> {
    // 实际实现应调用 LLM 生成摘要
    const activities = note.entries.filter(e => e.type === 'activity').length
    const decisions = note.entries.filter(e => e.type === 'decision').length
    const tasks = note.entries.filter(e => e.type === 'task').length

    return `今日记录: ${note.entries.length} 条 (活动: ${activities}, 决策: ${decisions}, 任务: ${tasks})`
  }

  /**
   * 获取上下文记忆
   */
  async getContextMemory(context: string, limit: number = 10): Promise<MemoryEntry[]> {
    const results = await this.search({
      query: context,
      limit,
      threshold: 0.3,
    })
    return results.map(r => r.entry)
  }

  /**
   * 清除所有记忆
   */
  async clearAll(): Promise<void> {
    this.memories.clear()
    this.dailyNotes.clear()
    this.longTermMemory.value = this.createEmptyLongTermMemory()

    // 清除存储
    const keys = Object.keys(localStorage).filter(k => k.startsWith('openclaw_'))
    for (const key of keys) {
      localStorage.removeItem(key)
    }

    logger.info('[Memory] All memories cleared')
    this.emit('cleared')
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalMemories: number
    byType: Record<MemoryType, number>
    dailyNotes: number
    longTermItems: number
  } {
    const byType: Record<string, number> = {}
    for (const entry of this.memories.values()) {
      byType[entry.type] = (byType[entry.type] || 0) + 1
    }

    let longTermItems = 0
    if (this.longTermMemory.value) {
      for (const entries of Object.values(this.longTermMemory.value.sections)) {
        longTermItems += entries.length
      }
    }

    return {
      totalMemories: this.memories.size,
      byType: byType as Record<MemoryType, number>,
      dailyNotes: this.dailyNotes.size,
      longTermItems,
    }
  }

  /**
   * 关闭记忆系统
   */
  async shutdown(): Promise<void> {
    if (this.consolidationTimer) {
      clearInterval(this.consolidationTimer)
      this.consolidationTimer = null
    }

    await this.saveToStorage()
    this.initialized.value = false

    logger.info('[Memory] Memory system shut down')
    this.emit('shutdown')
  }
}

// 单例实例
let memoryManagerInstance: MemoryManager | null = null

/**
 * 获取记忆管理器实例
 */
export function getMemoryManager(config?: MemoryConfig): MemoryManager {
  if (!memoryManagerInstance) {
    memoryManagerInstance = new MemoryManager(config)
  }
  return memoryManagerInstance
}

export default MemoryManager
