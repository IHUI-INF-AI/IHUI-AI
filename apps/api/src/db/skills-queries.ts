import { eq, and, desc, sql, ilike, isNull, isNotNull } from 'drizzle-orm'
import { db } from './index.js'
import { skills, type Skill } from '@ihui/database'

/**
 * 软删除(tombstone)说明:
 * - deleteSkill / deleteSkillsByAuthorAndSlugs 改为 UPDATE SET deletedAt = NOW()
 * - 查询活跃 skills 时统一加 isNull(deletedAt) 过滤
 * - findSkillsByUserId 用于同步,返回所有(含已软删除),CLI 据此删本地文件
 * - upsertSkillBySlug 处理"复活":若 existing 已软删除且新 contentHash 不同,清空 deletedAt
 */

export async function findPublishedSkills(opts: {
  page: number
  pageSize: number
  search?: string
}): Promise<{ list: Skill[]; total: number; page: number; pageSize: number }> {
  const conds = [eq(skills.isPublished, true), eq(skills.status, 1), isNull(skills.deletedAt)]
  if (opts.search) conds.push(ilike(skills.name, `%${opts.search}%`))
  const where = and(...conds)
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(skills)
      .where(where)
      .orderBy(desc(skills.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(skills)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize }
}

export async function findSkillById(id: string): Promise<Skill | undefined> {
  const rows = await db
    .select()
    .from(skills)
    .where(and(eq(skills.id, id), isNull(skills.deletedAt)))
    .limit(1)
  return rows[0]
}

export interface CreateSkillInput {
  name: string
  description?: string | null
  icon?: string | null
  categoryId?: string | null
  difficulty?: number
  content?: string | null
  authorId?: string | null
  isPublished?: boolean
  status?: number
}

export async function createSkill(data: CreateSkillInput): Promise<Skill> {
  const rows = await db
    .insert(skills)
    .values({
      name: data.name,
      description: data.description,
      icon: data.icon,
      categoryId: data.categoryId,
      difficulty: data.difficulty,
      content: data.content,
      authorId: data.authorId,
      isPublished: data.isPublished,
      status: data.status,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建技能失败')
  return row
}

export interface UpdateSkillInput {
  name?: string
  description?: string | null
  icon?: string | null
  categoryId?: string | null
  difficulty?: number
  content?: string | null
  isPublished?: boolean
  status?: number
}

export async function updateSkill(id: string, data: UpdateSkillInput): Promise<Skill | undefined> {
  const set: Record<string, unknown> = {}
  if (data.name !== undefined) set.name = data.name
  if (data.description !== undefined) set.description = data.description
  if (data.icon !== undefined) set.icon = data.icon
  if (data.categoryId !== undefined) set.categoryId = data.categoryId
  if (data.difficulty !== undefined) set.difficulty = data.difficulty
  if (data.content !== undefined) set.content = data.content
  if (data.isPublished !== undefined) set.isPublished = data.isPublished
  if (data.status !== undefined) set.status = data.status
  set.updatedAt = new Date()
  const rows = await db
    .update(skills)
    .set(set)
    .where(and(eq(skills.id, id), isNull(skills.deletedAt)))
    .returning()
  return rows[0]
}

/**
 * 软删除 skill(tombstone):不物理删除,仅设 deletedAt = NOW()
 * 多端同步时 CLI 据此删本地文件
 */
export async function deleteSkill(id: string): Promise<void> {
  await db
    .update(skills)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(skills.id, id), isNull(skills.deletedAt)))
}

// ==================== 同步相关查询 ====================

/**
 * 查询某用户的所有 skills(不限 isPublished,含已软删除的,用于同步)
 * CLI 拉取后根据 deletedAt 决定是否删本地文件
 */
export async function findSkillsByUserId(userId: string): Promise<Skill[]> {
  return db.select().from(skills).where(eq(skills.authorId, userId))
}

/** 按 (userId, slug) 精确查找(含已软删除的,用于 upsert 判断是否复活) */
export async function findSkillByAuthorAndSlug(
  authorId: string,
  slug: string,
): Promise<Skill | undefined> {
  const rows = await db
    .select()
    .from(skills)
    .where(and(eq(skills.authorId, authorId), eq(skills.slug, slug)))
    .limit(1)
  return rows[0]
}

/** 同步 upsert 输入 */
export interface SyncUpsertInput {
  slug: string
  name: string
  description?: string | null
  content?: string | null
  contentHash?: string | null
  isPublished?: boolean
  syncSource?: 'web' | 'cli' | 'api'
  authorId: string
}

/**
 * 同步 upsert:按 (authorId, slug) 判存,存在则更新,不存在则创建
 * 处理"复活":若 existing 已软删除且新 contentHash 不同,清空 deletedAt(用户重新推送相同内容不复活)
 */
export async function upsertSkillBySlug(data: SyncUpsertInput): Promise<{
  skill: Skill
  action: 'created' | 'updated' | 'unchanged'
}> {
  const existing = await findSkillByAuthorAndSlug(data.authorId, data.slug)
  const now = new Date()

  // 已存在且内容 hash 相同(含已软删除的):跳过,保留原状态(不自动复活)
  if (existing && data.contentHash && existing.contentHash === data.contentHash) {
    return { skill: existing, action: 'unchanged' }
  }

  if (existing) {
    // 已存在但内容不同:更新内容,若已软删除则复活(清空 deletedAt)
    const rows = await db
      .update(skills)
      .set({
        name: data.name,
        description: data.description,
        content: data.content,
        contentHash: data.contentHash,
        lastSyncedAt: now,
        syncSource: data.syncSource ?? 'cli',
        updatedAt: now,
        deletedAt: null, // 复活:内容变更即视为重新启用
      })
      .where(eq(skills.id, existing.id))
      .returning()
    const updated = rows[0]
    if (!updated) throw new Error('更新技能失败')
    return { skill: updated, action: 'updated' }
  }

  const rows = await db
    .insert(skills)
    .values({
      slug: data.slug,
      name: data.name,
      description: data.description,
      content: data.content,
      contentHash: data.contentHash,
      lastSyncedAt: now,
      syncSource: data.syncSource ?? 'cli',
      authorId: data.authorId,
      isPublished: data.isPublished ?? false,
    })
    .returning()
  const created = rows[0]
  if (!created) throw new Error('创建技能失败')
  return { skill: created, action: 'created' }
}

/**
 * 按 slug 列表批量软删除(tombstone):用于 CLI sync 时本地不存在的远端 skill
 * 只软删除当前未软删除的,已软删除的跳过
 */
export async function deleteSkillsByAuthorAndSlugs(
  authorId: string,
  slugs: string[],
): Promise<number> {
  if (slugs.length === 0) return 0
  const result = await db
    .update(skills)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(skills.authorId, authorId),
        isNull(skills.deletedAt),
        sql`${skills.slug} = ANY(${sql.raw(`ARRAY[${slugs.map((s) => `'${s.replace(/'/g, "''")}'`).join(',')}]::text[]`)})`,
      ),
    )
    .returning({ id: skills.id })
  return result.length
}

/**
 * 查询某用户已软删除的 skills(用于同步时返回 tombstone 列表)
 * 可选 since 参数:只返回 deletedAt >= since 的(增量同步)
 */
export async function findDeletedSkillsByUserId(userId: string, since?: Date): Promise<Skill[]> {
  const conds = [eq(skills.authorId, userId), isNotNull(skills.deletedAt)]
  if (since) conds.push(sql`${skills.deletedAt} >= ${since}`)
  return db
    .select()
    .from(skills)
    .where(and(...conds))
}
