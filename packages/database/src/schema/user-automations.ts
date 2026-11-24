// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 用户侧 Agent 定时自动化表(2026-09-07 立)。
 *
 * 用户创建"定时任务"(名称 + prompt + 一次性/重复计划)→ 服务端调度器到点自动执行
 * agent → 用户在 /automations 页面查看结果/暂停/恢复/立即运行/删除。
 * 调度器实现在 apps/api/src/services/agent-automation-scheduler.ts(60s tick 轮询)。
 */
import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core'

/** lastResult jsonb 结构:执行完成后由调度器写入 */
export interface AutomationLastResult {
  finishedAt: string
  summary: string
}

export const userAutomations = pgTable(
  'user_automations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    prompt: text('prompt').notNull(),
    /** 'once' | 'recurring' */
    scheduleType: varchar('schedule_type', { length: 20 }).default('once').notNull(),
    /** RFC 5545 RRULE(MVP 仅支持 FREQ=HOURLY/DAILY/WEEKLY + BYHOUR/BYMINUTE/BYDAY) */
    rrule: varchar('rrule', { length: 500 }),
    /** 一次性计划的执行时间(timestamptz) */
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    timezone: varchar('timezone', { length: 64 }).default('Asia/Shanghai').notNull(),
    /** 'active' | 'paused'(调度器解析 rrule 失败时自动置 paused 防死循环) */
    status: varchar('status', { length: 20 }).default('active').notNull(),
    /** G-241(2026-10-26 立)**终态成因**:status='paused' 只说"不再排",说不清"为什么不排"。
     *  三台机器都会把 paused 写进去(永久失败 / 重试超上限 / rrule 解析失败 / 用户手动暂停),
     *  只靠自由文本 last_error 反推既不封闭也会被成功结算清成 null ⇒ 判据读不出是哪一档。
     *  取值 = AUTOMATION_TERMINAL_REASONS 封闭集;null = 无终态(在排或在跑)。 */
    terminalReason: varchar('terminal_reason', { length: 32 }),
    /** D12(2026-09-19 立):绑定的聊天会话 ID(chat_conversations.id)。
     *  非空时自动化执行会注入该会话近期消息作为上下文,并把产出落库到同一会话(线程接力)。 */
    conversationId: uuid('conversation_id'),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    /** recurring 下次执行时间(调度器每次执行后重算) */
    nextRunAt: timestamp('next_run_at', { withTimezone: true }),
    lastResult: jsonb('last_result').$type<AutomationLastResult>(),
    /** G-669(2026-10-01 立)transient 连续重试计数。
     *  语义:成功结算即归零;>0 同时是"这一行在重试队列里"的**唯一标记** ——
     *  tick 的一次性重试分支必须带 `attempt > 0`,否则历史 once 行里那条
     *  `nextRunAt = scheduledAt`(见 routes/automations.ts 的 computeNextRunAt)
     *  会被当成重试位反复捞起,把一个"已成功的一次性任务"重放成周期任务。 */
    attempt: integer('attempt').default(0).notNull(),
    /** G-669:最后一次失败的可读原因(含分类档位与命中判据);成功时置 null。 */
    lastError: text('last_error'),
    /** G-241(2026-10-26 立)**执行体认领凭据**:一次触发的"谁在跑"标记,由行级 CAS
     *  (`UPDATE … WHERE claim_token IS NULL …` 命中 1 行)写入,结算时随同一笔 UPDATE 清掉。
     *  为什么必须有列:进程内的单飞(`services/automations/index.ts` 的 `createSingleFlightTick`)
     *  只看得见自己这一个 tick,两个 api 进程 / tick 与 run-now 并发时**同一次触发会跑两遍**;
     *  而"取回"与"执行"之间隔着一次可能长达数分钟的 agent 运行,只读复核挡不住。 */
    claimToken: varchar('claim_token', { length: 64 }),
    /** G-241:认领落租约的时刻。执行体崩溃时租约**必须会过期**,否则那一行永远无人认领
     *  (失效方向不能是"静默停摆");判租超龄的执行体可接管,接管条件与认领 CAS 同一条。 */
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    /** G-241(2026-10-27 立)结算状态机**显式状态字段**:把 pending_claim / processing /
     *  backing_off / terminal 四态落到一列,作为 FSM 的第一公民态(其余列——attempt 退避计数、
     *  claimed_at / next_run_at / last_run_at 时间戳、terminal_reason 终态成因——已是 FSM 的
     *  持久化支撑)。由 settlement-state-machine.ts 的 deriveSettlementStatus 派生并写回;
     *  null 留给旧行(读作"尚未经 FSM 派生")。单一真相源见该服务文件。 */
    settlementStatus: varchar('settlement_status', { length: 24 }),
    /** G-241:到达终态的时刻。terminal_reason 只记"为什么停",本列记"何时停";
     *  与 settlement_status='terminal' 同时写、可空(非终态行留 null)。 */
    settlementTerminalAt: timestamp('settlement_terminal_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('user_automations_user_idx').on(t.userId),
    statusIdx: index('user_automations_status_idx').on(t.status),
    nextRunIdx: index('user_automations_next_run_idx').on(t.nextRunAt),
  }),
)

export type UserAutomation = typeof userAutomations.$inferSelect
export type NewUserAutomation = typeof userAutomations.$inferInsert

/**
 * G-241(2026-10-26 立)终态成因封闭集 —— `user_automations.terminal_reason` 的唯一词表。
 *
 * 为什么这一份住在 database 包而不是 api 服务里:写它的有两处(调度器结算出口 + PATCH 路由),
 * 读它的将来还有 UI;词表住第三处(共享层) ⇒ 任一侧新增一档都会先撞到 import 而不是各写一份
 * (§0.6 单一真相源)。`as const` 让 zod/TS 直接拿到字面量联合,不需要第二份枚举。
 *
 * - `manual_pause`               用户(或管理员)手动暂停:没有人格化的失败,只是不再排。
 * - `failed_permanent`           永久性失败(缺凭据/4xx/rrule 不可解析):重试不会变好。
 * - `failed_retries_exhausted`   临时性失败连击超 `MAX_TRANSIENT_ATTEMPTS`:退避有界的那条"界"。
 * - `completed`                  一次性任务成功跑完(`status` 仍是 active,别把它当 paused 读)。
 * - `null`                       无终态:在排、在跑、或周期任务刚跑完一轮等下次。
 */
export const AUTOMATION_TERMINAL_REASONS = [
  'manual_pause',
  'failed_permanent',
  'failed_retries_exhausted',
  'completed',
] as const

export type AutomationTerminalReason = (typeof AUTOMATION_TERMINAL_REASONS)[number]

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
