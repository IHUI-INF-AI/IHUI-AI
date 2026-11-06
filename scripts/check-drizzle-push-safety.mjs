#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-drizzle-push-safety.mjs —— T7:「drizzle-kit push 不得对未建模表发 DROP TABLE」的 CI 断言。
 *
 * 立因(2026-11-07 实测):库里有 152 张 schema 未建模的表(packages/database/drizzle/retained-tables.json),
 * 缺 tablesFilter 时 `drizzle-kit push` 会把这些表全部列进 DROP TABLE 计划 —— 一次手滑就是整域数据蒸发。
 *
 * 判据分两层:
 *   · 静态(默认,不需要库):drizzle.config.ts 的 tablesFilter **恰好等于** retained-tables.json 的表集;
 *     已建模表不得出现在过滤清单里(否则 push 会静默忽略该表的漂移);保留清单分桶/计数自洽。
 *   · 联库(`--db <dsn>`,只读):public 下每张表必须 ∈ 已建模 ∪ 保留清单;差集就是 push 计划里的
 *     DROP TABLE 名单,非空即红。**只做 SELECT,不发任何 DDL**。
 *
 * 用法:
 *   node scripts/check-drizzle-push-safety.mjs                       # 默认判 HEAD 面
 *   node scripts/check-drizzle-push-safety.mjs --staged              # pre-commit 判索引面
 *   node scripts/check-drizzle-push-safety.mjs --worktree            # 人工逃生舱,读盘
 *   node scripts/check-drizzle-push-safety.mjs --db "postgresql://..."   # 只读联库核对
 *   node scripts/check-drizzle-push-safety.mjs --self-test
 *
 * 退出码:0 = 绿;1 = 有 DROP 风险/配置漂移;2 = 未判定(文件缺失/psql 不可用/连不上库)。
 */
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

