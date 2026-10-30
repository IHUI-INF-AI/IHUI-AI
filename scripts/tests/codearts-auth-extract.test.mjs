// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CodeArts 本机会话提取器的接线锁(2026-10-27 立)。
 *
 * 锁五件东西:
 *   ① v10 密文形状锁:'v10'+nonce12+tag16 的 GCM 往返(改一字节 ⇒ 解密必须失败);
 *   ② Local State 形状锁:缺 os_crypt 键 / 缺 DPAPI 前缀必须 throw 未判定;
 *   ③ 摘要面零泄漏:securitytoken/AK/SK 明文绝不进 meta,AK/SK/DPoP/PKCE 只报有无布尔;
 *   ④ 可导入判据:token+AK+SK 三全才算,残行计 skipped 不冒绿;
 *   ⑤ 装车面:FROM_PROVIDERS.codearts 登记 + 秘密行键逐字锁定(取证凭据,改版本须重取证)。
 *
 * 真 DPAPI 链路与真机全链(--from codearts --dry-run)已于 2026-10-27 本机实证;
 * 本文件不重复跑 DPAPI(依赖登录用户上下文),只锁形状与纯判据。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { __test__ as Q, extractCodeartsAccounts } from '../lib/codearts-auth-extract.mjs'
import { __test__ as C } from '../relay-account-pool.mjs'

const SESSION = {
  account: { id: 'bb1438ff2b5d4ba8b1a6b58f6e35c1bb', label: '测试华为云号' },
  accessToken: 'hc-iam-access-token-body',
  accessKey: 'HZAK-test-access-key-id',
  secretKey: 'hzsk-test-secret-access-key',
  securitytoken: 'hc-sts-security-token-body',
  refresh_token: 'hc-refresh-token-body',
  expires_at: '2026-10-11T03:52:20.674Z',
  domainId: 'dom-1',
  loginContext: {
    pkcePair: { codeVerifier: 'pkce-verifier', codeChallenge: 'c', codeChallengeMethod: 'S256' },
    dpopKeyPair: { privateKeyJwk: { kty: 'EC', x: 'x', y: 'y', crv: 'P-256', d: 'd' }, publicKeyJwk: {} },
  },
}

/** 用与生产同款形状现场造一枚 v10 密文(对称验证解密判据)。 */
function sealForTest(obj, key) {
  const nonce = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', key, nonce)
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()])
  return Buffer.concat([Buffer.from('v10', 'ascii'), nonce, ct, c.getAuthTag()])
}

test('① v10 密文形状锁:同形状密文解回原对象;密文被改/非 v10 必须失败', () => {
  const key = crypto.randomBytes(32)
  const blob = sealForTest(SESSION, key)
  const out = Q.decryptSafeStorageBlob(blob, key)
  assert.equal(out.securitytoken, SESSION.securitytoken)
  assert.equal(out.loginContext.dpopKeyPair.privateKeyJwk.kty, 'EC')
  // 密文翻一位 ⇒ GCM 校验必须炸(不许静默出垃圾)
  const tampered = Buffer.from(blob)
  tampered[20] ^= 0xff
  assert.throws(() => Q.decryptSafeStorageBlob(tampered, key))
  // 非 v10 前缀 / 过短 blob ⇒ 未判定 throw
  assert.throws(() => Q.decryptSafeStorageBlob(Buffer.from('0102'), key), /非 v10/)
  assert.throws(() => Q.decryptSafeStorageBlob(Buffer.from('v10'), key), /非 v10/)
})

test('② Local State 形状锁:缺 os_crypt 键 / 缺 DPAPI 前缀必须 throw 未判定', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'codearts-extract-'))
  try {
    const bad1 = path.join(scratch, 'ls1.json')
    fs.writeFileSync(bad1, JSON.stringify({ os_crypt: {} }))
    assert.throws(() => Q.readAesKeyFromLocalState(bad1), /encrypted_key/)
    const bad2 = path.join(scratch, 'ls2.json')
    fs.writeFileSync(
      bad2,
      JSON.stringify({ os_crypt: { encrypted_key: Buffer.from('NOTDP').toString('base64') } }),
    )
    assert.throws(() => Q.readAesKeyFromLocalState(bad2), /DPAPI/)
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true })
  }
})

test('③ 摘要面零泄漏:STS/AK/SK/refresh 明文不进 meta,完备性只报布尔', () => {
  const s = Q.summarizeSession(SESSION)
  const flat = JSON.stringify(s)
  for (const secret of [
    SESSION.securitytoken,
    SESSION.accessKey,
    SESSION.secretKey,
    SESSION.refresh_token,
    'hc-sts',
  ]) {
    assert.ok(!flat.includes(secret), `凭据明文片段不得进摘要: ${secret.slice(0, 6)}…`)
  }
  assert.equal(s.tokenFingerprint.length, 12)
  assert.equal(s.hasAkSk, true)
  assert.equal(s.hasDpopJwk, true)
  assert.equal(s.hasCodeVerifier, true)
  assert.equal(s.hasRefresh, true)
  assert.equal(s.uid, SESSION.account.id)
  assert.equal(s.name, SESSION.account.label)
  // 残行兜底:无 account 时 uid/name 落占位,不炸
  const s2 = Q.summarizeSession({ securitytoken: 'x' })
  assert.equal(s2.uid, '(缺)')
  assert.equal(s2.hasAkSk, false)
})

test('④ 可导入判据:token+AK+SK 三全才算,残行计 skipped', () => {
  const { valid, skipped } = Q.pickImportableSessions([
    SESSION,
    { ...SESSION, secretKey: '' },
    { ...SESSION, accessKey: undefined },
    { ...SESSION, securitytoken: '' },
  ])
  assert.equal(valid.length, 1)
  assert.equal(skipped, 3)
})

test('⑤ 装车面:FROM_PROVIDERS.codearts 登记 + 秘密行键逐字锁定(取证凭据)', async () => {
  assert.equal(C.FROM_PROVIDERS.codearts?.module, 'codearts-auth-extract.mjs')
  assert.equal(C.FROM_PROVIDERS.codearts?.fn, 'extractCodeartsAccounts')
  assert.equal(
    Q.SECRET_KEY_PREFIX,
    'secret://{"extensionId":"huaweicloud.authentication"',
    '秘密行键前缀 = 2026-10-27 取证结论;华为改键名 ⇒ 本条先红,重取证后才许改',
  )
  // 未登录态(临时空目录当 roaming):须落未判定而不是静默空
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'codearts-empty-'))
  try {
    await assert.rejects(
      () => extractCodeartsAccounts({ roamingDir: empty }),
      (e) => typeof e.code === 'string' && e.code.startsWith('CODEARTS_'),
    )
  } finally {
    fs.rmSync(empty, { recursive: true, force: true })
  }
})
