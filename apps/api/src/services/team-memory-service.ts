// © 2026 IHUI AI (智汇AI) · 版权所有者:李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

/**
 * 团队共享记忆服务 (2026-09-08 新增,对标竞品团队知识引擎)
 *
 * 提供跨用户共享的项目知识层 CRUD + 检索:
 * - 隔离维度是 scopeId(teamId 或 workspaceKey),而非 userId
 * - kind:decision | convention | pitfall | fingerprint
 * - tags 以逗号分隔文本存储,检索时 LIKE 过滤
 *
 * 全部走 apps/api 的 db 连接池(读副本自动回退)。仅供 /api/team-memory 路由调用。
 */

import { and, desc, eq, like, or } from 'drizzle-orm'
import { teamMemories, type TeamMemory, type TeamMemoryKind } from '@ihui/database'
import { db } from '../db/index.js'

// =============================================================================
// 类型
// =============================================================================

/** 对外 DTO:tags 以数组呈现(存储为逗号分隔文本) */
export interface TeamMemoryDTO {
  id: string
  scopeId: string
  kind: TeamMemoryKind
  title: string
  content: string
  tags: string[]
  sourceUserId: string | null
  createdAt: string
  updatedAt: string
}

/** 列表过滤条件 */
export interface ListTeamMemoryFilter {
  scopeId: string
  kind?: TeamMemoryKind
  /** 标签过滤(子串匹配,逗号分隔文本中的单个标签) */
  tag?: string
  /** 关键词:匹配 title / content / tags */
  keyword?: string
  limit?: number
}

/** 创建入参 */
export interface CreateTeamMemoryInput {
  scopeId: string
  kind: TeamMemoryKind
  title: string
  content: string
  tags: string[]
  sourceUserId: string | null
}

/** 更新入参(局部,scopeId 不可变) */
export interface UpdateTeamMemoryInput {
  kind?: TeamMemoryKind
  title?: string
  content?: string
  tags?: string[]
}

// =============================================================================
// 内部辅助
// =============================================================================

/** 存储层:标签数组 → 逗号分隔文本 */
function tagsToString(tags: string[]): string {
  return tags
    .map((t) => t.trim())
    .filter(Boolean)
    .join(',')
}

/** 存储层:逗号分隔文本 → 标签数组 */
function tagsToArray(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

/** DTO 转换:原始行 → 对外结构(时间格式化为 ISO 字符串) */
export function toTeamMemoryDTO(row: TeamMemory): TeamMemoryDTO {
  return {
    id: row.id,
    scopeId: row.scopeId,
    kind: row.kind as TeamMemoryKind,
    title: row.title,
    content: row.content,
    tags: tagsToArray(row.tags),
    sourceUserId: row.sourceUserId,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  }
}

/** 构造列表查询的 WHERE 条件(始终按 scopeId 隔离) */
function buildListWhere(filter: ListTeamMemoryFilter) {
  const conditions = [eq(teamMemories.scopeId, filter.scopeId)]
  if (filter.kind) {
    conditions.push(eq(teamMemories.kind, filter.kind))
  }
  if (filter.tag) {
    conditions.push(like(teamMemories.tags, `%${filter.tag}%`))
  }
  if (filter.keyword) {
    const kw = `%${filter.keyword}%`
    conditions.push(
      or(
        like(teamMemories.title, kw),
        like(teamMemories.content, kw),
        like(teamMemories.tags, kw),
      )!,
    )
  }
  return and(...conditions)
}

// =============================================================================
// CRUD
// =============================================================================

/** 列出某 scope 下的记忆(支持 kind/tag/keyword 过滤,按更新时间倒序) */
export async function listTeamMemories(filter: ListTeamMemoryFilter): Promise<TeamMemoryDTO[]> {
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500)
  const rows = await db
    .select()
    .from(teamMemories)
    .where(buildListWhere(filter))
    .orderBy(desc(teamMemories.updatedAt))
    .limit(limit)
  return rows.map(toTeamMemoryDTO)
}

/** 按 id 获取单条(不存在返回 undefined) */
export async function getTeamMemory(id: string): Promise<TeamMemoryDTO | undefined> {
  const [row] = await db.select().from(teamMemories).where(eq(teamMemories.id, id)).limit(1)
  return row ? toTeamMemoryDTO(row) : undefined
}

/** 创建一条记忆(返回创建后的 DTO;插入失败理论上不可能,兜底抛错) */
export async function createTeamMemory(input: CreateTeamMemoryInput): Promise<TeamMemoryDTO> {
  const [row] = await db
    .insert(teamMemories)
    .values({
      scopeId: input.scopeId,
      kind: input.kind,
      title: input.title,
      content: input.content,
      tags: tagsToString(input.tags),
      sourceUserId: input.sourceUserId,
    })
    .returning()
  if (!row) throw new Error('createTeamMemory: insert returned no row')
  return toTeamMemoryDTO(row)
}

/** 更新一条记忆(仅可变字段;返回更新后 DTO,不存在返回 undefined) */
export async function updateTeamMemory(
  id: string,
  patch: UpdateTeamMemoryInput,
): Promise<TeamMemoryDTO | undefined> {
  const setValues: Partial<{
    kind: TeamMemoryKind
    title: string
    content: string
    tags: string
    updatedAt: Date
  }> = { updatedAt: new Date() }
  if (patch.kind !== undefined) setValues.kind = patch.kind
  if (patch.title !== undefined) setValues.title = patch.title
  if (patch.content !== undefined) setValues.content = patch.content
  if (patch.tags !== undefined) setValues.tags = tagsToString(patch.tags)

  const [row] = await db
    .update(teamMemories)
    .set(setValues)
    .where(eq(teamMemories.id, id))
    .returning()
  return row ? toTeamMemoryDTO(row) : undefined
}

/** 删除一条记忆(返回是否删除成功) */
export async function deleteTeamMemory(id: string): Promise<boolean> {
  const deleted = await db
    .delete(teamMemories)
    .where(eq(teamMemories.id, id))
    .returning({ id: teamMemories.id })
  return deleted.length > 0
}
