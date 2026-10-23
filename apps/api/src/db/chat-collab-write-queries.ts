// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D125 另批收口(2026-10-23)写锁/接管发言 + 邀请改权限的**写面**查询。
 * 设计稿 docs/d125-session-collab-design.md §6:同一时刻单写者,锁落
 * `chat_conversations.metadata.collabLock`(§6 第 3 点预留的两案之一,拍板 metadata ——
 * 零新迁移,锁与会话同行、FOR UPDATE 天然同锁序,无跨表死锁面)。
 *
 * 为什么另起一文件而不是进 chat-collab-queries.ts:那份在飞(他席暂存),本票只可加法、
 * 不可碰;写锁是本票新增的独立职责面,分文件也让 chat.ts 的强制点只 import 这一份窄出口。
 *
 * 纪律(照 D35/O82 先例,chat-queries.ts:1155-1167 同款):
 *  ① 锁的读改写一律 `db.transaction + SELECT ... FOR UPDATE` 锁会话行 ——
 *     "读 metadata 再写回"在无行锁下并发双抢必分叉(与 turn 序号撞号同型缺陷);
 *  ② 结果取库确认集/事务返回值,不把"请求发了"当"锁拿到了";
 *  ③ metadata 其它键原样保留,只动 `collabLock` 一格。
 */
import { and, eq, ne } from 'drizzle-orm'
import { db } from './index.js'
import {
  chatConversations,
  chatConversationCollaborators,
  type ChatConversationCollaborator,
} from '@ihui/database'

/** 锁实况(与 collab:lock 帧的 holderUserId/acquiredAt 同一形态) */
export interface CollabLockState {
  holderUserId: string
  /** ISO 8601 */
  acquiredAt: string
}

/**
 * 纯函数读锁:metadata jsonb(null/{}/脏值/非对象)⇒ null(无锁)。
 * 判据刻意保守:holder 空串或 acquiredAt 解析不出 ⇒ 当成"没锁"而不是"半把锁"——
 * 半把锁会把发言门控卡死在一个谁也持不了的键上。
 */
export function readCollabLock(metadata: unknown): CollabLockState | null {
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) return null
  const raw = (metadata as Record<string, unknown>).collabLock
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const holder = (raw as Record<string, unknown>).holderUserId
  const at = (raw as Record<string, unknown>).acquiredAt
  if (typeof holder !== 'string' || holder.length === 0) return null
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null
  return { holderUserId: holder, acquiredAt: at }
}

/**
 * 发言门控纯函数(chat.ts POST /messages 强制点的判据,设计稿 §6"同一时刻单写者")。
 *  - `blocked`       ⇒ 409:他人持麦(属主也在内 —— 这正是锁的意义;属主想发言先夺/先放);
 *  - `floor-holder`  ⇒ 非属主持麦人放行(跳过属主门,这是"接管发言"的全部特权);
 *  - `owner-default` ⇒ 原语义(走 ensureOwnedConversation;含"无人持麦"与"属主自己持麦")。
 */
export function resolveFloorGate(input: {
  lock: CollabLockState | null
  userId: string
  ownerId: string
}): 'blocked' | 'floor-holder' | 'owner-default' {
  if (input.lock && input.lock.holderUserId !== input.userId) return 'blocked'
  if (input.lock && input.userId !== input.ownerId) return 'floor-holder'
  return 'owner-default'
}

function normalizeMetadataBase(metadata: unknown): Record<string, unknown> {
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) return {}
  return metadata as Record<string, unknown>
}

/**
 * 抢麦/接管。资格判定在路由(属主或 accepted 且非 plan 档),这里只管行锁下的原子占放:
 *  - 无人持麦 / 已是本人 ⇒ 写入本人,acquired=true;
 *  - 他人持麦且 takeover=false ⇒ **不写库**,acquired=false + 现锁(路由据此 409);
 *  - 他人持麦且 takeover=true ⇒ 覆盖写入,takenFrom=被夺者(路由发 `taken` 帧点名)。
 */
