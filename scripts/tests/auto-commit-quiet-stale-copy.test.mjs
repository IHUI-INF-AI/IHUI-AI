// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 收编器「滞后副本守卫」镜像测试(§22c:直接 import 生产判据,不复制一份)。
 *
 * 立因:2026-10-25 实测一枚 `chore(auto)` 把旁路落地(只推进 HEAD+索引、不写工作树)的两处已入库修复
 * 按滞后工作树副本整份回退 —— 绑定手机/邮箱端点 88 行 + 门 198 的 updatedAt 出口形态两处。
 * 本测试同时锁三件事:①判据本身的正反例;②取不到探针一律 fail-open(保持原收编行为);
 * ③守卫真的接进主流程(造好没装车 = 没有,§1 第 9 条)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ } from '../auto-commit-quiet.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const probesFor = (table) => ({
  worktree: (p) => table[p]?.worktree ?? null,
  head: (p) => table[p]?.head ?? null,
  ancestors: (p) => table[p]?.ancestors ?? [],
})

test('T1 工作树==HEAD ⇒ 不是滞后副本(理论不该进候选,守卫也不吞)', () => {
  const r = __test__.partitionStaleCopies(['a.ts'], probesFor({ 'a.ts': { worktree: 'x', head: 'x', ancestors: ['w'] } }))
  assert.deepEqual(r, { kept: ['a.ts'], skipped: [] })
})

test('T2 工作树是新改动(不等于任何祖先)⇒ 照常收编', () => {
  const r = __test__.partitionStaleCopies(['a.ts'], probesFor({ 'a.ts': { worktree: 'new', head: 'head', ancestors: ['p1', 'p2'] } }))
  assert.deepEqual(r, { kept: ['a.ts'], skipped: [] })
})

test('T3 工作树==某祖先版本且 != HEAD ⇒ 判滞后副本、跳过并点名', () => {
  const r = __test__.partitionStaleCopies(['a.ts'], probesFor({ 'a.ts': { worktree: 'p1', head: 'head', ancestors: ['head', 'p1', 'p2'] } }))
  assert.deepEqual(r, { kept: [], skipped: ['a.ts'] })
})

test('T4 取不到探针一律 fail-open(保持原收编行为,不猜)', () => {
  const r = __test__.partitionStaleCopies(
    ['a.ts', 'b.ts'],
    probesFor({ 'a.ts': { worktree: null, head: 'head', ancestors: ['p1'] }, 'b.ts': { worktree: 'p1', head: null, ancestors: ['p1'] } }),
  )
  assert.deepEqual(r, { kept: ['a.ts', 'b.ts'], skipped: [] })
})

test('T5 混批:只摘滞后副本,其余顺序不变', () => {
  const r = __test__.partitionStaleCopies(
    ['fresh.ts', 'stale.ts'],
    probesFor({
      'fresh.ts': { worktree: 'n', head: 'h', ancestors: ['p'] },
      'stale.ts': { worktree: 'p', head: 'h', ancestors: ['p'] },
    }),
  )
  assert.deepEqual(r, { kept: ['fresh.ts'], skipped: ['stale.ts'] })
})

test('T6 装车锁:守卫必须真的接在主流程候选集之后(造好没装车 = 没有)', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'auto-commit-quiet.mjs'), 'utf8')
  assert.match(src, /dropStaleCopies\(stale, changes\)/, '主流程必须调用滞后副本守卫')
  assert.match(src, /跳过滞后副本/, '跳过必须留痕点名')
  assert.match(src, /partitionStaleCopies,/, '__test__ 必须暴露生产判据供镜像测试复用')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
