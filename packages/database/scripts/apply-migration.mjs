// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 通用 migration 应用脚本
 * 用法: pnpm tsx scripts/apply-migration.mjs drizzle/00XX_xxx.sql
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import postgres from 'postgres'
import { splitSqlStatements } from './lib/split-sql.mjs'
import {
  describeSkippedObject,
  planMigrationExecution,
  shouldSkipStatement,
} from './lib/migration-policy.mjs'

/**
 * DB-01 P1：账本口径必须与 drizzle 完全一致，否则 `drizzle-kit migrate`
 * 会因伪 hash / 被 Date.now() 抬高的 created_at 误判历史迁移已应用。
 * - hash = sha256(整份 SQL 文件内容) 的 hex；
 * - created_at = drizzle/meta/_journal.json 中对应 tag 的 `when`。
 */
export function computeMigrationHash(view) {
  return createHash('sha256').update(view).digest('hex')
}

/** 取不到 journal.when 时 fail-closed，绝不伪造时间戳。 */
export function resolveJournalWhen(migrationFile, tag) {
  const journalPath = join(dirname(migrationFile), 'meta', '_journal.json')
  if (!existsSync(journalPath)) {
    throw new Error(`找不到 drizzle journal: ${journalPath}，拒绝伪造迁移时间戳`)
  }
  const journal = JSON.parse(readFileSync(journalPath, 'utf-8'))
  const entries = Array.isArray(journal?.entries) ? journal.entries : []
  const entry = entries.find((e) => e?.tag === tag)
  if (!entry || typeof entry.when !== 'number' || !Number.isFinite(entry.when)) {
    throw new Error(
      `drizzle journal 中找不到 tag=${tag} 的有效 when，拒绝伪造迁移时间戳（请先生成该迁移的 journal 条目）`,
    )
  }
  return entry.when
}

async function applyStatements(exec, statements) {
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    const firstLine = stmt.split('\n').find((l) => l.trim())?.trim()
    try {
      // 事务内用 SAVEPOINT 隔离可跳过的幂等错误；否则 PostgreSQL 会把整个事务置为 aborted。
      await exec.savepoint(async (sp) => {
        await sp.unsafe(stmt)
      })
      console.log(`[apply-migration] ✓ [${i + 1}/${statements.length}] ${firstLine?.slice(0, 70)}...`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // DB-05：只按 SQLSTATE 白名单 + 语句形态判可跳过的幂等错误，绝不按消息子串吞错。
      if (shouldSkipStatement(err, stmt)) {
        const object = describeSkippedObject(err, stmt)
        console.log(
          `[apply-migration] ⊙ [${i + 1}/${statements.length}] 跳过(${err.code} ${object}): ${msg.slice(0, 80)}`,
        )
      } else {
        console.error(`[apply-migration] ✗ [${i + 1}/${statements.length}] 错误: ${msg}`)
        console.error(`[apply-migration] SQL: ${stmt.slice(0, 200)}`)
        throw err
      }
    }
  }
}

/**
 * 写账本。DB-01: hash 必须是文件 sha256，created_at 必须是 journal.when；
 * 账本写不进去就报错退出，绝不「跳过 + 假成功」。
 * 账本唯一性由 created_at 判定（drizzle 本身以 created_at 水位比较），
 * 已存在同 created_at 时校验 hash 一致，不一致即 fail-closed。
 */
async function recordLedger(exec, hash, when) {
  const rows = await exec`
    SELECT hash FROM drizzle."__drizzle_migrations"
    WHERE created_at = ${when}
    LIMIT 1
  `
  if (rows.length > 0) {
    if (rows[0].hash !== hash) {
      throw new Error(
        `账本冲突: created_at=${when} 已存在但 hash 不一致(账本=${rows[0].hash}, 文件=${hash})，拒绝覆盖`,
      )
    }
    console.log('[apply-migration] ⊙ 账本已存在同 hash 记录，跳过')
    return
  }
  await exec`
    INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
    VALUES (${hash}, ${when})
  `
  console.log('[apply-migration] ✓ 迁移记录已写入 __drizzle_migrations')
}

async function main() {
  const migrationArg = process.argv[2]
  if (!migrationArg) {
    console.error('用法: pnpm tsx scripts/apply-migration.mjs <path-to-sql>')
    process.exitCode = 1
    return
  }

  const migrationFile = resolve(process.cwd(), migrationArg)
  const migrationSql = readFileSync(migrationFile, 'utf-8')
  const tag = basename(migrationFile).replace(/\.sql$/i, '')
  const hash = computeMigrationHash(migrationSql)
  // 取不到 journal.when 直接抛错，不再用 Date.now() 抬高账本水位。
  const when = resolveJournalWhen(migrationFile, tag)

  console.log(`[apply-migration] 开始应用 ${migrationArg} (tag=${tag}, when=${when})...`)

  const { statements, semicolonCount, balanced } = splitSqlStatements(migrationSql)
  // 切割自检与 apply-all 保持一致：不平衡或语句数≠顶层分号数即拒绝执行。
  if (!balanced || semicolonCount !== statements.length) {
    throw new Error(
      `SQL 切分自检失败 ${migrationArg}: balanced=${balanced}, topLevelSemicolons=${semicolonCount}, statements=${statements.length}`,
    )
  }
  console.log(`[apply-migration] 解析出 ${statements.length} 条语句`)

  const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui'
  const sql = postgres(url, { max: 1 })
  try {
    // DB-05：CONCURRENTLY 不能在事务块内执行，拒绝该文件，不再降级为逐语句自动提交。
    planMigrationExecution(statements, migrationArg)
    // DB-05：整份迁移文件 + 账本写入包进一个事务；失败由 sql.begin 回滚（ROLLBACK）。
    await sql.begin(async (tx) => {
      // 同一 created_at 的并发手工执行串行化，避免无唯一索引的账本写双份。
      await tx`SELECT pg_advisory_xact_lock(hashtext(${'ihui:migration:' + when}))`
      await applyStatements(tx, statements)
      await recordLedger(tx, hash, when)
    })
  } finally {
    await sql.end()
  }

  console.log('[apply-migration] ✅ 迁移完成')
}

const isMain =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (isMain) {
  main()
    .then(() => process.exit(process.exitCode ?? 0))
    .catch((err) => {
      console.error('[apply-migration] ❌ 迁移失败:', err)
      process.exit(1)
    })
}

export { splitSqlStatements }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
