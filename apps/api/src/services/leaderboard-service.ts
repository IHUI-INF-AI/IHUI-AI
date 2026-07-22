/**
 * 大模型排行榜服务层。
 *
 * 参考 arena.ai 排行榜,提供:
 * - listLeaderboard:按分类(overall/llm/image/video/multimodal/audio/embedding/agent)查询排行榜
 * - getLeaderboardEntry:查询单个模型详情(capabilities JSON.parse)
 *
 * 设计原则:
 * - 函数式,与项目现有 service 风格一致(ai-feed-service.ts)
 * - 读路径直接走 db 查询,按 arenaRank 排序
 * - capabilities 字段存储为 JSON 字符串,返回时 parse 为对象
 */

import { eq, and, asc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { modelLeaderboard } from '@ihui/database'

// =============================================================================
// 类型定义
// =============================================================================

export interface ListLeaderboardOpts {
  /** 分类:overall(总榜)/ llm / image / video / multimodal / audio / embedding / agent */
  category?: string
  /** LLM 子类:general / coding / reasoning(仅 category=llm 时有效) */
  subcategory?: string
  /** 返回条数,默认 20,最大 100 */
  limit?: number
}

/** capabilities 五维能力评分(0-100) */
export interface Capabilities {
  coding: number
  math: number
  reasoning: number
  creative: number
  chinese: number
}

/** 排行榜条目(capabilities 已 parse 为对象) */
export interface LeaderboardEntry {
  id: string
  modelId: string
  modelName: string
  vendor: string
  category: string
  subcategory: string | null
  arenaScore: number | null
  arenaRank: number | null
  rankDelta: number | null
  rankSpreadLow: number | null
  rankSpreadHigh: number | null
  scoreCi: number | null
  winRate: number | null
  voteCount: number | null
  contextWindow: string | null
  maxOutput: string | null
  inputPrice: string | null
  outputPrice: string | null
  releaseDate: string | null
  highlight: string | null
  capabilities: Capabilities | null
  license: string
  isOverall: boolean
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export interface LeaderboardResult {
  list: LeaderboardEntry[]
  total: number
  category: string
  subcategory: string | null
}

// =============================================================================
// 内部工具
// =============================================================================

/** 将数据库行转换为 LeaderboardEntry(capabilities JSON.parse) */
function toEntry(row: typeof modelLeaderboard.$inferSelect): LeaderboardEntry {
  let capabilities: Capabilities | null = null
  if (row.capabilities) {
    try {
      capabilities = JSON.parse(row.capabilities) as Capabilities
    } catch {
      capabilities = null
    }
  }
  return {
    ...row,
    capabilities,
  }
}

// =============================================================================
// 查询函数
// =============================================================================

/**
 * 查询排行榜列表。
 *
 * - category 不传或 'overall' → 查 isOverall=true(总榜)
 * - category 传具体类 → 查 category=X AND isOverall=false,可选 subcategory 筛选
 * - 按 arenaRank 升序排序(1=第一)
 * - limit 默认 20,最大 100
 */
export async function listLeaderboard(opts: ListLeaderboardOpts): Promise<LeaderboardResult> {
  const category = opts.category ?? 'overall'
  const subcategory = opts.subcategory ?? null
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100)

  const conds = []
  if (category === 'overall') {
    // 总榜:查 isOverall=true
    conds.push(eq(modelLeaderboard.isOverall, true))
  } else {
    // 具体分类:查 category=X AND isOverall=false
    conds.push(eq(modelLeaderboard.category, category))
    conds.push(eq(modelLeaderboard.isOverall, false))
    if (subcategory) {
      conds.push(eq(modelLeaderboard.subcategory, subcategory))
    }
  }

  const where = conds.length > 1 ? and(...conds) : conds[0]!

  const rows = await db
    .select()
    .from(modelLeaderboard)
    .where(where)
    .orderBy(asc(modelLeaderboard.arenaRank))
    .limit(limit)

  return {
    list: rows.map(toEntry),
    total: rows.length,
    category,
    subcategory,
  }
}

/**
 * 查询单个模型详情(按 modelId)。
 *
 * 返回 capabilities 已 parse 为对象的 LeaderboardEntry,未找到返回 null。
 */
export async function getLeaderboardEntry(modelId: string): Promise<LeaderboardEntry | null> {
  const rows = await db
    .select()
    .from(modelLeaderboard)
    .where(eq(modelLeaderboard.modelId, modelId))
    .orderBy(asc(modelLeaderboard.arenaRank))
    .limit(1)

  return rows[0] ? toEntry(rows[0]) : null
}
