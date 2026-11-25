// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 生产一致性判据锁。两类:状态机(纯函数)与清单真实性(读真实 git)。
 * 第二类存在的理由:清单写死在 lib 里,lib 改了而清单没跟上 ⇒ 哨兵"全绿"却漏掉新件。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  PROD_PARITY_FILES,
  PARITY_STATE,
  judgeParity,
  classifyDrift,
  remediationFor,
} from '../security/lib/prod-parity.mjs'
import { headBlobSha, prodBlobSha } from '../security/check-prod-parity.mjs'

const A = 'aaaa1111'
const B = 'bbbb2222'

test('全等 ⇒ ok,且逐件带状态', () => {
  const v = judgeParity([{ path: 'x.mjs', head: A, prod: A }, { path: 'y.mjs', head: B, prod: B }])
  assert.equal(v.state, PARITY_STATE.OK)
  assert.equal(v.drift.length, 0)
})

test('一件内容不同 ⇒ drift 并点名', () => {
  const v = judgeParity([{ path: 'x.mjs', head: A, prod: A }, { path: 'y.mjs', head: B, prod: A }])
  assert.equal(v.state, PARITY_STATE.DRIFT)
  assert.deepEqual(v.drift.map((r) => r.path), ['y.mjs'])
})

test('生产副本缺失 ⇒ drift(基准有、副本没有 = 服务跑的不是 HEAD)', () => {
  const v = judgeParity([{ path: 'x.mjs', head: A, prod: null }])
  assert.equal(v.state, PARITY_STATE.DRIFT)
  assert.deepEqual(classifyDrift(v.drift).missing, ['x.mjs'])
})

test('HEAD 取不到且无任何可判件 ⇒ undetermined(不记绿也不冒红)', () => {
  const v = judgeParity([{ path: 'x.mjs', head: null, prod: A }])
  assert.equal(v.state, PARITY_STATE.UNDETERMINED)
  assert.match(v.reason, /HEAD/)
})

test('已有确证漂移 + 另一件基准缺失 ⇒ 报 drift,不因未判定放过红', () => {
  const v = judgeParity([
    { path: 'x.mjs', head: null, prod: A },
    { path: 'y.mjs', head: B, prod: A },
  ])
  assert.equal(v.state, PARITY_STATE.DRIFT)
  assert.deepEqual(v.drift.map((r) => r.path), ['y.mjs'])
  assert.match(v.reason, /未判定/)
})

test('空清单 ⇒ undetermined(枚举到 0 个候选判死不记绿)', () => {
  for (const input of [[], null, undefined]) {
    const v = judgeParity(input)
    assert.equal(v.state, PARITY_STATE.UNDETERMINED)
  }
})

test('大小写不同的 sha 视为相等', () => {
  const v = judgeParity([{ path: 'x.mjs', head: 'AAAA1111', prod: 'aaaa1111' }])
  assert.equal(v.state, PARITY_STATE.OK)
})

test('classifyDrift 把缺失与不同分开', () => {
  const { missing, differing } = classifyDrift([
    { path: 'a.mjs', head: A, prod: null },
    { path: 'b.mjs', head: A, prod: B },
  ])
  assert.deepEqual(missing, ['a.mjs'])
  assert.deepEqual(differing, ['b.mjs'])
})

test('remediationFor 三态:ok 空串,drift 给唯一命令,undetermined 拒绝直接覆盖', () => {
  assert.equal(remediationFor(PARITY_STATE.OK), '')
  const drift = remediationFor(PARITY_STATE.DRIFT, [{ path: 'a.mjs', head: A, prod: null }])
  assert.match(drift, /sync-prod-parity\.mjs --apply/)
  assert.match(drift, /缺 1 件|备份\+覆盖/)
  const und = remediationFor(PARITY_STATE.UNDETERMINED)
  assert.match(und, /check-prod-parity\.mjs/)
})

test('清单里的每一件都真的在 HEAD 里(防清单腐烂)', () => {
  for (const rel of PROD_PARITY_FILES) {
    assert.ok(headBlobSha(rel), `HEAD 里不存在: ${rel}(清单腐烂或漏提交)`)
  }
})

test('router 在清单首位,且 normalize-input / body-sniff 已被覆盖', () => {
  assert.equal(PROD_PARITY_FILES[0], 'deploy/win/ihui-api-router.mjs')
  assert.ok(PROD_PARITY_FILES.includes('deploy/win/lib/normalize-input.mjs'))
  // 2026-11-25:router 新增对 body-sniff 的 import,清单漏登记 = 这件被换掉也报绿
  assert.ok(PROD_PARITY_FILES.includes('deploy/win/lib/body-sniff.mjs'))
})

test('取不到的文件返回 null 而不是抛', () => {
  assert.equal(headBlobSha('deploy/win/lib/__不存在__.mjs'), null)
  assert.equal(prodBlobSha('D:\\__不存在__\\x.mjs'), null)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
