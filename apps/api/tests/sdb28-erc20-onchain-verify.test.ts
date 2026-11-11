// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * SDB-28 夹具:ERC20 链上复核固定 `page=1&offset=100&sort=asc`,
 * 地址累计转入超过一页后新交易永远查不到、已付款订单永不入账。
 * 覆盖:
 * 1) 新交易落在第 2 页(按最新优先翻页)仍能命中;
 * 2) 翻页有上界,达到上界仍找不到 ⇒ 如实返回「未找到」而不是抛错/无限请求;
 * 3) HTTP 失败 / Etherscan 接口异常 ⇒ 归类为「链上取证失败」,不与「未找到」混淆;
 * 4) Etherscan 明确回「No transactions found」⇒ 才是真正的未找到。
 * 链上查询用全局 fetch 注入假响应(与 usdt-sdb27-28.test.ts 同一手法),不连节点/数据库。
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'a'.repeat(64)
  process.env.REDIS_URL ??= 'redis://localhost:6379'
})

const ERC_ADDR = '0x1111111111111111111111111111111111111111'
const TX_HASH = '0xNewPayment0000000000000000000000000000000000000000000000000000001'
const AMOUNT = 10.00025

vi.mock('../src/db/index.js', () => ({
  db: {
    insert: () => ({ values: vi.fn().mockResolvedValue(undefined) }),
    update: () => ({ set: () => ({ where: () => Promise.resolve(undefined) }) }),
  },
  dbRead: { select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }) },
}))

vi.mock('../src/config/index.js', () => ({
  config: { USDT_CONFIRM_TRC20_MIN: 1, USDT_CONFIRM_ERC20_MIN: 1 },
}))

const { verifyUsdtOnChain } = await import('../src/services/payment-usdt-service.js')

const mockFetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', mockFetch)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body }
}

function ercTx(hash: string, amount: number) {
  return {
    hash,
    value: String(Math.round(amount * 1e6)),
    to: ERC_ADDR,
    from: '0x2222222222222222222222222222222222222222',
    timeStamp: '1762000000',
    tokenDecimal: '6',
    blockNumber: '100',
  }
}

/** 一页 100 条与订单金额无关的转入(用于把目标交易挤到后一页) */
function fullPage(page: number) {
  return {
    status: '1',
    message: 'OK',
    result: Array.from({ length: 100 }, (_, i) => ercTx(`0xfiller${page}${String(i).padStart(4, '0')}`, 5)),
  }
}

/** 按 Etherscan URL 分发假响应:tokentx 分页走 pages,eth_blockNumber 单独给最新块高 */
function mockEtherscan(pages: Array<(page: number) => unknown>, latestBlock = '0x6a') {
  mockFetch.mockImplementation(async (input: unknown) => {
    const url = String(input)
    if (url.includes('module=proxy')) return jsonResponse({ result: latestBlock })
    const page = Number(new URL(url).searchParams.get('page'))
    const pick = pages[Math.min(page, pages.length) - 1]
    return pick ? jsonResponse(pick(page)) : jsonResponse({ status: '0', message: 'No transactions found', result: [] })
  })
}

describe('SDB-28 ERC20 链上复核', () => {
  it('新交易在第 2 页仍能命中:按 sort=desc 从第 1 页向后翻', async () => {
    const hit = ercTx(TX_HASH, AMOUNT)
    mockEtherscan([() => fullPage(1), () => ({ status: '1', message: 'OK', result: [hit] })])

    const r = await verifyUsdtOnChain('ERC20', TX_HASH, AMOUNT, ERC_ADDR)

    expect(r.verified).toBe(true)
    expect(r.amountOnChain).toBeCloseTo(AMOUNT, 6)
    expect(r.confirmations).toBe(7)
    const urls = mockFetch.mock.calls.map((c) => String(c[0]))
    const txPages = urls.filter((u) => u.includes('action=tokentx'))
    expect(txPages).toHaveLength(2)
    expect(txPages[0]).toContain('page=1')
    expect(txPages[1]).toContain('page=2')
    // 复核方向必须是最新优先,否则新交易永远落到后面的页
    expect(txPages.every((u) => u.includes('sort=desc'))).toBe(true)
  })

  it('翻页有上界:达到上界仍找不到 ⇒ 返回「未找到」,不抛错也不无限请求', async () => {
    mockEtherscan([(page) => fullPage(page)])
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const r = await verifyUsdtOnChain('ERC20', TX_HASH, AMOUNT, ERC_ADDR)

    expect(r.verified).toBe(false)
    expect(r.reason).toContain('未在平台地址转入记录中找到该交易')
    expect(r.reason).not.toContain('链上取证失败')
    // 上界为 10 页:翻满即停,不会对极热地址无限请求
    const txPages = mockFetch.mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.includes('action=tokentx'))
    expect(txPages).toHaveLength(10)
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('HTTP 失败 ⇒ 归类为链上取证失败,不与「未找到」混淆', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 502, json: async () => ({}) })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const r = await verifyUsdtOnChain('ERC20', TX_HASH, AMOUNT, ERC_ADDR)

    expect(r.verified).toBe(false)
    expect(r.reason).toContain('链上取证失败')
    expect(r.reason).not.toContain('未在平台地址转入记录中')
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('Etherscan 接口异常(status=NOTOK/限流)⇒ 同样算取证失败,不算未找到', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ status: '0', message: 'NOTOK', result: 'Max rate limit reached' }),
    )
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const r = await verifyUsdtOnChain('ERC20', TX_HASH, AMOUNT, ERC_ADDR)

    expect(r.verified).toBe(false)
    expect(r.reason).toContain('链上取证失败')
    expect(r.reason).not.toContain('未在平台地址转入记录中')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    warnSpy.mockRestore()
  })

  it('Etherscan 明确回「No transactions found」⇒ 真正的未找到(非接口错误)', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ status: '0', message: 'No transactions found', result: [] }),
    )

    const r = await verifyUsdtOnChain('ERC20', TX_HASH, AMOUNT, ERC_ADDR)

    expect(r.verified).toBe(false)
    expect(r.reason).toContain('未在平台地址转入记录中找到该交易')
    expect(r.reason).not.toContain('链上取证失败')
  })
})
