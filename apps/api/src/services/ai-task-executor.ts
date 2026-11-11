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
  startedAt: string
  finishedAt: string
}

/** 执行结果:调用方(路由/调度)按 ok 区分成败 */
export interface AiTaskRunOutcome {
  ok: boolean
  /** skipped=true 表示幂等命中,本轮未执行 */
  skipped: boolean
  run: AiTaskRun | null
}

/** 手动触发幂等键的单调后缀:进程内单调递增,保证同毫秒多次触发也各得唯一键。 */
let manualSeq = 0

/** 步骤数上限(防呆:模板里塞几千步会把单轮拖成挂死,创建时即拦) */
export const MAX_STEPS = 50

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
        const output = await caller(step.method, step.path, params)
        const finishedAt = new Date()
        stepResults.push({
          stepIndex: i,
          method: step.method,
          path: step.path,
          ok: true,
          output,
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
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
        })
        failedIndex = i
        errorMessage = msg
        break // 失败即停,后续步骤本轮不执行(留待重放)
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

    const [updated] = await db
      .update(aiTaskRun)
      .set({
        status: 'failed',
        stepResults,
        failedStepIndex: failedIndex,
        errorMessage,
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
    return { ok: false, skipped: false, run: updated ?? null }
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
