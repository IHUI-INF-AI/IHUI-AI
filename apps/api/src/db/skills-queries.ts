import { eq, and, desc, sql, ilike } from 'drizzle-orm'
import { db } from './index.js'
import { skills, type Skill } from '@ihui/database'

export async function findPublishedSkills(opts: {
  page: number
  pageSize: number
  search?: string
}): Promise<{ list: Skill[]; total: number; page: number; pageSize: number }> {
  const conds = [eq(skills.isPublished, true), eq(skills.status, 1)]
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
  const rows = await db.select().from(skills).where(eq(skills.id, id)).limit(1)
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
  const rows = await db.update(skills).set(set).where(eq(skills.id, id)).returning()
  return rows[0]
}

export async function deleteSkill(id: string): Promise<void> {
  await db.delete(skills).where(eq(skills.id, id))
}
