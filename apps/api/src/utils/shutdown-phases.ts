// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 有序关停相位执行器(唯一出口,2026-09-27 运行期可靠性票)。
 *
 * 立因(复核 index.ts 旧关停路径 :101-202 取证成立,细节以现读为准):
 * - 一串 disposer 平铺执行,**没有任何一相有超时** —— `await schedulerWorker.close()` /
 *   `await server.close()` 永不 resolve 时进程假死(旧形状:`process.exit` 永远走不到,
 *   下次启动抢锁/端口残留);
 * - 同步 disposer 抛错被逐个 try/catch 吞掉只 warn,`exitCode` 仍按调用方传值(信号路径恒 0)
 *   —— **账面记"干净退出"而实际有相失败**;
 * - awaited disposer **reject**(不是同步 throw)时旧实现无人接住:shutdown() 自身变成
 *   unhandledRejection,而 index.ts 的 unhandledRejection 处理器只记日志不退出 ⇒ 进程存活不exit。
 *
 * 本模块的语义:
 * 1. 按声明顺序逐相执行(顺序由调用方决定,本模块不重排 —— 保持既有 disposer 顺序即语义不变);
 * 2. 每相独立超时(race),超时**不阻塞后续相**,该相记 `timedOut` 并带实测耗时;
 * 3. 每相结果三态:`ok` / `failed(原因)` / `timedOut(耗时)`;因总预算耗尽未执行的相记 `notRun`;
 * 4. 总预算默认 = 各相超时之和 + 一档(最大单相超时);超预算立即停跑剩余相并点名,
 *    **绝不静默 exit 0**(任何非 ok 相 ⇒ exitCode 1);
 * 5. 结束时经既有 logger 打**一行**结构化摘要(相位/结果/耗时),不新建 metrics 体系。
 */

import { logger } from './logger.js'

export type PhaseStatus = 'ok' | 'failed' | 'timedOut' | 'notRun'

export interface ShutdownPhase {
  /** 相位名(进摘要清单,失败时点名靠它) */
  name: string
  /** 该相独立超时(ms);同时受总预算裁剪(见 runShutdownPhases) */
  timeoutMs: number
  /** disposer 本体;同步 throw 与异步 reject 同计 `failed` */
  run: () => unknown | Promise<unknown>
}

export interface PhaseOutcome {
  phase: string
  status: PhaseStatus
  /** 该相实测耗时(ms);notRun 恒 0 */
  durationMs: number
  /** failed/timedOut/notRun 的可读原因;ok 省略 */
  reason?: string
}

export interface ShutdownPhasesResult {
  outcomes: PhaseOutcome[]
  failedPhases: string[]
  timedOutPhases: string[]
  notRunPhases: string[]
  /** 全部 ok ⇒ 0;存在任何非 ok 相 ⇒ 1(由调用方与自身诉求取 max 后交给 process.exit) */
  exitCode: number
  totalDurationMs: number
}

/** 摘要/告警出口的最小结构(默认项目 logger,测试可注入 spy 断言"单行摘要") */
export interface ShutdownPhasesLogger {
  info: (msg: string, meta?: object) => void
  warn: (msg: string, meta?: object) => void
}

export interface RunShutdownPhasesOptions {
  phases: ShutdownPhase[]
  /** 总预算(ms)。默认 = Σ 各相 timeoutMs + max(timeoutMs)("再加一档") */
  totalBudgetMs?: number
  log?: ShutdownPhasesLogger
}

/** 默认总预算:各相超时之和再加一档(最大单相超时)。 */
export function defaultShutdownBudgetMs(phases: readonly ShutdownPhase[]): number {
  let sum = 0
  let max = 0
  for (const p of phases) {
    sum += p.timeoutMs
    if (p.timeoutMs > max) max = p.timeoutMs
  }
  return sum + max
}

function errorMessage(e: unknown): string {
  return e instanceof Error && e.message ? e.message : String(e)
}

