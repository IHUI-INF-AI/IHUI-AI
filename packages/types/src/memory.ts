/**
 * 四层记忆系统跨端契约类型(2026-07-22 立,对标 OpenClaw Mem)。
 *
 * 四层架构:
 * - working:工作记忆(当前会话内存缓冲,不持久化,LRU 上限 50 条)
 * - episodic:情景记忆(历史会话片段,PostgreSQL 持久化 + 遗忘曲线衰减)
 * - semantic:语义记忆(向量检索知识,pgvector 1536 维 + cosine similarity)
 * - procedural:程序记忆(技能/工具用法模式,success/failure 计数)
 *
 * Dream 梦境机制:空闲时把短期记忆 Consolidation 到长期向量库,提取跨会话模式。
 */

/** 记忆层枚举 */
export type MemoryLayer = 'working' | 'episodic' | 'semantic' | 'procedural'

/**
 * 记忆条目(通用接口,跨层共用)。
 *
 * 命名说明:agent-runtime.ts 已存在 MemoryEntry(用户偏好/约定/决策记忆条目,
 * 用于 CLI/api/ai-service 三端 memory sync),本接口为四层记忆系统的 agent 记忆条目,
 * 故命名为 AgentMemoryEntry 以避免命名冲突(2026-07-22 立)。
 */
export interface AgentMemoryEntry {
  id: string
  layer: MemoryLayer
  userId: string
  sessionId?: string
  content: string
  summary?: string
  /** 重要性评分 0-1 */
  importanceScore: number
  /** 衰减因子(遗忘曲线,0-1) */
  decayFactor?: number
  metadata?: Record<string, unknown>
  createdAt: string
  expiresAt?: string
  lastAccessedAt?: string
}

/** 语义检索结果(recall 返回) */
export interface MemoryRecallResult {
  /** 命中的记忆条目(不含 embedding) */
  entry: AgentMemoryEntry
  /** cosine similarity 0-1,越接近 1 越相关 */
  score: number
}

/** 梦境固化结果(dream 返回) */
export interface DreamResult {
  userId: string
  /** 本次固化生成的 semantic_memory 条目数 */
  consolidatedCount: number
  /** 提取的跨会话模式标签 */
  patterns: string[]
  /** 更新的 procedural_memory 条目数 */
  proceduralUpdated: number
  /** 衰减/删除的 episodic_memory 条目数(consolidate 不触发遗忘,固定 0) */
  forgottenCount: number
  /** 梦境主题(LLM 总结) */
  topic: string
  /** 梦境执行耗时(ms) */
  durationMs: number
}

/** 梦境主题(可视化用) */
export interface DreamTopic {
  userId: string
  /** 主题一句话总结 */
  topic: string
  /** 主题标签 */
  tags: string[]
  /** 关联记忆条目数 */
  relatedMemoryCount: number
  /** 生成时间(ISO 8601) */
  generatedAt: string
}

/** 遗忘曲线衰减结果(forget 返回) */
export interface ForgetResult {
  userId: string
  /** 已完全删除(importance < threshold)的条目数 */
  forgottenCount: number
  /** 已衰减(importance 降低但未删除)的条目数 */
  decayedCount: number
  /** 遗忘阈值 */
  threshold: number
}

/** 保存记忆请求 */
export interface MemorySaveRequest {
  userId: string
  content: string
  layer: MemoryLayer
  sessionId?: string
  summary?: string
  importanceScore?: number
  metadata?: Record<string, unknown>
}
