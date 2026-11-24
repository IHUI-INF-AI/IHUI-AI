// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序历史 → 统一会话表(chat_conversations)的存量收编器（2026-11-24 立）。
 *
 * 背景：机主定令「所有接口所有功能全部多端互通,但要分好是从哪个端操作录入的」。
 * 新写入已由 `apps/api/src/routes/ai-user-model-chat.ts` 双写（source='miniapp', source_ref=history.id），
 * 存量历史必须一次性收编，否则三端列表对老对话仍然互相看不见。
 *
 * 幂等键 = (user_id, source, source_ref) 的部分唯一索引 ⇒ 收编、双写、重跑三者共用一把钥匙，
 * 重复执行只会有一次落库（ON CONFLICT DO NOTHING）。
 *
 * 用法：
 *   node scripts/conversations-adopt-miniapp.mjs                 # 干跑：只报数，不写库
 *   node scripts/conversations-adopt-miniapp.mjs --apply         # 真收编（分批 + 逐条台账）
 *   node scripts/conversations-adopt-miniapp.mjs --verify        # 对账：镜像数 / 悬空镜像 / 未收编数
 *   node scripts/conversations-adopt-miniapp.mjs --rollback      # 按台账回滚（只删 source='miniapp' 的镜像行）
 *
 * 台账：.ihui-agent/state/conversation-adopt.jsonl（逐行 { at, conversationId, sourceRef, userId }）
 * 取不到库或取不到台账 ⇒ exit 2 显式「未判定」，不猜、不回落。
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const ROOT = path.resolve(import.meta.dirname, '..')
const requireFromDb = createRequire(path.join(ROOT, 'packages/database/package.json'))
const postgres = requireFromDb('postgres')

const LEDGER = path.join(ROOT, '.ihui-agent/state/conversation-adopt.jsonl')

function readDatabaseUrl() {
  for (const rel of ['.env', 'apps/api/.env', 'packages/database/.env']) {
    const p = path.join(ROOT, rel)
    if (!fs.existsSync(p)) continue
    const m = fs.readFileSync(p, 'utf8').match(/^DATABASE_URL=(.+)$/m)
    if (m) return m[1].trim()
  }
  return null
}

function undetermined(msg) {
  console.error(`[adopt] 未判定：${msg}`)
  process.exit(2)
}

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const VERIFY = args.includes('--verify')
const ROLLBACK = args.includes('--rollback')
const BATCH = 200

const url = readDatabaseUrl()
if (!url) undetermined('三处 .env 都找不到 DATABASE_URL')
const sql = postgres(url, { max: 1 })

