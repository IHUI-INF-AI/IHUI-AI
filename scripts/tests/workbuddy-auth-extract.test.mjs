// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * workbuddy-auth-extract 的「一键切号」扩展面锁(2026-10-28 立):
 *   ① collectSealedPaths:点分 + 数组下标方括号的路径形状(与写回端 parseSealedPath 同语法)
 *   ② buildSessionTemplate:只剔两个凭证键,资料字段(含明文 nickname/phoneNumber)全保留
 *   ③ sealFieldForTest → decryptSessionTree 往返(合成密钥,离线,不碰进程/inspector)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as W } from '../lib/workbuddy-auth-extract.mjs'

test('① collectSealedPaths:点分 + accounts[0].nickname 方括号格式', () => {
  const raw = {
    auth: {
      uid: '42',
      tokenType: 'Bearer',
      accessToken: { $wbEncrypted: 1, envelope: 'A' },
      refreshToken: { $wbEncrypted: 1, envelope: 'B' },
    },
    account: {
      uid: '42',
      nickname: { $wbEncrypted: 1, envelope: 'N' },
      phoneNumber: '13800000000',
    },
    accounts: [
      { nickname: { $wbEncrypted: 1, envelope: 'a0n' }, phoneNumber: { $wbEncrypted: 1, envelope: 'a0p' } },
      { nickname: 'plain' },
    ],
    allAccounts: [{ nickname: { $wbEncrypted: 1, envelope: 'aa0n' } }, {}],
    sessionState: 0,
  }
  assert.deepEqual(W.collectSealedPaths(raw), [
    'auth.accessToken',
    'auth.refreshToken',
    'account.nickname',
    'accounts[0].nickname',
    'accounts[0].phoneNumber',
    'allAccounts[0].nickname',
  ])
  assert.deepEqual(W.collectSealedPaths(null), [])
  assert.deepEqual(W.collectSealedPaths('str'), [])
  assert.deepEqual(W.collectSealedPaths({}), [])
  // 追加出参复用不重复(默认 out 每次新建)
  const once = W.collectSealedPaths(raw)
  assert.equal(once.length, 6)
})

test('② buildSessionTemplate:剔凭证、留资料、不动原树;非对象返回 null', () => {
  const tree = {
    auth: { uid: '42', accessToken: 'tok', refreshToken: 'rt', expiresIn: 86400 },
    account: { uid: '42', nickname: 'tester', phoneNumber: '13800000000' },
    accounts: [{ nickname: 'tester' }],
  }
  const tpl = W.buildSessionTemplate(tree)
  assert.equal('accessToken' in tpl.auth, false, 'accessToken 必须剔除')
  assert.equal('refreshToken' in tpl.auth, false, 'refreshToken 必须剔除')
  assert.equal(tpl.auth.uid, '42')
  assert.equal(tpl.auth.expiresIn, 86400, '其余明文键一律保留')
  assert.equal(tpl.account.nickname, 'tester', 'nickname 明文值留在模板(入池后随 secretsEnc 加密)')
  assert.equal(tpl.account.phoneNumber, '13800000000')
  assert.deepEqual(tpl.accounts, [{ nickname: 'tester' }])
  assert.equal(tree.auth.accessToken, 'tok', '不得回头修改原树')
  tpl.account.nickname = 'mutated'
  assert.equal(tree.account.nickname, 'tester', '模板必须是深拷贝')
  assert.equal(W.buildSessionTemplate(null), null)
  assert.equal(W.buildSessionTemplate([]), null)
  assert.equal(W.buildSessionTemplate('s'), null)
  assert.equal(W.buildSessionTemplate(42), null)
  assert.deepEqual(W.buildSessionTemplate({ account: { uid: '1' } }), { account: { uid: '1' } })
})

test('②b WB_CREDENTIAL_PATHS 常量形状', () => {
  assert.deepEqual([...W.WB_CREDENTIAL_PATHS], ['auth.accessToken', 'auth.refreshToken'])
})

test('③ sealFieldForTest → decryptSessionTree 往返还原(合成密钥离线)', () => {
  const { key, keyId } = W.normalizeAtRestKey('synthetic-at-rest-secret')
  const sealed = {
    auth: {
      uid: '42',
      accessToken: W.sealFieldForTest('tok-1', key, keyId),
      refreshToken: W.sealFieldForTest('rt-1', key, keyId),
    },
    account: { uid: '42', nickname: W.sealFieldForTest('昵称-中文', key, keyId) },
    accounts: [{ phoneNumber: W.sealFieldForTest('13800000000', key, keyId) }],
  }
  // 密封面收集与写入的路径逐字对得上
  assert.deepEqual(W.collectSealedPaths(sealed), [
    'auth.accessToken',
    'auth.refreshToken',
    'account.nickname',
    'accounts[0].phoneNumber',
  ])
  const opened = W.decryptSessionTree(sealed, key, keyId)
  assert.equal(opened.auth.accessToken, 'tok-1')
  assert.equal(opened.auth.refreshToken, 'rt-1')
  assert.equal(opened.auth.uid, '42', '明文骨架不得被递归破坏')
  assert.equal(opened.account.nickname, '昵称-中文', 'UTF-8 往返无损')
  assert.equal(opened.accounts[0].phoneNumber, '13800000000')
  assert.equal(Array.isArray(opened.accounts), true, '数组形状必须保留')

  // 换一把密钥:keyId 对不上必须拒解(不能静默出乱码)
  const other = W.normalizeAtRestKey('another-secret')
  assert.throws(() => W.decryptSessionTree(sealed, other.key, other.keyId), (e) => e.code === 'key-mismatch')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
