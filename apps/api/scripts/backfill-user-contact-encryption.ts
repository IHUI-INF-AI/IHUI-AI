// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DB-35 方案②(2026-11-16 机主定案)应用层回填脚本。
 *
 * 迁移 20261116174441_users_contact_blind_index.sql 已做:
 *   · 建 phone_lookup / email_lookup 列;
 *   · 由**存量明文**回填 lookup(sha256 归一后值);
 *   · 唯一索引从明文列迁到 lookup 列。
 * 但 AES-GCM 用随机 IV,**无法在纯 SQL 内复现** encryptCredential ⇒
 * 存量明文 phone/email 的「加密写回」必须由本脚本用应用层 crypto 完成:
 *   逐行读明文 → encryptUserContact 加密 → 连 lookup 一起 UPDATE 写回。
 *
 * 幂等:只处理 phone/email 非空且非 enc:v1: 前缀(未加密)的行;已加密行跳过。
 * 安全:只允许在显式显式声明的库跑(与 seed-test-users 同一防呆纪律),拒绝生产库。
 *
 * 用法:
 *   pnpm --filter @ihui/api tsx scripts/backfill-user-contact-encryption.ts [--dry-run]
 */

import 'dotenv/config'
import postgres from 'postgres'
import {
  encryptUserContact,
  hashUserContact,
  normalizeUserContact,
} from '../src/utils/user-contact.js'

const DRY_RUN = process.argv.includes('--dry-run')

