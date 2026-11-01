// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui-seat S-SCOPE 2026-11-01
/**
 * gate-scope-meta-env-reader.test.mjs —— 门 280「本机 dev 库口令轮换窗口」必须落进元门档。
 *
 * ## 立因(票 O69 报出,S-SCOPE 落地)
 *
 * `META_SCRIPT_RE` 是**按 script 名的前缀白名单**。前缀不在名单里的门 ⇒ 只活在 `full` 档。
 * 而 2026-10-22 起本地 pre-commit **一律** meta 档(业务全量归 CI),于是:
 *   - 本地:门 280 被裁掉,永远不跑;
 *   - CI  :runner 上没有本机 8801/8802/8803 端口与 `.ihui-agent` 留痕 ⇒ 只能报 undetermined。
 * 两头都没有读数 =「装了等于没装」。
 *
 * ## 三件断言(判据必须有牙)
 *
 *   ① 正例:模拟纯 scripts 提交 ⇒ `resolveGateScope` 判 meta ⇒ 裁剪后 280 仍在应跑清单里;
 *      script 名从 `scripts/guardian-runner.mjs` 现读,不是测试里硬写(改名即红,不许静默失效)。
 *   ② 反向例(变异自证):把 gate-scope.mjs 里那行白名单条目**删掉**再 import 副本 ⇒
 *      280 必被判非 meta,且与真身的差集**恰好只有**这一门(既证咬合,又证没顺带放宽别的门)。
 *      变异锚点找不到 ⇒ 直接红(说明条目已被删/改 ⇒ 本测试失去意义,不记绿)。
 *   ③ 回归:原本该被裁的业务门(rounded-full / api-routes / i18n-keys)仍不算 meta;
 *      原本该跑的元门(check-doc- / check-gate- / check-watermark- 族)仍是 meta。
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const SCOPE_LIB = join(ROOT, 'scripts', 'lib', 'gate-scope.mjs')
const JUDGEMENT_JSON = join(ROOT, 'scripts', 'lib', 'judgement-libs.json')
const RUNNER = join(ROOT, 'scripts', 'guardian-runner.mjs')

const scopeMod = await import(pathToFileURL(SCOPE_LIB).href)
const { resolveGateScope, isMetaGate } = scopeMod

/** 从注册表现读门 280 的 script 名 —— 断言对象不许测试里自己编。 */
function registryScriptOf(id) {
  const src = readFileSync(RUNNER, 'utf8')
  const at = src.indexOf(`id: '${id}'`)
  assert.ok(at > 0, `注册表里找不到 id: '${id}'`)
  const m = /script:\s*'([^']+)'/.exec(src.slice(at, at + 600))
  assert.ok(m, `id ${id} 的注册项里 600 字符内找不到 script 字段`)
  return m[1]
}

/** 注册表里出现的全部 script 名(按注册序去重)。 */
function registryScripts() {
  const src = readFileSync(RUNNER, 'utf8')
  return [...new Set([...src.matchAll(/script:\s*'([^']+)'/g)].map((m) => m[1]))]
}

const GATE_280_SCRIPT = registryScriptOf('280')

test('① 纯 scripts 提交 ⇒ 门 280 在裁剪后的应跑清单里', () => {
  const staged = [
    'scripts/lib/gate-scope.mjs',
    'scripts/tests/gate-scope-meta-env-reader.test.mjs',
  ]
  const sc = resolveGateScope(staged)
  assert.equal(sc.scope, 'meta', `纯 scripts 提交应落 meta 档,实得 ${sc.scope}(${sc.reason})`)

  // 用真注册表的门做过滤器输入(280 + 三道业务门做对照),再看裁剪后剩谁。
  const registry = [
    { id: '280', script: GATE_280_SCRIPT },
    { id: 'X1', script: 'check-rounded-full.mjs' },
    { id: 'X2', script: 'check-api-routes.mjs' },
    { id: 'X3', script: 'check-i18n-keys.mjs' },
  ]
  const kept = registry.filter((c) => isMetaGate(c))
  assert.ok(
    kept.some((c) => c.id === '280'),
    `元门档把门 280(${GATE_280_SCRIPT})裁掉了 ⇒ 纯 scripts 提交永不出读数(即本次要修的缺陷)`,
  )
  assert.equal(kept.length, 1, `元门档应只留 280,实留 ${kept.map((c) => c.id).join('/')}`)
})

test('② 反向例:删掉白名单条目 ⇒ 门 280 必被裁掉(变异自证)', async () => {
  const original = readFileSync(SCOPE_LIB, 'utf8')
  const anchor = /^[ \t]*'check-dev-db-rotation-window',?[^\n]*$/m
  assert.match(
    original,
    anchor,
    '变异锚点不存在:gate-scope.mjs 里已找不到 check-dev-db-rotation-window 白名单条目 —— ' +
      '要么修复被回退(测试必须红),要么条目写法变了(请同步本测试),两种情况都不许记绿',
  )
  const mutated = original.replace(anchor, '')

  const dir = mkdtempSync(join(tmpdir(), 'ihui-gate-scope-mut-'))
  try {
    writeFileSync(join(dir, 'gate-scope.mjs'), mutated, 'utf8')
    // 静态 import 的 `./judgement-libs.json` 必须同目录同在,否则副本 import 直接抛。
    copyFileSync(JUDGEMENT_JSON, join(dir, 'judgement-libs.json'))
    const mut = await import(pathToFileURL(join(dir, 'gate-scope.mjs')).href)

    assert.equal(
      mut.isMetaGate({ script: GATE_280_SCRIPT }),
      false,
      '回退修复后门 280 仍被判 meta ⇒ 本测试没有咬住任何东西',
    )
    // 档位判定本身不受影响(变异只动白名单,不动 staged 路径判据)。
    assert.equal(mut.resolveGateScope(['scripts/lib/gate-scope.mjs']).scope, 'meta')

    // 差集必须恰好一门:证明修复没有顺带把别的门拉进 meta 档。
    const scripts = registryScripts()
    const before = scripts.filter((s) => mut.isMetaGate({ script: s }))
    const after = scripts.filter((s) => isMetaGate({ script: s }))
    const added = after.filter((s) => !before.includes(s))
    assert.deepEqual(added, [GATE_280_SCRIPT], `本修复新增进 meta 档的门应恰好一门,实得 ${added.join(', ')}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('③ 回归:业务门仍被裁 / 原元门仍保留', () => {
  // 3 道典型业务门:拉了它们进 meta 档就会把 60s 预算吃掉,且它们判的是本次改动之外的存量。
  for (const s of ['check-rounded-full.mjs', 'check-api-routes.mjs', 'check-i18n-keys.mjs']) {
    assert.equal(isMetaGate({ script: s }), false, `${s} 是业务门,不该被拉进元门档`)
  }
  // 4 道原本就在 meta 档的门:白名单若被误删前缀,这里先红。
  for (const s of [
    'check-doc-numbers.mjs',
    'check-gate-rot.mjs',
    'check-watermark-coverage.mjs',
    'check-plan-claims-vs-head.mjs',
  ]) {
    assert.equal(isMetaGate({ script: s }), true, `${s} 原本就在元门档,不该被这次改动挤出去`)
  }
  // 失效方向:空/畸形入参一律不算 meta(宁可多跑,不可漏跑)。
  assert.equal(isMetaGate(null), false)
  assert.equal(isMetaGate({}), false)
})
