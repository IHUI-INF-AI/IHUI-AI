// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 台账号 G-651 —— 公开资产出站统一出口(public-asset-fetch)「四件套」回归测试。
//
// 票面:出站抓取「无需登录的外部公开资产」(如 ai-feed 图片代理)必须走 fetchPublicAsset
// 统一出口,四件套 =
//   ① credentials:'omit' —— 公开资产不带凭据/cookie 出站;
//   ② redirect:'error' —— 禁跟随重定向(防白名单校验后被重定向换成内网/任意地址);
//   ③ 流式字节上限 —— content-length 预检超限 stage:'limit'(一个字节不读),
//     流式累计超 maxBytes 中止 stage:'size'(替代整包 arrayBuffer() 无上限读入);
//   ④ 错误归一 —— 失败只回 { stage, reason },不抛异构异常。
// formatPublicAssetFailure 把归一失败转业务 message 并附 (x-request-id:…) 供对账,
// requestId 上游透传优先、缺省自动生成 UUID。
// 用 fetchImpl 注入捕获 init 断言;纯单元,不发网络请求、不连库(§5 测试隔离铁律)。
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PUBLIC_ASSET_TIMEOUT_MS,
  fetchPublicAsset,
  formatPublicAssetFailure,
  type PublicAssetFailure,
  type PublicAssetResult,
} from '../src/utils/public-asset-fetch.js'

const asFetch = (fn: (input: string | URL | Request, init?: RequestInit) => Promise<Response>) =>
  fn as unknown as typeof fetch

const URL_OK = 'https://img.aizhs.top/pic.png'

/** 2xx 响应桩:可控 headers 与 body(未给 body 即 null,走出口「空 body」分支)。 */
function make2xxResponse(opts: {
  headers?: Record<string, string>
  body?: ReadableStream<Uint8Array> | object | null
}): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: (k: string) => opts.headers?.[k.toLowerCase()] ?? null },
    body: opts.body ?? null,
  } as unknown as Response
}

/** 把字节块编成 ReadableStream(模拟上游分块吐 body)。 */
function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
  })
}

