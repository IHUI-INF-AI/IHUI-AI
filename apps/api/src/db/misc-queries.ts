import { eq, and, desc, asc, sql, ilike } from 'drizzle-orm';
import { db } from './index.js';
import {
  plazaItems,
  cozeVariables,
  type PlazaItem,
  type CozeVariable,
} from '@ihui/database';

// =============================================================================
// PlazaItems - 需求广场智能体条目
// =============================================================================

export async function findPlazaItemList(opts?: {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ list: PlazaItem[]; total: number; page: number; pageSize: number }> {
  const page = opts?.page ?? 1;
  const pageSize = opts?.pageSize ?? 20;
  const conds = [];
  if (opts?.status) conds.push(eq(plazaItems.status, opts.status));
  if (opts?.search) conds.push(ilike(plazaItems.title, `%${opts.search}%`));
  const where = conds.length ? and(...conds) : undefined;
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(plazaItems)
      .where(where)
      .orderBy(asc(plazaItems.sort), desc(plazaItems.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(plazaItems).where(where),
  ]);
  return { list, total: totalRows[0]?.count ?? 0, page, pageSize };
}

// =============================================================================
// CozeVariables - Coze 变量
// =============================================================================

export async function findCozeVariableList(opts?: {
  botId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ list: CozeVariable[]; total: number; page: number; pageSize: number }> {
  const page = opts?.page ?? 1;
  const pageSize = opts?.pageSize ?? 20;
  const conds = [];
  if (opts?.botId) conds.push(eq(cozeVariables.botId, opts.botId));
  if (opts?.search) conds.push(ilike(cozeVariables.variableName, `%${opts.search}%`));
  const where = conds.length ? and(...conds) : undefined;
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(cozeVariables)
      .where(where)
      .orderBy(desc(cozeVariables.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(cozeVariables).where(where),
  ]);
  return { list, total: totalRows[0]?.count ?? 0, page, pageSize };
}

export async function findCozeVariableByName(
  name: string,
  botId?: string,
): Promise<CozeVariable | undefined> {
  const conds = [eq(cozeVariables.variableName, name)];
  if (botId) conds.push(eq(cozeVariables.botId, botId));
  const rows = await db
    .select()
    .from(cozeVariables)
    .where(and(...conds))
    .limit(1);
  return rows[0];
}

export interface CreateCozeVariableInput {
  botId: string;
  variableName: string;
  variableValue?: string | null;
  description?: string | null;
  dataType?: string;
}

export async function createCozeVariable(data: CreateCozeVariableInput): Promise<CozeVariable> {
  const rows = await db
    .insert(cozeVariables)
    .values({
      botId: data.botId,
      variableName: data.variableName,
      variableValue: data.variableValue,
      description: data.description,
      dataType: data.dataType,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建 Coze 变量失败');
  return row;
}

export interface UpdateCozeVariableInput {
  variableName?: string;
  variableValue?: string | null;
  description?: string | null;
  dataType?: string;
}

export async function updateCozeVariable(
  id: string,
  data: UpdateCozeVariableInput,
): Promise<CozeVariable | undefined> {
  const set: Record<string, unknown> = {};
  if (data.variableName !== undefined) set.variableName = data.variableName;
  if (data.variableValue !== undefined) set.variableValue = data.variableValue;
  if (data.description !== undefined) set.description = data.description;
  if (data.dataType !== undefined) set.dataType = data.dataType;
  set.updatedAt = new Date();
  const rows = await db.update(cozeVariables).set(set).where(eq(cozeVariables.id, id)).returning();
  return rows[0];
}

export async function deleteCozeVariable(id: string): Promise<void> {
  await db.delete(cozeVariables).where(eq(cozeVariables.id, id));
}
