// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-47 回归:备份 cron 非法表达式必须在落库前被拒,且调度器重载不得自停摆。
 *
 * 覆盖:
 * 1. PATCH /backup-jobs/settings 传 "* * *"(字符集/长度能过,但不是合法 cron)→ 400 且不落库;
 * 2. 合法表达式才调用 updateBackupSettings,且校验发生在写库之前;
 * 3. scheduleWith 的 validate 兜底:非法表达式不建任务、不覆盖既有 scheduledTask;
 * 4. restartBackupCron「先建新成功再停旧」:新表达式非法/建任务抛错/读配置异常时保留旧任务;
 * 5. 库里已有非法表达式(历史脏数据)时启动只告警,不产生 unhandled rejection。
 *
 * 全程不连真实 DB/Redis:node-cron 与 backup-jobs-service 全部 mock。
 */
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const events: string[] = []
  const state: { settings: { enabled: boolean; cronExpr: string } | null } = {
    settings: { enabled: true, cronExpr: '0 3 * * *' },
  }
  const tasks: Array<{ stop: ReturnType<typeof vi.fn> }> = []
  const scheduleImpl = (expr: string) => {
    events.push(`schedule:${expr}`)
    const task = {
      stop: vi.fn(() => {
        events.push('stop')
      }),
    }
    tasks.push(task)
    return task
  }
  // 只做段数判定:与 node-cron 一致地拒绝 "* * *",接受 5/6 段表达式。
  const validateImpl = (expr: string) => {
    const fields = expr.trim().split(/\s+/).filter(Boolean)
    return fields.length === 5 || fields.length === 6
  }
  const schedule = vi.fn(scheduleImpl)
  const validate = vi.fn(validateImpl)
  const getBackupSettings = vi.fn(async () => {
    if (state.settings === null) throw new Error('db down')
    return state.settings
  })
  const updateBackupSettings = vi.fn(async (patch: Record<string, unknown>) => {
    events.push('update')
    if (state.settings) {
      if (typeof patch.enabled === 'boolean') state.settings.enabled = patch.enabled
      if (typeof patch.cronExpr === 'string') state.settings.cronExpr = patch.cronExpr
    }
    return { ...(state.settings ?? {}) }
  })
  return {
    events,
    state,
    tasks,
    schedule,
    scheduleImpl,
    validate,
    validateImpl,
    getBackupSettings,
    updateBackupSettings,
  }
})

vi.mock('node-cron', () => ({
  default: { schedule: h.schedule, validate: h.validate },
}))

vi.mock('../src/services/backup-jobs-service.js', () => ({
  getBackupSettings: h.getBackupSettings,
  updateBackupSettings: h.updateBackupSettings,
  listBackupJobs: vi.fn(async () => []),
  runBackupNow: vi.fn(async () => null),
  deleteBackupJob: vi.fn(async () => ({ deleted: false, fileRemoved: false })),
  runBackupCronTick: vi.fn(async () => true),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async () => {},
}))

let app: FastifyInstance | null = null

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  // mockImplementationOnce 的残留会跨用例泄漏,每个用例重建基础实现。
  h.schedule.mockReset()
  h.schedule.mockImplementation(h.scheduleImpl)
  h.validate.mockReset()
  h.validate.mockImplementation(h.validateImpl)
  h.events.length = 0
  h.tasks.length = 0
  h.state.settings = { enabled: true, cronExpr: '0 3 * * *' }
})

afterEach(async () => {
  if (app) {
    await app.close()
    app = null
  }
})

async function buildApp(): Promise<FastifyInstance> {
  const plugin = (await import('../src/routes/admin/backup-jobs.js')).default
  const instance = Fastify()
  await instance.register(plugin)
  await instance.ready()
  return instance
}

async function loadCronJobs() {
  return import('../src/jobs/backup-jobs-cron.js')
}

