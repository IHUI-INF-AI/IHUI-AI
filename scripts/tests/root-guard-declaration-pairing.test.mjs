// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * RP-72 根护栏「声明集成对」判据的成对用例 + runner 接线结构锁(2026-11-11 立,票 RP-72)。
 *
 * 票面要求的成对用例:改规则文件不带清单 ⇒ 判拦;带清单 ⇒ 放行。
 * 判据单源在 scripts/lib/root-guard-declaration-pairing.mjs(§0.6:本文件不抄第二份键表,
 * 规则面/清单路径一律 import 常量)。结构锁带变异自证(§0.9)。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import {
  rootGuardDeclarationPairing,
  ROOT_GUARD_RULE_FILES,
  ROOT_GUARD_MANIFEST_FILE,
} from '../lib/root-guard-declaration-pairing.mjs'

const REPO = fileURLToPath(new URL('../../', import.meta.url))
const RUNNER_SRC = readFileSync(REPO + 'scripts/guardian-runner.mjs', 'utf8')

// —— 成对用例(票面点名) ——

test('RP-72 · 改规则文件不带清单 ⇒ 判拦,并点名规则面与清单', () => {
  for (const rule of ROOT_GUARD_RULE_FILES) {
    const v = rootGuardDeclarationPairing(['apps/web/src/main.tsx', rule])
    assert.equal(v.verdict, 'block', `改 ${rule} 而未同枚改清单必须判拦`)
    assert.deepEqual(v.ruleFiles, [rule])
    assert.equal(v.manifestFile, ROOT_GUARD_MANIFEST_FILE)
  }
})

test('RP-72 · 改规则文件同枚带清单 ⇒ 放行', () => {
  const v = rootGuardDeclarationPairing([...ROOT_GUARD_RULE_FILES, ROOT_GUARD_MANIFEST_FILE])
  assert.equal(v.verdict, 'pass', '两枚规则面 + 清单同枚 ⇒ 放行')
  assert.deepEqual(v.ruleFiles, ROOT_GUARD_RULE_FILES)
  for (const rule of ROOT_GUARD_RULE_FILES) {
    assert.equal(rootGuardDeclarationPairing([rule, ROOT_GUARD_MANIFEST_FILE]).verdict, 'pass')
  }
})

test('RP-72 · 未碰规则面 ⇒ 不适用(绝不误拦普通提交)', () => {
  assert.equal(rootGuardDeclarationPairing(['apps/web/package.json']).verdict, 'na')
  assert.equal(rootGuardDeclarationPairing([]).verdict, 'na')
  assert.equal(rootGuardDeclarationPairing(null).verdict, 'na', '坏输入 ⇒ na(失效方向=不误拦)')
})

test('RP-72 · 只改清单不改规则面 ⇒ 不适用(重封本身不该被本尺卡)', () => {
  assert.equal(rootGuardDeclarationPairing([ROOT_GUARD_MANIFEST_FILE]).verdict, 'na')
})

test('RP-72 · 规则面键表与清单 targets 同源(不抄第二份清单)', () => {
  const manifest = JSON.parse(readFileSync(REPO + 'scripts/data/root-guard-manifest.json', 'utf8'))
  const bound = new Set(manifest.targets.map((t) => t.path))
  for (const rule of ROOT_GUARD_RULE_FILES) {
    assert.ok(bound.has(rule), `判据里的规则面 ${rule} 必须确为清单绑定目标,否则本尺判的是空气`)
  }
  assert.ok(bound.has(ROOT_GUARD_MANIFEST_FILE) === false, '清单自身不是 target(它是被封件)')
})

// —— runner 接线结构锁(带变异自证) ——

function assertRunnerWiring(source) {
  assert.ok(
    source.includes("import { rootGuardDeclarationPairing } from './lib/root-guard-declaration-pairing.mjs'"),
    'runner 必须 import 判据单源(接线缺失 = 自检是摆设)',
  )
  const region = source.slice(source.indexOf('RP-72 根护栏声明自检'), source.indexOf('// === Help ==='))
  assert.ok(region.length > 0 && region.includes('if (passStaged)'), '自检必须挂在提交链(--staged)档')
  assert.ok(region.includes('rootGuardDeclarationPairing('), '自检块必须真调判据')
  assert.ok(region.includes('--seal --staged'), '判拦必须点名同枚 --seal 出口(--staged 档)')
  assert.ok(region.includes('判拦'), '点名话术必须含「判拦」')
  assert.equal(region.includes('process.env'), false, '本尺不提供任何 skip 变量(唯一出路=同枚重封)')
}

test('RP-72 · runner 提交链接线齐全且无 skip 变量', () => {
  assertRunnerWiring(RUNNER_SRC)
})

test('RP-72 · 变异自证:抹 import/抹接线/塞 skip 变量 ⇒ 接线锁逐项转红', () => {
  const cases = [
    ['抹掉 import', RUNNER_SRC.replace("import { rootGuardDeclarationPairing } from './lib/root-guard-declaration-pairing.mjs'", '/* removed */')],
    ['抹掉 passStaged 接线', RUNNER_SRC.replace('if (passStaged) {\n  try {\n    const rpPairingPaths', 'if (false) {\n  try {\n    const rpPairingPaths')],
    ['给本尺塞 skip 变量', RUNNER_SRC.replace('判据单源在 scripts/lib/root-guard-declaration-pairing.mjs', '判据单源 process.env.X 在 scripts/lib/root-guard-declaration-pairing.mjs')],
  ]
  for (const [label, mutated] of cases) {
    assert.notEqual(mutated, RUNNER_SRC, `${label}:变异没生效 ⇒ 本自证是摆设`)
    let red = false
    try { assertRunnerWiring(mutated) } catch { red = true }
    assert.equal(red, true, `${label} 后接线锁必须红`)
  }
})
