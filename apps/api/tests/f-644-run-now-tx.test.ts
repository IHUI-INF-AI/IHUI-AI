// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-644 回归锁(2026-11-13)。
 *
 * 病灶:runScheduleTaskNow 先 UPDATE schedule_tasks 标记已运行,再单独 INSERT schedule_logs;
 * 日志写失败时任务已被标记"已运行"却没有执行记录,状态与日志永久对不上;原实现还用
 * `if (!updated || !log) return undefined` 把"已写库后拿不到日志"伪装成"任务不存在"(404)。
 *
 * 本文件锁:
 *   ① 任务读取与两次写库都在同一个 db.transaction 的 tx 上完成,外层 db 不参与写;
 *   ② 日志插入抛错:事务整体回滚,不留下"已运行"状态;
 *   ③ 日志插入返回空行(未抛错):同样抛错回滚,不得以 undefined 冒充"任务不存在";
 *   ④ 成功:返回结构与原契约一致 { task, log }。
 *
 * 只 vi.mock db,不触达真实 PG。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const state = vi.hoisted(() => ({
  taskRows: [] as unknown[],
  updateRows: [] as unknown[],
  logRows: [] as unknown[],
  logInsertError: null as Error | null,
  attempt: { lastRunStatus: 'idle' as string },
  committed: null as { lastRunStatus: string } | null,
  rolledBack: false,
  txRead: vi.fn(),
  txUpdateReturning: vi.fn(),
  txInsertReturning: vi.fn(),
  outerSelect: vi.fn(),
  outerUpdate: vi.fn(),
  outerInsert: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
}))

vi.mock('../src/db/index.js', () => {
  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => {
            state.txRead()
            return Promise.resolve(state.taskRows)
          },
        }),
      }),
    }),
    update: () => ({
      set: (values: { lastRunStatus?: string }) => ({
        where: () => ({
          returning: () => {
            state.attempt.lastRunStatus = values.lastRunStatus ?? state.attempt.lastRunStatus
            state.txUpdateReturning()
            return Promise.resolve(state.updateRows)
          },
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => {
          state.txInsertReturning()
          if (state.logInsertError) return Promise.reject(state.logInsertError)
          return Promise.resolve(state.logRows)
        },
      }),
    }),
  }
  return {
    db: {
      select: state.outerSelect,
      update: state.outerUpdate,
      insert: state.outerInsert,
      delete: vi.fn(),
      transaction: vi.fn(async (fn: (txArg: unknown) => Promise<unknown>) => {
        state.attempt = { lastRunStatus: 'idle' }
        try {
          const result = await fn(tx)
          state.committed = { lastRunStatus: state.attempt.lastRunStatus }
          state.commit()
          return result
        } catch (e) {
          state.attempt.lastRunStatus = 'idle'
          state.rolledBack = true
          state.rollback()
          throw e
        }
      }),
    },
    dbRead: { select: vi.fn() },
    dbClient: {},
  }
})

import { runScheduleTaskNow } from '../src/db/schedule-queries.js'

const TASK = {
  id: '11111111-1111-4111-8111-111111111111',
  name: '夜间指标汇总',
  cronExpression: '0 2 * * *',
  enabled: true,
  lastRunStatus: 'idle',
}

const LOG = {
  id: 1,
  taskId: TASK.id,
  taskName: TASK.name,
  status: 'running',
  message: '手动触发执行',
}

describe('F-644 runScheduleTaskNow 标记已运行与写日志必须同事务', () => {
  beforeEach(() => {
    state.taskRows = []
    state.updateRows = []
    state.logRows = []
    state.logInsertError = null
    state.attempt = { lastRunStatus: 'idle' }
    state.committed = null
    state.rolledBack = false
    vi.clearAllMocks()
  })

  it('两次写库都在同一个 tx 上完成，成功时返回 { task, log }', async () => {
    state.taskRows = [TASK]
    state.updateRows = [{ ...TASK, lastRunStatus: 'queued' }]
    state.logRows = [LOG]

    const result = await runScheduleTaskNow(TASK.id, 'queued')

    if (!result) throw new Error('期望返回 { task, log }')
    expect(Object.keys(result).sort()).toEqual(['log', 'task'])
    expect(result.task.id).toBe(TASK.id)
    expect(result.task.lastRunStatus).toBe('queued')
    expect(result.log.taskId).toBe(TASK.id)
    expect(state.txRead).toHaveBeenCalledTimes(1)
    expect(state.txUpdateReturning).toHaveBeenCalledTimes(1)
    expect(state.txInsertReturning).toHaveBeenCalledTimes(1)
    expect(state.outerSelect).not.toHaveBeenCalled()
    expect(state.outerUpdate).not.toHaveBeenCalled()
    expect(state.outerInsert).not.toHaveBeenCalled()
    expect(state.commit).toHaveBeenCalledTimes(1)
    expect(state.attempt.lastRunStatus).toBe('queued')
  })

  it('日志插入抛错时整体回滚，不留下"已运行"状态', async () => {
    state.taskRows = [TASK]
    state.updateRows = [{ ...TASK, lastRunStatus: 'running' }]
    state.logInsertError = new Error('insert schedule_logs failed')

    await expect(runScheduleTaskNow(TASK.id)).rejects.toThrow('insert schedule_logs failed')

    expect(state.txUpdateReturning).toHaveBeenCalledTimes(1)
    expect(state.txInsertReturning).toHaveBeenCalledTimes(1)
    expect(state.rolledBack).toBe(true)
    expect(state.commit).not.toHaveBeenCalled()
    expect(state.committed).toBeNull()
    expect(state.attempt.lastRunStatus).toBe('idle')
    expect(state.outerUpdate).not.toHaveBeenCalled()
  })

  it('日志插入返回空行时同样抛错回滚，不以 undefined 冒充任务不存在', async () => {
    state.taskRows = [TASK]
    state.updateRows = [{ ...TASK, lastRunStatus: 'running' }]
    state.logRows = []

    await expect(runScheduleTaskNow(TASK.id)).rejects.toThrow('写入定时任务执行日志失败')

    expect(state.rolledBack).toBe(true)
    expect(state.commit).not.toHaveBeenCalled()
    expect(state.attempt.lastRunStatus).toBe('idle')
  })

  it('任务不存在时直接返回 undefined，不产生任何写入', async () => {
    state.taskRows = []

    const result = await runScheduleTaskNow(TASK.id)

    expect(result).toBeUndefined()
    expect(state.txUpdateReturning).not.toHaveBeenCalled()
    expect(state.txInsertReturning).not.toHaveBeenCalled()
    expect(state.outerUpdate).not.toHaveBeenCalled()
    expect(state.outerInsert).not.toHaveBeenCalled()
  })
})
