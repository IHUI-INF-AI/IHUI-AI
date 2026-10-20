// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'a'.repeat(64)
  process.env.REDIS_URL ??= 'redis://localhost:6379'
})

// ---------- db mock:createUsdtPayment 只在「校验失败抛错」与「插入订单」两处碰 db ----------
const { mockInsertValues, mockConfigRows } = vi.hoisted(() => ({
  mockInsertValues: vi.fn().mockResolvedValue(undefined),
  mockConfigRows: [] as Array<{ key: string; value: string }>,
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    insert: () => ({ values: mockInsertValues }),
  },
  dbRead: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(mockConfigRows),
      }),
    }),
  },
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    USDT_CONFIRM_TRC20_MIN: 1,
    USDT_CONFIRM_ERC20_MIN: 1,
  },
}))

const { isTronAddress, assertUsdtAddressFormat, createUsdtPayment } =
  await import('../src/services/payment-usdt-service.js')

/** 已上线的真实 TRC20 收款地址(前端 sponsor 页在用)—— 必须通过校验 */
const REAL_TRON = 'TMtTpPEMduWurHLi6Fe8XjfcP5Y5AMMnbG'
/** ERC20 形态样本:0x + 40 hex ——绝不能被 TRC20 正则误伤 */
const ERC20_SAMPLE = '0xdAC17F958D2ee523a2206206994597C13D831ec7'

const origTron = process.env.USDT_TRC20_ADDRESS
const origErc = process.env.USDT_ERC20_ADDRESS

afterEach(() => {
  if (origTron === undefined) delete process.env.USDT_TRC20_ADDRESS
  else process.env.USDT_TRC20_ADDRESS = origTron
  if (origErc === undefined) delete process.env.USDT_ERC20_ADDRESS
  else process.env.USDT_ERC20_ADDRESS = origErc
  vi.clearAllMocks()
})

/** 捕获抛出的错误(含 statusCode 自定义属性) */
function catchErr(fn: () => unknown): Error & { statusCode?: number } {
  try {
    fn()
  } catch (e) {
    return e as Error & { statusCode?: number }
  }
  throw new Error('expected to throw, but did not')
}

describe('TRC20 充值地址格式校验(isTronAddress)', () => {
  it('正例:已上线的真实波场地址必须通过', () => {
    expect(REAL_TRON.length).toBe(34)
    expect(isTronAddress(REAL_TRON)).toBe(true)
  })

  it('反例:长度不对(32/ 35 字符)', () => {
    expect(isTronAddress('T' + 'a'.repeat(31))).toBe(false) // 32
    expect(isTronAddress('T' + 'a'.repeat(34))).toBe(false) // 35
  })

  it('反例:非 T 开头', () => {
    expect(isTronAddress('M' + 'a'.repeat(33))).toBe(false)
    expect(isTronAddress('t' + 'a'.repeat(33))).toBe(false)
  })

  it('反例:含 Base58 排除字符 0 / O / I / l', () => {
    expect(isTronAddress('T0' + 'a'.repeat(32))).toBe(false)
    expect(isTronAddress('TO' + 'a'.repeat(32))).toBe(false)
    expect(isTronAddress('TI' + 'a'.repeat(32))).toBe(false)
    expect(isTronAddress('Tl' + 'a'.repeat(32))).toBe(false)
  })

  it('反例:空串 / 纯空白 / 复制带上的换行', () => {
    expect(isTronAddress('')).toBe(false)
    expect(isTronAddress('   ')).toBe(false)
    expect(isTronAddress(`\n${REAL_TRON}\n`)).toBe(false)
  })

  it('反例:ERC20 地址不通过 TRC20 正则(证明两条链路规则确实不同)', () => {
    expect(isTronAddress(ERC20_SAMPLE)).toBe(false)
  })
})

