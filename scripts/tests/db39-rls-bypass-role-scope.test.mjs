// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// DB-39 夹具:所有 `_bypass_rls` 策略必须限定到应用角色 ihui_app,不得对 PUBLIC 开放。
//
// 判据来源是**上游迁移现读出的表清单**:0214 与 batch1 里建过多少条 `<表>_bypass_rls`,
// 收窄迁移就必须覆盖多少张表 —— 以后谁再补一张 PUBLIC 旁路策略,本夹具立刻翻红。
//
// 运行:`node --test scripts/tests/db39-rls-bypass-role-scope.test.mjs`
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DRIZZLE = join(REPO, 'packages', 'database', 'drizzle')
const SOURCES = [
  join(DRIZZLE, '0214_cleanup_legacy_tenant_rls.sql'),
  join(DRIZZLE, '20260927100000_tenant_rls_policies_batch1.sql'),
]
const SCOPE = join(DRIZZLE, '20261108170000_rls_bypass_scope_ihui_app.sql')

/** 只量会执行的代码:去掉整行 -- 注释(回滚块写在注释里) */
const sqlCodeOf = (text) =>
  text
    .split(/\r?\n/)
    .filter((l) => !/^\s*--/.test(l))
    .join('\n')

/** 从上游迁移里现读:哪些表被建过 `<表>_bypass_rls` 策略 */
function readBypassTables() {
  const tables = new Set()
  for (const f of SOURCES) {
    const code = sqlCodeOf(readFileSync(f, 'utf8'))
    for (const m of code.matchAll(/CREATE POLICY "([a-z0-9_]+)_bypass_rls"/g)) tables.add(m[1])
  }
  // 0214 是 DO 循环动态拼名,静态读不到具体表名 ⇒ 补上它头注声明的 6 张
  if (existsSync(SOURCES[0])) {
    for (const t of ['users', 'orders', 'payments', 'chat_messages', 'chat_favorites', 'comment_likes']) {
      tables.add(t)
    }
  }
  return [...tables]
}

const bypassTables = readBypassTables()
const scopeSrc = existsSync(SCOPE) ? readFileSync(SCOPE, 'utf8') : ''
const CODE = sqlCodeOf(scopeSrc)

// ── 判据 ────────────────────────────────────────────────────────
/** 上游建过的每一张表都必须在收窄迁移的循环清单里 */
const coversAllTables = (code) => bypassTables.every((t) => code.includes(`'${t}'`))

/** 角色门槛落在 DDL 上:`FOR ALL TO <role>`,不是"应用层自觉" */
const scopedToAppRole = (code) =>
  /app_role constant text := 'ihui_app'/.test(code) &&
  /FOR ALL TO %I USING \(current_setting\(''app\.bypass_rls'', true\) = ''true''\)/.test(code) &&
  /t \|\| '_bypass_rls', t, app_role/.test(code)

/** 不得回退到 PUBLIC(代码面量,注释里的历史说明已剥掉) */
const neverPublic = (code) => !/TO PUBLIC/.test(code)

/** 角色不存在时必须抛错,不能静默保留 PUBLIC 形态 */
const failClosedOnMissingRole = (code) =>
  /IF NOT EXISTS \(SELECT 1 FROM pg_roles WHERE rolname = app_role\)/.test(code) &&
  /RAISE EXCEPTION/.test(code)

/** 幂等:DROP POLICY IF EXISTS 后重建 */
const idempotent = (code) =>
  /DROP POLICY IF EXISTS %I ON public\.%I/.test(code) && /CREATE POLICY %I ON public\.%I/.test(code)

function health(code) {
  return Object.entries({
    coversAllTables,
    scopedToAppRole,
    neverPublic,
    failClosedOnMissingRole,
    idempotent,
  })
    .filter(([, fn]) => !fn(code))
    .map(([k]) => k)
}

test('D39-0 收窄迁移在位,且上游旁路表清单已现读出(夹具自证)', () => {
  assert.ok(existsSync(SCOPE), `收窄迁移缺失:${SCOPE}`)
  assert.equal(bypassTables.length, 14, `0214(6)+batch1(8) 应共 14 张,实际读到 ${bypassTables.length}`)
})

test('D39-1 14 张表的 _bypass_rls 全部 TO ihui_app,且角色缺失时 fail-closed', () => {
  assert.deepEqual(health(CODE), [], `收窄判据未成立:${health(CODE).join(',')}`)
})

test('D39-2 变异对照:漏掉一张表 / 退回 PUBLIC / 去掉角色门槛 / 静默跳过,同一把尺子必须逐条翻假', () => {
  // 臂 A:从清单里摘掉一张表(该表旁路仍对 PUBLIC 开放)
  const missingTable = CODE.replace("'notes'", '')
  assert.notEqual(missingTable, CODE, '夹具自证:臂 A 确实摘掉了一张表')
  assert.ok(health(missingTable).includes('coversAllTables'), '漏掉一张表必须被 coversAllTables 抓到')
  assert.ok(health(missingTable).includes('idempotent') === false, '臂 A 不应误伤其它判据')

  // 臂 B:策略退回 TO PUBLIC
  const toPublic = CODE.replace("FOR ALL TO %I USING", 'FOR ALL TO PUBLIC USING')
  assert.notEqual(toPublic, CODE, '夹具自证:臂 B 确实改回了 PUBLIC')
  assert.ok(health(toPublic).includes('scopedToAppRole'), '退回 PUBLIC 必须被 scopedToAppRole 抓到')
  assert.ok(health(toPublic).includes('neverPublic'), '退回 PUBLIC 必须被 neverPublic 抓到')

  // 臂 C:去掉角色存在性断言(角色缺失时迁移半途炸/或静默)
  const noRoleCheck = CODE.replace(
    /IF NOT EXISTS \(SELECT 1 FROM pg_roles WHERE rolname = app_role\) THEN[\s\S]*?END IF;/,
    '',
  )
  assert.notEqual(noRoleCheck, CODE, '夹具自证:臂 C 确实摘掉了角色断言')
  assert.ok(health(noRoleCheck).includes('failClosedOnMissingRole'), '摘掉角色断言必须被 failClosedOnMissingRole 抓到')

  // 臂 D:把 DROP POLICY IF EXISTS 摘掉(重放必炸,失去幂等)
  const notIdempotent = CODE.replace(/EXECUTE format\('DROP POLICY IF EXISTS %I ON public\.%I'[^\n]*\n/, '')
  assert.notEqual(notIdempotent, CODE, '夹具自证:臂 D 确实摘掉了 DROP POLICY IF EXISTS')
  assert.ok(health(notIdempotent).includes('idempotent'), '摘掉 DROP POLICY 必须被 idempotent 抓到')
})
