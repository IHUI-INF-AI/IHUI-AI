// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:票 L28576 缺陷① —— npm org 名必须来自通道台账,不得是 runner 里的字面量。
//
// 取向(AGENTS.md §22c + §0.6):判据实现只住在 `scripts/check-sdk-release-channels.mjs`,
// 本文件 `import` 它的 `__test__` 出口直接调用,**不复制任何判据常量/坐标**;对 runner 只做
// 「形状锁」——org 名进入该文件的唯一通道是 npmOrgName(),出现字面量即红。
//
// 立因(2026-10-28 现读):`.github/scripts/npm-bootstrap-runner.mjs` 的 action=org_create
// 原把 org 名写成字面量 `ihui`,而包 scope 早已改成 `@ihui-ai/sdk` ⇒ 引导器建出的 org 与包名
// 不同名,scoped 包照样发不出去(registry `-/v1/org/ihui` 与 `-/v1/org/ihui-ai` 当次实测均 404,
// 对照 `ihui-cli` 200)。
//
// 跑法:node --test scripts/tests/npm-bootstrap-org-scope.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as channels } from '../check-sdk-release-channels.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const RUNNER_REL = '.github/scripts/npm-bootstrap-runner.mjs'

/** 只遮注释,保留字符串/模板字面量(形状锁判的是代码面字面量)。 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const ledger = JSON.parse(readFileSync(resolve(REPO_ROOT, 'config/sdk-release-channels.json'), 'utf8'))

test('org 名解析:活台账的 npm.coordinate 是唯一来源', () => {
  const coordinate = ledger.channels.find((c) => c.id === 'npm').coordinate
  const expected = coordinate.startsWith('@') ? coordinate.slice(1).split('/')[0] : null
  // 正控:函数读数 == 由坐标现算的期望值(写死任何 org 名的测试会在此立刻腐烂)
  assert.equal(channels.npmOrgScopeOf(ledger), expected)
  assert.equal(channels.resolveNpmOrgScope(), expected)
  assert.ok(expected, '活台账的 npm 坐标必须是 @scope/name 形态,否则本测试的期望值无意义')
})

test('org 名解析:改名即跟改 —— 不得读死任何一个 org', () => {
  const renamed = { ...ledger, channels: ledger.channels.map((c) => (c.id === 'npm' ? { ...c, coordinate: '@entirely-other/sdk' } : c)) }
  assert.equal(channels.npmOrgScopeOf(renamed), 'entirely-other')
})

test('org 名解析:取不到 ⇒ null(交调用方显式未判定,绝不回落猜值 §0.3)', () => {
  const withCoord = (coordinate) => ({
    ...ledger,
    channels: ledger.channels.map((c) => (c.id === 'npm' ? { ...c, coordinate } : c)),
  })
  assert.equal(channels.npmOrgScopeOf(withCoord('ihui-ai-sdk')), null, '非 scoped 坐标不产 org 名')
  assert.equal(channels.npmOrgScopeOf(withCoord('')), null)
  assert.equal(channels.npmOrgScopeOf(withCoord('@   /sdk')), null, '空 scope 不产名')
  assert.equal(channels.npmOrgScopeOf({ ...ledger, channels: ledger.channels.filter((c) => c.id !== 'npm') }), null, 'npm 通道缺席 ⇒ null')
  assert.equal(channels.npmOrgScopeOf(null), null)
})

test('org 名解析:台账不可读 ⇒ 抛「无从解析」,不返回假 org', () => {
  assert.throws(() => channels.resolveNpmOrgScope(resolve(REPO_ROOT, 'config/__definitely_missing__.json')), /无法解析 npm org 名/)
  // 夹具落点 = scratch-dir(§15b);两条"取不到"的分支都必须显式失败,
  // 否则 runner 会带着猜出来的 org 去建组织(§0.3「没判」不得写成"判过")。
  const dir = mkScratch('npm-org-scope-')
  try {
    const brokenStructure = join(dir, 'bad-structure.json')
    writeFileSync(brokenStructure, JSON.stringify({ ...ledger, $schemaVersion: 99 }), 'utf8')
    assert.ok(channels.validateStructure(JSON.parse(readFileSync(brokenStructure, 'utf8'))).length > 0, '夹具须确实判出不合规')
    assert.throws(() => channels.resolveNpmOrgScope(brokenStructure), /结构不合规/)

    const unscoped = join(dir, 'unscoped.json')
    writeFileSync(
      unscoped,
      JSON.stringify({ ...ledger, channels: ledger.channels.map((c) => (c.id === 'npm' ? { ...c, coordinate: 'ihui-ai-sdk' } : c)) }),
      'utf8'
    )
    assert.throws(() => channels.resolveNpmOrgScope(unscoped), /不是 @scope\/name 形态/)
  } finally {
    rmScratch(dir)
  }
})

test('形状锁:runner 里 org 名只能经 npmOrgName() 进入,出现字面量即红', () => {
  const src = stripComments(readFileSync(resolve(REPO_ROOT, RUNNER_REL), 'utf8'))
  assert.equal(src.match(/['"]ihui['"]/g)?.length ?? 0, 0, `${RUNNER_REL} 代码面不得出现 'ihui' 字面量`)
  assert.equal(
    src.match(/\/org\/(?!create|\$)[A-Za-z]/g)?.length ?? 0,
    0,
    `${RUNNER_REL} 的 /org/<名> 端点必须由 org 变量插值,不得写死名字(/org/create 是网页入口,豁免)`
  )
  assert.ok(/async function npmOrgName\s*\(/.test(src), 'npmOrgName() 定义不得被摘掉')
  assert.ok((src.match(/await npmOrgName\(\)/g) ?? []).length >= 2, 'probe 与 create 两条路径都要经 npmOrgName()')
  assert.ok(src.includes('resolveNpmOrgScope'), '必须调用台账侧唯一解析出口')
  assert.ok(src.includes('../../scripts/check-sdk-release-channels.mjs'), '必须从台账脚本取出口,不得自带第二份判据(§0.6)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
