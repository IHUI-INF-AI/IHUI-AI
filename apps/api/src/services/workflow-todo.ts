// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'

import { workflowTodo, type WorkflowTodo } from '@ihui/database'
import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'
import { AppError } from '../errors/AppError.js'

/**
 * 流程待办服务(HR-6 第 4 期,2026-11-13 立)。
 *
 * 职责:把"需要人处理的事项"落成可追溯的条目,并提供认领/结清/忽略。
 *
 * 三条铁律:
 *   1. **幂等**:同 dedupeKey 重复上报只刷新计数与 lastSeenAt,不新增行;
 *   2. **不复活**:已 resolved/ignored 的待办,后续重跑**不会**把它打回 open
 *      ——否则 HR 每次忽略都会被下一次定时任务推翻,变成骚扰;
 *   3. **不静默消失**:本次上报集合之外的旧 open 待办**不会**被自动关闭,
 *      只由 `markStaleTodos` 显式处理(避免"流程跑挂了一半导致待办被误清")。
 */

export type TodoSeverity = 'blocker' | 'warn' | 'info'
export type TodoStatus = 'open' | 'resolved' | 'ignored'

/** 上报一条待办(幂等) */
export interface TodoUpsertInput {
  dedupeKey: string
  sourceType: string
  sourceRef?: string | null
  severity?: TodoSeverity
  title: string
  detail?: string | null
  affectedCount?: number | null
  affectedAmountCents?: number | null
  actionPath?: string | null
  actionHint?: string | null
  context?: Record<string, unknown> | null
}

/**
 * 批量上报(同一流程一次跑完的结果)。
 *
 * 返回本次真正"新开"的条数与"已存在被刷新"的条数,便于日志判断是不是新问题。
 */
export async function upsertTodos(
  inputs: readonly TodoUpsertInput[],
): Promise<{ created: number; refreshed: number; skippedResolved: number }> {
  if (inputs.length === 0) return { created: 0, refreshed: 0, skippedResolved: 0 }

  let created = 0
  let refreshed = 0
  let skippedResolved = 0

  for (const input of inputs) {
    const [existing] = await db
      .select({ id: workflowTodo.id, status: workflowTodo.status })
      .from(workflowTodo)
      .where(eq(workflowTodo.dedupeKey, input.dedupeKey))
      .limit(1)

    if (existing) {
      // 已结清/已忽略 ⇒ 只刷新 lastSeenAt 与计数,**不改 status**(不复活)
      const isClosed = existing.status !== 'open'
      if (isClosed) skippedResolved += 1
      else refreshed += 1

      await db
        .update(workflowTodo)
        .set({
          // 已关闭的条目仍更新"影响规模",但不改 title/status:
          // 万一下次问题更严重,规模数字要能反映出来
          affectedCount: input.affectedCount ?? null,
          affectedAmountCents: input.affectedAmountCents ?? null,
          lastSeenAt: new Date(),
          ...(isClosed
            ? {}
            : {
                severity: input.severity ?? 'warn',
                title: input.title,
                detail: input.detail ?? null,
                actionPath: input.actionPath ?? null,
                actionHint: input.actionHint ?? null,
                context: input.context ?? null,
              }),
        })
        .where(eq(workflowTodo.id, existing.id))
      continue
    }

    await db
      .insert(workflowTodo)
      .values({
        dedupeKey: input.dedupeKey,
        sourceType: input.sourceType,
        sourceRef: input.sourceRef ?? null,
        severity: input.severity ?? 'warn',
        title: input.title,
        detail: input.detail ?? null,
        affectedCount: input.affectedCount ?? null,
        affectedAmountCents: input.affectedAmountCents ?? null,
        actionPath: input.actionPath ?? null,
        actionHint: input.actionHint ?? null,
        context: input.context ?? null,
        status: 'open',
      })
      .onConflictDoNothing()
    created += 1
  }

  logger.info('workflow todos upserted', { created, refreshed, skippedResolved })
  return { created, refreshed, skippedResolved }
}

/** 列出待办(默认只看 open) */
export async function listTodos(params: {
  status?: TodoStatus | 'all'
  sourceType?: string
  sourceRef?: string
  severity?: TodoSeverity
  limit?: number
  offset?: number
}): Promise<{ list: WorkflowTodo[]; total: number }> {
  const { status = 'open', sourceType, sourceRef, severity } = params
  const filters = []
  if (status !== 'all') filters.push(eq(workflowTodo.status, status))
  if (sourceType) filters.push(eq(workflowTodo.sourceType, sourceType))
  if (sourceRef) filters.push(eq(workflowTodo.sourceRef, sourceRef))
  if (severity) filters.push(eq(workflowTodo.severity, severity))
  const where = filters.length > 0 ? and(...filters) : undefined

  const [totalRow] = await db.select({ c: count() }).from(workflowTodo).where(where)
  const list = await db
    .select()
    .from(workflowTodo)
    .where(where)
    .orderBy(desc(workflowTodo.lastSeenAt))
    .limit(Math.min(params.limit ?? 50, 200))
    .offset(params.offset ?? 0)

  return { list, total: Number(totalRow?.c ?? 0) }
}

