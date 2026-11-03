// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:mobile-rn 发布链新增的两组判据(2026-11-03)。
 * 判据函数直接 import 源文件(§22c,不在测试里复制一份规则)。
 * 覆盖:debug 签名点名 / 指纹不一致 / 指纹一致 / 缺正式基线;
 *       体积阈值边界(严格大于 +15% / +30%)/ 未登记基线;门链顺序与取材面。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  judgeCert,
  judgeSize,
  DEBUG_CERT_SHA256,
  WARN_RATIO,
  FAIL_RATIO,
} from '../mobile-release-artifact-check.mjs'
import { planGates } from '../mobile-release-gate.mjs'

const RELEASE = '62b0ff0e950125230683aacfb5d0b110d93d30a229ca5df1950a572255b82514'

test('debug 证书签名 ⇒ 判死并点名 debug.keystore', () => {
  const v = judgeCert({ actual: DEBUG_CERT_SHA256, expected: RELEASE })
  assert.equal(v.ok, false)
  assert.match(v.problems.join('\n'), /debug/)
})

test('产物指纹 ≠ 正式 keystore 指纹 ⇒ 判死并给出两侧指纹', () => {
  const v = judgeCert({ actual: 'deadbeef', expected: RELEASE })
  assert.equal(v.ok, false)
  assert.match(v.problems.join('\n'), /不一致/)
})

test('指纹一致(大小写/冒号不敏感)⇒ 通过', () => {
  const upperColon = RELEASE.replace(/([0-9a-f]{2})/g, '$1:').slice(0, -1).toUpperCase()
  assert.deepEqual(judgeCert({ actual: upperColon, expected: RELEASE }), { ok: true, problems: [] })
})

test('取不到正式证书基线 ⇒ 不判绿', () => {
  const v = judgeCert({ actual: RELEASE, expected: null })
  assert.equal(v.ok, false)
})

test('体积:恰等于 +15% 仍算 ok(阈值是严格大于)', () => {
  const v = judgeSize({ bytes: 115, baseBytes: 100 })
  assert.equal(v.level, 'ok')
  assert.equal(WARN_RATIO, 0.15)
})

test('体积:超 +15% 告警,超 +30% 判红(恰好 +30% 仍是告警)', () => {
  assert.equal(judgeSize({ bytes: 116, baseBytes: 100 }).level, 'warn')
  assert.equal(judgeSize({ bytes: 130, baseBytes: 100 }).level, 'warn')
  assert.equal(judgeSize({ bytes: 131, baseBytes: 100 }).level, 'fail')
  assert.equal(FAIL_RATIO, 0.3)
})

test('体积:没有基线不算红,但也不冒充通过(no-baseline)', () => {
  assert.equal(judgeSize({ bytes: 100, baseBytes: undefined }).level, 'no-baseline')
})

test('门链顺序:typecheck → rn-tests → version-code → base-bake;worktree 面透传', () => {
  const gates = planGates({ face: 'worktree' })
  assert.deepEqual(
    gates.map((g) => g.id),
    ['typecheck', 'rn-tests', 'version-code', 'base-bake'],
  )
  assert.deepEqual(gates[2].args, ['scripts/check-mobile-version-code.mjs', '--worktree'])
  assert.deepEqual(gates[3].args, ['scripts/check-mobile-api-base-bake.mjs', '--worktree'])
  // CI 缺省 HEAD 面:不得偷偷带 --worktree
  assert.ok(!planGates().some((g) => g.args.includes('--worktree')))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
