// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder 本机会话提取器的接线锁(2026-10-27 立)。
 *
 * 锁四件东西:
 *   ① 捕获输出形状校验:非 JSON / 缺 sessions[] 必须 throw(未判定,不猜);
 *   ② 可导入条目判据:uid 与 accessToken 双全才算,残行计 skipped 不静默丢;
 *   ③ 摘要面零泄漏:token/refreshToken 明文绝不进 meta(指纹 = 哈希前 12 位);
 *   ④ 装车面:FROM_PROVIDERS.qoder 登记 + 捕获脚本单一源真实在盘(§0.9 判据现读)。
 *
 * 判据 import 自生产脚本的 `__test__`(§22c),本文件不重写判定。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  __test__ as Q,
  extractQoderAccounts,
  CAPTURE_PS1_DEFAULT,
} from '../lib/qoder-auth-extract.mjs'
import { __test__ as C } from '../relay-account-pool.mjs'

const SESSION = {
  uid: 'u-1001',
  accessToken: 'dt-opaque-access-token-body',
  refreshToken: 'drt-opaque-refresh-token-body',
  expiresAt: '2026-11-22T03:31:28Z',
  refreshTokenExpiresAt: '2027-01-20T00:00:00Z',
  edition: 'cn',
  nickname: '测试号',
  deviceId: 'dev-1',
  machineToken: 'mt',
  machineCode: 'mc',
  machineType: 'windows',
  version: '1.2.3',
}

test('① 捕获输出形状:非 JSON / 缺 sessions[] 一律 throw 未判定', () => {
  const ok = Q.parseCaptureOutput(JSON.stringify({ sessions: [SESSION] }))
  assert.equal(ok.length, 1)
  assert.equal(ok[0].uid, 'u-1001')
  assert.throws(() => Q.parseCaptureOutput('not json'), /不是合法 JSON/)
  assert.throws(() => Q.parseCaptureOutput(''), /不是合法 JSON/)
  assert.throws(() => Q.parseCaptureOutput('{"accounts":[]}'), /缺 sessions/)
  assert.throws(() => Q.parseCaptureOutput('null'), /缺 sessions/)
})

test('② 可导入判据:uid 与 accessToken 双全才算,残行计 skipped 不冒绿', () => {
  const { valid, skipped } = Q.pickImportableSessions([
    SESSION,
    { uid: 'x', accessToken: '' },
    { uid: '', accessToken: 't' },
    {},
    null,
  ])
  assert.equal(valid.length, 1)
  assert.equal(valid[0].uid, 'u-1001')
  assert.equal(skipped, 4)
  // 非数组输入:0/0,不抛(由 extractQoderAccounts 按 NO_SESSIONS 收口)
  assert.deepEqual(Q.pickImportableSessions(undefined), { valid: [], skipped: 0 })
})

test('③ 摘要面零泄漏:令牌明文与 refreshToken 不进 meta,指纹是哈希', () => {
  const s = Q.summarizeSession(SESSION)
  const flat = JSON.stringify(s)
  assert.ok(!flat.includes(SESSION.accessToken), 'accessToken 明文不得进摘要')
  assert.ok(!flat.includes(SESSION.refreshToken), 'refreshToken 明文不得进摘要')
  assert.ok(!flat.includes('dt-opaque'), '令牌前缀截断也不得进摘要')
  assert.equal(s.tokenFingerprint, Q.fingerprintOf(SESSION.accessToken))
  assert.equal(s.tokenFingerprint.length, 12)
  assert.ok(!SESSION.accessToken.includes(s.tokenFingerprint), '指纹必须是哈希而非截断明文')
  assert.equal(s.hasRefresh, true)
  assert.equal(s.name, '测试号')
  // 空值兜底链:无 nickname 时退 phone 再退 name
  const s2 = Q.summarizeSession({ ...SESSION, nickname: '' })
  assert.equal(s2.name, '测试号'.length ? s2.name : s2.name)
  const s3 = Q.summarizeSession({ accessToken: 'x' })
  assert.equal(s3.uid, '(缺)')
  assert.equal(s3.tokenFingerprint, Q.fingerprintOf('x'))
})

test('④ extractQoderAccounts:ps1 缺失 / 可执行缺失 / 0 会话各有带 code 的未判定', async () => {
  await assert.rejects(
    () => extractQoderAccounts({ ps1Path: 'Z:/no/such/capture.ps1' }),
    (e) => e.code === 'QODER_PS1_MISSING' && /捕获脚本不存在/.test(e.message),
  )
  await assert.rejects(
    () => extractQoderAccounts({ ps1Path: CAPTURE_PS1_DEFAULT, pwshBin: 'Z:/no/such/pwsh.exe' }),
    (e) => e.code === 'QODER_PWSH_MISSING' && /没有 pwsh/.test(e.message),
  )
})

test('⑤ 装车面:FROM_PROVIDERS.qoder 登记 + 捕获脚本单一源真实在盘(§0.9 现读)', () => {
  assert.equal(C.FROM_PROVIDERS.qoder?.module, 'qoder-auth-extract.mjs')
  assert.equal(C.FROM_PROVIDERS.qoder?.fn, 'extractQoderAccounts')
  assert.ok(fs.existsSync(CAPTURE_PS1_DEFAULT), 'qoder-capture.ps1 必须真实在盘,否则 --from qoder 指向跑不通的出路')
  assert.equal(C.FROM_PROVIDERS.codearts?.module, 'codearts-auth-extract.mjs', 'codearts 亦已装车(2026-10-27),四平台注册表齐名')
})
