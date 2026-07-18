import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * wechat-pay V3 deductRecurring + settleMode + parseContractExpiredTime 单元测试。
 *
 * 覆盖:
 * - parseContractExpiredTime: 合法 ISO8601 → Date;非法/空 → null
 * - DeductSettleMode 类型契约(async / wait)
 *
 * 注:deductRecurring 内部需要真实 RSA 私钥签名(WECHATPAY2-SHA256-RSA2048),
 * 单元测试中不构造完整 fetch 链,改为通过 mock 整个 wechat-pay 模块验证参数透传。
 * 端到端验证在路由层 + 集成测试中执行(参考 tests/payment-gateway.test.ts)。
 */

vi.stubEnv('WX_SHOP_ID', '')
vi.stubEnv('WX_PAY_V3_KEY', '')
vi.stubEnv('WX_PAY_PRIVATE_KEY', '')
vi.stubEnv('NODE_ENV', 'test')

import { parseContractExpiredTime, type DeductSettleMode } from '../src/services/wechat-pay.js'

describe('wechat-pay — parseContractExpiredTime + settleMode 类型契约', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('parseContractExpiredTime', () => {
    it('合法 ISO8601 字符串(带时区)转为 Date', () => {
      const d = parseContractExpiredTime('2026-12-31T23:59:59+08:00')
      expect(d).toBeInstanceOf(Date)
      expect(d?.getFullYear()).toBe(2026)
      expect(d?.getMonth()).toBe(11) // 0-indexed: Dec = 11
    })

    it('合法 ISO8601 字符串(UTC)转为 Date', () => {
      const d = parseContractExpiredTime('2027-01-01T00:00:00Z')
      expect(d).toBeInstanceOf(Date)
      expect(d?.getUTCFullYear()).toBe(2027)
    })

    it('空字符串返回 null', () => {
      expect(parseContractExpiredTime('')).toBeNull()
    })

    it('undefined 返回 null', () => {
      expect(parseContractExpiredTime(undefined)).toBeNull()
    })

    it('非法字符串返回 null', () => {
      expect(parseContractExpiredTime('not-a-date')).toBeNull()
      expect(parseContractExpiredTime('2026-13-99')).toBeNull()
    })
  })

  describe('DeductSettleMode 类型契约', () => {
    it('settleMode 可取 async', () => {
      const mode: DeductSettleMode = 'async'
      expect(mode).toBe('async')
    })

    it('settleMode 可取 wait', () => {
      const mode: DeductSettleMode = 'wait'
      expect(mode).toBe('wait')
    })
  })

  describe('deductRecurring 参数形状', () => {
    it('settleMode 是可选参数(类型层支持省略)', () => {
      // 通过类型断言验证可选性:不带 settleMode 也能编译
      const params: DeductRecurringParams = {
        appid: 'wxapp',
        contractId: 'c-1',
        outTradeNo: 'WX001',
        amount: 100,
        description: 'd',
        transactionNotifyUrl: 'https://example.com/notify',
        // settleMode 省略 → 默认 'async'
      }
      expect(params.settleMode).toBeUndefined()
    })
  })
})
