// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// agent-runtime 会话持久化存储(P0 修复,2026-09-07 立)。
// 背景:agent-runtime 路由此前只用内存 SessionManager,进程重启即丢上下文。
// clawdbot_sessions.bot_id 是 uuid 外键,无法容纳 agent-runtime 的字符串 botId('default' 等),
// 故独立建表 agent_runtime_sessions(varchar 主键),本文件为该表的读写层。
// 写入策略:write-through(fire-and-forget,失败降级内存并告警,不打断对话流);
// 读取策略:内存 miss 后从 DB 惰性恢复。

import { eq, desc, sql, type SQL, and } from 'drizzle-orm'
import { agentRuntimeSessions, type Database } from '@ihui/database'
import type { Session, SessionStatus } from '../clawdbot/session-manager.js'

type DbHandle = Database

let dbDisabled = false
let dbCache: DbHandle | null = null

export function resetSessionStoreDbState(): void {
  dbDisabled = false
  dbCache = null
}

async function getDb(): Promise<DbHandle | null> {
  if (dbDisabled) return null
  if (dbCache) return dbCache
  try {
    const mod = await import('../../db/index.js')
    dbCache = mod.db
    return mod.db
  } catch {
    dbDisabled = true
    return null
  }
}

function toSession(row: typeof agentRuntimeSessions.$inferSelect): Session {
  const metadata = row.metadata ?? {}
  const messages = Array.isArray(row.messages) ? row.messages : []
  return {
    id: row.id,
    botId: row.botId,
    userId: row.userId,
    status: row.status as SessionStatus,
    context: {
      botId: row.botId,
      userId: row.userId,
      messages,
      metadata,
    },
    createdAt: row.createdAt.getTime(),
    lastActiveAt: row.updatedAt.getTime(),
  }
}

// G-815954:metadata 走具名成员合并 —— 本次写入点名的成员即 metadata 的自有键。
// undefined 成员归一为 null(JSON.stringify 会静默丢弃 undefined 键,不归一则"清空"意图无声丢失);
// 显式 null 与归一后的 null 都落成行内墓碑,防止重启后被旧值复活。
function namedMembersJson(metadata: Record<string, unknown>): string {
  const members: Record<string, unknown> = {}
  for (const key of Object.keys(metadata)) {
    members[key] = metadata[key] === undefined ? null : metadata[key]
  }
  return JSON.stringify(members)
}

// 写透单条会话。jsonb 列逐列声明写策略(G-815954,禁无声明整列覆盖):
// messages = 全量真相(内存 SessionManager 是转写唯一权威,显式清空即空数组整列落盘);
// metadata = 具名成员合并(不整列覆盖,否则吃掉行内"显式清空"墓碑与旧版回滚快照字段)。
export async function persistSession(session: Session): Promise<void> {
  const db = await getDb()
  if (!db) return
  try {
    await db
      .insert(agentRuntimeSessions)
      .values({
        id: session.id,
        botId: session.botId,
        userId: session.userId,
        status: session.status,
        messages: session.context.messages,
        metadata: session.context.metadata,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.lastActiveAt),
      })
      .onConflictDoUpdate({
        target: agentRuntimeSessions.id,
        set: {
          status: session.status,
          // messages:全量真相 —— 内存态即完整转写,整列落盘。
          messages: session.context.messages,
          // metadata:具名成员合并(`||` 右侧只含本次点名的成员):
          // 行内未被点名的旧成员是旧版回滚快照,不因本次写入未携带而被吃掉;
          // 点名为 null 的成员落成行内墓碑(下次导入不得复活旧值)。
          metadata: sql`${agentRuntimeSessions.metadata} || ${namedMembersJson(session.context.metadata)}::jsonb`,
          updatedAt: new Date(session.lastActiveAt),
        },
      })
  } catch (err) {
    dbDisabled = true
    console.warn('[agent-runtime-session-store] persist failed, fallback to memory:', err)
  }
}

// 内存 miss 时从 DB 恢复;不存在返回 null
export async function loadSessionFromDb(id: string): Promise<Session | null> {
  const db = await getDb()
  if (!db) return null
  try {
    const rows = await db
      .select()
      .from(agentRuntimeSessions)
      .where(eq(agentRuntimeSessions.id, id))
      .limit(1)
    if (rows.length === 0) return null
    return toSession(rows[0]!)
  } catch (err) {
    dbDisabled = true
    console.warn('[agent-runtime-session-store] load failed, fallback to memory:', err)
    return null
  }
}

// 列出持久化的会话(重启后 GET /sessions 不再返回空列表)
export async function listPersistedSessions(filter?: {
  status?: SessionStatus
  limit?: number
}): Promise<Session[]> {
  const db = await getDb()
  if (!db) return []
  try {
    const conds: SQL[] = []
    if (filter?.status) conds.push(eq(agentRuntimeSessions.status, filter.status))
    const query = db.select().from(agentRuntimeSessions)
    const rows = await (conds.length > 0 ? query.where(and(...conds)) : query)
      .orderBy(desc(agentRuntimeSessions.updatedAt))
      .limit(filter?.limit ?? 200)
    return rows.map(toSession)
  } catch (err) {
    dbDisabled = true
    console.warn('[agent-runtime-session-store] list failed, fallback to memory:', err)
    return []
  }
}

export async function deletePersistedSession(id: string): Promise<void> {
  const db = await getDb()
  if (!db) return
  try {
    await db.delete(agentRuntimeSessions).where(eq(agentRuntimeSessions.id, id))
  } catch (err) {
    dbDisabled = true
    console.warn('[agent-runtime-session-store] delete failed:', err)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
