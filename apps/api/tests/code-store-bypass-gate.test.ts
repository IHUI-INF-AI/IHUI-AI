// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 固定码后门双重门回归(2026-10-26 根治)。
 *
 * 生产 .env 的 NODE_ENV 实际是 development,旧判据"只认档位"等于把后门交给一行配置;
 * 库里的 test_verify_code_bypass 行也可能被重新激活。这里钉死两条:
 *  1. 档位成立但未显式写 SMS_TEST_BYPASS=true ⇒ **连表都不查**;
 *  2. 两门都成立才允许固定码通过;flag 只认字面量 true。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../src/config/index.js', () => ({
  config: {
    isDevelopmentRuntime: true,
    REDIS_URL: 'redis://127.0.0.1:1/1',
  },
}))
vi.mock('../src/db/index.js', () => ({ db: { execute: vi.fn() } }))

import { verifyCode, __test__ } from '../src/utils/code-store.js'
import { db } from '../src/db/index.js'

describe('code-store — 固定码后门双重门', () => {
  beforeEach(async () => {
    await __test__.reset()
    delete process.env.SMS_TEST_BYPASS
    vi.mocked(db.execute).mockReset()
  })

  afterEach(() => {
    delete process.env.SMS_TEST_BYPASS
  })

  it('development 档但未设 SMS_TEST_BYPASS ⇒ 短路,不查 bypass 表', async () => {
    vi.mocked(db.execute).mockResolvedValue([{ hit: 1 }] as never)
    expect(await verifyCode('13800000000', '123456')).toBe(false)
    expect(db.execute).not.toHaveBeenCalled()
  })

  it('两门同时成立 ⇒ 固定码通过', async () => {
    process.env.SMS_TEST_BYPASS = 'true'
    vi.mocked(db.execute).mockResolvedValue([{ hit: 1 }] as never)
    expect(await verifyCode('13800000000', '123456')).toBe(true)
    expect(db.execute).toHaveBeenCalledTimes(1)
  })

  it('flag 只认字面量 true("1"不算)⇒ 不查表', async () => {
    process.env.SMS_TEST_BYPASS = '1'
    vi.mocked(db.execute).mockResolvedValue([{ hit: 1 }] as never)
    expect(await verifyCode('13800000000', '123456')).toBe(false)
    expect(db.execute).not.toHaveBeenCalled()
  })
})
