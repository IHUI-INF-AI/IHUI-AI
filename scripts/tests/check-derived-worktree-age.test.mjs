// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


// §22c 镜像测试:Y-71 派生检出寿命闸(scripts/check-derived-worktree-age.mjs)。
// 单一真相源(§0.6):脚本本体由另一 agent 编写(490 行,射程含 scratch + .DevEnv/Temp
// + 仓内 .worktrees/),本测试文件为它的镜像锁。原 check-temp-worktree-lifetime.mjs
// 实现因护栏未删,但本测试不再 import 它——它测的是对方脚本。

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  SILENCE_MAX_HOURS,
  AGE_MAX_HOURS,
  parseWorktreePorcelain,
  isDerivedCheckout,
  classifyDerivedAge,
} from '../check-derived-worktree-age.mjs'

const REPO_ROOT = 'G:/IHUI-AI'

// ---------------------------------------------------------------------------
// parseWorktreePorcelain:porcelain 契约锁
// ---------------------------------------------------------------------------

test('parseWorktreePorcelain:主工作树 + linked 三态字段', () => {
  const text = [
    'worktree G:/IHUI-AI',
    'HEAD 40f7f8e92e9f',
    'branch refs/heads/main',
    '',
    'worktree D:/DevEnv/Temp/y71-fixture/scratch/wt-a',
    'HEAD aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'detached',
    '',
    'worktree G:/IHUI-AI/.worktrees/orphan-shell',
    'HEAD bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'branch refs/heads/some-branch',
    'prunable',
    '',
  ].join('\n')
  const rows = parseWorktreePorcelain(text)
  assert.equal(rows.length, 3)
  // 主工作树:porcelain 第一条
  assert.equal(rows[0].path, 'G:/IHUI-AI')
  assert.equal(rows[0].branch, 'main')
  assert.equal(rows[0].detached, false)
  // linked detached
  assert.equal(rows[1].path, 'D:/DevEnv/Temp/y71-fixture/scratch/wt-a')
  assert.equal(rows[1].detached, true)
  // prunable 标记
  assert.equal(rows[2].prunable, true)
})

test('parseWorktreePorcelain:locked 变体', () => {
  const text = [
    'worktree G:/IHUI-AI',
    'HEAD x',
    'branch refs/heads/main',
    '',
    'worktree D:/wt-locked',
    'HEAD y',
    'branch refs/heads/dev',
    'locked reason here',
    '',
  ].join('\n')
  const rows = parseWorktreePorcelain(text)
  assert.equal(rows.length, 2)
  assert.equal(rows[1].locked, 'reason here')
})

test('parseWorktreePorcelain:空输入不崩', () => {
  assert.deepEqual(parseWorktreePorcelain(''), [])
  assert.deepEqual(parseWorktreePorcelain(null), [])
})

// ---------------------------------------------------------------------------
// isDerivedCheckout:射程边界
// ---------------------------------------------------------------------------

test('isDerivedCheckout:主工作树豁免', () => {
  const r = isDerivedCheckout('G:/IHUI-AI', { repoRoot: REPO_ROOT })
  assert.equal(r.derived, false)
})

test('isDerivedCheckout:仓内 .worktrees/ 命中', () => {
  const r = isDerivedCheckout('G:/IHUI-AI/.worktrees/mobile-auto', { repoRoot: REPO_ROOT })
  assert.equal(r.derived, true)
  assert.match(r.why, /\.worktrees/)
})

test('isDerivedCheckout:仓内 .DevEnv/Temp 命中', () => {
  const r = isDerivedCheckout('G:/IHUI-AI/.DevEnv/Temp/ihui-wt-1', { repoRoot: REPO_ROOT })
  assert.equal(r.derived, true)
})

test('isDerivedCheckout:仓外 scratch 根命中(默认 scratchRoot)', () => {
  // scratchRoot() 由 scripts/lib/scratch-dir.mjs 提供,本测试不 mock,只验证接口不抛
  const r = isDerivedCheckout('D:/DevEnv/Temp/any-path', { repoRoot: REPO_ROOT })
  assert.equal(typeof r.derived, 'boolean')
})

test('isDerivedCheckout:仓外兄弟席不命中(.worktrees-x 前缀误判防御)', () => {
  // isUnderDir 已修复:整段前缀比对,`G:/IHUI-AI-wt-sibling` 不再被误判落在 `G:/IHUI-AI` 下。
  const r = isDerivedCheckout('G:/IHUI-AI-wt-sibling/x', { repoRoot: REPO_ROOT })
  assert.equal(r.derived, false)
})

// ---------------------------------------------------------------------------
// classifyDerivedAge:三态判据
// ---------------------------------------------------------------------------

test('classifyDerivedAge:ok — silent/age 都不超阈', () => {
  const r = classifyDerivedAge({ silenceHours: 1, ageHours: 2 })
  assert.equal(r.verdict, 'ok')
  assert.equal(r.reasons.length, 0)
})

test('classifyDerivedAge:warn — 单轴超阈(仅静默)', () => {
  const r = classifyDerivedAge({ silenceHours: SILENCE_MAX_HOURS + 1, ageHours: 1 })
  assert.equal(r.verdict, 'warn')
  assert.equal(r.reasons.length, 1)
  assert.match(r.reasons[0], /静默/)
})

test('classifyDerivedAge:warn — 单轴超阈(仅账龄)', () => {
  const r = classifyDerivedAge({ silenceHours: 1, ageHours: AGE_MAX_HOURS + 1 })
  assert.equal(r.verdict, 'warn')
  assert.equal(r.reasons.length, 1)
  assert.match(r.reasons[0], /账龄/)
})

test('classifyDerivedAge:stale — 双轴同时超阈', () => {
  const r = classifyDerivedAge({
    silenceHours: SILENCE_MAX_HOURS + 5,
    ageHours: AGE_MAX_HOURS + 5,
  })
  assert.equal(r.verdict, 'stale')
  assert.equal(r.reasons.length, 2)
})

test('classifyDerivedAge:边界值恰好等于阈值(>= 语义)', () => {
  const r = classifyDerivedAge({ silenceHours: SILENCE_MAX_HOURS, ageHours: 0 })
  assert.equal(r.verdict, 'warn')
})

test('classifyDerivedAge:静默为 NaN 时不计入', () => {
  const r = classifyDerivedAge({ silenceHours: NaN, ageHours: 0 })
  assert.equal(r.verdict, 'ok')
})

// ---------------------------------------------------------------------------
// §15 纪律锁:脚本不写死盘符判据(除显式授权常量)
// ---------------------------------------------------------------------------

test('源码不写死 G:/IHUI-AI 盘符判据', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(
    new URL('../check-derived-worktree-age.mjs', import.meta.url),
    'utf8'
  )
  // 允许出现在注释/字符串字面量示例里;不允许出现在判据逻辑(裸 if/===/startsWith 等)
  const hardCodedDrive = /if\s*\(.*G:[/\\]IHUI-AI|===\s*['"]G:[/\\]IHUI-AI|startsWith\(\s*['"]G:[/\\]IHUI-AI/
  assert.doesNotMatch(src, hardCodedDrive, '判据逻辑里不得写死 G:/IHUI-AI 盘符')
})

test('阈值常量导出可复用(§0.6 单一真相源)', () => {
  assert.equal(typeof SILENCE_MAX_HOURS, 'number')
  assert.equal(typeof AGE_MAX_HOURS, 'number')
  assert.ok(SILENCE_MAX_HOURS > 0)
  assert.ok(AGE_MAX_HOURS > SILENCE_MAX_HOURS)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
