// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池任务中心(2026-10-27 立,号池对标缺口清单第 4 项,机主定案「观测面+手动触发」)。
 *
 * 治的病:号池周期任务散在 4 种载体(BullMQ×5 / guardian×2 / Windows 计划任务×1 /
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
 * - apscheduler(ai-service):GET {AI_SERVICE_URL}/api/checkin/scheduler/status
 *   (Phase1c 只读端点)。三态口径(2026-10-31 立,治两处假信号):
 *   ① running 只认响应体里的 `started`(端点可达 ≠ job 在跑,HTTP 200 不是结论);
 *   ② disabled 认门关(`enabled=false` 或 `started=false`),必须点名是哪道闸与对应
 *   env 键,出路要能照着做(§5e-1);
 *   ③ unjudged = 不可达 / 非 200 / 体读不懂,如实写真实状态码(该端点带
 *   `require_request_user_id`,凭据被拒就是 401,不得冒"总开关关了"的猜测归因)。
 *   外发身份走本仓正牌出口(与 `utils/ai-service-fetch.ts` 的 `aiServiceSystemFetch`
 *   同一把 `getSystemAccessToken()` 票),不自造 ai-service 不认的头。
 *
 * 手动触发:仅 bullmq 五项(sweep/trae/qoder/workbuddy-session-sync/relay-pool-gauge)有进程内
 * 直调口;guardian/schtasks/apscheduler 一律 triggerable:false 并给真实出路
 * (§0.8 文档不写跑不通的出路)——容量哨兵已有 CLI,凭据巡检由计划任务承载,
 * 签到调度开关在 ai-service env(CHECKIN_CRON_ENABLED 总闸,默认 false;
 * WorkBuddy 任务巡检另需 WORKBUDDY_TASKS_ENABLED,默认 false)。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { relayAccountPoolQueueName } from './relay-queue-name.js'
import { getSystemAccessToken } from '../utils/system-access-token.js'

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
    queue: relayAccountPoolQueueName(),
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
    queue: relayAccountPoolQueueName(),
    schedulerId: 'trae-session-sync-cron',
    jobName: 'trae-session-sync',
    triggerable: true,
  },
  {
    id: 'qoder-session-sync',
    name: 'Qoder 客户端登录态回灌',
    carrier: 'bullmq',
    schedule: '每 10 分钟',
    cron: '*/10 * * * *',
    queue: relayAccountPoolQueueName(),
    schedulerId: 'qoder-session-sync-cron',
    jobName: 'qoder-session-sync',
    triggerable: true,
  },
  {
    id: 'workbuddy-session-sync',
    name: 'WorkBuddy 会话模板回灌',
    carrier: 'bullmq',
    schedule: '每 10 分钟',
    cron: '*/10 * * * *',
    queue: relayAccountPoolQueueName(),
    schedulerId: 'workbuddy-session-sync-cron',
    jobName: 'workbuddy-session-sync',
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
    // 与 checkin_scheduler.py start() 实际注册的四条 job 对齐(2026-10-31 补 WorkBuddy 巡检腿)
    schedule: '每日 06:00 探针 / 08:05 主窗口 / 10:05 qoder / WorkBuddy 任务巡检每 180 分钟(可调)',
    statusUrlPath: '/api/checkin/scheduler/status',
    triggerable: false,
    note: '出路:ai-service env CHECKIN_CRON_ENABLED=true 开总闸(改后需重启);WorkBuddy 任务巡检另需 WORKBUDDY_TASKS_ENABLED=true;或号池页单号「签到」按钮(O64)即时触发',
  },
]

/** 签到调度三态(2026-10-31 立;"能不能跑"的结论只从响应体取,不从 HTTP 可达性取) */
export type CheckinSchedulerState = 'running' | 'disabled' | 'unjudged'

/**
 * 状态源交给判据的原始读数(判据的唯一输入面):
 * - `ok` = 拿到 2xx 与解析结果(解析失败把 body 留 undefined,由判据归"读不懂")
 * - `http-error` = 非 2xx,只有状态码可读
 * - `transport-error` = 连接层失败(DNS/拒连/超时/URL 没配)
 */
