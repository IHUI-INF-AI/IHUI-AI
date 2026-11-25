// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 可编排的定时任务（对标 CowAgent / LangBot 的定时推送、WeChatPadPro 的定时群发）。
 *
 * 三条设计约束：
 *  1. 不建新表：任务清单写进账号 metadata 的 `jobs` 键，写回时只合并这个键，
 *     绝不能把 metadata 里白名单 / 限流 / 指令开关一起冲掉；
 *  2. 沿用 digest.ts 的进程内调度范式：30 秒扫一次、只命中当前分钟、
 *     lastRunDay 做「当天只跑一次」的抢占闸，多实例也不会重复发；
 *  3. 执行层不另起发送通道：广播走 broadcast()，报告走 manager.send，
 *     白名单、敏感词、限流、只读账号、审计一律照旧生效。
 */

import { eq } from 'drizzle-orm'
import { wechatHubAccounts } from '@ihui/database'
import type {
  WechatJobInput,
  WechatJobPayload,
  WechatJobRunResult,
  WechatJobView,
} from '@ihui/types'
import { db, dbRead } from '../../db/index.js'
import { AppError } from '../../errors/AppError.js'
import { logger } from '../../utils/logger.js'
import { broadcast } from './broadcast.js'
import { localParts } from './digest.js'
import { assertAccountForUser } from './guards.js'
import { wechatHubManager } from './manager.js'
import { buildReport } from './reports.js'

const TICK_MS = 30_000
const MAX_JOBS_PER_ACCOUNT = 20
const REPORT_LINES_TO_PUSH = 20

/** 任务在本模块内部一律用 WechatJobView（与前端共用同一份契约）。 */
type WechatJob = WechatJobView

export type { WechatJobInput }

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(Math.max(Math.trunc(num), min), max)
}

/** 把库里存的松散 JSON 归一成强类型任务；坏数据直接丢弃，不让它把调度器拖崩。 */
function normalizeJob(raw: unknown): WechatJob | null {
  const record = asRecord(raw)
  const id = typeof record.id === 'string' ? record.id.trim() : ''
  if (!id) return null
  const kind =
    record.kind === 'report' ? 'report' : record.kind === 'broadcast' ? 'broadcast' : null
  if (!kind) return null
  const weeklyRaw = record.weekly
  return {
    id,
    kind,
    enabled: record.enabled !== false,
    hour: clampInt(record.hour, 0, 23, 9),
    minute: clampInt(record.minute, 0, 59, 0),
    timezone:
      typeof record.timezone === 'string' && record.timezone.trim()
        ? record.timezone.trim()
        : 'Asia/Shanghai',
    weekly: weeklyRaw === null || weeklyRaw === undefined ? null : clampInt(weeklyRaw, 0, 6, 0),
    payload: asRecord(record.payload) as WechatJobPayload,
    lastRunAt: typeof record.lastRunAt === 'string' ? record.lastRunAt : null,
    lastRunDay: typeof record.lastRunDay === 'string' ? record.lastRunDay : null,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
  }
}

async function readJobs(
  accountId: string,
): Promise<{ jobs: WechatJob[]; metadata: Record<string, unknown> }> {
  const rows = await dbRead
    .select({ metadata: wechatHubAccounts.metadata })
    .from(wechatHubAccounts)
    .where(eq(wechatHubAccounts.id, accountId))
    .limit(1)
  const metadata = asRecord(rows[0]?.metadata)
  const list = Array.isArray(metadata.jobs) ? metadata.jobs : []
  return {
    metadata,
    jobs: list.map(normalizeJob).filter((job): job is WechatJob => job !== null),
  }
}

/**
 * 写回任务清单：只替换 metadata.jobs，其它键原样带上。
 * 这是本文件最容易出事的一处——metadata 里同时住着白名单、敏感词、限流、指令开关。
 */
async function writeJobs(
  accountId: string,
  metadata: Record<string, unknown>,
  jobs: WechatJob[],
): Promise<void> {
  await db
    .update(wechatHubAccounts)
    .set({ metadata: { ...metadata, jobs } as never, updatedAt: new Date() })
    .where(eq(wechatHubAccounts.id, accountId))
}

