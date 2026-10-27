// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * utils/api-key-hash.ts 直接单测(2026-10-27,E2E 自动补测票补缺)。
 *
 * 此前该模块在集成测试里只被 vi.mock 掉(api-key-quota-enforcement /
 * api-key-security-fields / api-subscription-service 都把哈希函数 mock 成替身),
 * 自身行为零覆盖。本文件补真实断言:已知向量、确定性、往返、前缀识别、生成形态。
 */
import { createHash } from 'node:crypto'

import { describe, it, expect, vi } from 'vitest'

// 切断传递依赖导入链:internal-service-token.ts import db(⇒ @ihui/database ⇒ schema 桶),
// 而被测路径只经 crypto-extra.constantTimeCompare → secretsEqual。mock 给同形真实现(逐字相等),
// hashSecret/isHashed/generateApiKey/verifySecret 全部跑真代码,断言零造假。
vi.mock('../../plugins/internal-service-token.js', () => ({
  secretsEqual: (a: string, b: string) => a === b,
}))

import { generateApiKey, hashSecret, isHashed, verifySecret } from '../api-key-hash.js'

describe('hashSecret', () => {
  it('sha256 已知向量:与 node:crypto 直接计算逐字一致', () => {
    expect(hashSecret('abc')).toBe(
      'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
    expect(hashSecret('abc')).toBe(
      `sha256:${createHash('sha256').update('abc', 'utf8').digest('hex')}`,
    )
  })

  it('确定性:同一明文两次哈希逐字相等', () => {
    expect(hashSecret('sk_test')).toBe(hashSecret('sk_test'))
  })

  it('输出形态:sha256: 前缀 + 64 位小写 hex', () => {
    expect(hashSecret('x')).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  it('不同明文哈希不同', () => {
    expect(hashSecret('a')).not.toBe(hashSecret('b'))
  })
})

describe('isHashed', () => {
  it('hashSecret 输出判为已哈希;老明文判为未哈希', () => {
    expect(isHashed(hashSecret('v'))).toBe(true)
    expect(isHashed('sk_plaintext-legacy')).toBe(false)
  })

  it('sha256: 出现在串中间不算前缀命中', () => {
    expect(isHashed('prefix sha256: not-real')).toBe(false)
  })
})

describe('verifySecret', () => {
  it('哈希存储路径:正确 secret 通过,错误/带尾随空白的 secret 拒绝', () => {
    const stored = hashSecret('sk_live_value')
    expect(verifySecret('sk_live_value', stored)).toBe(true)
    expect(verifySecret('sk_live_value ', stored)).toBe(false)
    expect(verifySecret('sk_wrong', stored)).toBe(false)
  })

  it('老明文兼容路径:逐字相等通过,不等拒绝', () => {
    expect(verifySecret('sk_legacy_plain', 'sk_legacy_plain')).toBe(true)
    expect(verifySecret('sk_legacy_plain', 'sk_other')).toBe(false)
  })
})

describe('generateApiKey', () => {
  it('key 形态 ihui_ + 24 hex;secret 形态 sk_ + 32 hex(无横线 uuid)', () => {
    const { key, secret } = generateApiKey()
    expect(key).toMatch(/^ihui_[0-9a-f]{24}$/)
    expect(secret).toMatch(/^sk_[0-9a-f]{32}$/)
  })

  it('两次生成互不相同(CSPRNG 不重复)', () => {
    expect(generateApiKey().key).not.toBe(generateApiKey().key)
  })

  it('生成即可入库:verifySecret(secret, hashSecret(secret)) 为真(存储契约闭环)', () => {
    const { secret } = generateApiKey()
    expect(verifySecret(secret, hashSecret(secret))).toBe(true)
  })
})
