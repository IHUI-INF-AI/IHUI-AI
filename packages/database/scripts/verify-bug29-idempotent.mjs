// BUG-29 三包幂等验证：锁定拆分产物计数与守卫形态，防回退。
// 运行：node packages/database/scripts/verify-bug29-idempotent.mjs
// 用途：拆分脚本产出后跑一次；CI 可作为守门。断言失败即整体非零退出。
import fs from 'node:fs'

const DIR = 'packages/database/drizzle-pending-review'
const PKG1 = `${DIR}/20261119120000_bug29_pkg1_indexes_concurrently.sql`
const PKG2 = `${DIR}/20261119120001_bug29_pkg2_unique_indexes.sql`
const PKG3 = `${DIR}/20261119120002_bug29_pkg3_foreign_keys.sql`

const pkg1 = fs.readFileSync(PKG1, 'utf8')
const pkg2 = fs.readFileSync(PKG2, 'utf8')
const pkg3 = fs.readFileSync(PKG3, 'utf8')

const count = (s, re) => (s.match(re) || []).length
const errs = []

// ---- 包1：索引包（CONCURRENTLY） ----
// 所有 CREATE INDEX 必须 CONCURRENTLY IF NOT EXISTS
const pkg1Conc = count(pkg1, /CREATE INDEX CONCURRENTLY IF NOT EXISTS/g)
const pkg1Plain = count(pkg1, /CREATE INDEX IF NOT EXISTS/g)
const pkg1NonConc = count(pkg1, /CREATE INDEX (?!CONCURRENTLY)/g)
if (pkg1Conc !== 161) errs.push(`包1: CONCURRENTLY 期望 161，实际 ${pkg1Conc}`)
if (pkg1Plain !== 0) errs.push(`包1: 不应有无 CONCURRENTLY 的普通 CREATE INDEX，实际 ${pkg1Plain}`)
if (pkg1NonConc !== 0) errs.push(`包1: 存在无 CONCURRENTLY 的 CREATE INDEX，计数 ${pkg1NonConc}`)
if (/^BEGIN;/m.test(pkg1)) errs.push('包1: 不应含显式 BEGIN —— CONCURRENTLY 不能在事务块内跑')
if (/COMMIT;/m.test(pkg1)) errs.push('包1: 不应含 COMMIT —— 同上')
// 幂等：IF NOT EXISTS 必须 ≥ 1
if (pkg1Conc === 0) errs.push('包1: 无任何 CREATE INDEX CONCURRENTLY IF NOT EXISTS')

// ---- 包2：唯一索引包（DO+EXCEPTION） ----
const pkg2Do = count(pkg2, /^DO \$\$/gm)
const pkg2End = count(pkg2, /\bEND \$\$/g)
const pkg2Exc = count(pkg2, /EXCEPTION WHEN unique_violation/g)
if (pkg2Do !== 3) errs.push(`包2: DO 块期望 3，实际 ${pkg2Do}`)
if (pkg2End !== 3) errs.push(`包2: END $$ 期望 3，实际 ${pkg2End}`)
if (pkg2Exc !== 3) errs.push(`包2: EXCEPTION unique_violation 守卫期望 3，实际 ${pkg2Exc}`)

// ---- 包3：FK 包（DO+EXCEPTION） ----
const pkg3Do = count(pkg3, /^DO \$\$/gm)
const pkg3End = count(pkg3, /\bEND \$\$/g)
const pkg3Exc = count(pkg3, /EXCEPTION WHEN others/g)
// 每个 FK 块应有 IF NOT EXISTS 守卫
const pkg3IfNotExists = count(pkg3, /IF NOT EXISTS/g)
if (pkg3Do !== 28) errs.push(`包3: DO 块期望 28，实际 ${pkg3Do}`)
if (pkg3End !== 28) errs.push(`包3: END $$ 期望 28，实际 ${pkg3End}`)
if (pkg3Exc !== 28) errs.push(`包3: EXCEPTION WHEN others 守卫期望 28，实际 ${pkg3Exc}`)
if (pkg3IfNotExists < 28) errs.push(`包3: IF NOT EXISTS 守卫数应 ≥ 28，实际 ${pkg3IfNotExists}`)

// ---- 三包都不进 journal（不 renumber） ----
const journalPath = 'packages/database/drizzle/meta/_journal.json'
const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'))
const journalTags = journal.entries.map(e => e.tag)
const bug29Pkgs = ['20261119120000_bug29_pkg1_indexes_concurrently',
  '20261119120001_bug29_pkg2_unique_indexes',
  '20261119120002_bug29_pkg3_foreign_keys',
  '20261119120003_bug29_pkg4_drift_indexes',
  '20261119120004_bug29_pkg5_grid2_fk']
