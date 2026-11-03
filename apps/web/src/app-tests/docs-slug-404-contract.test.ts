// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * docs-slug-404-contract.test.ts — /docs 真 404 三层契约锁(2026-11-03 立)
 *
 * 钉三件事(§22c:判据一律 import 源模块,测试里零复算):
 *   ① page 档:missing ⇒ 抛 notFound();unknown ⇒ **不抛**且照常渲染 PageClient
 *      (后端一抖绝不能把整片文档打死);found ⇒ detail 原样透传。
 *   ② 代理档(判据源 = lib/docs-detail-gate):不存在的 slug ⇒ 404;后端故障 ⇒ 500;
 *      被判无权限(401/403)⇒ null 放行(判不出就不冒充任何结论);并证 proxy 真接了这道闸。
 *   ③ 静态段清单与 app/(main)/docs 目录树现读**双向**等价:漏登记 ⇒ 静态页被闸判成 404;
 *      残登记(目录已删而清单还留着)⇒ 该 slug 绕过探针,not-found 又被流式外壳吞成软 200。
 */
import { readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextRequest } from 'next/server'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const notFoundMock = vi.hoisted(() => {
  const fn = vi.fn(() => {
    throw new Error('__NOT_FOUND__')
  })
  return fn
})

vi.mock('next/navigation', () => ({ notFound: notFoundMock }))
// react cache 在纯 node 测试面没有请求作用域,直通成原函数(探针每用例要拿新鲜桩值)。
vi.mock('react', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>()
  return { ...mod, cache: (fn: unknown) => fn }
})
// 与 proxy-internal-prefix-block.test.ts 同款桩:/docs 不在鉴权射程,桩只为隔离真实验签。
const verifyAccessTokenEdge = vi.hoisted(() => vi.fn<(token: string) => Promise<unknown>>())
vi.mock('@/lib/auth-utils', () => ({ verifyAccessTokenEdge }))

// vi.mock 会被提升,路径必须是字面量(与 page.tsx 的 './PageClient' 解析到同一模块)。
vi.mock('../../app/(main)/docs/[slug]/PageClient', () => ({
  default: (props: unknown) => ({ __component: 'PageClient', props }),
}))

import {
  STATIC_DOC_SLUGS,
  docsDetailGateStatus,
  extractDocsDetailSlug,
} from '../lib/docs-detail-gate'
import DocsDetailPage, { generateMetadata } from '../../app/(main)/docs/[slug]/page'
import { proxy } from '../../proxy'

const MISSING_BODY = JSON.stringify({ code: 404, message: '文档不存在' })
const HIT_BODY = JSON.stringify({
  code: 0,
  message: 'success',
  data: { doc: { slug: 'intro', title: '入门', content: '# 入门' } },
})

/** 造 fetch 桩并记录被请求的 URL(判"探没探"就看这里)。 */
function stubFetch(handler: (url: string) => { status: number; body: string } | 'boom'): string[] {
  const seen: string[] = []
  vi.stubGlobal('fetch', async (input: unknown) => {
    const url = String(input)
    seen.push(url)
    const r = handler(url)
    if (r === 'boom') throw new Error('ECONNREFUSED')
    return new Response(r.body, {
      status: r.status,
      headers: { 'content-type': 'application/json' },
    })
  })
  return seen
}

beforeEach(() => {
  notFoundMock.mockClear()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

/** 返回值是未渲染的 JSX 元素:type 落在 PageClient(桩函数),props 携带 initialDetail */
type PageElement = { type: unknown; props?: { initialDetail?: unknown } }

describe('① page 档 notFound 判定', () => {
  it('missing ⇒ 抛 notFound', async () => {
    stubFetch(() => ({ status: 404, body: MISSING_BODY }))
    await expect(
      DocsDetailPage({ params: Promise.resolve({ slug: 'ghost-slug' }) }),
    ).rejects.toThrow('__NOT_FOUND__')
    expect(notFoundMock).toHaveBeenCalled()
  })

  it('unknown(后端不可达)⇒ 不抛,照常渲染 PageClient', async () => {
    stubFetch(() => 'boom')
    const el = (await DocsDetailPage({
      params: Promise.resolve({ slug: 'any-slug' }),
    })) as unknown as PageElement
    expect(notFoundMock).not.toHaveBeenCalled()
    expect(typeof el.type).toBe('function')
    expect(el.props?.initialDetail).toBeNull()
  })

  it('found ⇒ detail 原样透传给 PageClient', async () => {
    stubFetch(() => ({ status: 200, body: HIT_BODY }))
    const el = (await DocsDetailPage({
      params: Promise.resolve({ slug: 'intro' }),
    })) as unknown as PageElement
    expect(typeof el.type).toBe('function')
    expect((el.props?.initialDetail as { doc?: { title?: string } })?.doc?.title).toBe('入门')
  })

  it('missing 时 generateMetadata 不把 slug 写进标题(软 404 指纹不得回潮)', async () => {
    stubFetch(() => ({ status: 404, body: MISSING_BODY }))
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'ghost-slug' }) })
    expect(meta.title).toBeUndefined()
  })
})

