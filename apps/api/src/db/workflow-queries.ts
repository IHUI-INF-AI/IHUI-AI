import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { db } from './index.js';
import {
  workflows,
  workflowInstances,
  workflowTasks,
  workflowLogs,
  type Workflow,
  type WorkflowInstance,
  type WorkflowTask,
  type WorkflowLog,
} from '@ihui/database';

// =============================================================================
// Workflows
// =============================================================================

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  triggerType: string;
  triggerConfig?: unknown;
  steps: unknown;
  createdBy: string;
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  triggerType?: string;
  triggerConfig?: unknown;
  steps?: unknown;
  isActive?: boolean;
}

export async function createWorkflow(data: CreateWorkflowInput): Promise<Workflow> {
  const rows = await db
    .insert(workflows)
    .values({
      name: data.name,
      description: data.description,
      triggerType: data.triggerType,
      triggerConfig: data.triggerConfig as never,
      steps: data.steps as never,
      createdBy: data.createdBy,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建工作流失败');
  return row;
}

export async function findWorkflows(
  opts: { page: number; pageSize: number },
): Promise<{ list: Workflow[]; total: number }> {
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(workflows)
      .orderBy(desc(workflows.updatedAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ count: sql<number>`COUNT(*)` }).from(workflows),
  ]);
  return { list, total: Number(totalRows[0]?.count ?? 0) };
}

export async function findWorkflowById(id: string): Promise<Workflow | undefined> {
  const rows = await db.select().from(workflows).where(eq(workflows.id, id)).limit(1);
  return rows[0];
}

export async function updateWorkflow(
  id: string,
  data: UpdateWorkflowInput,
): Promise<Workflow | undefined> {
  const rows = await db
    .update(workflows)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.triggerType !== undefined && { triggerType: data.triggerType }),
      ...(data.triggerConfig !== undefined && { triggerConfig: data.triggerConfig as never }),
      ...(data.steps !== undefined && { steps: data.steps as never }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      updatedAt: new Date(),
    })
    .where(eq(workflows.id, id))
    .returning();
  return rows[0];
}

export async function deleteWorkflow(id: string): Promise<void> {
  await db.delete(workflows).where(eq(workflows.id, id));
}

// =============================================================================
// Workflow Instances
// =============================================================================

export interface CreateInstanceInput {
  workflowId: string;
  projectId?: string;
  context?: unknown;
}

export async function createInstance(data: CreateInstanceInput): Promise<WorkflowInstance> {
  const rows = await db
    .insert(workflowInstances)
    .values({
      workflowId: data.workflowId,
      projectId: data.projectId,
      context: data.context as never,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建工作流实例失败');
  return row;
}

export async function findInstances(
  opts: { page: number; pageSize: number; workflowId?: string; status?: string },
): Promise<{ list: WorkflowInstance[]; total: number }> {
  const conds = [];
  if (opts.workflowId) conds.push(eq(workflowInstances.workflowId, opts.workflowId));
  if (opts.status) conds.push(eq(workflowInstances.status, opts.status));
  const where = conds.length ? and(...conds) : undefined;

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(workflowInstances)
      .where(where)
      .orderBy(desc(workflowInstances.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ count: sql<number>`COUNT(*)` }).from(workflowInstances).where(where),
  ]);
  return { list, total: Number(totalRows[0]?.count ?? 0) };
}

export async function findInstanceById(
  id: string,
): Promise<WorkflowInstance | undefined> {
  const rows = await db.select().from(workflowInstances).where(eq(workflowInstances.id, id)).limit(1);
  return rows[0];
}

export async function updateInstanceStatus(
  id: string,
  status: string,
  extra?: { startedAt?: Date | null; completedAt?: Date | null; error?: string | null },
): Promise<WorkflowInstance | undefined> {
  const rows = await db
    .update(workflowInstances)
    .set({
      status,
      ...(extra?.startedAt !== undefined && { startedAt: extra.startedAt }),
      ...(extra?.completedAt !== undefined && { completedAt: extra.completedAt }),
      ...(extra?.error !== undefined && { error: extra.error }),
    })
    .where(eq(workflowInstances.id, id))
    .returning();
  return rows[0];
}

export async function cancelInstance(
  id: string,
): Promise<WorkflowInstance | undefined> {
  const rows = await db
    .update(workflowInstances)
    .set({ status: 'cancelled', completedAt: new Date() })
    .where(eq(workflowInstances.id, id))
    .returning();
  return rows[0];
}

// =============================================================================
// Workflow Tasks
// =============================================================================

export interface CreateTaskInput {
  instanceId: string;
  stepIndex: number;
  name: string;
  type: string;
  input?: unknown;
}

export async function createTasks(tasks: CreateTaskInput[]): Promise<WorkflowTask[]> {
  if (tasks.length === 0) return [];
  const rows = await db
    .insert(workflowTasks)
    .values(
      tasks.map((t) => ({
        instanceId: t.instanceId,
        stepIndex: t.stepIndex,
        name: t.name,
        type: t.type,
        input: t.input as never,
      })),
    )
    .returning();
  return rows;
}

export async function findTasks(instanceId: string): Promise<WorkflowTask[]> {
  return db
    .select()
    .from(workflowTasks)
    .where(eq(workflowTasks.instanceId, instanceId))
    .orderBy(sql`step_index ASC`);
}

export async function findTasksByInstanceIds(instanceIds: string[]): Promise<WorkflowTask[]> {
  if (instanceIds.length === 0) return [];
  return db
    .select()
    .from(workflowTasks)
    .where(inArray(workflowTasks.instanceId, instanceIds))
    .orderBy(sql`instance_id ASC, step_index ASC`);
}

export async function updateTaskStatus(
  id: string,
  status: string,
  extra?: { output?: unknown; error?: string | null; startedAt?: Date | null; completedAt?: Date | null },
): Promise<WorkflowTask | undefined> {
  const rows = await db
    .update(workflowTasks)
    .set({
      status,
      ...(extra?.output !== undefined && { output: extra.output as never }),
      ...(extra?.error !== undefined && { error: extra.error }),
      ...(extra?.startedAt !== undefined && { startedAt: extra.startedAt }),
      ...(extra?.completedAt !== undefined && { completedAt: extra.completedAt }),
    })
    .where(eq(workflowTasks.id, id))
    .returning();
  return rows[0];
}

// =============================================================================
// Workflow Logs
// =============================================================================

export interface CreateLogInput {
  instanceId: string;
  taskId?: string;
  level: string;
  message: string;
  data?: unknown;
}

export async function createLog(data: CreateLogInput): Promise<WorkflowLog> {
  const rows = await db
    .insert(workflowLogs)
    .values({
      instanceId: data.instanceId,
      taskId: data.taskId,
      level: data.level,
      message: data.message,
      data: data.data as never,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建工作流日志失败');
  return row;
}

export async function findLogs(
  instanceId: string,
  opts: { page: number; pageSize: number },
): Promise<{ list: WorkflowLog[]; total: number }> {
  const where = eq(workflowLogs.instanceId, instanceId);
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(workflowLogs)
      .where(where)
      .orderBy(desc(workflowLogs.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ count: sql<number>`COUNT(*)` }).from(workflowLogs).where(where),
  ]);
  return { list, total: Number(totalRows[0]?.count ?? 0) };
}