for (const tag of bug29Pkgs) {
  if (journalTags.includes(tag)) errs.push(`journal 中不应含 BUG-29 五包的 tag ${tag}`)
}

// ---- 包4：②段漂移补漏包（15 枚普通索引，机主 2026-11-20 定档另开） ----
const PKG4 = `${DIR}/20261119120003_bug29_pkg4_drift_indexes.sql`
const pkg4 = fs.readFileSync(PKG4, 'utf8')
const pkg4Idx = count(pkg4, /^CREATE INDEX IF NOT EXISTS /gm)
const pkg4Conc = count(pkg4, /CREATE INDEX CONCURRENTLY/g)
const pkg4Do = count(pkg4, /^DO \$\$/gm)
if (pkg4Idx !== 15) errs.push(`包4: CREATE INDEX IF NOT EXISTS 期望 15，实际 ${pkg4Idx}`)
if (pkg4Conc !== 0) errs.push(`包4: 不应含 CONCURRENTLY（设计为小表短锁），实际 ${pkg4Conc}`)
if (pkg4Do !== 0) errs.push(`包4: 不应含 DO 块（纯索引），实际 ${pkg4Do}`)
// 包4 须与漂移清单 15 项逐一对应（按 ix_<表>_<列>）
const driftPath = `${DIR}/BUG29-sec2-drift-20261120.json`
if (fs.existsSync(driftPath)) {
  const drift = JSON.parse(fs.readFileSync(driftPath, 'utf8'))
  const expect = new Set(drift.gaps.map(g => `ix_${g.table}_${g.col}`))
  const actual = new Set((pkg4.match(/^CREATE INDEX IF NOT EXISTS "([^"]+)"/gm) || [])
    .map(l => l.match(/"([^"]+)"/)[1]))
  for (const e of expect) if (!actual.has(e)) errs.push(`包4: 缺漂移清单项 ${e}`)
  for (const a of actual) if (!expect.has(a)) errs.push(`包4: 多出非清单项 ${a}`)
}

// ---- 包5：格2 唯一真缺 FK 包（1 个 FK，机主定档另开） ----
const PKG5 = `${DIR}/20261119120004_bug29_pkg5_grid2_fk.sql`
const pkg5 = fs.readFileSync(PKG5, 'utf8')
const pkg5Do = count(pkg5, /^DO \$\$/gm)
const pkg5End = count(pkg5, /\bEND \$\$/g)
const pkg5Exc = count(pkg5, /EXCEPTION WHEN others/g)
const pkg5Fk = count(pkg5, /ADD CONSTRAINT "fk_hr_employee_link_request_user_id_users"/g)
const pkg5Cascade = count(pkg5, /ON DELETE CASCADE/g)
if (pkg5Do !== 1) errs.push(`包5: DO 块期望 1，实际 ${pkg5Do}`)
if (pkg5End !== 1) errs.push(`包5: END $$ 期望 1，实际 ${pkg5End}`)
if (pkg5Exc !== 1) errs.push(`包5: EXCEPTION WHEN others 守卫期望 1，实际 ${pkg5Exc}`)
if (pkg5Fk !== 1) errs.push(`包5: hr_employee_link_request FK 期望 1，实际 ${pkg5Fk}`)
if (pkg5Cascade !== 1) errs.push(`包5: 应按 schema 用 ON DELETE CASCADE，实际 ${pkg5Cascade}`)

// ---- 输出 ----
if (errs.length > 0) {
  console.error('✗ BUG-29 幂等验证失败：')
  for (const e of errs) console.error('  -', e)
  process.exit(1)
} else {
  console.log('✓ BUG-29 五包幂等验证通过')
  console.log(`  包1: ${pkg1Conc} 个 CONCURRENTLY 索引，无显式事务`)
  console.log(`  包2: ${pkg2Do} 个唯一索引 DO+EXCEPTION 守卫`)
  console.log(`  包3: ${pkg3Do} 个 FK DO+EXCEPTION 守卫，${pkg3IfNotExists} 个 IF NOT EXISTS`)
  console.log(`  包4: ${pkg4Idx} 个②段漂移补漏索引，纯 IF NOT EXISTS（机主定档）`)
  console.log(`  包5: ${pkg5Do} 个格2 补漏 FK（hr_employee_link_request，cascade）`)
  console.log(`  journal: 未 renumber（BUG-29 五包 tag 不在 _journal.json）`)
}
