// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 同步 dev + test 数据库 — 应用 drizzle 目录下全部迁移。
 * 用于补全 ihui_test 数据库缺失的表。
 */
import postgres from 'postgres'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const targets = [
  { url: 'postgresql://postgres:postgres@localhost:5432/ihui', name: 'dev ihui' },
  { url: 'postgresql://postgres:postgres@localhost:5432/ihui_test', name: 'test ihui_test' },
]

const drizzleDir = fileURLToPath(new URL('../drizzle', import.meta.url))
const files = readdirSync(drizzleDir)
  .filter((f) => /^\d+_.*\.sql$/.test(f))
  .sort()
console.log(`Found ${files.length} migration files`)

// BUG-15③ / BUG-16「journal 双轨」判据：drizzle migrate() 按 journal.when 判定执行，
// 本执行器按文件名排序；若 journal 的 idx 不连续、when 非严格递增、或 tag 无对应
// SQL 文件，两种执行器会产出不同库态且可能「静默跳过」。启动时 fail-fast 校验。
const journalPath = resolve(drizzleDir, 'meta/_journal.json')
if (existsSync(journalPath)) {
  const journal = JSON.parse(readFileSync(journalPath, 'utf-8'))
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

// BUG-16 根因修复：原分割器只认匿名 $$，把 $fn$ / $ot_conv$ / $con$ 等命名
// dollar-quote 块内的 `;` 当作语句分隔符，导致整段 PL/pgSQL 被切碎(末条只剩 END $fn$)。
// 现按 PG 语法识别任意合法标签 $tag$ ... $tag$（含 $$），块内字符一律原样保留；
// 同时返回「顶层分号数 / 引号-dollar 是否闭合」供调用方做切分自检。
function splitSqlStatements(input) {
  const result = []
  const n = input.length
  const DOLLAR_TAG = /\$([A-Za-z_][A-Za-z0-9_]*)?\$/y
  const readTag = (pos) => {
    DOLLAR_TAG.lastIndex = pos
    const m = DOLLAR_TAG.exec(input)
    return m ? m[0] : null
  }
  let buffer = ''
  let dollarTag = null
  let inSingleQuote = false
  let semicolonCount = 0
  let i = 0
  while (i < n) {
    const ch = input[i]

    if (inSingleQuote) {
      buffer += ch
      if (ch === "'") {
        if (input[i + 1] === "'") { buffer += input[i + 1]; i += 2; continue }
        inSingleQuote = false
      }
      i++
      continue
    }

    if (dollarTag !== null) {
      if (ch === '$' && readTag(i) === dollarTag) {
        buffer += dollarTag
        i += dollarTag.length
        dollarTag = null
        continue
      }
      buffer += ch
      i++
      continue
    }

    if (ch === '$') {
      const tag = readTag(i)
      if (tag !== null) {
        dollarTag = tag
        buffer += tag
        i += tag.length
        continue
      }
    }
    if (ch === "'") {
      inSingleQuote = true
      buffer += ch
      i++
      continue
    }
    if (ch === '-' && input[i + 1] === '-') {
      const eol = input.indexOf('\n', i)
      if (eol === -1) { buffer += input.slice(i); break }
      buffer += input.slice(i, eol)
      i = eol
      continue
    }
    if (ch === ';') {
      semicolonCount++
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
  return {
    statements: result,
    semicolonCount,
    balanced: dollarTag === null && !inSingleQuote,
  }
}

let hadFailures = false
for (const { url, name } of targets) {
  const sql = postgres(url, { max: 1 })
  console.log(`\n=== ${name} (${url}) ===`)
  for (const file of files) {
    const path = resolve(drizzleDir, file)
    if (!existsSync(path)) continue
    const text = readFileSync(path, 'utf-8')
    const { statements: stmts, semicolonCount, balanced } = splitSqlStatements(text)
    // BUG-16 收口自检：切出的语句条数须与文件内顶层 `;` 数一致，且无未闭合的
    // dollar-quote / 单引号；不一致说明被切碎，绝不带着半套语句往下执行。
    if (!balanced || (semicolonCount !== stmts.length && semicolonCount !== stmts.length - 1)) {
      console.error(`  ✗ ${file}: SQL 切分自检失败 (balanced=${balanced}, topLevelSemicolons=${semicolonCount}, statements=${stmts.length})`)
      hadFailures = true
      continue
    }
    try {
      for (const s of stmts) {
        try {
          await sql.unsafe(s)
        } catch (e) {
          const msg = e?.message ?? String(e)
          if (
            msg.includes('already exists') ||
            (msg.includes('does not exist') && s.includes('DROP'))
          ) {
            // 幂等:跳过
          } else {
            throw e
          }
        }
      }
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
