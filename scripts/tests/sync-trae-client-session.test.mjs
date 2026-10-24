// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Trae 会话回灌编排器接线锁(2026-10-24 立)。
 * 判据 import 自生产脚本 `__test__`(§22c);真流程依赖本机 Trae 客户端与数据库,
 * 测试只锁纯函数与契约形状,不 spawn、不连库。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as S } from '../sync-trae-client-session.mjs'

test('① 参数面:--dry-run/--json 合法;未知参数 ⇒ 未判定;--help 走帮助', () => {
  assert.deepEqual(S.parseArgs(['--dry-run']).dryRun, true)
  assert.deepEqual(S.parseArgs(['--json']).json, true)
  assert.equal(S.parseArgs(['--bogus']).error, '未知参数: --bogus')
  assert.equal(S.parseArgs(['--help']).help, true)
})

test('② 载荷形状:providerCode=trae、accounts 只留 uid/token/refreshToken/expiresAt 四键', () => {
  const payload = S.buildPayload({
    providerCode: 'trae',
    accounts: [
      {
        uid: 'u1',
        token: 't',
        refreshToken: 'rt',
        expiresAt: '2026-11-07T00:00:00.000Z',
        refreshExpiresAt: '2027-04-21T00:00:00.000Z',
        extra: 'x',
      },
    ],
    meta: { uid: 'u1', tokenFingerprint: 'ab12' },
  })
  assert.deepEqual(
    Object.keys(payload.accounts[0]).sort(),
    ['expiresAt', 'refreshExpiresAt', 'refreshToken', 'token', 'uid'].sort(),
  )
  assert.equal(payload.providerCode, 'trae')
  assert.equal(payload.accounts[0].refreshToken, 'rt')
  assert.equal(payload.meta.tokenFingerprint, 'ab12')
})

test('③ 客户端无 refreshToken(web 号)⇒ 载荷不带该键,ts 端保留池内列', () => {
  const payload = S.buildPayload({
    accounts: [{ uid: 'u2', token: 't', refreshToken: '', extra: 1 }],
    meta: {},
  })
  assert.equal('refreshToken' in payload.accounts[0], false)
})

test('④ 空/畸形提取结果 ⇒ 载荷 accounts 为空数组而不是炸掉(未判定在 ts 端兜)', () => {
  assert.deepEqual(S.buildPayload(null).accounts, [])
  assert.deepEqual(S.buildPayload({ accounts: 'nope' }).accounts, [])
})

test('⑤ 载荷恒 providerCode=trae,且提取结果的 meta 原样透传', () => {
  const payload = S.buildPayload({
    accounts: [{ uid: 'u', token: 'SECRET' }],
    meta: { accessTokenLength: 6 },
  })
  assert.equal(payload.providerCode, 'trae')
  assert.equal(payload.meta.accessTokenLength, 6)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