/** 认领(把 assignee 设成自己;传 null 取消认领) */
export async function claimTodo(todoId: string, userId: string | null): Promise<WorkflowTodo> {
  const [updated] = await db
    .update(workflowTodo)
    .set({ assigneeId: userId })
    .where(eq(workflowTodo.id, todoId))
    .returning()
  if (!updated) throw new AppError('待办不存在', 404, 'TODO_NOT_FOUND')
  return updated
}

/**
 * 结清/忽略一条待办。
 *
 * 只能由人触发(路由层已鉴权)。`resolutionNote` 强制要求非空 ——
 * "为什么这么处理"是事后追责与复盘的唯一依据,不允许空着关门。
 */
export async function resolveTodo(params: {
  todoId: string
  status: Extract<TodoStatus, 'resolved' | 'ignored'>
  resolvedBy: string | null
  note: string
}): Promise<WorkflowTodo> {
  const { todoId, status, resolvedBy, note } = params
  const trimmed = note.trim()
  if (!trimmed) {
    throw new AppError('结清待办必须填写处理说明', 400, 'TODO_NOTE_REQUIRED')
  }
  const [updated] = await db
    .update(workflowTodo)
    .set({
      status,
      resolvedBy,
      resolvedAt: new Date(),
      resolutionNote: trimmed.slice(0, 2000),
    })
    .where(eq(workflowTodo.id, todoId))
    .returning()
  if (!updated) throw new AppError('待办不存在', 404, 'TODO_NOT_FOUND')
  logger.info('workflow todo resolved', { todoId, status, resolvedBy })
  return updated
}

/**
 * 结清一批(按 dedupeKey),供业务侧在"问题确实消失"时自动关闭。
 *
 * 例如:HR 补齐了 3 人的薪资配置并重算成功,流程可调用它把那条待办关掉。
 * 与 `upsertTodos` 的"不复活"互补:一个负责开,一个负责关,都幂等。
 */
export async function resolveTodosByKeys(params: {
  dedupeKeys: readonly string[]
  note: string
  resolvedBy?: string | null
}): Promise<{ resolved: number }> {
  const { dedupeKeys, note } = params
  if (dedupeKeys.length === 0) return { resolved: 0 }
  const updated = await db
    .update(workflowTodo)
    .set({
      status: 'resolved',
      resolvedBy: params.resolvedBy ?? null,
      resolvedAt: new Date(),
      resolutionNote: note.slice(0, 2000),
    })
    .where(and(inArray(workflowTodo.dedupeKey, [...dedupeKeys]), eq(workflowTodo.status, 'open')))
    .returning({ id: workflowTodo.id })
  return { resolved: updated.length }
}

/**
 * 统计摘要(管理端首页/角标用):按严重度分组计数。
 */
export async function todoSummary(sourceType?: string): Promise<{
  open: number
  blocker: number
  warn: number
  info: number
}> {
  const where = sourceType
    ? and(eq(workflowTodo.status, 'open'), eq(workflowTodo.sourceType, sourceType))
    : eq(workflowTodo.status, 'open')
  const rows = await db
    .select({ severity: workflowTodo.severity, c: count() })
    .from(workflowTodo)
    .where(where)
    .groupBy(workflowTodo.severity)

  const out = { open: 0, blocker: 0, warn: 0, info: 0 }
  for (const r of rows) {
    const n = Number(r.c)
    out.open += n
    if (r.severity === 'blocker') out.blocker = n
    else if (r.severity === 'warn') out.warn = n
    else if (r.severity === 'info') out.info = n
  }
  return out
}

/** 供测试与运维:统计某来源下 open 条数 */
export async function countOpenTodos(sourceType: string, sourceRef?: string): Promise<number> {
  const filters = [eq(workflowTodo.status, 'open'), eq(workflowTodo.sourceType, sourceType)]
  if (sourceRef) filters.push(eq(workflowTodo.sourceRef, sourceRef))
  const [row] = await db
    .select({ c: count() })
    .from(workflowTodo)
    .where(and(...filters))
  return Number(row?.c ?? 0)
}

/** 内部工具:给 context 里的数字做安全取整(sql 聚合场景用) */
export function toIntOrNull(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : null
}

export { sql }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
