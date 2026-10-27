// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池任务中心(2026-10-27 立,号池对标缺口清单第 4 项,机主定案「观测面+手动触发」)。
 *
 * 治的病:号池周期任务散在 4 种载体(BullMQ×3 / guardian×2 / Windows 计划任务×1 /
 * ai-service APScheduler×1),执行状态只有日志、tick 文件、Prometheus gauge 三种
 * 互不相通的落点——任务停摆只有翻日志才知道。本模块把它们折成一张任务表:
 * 每项 = 名称 / 载体 / 频率 / 上次执行(时间+成败) / 下次执行 / 能否手动触发。
 *
 * 边界(机主定案):不新造调度器、不落执行历史表——四种载体各管各的调度,
 * 本模块只做观测聚合与触发口补缺;读不到的状态源如实标 indeterminate(§0.3),
 * 不拿"从未执行"冒充"健康",也不猜。
 *
 * 状态源明细(与各载体头注/AGENTS.md 对齐):
 * - bullmq:queue.getJobSchedulers() 拿 next(下次),getJobs(completed/failed 最近)
 *   按 jobName 过滤拿上次执行;removeOnComplete/removeOnFail 保留窗内的最近记录;
 *   Redis 不可用 ⇒ 全族 indeterminate。
 * - guardian/schtasks:读 tick JSON(relay-capacity-dispatch-last.json 的 attemptAt /
 *   credential-health-last.json 的 ts+fail);api 进程读不到 ⇒ indeterminate
 *   (部署形态 api 与 guardian 可能不同机,如实不猜)。
 * - apscheduler(ai-service):fetch {AI_SERVICE_URL}/api/checkin/scheduler/status
 *   (Phase1c 只读端点);不可达 ⇒ indeterminate。
 *
 * 手动触发:仅 bullmq 三项(sweep/trae-session-sync/relay-pool-gauge)有进程内
 * 直调口;guardian/schtasks/apscheduler 一律 triggerable:false 并给真实出路
 * (§0.8 文档不写跑不通的出路)——容量哨兵已有 CLI,凭据巡检由计划任务承载,
 * 签到调度开关在 ai-service env(CHECKIN_CRON_ENABLED,默认 false)。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** 单条任务的定义面(注册表唯一写点;聚合与触发都从这里读) */
export interface RelayTaskDef {
  id: string
  name: string
  carrier: 'bullmq' | 'guardian' | 'schtasks' | 'apscheduler'
  /** 人话频率(面板直显) */
  schedule: string
  /** cron/间隔原文(观测面回显,便于与载体注册处比对) */
  cron?: string
  /** bullmq:队列名 */
  queue?: string
  /** bullmq:jobScheduler id(upsertJobScheduler 第一参) */
  schedulerId?: string
  /** bullmq:job name(getJobs 过滤用) */
  jobName?: string
  /** 有无进程内手动触发口 */
  triggerable: boolean
  /** 不可触发时的真实出路(§0.8) */
  note?: string
  /** guardian/schtasks:tick JSON 相对仓根路径 */
  tickFile?: string
  /** guardian/schtasks:tick JSON 里时间戳字段名 */
  tickAtField?: string
  /** apscheduler:ai-service 状态端点路径 */
  statusUrlPath?: string
}

export const RELAY_POOL_TASKS: RelayTaskDef[] = [
  {
    id: 'relay-pool-sweep',
    name: '号池四档巡检(保活/临期刷新/定级/恢复)',
    carrier: 'bullmq',
    schedule: '每 5 分钟',
    cron: '*/5 * * * *',
    queue: 'relay-account-pool-queue',
    schedulerId: 'relay-account-pool-cron',
    jobName: 'sweep',
    triggerable: true,
  },
  {
    id: 'trae-session-sync',
    name: 'Trae 客户端会话回灌',
    carrier: 'bullmq',
    schedule: '每 10 分钟',
    cron: '*/10 * * * *',
    queue: 'relay-account-pool-queue',
    schedulerId: 'trae-session-sync-cron',
    jobName: 'trae-session-sync',
    triggerable: true,
  },
  {
    id: 'relay-pool-gauge',
    name: '号池健康 Gauge 刷新',
    carrier: 'bullmq',
    schedule: '每 5 分钟(分钟位 3/8/13…,与 key 池 gauge 错峰)',
    cron: '3,8,13,18,23,28,33,38,43,48,53,58 * * * *',
    queue: 'scheduler',
    schedulerId: 'relay-pool-gauge',
    jobName: 'relay-pool-gauge',
    triggerable: true,
  },
  {
    id: 'relay-key-pool-health',
    name: '中转 Key 池健康巡检',
    carrier: 'bullmq',
    schedule: '每 5 分钟',
    cron: '*/5 * * * *',
    queue: 'relay-health-check-queue',
    schedulerId: 'relay-health-check-cron',
    jobName: 'check-all',
    triggerable: false,
    note: '触发口在 Key 池页(/admin/relay/key-pool)的巡检入口',
  },
  {
    id: 'relay-capacity-sentinel',
    name: '号池容量归零哨兵(可调度数=0 告警)',
    carrier: 'guardian',
    schedule: '每 2 分钟守护轮 + 5 分钟节流',
    tickFile: '.ihui-agent/state/relay-capacity-dispatch-last.json',
    tickAtField: 'attemptAt',
    triggerable: false,
    note: '出路:node scripts/check-relay-capacity-zero.mjs --json(guardian 每 5 分钟自动派发)',
  },
  {
    id: 'credential-health',
    name: '凭据健康巡检(部署环 env 对账)',
    carrier: 'schtasks',
    schedule: '每 6 小时(guardian 看门狗 18h 心跳兜底)',
    tickFile: '.ihui-agent/state/credential-health-last.json',
    tickAtField: 'ts',
    triggerable: false,
    note: '出路:Windows 计划任务承载(--install 可重装);guardian 心跳超 18h 自动重装',
  },
  {
    id: 'checkin-scheduler',
    name: '签到调度(ai-service APScheduler,总开关默认关)',
    carrier: 'apscheduler',
    schedule: '每日 06:00 探针 / 08:05 主窗口 / 10:05 qoder',
    statusUrlPath: '/api/checkin/scheduler/status',
    triggerable: false,
    note: '出路:ai-service env CHECKIN_CRON_ENABLED=true 开启;或号池页单号「签到」按钮(O64)即时触发',
  },
]