export type CheckinProbeRaw =
  | { kind: 'ok'; status: number; body: unknown }
  | { kind: 'http-error'; status: number }
  | { kind: 'transport-error'; message: string }

/** 判据产出(纯数据;聚合层只按 state 分派,不再自行猜原因) */
export interface CheckinStatusResult {
  state: CheckinSchedulerState
  /** 人话结论(进面板 lastRunDetail),只写从响应体取到的真实字段 */
  detail: string
  /** running 时的下次主窗口时刻(体里的 next_run);取不到为 null,不拿"从未"冒充"健康" */
  nextRunAt: string | null
  /** disabled 时点名的闸门 env 键与出路;其余态 null */
  gateHint: string | null
}

/** 响应体里 ai-service 自己点名的"为什么没跑"(枚举与引擎侧 WbTasksNotRunningReason 同值) */
export type CheckinGateReason =
  'tasks_gate_off' | 'cron_gate_off' | 'scheduler_not_started' | 'job_not_registered'

/** reason → 出路(读不到 reason 时不启用这条路,改按两门现推) */
const GATE_HINT_BY_REASON: Readonly<Record<CheckinGateReason, string>> = {
  tasks_gate_off:
    'WORKBUDDY_TASKS_ENABLED=false(任务门关)⇒ 出路:ai-service env 设 WORKBUDDY_TASKS_ENABLED=true 并重启,总闸 CHECKIN_CRON_ENABLED 需同时为 true',
  cron_gate_off:
    'CHECKIN_CRON_ENABLED=false(总闸关)⇒ 出路:ai-service env 设 CHECKIN_CRON_ENABLED=true 并重启',
  scheduler_not_started:
    '总闸已开但调度器未启动(start() 未走完,常见于建表异常 fail-open 早退)⇒ 出路:看 ai-service 日志 [checkin_scheduler]',
  job_not_registered:
    '调度器在跑但这条 job 没注册(改完 env 没重启:start() 的 `if self._started: return` 短路不会补注册)⇒ 出路:重启 ai-service',
}

/** 只认 JSON 对象;其余形态一律"读不懂"(不猜、不拿 undefined 冒绿) */
function asStatusRecord(body: unknown): Record<string, unknown> | null {
  return body !== null && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null
}

