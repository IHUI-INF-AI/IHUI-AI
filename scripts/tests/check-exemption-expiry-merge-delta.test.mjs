// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 108(check-exemption-expiry)的合并面判据测试:
// ① 合并带入的既有豁免(上游分支早就有的)→ 不得记本次新增;
// ② 合并里真新增一条 → 必须判红。
// 基准来自 scripts/lib/merge-delta.mjs(已冻结),本文件不复制判据实现。
//
// 跑法:node --test scripts/tests/check-exemption-expiry-merge-delta.test.mjs
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { gitRaw } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-exemption-expiry.mjs'

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'check-exemption-expiry.mjs')
const KEY = 'a.ts::border-ink-exempt'
const TODAY = '2026-11-07'

const entry = (line) => ({
  file: 'a.ts',
  family: 'border-ink-exempt',
  line,
  attach: 'inline',
  expiry: null,
  hasReason: true,
  fileScoped: false,
  toolFace: false,
  archiveFace: false,
  lifetimeDays: 90,
  registered: true,
})
const E = (n, file) => Array.from({ length: n }, (_, i) => ({ ...entry(i + 1), file: file || 'a.ts' }))

const analyzeWith = (entries, headCounts) =>
  gate.analyze({
    entries,
    suppressionsByFile: {},
    suppressionUndatedByFile: {},
    baseline: { grandfatherUntil: '2099-01-01', undatedCounts: {} },
    today: TODAY,
    headCounts,
    headUnregisteredFamilies: new Set(),
    headSuppressionCounts: {},
  })
const countRed = (res, code) => res.red.filter((r) => r.code === code).length

// ---------------------------------------------------------------- 纯构造面

test('A1 合并带入的既有豁免:naive 单父(HEAD 2)误判 1 条红;双父(HEAD 2 ∪ MERGE_HEAD 3)绿', () => {
  const result = E(3)
  const naiveAnchor = gate.resolveAnchor({ face: 'staged', entries: result, headEntries: E(2) })
  const correctAnchor = gate.resolveAnchor({
    face: 'staged',
    entries: result,
    parentEntryLists: [E(2), E(3)],
  })
  assert.equal(naiveAnchor[KEY], 2, JSON.stringify(naiveAnchor))
  assert.equal(correctAnchor[KEY], 3, JSON.stringify(correctAnchor))
  // 修前读数:只看 HEAD 会判红 1 条;修后:0 条
  assert.equal(countRed(analyzeWith(result, naiveAnchor), 'E1'), 1)
  assert.equal(countRed(analyzeWith(result, correctAnchor), 'E1'), 0)
})

test('A2 合并里真新增一条(结果 4 / 父 2 ∪ 3):双父锚点 3 ⇒ 判红 1 条', () => {
  const result = E(4)
  const correctAnchor = gate.resolveAnchor({
    face: 'staged',
    entries: result,
    parentEntryLists: [E(2), E(3)],
  })
  assert.equal(correctAnchor[KEY], 3)
  const res = analyzeWith(result, correctAnchor)
  assert.equal(countRed(res, 'E1'), 1)
  assert.match(res.red.find((r) => r.code === 'E1').msg, /本次 4 处.*锚点.*3 处/)
})

test('A3 非合并(单父=HEAD)与旧口径逐字等价:锚点仍是 HEAD 读数', () => {
  assert.deepEqual(
    gate.resolveAnchor({ face: 'staged', entries: E(3), headEntries: E(2) }),
    { [KEY]: 2 },
  )
  assert.equal(gate.effectiveAnchorFromParents(3, [2]), 2)
})

test('A4 另一父多出的键不得被当成结果面新增(多重集归一)', () => {
  const result = E(1)
  const anchor = gate.resolveAnchor({
    face: 'staged',
    entries: result,
    parentEntryLists: [E(0), E(1)],
  })
  assert.equal(anchor[KEY], 1)
  assert.equal(countRed(analyzeWith(result, anchor), 'E1'), 0)
})

test('A5 E5 抑制面同型:合并带入的既有无日期抑制不判红,真新增一条判红', () => {
  const sup = (n) => ({ 'g.ts': { 'eslint-disable': n } })
  const anchor = gate.resolveSuppressionAnchor({
    face: 'staged',
    undatedByFile: sup(3),
    parentUndatedByFiles: [sup(2), sup(3)],
  })
  assert.equal(anchor['g.ts::eslint-disable'], 3)
  const mkRes = (counts) =>
    gate.analyze({
      entries: [],
      suppressionsByFile: {},
      suppressionUndatedByFile: sup(3),
      baseline: { grandfatherUntil: '2099-01-01', undatedCounts: {} },
      today: TODAY,
      headCounts: {},
      headUnregisteredFamilies: new Set(),
      headSuppressionCounts: counts,
    })
  assert.equal(countRed(mkRes(anchor), 'E5'), 0)
  const added = gate.resolveSuppressionAnchor({
    face: 'staged',
    undatedByFile: sup(4),
    parentUndatedByFiles: [sup(2), sup(3)],
  })
  assert.equal(added['g.ts::eslint-disable'], 3)
})

