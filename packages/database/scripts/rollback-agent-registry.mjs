// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 回滚脚本为 CLI 工具,需 console 输出执行计划与结果 */
/**
 * 统一智能体注册表 · 显式回滚脚本(总管智能体 P1-05)。
 *
 * 仓库不在 drizzle 目录存 down SQL(与历史迁移一致),回滚用脚本显式删表:
 *   agent_management_approvals → agent_run_events → agent_runs
 *   → agent_definition_versions → agent_definitions
 * 顺序不可颠倒:events 依赖 runs,versions 依赖 definitions;approvals 虽无 FK,
 * 但先删可保证"审批证据先于定义消失",与归档顺序(先归档审批、再归档定义)一致。
 *
 * 用法:
 *   node packages/database/scripts/rollback-agent-registry.mjs            # 默认 dry-run,只打印计划
 *   node packages/database/scripts/rollback-agent-registry.mjs --apply    # 真正删表
 *   node packages/database/scripts/rollback-agent-registry.mjs --apply --keep-ledger
 *        # 保留 drizzle.__drizzle_migrations 账本行(默认按迁移文件 sha256 反查并删除,
 *        # 以便同一库上重新 up)
 *
 * 安全:
 *   - DATABASE_URL 缺失直接拒绝,不回退任何内置连接串;
 *   - 库名含 prod/production 一律拒绝(误连生产的最后一道防线);
 *   - 删表前逐张打印"存在/不存在",不存在不报错(幂等);
 *   - 只删这 5 张表,不碰 shared / API / ai-service 任何对象。
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const MIGRATION_FILE = fileURLToPath(
  new URL('../drizzle/20261127120000_agent_registry.sql', import.meta.url),
)

/** 删除顺序 = 依赖反序;表名与迁移 DDL 完全一致 */
const TABLES_IN_DROP_ORDER = [
  'agent_management_approvals',
  'agent_run_events',
  'agent_runs',
  'agent_definition_versions',
  'agent_definitions',
]

function parseArgs(argv) {
  const flags = new Set(argv.slice(2))
  return {
    apply: flags.has('--apply'),
    keepLedger: flags.has('--keep-ledger'),
    help: flags.has('--help') || flags.has('-h'),
  }
}

function usage() {
  console.log('用法: node packages/database/scripts/rollback-agent-registry.mjs [--apply] [--keep-ledger]')
}

async function main() {
  const { apply, keepLedger, help } = parseArgs(process.argv)
  if (help) {
    usage()
    return
  }

  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    console.error('[rollback-agent-registry] 拒绝执行:DATABASE_URL 未设置(不回退任何内置连接串)')
    process.exitCode = 1
    return
  }

  const url = new URL(databaseUrl)
  const databaseName = url.pathname.replace(/^\//, '') || '(unknown)'
  if (/prod|production/i.test(databaseName)) {
    console.error(`[rollback-agent-registry] 拒绝执行:目标库 "${databaseName}" 含 prod/production`)
    process.exitCode = 1
    return
  }

  console.log(
    `[rollback-agent-registry] 目标 ${url.hostname}:${url.port || 5432}/${databaseName}` +
      ` · 模式=${apply ? 'APPLY(真删)' : 'DRY-RUN(仅打印)'}`,
  )

  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} })
  try {
    const existing = await sql`
      SELECT c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = current_schema() AND c.relkind = 'r'
    `
    const present = new Set(existing.map((r) => r.table_name))
    for (const table of TABLES_IN_DROP_ORDER) {
      console.log(`[rollback-agent-registry] ${present.has(table) ? '存在' : '不存在'} ${table}`)
    }

    if (!apply) {
      console.log('[rollback-agent-registry] dry-run 结束:未做任何变更(加 --apply 执行)')
      return
    }

    for (const table of TABLES_IN_DROP_ORDER) {
      await sql.unsafe(`DROP TABLE IF EXISTS "${table}"`)
      console.log(`[rollback-agent-registry] ✓ DROP TABLE ${table}`)
    }

    if (!keepLedger) {
      if (!existsSync(MIGRATION_FILE)) {
        console.warn(`[rollback-agent-registry] 迁移文件不存在,跳过账本清理: ${MIGRATION_FILE}`)
      } else {
        const hash = createHash('sha256').update(readFileSync(MIGRATION_FILE, 'utf-8')).digest('hex')
        const ledger = await sql`
          SELECT 1
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'drizzle' AND c.relname = '__drizzle_migrations' AND c.relkind = 'r'
        `
        if (ledger.length === 0) {
          console.warn('[rollback-agent-registry] drizzle.__drizzle_migrations 不存在,跳过账本清理')
        } else {
          const deleted = await sql`
            DELETE FROM drizzle."__drizzle_migrations" WHERE hash = ${hash} RETURNING created_at
          `
          console.log(
            `[rollback-agent-registry] 账本清理: 删除 ${deleted.length} 行(sha256=${hash.slice(0, 12)}…)`,
          )
        }
      }
    } else {
      console.log('[rollback-agent-registry] 账本保留(--keep-ledger): 重跑迁移需先手工清理账本行')
    }

    console.log('[rollback-agent-registry] ✅ 回滚完成')
  } catch (err) {
    console.error('[rollback-agent-registry] ❌ 回滚失败:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  } finally {
    await sql.end()
  }
}

main()