describe('F-47 PATCH settings 先校验后落库', () => {
  it('"* * *" 非法 cron ⇒ 400,且不写库、不建调度', async () => {
    app = await buildApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/backup-jobs/settings',
      payload: { enabled: true, cronExpr: '* * *' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('cron')
    expect(h.updateBackupSettings).not.toHaveBeenCalled()
    expect(h.schedule).not.toHaveBeenCalled()
  })

  it('合法表达式 ⇒ 200,校验先于写库,写库后才建调度', async () => {
    app = await buildApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/backup-jobs/settings',
      payload: { enabled: true, cronExpr: '*/10 * * * *' },
    })
    expect(res.statusCode).toBe(200)
    expect(h.validate).toHaveBeenCalledWith('*/10 * * * *')
    expect(h.updateBackupSettings).toHaveBeenCalledTimes(1)
    expect(h.events).toEqual(['update', 'schedule:*/10 * * * *'])
  })
})

describe('F-47 调度器 validate 兜底与重载顺序', () => {
  it('库里已是非法表达式 ⇒ 启动只告警,不建任务且不抛出', async () => {
    h.state.settings = { enabled: true, cronExpr: '* * *' }
    const { startBackupCronScheduler, stopBackupCronScheduler } = await loadCronJobs()
    await expect(startBackupCronScheduler()).resolves.toBeUndefined()
    expect(h.validate).toHaveBeenCalledWith('* * *')
    expect(h.schedule).not.toHaveBeenCalled()
    expect(h.tasks).toHaveLength(0)
    stopBackupCronScheduler()
  })

  it('重载到非法表达式 ⇒ 保留旧任务,不 stop', async () => {
    const { startBackupCronScheduler, restartBackupCron, stopBackupCronScheduler } =
      await loadCronJobs()
    await startBackupCronScheduler()
    expect(h.tasks).toHaveLength(1)

    h.state.settings = { enabled: true, cronExpr: '* * *' }
    await restartBackupCron()

    expect(h.tasks).toHaveLength(1) // 未新建
    expect(h.tasks[0].stop).not.toHaveBeenCalled() // 旧任务仍在跑
    stopBackupCronScheduler()
    expect(h.tasks[0].stop).toHaveBeenCalledTimes(1)
  })

  it('重载到合法表达式 ⇒ 先建新任务成功,再停旧任务', async () => {
    const { startBackupCronScheduler, restartBackupCron } = await loadCronJobs()
    await startBackupCronScheduler()

    h.state.settings = { enabled: true, cronExpr: '*/5 * * * *' }
    await restartBackupCron()

    expect(h.tasks).toHaveLength(2)
    expect(h.events).toEqual([
      'schedule:0 3 * * *',
      'schedule:*/5 * * * *',
      'stop',
    ])
  })

  it('enabled=false ⇒ 停掉旧任务且不再建新任务', async () => {
    const { startBackupCronScheduler, restartBackupCron } = await loadCronJobs()
    await startBackupCronScheduler()

    h.state.settings = { enabled: false, cronExpr: '0 3 * * *' }
    await restartBackupCron()

    expect(h.tasks[0].stop).toHaveBeenCalledTimes(1)
    expect(h.schedule).toHaveBeenCalledTimes(1)
  })

  it('读配置异常 ⇒ 保留旧任务(停掉就再也拉不起来)', async () => {
    const { startBackupCronScheduler, restartBackupCron } = await loadCronJobs()
    await startBackupCronScheduler()

    h.state.settings = null
    await expect(restartBackupCron()).resolves.toBeUndefined()
    expect(h.tasks[0].stop).not.toHaveBeenCalled()
  })

  it('cron.schedule 抛错 ⇒ 不覆盖既有任务', async () => {
    const { startBackupCronScheduler, restartBackupCron } = await loadCronJobs()
    await startBackupCronScheduler()

    h.state.settings = { enabled: true, cronExpr: '*/5 * * * *' }
    h.schedule.mockImplementationOnce(() => {
      throw new Error('schedule boom')
    })
    await restartBackupCron()

    expect(h.tasks).toHaveLength(1)
    expect(h.tasks[0].stop).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
