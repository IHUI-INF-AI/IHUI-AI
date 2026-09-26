// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D35 长会话分页投影(2026-09-26 第二段):turn 序号的**唯一语义出口**。
 *
 * 为什么要单独一层:第一段把 turn 规则写进了 `db/chat-queries.ts` 的三个写入点
 * (createMessage / replaceMessages / branchConversationFrom),而绕过 service 的
 * 直插路径(patrol-scheduler 告警注入、conversation-import 落库)拿不到这套规则,
 * 于是它们写出的行 turn_ordinal 为 NULL —— 新分片端点对 NULL 行不可见,
 * 表现是"导入的会话/巡检告警会话翻不到历史"。
 *
 * 规矩:凡是要给 chat_messages 行算 turn 序号,**只能**调本模块,
 * 不得在端内再写一份 `role === 'user' ? ... : ...`(判据见
 * `apps/api/tests/chat-messages-insert-paths.test.ts`)。
 * 回填存量行的同一条规则在迁移
 * `packages/database/drizzle/<ts>_backfill_turn_ordinal.sql` 里以 SQL 形态表达,
 * 两者由 `apps/api/tests/turn-ordinal-backfill.test.ts` 逐条对账(不同形态、同语义)。
 */

/** 开启新轮的 role;其余 role(assistant/system)沿用当前轮。 */
const TURN_OPENING_ROLE = 'user'

/** 参与 turn 分组所需的最小行形态。 */
export interface TurnOrdinableRow {
  readonly role: string
}

/**
 * 单条新消息该取哪个 turn(与 `chat-queries.createMessage` 第一段口径逐字同形):
 * - user:会话内 max + 1(开启新轮)
 * - 其余:max(max, 1)(沿用当前轮;会话还没有任何轮时归 turn 1,不留 NULL)
 */
export function turnOrdinalForRole(maxTurnOrdinal: number, role: string): number {
  return role === TURN_OPENING_ROLE ? maxTurnOrdinal + 1 : Math.max(maxTurnOrdinal, 1)
}

/**
 * 一批**按写入顺序**给出的行 → 附带 turnOrdinal 的同一批行(顺序不变、长度不变)。
 * 与 `chat-queries.replaceMessages` 的重算规则同源:user 递增计数器,其余取当前轮。
 */
export function withTurnOrdinals<T extends TurnOrdinableRow>(
  rows: readonly T[],
): Array<T & { turnOrdinal: number }> {
  let currentTurn = 0
  return rows.map((row) => {
    const turnOrdinal = turnOrdinalForRole(currentTurn, row.role)
    if (row.role === TURN_OPENING_ROLE) currentTurn = turnOrdinal
    return { ...row, turnOrdinal }
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
