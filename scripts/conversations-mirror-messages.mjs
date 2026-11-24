// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序镜像会话 → 统一消息表(chat_messages)的存量补齐器（2026-11-24 立）。
 *
 * 背景：统一会话表只镜像了**会话行**（source='miniapp', source_ref=history.id），
 * 因此 web / RN 打开这条跨端会话时是空对话。小程序历史表一条 = 用户一句原话
 * （content），补一条 user 消息后对端就能看到「问的是什么」。
 *
 * 幂等：判据是 "该会话已有消息" —— 已补的一律跳过，重复执行零变化。
 *
 * 用法：
 *   node scripts/conversations-mirror-messages.mjs            # 干跑：只报数
 *   node scripts/conversations-mirror-messages.mjs --apply    # 真补（逐条台账）
 *   node scripts/conversations-mirror-messages.mjs --verify   # 对账：空镜像会话数
 *
 * 台账：.ihui-agent/state/conversation-mirror-msg.jsonl（逐行 { at, conversationId, sourceRef }）
 * 取不到库 ⇒ exit 2 显式「未判定」，不猜。
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const ROOT = path.resolve(import.meta.dirname, '..')
const requireFromDb = createRequire(path.join(ROOT, 'packages/database/package.json'))
const postgres = requireFromDb('postgres')

const LEDGER = path.join(ROOT, '.ihui-agent/state/conversation-mirror-msg.jsonl')

function readDatabaseUrl() {
  // 环境变量优先:一次性运维(如无 .env 的隔离工作树)可直接注入,不必往目录里落凭据文件
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim()
  for (const rel of ['.env', 'apps/api/.env', 'packages/database/.env']) {
    const p = path.join(ROOT, rel)
    if (!fs.existsSync(p)) continue
    const m = fs.readFileSync(p, 'utf8').match(/^DATABASE_URL=(.+)$/m)
    if (m) return m[1].trim()
  }
  return null
}

function undetermined(msg) {
  console.error(`[mirror-msg] 未判定：${msg}`)
  process.exit(2)
}

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const VERIFY = args.includes('--verify')
const ROLLBACK = args.includes('--rollback')

const url = readDatabaseUrl()
if (!url) undetermined('三处 .env 都找不到 DATABASE_URL')
const sql = postgres(url, { max: 1 })

/** 枚举全部小程序镜像会话及其源行内容、已有消息数 */
async function scan() {
  const rows = await sql`
    select c.id as conversation_id,
           c.source_ref,
           h.content,
           h.created_at as src_created_at,
           (select count(*) from chat_messages m where m.conversation_id = c.id) as msg_count
    from chat_conversations c
    left join zhs_ai_user_model_chat_history h on h.id::text = c.source_ref
    where c.source = 'miniapp'
    order by c.created_at asc
  `
  const empty = []
  const filled = []
  const dangling = []
  for (const r of rows) {
    const msgCount = Number(r.msg_count ?? 0)
    if (!r.content) dangling.push({ conversationId: r.conversation_id, sourceRef: r.source_ref })
    else if (msgCount === 0) empty.push(r)
    else filled.push(r)
  }
  return { total: rows.length, empty, filled, dangling }
}

if (ROLLBACK) {
  if (!fs.existsSync(LEDGER)) {
    console.log('[mirror-msg] 台账不存在，无可回滚')
    await sql.end()
    process.exit(0)
  }
  const lines = fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean)
  const ids = [...new Set(lines.map((l) => JSON.parse(l).conversationId))]
  let removed = 0
  for (const id of ids) {
    // 只删「该会话恰好 1 条消息」这一形态：那是本器物补的那份,真人写入的多轮消息一条不碰
    const res = await sql`
      delete from chat_messages
      where conversation_id = ${id}
        and (select count(*) from chat_messages m where m.conversation_id = ${id}) = 1
      returning id
    `
    removed += res.length
  }
  console.log(`[mirror-msg] 回滚：台账 ${ids.length} 个会话，删除 assistant 单条 ${removed} 条`)
  await sql.end()
  process.exit(0)
}

if (VERIFY) {
  const s = await scan()
  console.log(
    `[mirror-msg] verify：镜像会话 ${s.total} · 已有消息 ${s.filled.length} · 空对话 ${s.empty.length} · 源行缺失 ${s.dangling.length}`,
  )
  await sql.end()
  // 源行缺失(小程序历史已被用户删)属已知边界:补不了也不该补,只点名报数不判红
  process.exit(s.empty.length === 0 ? 0 : 1)
}

const s = await scan()
console.log(
  `[mirror-msg] 扫描：镜像会话 ${s.total} · 已有消息 ${s.filled.length} · 待补 ${s.empty.length} · 源行缺失 ${s.dangling.length}`,
)
if (s.dangling.length > 0) {
  console.log(`[mirror-msg] 源行缺失(跳过并点名)：${s.dangling.map((d) => d.sourceRef).join(', ')}`)
}

if (!APPLY) {
  console.log('[mirror-msg] 干跑结束（未写库）；加 --apply 才落库')
  await sql.end()
  process.exit(0)
}

let done = 0
fs.mkdirSync(path.dirname(LEDGER), { recursive: true })
for (const r of s.empty) {
  const content = String(r.content)
  // 存量只能补 AI 回复:小程序历史表 content 存的是 llmResult.content(assistant),
  // 用户原话当时没落库 ⇒ 这里补 role='assistant',不冒充 user(新写入路径两问一答都补)。
  await sql`
    insert into chat_messages (conversation_id, role, content, created_at)
    values (${r.conversation_id}, 'assistant', ${content}, ${r.src_created_at ?? new Date()})
  `
  fs.appendFileSync(
    LEDGER,
    `${JSON.stringify({ at: new Date().toISOString(), conversationId: r.conversation_id, sourceRef: r.source_ref })}\n`,
  )
  done += 1
}

const after = await scan()
console.log(
  `[mirror-msg] 已补 ${done} 条；复扫：空对话 ${after.empty.length} · 源行缺失 ${after.dangling.length}`,
)
await sql.end()
process.exit(after.empty.length === 0 ? 0 : 1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
