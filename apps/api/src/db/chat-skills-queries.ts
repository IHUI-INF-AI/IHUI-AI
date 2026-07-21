import { eq, and, asc, desc, sql } from 'drizzle-orm'
import { db } from './index.js'
import { userChatSkills } from '@ihui/database'

/**
 * 用户自定义 AI 对话框技能 queries
 * 业务:AI 对话框 Skill 库统一面板支撑用户 CRUD
 * 关联 API:GET/POST/PATCH/DELETE /api/chat/skills (apps/api/src/routes/chat-skills.ts)
 */

export interface ChatSkillInput {
  name: string
  category?: string
  scenario?: string
  prompt: string
  icon?: string | null
  sortOrder?: number
  enabled?: boolean
}

export interface ChatSkillRow {
  id: string
  userId: string
  name: string
  category: string
  scenario: string
  prompt: string
  icon: string | null
  sortOrder: number
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

const rowFields = {
  id: userChatSkills.id,
  userId: userChatSkills.userId,
  name: userChatSkills.name,
  category: userChatSkills.category,
  scenario: userChatSkills.scenario,
  prompt: userChatSkills.prompt,
  icon: userChatSkills.icon,
  sortOrder: userChatSkills.sortOrder,
  enabled: userChatSkills.enabled,
  createdAt: userChatSkills.createdAt,
  updatedAt: userChatSkills.updatedAt,
}

/** 列出当前用户的所有技能(按 sortOrder ASC + createdAt DESC)。 */
export async function listChatSkills(
  userId: string,
  options?: { onlyEnabled?: boolean },
): Promise<ChatSkillRow[]> {
  const conds = [eq(userChatSkills.userId, userId)]
  if (options?.onlyEnabled) {
    conds.push(eq(userChatSkills.enabled, true))
  }
  return db
    .select(rowFields)
    .from(userChatSkills)
    .where(and(...conds))
    .orderBy(asc(userChatSkills.sortOrder), desc(userChatSkills.createdAt))
}

/** 按 ID 查一条(供 PATCH/DELETE 校验归属)。 */
export async function findChatSkillById(
  id: string,
): Promise<ChatSkillRow | undefined> {
  const rows = await db.select(rowFields).from(userChatSkills).where(eq(userChatSkills.id, id)).limit(1)
  return rows[0]
}

/** 创建一条技能。 */
export async function createChatSkill(
  userId: string,
  input: ChatSkillInput,
): Promise<ChatSkillRow> {
  const rows = await db
    .insert(userChatSkills)
    .values({
      userId,
      name: input.name,
      category: input.category ?? 'custom',
      scenario: input.scenario ?? 'custom',
      prompt: input.prompt,
      icon: input.icon ?? null,
      sortOrder: input.sortOrder ?? 0,
      enabled: input.enabled ?? true,
    })
    .returning(rowFields)
  if (!rows[0]) throw new Error('创建技能失败')
  return rows[0]
}

/** 更新一条技能(仅传入的字段会被修改)。 */
export async function updateChatSkill(
  id: string,
  userId: string,
  patch: Partial<ChatSkillInput>,
): Promise<ChatSkillRow | undefined> {
  const updateValues: Record<string, unknown> = { updatedAt: new Date() }
  if (patch.name !== undefined) updateValues.name = patch.name
  if (patch.category !== undefined) updateValues.category = patch.category
  if (patch.scenario !== undefined) updateValues.scenario = patch.scenario
  if (patch.prompt !== undefined) updateValues.prompt = patch.prompt
  if (patch.icon !== undefined) updateValues.icon = patch.icon
  if (patch.sortOrder !== undefined) updateValues.sortOrder = patch.sortOrder
  if (patch.enabled !== undefined) updateValues.enabled = patch.enabled

  const rows = await db
    .update(userChatSkills)
    .set(updateValues)
    .where(and(eq(userChatSkills.id, id), eq(userChatSkills.userId, userId)))
    .returning(rowFields)
  return rows[0]
}

/** 删除一条技能(按 (id, userId) 联合条件,防止越权)。 */
export async function deleteChatSkill(id: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(userChatSkills)
    .where(and(eq(userChatSkills.id, id), eq(userChatSkills.userId, userId)))
    .returning({ id: userChatSkills.id })
  return result.length > 0
}

/** 统计当前用户的技能数(限流/配额场景,暂未使用,保留扩展位)。 */
export async function countChatSkills(userId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userChatSkills)
    .where(eq(userChatSkills.userId, userId))
  return rows[0]?.count ?? 0
}
