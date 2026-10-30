// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// WATERMARK-PLACEHOLDER(本行由 scripts/watermark.mjs inject 替换为横幅)

/**
 * G2 Goal 自评迭代循环 + 运行结果站内推送(2026-10-30 立)。
 *
 * 为什么 goal 状态住在 `user_automations.last_result` jsonb 里而不是新列:
 * packages/database/** 本车道禁改(schema 冻结),而 last_result 本来就是"执行结算的
 * 自由结构落点"(调度器每轮结算整体重写它)。goal 配置/计数/自评结论以 `goal` 键
 * 嵌进去,结算出口用 `withGoalCarryover` 把它随每笔 last_result 一起带走 ——
 * 失败重试、回队、成功都不许把它洗掉(洗掉 = 用户的 goal 静默蒸发)。
 * 若将来要加列(迁移 SQL 见交付回报),本模块是唯一读写面,迁移只动这里。
 *
 * 循环语义(对齐票面):任务执行成功后追加一个**自评 turn**(复用同一条 agent 执行链,
 * 同一 sessionId ⇒ 会话线程接力,模型看得见上一轮产出);对照 target 判 达标/未达标。
 * 未达标且 runs < maxRuns 且**过水位检查** ⇒ 排一次提前重跑(now + GOAL_RERUN_DELAY_MS);
 * 否则收敛为终态并把自评结论记进 last_result。水位不足 ⇒ 拒跑 + 通知用户
 * (once 落 failed_permanent:没余额的重跑不会变好,与 failure-class 的 permanent 语义同档)。
 *
 * 水位检查读的是 `user_margins.token_quantity` —— 与 plugins/token-balance-service.ts
 * 的 DB 兜底腿同一份真相源。不直接复用该插件实例是因为它是 Fastify 装饰器
 * (server.tokenBalance),而调度器是后台定时器、没有 server;这里按同一列做只读预检。
 *
 * 推送纪律(对齐 D30 回帖"transient 回队不重复发",orchestrator.ts L230-245 推论):
 * 只有**终态**(completed / failed_permanent / failed_retries_exhausted)才落站内通知;
 * 回队重试与 goal 重跑排期都是非终态,一条都不发。Goal 水位拒跑是独立的一档通知
 * (它不是执行失败,是"拒绝继续",用户必须知道)。
 */
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  userMargins,
  type AutomationLastResult,
  type AutomationTerminalReason,
} from '@ihui/database'
import { createNotification } from '../../db/notification-queries.js'

/** Goal 迭代预算默认值与硬上限(票面:默认 3、上限 10;路由与工具层同用这一份)。 */
export const GOAL_DEFAULT_MAX_RUNS = 3
export const GOAL_MAX_RUNS_CAP = 10

/** 未达标后提前重跑的排期延迟(60s tick 粒度下再短没有意义,与退避基数同源)。 */
export const GOAL_RERUN_DELAY_MS = 60_000

/** 站内通知的 type 值(notifications.type 是 varchar(32) 自由词表,Web NotificationCenter 按串读)。 */
export const AUTOMATION_NOTIFICATION_TYPE = 'automation'

/**
 * WS 推送出口(2026-10-30 补):调度器是后台定时器、没有 Fastify 实例,而通知要即时出现在
 * Web 侧栏的 NotificationCenter —— 侧栏只吃 WS 推送,不读 REST 列表,所以只落库等于写进抽屉。
 * 实际推送函数由 index.ts 启动时注入(server.pushNotification),未注入时静默跳过(测试/单测安全)。
 */
export type AutomationNotificationPusher = (
  userId: string,
  payload: Record<string, unknown>,
) => void

let automationNotificationPusher: AutomationNotificationPusher | null = null

/** 注入 WS 推送出口(index.ts 的 startBackgroundSchedulers 调用一次)。 */
export function setAutomationNotificationPusher(fn: AutomationNotificationPusher | null): void {
  automationNotificationPusher = fn
}

/** 落库后尽力推送:推送失败绝不影响已写入的通知行(旁路纪律与落库同一条)。 */
function pushNotificationSafely(userId: string, payload: Record<string, unknown>): void {
  if (!automationNotificationPusher) return
  try {
    automationNotificationPusher(userId, payload)
  } catch (err) {
    console.warn(`[agent-automation] 自动化通知 WS 推送失败(不影响落库):${String(err)}`)
  }
}

/** 通知正文截断上限(标题 255 是列宽,正文取可读摘要即可,不塞整段产出)。 */
const NOTIFY_CONTENT_LIMIT = 500