export async function listJobs(userId: string, accountId: string): Promise<WechatJob[]> {
  await assertAccountForUser(userId, accountId)
  const { jobs } = await readJobs(accountId)
  return jobs
}

export async function saveJob(
  userId: string,
  accountId: string,
  input: WechatJobInput,
): Promise<WechatJob> {
  await assertAccountForUser(userId, accountId)
  const payload = asRecord(input.payload) as WechatJobPayload
  if (input.kind === 'broadcast' && !payload.text?.trim() && !payload.mediaUrl) {
    throw new AppError('定时群发必须给出 text 或 mediaUrl', 400, 'WECHAT_JOB_EMPTY_CONTENT')
  }
  if (input.kind === 'report' && !payload.reportKind) {
    throw new AppError('定时报告必须指定 reportKind', 400, 'WECHAT_JOB_NO_REPORT_KIND')
  }

  const { jobs, metadata } = await readJobs(accountId)
  const next: WechatJob = {
    id: input.id ?? `job_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    kind: input.kind,
    enabled: input.enabled !== false,
    hour: clampInt(input.hour, 0, 23, 9),
    minute: clampInt(input.minute, 0, 59, 0),
    timezone: input.timezone?.trim() || 'Asia/Shanghai',
    weekly:
      input.weekly === null || input.weekly === undefined ? null : clampInt(input.weekly, 0, 6, 0),
    payload,
    lastRunAt: null,
    lastRunDay: null,
    createdAt: new Date().toISOString(),
  }

  const replaced = jobs.filter((job) => job.id !== next.id)
  if (replaced.length >= MAX_JOBS_PER_ACCOUNT) {
    throw new AppError(
      `单个账号最多 ${MAX_JOBS_PER_ACCOUNT} 个定时任务`,
      400,
      'WECHAT_JOB_TOO_MANY',
    )
  }
  await writeJobs(accountId, metadata, [...replaced, next])
  logger.info(`[wechat-hub] 定时任务已保存 account=${accountId} job=${next.id} kind=${next.kind}`)
  return next
}

export async function deleteJob(
  userId: string,
  accountId: string,
  jobId: string,
): Promise<boolean> {
  await assertAccountForUser(userId, accountId)
  const { jobs, metadata } = await readJobs(accountId)
  const remaining = jobs.filter((job) => job.id !== jobId)
  if (remaining.length === jobs.length) return false
  await writeJobs(accountId, metadata, remaining)
  return true
}

export async function toggleJob(
  userId: string,
  accountId: string,
  jobId: string,
  enabled: boolean,
): Promise<WechatJob> {
  await assertAccountForUser(userId, accountId)
  const { jobs, metadata } = await readJobs(accountId)
  const target = jobs.find((job) => job.id === jobId)
  if (!target) throw new AppError('定时任务不存在', 404, 'WECHAT_JOB_NOT_FOUND')
  const next: WechatJob = { ...target, enabled }
  await writeJobs(
    accountId,
    metadata,
    jobs.map((job) => (job.id === jobId ? next : job)),
  )
  return next
}

function weekdayOf(date: Date, timezone: string): number {
  const label = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(
    date,
  )
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[label] ?? 0
}

/**
 * 是否该跑：启用 + 星期匹配 + 只命中当前分钟 + 当天没跑过。
 * 只允许命中当前分钟是有意的——服务重启不会把整天的任务补发一遍。
 */
export function isJobDue(
  job: WechatJob,
  now = new Date(),
  lastRunDay: string | null = job.lastRunDay,
): boolean {
  if (!job.enabled) return false
  const parts = localParts(now, job.timezone)
  if (parts.hour !== job.hour || parts.minute !== job.minute) return false
  if (job.weekly !== null && weekdayOf(now, job.timezone) !== job.weekly) return false
  return parts.dayKey !== lastRunDay
}

async function runOne(
  userId: string,
  accountId: string,
  job: WechatJob,
): Promise<WechatJobRunResult> {
  const at = new Date().toISOString()
  if (job.kind === 'broadcast') {
    const result = await broadcast(userId, {
      accountId,
      text: job.payload.text,
      mediaUrl: job.payload.mediaUrl,
      targets: job.payload.targets,
      tags: job.payload.tags,
    })
    return {
      jobId: job.id,
      kind: job.kind,
      ok: result.failed === 0,
      detail: `目标 ${result.total} · 成功 ${result.sent} · 失败 ${result.failed}`,
      at,
    }
  }

  const target = job.payload.targets?.[0]
  if (!target) {
    return { jobId: job.id, kind: job.kind, ok: false, detail: '缺少推送目标，已跳过', at }
  }
  const report = await buildReport(userId, accountId, {
    kind: job.payload.reportKind ?? 'annual',
    year: job.payload.year,
    conversationId: job.payload.conversationId,
  })
  const lines = report.markdown.split('\n').slice(0, REPORT_LINES_TO_PUSH).join('\n')
  const sent = await wechatHubManager.send(userId, {
    accountId,
    target,
    kind: 'text',
    text: lines.slice(0, 4_500),
  })
  return {
    jobId: job.id,
    kind: job.kind,
    ok: sent.ok,
    detail: sent.ok
      ? `报告已推送（${report.stats.messageCount} 条消息）`
      : (sent.reason ?? '推送失败'),
    at,
  }
}

/**
 * 扫一轮：所有启用账号的到期任务依次执行。
 * 单个任务失败只记该任务，不让整轮扫描崩掉；同一任务执行后立刻写 lastRunDay 防止重入。
 */
export async function runDueJobs(now = new Date()): Promise<WechatJobRunResult[]> {
  const accounts = await dbRead
    .select({
      id: wechatHubAccounts.id,
      userId: wechatHubAccounts.userId,
      metadata: wechatHubAccounts.metadata,
    })
    .from(wechatHubAccounts)
    .limit(200)

  const results: WechatJobRunResult[] = []
  for (const account of accounts) {
    const metadata = asRecord(account.metadata)
    const jobs = (Array.isArray(metadata.jobs) ? metadata.jobs : [])
      .map(normalizeJob)
      .filter((job): job is WechatJob => job !== null)
    const due = jobs.filter((job) => isJobDue(job, now))
    if (due.length === 0) continue

    // 先落 lastRunDay 再执行：执行耗时较长时，下一轮 tick 不会再捞到同一批任务
    const stamped = jobs.map((job) =>
      due.some((item) => item.id === job.id)
        ? { ...job, lastRunDay: localParts(now, job.timezone).dayKey, lastRunAt: now.toISOString() }
        : job,
    )
    try {
      await writeJobs(account.id, metadata, stamped)
    } catch (error) {
      logger.warn(
        `[wechat-hub] 定时任务标记失败，本轮跳过 account=${account.id}: ${error instanceof Error ? error.message : String(error)}`,
      )
      continue
    }

    for (const job of due) {
      try {
        const result = await runOne(account.userId, account.id, job)
        results.push(result)
        logger.info(
          `[wechat-hub] 定时任务已执行 account=${account.id} job=${result.jobId} ok=${result.ok} ${result.detail}`,
        )
      } catch (error) {
        results.push({
          jobId: job.id,
          kind: job.kind,
          ok: false,
          detail: error instanceof Error ? error.message : String(error),
          at: new Date().toISOString(),
        })
      }
    }
  }
  return results
}

let timer: NodeJS.Timeout | null = null
let inFlight = false

/** 启动调度器；重复调用无副作用。API 进程起来时挂一次即可。 */
export function startJobScheduler(): void {
  if (timer) return
  timer = setInterval(() => {
    if (inFlight) return
    inFlight = true
    void runDueJobs()
      .catch((error) =>
        logger.warn(
          `[wechat-hub] 定时任务扫描异常: ${error instanceof Error ? error.message : String(error)}`,
        ),
      )
      .finally(() => {
        inFlight = false
      })
  }, TICK_MS)
  timer.unref?.()
  logger.info('[wechat-hub] 定时任务调度器已启动（30 秒一轮）')
}

export function stopJobScheduler(): void {
  if (!timer) return
  clearInterval(timer)
  timer = null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
