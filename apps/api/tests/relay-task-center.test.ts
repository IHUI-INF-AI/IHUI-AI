// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池任务中心测试(2026-10-27,缺口④)。
 * 观测聚合走注入探针(§0.9 不碰真 Redis/真文件/真 ai-service);
 * 触发分发 mock 掉执行体模块(不真跑 DB/子进程)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/services/relay-account-pool-scheduler.js', () => ({
  sweepAccountPool: vi.fn(async () => ({
    skipped: false,
    refreshed: 1,
    refreshFailed: 0,
    refreshSkipped: 0,
    healthChecked: 3,
    healthRecovered: 1,
  })),
}))
vi.mock('../src/workers/relay-account-pool-worker.js', () => ({
  runTraeSessionSync: vi.fn(async () => ({ code: 0, applied: 2, skipped: 0, stderr: '' })),
  runQoderSessionSync: vi.fn(async () => ({ code: 0, applied: 1, skipped: 0, stderr: '' })),
  runWorkbuddySessionSync: vi.fn(async () => ({ code: 0, applied: 1, skipped: 0, stderr: '' })),
}))
vi.mock('../src/services/relay-pool-stats-service.js', () => ({
  refreshRelayPoolGaugesSafely: vi.fn(async () => undefined),
}))

import {
  RELAY_POOL_TASKS,
  collectRelayTaskStates,
  runRelayTaskById,
  type TaskProbeDeps,
} from '../src/services/relay-task-center.js'

const stubDeps = (over: Partial<TaskProbeDeps>): Partial<TaskProbeDeps> => over

describe('RELAY_POOL_TASKS 注册表(单一源)', () => {
  it('四载体齐、9 任务、id 唯一', () => {
    expect(RELAY_POOL_TASKS).toHaveLength(9)
    const carriers = new Set(RELAY_POOL_TASKS.map((t) => t.carrier))
    expect(carriers).toEqual(new Set(['bullmq', 'guardian', 'schtasks', 'apscheduler']))
    const ids = RELAY_POOL_TASKS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('可触发项(bullmq 五项)带 queue/schedulerId/jobName;不可触发项必带真实出路', () => {
    const triggerableIds = new Set([
      'relay-pool-sweep',
      'trae-session-sync',
      'qoder-session-sync',
      'workbuddy-session-sync',
      'relay-pool-gauge',
    ])
    for (const t of RELAY_POOL_TASKS) {
      if (triggerableIds.has(t.id)) {
        expect(t.triggerable, t.id).toBe(true)
        expect(t.queue).toBeTruthy()
        expect(t.schedulerId).toBeTruthy()
        expect(t.jobName).toBeTruthy()
      } else {
        expect(t.triggerable, t.id).toBe(false)
        expect(t.note, `${t.id} 必须给真实出路(§0.8)`).toBeTruthy()
      }
    }
  })
})

describe('collectRelayTaskStates(注入探针)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Redis 不可用 ⇒ bullmq 族 indeterminate 点名 Redis,其余族照读', async () => {
    const tasks = await collectRelayTaskStates({
      deps: stubDeps({
        readTickJson: async () => '2026-10-27T03:00:00Z',
        fetchCheckinStatus: async () => ({ schedulable: true, detail: 'ok' }),
      }),
    })
    const sweep = tasks.find((t) => t.id === 'relay-pool-sweep')!
    expect(sweep.indeterminateReason).toMatch(/Redis/)
    expect(sweep.sourceOk).toBe(false)
    const sentinel = tasks.find((t) => t.id === 'relay-capacity-sentinel')!
    expect(sentinel.lastRunAt).toBe('2026-10-27T03:00:00Z')
    expect(sentinel.sourceOk).toBe(true)
  })

  it('bullmq 全源在位 ⇒ schedulable + 上次/下次齐;上次失败透出 failedReason', async () => {
    const tasks = await collectRelayTaskStates({
      connection: { fake: true },
      deps: stubDeps({
        getSchedulerNext: async (_q, id) =>
          id === 'relay-account-pool-cron' ? 1730000000000 : null,
        getLastJobRun: async (_q, name) =>
          name === 'sweep' ? { at: 1729999700000, ok: false, detail: 'boom' } : null,
      }),
    })
    const sweep = tasks.find((t) => t.id === 'relay-pool-sweep')!
    expect(sweep.schedulable).toBe(true)
    expect(sweep.sourceOk).toBe(true)
    expect(sweep.nextRunAt).toBe(new Date(1730000000000).toISOString())
    expect(sweep.lastRunAt).toBe(new Date(1729999700000).toISOString())
    expect(sweep.lastRunOk).toBe(false)
    expect(sweep.lastRunDetail).toBe('boom')
    // trae-sync scheduler 不在且无执行记录 ⇒ 未判定点名,不冒绿
    const trae = tasks.find((t) => t.id === 'trae-session-sync')!
    expect(trae.indeterminateReason).toMatch(/worker 未启动/)
  })

  it('tick 文件不可读 ⇒ guardian/schtasks 族如实 indeterminate', async () => {
    const tasks = await collectRelayTaskStates({
      deps: stubDeps({ readTickJson: async () => null }),
    })
    for (const id of ['relay-capacity-sentinel', 'credential-health']) {
      const t = tasks.find((x) => x.id === id)!
      expect(t.indeterminateReason, id).toBeTruthy()
      expect(t.sourceOk).toBe(false)
    }
  })

  it('ai-service 报不可调度 ⇒ indeterminateReason 点名总开关,不写成健康', async () => {
    const tasks = await collectRelayTaskStates({
      deps: stubDeps({
        fetchCheckinStatus: async () => ({ schedulable: false, detail: 'disabled' }),
      }),
    })
    const c = tasks.find((t) => t.id === 'checkin-scheduler')!
    expect(c.indeterminateReason).toMatch(/CHECKIN_CRON_ENABLED/)
  })
})

