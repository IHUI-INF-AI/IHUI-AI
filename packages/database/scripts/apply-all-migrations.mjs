// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * dev/test 库一次性同步 —— 重放 drizzle 目录下全部迁移。
 *
 * DB-07 安全默认：
 *   · **不写 drizzle 账本**（启动即打印横幅），仅限 dev/test；生产请走 drizzle-kit migrate；
 *   · 目标 DSN 只来自显式 env（APPLY_ALL_DATABASE_URLS / SYNC_DATABASE_URLS / DATABASE_URL），
 *     非 localhost 必须再加 `--allow-remote`；
 *   · 检测到无 ON CONFLICT / WHERE / NOT EXISTS 保护的 INSERT/UPDATE/DELETE 时默认拒绝，
 *     确认可重复重放才加 `--allow-non-idempotent`；
 *   · 执行顺序读 journal.when（与 drizzle 同口径），不再按文件名 ASCII 序。
 */
import postgres from 'postgres'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { splitSqlStatements } from './lib/split-sql.mjs'
import {
  describeSkippedObject,
  planMigrationExecution,
  shouldSkipStatement,
} from './lib/migration-policy.mjs'
import {
  NON_LEDGER_BANNER,
  detectNonIdempotentDml,
  orderMigrationsByWhen,
  resolveTargets,
} from './lib/apply-all-safety.mjs'

console.log(NON_LEDGER_BANNER)

const argv = process.argv.slice(2)
const allowRemote = argv.includes('--allow-remote')
const allowNonIdempotent = argv.includes('--allow-non-idempotent')

// DB-07：目标 DSN 必须来自显式 env，杜绝硬编码 localhost / 静默连远端。
const resolved = resolveTargets({ env: process.env, allowRemote })
if (!resolved.ok) {
  console.error(`✗ 拒绝启动：${resolved.why}`)
  process.exit(1)
}
const targets = resolved.targets

const drizzleDir = fileURLToPath(new URL('../drizzle', import.meta.url))
const rawFiles = readdirSync(drizzleDir).filter((f) => /^\d+_.*\.sql$/.test(f))
console.log(`Found ${rawFiles.length} migration files`)

// BUG-15③ / BUG-16「journal 双轨」判据：drizzle migrate() 按 journal.when 判定执行，
// 本执行器按文件名排序；若 journal 的 idx 不连续、when 非严格递增、或 tag 无对应
// SQL 文件，两种执行器会产出不同库态且可能「静默跳过」。启动时 fail-fast 校验。
const journalPath = resolve(drizzleDir, 'meta/_journal.json')
let journal = null
if (existsSync(journalPath)) {
  journal = JSON.parse(readFileSync(journalPath, 'utf-8'))
  const entries = journal.entries ?? []
  let journalOk = true
  for (let k = 1; k < entries.length; k++) {
    if (entries[k].idx !== entries[k - 1].idx + 1) {
      console.error(`journal idx 非单调 @${k}: ${entries[k - 1].idx} -> ${entries[k].idx}`)
      journalOk = false
    }
    if (entries[k].when <= entries[k - 1].when) {
      console.error(`journal when 非严格递增 @${k} (${entries[k].tag}): ${entries[k - 1].when} -> ${entries[k].when}`)
      journalOk = false
    }
  }
  for (const e of entries) {
    if (!existsSync(resolve(drizzleDir, `${e.tag}.sql`))) {
      console.error(`journal tag 无对应 SQL 文件: ${e.tag}.sql`)
      journalOk = false
    }
  }
  if (!journalOk) {
    console.error('journal 一致性自检失败：拒绝执行，以免迁移被静默跳过')
    process.exit(1)
  }
  console.log(`journal 自检通过: ${entries.length} entries, idx/when 单调, tag↔SQL 一一对应`)
} else {
  console.error('journal 缺失: ' + journalPath)
  process.exit(1)
}

// DB-07③：执行顺序按 journal.when（与 drizzle migrate 同口径），不再按文件名 ASCII 序。
const { ordered: files, unknown } = orderMigrationsByWhen(rawFiles, journal)
if (unknown.length)
  console.warn(`⚠️ 以下文件不在 journal.when 中，排在末尾执行：${unknown.join(', ')}`)

// DB-07②：建立任何连接之前，先扫描非幂等 DML；默认拒绝，必须显式 --allow-non-idempotent。
const nonIdempotent = []
for (const file of files) {
  const { statements } = splitSqlStatements(readFileSync(resolve(drizzleDir, file), 'utf-8'))
  for (const d of detectNonIdempotentDml(statements)) nonIdempotent.push({ file, ...d })
}
if (nonIdempotent.length) {
  if (!allowNonIdempotent) {
    console.error(`✗ 检测到 ${nonIdempotent.length} 条无幂等保护的 DML（重跑会重复写数据）：`)
    for (const d of nonIdempotent.slice(0, 30))
      console.error(`   - ${d.file} #${d.index} [${d.kind}] ${d.head}`)
    console.error('  默认拒绝执行；确认可重复重放请显式加 --allow-non-idempotent。')
    process.exit(1)
  }
  console.warn(`⚠️ --allow-non-idempotent：放行 ${nonIdempotent.length} 条非幂等 DML`)
}

// DB-04 / DB-06：分割器已抽到 scripts/lib/split-sql.mjs，两个执行器共用；
// 它识别命名 dollar-quote、单/双引号、行注释与块注释，并返回顶层分号数供严格自检。

let hadFailures = false
for (const { url, name, display } of targets) {
  const sql = postgres(url, { max: 1 })
  console.log(`\n=== ${name} (${display}) ===`)
  for (const file of files) {
    const path = resolve(drizzleDir, file)
    if (!existsSync(path)) continue
    const text = readFileSync(path, 'utf-8')
    const { statements: stmts, semicolonCount, balanced } = splitSqlStatements(text)
    // DB-06：严格自检——顶层分号数必须与语句数完全相等，任何“容忍 +1”都意味着被切碎。
    if (!balanced || semicolonCount !== stmts.length) {
      console.error(`  ✗ ${file}: SQL 切分自检失败 (balanced=${balanced}, topLevelSemicolons=${semicolonCount}, statements=${stmts.length})`)
      hadFailures = true
      continue
    }
    try {
      // DB-05：含 CONCURRENTLY 的迁移拒绝走本执行器（不能在事务块内执行）。
      planMigrationExecution(stmts, file)
      // DB-05：每个迁移文件包一个事务；任一语句失败由 sql.begin 回滚，绝不逐语句自动提交。
      await sql.begin(async (tx) => {
        for (const s of stmts) {
          try {
            await tx.savepoint(async (sp) => {
              await sp.unsafe(s)
            })
          } catch (e) {
            // 只按 SQLSTATE 白名单 + 语句形态跳过幂等重放错误，并打印对象名。
            if (shouldSkipStatement(e, s)) {
              console.log(`    ⊙ ${file}: 跳过(${e.code} ${describeSkippedObject(e, s)})`)
            } else {
              throw e
            }
          }
        }
      })
      console.log(`  ✓ ${file}`)
    } catch (e) {
      console.error(`  ✗ ${file}: ${e?.message ?? e}`)
      hadFailures = true
    }
  }
  await sql.end({ timeout: 5 })
}
// BUG-16 根因修复：任何文件失败/自检失败都必须让 CI 变红，绝不恒 0 退出。
if (hadFailures) {
  console.error('\n=== done with failures ===')
  process.exitCode = 1
} else {
  console.log('\n=== done ===')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