try {
  if (ROLLBACK) {
    if (!fs.existsSync(LEDGER)) undetermined(`台账不存在：${LEDGER}`)
    const rows = fs
      .readFileSync(LEDGER, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l))
    const ids = rows.map((r) => r.conversationId).filter((id) => typeof id === 'string')
    if (ids.length === 0) {
      console.log('[adopt] 台账 0 条，无需回滚')
      await sql.end()
      process.exit(0)
    }
    let removed = 0
    for (let i = 0; i < ids.length; i += BATCH) {
      const slice = ids.slice(i, i + BATCH)
      const del = await sql`
        DELETE FROM chat_conversations
        WHERE source = 'miniapp' AND id = ANY(${slice}::uuid[])
        RETURNING id`
      removed += del.length
    }
    console.log(`[adopt] 回滚完成：台账 ${ids.length} 条，实际删除 ${removed} 条`)
    await sql.end()
    process.exit(0)
  }

  const [hist] = await sql`SELECT count(*)::int AS n FROM zhs_ai_user_model_chat_history`
  const [mirror] = await sql`
    SELECT count(*)::int AS n FROM chat_conversations
    WHERE source = 'miniapp' AND source_ref IS NOT NULL`
  const [adoptable] = await sql`
    SELECT count(*)::int AS n
    FROM zhs_ai_user_model_chat_history h
    JOIN users u ON u.id::text = h.user_id
    WHERE h.user_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'`
  const [orphanUser] = await sql`
    SELECT count(*)::int AS n
    FROM zhs_ai_user_model_chat_history h
    LEFT JOIN users u ON u.id::text = h.user_id
    WHERE u.id IS NULL`
  const [folders] = await sql`
    SELECT count(DISTINCT (h.user_id, btrim(h.folder)))::int AS n
    FROM zhs_ai_user_model_chat_history h
    WHERE h.folder IS NOT NULL AND btrim(h.folder) <> ''
      AND h.user_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'`
  const [dangling] = await sql`
    SELECT count(*)::int AS n FROM chat_conversations c
    WHERE c.source = 'miniapp' AND c.source_ref IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM zhs_ai_user_model_chat_history h WHERE h.id::text = c.source_ref)`

  console.log(
    `[adopt] 历史 ${hist.n} 条 | 已镜像 ${mirror.n} 条 | 可收编 ${adoptable.n} 条 | ` +
      `用户不存在 ${orphanUser.n} 条 | 文件夹 ${folders.n} 组 | 悬空镜像 ${dangling.n} 条`,
  )

  if (VERIFY) {
    const missing = adoptable.n - mirror.n
    console.log(
      `[adopt] 对账：未收编 ${missing} 条${missing === 0 ? '（已收口）' : ''}；悬空镜像 ${dangling.n} 条` +
        `${dangling.n === 0 ? '（无幽灵行）' : '（历史已删但镜像残留，需 --rollback 后重收）'}`,
    )
    await sql.end()
    process.exit(0)
  }

  if (!APPLY) {
    console.log('[adopt] 干跑结束。确认后加 --apply 真收编（分批 200，逐条写台账）')
    await sql.end()
    process.exit(0)
  }

  // ---- 真收编 ----
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true })
  const ledger = fs.createWriteStream(LEDGER, { flags: 'a' })

  // ① 文件夹名 → 统一分组表（同名一组，用户维度隔离）
  const groupIns = await sql`
    WITH src AS (
      SELECT DISTINCT h.user_id, btrim(h.folder) AS name
      FROM zhs_ai_user_model_chat_history h
      WHERE h.folder IS NOT NULL AND btrim(h.folder) <> ''
        AND h.user_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    )
    INSERT INTO chat_conversation_groups (user_id, name)
    SELECT src.user_id::uuid, src.name FROM src
    ON CONFLICT DO NOTHING
    RETURNING id`
  console.log(`[adopt] 分组补齐：新插入 ${groupIns.length} 组`)

  // ② 按批收编会话
  const pendingIds = await sql`
    SELECT h.id::text AS id
    FROM zhs_ai_user_model_chat_history h
    JOIN users u ON u.id::text = h.user_id
    WHERE NOT EXISTS (
      SELECT 1 FROM chat_conversations c
      WHERE c.source = 'miniapp' AND c.source_ref = h.id::text)
    ORDER BY h.created_at`
  console.log(`[adopt] 待收编 ${pendingIds.length} 条`)

  let inserted = 0
  for (let i = 0; i < pendingIds.length; i += BATCH) {
    const slice = pendingIds.slice(i, i + BATCH).map((r) => r.id)
    const rows = await sql`
      INSERT INTO chat_conversations
        (user_id, title, model, last_message_at, source, source_ref, pinned, pinned_at, group_id)
      SELECT
        u.id,
        COALESCE(NULLIF(btrim(h.title), ''), NULLIF(left(btrim(h.content), 30), ''), '小程序对话'),
        h.model,
        h.created_at,
        'miniapp',
        h.id::text,
        h.pinned,
        CASE WHEN h.pinned THEN h.created_at ELSE NULL END,
        gr.id
      FROM zhs_ai_user_model_chat_history h
      JOIN users u ON u.id::text = h.user_id
      LEFT JOIN chat_conversation_groups gr
        ON gr.user_id = u.id AND gr.name = btrim(h.folder)
      WHERE h.id::text = ANY(${slice}::text[])
      ON CONFLICT DO NOTHING
      RETURNING id::text AS conversation_id, source_ref, user_id::text AS user_id`
    inserted += rows.length
    const at = new Date().toISOString()
    for (const r of rows) {
      ledger.write(
        JSON.stringify({
          at,
          conversationId: r.conversation_id,
          sourceRef: r.source_ref,
          userId: r.user_id,
        }) + '\n',
      )
    }
    console.log(
      `[adopt] 批次 ${Math.min(i + BATCH, pendingIds.length)}/${pendingIds.length} 落库 ${rows.length}`,
    )
  }

  ledger.end()
  console.log(`[adopt] 收编完成：新插入 ${inserted} 条（台账 ${LEDGER}）`)

  // ③ 落地后自证
  const [after] = await sql`
    SELECT count(*)::int AS n FROM chat_conversations
    WHERE source = 'miniapp' AND source_ref IS NOT NULL`
  const [danglingAfter] = await sql`
    SELECT count(*)::int AS n FROM chat_conversations c
    WHERE c.source = 'miniapp' AND c.source_ref IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM zhs_ai_user_model_chat_history h WHERE h.id::text = c.source_ref)`
  console.log(`[adopt] 落地后：镜像 ${after.n} 条 / 悬空 ${danglingAfter.n} 条`)
  await sql.end()
  process.exit(danglingAfter.n === 0 ? 0 : 3)
} catch (err) {
  undetermined(err instanceof Error ? err.message : String(err))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
