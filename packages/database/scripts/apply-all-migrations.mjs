/**
 * 同步 dev + test 数据库 — 应用所有 0000-0071 迁移。
 * 用于补全 ihui_test 数据库缺失的表。
 */
import postgres from 'postgres'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const targets = [
  { url: 'postgresql://postgres:postgres@localhost:5432/ihui', name: 'dev ihui' },
  { url: 'postgresql://postgres:postgres@localhost:5432/ihui_test', name: 'test ihui_test' },
]

const drizzleDir = 'g:/IHUI-AI/packages/database/drizzle'
const files = readdirSync(drizzleDir)
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort()
console.log(`Found ${files.length} migration files`)

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
      if (ch === "'" && next2 !== "''") inSingleQuote = false
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

for (const { url, name } of targets) {
  const sql = postgres(url, { max: 1 })
  console.log(`\n=== ${name} (${url}) ===`)
  for (const file of files) {
    const path = resolve(drizzleDir, file)
    if (!existsSync(path)) continue
    const text = readFileSync(path, 'utf-8')
    const stmts = splitSqlStatements(text)
    try {
      for (const s of stmts) {
        try {
          await sql.unsafe(s)
        } catch (e) {
          const msg = e?.message ?? String(e)
          if (msg.includes('already exists') || (msg.includes('does not exist') && s.includes('DROP'))) {
            // 幂等:跳过
          } else {
            throw e
          }
        }
      }
      console.log(`  ✓ ${file}`)
    } catch (e) {
      console.error(`  ✗ ${file}: ${e?.message ?? e}`)
    }
  }
  await sql.end({ timeout: 5 })
}
console.log('\n=== done ===')
