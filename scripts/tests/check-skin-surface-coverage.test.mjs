// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门 329(皮肤表面覆盖)镜像测试 —— 判据全部 import 自源脚本 __test__(§22c 禁复制)。
 * 覆盖:未登记角色点名 / 家族豁免 / 高对比倒序 / 色板键拼错 / 真实工作区零未登记 / runner 装车成套。
 *
 * 运行:node --test scripts/tests/check-skin-surface-coverage.test.mjs
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { __test__ } from '../check-skin-surface-coverage.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const TOKENS =
  ':root{--color-background:#fff;--color-mystery:#123;--color-success-500:#0f0;--color-stroke-subtle:rgba(0,0,0,.06);}'
const SKIN_OK =
  "html[data-custom-theme='true'] {\n  --color-background: var(--custom-light-card);\n  --color-stroke-subtle: var(--custom-light-border);\n}\n" +
  "html.dark[data-custom-theme='true'] {\n  --color-background: var(--custom-dark-card);\n  --color-stroke-subtle: var(--custom-dark-border);\n}\n"
const LEDGER = [{ pattern: 'success-*', reason: '语义色恒定' }]

test('未登记角色被点名;家族豁免生效', () => {
  const r = __test__.check(SKIN_OK + "html[data-high-contrast='true'] { --color-border: #000; }", TOKENS, LEDGER)
  assert.ok(r.uncovered.includes('mystery'))
  assert.ok(!r.uncovered.includes('success-500'))
  assert.ok(!r.uncovered.includes('background'))
  assert.ok(!r.uncovered.includes('stroke-subtle'))
})

test('高对比块排在皮肤段之前 ⇒ 判红并点名顺序', () => {
  const bad = "html[data-high-contrast='true'] { --color-border: #000; }\n" + SKIN_OK
  const r = __test__.check(bad, TOKENS, LEDGER)
  assert.ok(r.problems.some((p) => p.includes('高对比块')))
})

test('皮肤段引用色板不存在的键 ⇒ 判红(防拼错静默失效)', () => {
  const bad =
    "html[data-custom-theme='true'] {\n  --color-background: var(--custom-light-nonsense);\n}\nhtml.dark[data-custom-theme='true'] {\n  --color-background: var(--custom-dark-nonsense);\n}\n"
  const r = __test__.check(bad, TOKENS, LEDGER)
  assert.ok(r.problems.some((p) => p.includes('nonsense')))
})

test('真实工作区:tokens 全部角色 ∈ 皮肤映射 ∪ 豁免台账', () => {
  const globals = readFileSync(join(ROOT, 'apps/web/app/globals.css'), 'utf8')
  const tokens = readFileSync(join(ROOT, 'packages/design-tokens/src/styles/tokens.css'), 'utf8')
  const ledger = JSON.parse(readFileSync(join(ROOT, 'scripts/data/skin-surface-exemptions.json'), 'utf8'))
  const r = __test__.check(globals, tokens, ledger)
  assert.deepEqual(r.problems, [])
  assert.deepEqual(r.uncovered, [])
  assert.ok(r.totalRoles > 200)
  assert.ok(r.mappedCount >= 50)
})

test('runner 装车成套:id 329 + script + blocking + skipEnv + stagedTriggers', () => {
  const runner = readFileSync(join(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
  const at = runner.indexOf("id: '329'")
  assert.ok(at > 0)
  const block = runner.slice(at, at + 900)
  assert.ok(block.includes("script: 'check-skin-surface-coverage.mjs'"))
  assert.ok(block.includes("mode: 'blocking'"))
  assert.ok(block.includes("skipEnv: 'HUSKY_SKIP_SKIN_SURFACE_COVERAGE'"))
  assert.ok(block.includes('apps/web/app/globals.css'))
  assert.ok(block.includes('scripts/data/skin-surface-exemptions.json'))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
