// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { sql } from 'drizzle-orm'
import { check, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * 对话流业务表单的用户应答(D77/G-106 第①格,2026-10-20 机主拍板授权落库)。
 *
 * 为什么必须落库而不是继续留在 ai-service 的进程内 dict:待决项在工具循环结算时
 * 会被无条件 `pop`,一 pop 就没有任何留存证据 —— 票面验收要的是"填→批准→后端落",
 * 内存里那一格既活不过重启,也回答不了"这条表单当时到底答了什么"。
 *
 * 为什么主键是 request_id 而不是自增 id:它同时是幂等锚点。应答可能因重试被送到两次
 * (上行端点与工具循环的 pop 之间存在竞态窗口),同一 request_id 只允许留下一行,
 * 幂等由存储层的主键 + `ON CONFLICT DO NOTHING` 兜住,而不是靠某个调用方的内存判断。
 *
 * 为什么没有 user_id 列:本表记的是"某个会话里某次表单应答的裁决",归属判定发生在
 * 写入**之前**的结算闸门(ai-service `post_form_response` 只认待决项里记录的令牌主体,
 * 主体不一致时既不结算也不写)。把身份再抄一列进这份证据,只是把同一个事实写第二遍。
 *
 * 为什么 reject 行的 values 必须是 NULL 而不是空对象:空对象会诱导下游"照着一份空
 * 内容建一条草稿/日程"——与上行端 `buildFormResponseEvent` 的成对判据同一条。
 */
export const chatFormResponses = pgTable(
  'chat_form_responses',
  {
    requestId: text('request_id').primaryKey(),
    sessionId: text('session_id').notNull(),
    kind: text('kind').notNull(),
    action: text('action').notNull(),
    /** 仅 approve 携带;reject 行恒为 NULL */
    values: jsonb('values'),
    /** 仅 reject 携带 */
    rejectReason: text('reject_reason'),
    decidedAt: timestamp('decided_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    /** 值域在 DB 层封闭:裁决只有"批准/拒绝"两档,第三值当场被拒(与 llm_call_logs 同纪律)。 */
    actionChk: check('chat_form_responses_action_check', sql`${t.action} in ('approve', 'reject')`),
    sessionIdx: index('chat_form_responses_session_idx').on(t.sessionId),
  }),
)

export type ChatFormResponse = typeof chatFormResponses.$inferSelect
export type NewChatFormResponse = typeof chatFormResponses.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