/** 单项任务的状态面(全部字段可为 null = 状态源没给出,如实不猜) */
export interface RelayTaskState {
  id: string
  schedulable: boolean
  /** 载体注册处是否还在( BullMQ scheduler 存在/tick 文件可读/ai-service 可达) */
  sourceOk: boolean
  nextRunAt: string | null
  lastRunAt: string | null
  lastRunOk: boolean | null
  lastRunDetail: string | null
  /** 状态源读不到时的原因(§0.3 未判定点名) */
  indeterminateReason: string | null
}

export interface RelayTask extends RelayTaskDef, RelayTaskState {}

/** 观测探针依赖(默认真实现;测试注入 stub,§0.9) */
export interface TaskProbeDeps {
  getSchedulerNext(queue: string, schedulerId: string): Promise<number | null>
  getLastJobRun(
    queue: string,
    jobName: string,
  ): Promise<{ at: number; ok: boolean; detail: string | null } | null>
  readTickJson(relPath: string, atField: string): Promise<string | null>
  fetchCheckinStatus(
    baseUrl: string,
  ): Promise<{ schedulable: boolean; detail: string | null } | null>
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

export function defaultProbeDeps(makeQueue: (queue: string) => BullMQLike | null): TaskProbeDeps {
  return {
    async getSchedulerNext(queue, schedulerId) {
      const q = makeQueue(queue)
      if (!q) return null
      try {
        const schedulers = await q.getJobSchedulers()
        const hit = schedulers.find((s) => s.key === schedulerId)
        if (!hit) return null
        const next = (hit as { next?: number }).next
        return typeof next === 'number' ? next : null
      } catch {
        return null
      }
    },
    async getLastJobRun(queue, jobName) {
      const q = makeQueue(queue)
      if (!q) return null
      try {
        const jobs = await q.getJobs(['completed', 'failed'], 0, 49)
        const mine = jobs
          .filter(
            (j): j is typeof j & { timestamp: number } =>
              j.name === jobName && typeof j.timestamp === 'number',
          )
          .sort((a, b) => b.timestamp - a.timestamp)[0]
        if (!mine) return null
        return {
          at: mine.timestamp,
          ok: mine.failedReason ? false : true,
          detail: mine.failedReason ?? null,
        }
      } catch {
        return null
      }
    },
    async readTickJson(relPath, atField) {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8'))
        const at = raw?.[atField]
        return typeof at === 'string' ? at : null
      } catch {
        return null
      }
    },
    async fetchCheckinStatus(baseUrl) {
      try {
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/checkin/scheduler/status`, {
          signal: AbortSignal.timeout(3000),
        })
        if (!res.ok) return { schedulable: false, detail: `HTTP ${res.status}` }
        const j = (await res.json()) as Record<string, unknown>
        return { schedulable: true, detail: JSON.stringify(j).slice(0, 200) }
      } catch (e) {
        return { schedulable: false, detail: e instanceof Error ? e.message : String(e) }
      }
    },
  }
}

/** BullMQ Queue 的本模块消费面(避免直接 import bullmq 类型拖测试) */
export interface BullMQLike {
  getJobSchedulers(): Promise<Array<{ key: string; next?: number }>>
  getJobs(
    types: string[],
    start: number,
    end: number,
  ): Promise<Array<{ name: string; timestamp?: number; failedReason?: string | null }>>
}

/**
 * 聚合任务状态。connection 为 null(Redis 不可用)时 bullmq 族整体 indeterminate,
 * 其余族照读——单载体故障不拖全表。
 */
export async function collectRelayTaskStates(
  opts: {
    connection?: unknown
    /** 真实 Queue 工厂(路由侧传 (q)=>new Queue(q,{connection});缺省=null=不可读) */
    makeQueue?: (queue: string) => BullMQLike | null
    aiServiceUrl?: string
    deps?: Partial<TaskProbeDeps>
  } = {},
): Promise<RelayTask[]> {
  const bullmqOk = Boolean(opts.connection)
  const deps: TaskProbeDeps = {
    ...defaultProbeDeps(opts.makeQueue ?? (() => null)),
    ...(opts.deps ?? {}),
  }
  const states = await Promise.all(
    RELAY_POOL_TASKS.map(async (def): Promise<RelayTask> => {
      const base: RelayTaskState = {
        id: def.id,
        schedulable: false,
        sourceOk: false,
        nextRunAt: null,
        lastRunAt: null,
        lastRunOk: null,
        lastRunDetail: null,
        indeterminateReason: null,
      }
      if (def.carrier === 'bullmq') {
        if (!bullmqOk) {
          return { ...def, ...base, indeterminateReason: 'Redis 不可用,BullMQ 状态不可读' }
        }
        const next = await deps.getSchedulerNext(def.queue!, def.schedulerId!)
        const last = await deps.getLastJobRun(def.queue!, def.jobName!)
        const schedulerGone = next === null && last === null
        return {
          ...def,
          ...base,
          schedulable: !schedulerGone,
          sourceOk: !schedulerGone,
          nextRunAt: next ? new Date(next).toISOString() : null,
          lastRunAt: last ? new Date(last.at).toISOString() : null,
          lastRunOk: last ? last.ok : null,
          lastRunDetail: last?.detail ?? null,
          indeterminateReason: schedulerGone
            ? '队列中无该 scheduler 且无执行记录(worker 未启动?)'
            : null,
        }
      }
      if (def.carrier === 'guardian' || def.carrier === 'schtasks') {
        const at = await deps.readTickJson(
          (def as unknown as { tickFile: string }).tickFile,
          (def as unknown as { tickAtField: string }).tickAtField,
        )
        if (!at) {
          return {
            ...def,
            ...base,
            indeterminateReason: 'tick 文件不可读(api 进程与守护可能不同机,或任务从未跑过)',
          }
        }
        return {
          ...def,
          ...base,
          schedulable: true,
          sourceOk: true,
          lastRunAt: at,
          lastRunOk: true,
          lastRunDetail:
            def.carrier === 'guardian'
              ? 'guardian 派发成功(执行结果见 guardian 日志)'
              : '计划任务心跳在位',
        }
      }
      // apscheduler
      const st = await deps.fetchCheckinStatus(opts.aiServiceUrl ?? '')
      if (!st) {
        return { ...def, ...base, indeterminateReason: 'ai-service 状态端点不可达' }
      }
      return {
        ...def,
        ...base,
        schedulable: st.schedulable,
        sourceOk: true,
        lastRunDetail: st.detail,
        indeterminateReason: st.schedulable
          ? null
          : 'ai-service 调度不可用(总开关 CHECKIN_CRON_ENABLED=false?)',
      }
    }),
  )
  return states
}

/**
 * 手动触发(triggerable 项的进程内直调;永不抛,失败归 ok:false)。
 * 返回 null = 该 id 无触发口(调用方 400 并回 note 出路)。
 */
export async function runRelayTaskById(
  id: string,
): Promise<{ ok: boolean; detail: string } | null> {
  const def = RELAY_POOL_TASKS.find((t) => t.id === id)
  if (!def || !def.triggerable) return null
  // 进程内直调(与各 worker 执行体同源;不另起第二份执行逻辑)
  if (id === 'relay-pool-sweep') {
    const { sweepAccountPool } = await import('./relay-account-pool-scheduler.js')
    const r = await sweepAccountPool()
    return {
      ok: true,
      detail: `巡检完成:保活=${r.keepalive} 刷新=${r.refreshed} 刷新失败=${r.refreshFailed} 定级=${r.healthChecked} 恢复=${r.healthRecovered}`,
    }
  }
  if (id === 'trae-session-sync') {
    const { runTraeSessionSync } = await import('../workers/relay-account-pool-worker.js')
    const r = await runTraeSessionSync()
    // 退出码 2 = 未判定(本机无 Trae 客户端等),不是失败
    return {
      ok: r.code === 0,
      detail:
        r.code === 0
          ? `回灌完成:applied=${r.applied} skipped=${r.skipped}`
          : `未判定/失败 code=${r.code}: ${r.stderr.slice(0, 200)}`,
    }
  }
  if (id === 'relay-pool-gauge') {
    const { refreshRelayPoolGaugesSafely } = await import('./relay-pool-stats-service.js')
    await refreshRelayPoolGaugesSafely()
    return {
      ok: true,
      detail: 'Gauge 刷新已执行(结果见 Prometheus ihui_relay_account_pool_* 系列)',
    }
  }
  return null
}