/**
 * 执行单相:race(工作, 超时)。超时胜出的那一支不取消工作本体,但**必须挂空 catch** ——
 * 否则被弃管的工作体稍后 reject 会升级成 unhandledRejection(index.ts 的处理器只记日志不退出,
 * 恰好复刻本票要修的"存活不 exit"形态)。
 */
async function runSinglePhase(
  phase: ShutdownPhase,
  effectiveTimeoutMs: number,
): Promise<PhaseOutcome> {
  const startedAt = Date.now()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutP = new Promise<'timedOut'>((resolve) => {
    timer = setTimeout(() => resolve('timedOut'), effectiveTimeoutMs)
    // 计时器不得钉住事件循环(真挂死时靠它只能等预算;正常路径它本就该被 clear)
    timer.unref()
  })
  const workP = Promise.resolve()
    .then(() => phase.run())
    .then(() => 'done' as const)
  workP.catch(() => {
    /* 超时胜出后的迟到失败已由本相 outcome 定性,这里只防 unhandledRejection 复刻假死 */
  })
  try {
    const raced = await Promise.race([workP, timeoutP])
    const durationMs = Date.now() - startedAt
    return raced === 'timedOut'
      ? {
          phase: phase.name,
          status: 'timedOut',
          durationMs,
          reason: `超过本相超时 ${effectiveTimeoutMs}ms 未 resolve,已放弃等待并继续后续相`,
        }
      : { phase: phase.name, status: 'ok', durationMs }
  } catch (e) {
    return {
      phase: phase.name,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      reason: errorMessage(e),
    }
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

export async function runShutdownPhases(
  opts: RunShutdownPhasesOptions,
): Promise<ShutdownPhasesResult> {
  const log = opts.log ?? logger
  const budgetMs = opts.totalBudgetMs ?? defaultShutdownBudgetMs(opts.phases)
  const startedAt = Date.now()
  const outcomes: PhaseOutcome[] = []

  for (const phase of opts.phases) {
    const remainingMs = budgetMs - (Date.now() - startedAt)
    if (remainingMs <= 0) {
      // 预算耗尽:该相及之后一律记 notRun(逐相点名,绝不静默省略清单)
      outcomes.push({
        phase: phase.name,
        status: 'notRun',
        durationMs: 0,
        reason: `总预算 ${budgetMs}ms 已耗尽,未执行`,
      })
      continue
    }
    const outcome = await runSinglePhase(phase, Math.min(phase.timeoutMs, remainingMs))
    outcomes.push(outcome)
    if (outcome.status !== 'ok') {
      // 逐相即时告警(与旧路径"失败必 warn"的可见性语义同形),摘要行在收尾统一打
      log.warn(`shutdown phase ${outcome.phase} ${outcome.status}`, {
        phase: outcome.phase,
        status: outcome.status,
        durationMs: outcome.durationMs,
        reason: outcome.reason,
      })
    }
  }

  const failedPhases = outcomes.filter((o) => o.status === 'failed').map((o) => o.phase)
  const timedOutPhases = outcomes.filter((o) => o.status === 'timedOut').map((o) => o.phase)
  const notRunPhases = outcomes.filter((o) => o.status === 'notRun').map((o) => o.phase)
  const dirty =
    failedPhases.length + timedOutPhases.length + notRunPhases.length > 0 ? 1 : 0
  const totalDurationMs = Date.now() - startedAt

  // 一行结构化摘要:相位/结果/耗时全量入 meta(既有 pino 链),消息本身可 grep
  const summaryMeta = {
    outcomes,
    failedPhases,
    timedOutPhases,
    notRunPhases,
    exitCode: dirty,
    totalBudgetMs: budgetMs,
    totalDurationMs,
  }
  if (dirty) {
    log.warn('shutdown-phases-summary', summaryMeta)
  } else {
    log.info('shutdown-phases-summary', summaryMeta)
  }

  return {
    outcomes,
    failedPhases,
    timedOutPhases,
    notRunPhases,
    exitCode: dirty,
    totalDurationMs,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