describe('G-651:fetchPublicAsset 四件套', () => {
  it('① credentials:\'omit\' 与 redirect:\'error\' 必须随请求发出(init 逐字钉死)', async () => {
    const seen: Array<{ url: string; init?: RequestInit }> = []
    const fetchImpl = asFetch(async (input, init) => {
      seen.push({ url: String(input), init })
      return make2xxResponse({})
    })

    const result = await fetchPublicAsset({ url: URL_OK, maxBytes: 1024, fetchImpl })

    expect(result.ok).toBe(true)
    expect(seen).toHaveLength(1)
    expect(seen[0]!.url).toBe(URL_OK)
    // 四件套之一/之二:公开资产不带凭据 + 禁跟随重定向(字面量按验收 grep 形态)。
    expect(seen[0]!.init?.credentials).toBe('omit')
    expect(seen[0]!.init?.redirect).toBe('error')
    expect(seen[0]!.init?.method).toBe('GET')
    expect(seen[0]!.init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('② content-length 预检超上限 ⇒ stage:\'limit\',一个字节都不读(不进 reader)', async () => {
    let readerCalls = 0
    const body = {
      cancel: async () => {},
      getReader() {
        readerCalls += 1
        return { read: async () => ({ done: true, value: undefined }), cancel: async () => {} }
      },
    }
    const fetchImpl = asFetch(async () =>
      make2xxResponse({
        headers: { 'content-type': 'image/png', 'content-length': String(1025) },
        body,
      }),
    )

    const result: PublicAssetResult = await fetchPublicAsset({
      url: URL_OK,
      maxBytes: 1024,
      fetchImpl,
    })

    expect(result).toMatchObject({ ok: false, stage: 'limit', reason: 'content_length_over_limit' })
    expect(readerCalls).toBe(0)
  })

  it('③ 流式累计字节数超 maxBytes ⇒ 立即中止,回 stage:\'size\'', async () => {
    const fetchImpl = asFetch(async () =>
      make2xxResponse({
        headers: { 'content-type': 'image/png' },
        body: streamOf([new Uint8Array(600), new Uint8Array(600)]), // 1200 > 1024
      }),
    )

    const result = await fetchPublicAsset({ url: URL_OK, maxBytes: 1024, fetchImpl })

    expect(result).toMatchObject({ ok: false, stage: 'size', reason: 'body_over_limit' })
  })

  it('④ 上限内流式读完 ⇒ ok:true、字节齐全、content-type 透传', async () => {
    const fetchImpl = asFetch(async () =>
      make2xxResponse({
        headers: { 'content-type': 'image/png' },
        body: streamOf([new Uint8Array([1, 2, 3]), new Uint8Array([4])]),
      }),
    )

    const result = await fetchPublicAsset({ url: URL_OK, maxBytes: 1024, fetchImpl })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(Array.from(result.bytes)).toEqual([1, 2, 3, 4])
      expect(result.contentType).toBe('image/png')
    }
  })

  it('⑤ 缺省 timeoutMs 与 ai-feed FETCH_TIMEOUT_MS 语义对齐(20s)', () => {
    expect(DEFAULT_PUBLIC_ASSET_TIMEOUT_MS).toBe(20_000)
  })
})

describe('G-651:错误归一(不抛异构异常)', () => {
  it('⑥ 传输层抛错(网络错误)⇒ {ok:false, stage:\'fetch\', reason:\'network_error\'}', async () => {
    const fetchImpl = asFetch(async () => {
      throw new Error('ECONNRESET')
    })

    const result = await fetchPublicAsset({ url: URL_OK, maxBytes: 1024, fetchImpl })

    expect(result).toMatchObject({ ok: false, stage: 'fetch', reason: 'network_error' })
  })

  it('⑦ 非 2xx ⇒ stage:\'status\' 且 reason=http_503 形态', async () => {
    const fetchImpl = asFetch(async () =>
      ({
        ok: false,
        status: 503,
        headers: { get: () => null },
        body: null,
      }) as unknown as Response,
    )

    const result = await fetchPublicAsset({ url: URL_OK, maxBytes: 1024, fetchImpl })

    expect(result).toMatchObject({ ok: false, stage: 'status', reason: 'http_503' })
  })

  it('⑧ 响应体读中途出错 ⇒ stage:\'stream\',同样归一不抛', async () => {
    const body = {
      cancel: async () => {},
      getReader() {
        return {
          read: async () => {
            throw new Error('stream broken')
          },
          cancel: async () => {},
        }
      },
    }
    const fetchImpl = asFetch(async () =>
      make2xxResponse({ headers: { 'content-type': 'image/png' }, body }),
    )

    const result = await fetchPublicAsset({ url: URL_OK, maxBytes: 1024, fetchImpl })

    expect(result).toMatchObject({ ok: false, stage: 'stream', reason: 'read_error' })
  })
})

describe('G-651:formatPublicAssetFailure 对账 message 与 requestId', () => {
  const failure: PublicAssetFailure = {
    ok: false,
    stage: 'status',
    reason: 'http_503',
    requestId: 'req-abc-123',
  }

  it('⑨ message 附 (x-request-id:…) 与 stage/reason', () => {
    const msg = formatPublicAssetFailure(failure, '图片获取失败')
    expect(msg).toContain('图片获取失败')
    // 出口既定形态:x-request-id 与 stage/reason 同在括号内。
    expect(msg).toContain('(stage:status, reason:http_503, x-request-id:req-abc-123)')
    expect(msg).toContain('x-request-id:req-abc-123')
  })

  it('⑩ requestId:透传优先,缺省/空白自动生成 UUID', async () => {
    const fetchImpl = asFetch(async () => make2xxResponse({}))

    // 上游透传:原样带回。
    const passed = await fetchPublicAsset({
      url: URL_OK,
      maxBytes: 1024,
      requestId: 'req-fixed-42',
      fetchImpl,
    })
    expect(passed.ok).toBe(true)
    if (passed.ok) expect(passed.requestId).toBe('req-fixed-42')

    // 缺省:自动生成 UUID 形态(且不与透传值混淆)。
    const auto = await fetchPublicAsset({ url: URL_OK, maxBytes: 1024, fetchImpl })
    expect(auto.ok).toBe(true)
    if (auto.ok) {
      expect(auto.requestId).not.toBe('req-fixed-42')
      expect(auto.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
    }

    // 空白串视同缺省:仍走自动生成(出口 trim 判空)。
    const blank = await fetchPublicAsset({
      url: URL_OK,
      maxBytes: 1024,
      requestId: '   ',
      fetchImpl,
    })
    expect(blank.ok).toBe(true)
    if (blank.ok) {
      expect(blank.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
    }
  })

  it('⑪ 归一失败携带的 requestId 能被 formatPublicAssetFailure 带进对账 message', async () => {
    const fetchImpl = asFetch(async () => {
      throw new Error('ECONNRESET')
    })
    const result = await fetchPublicAsset({ url: URL_OK, maxBytes: 1024, fetchImpl })

    expect(result.ok).toBe(false)
    if (result.ok) return // 不可达,仅供 TS 收窄
    const msg = formatPublicAssetFailure(result, '图片获取失败')
    expect(msg).toContain(`x-request-id:${result.requestId}`)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
