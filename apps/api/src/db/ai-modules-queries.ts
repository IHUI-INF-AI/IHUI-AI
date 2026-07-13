import { eq, and, desc, asc, sql, ne } from 'drizzle-orm'
import { db } from './index.js'
import {
  aiIndexBanners,
  aiTeamMembers,
  aiConversations,
  aiAigcTasks,
  aiExtCapabilities,
  aiExtReports,
  type AiConversation,
  type AiAigcTask,
  type AiExtCapability,
  type AiExtReport,
  type AiTeamMember,
  type AiIndexBanner,
} from '@ihui/database'

export async function findAiIndexBanners(): Promise<AiIndexBanner[]> {
  return db
    .select()
    .from(aiIndexBanners)
    .where(eq(aiIndexBanners.status, 1))
    .orderBy(asc(aiIndexBanners.sort), asc(aiIndexBanners.createdAt))
}

export async function findAiTeamMembers(opts: {
  page: number
  pageSize: number
  search?: string
}): Promise<{ list: AiTeamMember[]; total: number; page: number; pageSize: number }> {
  const conds = [eq(aiTeamMembers.status, 1)]
  const where = and(...conds)
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(aiTeamMembers)
      .where(where)
      .orderBy(asc(aiTeamMembers.sort), asc(aiTeamMembers.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiTeamMembers)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize }
}

export async function findAiTeamMemberById(id: string): Promise<AiTeamMember | undefined> {
  const rows = await db.select().from(aiTeamMembers).where(eq(aiTeamMembers.id, id)).limit(1)
  return rows[0]
}

export async function createAiConversation(data: {
  userId: string
  title?: string | null
  modelId?: string | null
}): Promise<AiConversation> {
  const rows = await db
    .insert(aiConversations)
    .values({
      userId: data.userId,
      title: data.title,
      modelId: data.modelId,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建会话失败')
  return row
}

export async function findAiConversations(opts: {
  userId: string
  page: number
  pageSize: number
}): Promise<{ list: AiConversation[]; total: number; page: number; pageSize: number }> {
  const where = eq(aiConversations.userId, opts.userId)
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(aiConversations)
      .where(where)
      .orderBy(desc(aiConversations.updatedAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiConversations)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize }
}

export async function deleteAiConversation(
  id: string,
  userId: string,
): Promise<AiConversation | undefined> {
  const rows = await db
    .delete(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)))
    .returning()
  return rows[0]
}

export async function updateAiAigcTaskStatus(
  taskId: string,
  userId: string,
  status: number,
): Promise<AiAigcTask | undefined> {
  const set: Record<string, unknown> = { status }
  if (status === 2) set.completedAt = new Date()
  const rows = await db
    .update(aiAigcTasks)
    .set(set)
    .where(
      and(eq(aiAigcTasks.id, taskId), eq(aiAigcTasks.userId, userId), ne(aiAigcTasks.status, 2)),
    )
    .returning()
  return rows[0]
}

export async function toggleAiExtCapability(id: string): Promise<AiExtCapability | undefined> {
  const rows = await db
    .select({ enabled: aiExtCapabilities.enabled })
    .from(aiExtCapabilities)
    .where(eq(aiExtCapabilities.id, id))
    .limit(1)
  const current = rows[0]
  if (!current) return undefined
  const updated = await db
    .update(aiExtCapabilities)
    .set({ enabled: !current.enabled })
    .where(eq(aiExtCapabilities.id, id))
    .returning()
  return updated[0]
}

export async function findAiExtReports(opts: {
  userId: string
  page: number
  pageSize: number
}): Promise<{ list: AiExtReport[]; total: number; page: number; pageSize: number }> {
  const where = eq(aiExtReports.userId, opts.userId)
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(aiExtReports)
      .where(where)
      .orderBy(desc(aiExtReports.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiExtReports)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize }
}

export async function createAiExtReport(data: {
  userId: string
  type: string
  content?: string | null
}): Promise<AiExtReport> {
  const rows = await db
    .insert(aiExtReports)
    .values({
      userId: data.userId,
      type: data.type,
      content: data.content,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建报告失败')
  return row
}