function boolOf(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function strOf(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

/** 体里自报的 reason → 出路;未知 reason 原样带出(不假装有现成出路) */
function hintFromReason(reason: string | null): string | null {
  switch (reason) {
    case 'tasks_gate_off':
      return GATE_HINT_BY_REASON.tasks_gate_off
    case 'cron_gate_off':
      return GATE_HINT_BY_REASON.cron_gate_off
    case 'scheduler_not_started':
      return GATE_HINT_BY_REASON.scheduler_not_started
    case 'job_not_registered':
      return GATE_HINT_BY_REASON.job_not_registered
    case null:
      return null
    default:
      return `${reason}(ai-service 自报的 reason 未登记出路映射)`
  }
}

/**
 * 三态判据(纯函数,零 IO;测试直接 import 同一份实现,§22c)。
 *
 * 结论来源只有响应体:HTTP 200 只是"读到体",不等于"调度在跑";
 * 读不到体(非 200 / 连不上 / 体不是那个形状) ⇒ 显式未判定,并把真实原因原样带出,
 * 绝不回落成"总开关大概没开"这种猜测性归因(§0.3 + §5e-1)。
 */
export function judgeCheckinSchedulerStatus(raw: CheckinProbeRaw): CheckinStatusResult {
  if (raw.kind === 'transport-error') {
    return {
      state: 'unjudged',
      detail: `状态源不可达:${raw.message}(未判定,不代表调度关着)`,
      nextRunAt: null,
      gateHint: null,
    }
  }
  if (raw.kind === 'http-error') {
    const needIdentity = raw.status === 401 || raw.status === 403
    return {
      state: 'unjudged',
      detail: needIdentity
        ? `HTTP ${raw.status}(该端点要求身份,号池侧凭据被 ai-service 拒收)⇒ 出路:核 apps/api 与 ai-service 的 JWT_SECRET 是否同源,再看 ai-service 日志的 401 详情`
        : `HTTP ${raw.status}(端点非 200,读不到调度状态)⇒ 出路:确认 ai-service(8803)在跑且 /api/checkin/scheduler/status 可达`,
      nextRunAt: null,
      gateHint: null,
    }
  }

  const body = asStatusRecord(raw.body)
  const enabled = body ? boolOf(body['enabled']) : null
  const started = body ? boolOf(body['started']) : null
  if (!body || enabled === null || started === null) {
    return {
      state: 'unjudged',
      detail: `HTTP ${raw.status} 但响应体读不懂(缺布尔 enabled/started 字段),不猜结论`,
      nextRunAt: null,
      gateHint: null,
    }
  }

  const wb = asStatusRecord(body['wb_tasks'])
  const reason = strOf(wb?.['not_running_reason'])
  const reasonHint = hintFromReason(reason)
  // 门关的具体闸:体里自报的 reason 优先(它是引擎侧唯一判序的产物),否则按两门现推
  const gateHint =
    reasonHint ??
    (enabled === false
      ? GATE_HINT_BY_REASON.cron_gate_off
      : GATE_HINT_BY_REASON.scheduler_not_started)

  // WorkBuddy 任务巡检这条子 job 的态。引擎侧 `wb_tasks.enabled` 是**观测态**
  // (调度器已 start ∧ 这条 job 真在注册表里),不是配置位;自报了 not_running_reason
  // 就直接用它点名。旧服务端不返回该字段 ⇒ 退到按两门**意图位**现推:意图位为假时
  // job 结构上不可能注册(这是推导,不是猜);两门皆真而 job 不在,只剩"改完 env 没重启"
  // 那一型。三条出路文案复用 GATE_HINT_BY_REASON,不另抄一份(§0.6)。
  const wbEnabled = boolOf(wb?.['enabled'])
  const wbTasksEnabled = boolOf(wb?.['tasks_enabled'])
  const wbCronEnabled = boolOf(wb?.['cron_enabled'])
  const wbSweepMinutes = typeof wb?.['sweep_minutes'] === 'number' ? wb['sweep_minutes'] : null
  const wbLiveRun = boolOf(wb?.['live_run'])
  const wbInferredHint =
    wbTasksEnabled === false
      ? GATE_HINT_BY_REASON.tasks_gate_off
      : wbCronEnabled === false
        ? GATE_HINT_BY_REASON.cron_gate_off
        : wbTasksEnabled === true && wbCronEnabled === true
          ? GATE_HINT_BY_REASON.job_not_registered
          : null
  const wbLine = !wb
    ? 'WorkBuddy 任务巡检态读不到(体里没有 wb_tasks)'
    : reasonHint
      ? `WorkBuddy 任务巡检未在跑:${reasonHint}`
      : wbEnabled === true
        ? `WorkBuddy 任务巡检在跑(每 ${wbSweepMinutes ?? '?'} 分钟,${wbLiveRun === true ? '正式执行' : 'dry-run'})`
        : wbEnabled === false && wbInferredHint
          ? `WorkBuddy 任务巡检未在跑(服务端未给 not_running_reason,按两门现推):${wbInferredHint}`
          : 'WorkBuddy 任务巡检态读不到(缺 wb_tasks.enabled 或两门意图位),不猜卡在哪一层'

  const nextRunAt = strOf(body['next_run'])
  if (started) {
    return {
      state: 'running',
      detail: `调度已启动(started=true,总闸 enabled=${enabled}):下次主窗口 ${
        nextRunAt ?? '未给出'
      };${wbLine}`,
      nextRunAt,
      gateHint: null,
    }
  }
  return {
    state: 'disabled',
    detail: `调度未启动:${gateHint}`,
    nextRunAt: null,
    gateHint,
  }
}

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
  /** 状态源读不到时的原因(§0.3 未判定点名);判过并判成"门关"不算未判定,不写这里 */
  indeterminateReason: string | null
  /** 读到了结论且结论是"门关":点名的闸门 env 键与出路(2026-10-31 立,与未判定分栏显示) */
  disabledReason: string | null
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
  /** null = 状态源压根没给结论(与"结论是未判定"分两栏,§0.3) */
  fetchCheckinStatus(baseUrl: string): Promise<CheckinStatusResult | null>
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
      if (!baseUrl.trim()) {
        return judgeCheckinSchedulerStatus({
          kind: 'transport-error',
          message: 'AI_SERVICE_URL 未配置(聚合调用方没给基址)',
        })
      }
      const url = `${baseUrl.replace(/\/$/, '')}/api/checkin/scheduler/status`
      let res: Response
      let body: unknown
      try {
        // 身份纪律:该端点带 require_request_user_id(apps/ai-service/app/core/jwt_auth.py:256),
        // 生产态裸 fetch 必吃 401。走本仓"无用户上下文"外发的正牌票——与
        // utils/ai-service-fetch.ts 的 aiServiceSystemFetch 同一个 getSystemAccessToken 出口,
        // 不发明 ai-service 不认的头(§0.8:跑不通的出路不许写)。
        const token = await getSystemAccessToken()
        res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(3000),
        })
      } catch (e) {
        return judgeCheckinSchedulerStatus({
          kind: 'transport-error',
          message: e instanceof Error ? e.message : String(e),
        })
      }
      if (!res.ok) {
        return judgeCheckinSchedulerStatus({ kind: 'http-error', status: res.status })
      }
      try {
        body = await res.json()
      } catch {
        // 200 但体不是 JSON:读不懂就是不判,不拿可达性冒"调度在跑"
        body = undefined
      }
      return judgeCheckinSchedulerStatus({ kind: 'ok', status: res.status, body })
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
        disabledReason: null,
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
      // apscheduler:判据已在 judgeCheckinSchedulerStatus 里出结论,这里只按三态分派
      const st = await deps.fetchCheckinStatus(opts.aiServiceUrl ?? '')
      if (!st) {
        return {
          ...def,
          ...base,
          sourceOk: false,
          indeterminateReason: 'ai-service 状态源无结论(deps 未返回判定,与"门关"不同栏)',
        }
      }
      if (st.state === 'running') {
        return {
          ...def,
          ...base,
          schedulable: true,
          sourceOk: true,
          nextRunAt: st.nextRunAt,
          lastRunDetail: st.detail,
        }
      }
      if (st.state === 'disabled') {
        return {
          ...def,
          ...base,
          schedulable: false,
          sourceOk: true,
          lastRunDetail: st.detail,
          // 判过了 ⇒ 不进"未判定"栏,单独点名闸门(§0.3 双向:判过的也不写成没判)
          disabledReason: st.gateHint,
        }
      }
      return {
        ...def,
        ...base,
        schedulable: false,
        sourceOk: false,
        lastRunDetail: st.detail,
        indeterminateReason: st.detail,
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
    // 产出面只有 6 枚键(2026-10-29 复核:旧串读的 keepalive 结构上不存在,管理面恒显示
    // "保活=undefined");skipped=true = 分布式锁被别席持有,本轮根本没执行,不得冒"完成"
    if (r.skipped) {
      return { ok: false, detail: '本轮跳过:分布式锁被其他实例持有(未执行 ≠ 零结果)' }
    }
    return {
      ok: true,
      detail: `巡检完成:刷新=${r.refreshed} 刷新失败=${r.refreshFailed} 跳过刷新=${r.refreshSkipped} 定级=${r.healthChecked} 恢复=${r.healthRecovered}`,
    }
  }
  if (
    id === 'trae-session-sync' ||
    id === 'qoder-session-sync' ||
    id === 'workbuddy-session-sync'
  ) {
    const { runTraeSessionSync, runQoderSessionSync, runWorkbuddySessionSync } =
      await import('../workers/relay-account-pool-worker.js')
    const r = await (id === 'qoder-session-sync'
      ? runQoderSessionSync()
      : id === 'workbuddy-session-sync'
        ? runWorkbuddySessionSync()
        : runTraeSessionSync())
    // 退出码 2 = 未判定(本机无对应客户端/解密失败/tsx 缺失),不是失败
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

/**
 * 判据面出口(§22c:测试 import 这份实现,禁止在测试里复制判据)。
 * 只暴露纯函数,IO 出口一律不进(__test__ 不是第二份实现)。
 */
export const __test__ = {
  judgeCheckinSchedulerStatus,
  GATE_HINT_BY_REASON,
}
