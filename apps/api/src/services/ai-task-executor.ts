// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { eq, desc, count } from 'drizzle-orm'
import { aiTaskTemplate, aiTaskRun, type AiTaskTemplate, type AiTaskRun } from '@ihui/database'
import { db } from '../db/index.js'
import { bizDayKey } from '../utils/biz-day.js'
import { logger } from '../utils/logger.js'

/**
 * AI 编排层执行器(HR-4,2026-11-11 立):把「能调端点」升级成「会自己干完一件事」。
 *
 * 职责:
 *   · 加载模板(ai_task_template)→ 逐步执行 steps,把上一步输出注入下一步参数;
 *   · 逐步留痕到 ai_task_run.step_results,失败记 failedStepIndex;
 *   · 失败可重放:replayFromStep 指定从失败步续跑,已成功步不重复调端点;
 *   · 幂等:(template_id, idempotency_key) 唯一 ⇒ 同窗口重复触发 skipped、不落新痕。
 *     manual 触发 idemKey 带「毫秒+单调序号」后缀,允许同窗口多次手动触发各留一痕;
 *     cron   触发 idemKey = <name>:<dayKey>,同业务日去重。
 *
 * 端点调用走**可注入的 caller**:本文件不 import api-bridge(api-bridge 在 apps/cli,
 * api 服务层不许反向依赖 CLI)。调用方(路由/后续 cron 调度)注入真实 caller,测试注入假 caller。
 */

/** 端点调用契约:HTTP 方法 + 路径 + 参数(query/body 合并的扁平字典),返回端点响应(未知结构) */
export type TaskStepCaller = (
  method: string,
  path: string,
  params: Record<string, unknown>,
) => Promise<unknown>

/** 单步定义(与 ai_task_template.steps jsonb 对齐) */
export interface TaskStep {
  method: string
  path: string
  /** 参数模板;若声明 injectFromPrev,执行器会把上一步输出整包塞进 params[injectFromPrev.into] */
  params?: Record<string, unknown>
  /** 上一步输出注入本步参数的目标键(缺省不注入) */
  injectFromPrev?: { into: string }
  /**
   * 步骤级重试(2026-11-13 加)。**缺省不重试** —— 保持"失败即停"的既有契约,
   * 只有模板显式声明才启用,避免给非幂等写接口带来重复副作用。
   *
   * 启用前必须确认该步骤**幂等安全**:
   *   · GET 天然安全;
   *   · 落库走 upsert / 幂等键的 POST 安全;
   *   · 纯 INSERT 的写接口**不要**开(重试会插两遍)。
   */
  /**
   * 失败补偿声明(2026-11-13 加)。**缺省不补偿** —— 保持"失败即停、已写就写了"
   * 的既有契约,只有显式声明的步骤才会在后续步骤失败时被倒序撤回。
   *
   * 语义:步骤 i 成功写入后,若步骤 j(>i)失败,则对 i 执行这段补偿调用,
   * 把"本次运行造成的写入"撤回。补偿调用同样走 caller,因此它只能做
   * **端点能做的事**(删/改/反向操作),不能直接写库。
   *
   * 设计取舍:不做跨表事务。原因是这些步骤跨 HTTP 边界与外部分系统,
   * 数据库事务管不到;能管的是"每条写都有对应的撤回动作"(Saga 补偿)。
   */
  compensate?: {
    method: string
    path: string
    /** 补偿参数模板(通常与正向步骤的 params 不同,例如按 id 删除) */
    params?: Record<string, unknown>
    /**
     * 补偿参数从正向步骤的输出里取值的映射:
     * { 目标键: 输出里的路径 }。路径形如 `data.periodId`。
     */
    fromOutput?: Record<string, string>
  }
  retry?: {
    /** 最多尝试次数(含首次);1 = 不重试。上限 MAX_STEP_ATTEMPTS */
    maxAttempts: number
    /** 退避基数毫秒(指数退避:base, 2*base, 4*base…);缺省 300 */
    backoffMs?: number
    /**
     * 只对这些 HTTP 状态码重试(缺省 [429, 500, 502, 503, 504])。
     * 4xx(除 429)属"请求本身有问题",重试无意义。
     */
    retryOnStatus?: number[]
  }
}

