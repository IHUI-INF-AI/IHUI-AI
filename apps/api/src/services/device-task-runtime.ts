// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G2 设备任务运行时(2026-11-25 立)。
 *
 * 这一层只做"任务 ↔ 会话消息"的落点与状态推进,**不做广播**:ws 广播器是
 * fastify 实例上的装饰器,service 层拿不到 server;路由层拿到本层返回值后统一发帧
 * (与 chat.ts 的 writeMessage + broadcastChatMessageCreated 同一条分层纪律)。
 *
 * 为什么任务输出要写成会话里的 assistant 消息、而不是另建任务日志:
 * ① 手机/网页/桌面三端已经有完整的消息面渲染与跨端同步,任务过程因此零成本可见;
 * ② `attach` 写的是**同一条** messageId,流式增量与终态都挂在它上面 —— 消费端
 *    不需要学第二套"任务事件"渲染,也不会出现"任务页有日志、会话里没内容"的分叉;
 * ③ 终态帧复用 message:terminal 的既有语义,无需新协议。
 */
import { and, eq, sql } from 'drizzle-orm'
import { chatConversations, chatMessages, deviceTasks, devices } from '@ihui/database'
import type { DeviceTaskProgress } from '@ihui/types'
import { db } from '../db/index.js'
import { createMessage } from '../db/chat-queries.js'
import { AppError } from '../errors/AppError.js'

/** running 租约:5 分钟;设备每次进度上报/心跳都续租 */
export const TASK_LEASE_MS = 5 * 60_000

export interface AttachedTaskMessage {
  taskId: string
  conversationId: string
  messageId: string
  content: string
}

export interface TaskStreamFrame {
  taskId: string
  conversationId: string
  messageId: string
  kind: 'delta' | 'snapshot'
  content: string
  textDelta?: string
}

interface TaskRow {
  id: string
  sessionId: string
  targetDeviceId: string
  status: string
  messageId: string | null
  cancelRequestedAt: Date | null
  payload: unknown
  attempt: number
}

async function loadTaskForDevice(deviceId: string, taskId: string): Promise<TaskRow> {
  const rows = await db
    .select({
      id: deviceTasks.id,
      sessionId: deviceTasks.sessionId,
      targetDeviceId: deviceTasks.targetDeviceId,
      status: deviceTasks.status,
      messageId: deviceTasks.messageId,
      cancelRequestedAt: deviceTasks.cancelRequestedAt,
      payload: deviceTasks.payload,
      attempt: deviceTasks.attempt,
    })
    .from(deviceTasks)
    .where(and(eq(deviceTasks.id, taskId), eq(deviceTasks.targetDeviceId, deviceId)))
    .limit(1)
  const row = rows[0]
  if (!row) throw new AppError('任务不存在或不属于该设备', 404, 'TASK_NOT_FOUND')
  return row
}

function assertRunning(task: TaskRow): void {
  if (task.status !== 'running') {
    throw new AppError(`任务不在执行中(当前 ${task.status})`, 409, 'TASK_NOT_RUNNING')
  }
  if (task.cancelRequestedAt) {
    throw new AppError('任务已被用户取消', 409, 'TASK_CANCELLED')
  }
}

/**
 * 为本次执行在会话里开一条 assistant 消息(空正文),返回落点。
 * 幂等:已有 messageId 直接返回 —— 设备重启后重复 attach 不会在会话里长出两条空气泡。
 */
export async function attachTaskMessage(
  deviceId: string,
  taskId: string,
): Promise<AttachedTaskMessage> {
  const task = await loadTaskForDevice(deviceId, taskId)
  assertRunning(task)
  if (task.messageId) {
    const existing = await db
      .select({ content: chatMessages.content })
      .from(chatMessages)
      .where(eq(chatMessages.id, task.messageId))
      .limit(1)
    return {
      taskId: task.id,
      conversationId: task.sessionId,
      messageId: task.messageId,
      content: existing[0]?.content ?? '',
    }
  }
  const msg = await createMessage({
    conversationId: task.sessionId,
    role: 'assistant',
    content: '',
  })
  await db
    .update(deviceTasks)
    .set({
      messageId: msg.id,
      startedAt: new Date(),
      leaseExpiresAt: new Date(Date.now() + TASK_LEASE_MS),
    })
    .where(and(eq(deviceTasks.id, taskId), eq(deviceTasks.targetDeviceId, deviceId)))
  return {
    taskId: task.id,
    conversationId: task.sessionId,
    messageId: msg.id,
    content: msg.content ?? '',
  }
}

/**
 * 追加一段执行输出。
 *
 * `delta` = 增量追加(设备端把 token/工具行按批发来,端侧按 rev 收敛);
 * `snapshot` = 全量替换(设备端本地重放/修正时用,避免两次 delta 的中间态被用户看到)。
 *
 * **rev 不在这里分配**:广播装饰器 `broadcastChatMessagePatched` 内部已经走
 * `nextChatSyncRev`(唯一分配点);本层再 allocate 一次会让同一帧消耗两个修订号,
 * 设备拿到的 rev 比端侧链头落后一格 —— 那是"内容对了、坐标错了"的静默分叉。
 * 需要 rev 的调用方在广播后 `readChatSyncRev` 读链头。
 */
