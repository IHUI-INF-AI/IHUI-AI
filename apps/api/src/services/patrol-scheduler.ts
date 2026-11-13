// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 主动巡逻 Agent 调度器(2026-09-17 立,P3 #40)。
 *
 * 职责:每 60s tick 轮询 patrol_tasks 表中到期(active 且 next_run_at<=now)的
 * 巡检任务,逐条调用 ai-service agent-runtime 执行巡检(复用既有工具执行引擎,
 * 与 agent-automation-scheduler 共用 consumeAgentStream);巡检结果按标记协议
 * 判定 ok/issue/error,写 patrol_runs 历史 + last_result;recurring 执行后重算
 * next_run_at(rrule 解析失败自动置 paused 防死循环,复用 parseNextRun)。
 *
 * 阶段2:issue 时主动建(或复用)chat_conversations 会话并注入首条 assistant
 * 诊断消息(诊断结论 + 修复预案),conversation_id 回存任务防重复建会话刷屏;
 * 用户在会话内回复"执行修复"即走既有 agent 工具审批流(阶段3 一键授权)。
 *
 * 标记协议:巡检 prompt 要求 agent 最终回复第一行必须是
 *   [PATROL:OK](无新问题)或 [PATROL:ISSUE](发现问题),后端按此判定。
 */