export async function acquireCollabLock(input: {
  conversationId: string
  holderUserId: string
  takeover: boolean
}): Promise<{ acquired: boolean; lock: CollabLockState; takenFrom: string | null }> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ metadata: chatConversations.metadata })
      .from(chatConversations)
      .where(eq(chatConversations.id, input.conversationId))
      .for('update')
    const row = rows[0]
    if (!row) throw new Error('acquireCollabLock: 对话不存在')
    const current = readCollabLock(row.metadata)
    if (current && current.holderUserId === input.holderUserId) {
      // 已是本人 ⇒ 幂等成功,不重写 acquiredAt(重写会把"持麦多久"的账面时钟拨表)
      return { acquired: true, lock: current, takenFrom: null }
    }
    if (current && !input.takeover) {
      return { acquired: false, lock: current, takenFrom: null }
    }
    const lock: CollabLockState = {
      holderUserId: input.holderUserId,
      acquiredAt: new Date().toISOString(),
    }
    await tx
      .update(chatConversations)
      .set({
        metadata: { ...normalizeMetadataBase(row.metadata), collabLock: lock },
        updatedAt: new Date(),
      })
      .where(eq(chatConversations.id, input.conversationId))
    return { acquired: true, lock, takenFrom: current ? current.holderUserId : null }
  })
}

/**
 * 交麦。`requesterUserId` 是持麦人本人,或 `force=true`(属主强制收麦)。
 * 他人持麦且非 force ⇒ released=false + previousHolder(路由据此 409,不静默放掉别人的麦)。
 */
export async function releaseCollabLock(input: {
  conversationId: string
  requesterUserId: string
  force: boolean
}): Promise<{ released: boolean; previousHolder: string | null }> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ metadata: chatConversations.metadata })
      .from(chatConversations)
      .where(eq(chatConversations.id, input.conversationId))
      .for('update')
    const row = rows[0]
    if (!row) throw new Error('releaseCollabLock: 对话不存在')
    const current = readCollabLock(row.metadata)
    if (!current) return { released: false, previousHolder: null }
    if (current.holderUserId !== input.requesterUserId && !input.force) {
      return { released: false, previousHolder: current.holderUserId }
    }
    const base = normalizeMetadataBase(row.metadata)
    const { collabLock: _dropped, ...rest } = base
    await tx
      .update(chatConversations)
      .set({ metadata: rest, updatedAt: new Date() })
      .where(eq(chatConversations.id, input.conversationId))
    return { released: true, previousHolder: current.holderUserId }
  })
}

/**
 * 撤销协作者时的夺锁出口:锁若恰由被撤销人持有 ⇒ 清掉(否则被撤销人永远占着麦,
 * 而他在发言门控里已经没有资格进来 —— 锁成了幽灵)。返回被清掉的持麦人,没占到 ⇒ null。
 */
export async function clearCollabLockIfHeldBy(
  conversationId: string,
  userId: string,
): Promise<string | null> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ metadata: chatConversations.metadata })
      .from(chatConversations)
      .where(eq(chatConversations.id, conversationId))
      .for('update')
    const row = rows[0]
    if (!row) return null
    const current = readCollabLock(row.metadata)
    if (!current || current.holderUserId !== userId) return null
    const base = normalizeMetadataBase(row.metadata)
    const { collabLock: _dropped, ...rest } = base
    await tx
      .update(chatConversations)
      .set({ metadata: rest, updatedAt: new Date() })
      .where(eq(chatConversations.id, conversationId))
    return userId
  })
}

/**
 * 属主改协作者档位(邀请管理 UI 的写面,设计稿 §6 第 1 点"四档全收"的授权面补票)。
 * 只动未撤销的行(status != revoked):对 revoked 行改档 = 复活一个已被撤销的协作关系,
 * 那是属主没说的动作。返回库确认行(含当前 status,路由拿它作失效帧的 state),空 ⇒ null。
 */
export async function updateCollaboratorTier(input: {
  conversationId: string
  userId: string
  tier: string
}): Promise<ChatConversationCollaborator | null> {
  const rows = await db
    .update(chatConversationCollaborators)
    .set({ tier: input.tier, updatedAt: new Date() })
    .where(
      and(
        eq(chatConversationCollaborators.conversationId, input.conversationId),
        eq(chatConversationCollaborators.userId, input.userId),
        ne(chatConversationCollaborators.status, 'revoked'),
      ),
    )
    .returning()
  return rows[0] ?? null
}