import { requireFlagValue } from './lib/flag-value.mjs'
import { locatePsqlClient } from './lib/psql-client-locate.mjs'
import { catBatch, listFaceFiles, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..')
const CONFIG_REL = 'packages/database/drizzle.config.ts'
const RETAINED_REL = 'packages/database/drizzle/retained-tables.json'
const SCHEMA_DIR_REL = 'packages/database/src/schema'

/** 从 drizzle.config.ts 抽出 tablesFilter 的 `'!name'` 项(纯函数,供自检)。 */
export function parseTablesFilter(configText) {
  const block = String(configText).match(/tablesFilter\s*:\s*\[([\s\S]*?)\]/)
  if (!block) return { ok: false, why: 'drizzle.config.ts 里没有 tablesFilter 数组' }
  const names = [...block[1].matchAll(/['"]!([^'"]+)['"]/g)].map((m) => m[1].trim())
  return { ok: true, names }
}

/** 扫描 schema 正文里的 pgTable('<name>') —— 声明面(不是库面);输入已是判定面取出的正文。 */
export function parseModeledTables(texts) {
  const out = new Set()
  for (const t of texts ?? []) {
    for (const m of String(t).matchAll(/pgTable\(\s*['"]([^'"]+)['"]/g)) out.add(m[1])
  }
  return out
}

/**
 * 纯判据:config 过滤清单 ↔ 保留清单 ↔ 已建模表 三方对账。
 * 返回 { ok, issues, counts }。
 */
export function checkPushSafety({ filterNames, retained, modeled }) {
  const issues = []
  const filters = filterNames ?? []
  const tables = Array.isArray(retained?.tables) ? retained.tables : []
  const filterSet = new Set(filters)
  const retainedSet = new Set(tables.map((t) => String(t?.name ?? '').trim()))

  if (!tables.length) issues.push('保留清单为空(retained-tables.json 的 tables 数组缺失/为空)')
  if (filters.length !== filterSet.size) issues.push(`tablesFilter 有重复项(${filters.length} 项/${filterSet.size} 唯一)`)
  if (retainedSet.size !== tables.length) issues.push(`保留清单有重复表名(${tables.length} 项/${retainedSet.size} 唯一)`)

  const retainedNotFiltered = [...retainedSet].filter((t) => !filterSet.has(t)).sort()
  const filteredNotRetained = [...filterSet].filter((t) => !retainedSet.has(t)).sort()
  if (retainedNotFiltered.length)
    issues.push(`保留清单里有 ${retainedNotFiltered.length} 张表未进 tablesFilter(push 会对它们发 DROP):${retainedNotFiltered.slice(0, 8).join(', ')}`)
  if (filteredNotRetained.length)
    issues.push(`tablesFilter 多出 ${filteredNotRetained.length} 张保留清单里没有的表(过滤面失真):${filteredNotRetained.slice(0, 8).join(', ')}`)

  const modeledSet = new Set(modeled ?? [])
  const modeledButFiltered = [...modeledSet].filter((t) => filterSet.has(t)).sort()
  if (modeledButFiltered.length)
    issues.push(`已建模表被过滤(${modeledButFiltered.length}):${modeledButFiltered.slice(0, 8).join(', ')} —— push 会静默忽略这些表的漂移`)

  // 分桶自洽:counts 三个键必须与 tables 实际分桶一致
  const actualBuckets = {}
  for (const t of tables) {
    const b = String(t?.bucket ?? '')
    if (!b) issues.push(`保留清单表 ${t?.name ?? '<无名>'} 缺 bucket`)
    actualBuckets[b] = (actualBuckets[b] ?? 0) + 1
  }
  for (const [b, n] of Object.entries(retained?.counts ?? {})) {
    if ((actualBuckets[b] ?? 0) !== n) issues.push(`保留清单分桶计数不符:${b} 声明 ${n},实有 ${actualBuckets[b] ?? 0}`)
  }
  for (const b of Object.keys(actualBuckets)) {
    if (!(b in (retained?.counts ?? {}))) issues.push(`保留清单分桶 ${b} 未在 counts 里登记`)
  }

  return {
    ok: issues.length === 0,
    issues,
    counts: {
      retained: retainedSet.size,
      filtered: filterSet.size,
      modeled: modeledSet.size,
      buckets: actualBuckets,
      union: modeledSet.size + retainedSet.size,
    },
  }
}

function main() {
  const argv = process.argv.slice(2)
  const has = (f) => argv.includes(f)
  if (has('--self-test')) return selfTest()
  const dbOpt = requireFlagValue(argv, '--db', { noun: 'DSN' })
  if (dbOpt.error) {
    console.error(`❌ 用法错:${dbOpt.error}`)
    return 2
  }
  const dbDsn = dbOpt.value

  // 取材面纪律(§12e):head 判提交面、staged 判索引、worktree 才读盘 —— 一律经 face-reader。
  const faceSel = selectFace({ staged: has('--staged'), worktree: has('--worktree') })
  if (faceSel.error) {
    console.error(`❌ 用法错:${faceSel.error}`)
    return 2
  }
  const face = faceSel.face
  let schemaFiles
  let faceTexts
  try {
    schemaFiles = listFaceFiles(ROOT, face, { paths: [SCHEMA_DIR_REL] })
    const rels = [CONFIG_REL, RETAINED_REL, ...schemaFiles]
    if (face === 'worktree') {
      faceTexts = new Map(rels.map((r) => [r, readWorktreeFile(ROOT, r)]))
    } else {
      const specOf = (r) => (face === 'staged' ? `:${r}` : `HEAD:${r}`)
      const got = catBatch(ROOT, rels.map(specOf))
      faceTexts = new Map(rels.map((r) => [r, got.get(specOf(r)) ?? null]))
    }
  } catch (e) {
    console.log(`⚠️ 未判定 —— 判定面(${face})取材失败:${e?.message ?? e}`)
    return 2
  }
  const configText = faceTexts.get(CONFIG_REL)
  const retainedText = faceTexts.get(RETAINED_REL)
  if (configText === null || configText === undefined || retainedText === null || retainedText === undefined) {
    console.log(`⚠️ 未判定 —— 判定面(${face})里取不到 ${CONFIG_REL} 或 ${RETAINED_REL}`)
    return 2
  }
  let retained
  try {
    retained = JSON.parse(retainedText)
  } catch (e) {
    console.log(`⚠️ 未判定 —— ${RETAINED_REL} 不是合法 JSON(${e?.message ?? e})`)
    return 2
  }
  const parsed = parseTablesFilter(configText)
  if (!parsed.ok) {
    console.error(`❌ ${parsed.why}`)
    return 1
  }
  const modeled = parseModeledTables(
    schemaFiles.map((f) => faceTexts.get(f)).filter((t) => t !== null && t !== undefined),
  )
  const r = checkPushSafety({ filterNames: parsed.names, retained, modeled })
  const b = r.counts.buckets
  console.log(
    `[push-safety] 保留清单 ${r.counts.retained} 张(旧域归档 ${b['legacy-archive'] ?? 0} / 仍在用 ${b['in-use'] ?? 0} / ` +
      `月分表 ${b['monthly-partition'] ?? 0})· 已建模 ${r.counts.modeled} 张 · tablesFilter ${r.counts.filtered} 项`,
  )
  if (!r.ok) {
    for (const x of r.issues) console.error(`  ❌ ${x}`)
    console.log('PUSH-SAFETY-RESULT state=red')
    return 1
  }
  console.log('  ✓ 过滤清单与保留清单一致;已建模表无被过滤;分桶计数自洽 ⇒ push 计划不含 DROP TABLE(静态面)')

  if (!dbDsn) {
    console.log('PUSH-SAFETY-RESULT state=ok db=未联库(静态面已判;联库核对用 --db)')
    return 0
  }

  // ── 联库只读核对:public 表 − 已建模 − 保留清单 = push 计划里的 DROP 名单 ──
  const loc = locatePsqlClient()
  if (!loc.psql) {
    console.log(`⚠️ 未判定 —— ${loc.tried.join(' | ')}`)
    console.log('PUSH-SAFETY-RESULT state=undetermined')
    return 2
  }
  let u
  try {
    u = new URL(dbDsn)
  } catch {
    console.log('⚠️ 未判定 —— --db 不是合法 URL')
    return 2
  }
  const p = spawnSync(
    loc.psql,
    ['-h', u.hostname, '-p', u.port || '5432', '-U', decodeURIComponent(u.username), '-d', u.pathname.slice(1), '-At', '-c',
      "select tablename from pg_tables where schemaname='public' order by 1;"],
    {
      encoding: 'utf8',
      timeout: 60_000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PGPASSWORD: decodeURIComponent(u.password) },
      maxBuffer: 16 * 1024 * 1024,
    },
  )
  if (p.error || p.status !== 0) {
    console.log(`⚠️ 未判定 —— 只读查询失败(${String(p.error?.code ?? `exit=${p.status}`)})`)
    console.log('PUSH-SAFETY-RESULT state=undetermined')
    return 2
  }
  const dbTables = String(p.stdout || '').split('\n').map((s) => s.trim()).filter(Boolean)
  const dropCandidates = dbTables.filter((t) => !modeled.has(t) && !retained.tables.some((x) => x.name === t)).sort()
  const missingRetained = [...new Set(retained.tables.map((x) => x.name))].filter((t) => !dbTables.includes(t)).sort()
  console.log(`  联库只读:public 表 ${dbTables.length} 张;保留清单中库内暂缺 ${missingRetained.length} 张(新库属正常,仅提示)`)
  if (dropCandidates.length) {
    console.error(
      `  ❌ push 计划将 DROP ${dropCandidates.length} 张表(既未建模也未进保留清单):${dropCandidates.slice(0, 20).join(', ')}`,
    )
    console.log('PUSH-SAFETY-RESULT state=red dropCandidates=' + dropCandidates.length)
    return 1
  }
  console.log('  ✓ 库内每张 public 表 ∈ 已建模 ∪ 保留清单 ⇒ push 计划不含 DROP TABLE(联库面)')
  console.log('PUSH-SAFETY-RESULT state=ok db=checked dropCandidates=0')
  return 0
}

function selfTest() {
  const checks = []
  const ok = (name, cond) => checks.push([name, !!cond])
  const cfg = `export default defineConfig({ tablesFilter: ['!a', '!b'], verbose: true })`
  const pf = parseTablesFilter(cfg)
  ok('P1 tablesFilter 解析', pf.ok && pf.names.join(',') === 'a,b')
  ok('P2 无 tablesFilter ⇒ 明确报缺', parseTablesFilter('defineConfig({})').ok === false)

  const retained = {
    counts: { 'legacy-archive': 2 },
    tables: [
      { name: 'a', bucket: 'legacy-archive' },
      { name: 'b', bucket: 'legacy-archive' },
    ],
  }
  const good = checkPushSafety({ filterNames: ['a', 'b'], retained, modeled: ['users'] })
  ok('P3 三方对账一致 ⇒ 绿', good.ok && good.counts.retained === 2 && good.counts.modeled === 1)
  const missing = checkPushSafety({ filterNames: ['a'], retained, modeled: ['users'] })
  ok('P4 保留表未过滤 ⇒ 红(push 会 DROP)', missing.ok === false && /b/.test(missing.issues.join('|')))
  const extra = checkPushSafety({ filterNames: ['a', 'b', 'c'], retained, modeled: ['users'] })
  ok('P5 过滤多出未登记表 ⇒ 红', extra.ok === false)
  const collision = checkPushSafety({ filterNames: ['a', 'b', 'users'], retained, modeled: ['users'] })
  ok('P6 已建模表被过滤 ⇒ 红', collision.ok === false && /users/.test(collision.issues.join('|')))
  const badCount = checkPushSafety({ filterNames: ['a', 'b'], retained: { ...retained, counts: { 'legacy-archive': 3 } }, modeled: [] })
  ok('P7 分桶计数不符 ⇒ 红', badCount.ok === false)

  let fails = 0
  for (const [n, pass] of checks) {
    if (!pass) fails++
    console.log(`${pass ? '✅' : '❌'} ${n}`)
  }
  console.log(`\n自检:${checks.length - fails} 通过 / ${fails} 失败`)
  return fails === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}`)
    process.exit(2)
  }
}

export const __test__ = { parseTablesFilter, parseModeledTables, checkPushSafety }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
