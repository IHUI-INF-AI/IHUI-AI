// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// docs-slug-probe.test.ts — /docs/[slug] 服务端存在性探针判据锁(2026-11-03 立)
//
// 钉住软 404 根治的那三态(§22c:判据一律 import 源模块,测试里零复算):
//   'missing' 才允许 notFound();'unknown' 绝不判 404(否则后端一抖就把整片文档页打死)。
import { describe, expect, it } from 'vitest'

import {
  DOC_PROBE_REVALIDATE_SECONDS,
  classifyDocResponse,
  docProbeHttpStatus,
  probeDocBySlug,
  serverApiOrigin,
} from '../lib/docs-slug-probe'
import {
  docsDetailGateStatus,
  extractDocsDetailSlug,
  isDocsGateDocumentRequest,
  renderDocsGateHtml,
} from '../lib/docs-detail-gate'

/** 造一枚 fetch 桩:固定状态码 + 文本体 */
function stubFetch(status: number, body: string): typeof fetch {
  return (async () =>
    new Response(body, { status, headers: { 'content-type': 'application/json' } })) as typeof fetch
}

const HIT_BODY = JSON.stringify({
  code: 0,
  message: 'success',
  data: {
    doc: {
      slug: 'intro',
      title: '入门',
      content: '# 入门',
      category: 'guide',
      updatedAt: '2026-11-03',
    },
  },
})

describe('classifyDocResponse 三态', () => {
  it('HTTP 404 ⇒ missing(实测后端形态 {code:404,message:"文档不存在"})', () => {
    expect(classifyDocResponse(404, { code: 404, message: '文档不存在' })).toBe('missing')
  })

  it('2xx + 信封带 doc ⇒ found', () => {
    expect(classifyDocResponse(200, JSON.parse(HIT_BODY))).toBe('found')
  })

  it('2xx + 成功信封却没有这篇 ⇒ missing', () => {
    expect(classifyDocResponse(200, { code: 0, message: 'success', data: {} })).toBe('missing')
  })

  it('反向牙:5xx / 401 一律不明说,不得冒充"不存在"(401 单列 unauthorized)', () => {
    expect(classifyDocResponse(500, null)).toBe('unknown')
    expect(classifyDocResponse(503, { code: 503, message: 'unavailable' })).toBe('unknown')
    expect(classifyDocResponse(401, { code: 401, message: 'unauthorized' })).toBe('unauthorized')
    expect(classifyDocResponse(403, { code: 403, message: 'forbidden' })).toBe('unauthorized')
    expect(classifyDocResponse(200, { code: 500, message: 'boom' })).toBe('unknown')
  })

  it('信封 code 404 写在 200 里也算 missing(网关改写状态码时不丢判据)', () => {
    expect(classifyDocResponse(200, { code: 404, message: '文档不存在' })).toBe('missing')
  })
})