import type { FastifyRequest } from 'fastify'
import { and, asc, desc, eq, lte, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { chatConversations, chatMessages, patrolRuns, patrolTasks } from '@ihui/database'
import { parseNextRun, consumeAgentStream } from './agent-automation-scheduler.js'
import type { AgentStreamParams } from './agent-automation-scheduler.js'
import { turnOrdinalForRole } from './turn-ordinal.js'
import { logger } from '../utils/logger.js'

// =============================================================================
// 巡检类型模板 + prompt 构建(纯函数,可单测)
// =============================================================================

/** 巡检类型(与 schema patrolTasks.patrolType 一致);workspace=自愈工作区联动(#45 阶段3) */
export type PatrolType = 'ci' | 'dependency' | 'log' | 'deadlink' | 'workspace' | 'custom'

/** 各巡检类型的检查重点(注入 agent prompt) */
export const PATROL_TYPE_FOCUS: Record<PatrolType, string> = {
  ci: '持续集成状态:检查 CI 流水线最近一次运行结果,关注失败的 job/测试与失败原因。',
  dependency: '依赖健康:检查依赖是否有已知安全漏洞(CVE)、过期版本与不兼容升级风险。',
  log: '错误日志:检查最近的错误/告警日志,关注高频异常、新增错误模式与堆栈线索。',
  deadlink: '死链检查:检查目标页面/资源链接的可访问性,关注 404/超时/证书失效。',
  workspace:
    '工作区健康(#45 自愈联动):优先调用 self_heal_detect 工具做四类探针检测(依赖损坏/索引过期/端口占用/磁盘不足);发现问题时输出探针结果与修复预案,提示可用 self_heal_repair(dryRun 先行)修复。',
  custom: '自定义巡检:按巡检目标与附加指令执行检查。',
}

/** 构建 agent 巡检 prompt(要求最终回复第一行带判定标记,便于后端解析) */
export function buildPatrolPrompt(input: {
  patrolType: PatrolType
  target: string | null
  prompt: string | null
}): string {
  const focus = PATROL_TYPE_FOCUS[input.patrolType] ?? PATROL_TYPE_FOCUS.custom
  const lines = ['你是主动巡逻巡检 Agent,执行一次例行巡检。', `巡检重点:${focus}`]
  if (input.target && input.target.trim()) {
    lines.push(`巡检目标:${input.target.trim()}`)
  }
  if (input.prompt && input.prompt.trim()) {
    lines.push(`附加巡检指令:${input.prompt.trim()}`)
  }
  lines.push(
    '要求:',
    '1. 使用可用工具实际检查,只报告核实过的事实,不臆测。',
    '2. 巡检完成后,最终回复的第一行必须是且只能是以下两个标记之一:',
    '   [PATROL:OK](一切正常,无新问题)',
    '   [PATROL:ISSUE](发现需要处理的问题)',
    '3. 标记行之后输出两部分:「诊断结论」(发现了什么,附证据/数据)与「修复预案」(建议的具体修复步骤,可执行优先)。',
    '4. 一切正常时也简要说明检查了什么,便于审计。',
  )
  return lines.join('\n')
}

export interface PatrolVerdict {
  /** 'ok' | 'issue' = 标记解析成功;'unknown' = 未找到标记(执行可能未按协议输出) */
  status: 'ok' | 'issue' | 'unknown'
  /** 标记行之后的诊断文本(截断到 4000 字符) */
  diagnosis: string
}

/** 判定标记(行首) */
const ISSUE_MARK = '[PATROL:ISSUE]'
const OK_MARK = '[PATROL:OK]'
const DIAGNOSIS_LIMIT = 4000

function extractDiagnosis(text: string, markLen: number): string {
  const diagnosis = text.slice(markLen).trim()
  return diagnosis.length > DIAGNOSIS_LIMIT ? diagnosis.slice(0, DIAGNOSIS_LIMIT) : diagnosis
}

/**
 * 从 agent 输出解析巡检判定。
 * 优先看 summary(SSE 事件里的最终摘要),其次看 contentTail(内容尾部)。
 * 未找到标记返回 unknown(调用方:有错误归 error,否则按 ok 记录不告警)。
 */
export function parsePatrolVerdict(summary: string | null, contentTail: string): PatrolVerdict {
  for (const text of [summary, contentTail]) {
    if (!text) continue
    const issueIdx = text.indexOf(ISSUE_MARK)
    if (issueIdx !== -1) {
      return {
        status: 'issue',
        diagnosis: extractDiagnosis(text.slice(issueIdx), ISSUE_MARK.length),
      }
    }
    const okIdx = text.indexOf(OK_MARK)
    if (okIdx !== -1) {
      return { status: 'ok', diagnosis: extractDiagnosis(text.slice(okIdx), OK_MARK.length) }
    }
  }
  return { status: 'unknown', diagnosis: '' }
}

/** issue 时注入会话的 assistant 诊断消息 */
export function buildPatrolAlertMessage(
  taskName: string,
  patrolType: string,
  diagnosis: string,
): string {
  const body = diagnosis.trim() || '巡检发现问题,但 agent 未输出详细诊断,请查看巡检历史。'
  return [
    `巡检发现问题:${taskName}(类型 ${patrolType})`,
    '',
    body,
    '',
    '如需处理,回复「执行修复」即可授权按上述修复预案执行(工具调用将逐项走审批确认)。',
  ].join('\n')
}

// =============================================================================
// 执行入口(scheduler tick 与 run-now 共用)
// =============================================================================

export interface PatrolExecuteResult {
  status: 'ok' | 'issue' | 'error'
  summary: string
  conversationId: string | null
}

/** ensureConversation 的会话元数据 */
const ALERT_TITLE_PREFIX = '巡检告警'

/** F-320 失败退避:基数 60s,第 n 次失败等 base * 2^n,封顶 1h。 */
const PATROL_BACKOFF_BASE_MS = 60_000
const PATROL_BACKOFF_CAP_MS = 60 * 60_000
/** patrol_runs.summary 是 text 列,失败文案先截断,不撑爆行。 */
const PATROL_ERROR_SUMMARY_LIMIT = 500

/** 连续失败次数 failures(含本次)对应的退避时长;纯函数,可单测。 */
export function patrolFailureBackoffMs(failures: number): number {
  const n = Number.isFinite(failures) && failures > 0 ? Math.floor(failures) : 1
  return Math.min(PATROL_BACKOFF_BASE_MS * Math.pow(2, n), PATROL_BACKOFF_CAP_MS)
}

/** 自近及远数 patrol_runs 中连续的 error 条数;读失败按 0 计(调用方再 +1)。 */
async function consecutiveErrorRuns(taskId: string): Promise<number> {
  try {
    const rows = await db
      .select({ status: patrolRuns.status })
      .from(patrolRuns)
      .where(eq(patrolRuns.taskId, taskId))
      .orderBy(desc(patrolRuns.createdAt))
      .limit(BATCH_LIMIT)
    let count = 0
    for (const row of rows) {
      if (row.status !== 'error') break
      count += 1
    }
    return count
  } catch (err) {
    logger.warn('[patrol] 读取连续失败次数失败', { patrolTaskId: taskId, err: String(err) })
    return 0
  }
}

/** 失败文案:Error 取 name+message,其余 String;统一截断。 */
function patrolFailureSummary(err: unknown): string {
  const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  return `巡检执行失败: ${detail}`.slice(0, PATROL_ERROR_SUMMARY_LIMIT)
}

/**
 * F-320:后台 tick 失败后必须留下可观测痕迹并退出本轮调度。
 * 写 error 巡检记录 + last_run_at/last_result,并按连续失败次数指数退避推进
 * next_run_at(封顶 1h),下一 tick 才不会立刻重放同一任务。
 * 每一步自身失败只 warn,不得抛穿打断 tick。
 */
async function recordPatrolFailure(
  task: typeof patrolTasks.$inferSelect,
  now: Date,
  err: unknown,
): Promise<void> {
  const summary = patrolFailureSummary(err)
  const failures = (await consecutiveErrorRuns(task.id)) + 1
  const backoffMs = patrolFailureBackoffMs(failures)
  logger.warn('[patrol] 巡检执行失败', {
    patrolTaskId: task.id,
    failures,
    backoffMs,
    err: String(err),
  })
  try {
    await db.insert(patrolRuns).values({ taskId: task.id, status: 'error', summary })
  } catch (insertErr) {
    logger.warn('[patrol] 失败巡检记录写入失败', {
      patrolTaskId: task.id,
      err: String(insertErr),
    })
  }
  try {
    await db
      .update(patrolTasks)
      .set({
        lastRunAt: now,
        lastResult: { finishedAt: now.toISOString(), status: 'error', summary },
        nextRunAt: new Date(now.getTime() + backoffMs),
        updatedAt: now,
      })
      .where(eq(patrolTasks.id, task.id))
  } catch (updateErr) {
    logger.warn('[patrol] 失败退避写回失败(下一 tick 仍会重放该任务)', {
      patrolTaskId: task.id,
      err: String(updateErr),
    })
  }
}

/**
 * 执行一条巡检任务:
 * 1. 调 agent-runtime 执行巡检(SSE 流,复用 consumeAgentStream)。
 * 2. 按标记协议判定 ok/issue/error,写 patrol_runs + last_result,重算 next_run_at。
 * 3. issue 时建/复用告警会话并注入 assistant 诊断消息(阶段2)。
 * 所有异常吞掉只记日志,保证 tick 循环不被打断。
 *
 * @param request 当前 Fastify request(trace 透传);后台调度传 null
 * @returns 执行结果(供 run-now 返回给前端);异常返回 null
 */
export async function executePatrol(
  task: typeof patrolTasks.$inferSelect,
  request: FastifyRequest | null = null,
): Promise<PatrolExecuteResult | null> {
  const now = new Date()
  try {
    const params: AgentStreamParams = {
      message: buildPatrolPrompt({
        patrolType: (task.patrolType as PatrolType) ?? 'custom',
        target: task.target,
        prompt: task.prompt,
      }),
      sessionId: `patrol_${task.id}`,
      botId: task.id,
    }
    const capture = await consumeAgentStream(request, params)
    const verdict = parsePatrolVerdict(capture.summary, capture.contentTail)

    let status: 'ok' | 'issue' | 'error'
    let summary: string
    if (verdict.status === 'issue') {
      status = 'issue'
      summary = verdict.diagnosis.slice(0, 500) || capture.summary || '发现问题'
    } else if (verdict.status === 'ok') {
      status = 'ok'
      summary = verdict.diagnosis.slice(0, 500) || capture.summary || '巡检正常'
    } else if (capture.errorMessage) {
      status = 'error'
      summary = `巡检执行失败: ${capture.errorMessage}`.slice(0, 500)
    } else {
      // 未按协议输出但无错误:按 ok 记录,不误报告警
      status = 'ok'
      summary = (capture.summary ?? capture.contentTail.trim() ?? '巡检完成').slice(0, 500)
    }

    // 阶段2:issue → 建/复用告警会话并注入诊断消息
    let conversationId: string | null = null
    if (status === 'issue') {
      try {
        conversationId = await ensureAlertConversation(task)
        const content = buildPatrolAlertMessage(task.name, task.patrolType, verdict.diagnosis)
        // D35(2026-09-26 第二段):本路径绕过 chat-queries 直插,必须自己补齐 turn_ordinal。
        // 诊断消息是 assistant → 沿用会话当前轮(告警会话尚无轮时归 turn 1),
        // 规则一律取 services/turn-ordinal.js 这个唯一出口,不得在此重写 role 判断。
        // 守门 167(2026-09-30 顺手补锁):读 max 与 insert 之间必须持会话行锁 ——
        // 真库实测无锁并发双插撞号率 100%(apps/api/tests/turn-ordinal-concurrency.test.ts),
        // 形态照抄 db/chat-queries.ts createMessage:锁会话行 → 读 max → 插 → 更新同一行,锁序一致。
        const convId = conversationId
        await db.transaction(async (tx) => {
          await tx
            .select({ id: chatConversations.id })
            .from(chatConversations)
            .where(eq(chatConversations.id, convId))
            .for('update')
          const turnRows = await tx
            .select({ maxTurn: sql<number | null>`max(${chatMessages.turnOrdinal})` })
            .from(chatMessages)
            .where(eq(chatMessages.conversationId, convId))
          await tx.insert(chatMessages).values({
            conversationId: convId,
            role: 'assistant',
            content,
            turnOrdinal: turnOrdinalForRole(Number(turnRows[0]?.maxTurn ?? 0), 'assistant'),
          })
          await tx
            .update(chatConversations)
            .set({ lastMessageAt: new Date() })
            .where(eq(chatConversations.id, convId))
        })
      } catch (err) {
        // 告警注入失败不影响巡检结果落库,记日志下轮可复现
        request?.log.warn({ patrolTaskId: task.id, err: String(err) }, '[patrol] 告警会话注入失败')
        conversationId = null
      }
    }

    // recurring:重算 next_run_at;解析失败置 paused 防死循环(与 automations 同语义)
    let nextRunAt: Date | null = null
    let statusPatch: string | undefined
    if (task.rrule) {
      nextRunAt = parseNextRun(task.rrule, now, task.timezone)
    }
    if (!nextRunAt) {
      statusPatch = 'paused'
      request?.log.warn(
        { patrolTaskId: task.id, rrule: task.rrule },
        '[patrol] rrule 解析失败,巡检任务已自动暂停',
      )
    }

    await db.insert(patrolRuns).values({
      taskId: task.id,
      status,
      summary,
      ...(conversationId ? { conversationId } : {}),
    })

    await db
      .update(patrolTasks)
      .set({
        lastRunAt: now,
        lastResult: {
          finishedAt: now.toISOString(),
          status,
          summary,
          ...(conversationId ? { conversationId } : {}),
        },
        ...(conversationId ? { notifyConversationId: conversationId } : {}),
        ...(nextRunAt ? { nextRunAt } : {}),
        ...(statusPatch ? { status: statusPatch } : {}),
        updatedAt: now,
      })
      .where(eq(patrolTasks.id, task.id))

    return { status, summary, conversationId }
  } catch (err) {
    // F-320:后台调用 request 为 null,必须走模块级 logger 才留得下痕迹
    await recordPatrolFailure(task, now, err)
    return null
  }
}

/**
 * 返回告警会话 id:任务已有可用会话则复用,否则创建新会话
 * (metadata.source='patrol' 标记来源,前端可识别展示)。
 */
async function ensureAlertConversation(task: typeof patrolTasks.$inferSelect): Promise<string> {
  if (task.notifyConversationId) {
    const [existing] = await db
      .select({ id: chatConversations.id })
      .from(chatConversations)
      .where(eq(chatConversations.id, task.notifyConversationId))
      .limit(1)
    if (existing) return existing.id
  }
  const [created] = await db
    .insert(chatConversations)
    .values({
      userId: task.userId,
      title: `${ALERT_TITLE_PREFIX}: ${task.name}`.slice(0, 255),
      metadata: { source: 'patrol', patrolTaskId: task.id, patrolType: task.patrolType },
    })
    .returning({ id: chatConversations.id })
  if (!created?.id) throw new Error('告警会话创建失败')
  return created.id
}

// =============================================================================
// 调度器生命周期(与 agent-automation-scheduler 同模式:60s tick + 单飞保护)
// =============================================================================

const TICK_INTERVAL_MS = 60_000
const BATCH_LIMIT = 10

let running = false
let timer: ReturnType<typeof setInterval> | null = null

/** 执行一轮调度(now 仅供测试注入时钟;生产由 60s 定时器触发)。 */
export async function runPatrolTick(now: Date = new Date()): Promise<void> {
  // 并发保护:上一轮未结束直接跳过本轮
  if (running) return
  running = true
  try {
    const due = await db
      .select()
      .from(patrolTasks)
      .where(and(eq(patrolTasks.status, 'active'), lte(patrolTasks.nextRunAt, now)))
      .orderBy(asc(patrolTasks.nextRunAt))
      .limit(BATCH_LIMIT)

    for (const task of due) {
      // 单条失败 catch 继续(executePatrol 内部已兜底,这里再兜一层)
      await executePatrol(task, null)
    }
  } catch (err) {
    console.warn('[patrol] 调度 tick 异常', err)
  } finally {
    running = false
  }
}

/** 启动调度器(60s tick);进程内单例,重复调用幂等。 */
export function startPatrolScheduler(): void {
  if (timer) return
  timer = setInterval(() => {
    void runPatrolTick()
  }, TICK_INTERVAL_MS)
  // 定时器不阻塞进程退出
  if (typeof timer.unref === 'function') timer.unref()
}

/** 停止调度器(测试/优雅关闭用)。 */
export function stopPatrolScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  running = false
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