/** 显式库防呆:拒绝明显是生产名的库。 */
function assertNotProdDb(url: string): void {
  const u = new URL(url)
  const db = u.pathname.replace(/^\//, '')
  const FORBIDDEN = /^(ihui_prod|prod|production)$/i
  if (FORBIDDEN.test(db)) {
    throw new Error(`拒绝在疑似生产库(${db})跑回填。请显式指向开发/测试库。`)
  }
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) throw new Error('DATABASE_URL 未设置,拒绝跑回填(不猜默认值,防误指生产)。')
  assertNotProdDb(url)

  const sql = postgres(url, { max: 2 })

  // 回填需绕过 users_block_system_admin_modify 触发器(系统管理员行默认不可改,除 password_hash)。
  // 与迁移 20261116174441 同一策略:DROP 两触发器 → 回填 → 按 pg_get_triggerdef 原文重建(保真)。
  // 仅在非 dry-run 且确有待处理行时才动触发器,且 finally 必重建,绝不留删除态。
  type TrigDef = { tgname: string; def: string }
  let droppedTriggers: TrigDef[] = []

  try {
    // 取所有 phone/email 任一仍为明文(非 enc:v1:)的行
    const rows = await sql`
      SELECT id, phone, email FROM users
       WHERE (phone IS NOT NULL AND phone <> '' AND phone NOT LIKE 'enc:v1:%')
          OR (email IS NOT NULL AND email <> '' AND email NOT LIKE 'enc:v1:%')
    `

    console.info(`[backfill] 待处理行数: ${rows.length}${DRY_RUN ? ' (dry-run,不写库)' : ''}`)

    if (!DRY_RUN && rows.length > 0) {
      // DB-35:密文 enc:v1:iv:tag:ct 远超原列宽(phone varchar(20) / email varchar(255))。
      // 迁移只建了 lookup 列,未扩 phone/email 列宽 ⇒ 回填时密文塞不下会报 22001。
      // 解决:先扩为 TEXT(应用层 zod 已做长度校验,DB 层不需要硬限),再回填。
      await sql`ALTER TABLE users ALTER COLUMN phone TYPE text`
      await sql`ALTER TABLE users ALTER COLUMN email TYPE text`
      console.info('[backfill] 已扩 phone/email 列宽为 text(原 varchar 装不下密文)')

      const defs = await sql`
        SELECT tgname, pg_get_triggerdef(t.oid) AS def
          FROM pg_trigger t
         WHERE tgrelid = 'users'::regclass AND t.tgname IN (
           'users_system_admin_immutable_delete', 'users_system_admin_immutable_update'
         )
      `
      droppedTriggers = defs.map((d) => ({ tgname: d.tgname as string, def: d.def as string }))
      for (const d of droppedTriggers) {
        // tgname 来自 pg_trigger 系统目录(非用户输入),用 unsafe 拼标识符(参数化插值在标识符位置非法)
        await sql.unsafe(`DROP TRIGGER IF EXISTS ${d.tgname} ON users`)
      }
      console.info(
        `[backfill] 已临时 DROP ${droppedTriggers.length} 个系统管理员保护触发器(回填后重建)`,
      )
    }

    let phoneDone = 0
    let emailDone = 0
    let skipped = 0

    for (const row of rows) {
      const updates: Record<string, string | null> = {}

      if (row.phone && !row.phone.startsWith('enc:v1:')) {
        const enc = encryptUserContact(row.phone) ?? null
        const norm = normalizeUserContact('phone', row.phone)
        updates.phone = enc
        updates.phone_lookup = norm === '' ? null : hashUserContact('phone', norm)
        phoneDone++
      }
      if (row.email && !row.email.startsWith('enc:v1:')) {
        const enc = encryptUserContact(row.email) ?? null
        const norm = normalizeUserContact('email', row.email)
        updates.email = enc
        updates.email_lookup = norm === '' ? null : hashUserContact('email', norm)
        emailDone++
      }

      if (Object.keys(updates).length === 0) {
        skipped++
        continue
      }

      if (DRY_RUN) {
        console.info(`  [dry] ${row.id}: ${Object.keys(updates).join(', ')}`)
        continue
      }

      // 逐行 UPDATE(按 id 主键;行数是存量规模,通常小)
      if ('phone' in updates) {
        await sql`UPDATE users SET phone = ${updates.phone!}, phone_lookup = ${updates.phone_lookup!} WHERE id = ${row.id}`
      }
      if ('email' in updates) {
        await sql`UPDATE users SET email = ${updates.email!}, email_lookup = ${updates.email_lookup!} WHERE id = ${row.id}`
      }
    }

    console.info(
      `[backfill] 完成: phone 加密 ${phoneDone} 行, email 加密 ${emailDone} 行, 跳过 ${skipped} 行${DRY_RUN ? ' (dry-run 未写库)' : ''}`,
    )

    // 读回核对:加密后应无明文残留
    const [after] = await sql`
      SELECT
        count(*) FILTER (WHERE phone IS NOT NULL AND phone <> '' AND phone NOT LIKE 'enc:v1:%') AS phone_plain_left,
        count(*) FILTER (WHERE email IS NOT NULL AND email <> '' AND email NOT LIKE 'enc:v1:%') AS email_plain_left
      FROM users
    `
    console.info(
      `[verify] 回填后明文残留: phone=${after!.phone_plain_left}, email=${after!.email_plain_left} (应为 0)`,
    )
    if (!DRY_RUN && (Number(after!.phone_plain_left) > 0 || Number(after!.email_plain_left) > 0)) {
      console.error('[verify] ❌ 仍有明文残留,回填不完整')
      process.exitCode = 1
    }
  } finally {
    // 回填后按 pg_get_triggerdef 原文重建触发器(保真;绝不留删除态)
    if (droppedTriggers.length > 0) {
      try {
        for (const d of droppedTriggers) {
          await sql.unsafe(d.def)
        }
        console.info(`[backfill] 已重建 ${droppedTriggers.length} 个系统管理员保护触发器`)
      } catch (e) {
        console.error('[backfill] ❌ 触发器重建失败,请手工用 pg_get_triggerdef 重建:', e)
        process.exitCode = 1
      }
    }
    await sql.end()
  }
}

void main().catch((e) => {
  console.error('[backfill] 失败:', e)
  process.exit(1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