describe('② 代理档:闸的三态与射程(判据源 docs-detail-gate)', () => {
  /** 与 proxy-internal-prefix-block.test.ts 同款最小桩,补 method 与 searchParams。 */
  function request(pathname: string, method = 'GET'): NextRequest {
    const url = new URL(`https://aizhs.top${pathname}`)
    return {
      method,
      headers: new Headers({ host: 'aizhs.top' }),
      nextUrl: Object.assign(url, { clone: () => new URL(url.href) }),
      cookies: { get: () => undefined },
    } as unknown as NextRequest
  }

  /** 装桩 → 跑闸 → 卸桩,只取闸给出的硬状态码(null = 放行 200)。 */
  async function gateStatusOf(
    handler: (url: string) => { status: number; body: string } | 'boom',
    pathname = '/docs/e2e-doc-slug-that-cannot-exist-zz9',
  ): Promise<404 | 500 | null> {
    stubFetch(handler)
    try {
      return await docsDetailGateStatus(pathname)
    } finally {
      vi.unstubAllGlobals()
    }
  }

  it('接线:整页导航到不存在的 slug ⇒ proxy 当场回 404(不等页面流式外壳)', async () => {
    const seen = stubFetch(() => ({ status: 404, body: MISSING_BODY }))
    const res = (await proxy(request('/docs/e2e-doc-slug-that-cannot-exist-zz9'))) as Response
    expect(res.status).toBe(404)
    expect(seen, '闸必须真的探过一次').toHaveLength(1)
  })

  it('四态不并桶:missing ⇒ 404;网络故障/5xx ⇒ 500;401/403 ⇒ null;found ⇒ null', async () => {
    expect(await gateStatusOf(() => ({ status: 404, body: MISSING_BODY }))).toBe(404)
    expect(await gateStatusOf(() => 'boom')).toBe(500)
    expect(await gateStatusOf(() => ({ status: 503, body: 'gateway down' }))).toBe(500)
    expect(await gateStatusOf(() => ({ status: 401, body: '{"code":401}' }))).toBeNull()
    expect(await gateStatusOf(() => ({ status: 403, body: '{"code":403}' }))).toBeNull()
    expect(await gateStatusOf(() => ({ status: 200, body: HIT_BODY }))).toBeNull()
  })

  it('HTTP 200 而信封 code 404 也算 missing —— 后端两种「没有」都得落到 404', async () => {
    expect(await gateStatusOf(() => ({ status: 200, body: '{"code":404}' }))).toBe(404)
  })

  it('静态段与索引页不进探测射程(fetch 一次都不被调)', async () => {
    const seen = stubFetch(() => ({ status: 404, body: MISSING_BODY }))
    for (const p of ['/docs', '/docs/rag', '/docs/manual/account', '/docs/agent', '/docs/api']) {
      expect(await docsDetailGateStatus(p), p).toBeNull()
    }
    expect(seen).toEqual([])
  })

  it('纯判据:只有单段 /docs/<x> 算详情;多段、非 docs、坏编码一律不猜', () => {
    expect(extractDocsDetailSlug('/docs/plain-ghost')).toBe('plain-ghost')
    expect(extractDocsDetailSlug('/docs/ghost/')).toBe('ghost')
    expect(extractDocsDetailSlug('/docs/manual/account')).toBeNull()
    expect(extractDocsDetailSlug('/docs/%E0%A4%A')).toBeNull()
    expect(extractDocsDetailSlug('/docs')).toBeNull()
    expect(extractDocsDetailSlug('/help/x')).toBeNull()
  })
})

describe('③ 静态段清单 ⇔ 目录树现读等价(双向)', () => {
  it('STATIC_DOC_SLUGS 与 app/(main)/docs 下含 page.tsx 的一级目录逐字节同集', () => {
    const docsRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../app/(main)/docs',
    )
    const onDisk = readdirSync(docsRoot)
      .filter((entry) => entry !== '[slug]')
      .filter((entry) => existsSync(path.join(docsRoot, entry, 'page.tsx')))
      .sort()
    expect([...STATIC_DOC_SLUGS].sort()).toEqual(onDisk)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
