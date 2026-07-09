import { eq, and, desc, sql, ilike } from 'drizzle-orm';
import { db } from './index.js';
import {
  scheduleTasks,
  scheduleLogs,
  type ScheduleTask,
  type ScheduleLog,
} from '@ihui/database';

// =============================================================================
// Tasks 定时任务
// =============================================================================

export interface FindScheduleTasksOpts {
  page: number;
  pageSize: number;
  enabled?: boolean;
  name?: string;
}

/**
 * 任务列表(分页)，按 priority 降序、id 降序。
 */
export async function findScheduleTasks(
  opts: FindScheduleTasksOpts,
): Promise<{ list: ScheduleTask[]; total: number; page: number; pageSize: number }> {
  const conds = [];
  if (opts.enabled !== undefined) conds.push(eq(scheduleTasks.enabled, opts.enabled));
  if (opts.name) conds.push(ilike(scheduleTasks.name, `%${opts.name}%`));
  const where = conds.length ? and(...conds) : undefined;

  const [list, countRows] = await Promise.all([
    db
      .select()
      .from(scheduleTasks)
      .where(where)
      .orderBy(desc(scheduleTasks.priority), desc(scheduleTasks.id))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(scheduleTasks).where(where),
  ]);
  return { list, total: countRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize };
}

export async function findScheduleTaskById(id: string): Promise<ScheduleTask | undefined> {
  const rows = await db.select().from(scheduleTasks).where(eq(scheduleTasks.id, id)).limit(1);
  return rows[0];
}

export interface CreateScheduleTaskInput {
  name: string;
  cronExpression: string;
  description?: string | null;
  targetService?: string | null;
  targetMethod?: string | null;
  parameters?: string | null;
  priority?: number;
  maxRetryCount?: number;
  timeout?: number;
  enabled?: boolean;
}

export async function createScheduleTask(data: CreateScheduleTaskInput): Promise<ScheduleTask> {
  const rows = await db
    .insert(scheduleTasks)
    .values({
      name: data.name,
      cronExpression: data.cronExpression,
      description: data.description,
      targetService: data.targetService,
      targetMethod: data.targetMethod,
      parameters: data.parameters,
      priority: data.priority,
      maxRetryCount: data.maxRetryCount,
      timeout: data.timeout,
      enabled: data.enabled,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建定时任务失败');
  return row;
}

export interface UpdateScheduleTaskInput {
  name?: string;
  cronExpression?: string;
  description?: string | null;
  targetService?: string | null;
  targetMethod?: string | null;
  parameters?: string | null;
  priority?: number;
  maxRetryCount?: number;
  timeout?: number;
  enabled?: boolean;
}

export async function updateScheduleTask(
  id: string,
  data: UpdateScheduleTaskInput,
): Promise<ScheduleTask | undefined> {
  const rows = await db
    .update(scheduleTasks)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.cronExpression !== undefined ? { cronExpression: data.cronExpression } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.targetService !== undefined ? { targetService: data.targetService } : {}),
      ...(data.targetMethod !== undefined ? { targetMethod: data.targetMethod } : {}),
      ...(data.parameters !== undefined ? { parameters: data.parameters } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.maxRetryCount !== undefined ? { maxRetryCount: data.maxRetryCount } : {}),
      ...(data.timeout !== undefined ? { timeout: data.timeout } : {}),
      ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
      updatedAt: new Date(),
    })
    .where(eq(scheduleTasks.id, id))
    .returning();
  return rows[0];
}

export async function deleteScheduleTask(id: string): Promise<void> {
  await db.delete(scheduleTasks).where(eq(scheduleTasks.id, id));
}

/**
 * 设置任务启用状态。
 */
export async function setScheduleTaskEnabled(
  id: string,
  enabled: boolean,
): Promise<ScheduleTask | undefined> {
  const rows = await db
    .update(scheduleTasks)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(scheduleTasks.id, id))
    .returning();
  return rows[0];
}

/**
 * 立即触发任务执行：更新 lastRun 信息并写入一条 running 日志。
 * 返回更新后的任务与新建的日志。
 */
export async function runScheduleTaskNow(
  id: string,
): Promise<{ task: ScheduleTask; log: ScheduleLog } | undefined> {
  const task = await findScheduleTaskById(id);
  if (!task) return undefined;
  const now = new Date();
  const [updated] = await db
    .update(scheduleTasks)
    .set({
      lastRunTime: now,
      lastRunStatus: 'running',
      lastRunMessage: '手动触发执行',
      updatedAt: now,
    })
    .where(eq(scheduleTasks.id, id))
    .returning();
  const logRows = await db
    .insert(scheduleLogs)
    .values({
      taskId: task.id,
      taskName: task.name,
      status: 'running',
      startTime: now,
      message: '手动触发执行',
    })
    .returning();
  const log = logRows[0];
  if (!updated || !log) return undefined;
  return { task: updated, log };
}

// =============================================================================
// Logs 执行日志
// =============================================================================

export interface FindScheduleLogsOpts {
  page: number;
  pageSize: number;
  taskId?: string;
  status?: string;
}

/**
 * 日志列表(分页)，按 id 降序。
 */
export async function findScheduleLogs(
  opts: FindScheduleLogsOpts,
): Promise<{ list: ScheduleLog[]; total: number; page: number; pageSize: number }> {
  const conds = [];
  if (opts.taskId) conds.push(eq(scheduleLogs.taskId, opts.taskId));
  if (opts.status) conds.push(eq(scheduleLogs.status, opts.status));
  const where = conds.length ? and(...conds) : undefined;

  const [list, countRows] = await Promise.all([
    db
      .select()
      .from(scheduleLogs)
      .where(where)
      .orderBy(desc(scheduleLogs.id))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(scheduleLogs).where(where),
  ]);
  return { list, total: countRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize };
}

export async function findScheduleLogById(id: string): Promise<ScheduleLog | undefined> {
  const rows = await db.select().from(scheduleLogs).where(eq(scheduleLogs.id, id)).limit(1);
  return rows[0];
}
