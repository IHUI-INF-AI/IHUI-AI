// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 会话模板回灌编排器的镜像测试(2026-10-29 立)。
 *
 * 判据 import 源脚本的 __test__ 出口(§22c),不复制第二份规则。
 * 锁两件事:参数面(含 pnpm 裸 `--`)与"落库 summary → worker 计数面"的归一。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as S } from '../sync-workbuddy-client-session.mjs'

test('① 参数面:--dry-run/--json/--help 合法;裸 -- 被吞;未知参数 ⇒ 未判定', () => {
  assert.equal(S.parseArgs(['--dry-run']).dryRun, true)
  assert.equal(S.parseArgs(['--json']).json, true)
  assert.equal(S.parseArgs(['--help']).help, true)
  assert.equal(S.parseArgs(['--', '--dry-run']).error, null)
  assert.equal(S.parseArgs(['--', '--dry-run']).dryRun, true)
  assert.equal(S.parseArgs(['--bogus']).error, '未知参数: --bogus')
})

test('② 归一:落库面 applied 是布尔,worker 读的是计数 —— 写了 ⇒ applied=1/skipped=0', () => {
  const n = S.normalizeSummary({
    ok: true,
    dryRun: false,
    uid: 'u-1',
    edition: 'workbuddy',
    templateKeys: 4,
    sealedPaths: 8,
    applied: true,
  })
  assert.deepEqual(n, {
    ok: true,
    providerCode: 'workbuddy',
    total: 1,
    applied: 1,
    skipped: 0,
    failed: 0,
    dryRun: false,
    uid: 'u-1',
    edition: 'workbuddy',
    templateKeys: 4,
    sealedPaths: 8,
    error: null,
  })
})

test('③ 归一:dry-run 判可写但未写 ⇒ applied=0 skipped=1,不得被读成"写过了"', () => {
  const n = S.normalizeSummary({
    ok: true,
    dryRun: true,
    uid: 'u-1',
    edition: 'workbuddy',
    templateKeys: 4,
    sealedPaths: 8,
    applied: false,
    error: 'dry-run 未写',
  })
  assert.equal(n.applied, 0)
  assert.equal(n.skipped, 1)
  assert.equal(n.dryRun, true)
})

test('④ 取不到可判定的 summary ⇒ null(由调用方落"未判定",绝不冒 0)', () => {
  assert.equal(S.normalizeSummary(null), null)
  assert.equal(S.normalizeSummary({ uid: 'u-1' }), null) // 缺 applied ⇒ 不是本腿的汇总行
  assert.equal(S.normalizeSummary({ applied: 'true' }), null) // 形态不符也不猜
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
