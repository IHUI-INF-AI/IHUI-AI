// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池任务中心测试(2026-10-27,缺口④;2026-10-31 签到调度三态诚实口径改造)。
 * 观测聚合走注入探针(§0.9 不碰真 Redis/真文件/真 ai-service);
 * 触发分发 mock 掉执行体模块(不真跑 DB/子进程)。
 * 三态判据一律 import 源脚本的 __test__(§22c:测试里复制判据必然漂移,守门 191 判)。
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
// 内部系统票铸造器:测试里不真签 JWT(config.JWT_SECRET 可能为空),只验"带没带"
vi.mock('../src/utils/system-access-token.js', () => ({
  getSystemAccessToken: vi.fn(async () => 'mocked-system-token'),
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
  defaultProbeDeps,
  runRelayTaskById,
  __test__,
  type TaskProbeDeps,
} from '../src/services/relay-task-center.js'

const stubDeps = (over: Partial<TaskProbeDeps>): Partial<TaskProbeDeps> => over

/** 签到调度响应体的「跑起来」形态(ai-service CheckinScheduler.status() 的真实字段) */
const RUNNING_BODY = {
  enabled: true,
  started: true,
  next_run: '2026-11-01T08:05:00+08:00',
  next_run_qoder: '2026-11-01T10:05:00+08:00',
  next_run_probe: '2026-11-01T06:00:00+08:00',
  next_run_wb_tasks: '2026-11-01T03:00:00+08:00',
  wb_tasks: {
    enabled: true,
    tasks_enabled: true,
    cron_enabled: true,
    live_run: false,
    sweep_minutes: 180,
    claim_path_configured: true,
    activity_path_configured: false,
    last_sweep: null,
  },
}

/** 总闸关(CHECKIN_CRON_ENABLED=false)的真实形态:start() 整个函数体被门拦住 */
const RUNNING_BODY_DISABLED = {
  ...RUNNING_BODY,
  enabled: false,
  started: false,
  next_run: null,
  next_run_qoder: null,
  next_run_probe: null,
  next_run_wb_tasks: null,
  wb_tasks: { ...RUNNING_BODY.wb_tasks, enabled: false, cron_enabled: false },
}

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
  it('签到调度注册项与实际注册的 job 齐(2026-10-31 补 WorkBuddy 任务巡检腿)', () => {
    const c = RELAY_POOL_TASKS.find((t) => t.id === 'checkin-scheduler')!
    expect(c.schedule).toMatch(/06:00/)
    expect(c.schedule).toMatch(/WorkBuddy 任务巡检/)
  })
})

