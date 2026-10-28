// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * chat-sync 修订号账本 + resync 权威快照的读面(票 B02 第三切片,2026-10-25 立)。
 *
 * 契约正本 docs/chat-sync-contract.md(§2 rev 三条不许漂 / §7 第 3 项 resync 传输);
 * 类型在 @ihui/types 的 chat-sync-contract.ts。本文件是这两面的**服务端唯一读写出口**:
 *  - `allocateChatSyncRev`:rev 分配(UPSERT 原子递增,PG 持久 ⇒ 重启续读)。
 *    替代已退役的 Redis INCR / 壁钟回落两档 —— Redis 被清或无持久化时重启归零、
 *    壁钟值进链后重启必回退,两端都让端侧把新内容全判 stale
 *    (症状"另一台设备停在半截回复,而账面全绿",ws-broadcast.ts 前注同源)。
 *  - `findChatSyncSnapshot`:rev=N 全量快照读。内容(chat_messages)与 rev
 *    (chat_message_sync_revs)同库同读,天然一致 —— 契约 §2 第 3 条
 *    "rev=N 的 snapshot 必须已包含 ≤N 的全部内容变更"由同库同读这一事实直接兑现。
 *
 * 会话归属刻意不进 rev 账本(单源在 chat_messages,快照读 JOIN 一次即可,见 schema 头注)。
 */
import { and, eq, sql } from 'drizzle-orm'
import { db } from './index.js'
import { chatMessages, chatMessageSyncRevs } from '@ihui/database'

/**
 * 分配该消息的下一个修订号。首次分配 = 1;此后每次 +1。
 * UPSERT 的 `rev = rev + 1` 在 PG 行锁下原子,跨实例/跨重启严格递增、不重号、不回退。
 *
 * 失败语义:PG 不可用 ⇒ 抛错由调用方处置(广播面 catch 出声、不改写路径响应)。
 * **没有**回落档:任何"取不到权威就造一个数"的路径都会把假 rev 写进端侧链,
 * 之后真链恢复时全链判 stale —— 宁可这一帧广播失败(端侧退回打开会话拉取),
 * 也不伪造服务端坐标。
 */
export async function allocateChatSyncRev(messageId: string): Promise<number> {
  const rows = await db
    .insert(chatMessageSyncRevs)
    .values({ messageId, rev: 1 })
    .onConflictDoUpdate({
      target: chatMessageSyncRevs.messageId,
      set: { rev: sql`${chatMessageSyncRevs.rev} + 1`, updatedAt: sql`now()` },
    })
    .returning({ rev: chatMessageSyncRevs.rev })
  const row = rows[0]
  // UPSERT ... RETURNING 取不到行 = 数据库语义异常(插入或更新必有一行),
  // 按"未判定"显式抛错,绝不回落编一个数(§0.3:没判绝不写成判过)。
  if (!row || typeof row.rev !== 'number' || !Number.isInteger(row.rev) || row.rev < 1) {
    throw new Error(`allocateChatSyncRev: UPSERT 未返回合法 rev(messageId=${messageId})`)
  }
  return row.rev
}

/**
 * 读该消息当前的修订链头(只读账本,不写不递增)。
 *
 * 终态帧的 rev = 终结时已到达的链头、**不新增修订号**(契约 §2/§3),所以这里只读不 allocate。
 * 账本无行 ⇒ 0(created 哨兵,与 `findChatSyncSnapshot` 的 leftJoin null 同义);
 * 有行但值非法 ⇒ 抛错(不回落编一个数,与 allocateChatSyncRev 同纪律)。
 */
export async function readChatSyncRev(messageId: string): Promise<number> {
  const rows = await db
    .select({ rev: chatMessageSyncRevs.rev })
    .from(chatMessageSyncRevs)
    .where(eq(chatMessageSyncRevs.messageId, messageId))
    .limit(1)
  const row = rows[0]
  if (!row) return 0
  if (typeof row.rev !== 'number' || !Number.isInteger(row.rev) || row.rev < 1) {
    throw new Error(`readChatSyncRev: 账本 rev 非法(messageId=${messageId})`)
  }
  return row.rev
}

/** 快照行:内容与归属来自 chat_messages(权威),rev 来自账本(无行 ⇒ 0 = 链上无 patch)。 */
export interface ChatSyncSnapshotRow {
  conversationId: string
  messageId: string
  /** chat_messages.role 原样(字符串);封闭集校验归消费面(路由层判 409,不在此冒判)。 */
  role: string
  content: string
  reasoning: string | null
  rev: number
}

/**
 * 读某会话内某条消息的权威快照。消息不存在**或**不属于该会话 ⇒ null
 * (归属校验走 WHERE 的 conversation_id 谓词,不先查会话再查消息 —— 两查之间的
 * 归属变化窗口不存在,一查定案)。
 */
export async function findChatSyncSnapshot(
  conversationId: string,
  messageId: string,
): Promise<ChatSyncSnapshotRow | null> {
  const rows = await db
    .select({
      conversationId: chatMessages.conversationId,
      messageId: chatMessages.id,
      role: chatMessages.role,
      content: chatMessages.content,
      reasoning: chatMessages.reasoning,
      rev: chatMessageSyncRevs.rev,
    })
    .from(chatMessages)
    .leftJoin(chatMessageSyncRevs, eq(chatMessageSyncRevs.messageId, chatMessages.id))
    .where(and(eq(chatMessages.id, messageId), eq(chatMessages.conversationId, conversationId)))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  // leftJoin 无账行 ⇒ rev null;null 与 0 在契约里同义(created 哨兵 0,链下不存在 rev 0 的 patch)。
  return {
    conversationId: row.conversationId,
    messageId: row.messageId,
    role: row.role,
    content: row.content,
    reasoning: row.reasoning,
    rev: row.rev ?? 0,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
