// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 工作区锁心跳管理 + 统一释放(2-2 P0-1/P0-2 修复)。
 *
 * P0-1 心跳续期:
 *   原状:transition 端点抢锁后即返回,生产代码零续期调用方;长任务超过
 *        TTL(120s)后锁静默过期,可被其他任务抢走,原持有者仍以为独占工作区。
 *   方案:抢锁成功后启动 per-task 定时续期(间隔 = TTL/3 = 40s,与 ai-service
 *        workspace_lock.py 的 WORKSPACE_LOCK_HEARTBEAT_INTERVAL 同款);续期
 *        失败(锁已丢)时把任务回写 blocked 并 SSE 告警;离开 in_progress /
 *        删除 / dispatch 终态时停止。
 *
 * P0-2 释放收敛:
 *   原状:admin PUT/DELETE 与 subagent dispatch 终态直接写库,不释放锁、
 *        不清 lockedBy、不广播 SSE → 锁与任务状态脱节。
 *   方案:所有"任务离开 in_progress"的写路径统一经过本模块的释放原语。
 */
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { agentTasks } from '@ihui/database'
import { logger } from '../utils/logger.js'
import { renewWorkspaceLock, releaseWorkspaceLock, WORKSPACE_LOCK_TTL } from './workspace-lock.js'
import { broadcastSSEEvent } from './agent-sse-bus.js'

/** 心跳间隔 = TTL/3(与 ai-service WORKSPACE_LOCK_HEARTBEAT_INTERVAL 一致) */
export const LOCK_HEARTBEAT_INTERVAL_MS = Math.max(
  1000,
  Math.floor((WORKSPACE_LOCK_TTL * 1000) / 3),
)

type AgentTaskRow = typeof agentTasks.$inferSelect

interface HeartbeatEntry {
  workspace: string
  token: string
  timer: NodeJS.Timeout
}

const heartbeats = new Map<string, HeartbeatEntry>()

function extractWorkspace(row: AgentTaskRow): string | undefined {
  const payload = row.payload ?? {}
  return (
    row.workspacePath ??
    (typeof payload.workspacePath === 'string' ? payload.workspacePath : undefined)
  )
}

// ---------------------------------------------------------------------------
// 心跳管理
// ---------------------------------------------------------------------------

/** 启动 per-task 锁心跳(重复调用以最后一次为准,先清旧定时器) */
export function startLockHeartbeat(taskId: string, workspace: string, token: string): void {
  stopLockHeartbeat(taskId)
  const timer = setInterval(() => {
    void _tick(taskId)
  }, LOCK_HEARTBEAT_INTERVAL_MS)
  timer.unref?.()
  heartbeats.set(taskId, { workspace, token, timer })
  logger.info('[workspace-lock-heartbeat] 心跳已启动', {
    taskId,
    workspace,
    intervalMs: LOCK_HEARTBEAT_INTERVAL_MS,
  })
}

/** 停止心跳(不释放锁;释放走 releaseLockToken / releaseTaskLockFromRow) */
export function stopLockHeartbeat(taskId: string): void {
  const entry = heartbeats.get(taskId)
  if (!entry) return
  clearInterval(entry.timer)
  heartbeats.delete(taskId)
}