// =============================================================================
// 数据结构(last_result jsonb 的 G2 扩展形态;schema 冻结,类型住本模块)
// =============================================================================

export interface AutomationGoalConfig {
  /** 目标描述(自评 turn 的对照基准) */
  target: string
  /** 最多跑几次(含首跑),1..GOAL_MAX_RUNS_CAP */
  maxRuns: number
}

export interface AutomationGoalVerdict {
  met: boolean
  reason: string
  evaluatedAt: string
}

export interface AutomationGoalState {
  config: AutomationGoalConfig
  /** 已完成并通过自评的执行轮数 */
  runs: number
  lastVerdict?: AutomationGoalVerdict
  /** 收敛原因(达标/预算用尽/水位拒跑/自评不可解析)*/
  note?: string
}

/** last_result 在 G2 之后的完整形态(finishedAt/summary 仍是结算必填两格)。 */
export type AutomationLastResultG2 = AutomationLastResult & { goal?: AutomationGoalState }

/**
 * 从行上的 last_result 原始值里读 goal 状态。
 * 一切脏值(缺 config/target 空/数字越界)一律**归一或判无 goal**,绝不抛穿打断结算。
 * maxRuns 越界按默认档收敛而不是拒读:存量行里写脏了也要能继续跑完它自己。
 */
export function readGoalState(raw: unknown): AutomationGoalState | null {
  if (!raw || typeof raw !== 'object') return null
  const g = (raw as { goal?: unknown }).goal
  if (!g || typeof g !== 'object') return null
  const cfg = (g as { config?: unknown }).config
  if (!cfg || typeof cfg !== 'object') return null
  const target = (cfg as { target?: unknown }).target
  if (typeof target !== 'string' || !target.trim()) return null
  const maxRaw = (cfg as { maxRuns?: unknown }).maxRuns
  const maxRuns =
    typeof maxRaw === 'number' && Number.isFinite(maxRaw) && maxRaw >= 1
      ? Math.min(Math.floor(maxRaw), GOAL_MAX_RUNS_CAP)
      : GOAL_DEFAULT_MAX_RUNS
  const runsRaw = (g as { runs?: unknown }).runs
  const runs =
    typeof runsRaw === 'number' && Number.isFinite(runsRaw) && runsRaw > 0 ? Math.floor(runsRaw) : 0
  const verdictRaw = (g as { lastVerdict?: unknown }).lastVerdict
  const lastVerdict =
    verdictRaw &&
    typeof verdictRaw === 'object' &&
    typeof (verdictRaw as { met?: unknown }).met === 'boolean'
      ? (verdictRaw as AutomationGoalVerdict)
      : undefined
  const note = (g as { note?: unknown }).note
  return {
    config: { target: target.trim(), maxRuns },
    runs,
    ...(lastVerdict ? { lastVerdict } : {}),
    ...(typeof note === 'string' && note ? { note } : {}),
  }
}

/**
 * 结算出口统一走的 carryover:把 goal 状态嵌进本笔 last_result。
 * 没有 goal 的行原样返回(旧行为逐字节不变,存量成功结算不多写一个键)。
 */
export function withGoalCarryover(
  base: AutomationLastResult,
  goal: AutomationGoalState | null | undefined,
): AutomationLastResult {
  if (!goal) return base
  return { ...base, goal } as AutomationLastResultG2
}

// =============================================================================
// 自评 turn:消息构造与结论解析
// =============================================================================

/** 自评 turn 的固定指令(只评不做,输出封闭两行格式,解析面与提示面同源一处)。 */
export function buildGoalEvalMessage(target: string): string {
  return [
    '【Goal 自评】本轮你只评估上一轮产出是否达成目标,不要执行新任务、不要产出新内容。',
    `目标:${target}`,
    '请严格输出两行:',
    '第一行:VERDICT: MET 或 VERDICT: NOT_MET',
    '第二行:REASON: 不超过 200 字的理由(NOT_MET 时点名具体差距)',
  ].join('\n')
}

/**
 * 从自评 turn 的文本里解析结论。
 * 判序:NOT_MET 必须排在 MET 前(交替式从左试,"MET" 是 "NOT_MET" 的后缀)。
 * 解析不出 ⇒ null(调用方按"未达标且不重跑"收口 —— 猜"达标"会把没做成说成做成,
 * 猜"未达标并重跑"会白烧预算,两害相权取"停下来让人看")。
 */
