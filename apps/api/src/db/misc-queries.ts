// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { eq, and, desc, asc, sql, ilike } from 'drizzle-orm'
import { db } from './index.js'
import { plazaItems, cozeVariables, type PlazaItem, type CozeVariable } from '@ihui/database'

// =============================================================================
// PlazaItems - 需求广场智能体条目
// =============================================================================

export async function findPlazaItemList(opts?: {
  status?: string
  search?: string
  page?: number
  pageSize?: number
}): Promise<{ list: PlazaItem[]; total: number; page: number; pageSize: number }> {
  const page = opts?.page ?? 1
  const pageSize = opts?.pageSize ?? 20
  const conds = []
  if (opts?.status) conds.push(eq(plazaItems.status, opts.status))
  if (opts?.search) conds.push(ilike(plazaItems.title, `%${opts.search}%`))
  const where = conds.length ? and(...conds) : undefined
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(plazaItems)
      .where(where)
      .orderBy(asc(plazaItems.sort), desc(plazaItems.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(plazaItems)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page, pageSize }
}

// =============================================================================
// CozeVariables - Coze 变量
// =============================================================================

export async function findCozeVariableList(opts?: {
  botId?: string
  search?: string
  page?: number
  pageSize?: number
}): Promise<{ list: CozeVariable[]; total: number; page: number; pageSize: number }> {
  const page = opts?.page ?? 1
  const pageSize = opts?.pageSize ?? 20
  const conds = []
  if (opts?.botId) conds.push(eq(cozeVariables.botId, opts.botId))
  if (opts?.search) conds.push(ilike(cozeVariables.variableName, `%${opts.search}%`))
  const where = conds.length ? and(...conds) : undefined
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(cozeVariables)
      .where(where)
      // F-356: createdAt 同毫秒并列时补 id 兜底,保证 LIMIT/OFFSET 翻页全序稳定
      .orderBy(desc(cozeVariables.createdAt), desc(cozeVariables.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(cozeVariables)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page, pageSize }
}

export async function findCozeVariableByName(
  name: string,
  botId?: string,
): Promise<CozeVariable | undefined> {
  const conds = [eq(cozeVariables.variableName, name)]
  if (botId) conds.push(eq(cozeVariables.botId, botId))
  const rows = await db
    .select()
    .from(cozeVariables)
    .where(and(...conds))
    // F-355:不带 botId 时同名变量可能跨 bot 命中多行,旧写法 `.limit(1)` 无 ORDER BY
    // ⇒ 返回哪一行由物理顺序决定(含密钥类值时等于随机给出旧值/别人的值)。
    // 按「最近更新优先」取唯一一行,平局用 id 兜底,读数可复现。
    // 带 botId 时该 (bot_id, variable_name) 已有唯一约束,排序不改变命中行。
    .orderBy(desc(cozeVariables.updatedAt), desc(cozeVariables.id))
    .limit(1)
  return rows[0]
}

export interface CreateCozeVariableInput {
  botId: string
  variableName: string
  variableValue?: string | null
  description?: string | null
  dataType?: string
}

export async function createCozeVariable(data: CreateCozeVariableInput): Promise<CozeVariable> {
  // F-355:同一 bot 的变量名是逻辑主键。(bot_id, variable_name) 唯一索引 + 冲突即更新,
  // 把「任意登录管理员连点两次 create」从落两行改成覆盖同一行 —— 旧行为下 retrieve
  // 会在这两行里随机取一行,同名变量(可能是密钥)读到哪个值不确定。
  // 未传的字段不覆盖(undefined 在 SET 里被略过),只刷新 updated_at。
  const rows = await db
    .insert(cozeVariables)
    .values({
      botId: data.botId,
      variableName: data.variableName,
      variableValue: data.variableValue,
      description: data.description,
      dataType: data.dataType,
    })
    .onConflictDoUpdate({
      target: [cozeVariables.botId, cozeVariables.variableName],
      set: {
        variableValue: data.variableValue,
        description: data.description,
        dataType: data.dataType,
        updatedAt: new Date(),
      },
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建 Coze 变量失败')
  return row
}

export interface UpdateCozeVariableInput {
  variableName?: string
  variableValue?: string | null
  description?: string | null
  dataType?: string
}

export async function updateCozeVariable(
  id: string,
  data: UpdateCozeVariableInput,
): Promise<CozeVariable | undefined> {
  const set: Record<string, unknown> = {}
  if (data.variableName !== undefined) set.variableName = data.variableName
  if (data.variableValue !== undefined) set.variableValue = data.variableValue
  if (data.description !== undefined) set.description = data.description
  if (data.dataType !== undefined) set.dataType = data.dataType
  set.updatedAt = new Date()
  const rows = await db.update(cozeVariables).set(set).where(eq(cozeVariables.id, id)).returning()
  return rows[0]
}

export async function deleteCozeVariable(id: string): Promise<void> {
  await db.delete(cozeVariables).where(eq(cozeVariables.id, id))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
