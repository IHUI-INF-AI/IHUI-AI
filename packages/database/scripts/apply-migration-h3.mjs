/**
 * 手动应用 0046_missing_tables_h3.sql 迁移
 * 用于绕过 drizzle-kit migrate 的旧迁移冲突
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'

const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui'
const sql = postgres(url, { max: 1 })

const migrationFile = resolve(process.cwd(), 'packages/database/drizzle/0046_missing_tables_h3.sql')
const migrationSql = readFileSync(migrationFile, 'utf-8')

// 标记为已应用的哈希（使用简单哈希）
const hash = `manual_0046_${Date.now()}`

async function main() {
  console.log('[apply-migration-h3] 开始应用 0046_missing_tables_h3.sql...')

  // 先检查新表是否已存在
  const existing = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
      'edu_order_items',
      'resource_downloads',
      'resource_search_logs',
      'user_jobs',
      'edu_member_company_relations',
      'edu_member_level_relations',
      'edu_member_post_relations',
      'edu_member_tag_relations',
      'edu_resource_product_relations'
    )
  `
  if (existing.length > 0) {
    console.log(`[apply-migration-h3] 部分表已存在: ${existing.map((r) => r.table_name).join(', ')}`)
    console.log('[apply-migration-h3] 使用 CREATE TABLE IF NOT EXISTS 继续应用...')

    // 检查 edu_member_level_relations 的列是否匹配
    const levelCols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'edu_member_level_relations'
      ORDER BY ordinal_position
    `
    console.log(`[apply-migration-h3] edu_member_level_relations 现有列: ${levelCols.map((r) => r.column_name).join(', ')}`)

    // 如果缺少 member_id 列，先删除旧表再重建
    if (levelCols.length > 0 && !levelCols.some((r) => r.column_name === 'member_id')) {
      console.log('[apply-migration-h3] edu_member_level_relations 结构不匹配，删除旧表后重建...')
      await sql`DROP TABLE IF EXISTS "edu_member_level_relations" CASCADE`
      console.log('[apply-migration-h3] ✓ 旧表已删除')
    }
  }

  // 执行迁移 SQL（按语句分割，保留注释行以便定位）
  const statements = migrationSql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  for (const stmt of statements) {
    // 移除纯注释行
    const cleanStmt = stmt
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n')
      .trim()

    if (!cleanStmt) continue

    try {
      await sql.unsafe(cleanStmt + ';')
      const firstLine = cleanStmt.split('\n').find((l) => l.trim())?.trim()
      console.log(`[apply-migration-h3] ✓ ${firstLine?.slice(0, 80)}...`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('already exists') || msg.includes('skipped')) {
        console.log(`[apply-migration-h3] ⊙ 跳过已存在对象`)
      } else {
        console.error(`[apply-migration-h3] ✗ 错误: ${msg}`)
        console.error(`[apply-migration-h3] SQL: ${cleanStmt.slice(0, 200)}...`)
        throw err
      }
    }
  }

  // 记录到 __drizzle_migrations 表
  try {
    await sql`
      INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
      VALUES (${hash}, ${Date.now()})
      ON CONFLICT DO NOTHING
    `
    console.log('[apply-migration-h3] ✓ 迁移记录已写入 __drizzle_migrations')
  } catch (err) {
    console.log(`[apply-migration-h3] ⊙ 迁移记录写入跳过: ${err instanceof Error ? err.message : String(err)}`)
  }

  console.log('[apply-migration-h3] ✅ 迁移完成')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[apply-migration-h3] ❌ 迁移失败:', err)
    process.exit(1)
  })
  .finally(() => sql.end())