export function parseGoalVerdict(
  text: string | null | undefined,
): { met: boolean; reason: string } | null {
  if (typeof text !== 'string' || !text.trim()) return null
  const m = /VERDICT:\s*(NOT_MET|MET)\b/i.exec(text)
  if (!m) return null
  const met = m[1]!.toUpperCase() === 'MET'
  const rm = /REASON:\s*([\s\S]+?)(?:\n\s*\n|$)/i.exec(text)
  const reason = (rm?.[1] ?? '').trim().slice(0, 500) || (met ? '目标已达成' : '目标未达成')
  return { met, reason }
}

// =============================================================================
// 循环决策(纯函数:输入 goal 状态 + 自评结论 + 水位,输出结算字段怎么改)
// =============================================================================

export interface GoalOutcomeInput {
  goal: AutomationGoalState
  /** 自评结论(null = 不可解析,按不重跑的收敛处理) */
  verdict: { met: boolean; reason: string } | null
  scheduleType: 'once' | 'recurring'
  /** recurring 的常规下一轮时间(rrule 重算结果;once 传 null) */
  rruleNextRunAt: Date | null
  now: Date
  /** 水位检查结论(仅"未达标且预算内"时才需要;其余路径调用方可传 true 短路) */
  balanceOk: boolean
}

export interface GoalOutcome {
  /** 'rerun' = 排提前重跑(非终态);'finish' = Goal 循环收敛 */
  action: 'rerun' | 'finish'
  /** 收敛后的 goal 状态(runs 已 +1,verdict/note 已写) */
  goal: AutomationGoalState
  /** 写入 next_run_at 的执行时间(null = 停止排期) */
  nextRunAt: Date | null
  /** 写入 terminal_reason 的终态成因(null = 无终态) */
  terminalReason: AutomationTerminalReason | null
  /** 仅水位拒跑(once)写 'paused';正常收敛与重跑都不动 status */
  status?: 'paused'
  /** 水位拒跑的 last_error 文案 */
  lastError?: string
  /** 追加进摘要的一行结论(通知正文与 run-now 返回值共用) */
  summaryLine: string
  /** 非空 = 需另发一条"Goal 重跑被拒(水位不足)"通知 */
  refusalNotice?: string
}

/**
 * Goal 循环的唯一决策出口(纯函数,可单测)。
 *
 * 决策表(本轮执行已成功):
 *  - 自评不可解析        ⇒ 收敛,不重跑(once: completed;recurring: 按常规 rrule 继续)
 *  - 达标                ⇒ 收敛(once: completed;recurring: 按常规 rrule 继续)
 *  - 未达标 && runs<上限 && 水位OK ⇒ 提前重跑(now+delay;once 需要 attempt≥1 借道
 *    到期判据的分支②,见 agent-automation-scheduler.automationDueConditions 注释)
 *  - 未达标 && runs<上限 && 水位不足 ⇒ 拒跑:once 落 failed_permanent + paused(没余额的
 *    重跑不会变好,permanent 语义正是"重试不会变好");recurring 保持常规排期 + 拒跑通知
 *  - 未达标 && runs≥上限 ⇒ 收敛(预算用尽;once: completed;recurring: 常规继续)
 */
export function planGoalOutcome(input: GoalOutcomeInput): GoalOutcome {
  const { goal, verdict, scheduleType, rruleNextRunAt, now, balanceOk } = input
  const isOnce = scheduleType === 'once'
  const runs = goal.runs + 1
  const base: AutomationGoalState = {
    config: goal.config,
    runs,
    ...(verdict
      ? {
          lastVerdict: { met: verdict.met, reason: verdict.reason, evaluatedAt: now.toISOString() },
        }
      : {}),
  }

  if (verdict === null) {
    const note = 'Goal 自评结论未能解析,按未达标收敛处理(不自动重跑)'
    const g = { ...base, note }
    return isOnce
      ? {
          action: 'finish',
          goal: g,
          nextRunAt: null,
          terminalReason: 'completed',
          summaryLine: note,
        }
      : {
          action: 'finish',
          goal: g,
          nextRunAt: rruleNextRunAt,
          terminalReason: null,
          summaryLine: note,
        }
  }

  if (verdict.met) {
    const summaryLine = `Goal 达标:${verdict.reason}`
    return isOnce
      ? { action: 'finish', goal: base, nextRunAt: null, terminalReason: 'completed', summaryLine }
      : {
          action: 'finish',
          goal: base,
          nextRunAt: rruleNextRunAt,
          terminalReason: null,
          summaryLine,
        }
  }

  if (runs < goal.config.maxRuns) {
    if (balanceOk) {
      return {
        action: 'rerun',
        goal: base,
        nextRunAt: new Date(now.getTime() + GOAL_RERUN_DELAY_MS),
        terminalReason: null,
        summaryLine: `Goal 未达标(${runs}/${goal.config.maxRuns}),已安排自动重跑:${verdict.reason}`,
      }
    }
    const refusal = `Goal 未达标且余额(水位)不足,已拒绝自动重跑:${verdict.reason}`
    if (isOnce) {
      return {
        action: 'finish',
        goal: { ...base, note: refusal },
        nextRunAt: null,
        terminalReason: 'failed_permanent',
        status: 'paused',
        lastError: refusal.slice(0, 500),
        summaryLine: refusal,
        refusalNotice: refusal,
      }
    }
    return {
      action: 'finish',
      goal: { ...base, note: refusal },
      nextRunAt: rruleNextRunAt,
      terminalReason: null,
      summaryLine: refusal,
      refusalNotice: refusal,
    }
  }

  const summaryLine = `Goal 未达标,迭代预算已用尽(${runs}/${goal.config.maxRuns}),停止自动重跑:${verdict.reason}`
  return isOnce
    ? {
        action: 'finish',
        goal: { ...base, note: summaryLine },
        nextRunAt: null,
        terminalReason: 'completed',
        summaryLine,
      }
    : {
        action: 'finish',
        goal: { ...base, note: summaryLine },
        nextRunAt: rruleNextRunAt,
        terminalReason: null,
        summaryLine,
      }
}

