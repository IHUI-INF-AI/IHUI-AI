// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 250 镜像测试(§22c):源脚本 __test__ 形状锁 + 装车证明(HEAD 面 runner)+ 补测两半射程单源锁。
// node --test scripts/tests/check-e2e-coverage-gap.test.mjs
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { gitRaw } from '../lib/face-reader.mjs'
import { __test__ as G } from '../check-e2e-coverage-gap.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const GATE = path.join(ROOT, 'scripts/check-e2e-coverage-gap.mjs')

test('self-test 全绿(例数按末行现读)', () => {
  const r = spawnSync(process.execPath, [GATE, '--self-test'], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr || r.stdout)
  const last = String(r.stdout).trim().split(/\r?\n/).pop()
  assert.match(last, /^自检 \d+\/\d+ 通过$/)
})

test('__test__ 键齐备(源搬家/改名即报错)', () => {
  for (const k of [
    'REPO_ROOT',
    'SCOPE_REL',
    'validateScope',
    'loadScope',
    'collectFace',
    'evaluateFace',
    'judgeExit',
    'todayIso',
  ]) {
    assert.ok(k in G, `缺导出 ${k}`)
  }
})

test('射程单源:缺口门射程清单 == 补测器 audit.roots', () => {
  const scope = G.loadScope()
  assert.ok(scope.roots.length > 0)
  const map = JSON.parse(readFileSync(path.join(ROOT, 'scripts/data/e2e-autofill-map.json'), 'utf8'))
  assert.deepEqual(
    scope.roots.map((r) => r.root),
    map.audit.roots,
  )
})

test('装车证明:HEAD 面 runner 里 id 250 条目成套(script/mode/skipEnv/triggers)', () => {
  const src = gitRaw(['cat-file', 'blob', 'HEAD:scripts/guardian-runner.mjs'], ROOT, {
    maxBuffer: 64 * 1024 * 1024,
  })
  const m = src.match(/script: 'check-e2e-coverage-gap\.mjs',([\s\S]{0,2000}?)\n  \},/)
  assert.ok(m, 'HEAD 面 runner 找不到 check-e2e-coverage-gap.mjs 注册条目')
  const block = m[1]
  // 升 blocking 时本条断言须与 AGENTS 点名、门体头注同笔更新(名字承诺与实现兑现)。
  assert.match(block, /mode: 'warn'/)
  assert.match(block, /skipEnv: 'HUSKY_SKIP_E2E_COVERAGE_GAP'/)
  for (const { root } of G.loadScope().roots) {
    assert.ok(block.includes(`'${root}/'`), `triggers 缺射程根 ${root}/`)
  }
  assert.ok(block.includes("'scripts/data/e2e-coverage-gap-scope.json'"), 'triggers 缺射程清单')
  assert.ok(block.includes("'scripts/lib/e2e-coverage-gap.mjs'"), 'triggers 缺判据层')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