describe('probeDocBySlug', () => {
  it('取到正文时把 detail 一起带回', async () => {
    const r = await probeDocBySlug('intro', { fetchImpl: stubFetch(200, HIT_BODY) })
    expect(r.state).toBe('found')
    expect(r.detail?.doc.title).toBe('入门')
  })

  it('不存在的 slug ⇒ missing,detail 为 null', async () => {
    const r = await probeDocBySlug('nope', {
      fetchImpl: stubFetch(404, JSON.stringify({ code: 404, message: '文档不存在' })),
    })
    expect(r.state).toBe('missing')
    expect(r.detail).toBeNull()
  })

  it('反向牙:后端不可达(fetch 抛错)⇒ unknown,结构上判不出 404', async () => {
    const boom = (async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch
    const r = await probeDocBySlug('intro', { fetchImpl: boom })
    expect(r.state).toBe('unknown')
    expect(r.detail).toBeNull()
  })

  it('反向牙:2xx 但响应体解析不出 ⇒ unknown(坏 JSON 不得读成"没有")', async () => {
    const r = await probeDocBySlug('intro', { fetchImpl: stubFetch(200, '<html>502</html>') })
    expect(r.state).toBe('unknown')
  })

  it('列表为空({"list":[]})这类整片空数据不等于按 slug 取不到 ⇒ 由 /api/docs 侧负责,本探针只认 data.doc', async () => {
    // /api/docs 现读回 {code:0,data:{list:[]}};把它喂给"按 slug"的判据应判 missing(这篇确实没有),
    // 而**不是**把空列表本身当成后端故障 —— 也不得反过来把 found 判出来。
    const r = await classifyDocResponse(200, { code: 0, data: { list: [] } })
    expect(r).toBe('missing')
  })

  it('slug 走 URL 编码,origin 可注入且缺省与 /api 代理同靶', async () => {
    const seen: string[] = []
    const spy = (async (input: unknown) => {
      seen.push(String(input))
      return new Response(HIT_BODY, { status: 200 })
    }) as unknown as typeof fetch
    await probeDocBySlug('a b/c', { fetchImpl: spy, origin: 'http://127.0.0.1:9' })
    expect(seen[0]).toBe('http://127.0.0.1:9/api/docs/a%20b%2Fc')
    expect(serverApiOrigin({})).toBe('http://127.0.0.1:8802')
    expect(serverApiOrigin({ IHUI_API_PROXY_TARGET: 'http://api.internal:8802' })).toBe(
      'http://api.internal:8802',
    )
  })

  it('后端 5xx ⇒ unknown(页面据此抛错回 500,不得被伪装成 404)', async () => {
    const r = await probeDocBySlug('intro', {
      fetchImpl: stubFetch(500, JSON.stringify({ code: 500, message: 'boom' })),
    })
    expect(r.state).toBe('unknown')
    expect(r.detail).toBeNull()
  })

  it('探针 fetch 必须可缓存(force-cache + revalidate):no-store 会把预渲染打成 DYNAMIC_SERVER_USAGE 500', async () => {
    let init: RequestInit | undefined
    const spy = (async (_input: unknown, options?: RequestInit) => {
      init = options
      return new Response(HIT_BODY, { status: 200 })
    }) as unknown as typeof fetch
    await probeDocBySlug('intro', { fetchImpl: spy })
    expect(init?.cache, '回退成 no-store 会复现 2026-11-03 生产 500').toBe('force-cache')
    expect((init as RequestInit & { next?: { revalidate?: number } })?.next?.revalidate).toBe(
      DOC_PROBE_REVALIDATE_SECONDS,
    )
  })

  it('Proxy 面(dataCache:false)不得带 Next 数据缓存参数:每次请求按当次答复判状态码', async () => {
    let init: RequestInit | undefined
    const spy = (async (_input: unknown, options?: RequestInit) => {
      init = options
      return new Response(HIT_BODY, { status: 200 })
    }) as unknown as typeof fetch
    await probeDocBySlug('intro', { fetchImpl: spy, dataCache: false })
    expect(init?.cache).toBeUndefined()
    expect((init as RequestInit & { next?: unknown })?.next).toBeUndefined()
  })
})

describe('docs-detail-gate 三个反向例(404 / 200 / 500 语义分开)', () => {
  it('不存在 slug ⇒ 404', async () => {
    const r = await docsDetailGateStatus('/docs/no-such-slug-zz9', {
      fetchImpl: stubFetch(404, JSON.stringify({ code: 404, message: '文档不存在' })),
    })
    expect(r).toBe(404)
  })

  it('真实 slug ⇒ null(放行,页面 200)', async () => {
    const r = await docsDetailGateStatus('/docs/intro', { fetchImpl: stubFetch(200, HIT_BODY) })
    expect(r).toBeNull()
  })

  it('反向牙:后端 5xx ⇒ 500(不得被伪装成 404)', async () => {
    const r = await docsDetailGateStatus('/docs/intro', {
      fetchImpl: stubFetch(500, JSON.stringify({ code: 500, message: 'boom' })),
    })
    expect(r).toBe(500)
  })

  it('鉴权面(401/403)⇒ null:判不出就不冒充 404,也不冒充 500', async () => {
    const r = await docsDetailGateStatus('/docs/intro', {
      fetchImpl: stubFetch(401, JSON.stringify({ code: 401, message: 'unauthorized' })),
    })
    expect(r).toBeNull()
    expect(docProbeHttpStatus('unauthorized')).toBeNull()
  })

  it('硬码响应体:404 与 500 文案互不冒充,自带 noindex', () => {
    const h404 = renderDocsGateHtml(404)
    const h500 = renderDocsGateHtml(500)
    expect(h404.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(h404).toContain('文档不存在')
    expect(h404).not.toContain('服务暂时不可用')
    expect(h500).toContain('文档服务暂时不可用')
    expect(h500).not.toContain('404')
    expect(h404).toContain('noindex')
    expect(h500).toContain('noindex')
  })

  it('RSC 取数请求不落硬码(Proxy 不能往 RSC 通道塞 HTML),文档请求落码', () => {
    expect(isDocsGateDocumentRequest(new Headers({ rsc: '1' }))).toBe(false)
    expect(isDocsGateDocumentRequest(new Headers({ accept: 'text/x-component' }))).toBe(false)
    expect(
      isDocsGateDocumentRequest(new Headers({ accept: 'text/html,application/xhtml+xml' })),
    ).toBe(true)
    expect(isDocsGateDocumentRequest(new Headers({ 'sec-fetch-dest': 'document' }))).toBe(true)
    expect(isDocsGateDocumentRequest(new Headers({ accept: '*/*' }))).toBe(true)
  })

  it('只认文档详情单段路径:静态文档页 / 索引 / 多段路径一律不探针', () => {
    expect(extractDocsDetailSlug('/docs/no-such-slug')).toBe('no-such-slug')
    expect(extractDocsDetailSlug('/docs/no-such-slug/')).toBe('no-such-slug')
    expect(extractDocsDetailSlug('/docs/quickstart')).toBeNull()
    expect(extractDocsDetailSlug('/docs/manual')).toBeNull()
    expect(extractDocsDetailSlug('/docs/manual/faq')).toBeNull()
    expect(extractDocsDetailSlug('/docs')).toBeNull()
    expect(extractDocsDetailSlug('/blog/no-such-slug')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