// =============================================================================
// 水位检查(只读预检,真相源与 token-balance-service 的 DB 兜底腿同列)
// =============================================================================

/**
 * 用户 token 余额是否为正。查不到行/查询异常一律判**不足**(fail-closed:
 * 水位检查的意义就是"没确认有钱就别花",查询坏了宁可拒跑并通知,不可放行空烧)。
 */
export async function hasPositiveTokenBalance(userId: string): Promise<boolean> {
  try {
    const [row] = await db
      .select({ tokenQuantity: userMargins.tokenQuantity })
      .from(userMargins)
      .where(eq(userMargins.userId, userId))
      .limit(1)
    const balance = row?.tokenQuantity
    return typeof balance === 'number' && Number.isFinite(balance) && balance > 0
  } catch {
    return false
  }
}

// =============================================================================
// 站内通知(结果摘要推送;失败绝不阻断结算 —— 通知是旁路,账在本行)
// =============================================================================

export interface AutomationTerminalNotifyInput {
  userId: string
  automationId: string
  name: string
  /** 可深链的会话引用(绑定会话 id 或 auto_<id> 独立线程) */
  sessionId: string
  terminalReason: AutomationTerminalReason
  summary: string
}

/** 终态结果推送:标题=自动化名,正文=结果摘要截断,data 带深链引用(Web NotificationCenter 数据源)。 */
export async function notifyAutomationTerminal(
  input: AutomationTerminalNotifyInput,
): Promise<void> {
  try {
    const row = await createNotification({
      userId: input.userId,
      type: AUTOMATION_NOTIFICATION_TYPE,
      title: input.name.slice(0, 255),
      content: input.summary.slice(0, NOTIFY_CONTENT_LIMIT),
      data: {
        automationId: input.automationId,
        sessionId: input.sessionId,
        terminalReason: input.terminalReason,
      },
    })
    // 推送整行(与 notification-worker 的 payload 同形):Web 侧栏按 data.sessionId 渲染「查看会话」深链
    pushNotificationSafely(input.userId, row as unknown as Record<string, unknown>)
  } catch (err) {
    console.warn(
      `[agent-automation] 自动化 ${input.automationId} 的终态通知落库失败(不影响结算):${String(err)}`,
    )
  }
}

export interface GoalRefusalNotifyInput {
  userId: string
  automationId: string
  name: string
  sessionId: string
  notice: string
}

/** Goal 水位拒跑的独立通知(标题点名"重跑被拒",与执行结果通知分档,用户一眼可辨)。 */
export async function notifyGoalRefusal(input: GoalRefusalNotifyInput): Promise<void> {
  try {
    const row = await createNotification({
      userId: input.userId,
      type: AUTOMATION_NOTIFICATION_TYPE,
      title: `${input.name}:Goal 重跑被拒`.slice(0, 255),
      content: input.notice.slice(0, NOTIFY_CONTENT_LIMIT),
      data: {
        automationId: input.automationId,
        sessionId: input.sessionId,
        refusal: 'insufficient_balance',
      },
    })
    pushNotificationSafely(input.userId, row as unknown as Record<string, unknown>)
  } catch (err) {
    console.warn(
      `[agent-automation] 自动化 ${input.automationId} 的拒跑通知落库失败(不影响结算):${String(err)}`,
    )
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