test('A6 E4 锚点取各父并集:上游用过的未登记族不算本次新引入,真新族才红', () => {
  const unreg = { ...entry(1), file: 'apps/x.ts', family: 'upstream-only-exempt' }
  const result = [unreg]
  const res = gate.analyze({
    entries: result,
    suppressionsByFile: {},
    suppressionUndatedByFile: {},
    baseline: { grandfatherUntil: '2099-01-01', undatedCounts: {} },
    today: TODAY,
    headCounts: {},
    headUnregisteredFamilies: new Set(['upstream-only-exempt']),
    headSuppressionCounts: {},
  })
  assert.equal(countRed(res, 'E4'), 0)
  const res2 = gate.analyze({
    entries: result,
    suppressionsByFile: {},
    suppressionUndatedByFile: {},
    baseline: { grandfatherUntil: '2099-01-01', undatedCounts: {} },
    today: TODAY,
    headCounts: {},
    headUnregisteredFamilies: new Set(),
    headSuppressionCounts: {},
  })
  assert.equal(countRed(res2, 'E4'), 1)
})

// ---------------------------------------------------------------- 真临时仓(merge --no-commit)

const bullet = (n) =>
  Array.from({ length: n }, (_, i) => `export const x${i} = ${i} // border-ink-exempt: 存量${i}`).join('\n') +
  '\n'

test('X1 真临时仓合并面:上游带来的既有豁免绿;合并里再加一条判红(修前 naive 会误判)', () => {
  let dir = null
  try {
    dir = mkScratch('exemption-expiry-merge')
    const git = (args) => gitRaw(args, dir, { timeout: 30000 })
    const run = () => {
      const r = spawnSync(process.execPath, [SCRIPT, '--root', dir, '--staged', '--json'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
        maxBuffer: 32 << 20,
      })
      let parsed = { red: [] }
      try {
        parsed = JSON.parse(r.stdout || '{}')
      } catch {
        /* 解析失败时只信退出码,断言会红而不是假绿 */
      }
      return { status: r.status, red: parsed.red || [], out: `${r.stdout || ''}${r.stderr || ''}` }
    }

    git(['init', '-q'])
    git(['config', 'user.email', 'gate@test.invalid'])
    git(['config', 'user.name', 'gate'])
    git(['checkout', '-b', 'main'])
    mkdirSync(path.join(dir, 'scripts'), { recursive: true })
    writeFileSync(
      path.join(dir, 'scripts', 'exemption-expiry-baseline.json'),
      `${JSON.stringify({ grandfatherUntil: '2099-01-01', undatedCounts: {} }, null, 2)}\n`,
      'utf8',
    )
    writeFileSync(path.join(dir, 'a.ts'), bullet(2), 'utf8')
    git(['add', '.'])
    git(['commit', '-q', '-m', 'base'])

    git(['checkout', '-b', 'upstream'])
    writeFileSync(path.join(dir, 'a.ts'), bullet(3), 'utf8')
    git(['add', 'a.ts'])
    git(['commit', '-q', '-m', 'upstream 三条'])

    git(['checkout', 'main'])
    writeFileSync(path.join(dir, 'c.ts'), 'export const c = 1\n', 'utf8')
    git(['add', 'c.ts'])
    git(['commit', '-q', '-m', 'main 侧'])
    git(['merge', '--no-commit', '--no-ff', 'upstream'])

    // 真实面:结果面 3 条,HEAD 2 条,MERGE_HEAD 3 条
    const resText = readFileSync(path.join(dir, 'a.ts'), 'utf8')
    const headEntries = gate.scanFile('a.ts', git(['show', 'HEAD:a.ts'])).entries
    const upEntries = gate.scanFile('a.ts', git(['show', 'MERGE_HEAD:a.ts'])).entries
    const resEntries = gate.scanFile('a.ts', resText).entries
    assert.equal(headEntries.length, 2)
    assert.equal(upEntries.length, 3)
    assert.equal(resEntries.length, 3)

    const naive = gate.resolveAnchor({ face: 'staged', entries: resEntries, headEntries })
    const correct = gate.resolveAnchor({
      face: 'staged',
      entries: resEntries,
      parentEntryLists: [headEntries, upEntries],
    })
    assert.equal(naive[KEY], 2)
    assert.equal(correct[KEY], 3)
    // 修前读数:naive 单父基准会判红 1 条
    assert.equal(countRed(analyzeWith(resEntries, naive), 'E1'), 1)

    const first = run()
    assert.equal(first.status, 0, first.out)
    assert.equal(first.red.length, 0, first.out)

    // ② 合并里真新增一条
    writeFileSync(path.join(dir, 'a.ts'), `${bullet(3)}export const w = 9 // border-ink-exempt: 本次新增\n`, 'utf8')
    git(['add', 'a.ts'])
    const second = run()
    assert.equal(second.status, 1, second.out)
    assert.ok(second.red.some((v) => v.code === 'E1'), second.out)
  } finally {
    if (dir) {
      try {
        rmScratch(dir)
      } catch {
        /* 夹具残留不改判据结论 */
      }
    }
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
