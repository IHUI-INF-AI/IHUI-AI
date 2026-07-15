/**
 * 通用 migration 应用脚本
 * 用法: pnpm tsx scripts/apply-migration.mjs drizzle/00XX_xxx.sql
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'

const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui'
const sql = postgres(url, { max: 1 })

const MIGRATION_FILE = process.argv[2]
if (!MIGRATION_FILE) {
  console.error('用法: pnpm tsx scripts/apply-migration.mjs <path-to-sql>')
  process.exit(1)
}

const migrationFile = resolve(process.cwd(), MIGRATION_FILE)
const migrationSql = readFileSync(migrationFile, 'utf-8')
const tag = MIGRATION_FILE.split('/').pop()?.replace('.sql', '') ?? 'unknown'
const hash = `manual_${tag}_${Date.now()}`

/**
 * 手写 PL/pgSQL 语句分割器
 * 正确处理 $$ ... $$ 块、单引号字符串、-- 单行注释
 */
function splitSqlStatements(input) {
  const result = []
  let buffer = ''
  let inDollarBlock = false
  let inSingleQuote = false
  let i = 0
  while (i < input.length) {
    const ch = input[i]
    const next2 = input.slice(i, i + 2)
    if (inSingleQuote) {
      buffer += ch
      if (ch === "'" && next2 !== "''") {
        inSingleQuote = false
      }
      i++
      continue
    }
    if (next2 === '$$') {
      inDollarBlock = !inDollarBlock
      buffer += next2
      i += 2
      continue
    }
    if (ch === "'" && !inDollarBlock) {
      inSingleQuote = true
      buffer += ch
      i++
      continue
    }
    if (ch === '-' && input[i + 1] === '-') {
      const eol = input.indexOf('\n', i)
      if (eol === -1) break
      buffer += input.slice(i, eol)
      i = eol
      continue
    }
    if (ch === ';' && !inDollarBlock && !inSingleQuote) {
      const trimmed = buffer.trim()
      if (trimmed) result.push(trimmed)
      buffer = ''
      i++
      continue
    }
    buffer += ch
    i++
  }
  const last = buffer.trim()
  if (last) result.push(last)
  return result
}

async function main() {
  console.log(`[apply-migration] 开始应用 ${MIGRATION_FILE}...`)

  const statements = splitSqlStatements(migrationSql)
  console.log(`[apply-migration] 解析出 ${statements.length} 条语句`)

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    try {
      await sql.unsafe(stmt)
      const firstLine = stmt.split('\n').find((l) => l.trim())?.trim()
      console.log(`[apply-migration] ✓ [${i + 1}/${statements.length}] ${firstLine?.slice(0, 70)}...`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('already exists') || (msg.includes('does not exist') && stmt.includes('DROP'))) {
        console.log(`[apply-migration] ⊙ [${i + 1}/${statements.length}] 跳过: ${msg.slice(0, 80)}`)
      } else {
        console.error(`[apply-migration] ✗ [${i + 1}/${statements.length}] 错误: ${msg}`)
        console.error(`[apply-migration] SQL: ${stmt.slice(0, 200)}`)
        throw err
      }
    }
  }

  // 记录到 __drizzle_migrations
  try {
    await sql`
      INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
      VALUES (${hash}, ${Date.now()})
      ON CONFLICT DO NOTHING
    `
    console.log('[apply-migration] ✓ 迁移记录已写入 __drizzle_migrations')
  } catch (err) {
    console.log(`[apply-migration] ⊙ 迁移记录写入跳过: ${err instanceof Error ? err.message : String(err)}`)
  }

  console.log('[apply-migration] ✅ 迁移完成')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[apply-migration] ❌ 迁移失败:', err)
    process.exit(1)
  })
  .finally(() => sql.end())
