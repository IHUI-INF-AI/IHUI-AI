// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 2026-09-06 dev 库对齐迁移链:前向 try-apply + 错误分类 + 簿记重建
// 用法: DATABASE_URL=postgresql://... node dev-align-apply.mjs [--dry-run]
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const DRY = process.argv.includes('--dry-run')
const dir = path.resolve('drizzle')
const journal = JSON.parse(fs.readFileSync(path.join(dir, 'meta/_journal.json'), 'utf8'))

const client = postgres(process.env.DATABASE_URL, { max: 1 })
const db = drizzle(client)

// 宽恕类错误(对象已存在等) — 这些视为"该效果已在库中",跳过继续
const BENIGN = new Set([
  '42P07', // duplicate table / index / view / sequence name
  '42701', // duplicate column
  '42P06', // duplicate schema
  '42710', // duplicate object (constraint / type / extension)
  '23505', // unique violation(种子数据重复)
  '42723', // duplicate function
  '42712', // duplicate alias
  'P0001', // 自定义 RAISE(如 admin 保护触发器:对象已存在且被业务规则保护)
])

// 事务控制语句单独成块的,由本脚本接管事务,跳过执行
const TXN_ONLY = /^(BEGIN|START TRANSACTION|COMMIT|END|ROLLBACK|SAVEPOINT \w+|RELEASE \w+|ROLLBACK TO \w+)\s*;?\s*$/i

function chunksOf(file) {
  const raw = fs.readFileSync(path.join(dir, file), 'utf8')
  return raw
    .split('--> statement-breakpoint')
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && !c.split('\n').every((l) => l.trim().startsWith('--') || l.trim() === ''))
}

const results = { alreadyApplied: 0, appliedNow: [], failed: [], skippedDry: 0 }

const existing = await client`SELECT hash FROM drizzle.__drizzle_migrations`
const appliedHashes = new Set(existing.map((r) => r.hash))
console.log('现存簿记行数:', appliedHashes.size)

for (const entry of journal.entries) {
  const file = entry.tag + '.sql'
  if (!fs.existsSync(path.join(dir, file))) {
    results.failed.push({ tag: entry.tag, error: 'FILE MISSING' })
    continue
  }
  const raw = fs.readFileSync(path.join(dir, file), 'utf8')
  const hash = createHash('sha256').update(raw).digest('hex')
  if (appliedHashes.has(hash)) {
    results.alreadyApplied++
    continue
  }
  if (DRY) {
    results.skippedDry++
    continue
  }
  let failed = false
  const chunks = chunksOf(file)
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    if (TXN_ONLY.test(chunk)) continue // 事务控制由本脚本接管
    try {
      await db.execute(chunk)
    } catch (e) {
      const cause = e && e.cause ? e.cause : e
      const code = cause && cause.code
      if (code && BENIGN.has(code)) {
        console.log(`  [skip] ${entry.tag}#${i} ${code}: ${String(cause.message).slice(0, 90)}`)
        continue
      }
      console.error(`  [FAIL] ${entry.tag}#${i} ${code || ''}: ${String(cause.message).slice(0, 160)}`)
      console.error(`         stmt: ${chunk.slice(0, 120).replace(/\s+/g, ' ')}`)
      results.failed.push({ tag: entry.tag, chunk: i, code, error: String(cause.message).slice(0, 200) })
      failed = true
      // 清理可能被打开/毒化的事务,防止级联 25P02
      try {
        await client`ROLLBACK`
      } catch {
        /* 无事务时 ROLLBACK 只是 WARNING */
      }
      break
    }
  }
  if (!failed) results.appliedNow.push(entry.tag)
}

if (!DRY) {
  // 重建簿记:成功的条目(已有 hash 或本轮成功)按重整后的 when 写回
  try {
    await client`ROLLBACK` // 清理可能残留的中止事务
  } catch {
    /* ignore */
  }
  await client`DELETE FROM drizzle.__drizzle_migrations`
  const failedTags = new Set(results.failed.map((f) => f.tag))
  let rebuilt = 0
  for (const entry of journal.entries) {
    if (failedTags.has(entry.tag)) continue
    const file = entry.tag + '.sql'
    if (!fs.existsSync(path.join(dir, file))) continue
    const raw = fs.readFileSync(path.join(dir, file), 'utf8')
    const hash = createHash('sha256').update(raw).digest('hex')
    await client`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${entry.when})`
    rebuilt++
  }
  console.log('簿记重建行数:', rebuilt, '(失败条目未登记,后续 migrate 会重试)')
}

console.log('=== 汇总 ===')
console.log('已应用(哈希命中):', results.alreadyApplied)
console.log('本轮新应用:', results.appliedNow.length)
console.log('dry-run 跳过:', results.skippedDry)
console.log('失败:', results.failed.length)
for (const f of results.failed) console.log('  FAIL:', f.tag, f.error)
await client.end()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