describe('runRelayTaskById(触发分发,mock 执行体)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('无触发口 id ⇒ null(调用方 400 并回出路)', async () => {
    expect(await runRelayTaskById('relay-capacity-sentinel')).toBeNull()
    expect(await runRelayTaskById('checkin-scheduler')).toBeNull()
    expect(await runRelayTaskById('no-such-task')).toBeNull()
  })

  it('sweep ⇒ 摘要只读产出面真有的键;锁被别席持有不得冒"完成"', async () => {
    const r = await runRelayTaskById('relay-pool-sweep')
    expect(r?.ok).toBe(true)
    expect(r?.detail).toMatch(/刷新=1.*定级=3 恢复=1/)
    expect(r?.detail).not.toMatch(/undefined/)

    const { sweepAccountPool } = await import('../src/services/relay-account-pool-scheduler.js')
    ;(sweepAccountPool as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      skipped: true,
      refreshed: 0,
      refreshFailed: 0,
      refreshSkipped: 0,
      healthChecked: 0,
      healthRecovered: 0,
    })
    const skipped = await runRelayTaskById('relay-pool-sweep')
    expect(skipped?.ok).toBe(false)
    expect(skipped?.detail).toMatch(/未执行 ≠ 零结果/)
  })

  it('trae/qoder 回灌触发口:退出码 0 ⇒ ok;非 0(未判定)⇒ ok:false 不冒绿', async () => {
    for (const [id, exportName] of [
      ['trae-session-sync', 'runTraeSessionSync'],
      ['qoder-session-sync', 'runQoderSessionSync'],
      ['workbuddy-session-sync', 'runWorkbuddySessionSync'],
    ] as const) {
      const r = await runRelayTaskById(id)
      expect(r?.ok, id).toBe(true)
      expect(r?.detail, id).toMatch(/回灌完成:applied=/)

      const mod = await import('../src/workers/relay-account-pool-worker.js')
      mod[exportName].mockResolvedValueOnce({
        code: 2,
        applied: 0,
        skipped: 0,
        stderr: 'no client',
      })
      const r2 = await runRelayTaskById(id)
      expect(r2?.ok, `${id} 未判定不得冒绿`).toBe(false)
      expect(r2?.detail, id).toMatch(/未判定/)
    }
  })
})