export async function appendTaskStream(
  deviceId: string,
  taskId: string,
  input: {
    kind: 'delta' | 'snapshot'
    textDelta?: string
    content?: string
    progress?: DeviceTaskProgress
  },
): Promise<TaskStreamFrame> {
  const task = await loadTaskForDevice(deviceId, taskId)
  assertRunning(task)
  if (!task.messageId) {
    throw new AppError('任务尚未 attach 消息落点', 409, 'TASK_NOT_ATTACHED')
  }

  if (input.kind === 'delta') {
    const delta = input.textDelta
    if (typeof delta !== 'string' || delta.length === 0) {
      throw new AppError('delta 帧必须携带非空 textDelta', 400, 'TASK_STREAM_EMPTY')
    }
    await db
      .update(chatMessages)
      .set({ content: sql`${chatMessages.content} || ${delta}` })
      .where(eq(chatMessages.id, task.messageId))
  } else {
    await db
      .update(chatMessages)
      .set({ content: typeof input.content === 'string' ? input.content : '' })
      .where(eq(chatMessages.id, task.messageId))
  }

  const rows = await db
    .select({ content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.id, task.messageId))
    .limit(1)

  await db
    .update(deviceTasks)
    .set({
      leaseExpiresAt: new Date(Date.now() + TASK_LEASE_MS),
      ...(input.progress ? { progress: input.progress } : {}),
    })
    .where(and(eq(deviceTasks.id, taskId), eq(deviceTasks.targetDeviceId, deviceId)))

  const frame: TaskStreamFrame = {
    taskId: task.id,
    conversationId: task.sessionId,
    messageId: task.messageId,
    kind: input.kind,
    content: rows[0]?.content ?? '',
  }
  if (input.kind === 'delta') frame.textDelta = input.textDelta
  return frame
}

/**
 * 续租 + 取取消意图。
 * 返回 `cancelRequested` 而不抛错 —— 取消是正常控制流,设备端读到后自行中止并报 failed,
 * 不把"用户点了取消"渲染成异常。
 */
export async function extendTaskLease(
  deviceId: string,
  taskId: string,
  progress?: DeviceTaskProgress,
): Promise<{ cancelRequested: boolean; leaseExpiresAt: Date; agentSessionId: string | null }> {
  const task = await loadTaskForDevice(deviceId, taskId)
  if (task.status !== 'running' && task.status !== 'claimed') {
    throw new AppError('任务不在执行中', 409, 'TASK_NOT_RUNNING')
  }
  const leaseExpiresAt = new Date(Date.now() + TASK_LEASE_MS)
  const rows = await db
    .update(deviceTasks)
    .set({
      leaseExpiresAt,
      ...(progress ? { progress } : {}),
    })
    .where(and(eq(deviceTasks.id, taskId), eq(deviceTasks.targetDeviceId, deviceId)))
    .returning({ agentSessionId: deviceTasks.agentSessionId })
  return {
    cancelRequested: task.cancelRequestedAt !== null,
    leaseExpiresAt,
    agentSessionId: rows[0]?.agentSessionId ?? null,
  }
}

/** 设备回写 AgentCore 会话 id(断点续跑用;不影响状态机) */
export async function bindAgentSession(
  deviceId: string,
  taskId: string,
  agentSessionId: string,
): Promise<void> {
  await db
    .update(deviceTasks)
    .set({ agentSessionId: agentSessionId.slice(0, 64) })
    .where(
      and(
        eq(deviceTasks.id, taskId),
        eq(deviceTasks.targetDeviceId, deviceId),
        eq(deviceTasks.status, 'running'),
      ),
    )
}

/**
 * 用户请求取消(会话属主)。
 * 两条路:
 *  - 还没被认领(queued/claimed):直接置 failed,不必等设备下一次心跳;
 *  - 已在 running:写 cancel_requested_at,设备在下次心跳/上报时读到并自行中止。
 * `cancelledImmediately` 告诉路由该发哪种帧(终态 vs 仅状态更新)。
 */