/** 单步执行留痕 */
export interface TaskStepResult {
  stepIndex: number
  method: string
  path: string
  ok: boolean
  /** 成功时端点响应原样留痕 */
  output?: unknown
  /** 失败时错误消息(slice 0,1000) */
  error?: string
  /** 实际尝试次数(1 = 一次成功或未配置重试);2026-11-13 加 */
  attempts?: number
  startedAt: string
  finishedAt: string
}

/** 执行结果:调用方(路由/调度)按 ok 区分成败 */
/** 单条补偿的留痕 */
export interface CompensationOutcome {
  /** 被补偿的正向步骤序号 */
  stepIndex: number
  method: string
  path: string
  ok: boolean
  error?: string
  startedAt: string
  finishedAt: string
}

export interface AiTaskRunOutcome {
  ok: boolean
  /** 失败后执行的补偿留痕(空数组 = 没声明补偿或全部步骤成功) */
  compensations?: CompensationOutcome[]
  /** skipped=true 表示幂等命中,本轮未执行 */
  skipped: boolean
  run: AiTaskRun | null
}

/** 手动触发幂等键的单调后缀:进程内单调递增,保证同毫秒多次触发也各得唯一键。 */
let manualSeq = 0

/** 步骤数上限(防呆:模板里塞几千步会把单轮拖成挂死,创建时即拦) */
export const MAX_STEPS = 50

/** 单步最大尝试次数上限(防模板写出无限重试) */
export const MAX_STEP_ATTEMPTS = 5

/** 默认重试的 HTTP 状态码:限流 + 服务端瞬时不可用 */
const DEFAULT_RETRY_STATUS = [429, 500, 502, 503, 504]

/**
 * 从 caller 抛出的错误里嗅探 HTTP 状态码。
 *
 * caller 由调用方注入,形态各异:内置回环 caller 把状态码写进 message
 * (`endpoint X failed: 429`),有的实现会挂 `status`/`statusCode` 属性。
 * 三者都认,取不到返回 null(⇒ 视为不可重试,失效方向是"少重试一次")。
 */
function sniffStatus(err: unknown): number | null {
  if (!err || typeof err !== 'object') {
    // 纯字符串错误:尝试从文本里捞
    const m = /\b(4\d{2}|5\d{2})\b/.exec(String(err ?? ''))
    return m ? Number(m[1]) : null
  }
  const o = err as { status?: unknown; statusCode?: unknown; message?: unknown }
  for (const v of [o.status, o.statusCode]) {
    if (typeof v === 'number' && v >= 400 && v < 600) return v
  }
  const m = /\b(4\d{2}|5\d{2})\b/.exec(String(o.message ?? ''))
  return m ? Number(m[1]) : null
}

/**
 * 从步骤输出里按点分路径取值(如 `data.periodId`)。
 * 取不到返回 undefined —— 由调用方决定是否跳过该条补偿。
 */
