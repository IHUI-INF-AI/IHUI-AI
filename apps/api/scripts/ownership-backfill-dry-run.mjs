#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 归属回填**只读**干跑统计(2026-11-02,归属回填与 fail-open 收敛)。
 *
 * 统计两类"无归属"存量,并给出可推导比例:
 *  ① Postgres `agent_tasks.created_by IS NULL`:能否从 agents.user_id(智能体属主)推导;
 *  ② Redis `subagent:dispatch:*` hash 缺 ownerUserId:能否从
 *     chat_conversations.user_id / agent_tasks.created_by / 同会话 thread 兄弟推导。
 *
 * 只执行 SELECT / SMEMBERS / HGETALL / ZRANGE,不写任何键与行。
 * 本脚本是迁移 `20261102180000_ownership_backfill_before_tighten.sql` 的前置证据:
 * 先按这里输出的比例确认回填影响面,再执行迁移与应用发布。
 *
 * 用法(在 apps/api 目录或任意目录,显式给两个连接串):
 *   DATABASE_URL='postgresql://...' REDIS_URL='redis://...' \
 *     node apps/api/scripts/ownership-backfill-dry-run.mjs
 *
 * 退出码:0 = 成功并输出 JSON;2 = 缺少 DATABASE_URL / REDIS_URL。
 */
import postgres from 'postgres'
import Redis from 'ioredis'

const DATABASE_URL = process.env.DATABASE_URL
const REDIS_URL = process.env.REDIS_URL

if (!DATABASE_URL || !REDIS_URL) {
  console.error(
    '[ownership-dry-run] 缺少连接串:请设置 DATABASE_URL 与 REDIS_URL 后重跑(只读,不会写库/写键)',
  )
  process.exit(2)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const KEY_DISPATCH = 'subagent:dispatch:'
const KEY_IDS = 'subagent:dispatch:ids'
const KEY_THREAD = 'subagent:dispatch:thread:'

function ratio(part, total) {
  return total === 0 ? null : Number((part / total).toFixed(4))
}

const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} })
const redis = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 })

try {
  await redis.connect()

  // ---------- ① agent_tasks 无创建者存量 ----------
  const [dbStats] = await sql`
    select
      count(*)::int as total,
      count(*) filter (where t.created_by is null)::int as null_total,
      count(*) filter (where t.created_by is null and a.user_id is not null)::int as derivable_agent_owner,
      count(*) filter (where t.created_by is null and a.user_id is null)::int as non_derivable
    from agent_tasks t
    left join agents a on a.agent_id = t.agent_id
  `
  const agentTaskReport = {
    total: dbStats.total,
    null_total: dbStats.null_total,
    derivable_agent_owner: dbStats.derivable_agent_owner,
    non_derivable: dbStats.non_derivable,
    derivable_ratio: ratio(dbStats.derivable_agent_owner, dbStats.null_total),
    // 租户/时间窗:agent_tasks 没有 tenant_id;created_at 只能给"窗口分布",无法反推属主。
    derive_sources: ['agents.user_id (agent owner)'],
    unavailable_sources: ['tenant (no tenant_id column)', 'time window (cannot infer owner)'],
  }

  // ---------- ② Redis 派单无归属存量 ----------
  const ids = await redis.smembers(KEY_IDS)
  const conversationOwners = new Map()
  const agentTaskOwners = new Map()

  async function ownerOfConversation(conversationId) {
    if (!conversationId || !UUID_RE.test(conversationId)) return null
    if (conversationOwners.has(conversationId)) return conversationOwners.get(conversationId)
    const rows = await sql`
      select user_id from chat_conversations where id = ${conversationId} limit 1
    `
    const owner = typeof rows[0]?.user_id === 'string' ? rows[0].user_id : null
    conversationOwners.set(conversationId, owner)
    return owner
  }

  async function ownerOfAgentTask(agentTaskId) {
    if (!agentTaskId || !UUID_RE.test(agentTaskId)) return null
    if (agentTaskOwners.has(agentTaskId)) return agentTaskOwners.get(agentTaskId)
    const rows = await sql`
      select created_by from agent_tasks where id = ${agentTaskId} limit 1
    `
    const owner = typeof rows[0]?.created_by === 'string' ? rows[0].created_by : null
    agentTaskOwners.set(agentTaskId, owner)
    return owner
  }

  async function ownerFromThread(conversationId, selfId) {
    if (!conversationId) return null
    const members = await redis.zrange(`${KEY_THREAD}${conversationId}`, 0, -1)
    for (const member of members) {
      if (member === selfId) continue
      const owner = await redis.hget(`${KEY_DISPATCH}${member}`, 'ownerUserId')
      if (typeof owner === 'string' && owner.length > 0) return owner
    }
    return null
  }

  let hashes = 0
  let missingOwner = 0
  let alreadyOwned = 0
  let derivedConversation = 0
  let derivedAgentTask = 0
  let derivedThreadSibling = 0
  const missingIds = []

  for (const id of ids) {
    const raw = await redis.hgetall(`${KEY_DISPATCH}${id}`)
    if (!raw || !raw.id) continue
    hashes += 1
    const owner = typeof raw.ownerUserId === 'string' ? raw.ownerUserId : ''
    if (owner.length > 0) {
      alreadyOwned += 1
      continue
    }
    missingOwner += 1
    missingIds.push(id)

    if (await ownerOfConversation(raw.conversationId)) {
      derivedConversation += 1
      continue
    }
    if (await ownerOfAgentTask(raw.agentTaskId)) {
      derivedAgentTask += 1
      continue
    }
    if (await ownerFromThread(raw.conversationId, id)) {
      derivedThreadSibling += 1
      continue
    }
  }

  const totalMissing = missingOwner
  const derivable = derivedConversation + derivedAgentTask + derivedThreadSibling
  const redisReport = {
    totalIds: ids.length,
    hashes,
    alreadyOwned,
    missingOwner,
    derivable_conversation: derivedConversation,
    derivable_agent_task: derivedAgentTask,
    derivable_thread_sibling: derivedThreadSibling,
    orphan: totalMissing - derivable,
    derivable_ratio: ratio(derivable, totalMissing),
    derive_sources: [
      'chat_conversations.user_id',
      'agent_tasks.created_by',
      'thread sibling ownerUserId',
    ],
    unavailable_sources: ['tenant (dispatch has no tenant column)', 'time window (cannot infer owner)'],
    missing_ids: missingIds,
  }

  console.log(
    JSON.stringify(
      {
        dryRunAt: new Date().toISOString(),
        readOnly: true,
        agentTasks: agentTaskReport,
        dispatches: redisReport,
        impact: {
          // 迁移后仍为 NULL 的 agent_tasks 行 + 无 owner 的 Redis 派单 = 仅管理员可见的存量
          orphan_total: agentTaskReport.non_derivable + redisReport.orphan,
          affected_visible_to_all_before:
            agentTaskReport.null_total + redisReport.missingOwner,
        },
      },
      null,
      2,
    ),
  )
} catch (err) {
  console.error('[ownership-dry-run] 执行失败:', err)
  process.exitCode = 1
} finally {
  redis.disconnect()
  await sql.end({ timeout: 5 })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