export async function requestTaskCancel(
  userId: string,
  taskId: string,
): Promise<{ immediate: boolean; task: typeof deviceTasks.$inferSelect }> {
  const rows = await db
    .select({
      id: deviceTasks.id,
      sessionId: deviceTasks.sessionId,
      deviceId: deviceTasks.targetDeviceId,
      status: deviceTasks.status,
      userId: chatConversations.userId,
    })
    .from(deviceTasks)
    .innerJoin(chatConversations, eq(chatConversations.id, deviceTasks.sessionId))
    .where(eq(deviceTasks.id, taskId))
    .limit(1)
  const task = rows[0]
  if (!task) throw new AppError('任务不存在', 404, 'TASK_NOT_FOUND')
  if (task.userId !== userId) throw new AppError('无权操作该任务', 403, 'TASK_FORBIDDEN')
  if (task.status === 'completed' || task.status === 'failed' || task.status === 'expired') {
    throw new AppError(`任务已结束(${task.status})`, 409, 'TASK_ALREADY_FINISHED')
  }

  const now = new Date()
  const result = await db
    .update(deviceTasks)
    .set({
      status: 'failed',
      finishedAt: now,
      cancelRequestedAt: now,
      leaseExpiresAt: null,
      error: '用户已取消',
      progress: {
        stage: 'cancelled',
        percent: 0,
        lastEvent: '用户已取消',
        updatedAt: now.toISOString(),
      } satisfies DeviceTaskProgress,
    })
    .where(and(eq(deviceTasks.id, taskId), sql`${deviceTasks.status} IN ('queued', 'claimed')`))
    .returning({ id: deviceTasks.id })

  if (result.length > 0) {
    const cancelled = await loadTaskRow(taskId)
    return { immediate: true, task: cancelled }
  }
  // 已被认领 → 只置取消意图,等设备收口(不能在这里硬置 failed:设备可能正写到一半,
  // 抢先把状态改掉会让设备后续上报全部 409,反而留下半截消息)。
  // progress 里留一句人话:端侧不新增字段也能显示"已请求取消,等执行端收口"。
  await db.execute(sql`
    UPDATE device_tasks
    SET cancel_requested_at = now(),
        progress = coalesce(progress, '{}'::jsonb) || jsonb_build_object(
          'lastEvent', '已请求取消,等待执行端收口',
          'updatedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
        )
    WHERE id = ${taskId}::uuid
  `)
  return { immediate: false, task: await loadTaskRow(taskId) }
}

/** 用户侧行读取(状态机推进后的回显用;不存在 → 抛 404) */
async function loadTaskRow(taskId: string): Promise<typeof deviceTasks.$inferSelect> {
  const rows = await db.select().from(deviceTasks).where(eq(deviceTasks.id, taskId)).limit(1)
  const row = rows[0]
  if (!row) throw new AppError('任务不存在', 404, 'TASK_NOT_FOUND')
  return row
}

/**
 * 用户重排失败/过期任务(会话属主)。
 * 只重置流程字段,**保留 payload 与历史消息**:上一轮输出留在会话里可追溯,
 * 新一轮 attach 会开新 messageId —— 覆盖旧消息等于把用户已经看到的过程删掉。
 */
export async function retryTask(
  userId: string,
  taskId: string,
): Promise<{ task: typeof deviceTasks.$inferSelect }> {
  const selected = await db
    .select({
      id: deviceTasks.id,
      sessionId: deviceTasks.sessionId,
      deviceId: deviceTasks.targetDeviceId,
      status: deviceTasks.status,
      attempt: deviceTasks.attempt,
      userId: chatConversations.userId,
    })
    .from(deviceTasks)
    .innerJoin(chatConversations, eq(chatConversations.id, deviceTasks.sessionId))
    .where(eq(deviceTasks.id, taskId))
    .limit(1)
  const task = selected[0]
  if (!task) throw new AppError('任务不存在', 404, 'TASK_NOT_FOUND')
  if (task.userId !== userId) throw new AppError('无权操作该任务', 403, 'TASK_FORBIDDEN')
  if (task.status !== 'failed' && task.status !== 'expired') {
    throw new AppError(`只有失败/过期任务可重排(当前 ${task.status})`, 409, 'TASK_NOT_RETRYABLE')
  }
  const nextAttempt = task.attempt + 1
  const rows = await db
    .update(deviceTasks)
    .set({
      status: 'queued',
      attempt: nextAttempt,
      claimedAt: null,
      finishedAt: null,
      startedAt: null,
      error: null,
      progress: null,
      leaseExpiresAt: null,
      cancelRequestedAt: null,
      messageId: null,
      agentSessionId: null,
    })
    .where(and(eq(deviceTasks.id, taskId), eq(deviceTasks.status, task.status)))
    .returning()
  const updated = rows[0]
  if (!updated) throw new AppError('任务状态已变化,请刷新后重试', 409, 'TASK_STATE_CHANGED')
  return { task: updated }
}

/** 用户侧任务详情(含设备名;不存在/非本人会话 → 404/403) */
export async function getTaskForUser(
  userId: string,
  taskId: string,
): Promise<{
  task: typeof deviceTasks.$inferSelect
  conversationId: string
  deviceName: string | null
} | null> {
  const rows = await db
    .select({
      task: deviceTasks,
      conversationOwner: chatConversations.userId,
      deviceName: devices.name,
    })
    .from(deviceTasks)
    .innerJoin(chatConversations, eq(chatConversations.id, deviceTasks.sessionId))
    .leftJoin(devices, eq(devices.id, deviceTasks.targetDeviceId))
    .where(eq(deviceTasks.id, taskId))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  if (row.conversationOwner !== userId) throw new AppError('无权访问该任务', 403, 'TASK_FORBIDDEN')
  return { task: row.task, conversationId: row.task.sessionId, deviceName: row.deviceName ?? null }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