describe('assertUsdtAddressFormat — 400 语义与ERC20 放行', () => {
  it('TRC20 + 合法地址 ⇒ 不抛', () => {
    expect(() => assertUsdtAddressFormat('TRC20', REAL_TRON)).not.toThrow()
    expect(() => assertUsdtAddressFormat('trc20', REAL_TRON)).not.toThrow() // 大小写不敏感
  })

  it('TRC20 + 非法地址 ⇒ 抛 400 且不回显地址原文', () => {
    const bad = 'T0' + 'a'.repeat(32)
    const err = catchErr(() => assertUsdtAddressFormat('TRC20', bad))
    expect(err.statusCode).toBe(400)
    expect(err.message).not.toContain(bad)
    expect(err.message).not.toContain('T0aaaaaaaa')
  })

  it('ERC20 走自己的正则:真地址放行,非法值按 400 拒(不再"不归它管")', () => {
    // 2026-10-20 G-317-②(1d733b0fc4)给 ERC20 补了 0x+40hex 校验,本用例原前提
    // 「非 TRC20 不归它管」随之失效;姊妹用例 src/services/__tests__/usdt-address-format.test.ts:52
    // 同笔已改判,这一枚是漏改的那一份。原意仍保住:真 ERC20 地址不得被 TRC20 正则误拒。
    expect(() => assertUsdtAddressFormat('ERC20', ERC20_SAMPLE)).not.toThrow()
    const err = catchErr(() => assertUsdtAddressFormat('ERC20', 'not-an-address'))
    expect(err.statusCode).toBe(400)
    // 拒因必须点 ERC20 自己的规则,不是拿 TRC20 的正则去拒它
    expect(err.message).toContain('ERC20')
    expect(err.message).not.toContain('波场')
  })
})

describe('createUsdtPayment — 「未配置」500与「格式非法」400 是两条路径', () => {
  beforeEach(() => {
    mockConfigRows.length = 0
  })

  it('TRC20 未配置 env ⇒ 500,且不写库', async () => {
    delete process.env.USDT_TRC20_ADDRESS
    const err = await createUsdtPayment('u1', 1000, 'TRC20').catch(
      (e) =>
        e as Error & {
          statusCode?: number
        },
    )
    expect(err).toBeInstanceOf(Error)
    expect((err as { statusCode?: number }).statusCode).toBe(500)
    expect(err.message).toContain('未配置')
    expect(mockInsertValues).not.toHaveBeenCalled()
  })

  it('TRC20 配了但形态非法 ⇒ 400(区别于 500),不写库', async () => {
    process.env.USDT_TRC20_ADDRESS = 'T0' + 'a'.repeat(32)
    const err = await createUsdtPayment('u1', 1000, 'TRC20').catch(
      (e) =>
        e as Error & {
          statusCode?: number
        },
    )
    expect(err).toBeInstanceOf(Error)
    expect((err as { statusCode?: number }).statusCode).toBe(400)
    expect(err.message).not.toContain('T0aaaaaaaa')
    expect(mockInsertValues).not.toHaveBeenCalled()
  })

  it('TRC20 配了合法地址 ⇒ 放行并落库该地址', async () => {
    process.env.USDT_TRC20_ADDRESS = REAL_TRON
    const r = await createUsdtPayment('u1', 1000, 'TRC20')
    expect(r.address).toBe(REAL_TRON)
    expect(r.network).toBe('TRC20')
    expect(mockInsertValues).toHaveBeenCalledTimes(1)
    expect(mockInsertValues.mock.calls[0][0]).toMatchObject({
      address: REAL_TRON,
      network: 'TRC20',
      status: 'pending',
    })
  })

  it('ERC20 走同一创建路径但不被 TRC20 校验误拒', async () => {
    delete process.env.USDT_TRC20_ADDRESS
    process.env.USDT_ERC20_ADDRESS = ERC20_SAMPLE
    const r = await createUsdtPayment('u1', 1000, 'ERC20')
    expect(r.address).toBe(ERC20_SAMPLE)
    expect(r.network).toBe('ERC20')
    expect(mockInsertValues).toHaveBeenCalledTimes(1)
  })

  it('ERC20 未配置 ⇒ 仍是 500(两条网络路径对称)', async () => {
    delete process.env.USDT_ERC20_ADDRESS
    const err = await createUsdtPayment('u1', 1000, 'ERC20').catch(
      (e) => e as Error & { statusCode?: number },
    )
    expect(err).toBeInstanceOf(Error)
    expect((err as { statusCode?: number }).statusCode).toBe(500)
    expect(mockInsertValues).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