function pickByPath(source: unknown, path: string): unknown {
  let cur: unknown = source
  for (const seg of path.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur
}

/**
 * 倒序执行已成功步骤的补偿(Saga)。
 *
 * 只在"后续步骤失败"时调用。逐条执行、单条失败不阻断其余补偿
 * (失效方向是"尽量多撤回",而不是"一条失败就全放弃"),结果汇总返回。
 */
async function runCompensations(
  caller: TaskStepCaller,
  steps: TaskStep[],
  succeeded: readonly TaskStepResult[],
): Promise<CompensationOutcome[]> {
  const out: CompensationOutcome[] = []
  // 倒序:最后写入的最先撤回
  for (let k = succeeded.length - 1; k >= 0; k -= 1) {
    const res = succeeded[k]
    if (!res) continue
    const step = steps[res.stepIndex]
    const comp = step?.compensate
    if (!comp) continue

    // 参数:模板 + 从正向输出取值
    const params: Record<string, unknown> = { ...(comp.params ?? {}) }
    for (const [into, fromPath] of Object.entries(comp.fromOutput ?? {})) {
      const v = pickByPath(res.output, fromPath)
      if (v !== undefined) params[into] = v
    }

    const startedAt = new Date()
    try {
      await caller(comp.method, comp.path, params)
      out.push({
        stepIndex: res.stepIndex,
        method: comp.method,
        path: comp.path,
        ok: true,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
      })
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e).slice(0, 1000)
      out.push({
        stepIndex: res.stepIndex,
        method: comp.method,
        path: comp.path,
        ok: false,
        error: msg,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
      })
      logger.error('ai task compensation failed', {
        stepIndex: res.stepIndex,
        path: comp.path,
        err: msg,
      })
    }
  }
  return out
}

/** 指数退避等待 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 带重试地执行一步。
 *
 * 返回 `{ output, attempts }` 或抛出最后一次错误(附 attempts 供留痕)。
 * 不重试时行为与直接 `await caller(...)` 逐字相同 —— 既有契约不受影响。
 */
async function callWithRetry(
  caller: TaskStepCaller,
  step: TaskStep,
  params: Record<string, unknown>,
): Promise<{ output: unknown; attempts: number }> {
  const cfg = step.retry
  if (!cfg || cfg.maxAttempts <= 1) {
    const output = await caller(step.method, step.path, params)
    return { output, attempts: 1 }
  }

  const maxAttempts = Math.min(Math.max(1, Math.floor(cfg.maxAttempts)), MAX_STEP_ATTEMPTS)
  const backoffMs = Math.max(0, cfg.backoffMs ?? 300)
  const retryOn = cfg.retryOnStatus ?? DEFAULT_RETRY_STATUS

  let lastErr: unknown = null
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const output = await caller(step.method, step.path, params)
      return { output, attempts: attempt }
    } catch (e) {
      lastErr = e
      const status = sniffStatus(e)
      const retryable = status !== null && retryOn.includes(status)
      const hasNext = attempt < maxAttempts
      if (!retryable || !hasNext) {
        // 把尝试次数挂到错误上,便于留痕区分"一次就挂"与"重试后仍挂"
        if (lastErr && typeof lastErr === 'object') {
          ;(lastErr as { attempts?: number }).attempts = attempt
        }
        throw lastErr
      }
      const wait = backoffMs * 2 ** (attempt - 1)
      logger.warn('ai task step retrying', {
        path: step.path,
        attempt,
        status,
        waitMs: wait,
      })
      await sleep(wait)
    }
  }
  throw lastErr
}

/**
 * 落一个模板。name 唯一;steps 非空且 ≤ MAX_STEPS;triggerType=cron 时 cron 必填。
 * 抛错路径:重名 / 步骤空 / 步骤超限 / cron 缺失。
 */
export async function createAiTaskTemplate(input: {
  name: string
  goal: string
  steps: TaskStep[]
  triggerType?: 'manual' | 'cron' | 'event'
  cron?: string
}): Promise<AiTaskTemplate> {
  const triggerType = input.triggerType ?? 'manual'
  if (!Array.isArray(input.steps) || input.steps.length === 0) {
    throw new Error('steps 不能为空:至少要有一歩')
  }
  if (input.steps.length > MAX_STEPS) {
    throw new Error(`steps 步数超限:最多 ${MAX_STEPS} 步,收到 ${input.steps.length}`)
  }
  if (triggerType === 'cron' && !input.cron) {
    throw new Error('triggerType=cron 时 cron 表达式必填')
  }
  const [created] = await db
    .insert(aiTaskTemplate)
    .values({
      name: input.name,
      goal: input.goal,
      steps: input.steps,
      triggerType,
      cron: input.cron ?? null,
      enabled: true,
    })
    .returning()
  if (!created) throw new Error('模板落库失败')
  return created
}