async function _tick(taskId: string): Promise<void> {
  const entry = heartbeats.get(taskId)
  if (!entry) return
  let ok = false
  try {
    ok = await renewWorkspaceLock(entry.workspace, entry.token)
  } catch (e) {
    // 瞬时异常(Redis 抖动等):不立刻判死,下一轮再试
    logger.warn('[workspace-lock-heartbeat] renew 异常(下轮重试)', { taskId, error: e })
    return
  }
  if (ok) return

  // 锁已丢失:停心跳 → 回写 blocked → SSE 告警
  stopLockHeartbeat(taskId)
  logger.error('[workspace-lock-heartbeat] 续期失败,锁已丢失', {
    taskId,
    workspace: entry.workspace,
  })
  try {
    const [row] = await db.select().from(agentTasks).where(eq(agentTasks.id, taskId)).limit(1)
    if (!row) return
    // 仅当任务仍持有同一把锁时回写(避免覆盖并发 transition 的结果)
    const payload = row.payload ?? {}
    if (payload.workspaceLockToken !== entry.token) return
    const { workspaceLockToken: _removed, ...restPayload } = payload
    await db
      .update(agentTasks)
      .set({
        status: 'blocked',
        errorMessage: `工作区锁心跳续期失败(TTL ${WORKSPACE_LOCK_TTL}s 内未续上,可能被其他任务抢占),任务自动转 blocked`,
        payload: restPayload,
        lockedBy: null,
        lockedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(agentTasks.id, taskId))
    broadcastSSEEvent({
      type: 'workspace_lock_released',
      taskId,
      payload: {
        workspace: entry.workspace,
        task: taskId,
        teamId: row.teamId ?? undefined,
        released: false,
        reason: 'heartbeat_lost',
      },
      timestamp: new Date().toISOString(),
    })
    broadcastSSEEvent({
      type: 'task_status_changed',
      taskId,
      payload: {
        fromStatus: 'in_progress',
        toStatus: 'blocked',
        reason: 'workspace_lock_heartbeat_lost',
        task: { id: taskId, status: 'blocked', teamId: row.teamId ?? undefined },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    logger.error('[workspace-lock-heartbeat] 锁丢失回写失败', { taskId, error: err })
  }
}

// ---------------------------------------------------------------------------
// 统一释放原语(P0-2 收敛点)
// ---------------------------------------------------------------------------

/**
 * 释放锁原语:停心跳 → 凭 token 释放 → 广播 workspace_lock_released。
 * 不写 DB(调用方自行决定如何更新任务行,transition 已有整行更新)。
 */
export async function releaseLockToken(
  taskId: string,
  workspace: string,
  token: string,
  teamId?: string | null,
): Promise<boolean> {
  stopLockHeartbeat(taskId)
  const released = await releaseWorkspaceLock(workspace, token)
  broadcastSSEEvent({
    type: 'workspace_lock_released',
    taskId,
    payload: {
      workspace,
      task: taskId,
      teamId: teamId ?? undefined,
      released,
    },
    timestamp: new Date().toISOString(),
  })
  return released
}

export interface ReleaseTaskLockResult {
  /** 是否持有锁(payload 中有 token) */
  hadLock: boolean
  /** 释放是否真正生效(token 匹配) */
  released: boolean
  workspace?: string
}

/**
 * 行级统一释放:停心跳 → 释放锁 → 清 payload token / lockedBy / lockedAt → 广播。
 * 调用方已持有任务行时用这个(admin PUT/DELETE、transition 备份路径),避免二次查询。
 * 无锁但审计字段残留(历史 dispatch 写的 lockedBy)时仅清理审计字段。
 */
export async function releaseTaskLockFromRow(row: AgentTaskRow): Promise<ReleaseTaskLockResult> {
  stopLockHeartbeat(row.id)
  const payload = row.payload ?? {}
  const token =
    typeof payload.workspaceLockToken === 'string' ? payload.workspaceLockToken : undefined
  const workspace = extractWorkspace(row)

  if (!token || !workspace) {
    if (row.lockedBy || row.lockedAt) {
      await db
        .update(agentTasks)
        .set({ lockedBy: null, lockedAt: null, updatedAt: new Date() })
        .where(eq(agentTasks.id, row.id))
    }
    return { hadLock: false, released: false }
  }

  const released = await releaseLockToken(row.id, workspace, token, row.teamId)
  const { workspaceLockToken: _removed, ...restPayload } = payload
  await db
    .update(agentTasks)
    .set({
      payload: restPayload,
      lockedBy: null,
      lockedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(agentTasks.id, row.id))
  return { hadLock: true, released, workspace }
}

/** 按 id 查行后统一释放(dispatch 终态 / 兜底路径);任务不存在返回未持有 */
export async function releaseTaskLockByTaskId(taskId: string): Promise<ReleaseTaskLockResult> {
  stopLockHeartbeat(taskId)
  const [row] = await db.select().from(agentTasks).where(eq(agentTasks.id, taskId)).limit(1)
  if (!row) return { hadLock: false, released: false }
  return releaseTaskLockFromRow(row)
}

/** 测试隔离:停掉全部心跳定时器并清空注册表 */
export function _resetLockHeartbeats(): void {
  for (const entry of heartbeats.values()) clearInterval(entry.timer)
  heartbeats.clear()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
