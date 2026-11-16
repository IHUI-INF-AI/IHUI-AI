// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 契约测试: ZCode 3.17+ 二次加密 enc:v2 必须真解成明文,绝不把密文当令牌回灌。
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { decryptZcodeValue, deriveCipherKey, __test__ } from '../lib/zcode-auth-extract.mjs'

const { V2_PREFIX } = __test__

function sealV2(plaintext, key, source = 'env') {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const fp = crypto.createHash('sha256').update(key).digest('hex').slice(0, 24)
  const payload = [iv, cipher.getAuthTag(), ct].map((b) => b.toString('base64url')).join('.')
  return `${V2_PREFIX}${source}:${fp}:${payload}`
}

test('enc:v2:env 用托管密钥真解成明文', () => {
  const secret = 'zcode-v2-env-secret-for-contract-test-0123456789'
  const prev = process.env.ZCODE_CREDENTIAL_SECRET
  process.env.ZCODE_CREDENTIAL_SECRET = secret
  try {
    const key = crypto.createHash('sha256').update(secret).digest()
    const plain = 'eyJhbGciOi.test.payload'
    assert.equal(decryptZcodeValue(sealV2(plain, key)), plain)
  } finally {
    if (prev === undefined) delete process.env.ZCODE_CREDENTIAL_SECRET
    else process.env.ZCODE_CREDENTIAL_SECRET = prev
  }
})

test('enc:v1 旧口径仍可用传入密钥解出', () => {
  const key = deriveCipherKey(
    { ZCODE_CREDENTIAL_SECRET: 'legacy' },
    {
      platform: () => 'win32',
      homedir: () => 'C:\\Users\\tester',
      userInfo: () => ({ username: 'tester' }),
    },
  )
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update('legacy-token', 'utf8'), cipher.final()])
  const value = `enc:v1:${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ct.toString('base64url')}`
  assert.equal(decryptZcodeValue(value, key), 'legacy-token')
})

test('v2 指纹不匹配时抛未判定，绝不回传密文', () => {
  const prev = process.env.ZCODE_CREDENTIAL_SECRET
  delete process.env.ZCODE_CREDENTIAL_SECRET
  try {
    const wrongKey = crypto.randomBytes(32)
    const value = sealV2('secret-value', wrongKey, 'env')
    assert.throws(
      () => decryptZcodeValue(value),
      (e) => e?.code === 'ZCODE_CIPHER_KEY_UNAVAILABLE',
    )
  } finally {
    if (prev !== undefined) process.env.ZCODE_CREDENTIAL_SECRET = prev
  }
})

test('v2 密文格式非法显式报 MALFORMED', () => {
  assert.throws(
    () => decryptZcodeValue('enc:v2:os:not-a-fingerprint:aaa.bbb.ccc'),
    (e) => e?.code === 'ZCODE_CIPHER_MALFORMED',
  )
})