/** 按名加载模板(执行器内部用;未知名字返回 null,由 runAiTask 抛错)。 */
async function loadTemplate(name: string): Promise<AiTaskTemplate | null> {
  const rows = await db.select().from(aiTaskTemplate).where(eq(aiTaskTemplate.name, name)).limit(1)
  return rows[0] ?? null
}

/** 列出模板(管理端/AI 工具回查) */
export async function listAiTaskTemplates(): Promise<AiTaskTemplate[]> {
  return db.select().from(aiTaskTemplate).orderBy(desc(aiTaskTemplate.createdAt))
}

/**
 * 执行一个 AI 任务模板并留痕。
 * @param name 模板名(未知名字抛错)
 * @param caller 端点调用器(注入;测试传假 caller)
 * @param opts.manual   手动触发=true ⇒ 幂等键带毫秒+序号后缀,同窗口可多次触发各留一痕
 * @param opts.replayFromStep 重放起始步(缺省 0 从头跑;失败重放传上次 failedStepIndex 续跑)
 */
export async function runAiTask(
  name: string,
  caller: TaskStepCaller,
  opts: { manual?: boolean; replayFromStep?: number } = {},
): Promise<AiTaskRunOutcome> {
  const template = await loadTemplate(name)
  if (!template) throw new Error(`unknown ai task template: ${name}`)
  if (!template.enabled) throw new Error(`ai task template disabled: ${name}`)

  const steps = (template.steps ?? []) as TaskStep[]
  if (steps.length === 0) throw new Error(`ai task template has no steps: ${name}`)

  const replayFrom = opts.replayFromStep ?? 0
  if (!Number.isInteger(replayFrom) || replayFrom < 0 || replayFrom >= steps.length) {
    throw new Error(`replayFromStep 越界: ${replayFrom} (共 ${steps.length} 步)`)
  }

  // 幂等键:业务窗口 = 触发时刻所在的上海业务日键;manual 后缀用单调计数器防同毫秒碰撞
  const at = new Date()
  const dayKey = bizDayKey(at)
  manualSeq += 1
  const idemKey = opts.manual
    ? `${name}:${dayKey}:m${Date.now()}-${manualSeq}`
    : `${name}:${dayKey}`

  // 幂等闸:先插 running 行;命中唯一约束 ⇒ skipped=true 直接返回
  const [inserted] = await db
    .insert(aiTaskRun)
    .values({
      templateId: template.id,
      templateName: name,
      startedAt: at,
      status: 'running',
      idempotencyKey: idemKey,
    })
    .onConflictDoNothing()
    .returning()

  if (!inserted) {
    logger.info('ai task skipped (idempotent hit)', { name, idemKey })
    return { ok: true, skipped: true, run: null }
  }

  const runId = inserted.id
  const stepResults: TaskStepResult[] = []
  let prevOutput: unknown = null
  let failedIndex: number | null = null
  let errorMessage: string | null = null
  let compensations: CompensationOutcome[] = []

  try {
    for (let i = replayFrom; i < steps.length; i += 1) {
      const step = steps[i]
      if (!step) continue
      // 把上一步输出注入本步参数(声明 injectFromPrev.into 才注入)
      const params: Record<string, unknown> = { ...(step.params ?? {}) }
      if (step.injectFromPrev?.into) {
        params[step.injectFromPrev.into] = prevOutput
      }
      const startedAt = new Date()
      try {
        const { output, attempts } = await callWithRetry(caller, step, params)
        const finishedAt = new Date()
        stepResults.push({
          stepIndex: i,
          method: step.method,
          path: step.path,
          ok: true,
          output,
          attempts,
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
        })
        prevOutput = output
      } catch (e) {
        const finishedAt = new Date()
        const msg = String((e as { message?: string })?.message ?? e).slice(0, 1000)
        stepResults.push({
          stepIndex: i,
          method: step.method,
          path: step.path,
          ok: false,
          error: msg,
          attempts: (e as { attempts?: number })?.attempts ?? 1,
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
        })
        failedIndex = i
        errorMessage = msg
        // 失败即停,后续步骤本轮不执行(留待重放);
        // 但若前面有步骤声明了 compensate,先倒序把它们撤回 —— 否则会留下
        // "日结月结算了、工资没算"的半成品状态(HR 看到月结有数、工资单是空的)。
        const succeeded = stepResults.filter((r) => r.ok)
        if (succeeded.some((r) => steps[r.stepIndex]?.compensate)) {
          compensations = await runCompensations(caller, steps, succeeded)
        }
        break
      }
    }

    const finishedAt = new Date()
    if (failedIndex === null) {
      const [updated] = await db
        .update(aiTaskRun)
        .set({
          status: 'success',
          stepResults,
          failedStepIndex: null,
          errorMessage: null,
          finishedAt,
        })
        .where(eq(aiTaskRun.id, runId))
        .returning()
      // 回写模板 last_run_at(回查「最近一次什么时候跑过」)
      await db
        .update(aiTaskTemplate)
        .set({ lastRunAt: finishedAt, updatedAt: finishedAt })
        .where(eq(aiTaskTemplate.id, template.id))
      logger.info('ai task success', { name, idemKey, steps: stepResults.length })
      return { ok: true, skipped: false, run: updated ?? null }
    }

    // 补偿摘要并进 errorMessage:不新增列、不动迁移,但让回查者一眼看到
    // "失败后有没有撤回干净"。有补偿失败时明确点名,便于人工接手。
    const compFailed = compensations.filter((c) => !c.ok)
    const compNote =
      compensations.length === 0
        ? ''
        : ` | 已补偿 ${compensations.length - compFailed.length}/${compensations.length} 步` +
          (compFailed.length > 0
            ? `,补偿失败 ${compFailed.length} 步(${compFailed.map((c) => c.path).join(',')})需人工核对`
            : '')
    const [updated] = await db
      .update(aiTaskRun)
      .set({
        status: 'failed',
        stepResults,
        failedStepIndex: failedIndex,
        errorMessage: `${errorMessage ?? ''}${compNote}`.slice(0, 1000),
        finishedAt,
      })
      .where(eq(aiTaskRun.id, runId))
      .returning()
    logger.error('ai task failed', {
      name,
      idemKey,
      failedStepIndex: failedIndex,
      err: errorMessage,
    })
    return { ok: false, skipped: false, run: updated ?? null, compensations }
  } catch (e) {
    // caller 之外的意外(留痕失败等):也走 failed 回写,保住「留痕必达成败」的契约
    const msg = String((e as { message?: string })?.message ?? e).slice(0, 1000)
    const [updated] = await db
      .update(aiTaskRun)
      .set({ status: 'failed', stepResults, errorMessage: msg, finishedAt: new Date() })
      .where(eq(aiTaskRun.id, runId))
      .returning()
    logger.error('ai task crashed', { name, idemKey, err: msg })
    return { ok: false, skipped: false, run: updated ?? null }
  }
}

/** 模板执行历史(供 GET /ai-tasks/:name/runs 与管理端回查;按开始时间倒序,分页)。 */
export async function listAiTaskRuns(params: {
  templateName?: string
  limit?: number
  offset?: number
}): Promise<{ list: AiTaskRun[]; total: number }> {
  const where = params.templateName ? eq(aiTaskRun.templateName, params.templateName) : undefined
  const [totalRow] = await db.select({ c: count() }).from(aiTaskRun).where(where)
  const list = await db
    .select()
    .from(aiTaskRun)
    .where(where)
    .orderBy(desc(aiTaskRun.startedAt))
    .limit(params.limit ?? 50)
    .offset(params.offset ?? 0)
  return { list, total: Number(totalRow?.c ?? 0) }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