describe('collectRelayTaskStates(注入探针)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Redis 不可用 ⇒ bullmq 族 indeterminate 点名 Redis,其余族照读', async () => {
    const tasks = await collectRelayTaskStates({
      deps: stubDeps({
        readTickJson: async () => '2026-10-27T03:00:00Z',
        fetchCheckinStatus: async () =>
          __test__.judgeCheckinSchedulerStatus({ kind: 'ok', status: 200, body: RUNNING_BODY }),
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

  it('三态·running ⇒ schedulable + 真实 next_run 进面板,不塞原始 JSON 转储', async () => {
    const tasks = await collectRelayTaskStates({
      deps: stubDeps({
        fetchCheckinStatus: async () =>
          __test__.judgeCheckinSchedulerStatus({ kind: 'ok', status: 200, body: RUNNING_BODY }),
      }),
    })
    const c = tasks.find((t) => t.id === 'checkin-scheduler')!
    expect(c.schedulable).toBe(true)
    expect(c.sourceOk).toBe(true)
    expect(c.indeterminateReason).toBeNull()
    expect(c.nextRunAt).toBe('2026-11-01T08:05:00+08:00')
    // 面板读的是取到的真实字段,不是被 slice(0,200) 截断的原始 JSON
    expect(c.lastRunDetail).toMatch(/已启动/)
    expect(c.lastRunDetail).not.toMatch(/^\{/)
  })

  it('三态·disabled(门关)⇒ schedulable:false + 点名闸门 env,不记未判定', async () => {
    const tasks = await collectRelayTaskStates({
      deps: stubDeps({
        fetchCheckinStatus: async () =>
          __test__.judgeCheckinSchedulerStatus({
            kind: 'ok',
            status: 200,
            body: RUNNING_BODY_DISABLED,
          }),
      }),
    })
    const c = tasks.find((t) => t.id === 'checkin-scheduler')!
    expect(c.schedulable).toBe(false)
    // 端点通了 = 状态源在位,这不是"没判",不得混进 indeterminate(§0.3 双向)
    expect(c.sourceOk).toBe(true)
    expect(c.indeterminateReason).toBeNull()
    expect(c.disabledReason).toMatch(/CHECKIN_CRON_ENABLED/)
  })

  it('三态·unjudged(HTTP 401)⇒ 如实点名 401,禁止冒 CHECKIN_CRON_ENABLED 猜测归因', async () => {
    const tasks = await collectRelayTaskStates({
      deps: stubDeps({
        fetchCheckinStatus: async () =>
          __test__.judgeCheckinSchedulerStatus({ kind: 'http-error', status: 401 }),
      }),
    })
    const c = tasks.find((t) => t.id === 'checkin-scheduler')!
    expect(c.schedulable).toBe(false)
    expect(c.sourceOk).toBe(false)
    expect(c.indeterminateReason).toMatch(/HTTP 401/)
    // 旧的猜测性归因不得加回:按它去设 env 永远修不好(§5e-1 可整改性)
    expect(c.indeterminateReason).not.toMatch(/CHECKIN_CRON_ENABLED/)
    expect(c.disabledReason).toBeNull()
  })

  it('deps 完全没给结论(null)⇒ 未判定点名"无结论",不记绿也不记红', async () => {
    const tasks = await collectRelayTaskStates({
      deps: stubDeps({ fetchCheckinStatus: async () => null }),
    })
    const c = tasks.find((t) => t.id === 'checkin-scheduler')!
    expect(c.schedulable).toBe(false)
    expect(c.sourceOk).toBe(false)
    expect(c.indeterminateReason).toMatch(/无结论|不可达/)
  })
})

describe('judgeCheckinSchedulerStatus(纯判据,七种响应形态)', () => {
  const judge = __test__.judgeCheckinSchedulerStatus

  it('200 + started=true ⇒ running,nextRunAt 取体里的 next_run', () => {
    const r = judge({ kind: 'ok', status: 200, body: RUNNING_BODY })
    expect(r.state).toBe('running')
    expect(r.nextRunAt).toBe('2026-11-01T08:05:00+08:00')
    expect(r.gateHint).toBeNull()
    expect(r.detail).toContain('2026-11-01T08:05:00+08:00')
  })

  it('200 + enabled=false(总闸关)⇒ disabled 且点名 CHECKIN_CRON_ENABLED=true 并重启', () => {
    const r = judge({ kind: 'ok', status: 200, body: RUNNING_BODY_DISABLED })
    expect(r.state).toBe('disabled')
    expect(r.gateHint).toMatch(/CHECKIN_CRON_ENABLED=true/)
    expect(r.gateHint).toMatch(/重启/)
    expect(r.nextRunAt).toBeNull()
  })

  it('200 + 总闸开但 started=false ⇒ disabled 归因为"启动失败,看 ai-service 日志"', () => {
    const r = judge({
      kind: 'ok',
      status: 200,
      body: { ...RUNNING_BODY, started: false, next_run: null },
    })
    expect(r.state).toBe('disabled')
    expect(r.gateHint).toMatch(/未启动/)
    expect(r.gateHint).toMatch(/日志/)
    // 门是开的,不得再让用户去设 CHECKIN_CRON_ENABLED(归因必须落在真闸门上)
    expect(r.gateHint).not.toMatch(/CHECKIN_CRON_ENABLED/)
  })

  it('200 + WorkBuddy 任务门关 ⇒ 主调度结论不变,出路点名 WORKBUDDY_TASKS_ENABLED', () => {
    const r = judge({
      kind: 'ok',
      status: 200,
      body: {
        ...RUNNING_BODY,
        wb_tasks: { ...RUNNING_BODY.wb_tasks, enabled: false, tasks_enabled: false },
      },
    })
    expect(r.state).toBe('running')
    expect(r.detail).toMatch(/WORKBUDDY_TASKS_ENABLED/)
  })

  it('旧服务端(体里没 not_running_reason)+ 两门皆开而 job 没注册 ⇒ 只能说"没重启",不许推给任务门', () => {
    const r = judge({
      kind: 'ok',
      status: 200,
      body: {
        ...RUNNING_BODY,
        wb_tasks: {
          ...RUNNING_BODY.wb_tasks,
          enabled: false,
          tasks_enabled: true,
          cron_enabled: true,
        },
      },
    })
    expect(r.detail).toMatch(/按两门现推/)
    expect(r.detail).toMatch(/重启 ai-service/)
    expect(r.detail).not.toMatch(/WORKBUDDY_TASKS_ENABLED=false/)
    expect(r.detail).not.toMatch(/巡检在跑/)
  })

  it('旧服务端 + 总闸关 ⇒ 点名 CHECKIN_CRON_ENABLED(不误指任务门,照错提示配 env 永远修不好)', () => {
    const r = judge({
      kind: 'ok',
      status: 200,
      body: {
        ...RUNNING_BODY,
        wb_tasks: {
          ...RUNNING_BODY.wb_tasks,
          enabled: false,
          tasks_enabled: true,
          cron_enabled: false,
        },
      },
    })
    expect(r.detail).toMatch(/CHECKIN_CRON_ENABLED/)
    expect(r.detail).not.toMatch(/WORKBUDDY_TASKS_ENABLED=false/)
  })

  it('连两门意图位都读不到 ⇒ 落未判定,不点名任何闸门 env(§0.3 不猜)', () => {
    const r = judge({
      kind: 'ok',
      status: 200,
      body: { ...RUNNING_BODY, wb_tasks: { enabled: false } },
    })
    expect(r.detail).toMatch(/不猜卡在哪一层/)
    expect(r.detail).not.toMatch(/WORKBUDDY_TASKS_ENABLED|CHECKIN_CRON_ENABLED/)
  })

  it('200 + not_running_reason 点名(引擎侧枚举四档)⇒ 逐 reason 给对应 env 出路', () => {
    for (const [reason, expected] of [
      ['tasks_gate_off', /WORKBUDDY_TASKS_ENABLED/],
      ['cron_gate_off', /CHECKIN_CRON_ENABLED/],
      ['scheduler_not_started', /未启动/],
      ['job_not_registered', /重启/],
    ] as const) {
      const r = judge({
        kind: 'ok',
        status: 200,
        body: { ...RUNNING_BODY_DISABLED, wb_tasks: { not_running_reason: reason } },
      })
      expect(r.state, reason).toBe('disabled')
      expect(r.gateHint ?? r.detail, reason).toMatch(expected)
    }
  })

  it('200 + 主调度在跑但巡检 job 没注册 ⇒ 不得拿 wb_tasks.enabled=true 冒"巡检在跑"', () => {
    const r = judge({
      kind: 'ok',
      status: 200,
      body: {
        ...RUNNING_BODY,
        wb_tasks: {
          ...RUNNING_BODY.wb_tasks,
          enabled: true,
          not_running_reason: 'job_not_registered',
        },
      },
    })
    expect(r.state).toBe('running')
    expect(r.detail).toMatch(/巡检未在跑/)
    expect(r.detail).not.toMatch(/巡检在跑/)
  })

  it('200 + 响应体读不懂 ⇒ unjudged(不冒绿也不猜门关)', () => {
    for (const body of [null, 'not json', 42, {}, { enabled: 'yes', started: 1 }]) {
      const r = judge({ kind: 'ok', status: 200, body })
      expect(r.state, JSON.stringify(body)).toBe('unjudged')
      expect(r.detail).toMatch(/读不懂/)
      expect(r.detail).not.toMatch(/CHECKIN_CRON_ENABLED/)
    }
  })

  it('非 200(401/403/500)⇒ unjudged 且如实写真实状态码,禁止猜测性归因', () => {
    for (const status of [401, 403, 500]) {
      const r = judge({ kind: 'http-error', status })
      expect(r.state, String(status)).toBe('unjudged')
      expect(r.detail, String(status)).toContain(`HTTP ${status}`)
      expect(r.detail).not.toMatch(/CHECKIN_CRON_ENABLED/)
    }
    // 401 特别要求:给出"端点需身份"这一真实归因与可核查出路(§5e-1)
    const r401 = judge({ kind: 'http-error', status: 401 })
    expect(r401.detail).toMatch(/身份/)
  })

  it('连接层失败 ⇒ unjudged 且原样带上错误文本', () => {
    const r = judge({
      kind: 'transport-error',
      message: 'fetch failed: ECONNREFUSED 127.0.0.1:8803',
    })
    expect(r.state).toBe('unjudged')
    expect(r.detail).toMatch(/ECONNREFUSED/)
    expect(r.detail).not.toMatch(/CHECKIN_CRON_ENABLED/)
  })
})

describe('defaultProbeDeps.fetchCheckinStatus(真出口形状)', () => {
  /** deps 出口类型允许 null(= 压根没给结论);真实现必须回三态之一,拿到 null 就是缺陷 ⇒ 直接抛 */
  const fetchStatus = async () => {
    const r = await defaultProbeDeps(() => null).fetchCheckinStatus('http://127.0.0.1:8803')
    if (!r) throw new Error('默认实现返回 null(三态判据必须出结论,不得"没给")')
    return r
  }

  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('带 ai-service 认得的内部系统票(Authorization Bearer),不自造对方不认的头', async () => {
    const calls: Array<{ url: string; headers: Headers }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | undefined, init?: RequestInit) => {
        calls.push({ url: String(url), headers: new Headers(init?.headers ?? {}) })
        return new Response(JSON.stringify(RUNNING_BODY), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }),
    )
    const { getSystemAccessToken } = await import('../src/utils/system-access-token.js')
    const r = await fetchStatus()
    expect(calls[0]!.url).toBe('http://127.0.0.1:8803/api/checkin/scheduler/status')
    expect(calls[0]!.headers.get('authorization')).toBe('Bearer mocked-system-token')
    expect(getSystemAccessToken).toHaveBeenCalled()
    expect(r.state).toBe('running')
  })

  it('401 ⇒ 如实 unjudged 点名 HTTP 401(生产态裸 fetch 的真实结局),不冒 CHECKIN_CRON_ENABLED', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"detail":"Not authenticated"}', { status: 401 })),
    )
    const r = await fetchStatus()
    expect(r.state).toBe('unjudged')
    expect(r.detail).toMatch(/HTTP 401/)
    expect(r.detail).not.toMatch(/CHECKIN_CRON_ENABLED/)
  })

  it('连接失败 ⇒ unjudged 带真实错误,不冒绿', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:8803')
      }),
    )
    const r = await fetchStatus()
    expect(r.state).toBe('unjudged')
    expect(r.detail).toMatch(/ECONNREFUSED/)
  })

  it('200 但体不是 JSON ⇒ unjudged(读不懂就是不判)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>502 upstream</html>', { status: 200 })),
    )
    const r = await fetchStatus()
    expect(r.state).toBe('unjudged')
    expect(r.detail).toMatch(/读不懂/)
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
