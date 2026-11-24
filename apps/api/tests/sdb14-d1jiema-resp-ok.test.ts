// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-14 回归:平台 502/403/限流返回的 HTML/JSON 错误页不能当手机号/余额,
 * 查询类也不能把「请求失败」伪装成「确实没有记录」。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  D1jiemaError,
  getBalance,
  getPhone,
  queryUsedDetailed,
  getRelatedMsgs,
} from '../src/services/d1jiema-service.js'

vi.mock('../src/config/index.js', () => ({
  config: {
    D1JIEMA_TOKEN: 'test-token',
    D1JIEMA_ACCT: 'test-acct',
    D1JIEMA_PASSWORD: 'test-pwd',
  },
}))

interface ResponseInitLite {
  status?: number
  statusText?: string
  /** 传 null 表示不设置 Content-Type(模拟缺失响应头) */
  contentType?: string | null
}

function makeResponse(body: string, init: ResponseInitLite = {}): Response {
  const headers = new Headers()
  if (init.contentType !== null) {
    headers.set('content-type', init.contentType ?? 'text/plain; charset=utf-8')
  }
  return new Response(body, {
    status: init.status ?? 200,
    statusText: init.statusText ?? '',
    headers,
  })
}

const HTML_502 = '<html><body><h1>502 Bad Gateway</h1></body></html>'

describe('SDB-14 d1jiema 响应校验', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('① 502 HTML:getPhone 抛错且不返回错误页文本', async () => {
    fetchMock.mockResolvedValue(
      makeResponse(HTML_502, { status: 502, statusText: 'Bad Gateway', contentType: 'text/html' }),
    )
    const err = await getPhone({}).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(D1jiemaError)
    expect((err as Error).message).toContain('HTTP 502')
    expect((err as Error).message).not.toContain('<html')
  })

  it('① 502 HTML:getBalance 抛错且不返回错误页文本', async () => {
    fetchMock.mockResolvedValue(
      makeResponse(HTML_502, { status: 502, statusText: 'Bad Gateway', contentType: 'text/html' }),
    )
    const err = await getBalance().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(D1jiemaError)
    expect((err as Error).message).toContain('HTTP 502')
    expect((err as Error).message).not.toContain('<html')
  })

  it('② 200 但 Content-Type 为二进制:按非文本响应拒绝', async () => {
    fetchMock.mockResolvedValue(
      makeResponse('not-a-phone', { status: 200, contentType: 'image/png' }),
    )
    await expect(getPhone({})).rejects.toThrow('非文本响应')
  })

  it('② 200 HTML 错误页(文本类型):号码/余额形态校验兜底拒绝', async () => {
    // 每次调用都要给新的 Response:body 只能读一次
    fetchMock.mockImplementation(() =>
      makeResponse(HTML_502, { status: 200, contentType: 'text/html; charset=utf-8' }),
    )
    await expect(getPhone({})).rejects.toThrow('取号响应格式异常')
    await expect(getBalance()).rejects.toThrow('余额响应格式异常')
  })

  it('③ 200 合法号码/余额正常返回', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse('16512345678'))
    await expect(getPhone({})).resolves.toBe('16512345678')

    fetchMock.mockResolvedValueOnce(makeResponse('12.34'))
    await expect(getBalance()).resolves.toBe('12.34')

    // 整数余额同样合法(平台可能返回 0 或 100 这样的整数文本)
    fetchMock.mockResolvedValueOnce(makeResponse('0'))
    await expect(getBalance()).resolves.toBe('0')
  })

  it('④ 查询类 502:queryUsedDetailed 抛错而非静默空集', async () => {
    fetchMock.mockResolvedValue(
      makeResponse(HTML_502, { status: 502, statusText: 'Bad Gateway', contentType: 'text/html' }),
    )
    const err = await queryUsedDetailed().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(D1jiemaError)
    expect((err as Error).message).toContain('HTTP 502')
  })

  it('④ 查询类 502:getRelatedMsgs 抛错而非静默空集', async () => {
    fetchMock.mockResolvedValue(
      makeResponse(HTML_502, { status: 502, statusText: 'Bad Gateway', contentType: 'text/html' }),
    )
    const err = await getRelatedMsgs('16512345678').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(D1jiemaError)
    expect((err as Error).message).toContain('HTTP 502')
  })

  it('空响应才是「确实空集」:两个查询类返回 []', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(''))
    await expect(queryUsedDetailed()).resolves.toEqual([])

    fetchMock.mockResolvedValueOnce(makeResponse(''))
    await expect(getRelatedMsgs('16512345678')).resolves.toEqual([])
  })

  it('200 但内容无法解析:查询类抛错,不冒充「没有记录」', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse('系统繁忙,请稍后再试'))
    await expect(queryUsedDetailed()).rejects.toThrow('历史记录响应无法解析')

    fetchMock.mockResolvedValueOnce(makeResponse('系统繁忙,请稍后再试'))
    await expect(getRelatedMsgs('16512345678')).rejects.toThrow('热度查询响应无法解析')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
