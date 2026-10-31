// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// proxy.ts CSP 分发不变式回归锁(2026-10-31 随 dev-only 放宽同批立)
//
// proxy.ts 头注的铁律①:请求头与响应头必须写**同一条字符串**(Next 按请求头打 nonce
// 给自有 inline bootstrap 脚本,浏览器按响应头校验;两边不一致 ⇒ nonce 对不上 ⇒ 白屏)。
// 此前这条不变式只靠注释与"代码里就一个 csp 变量"口头保证,csp.ts 的分支改造一旦让
// 两侧取到不同串(例如有人"顺手"只放宽响应头),没有任何用例会红 —— 本文件补上这口牙。
//
// 同时钉一条现场形态:dev(NODE_ENV=development)+ HTML 路径 ⇒ **响应头**里带
// 'unsafe-eval'(2026-10-31 修的缺陷形态);production 同一请求 ⇒ 带 nonce 但不带
// 'unsafe-eval'(反向牙:放宽不外溢到生产)。
//
// next/server 用轻量 stub mock:NextResponse.next() 把 init.request.headers  stash
// 到实例上,供断言"请求头那份 CSP"与"响应头那份 CSP"逐字节相等。

import { describe, expect, it, vi } from 'vitest'

import type { NextRequest } from 'next/server'

interface NextResponseStubInstance {
  headers: Headers
  /** mock 层记录:proxy 传给 NextResponse.next() 的请求头(真实 Next 会把它转交下游) */
  __requestHeaders?: Headers
}

vi.mock('next/server', () => {
  class NextResponseStub {
    headers = new Headers()
    __requestHeaders?: Headers
    static next(init?: { request?: { headers?: Headers } }): NextResponseStub {
      const res = new NextResponseStub()
      res.__requestHeaders = init?.request?.headers
      return res
    }
    static redirect(url: URL | string, status?: number): NextResponseStub {
      const res = new NextResponseStub()
      res.headers.set('location', String(url))
      res.headers.set('x-stub-status', String(status ?? 307))
      return res
    }
  }
  return { NextResponse: NextResponseStub }
})

/** 以指定 NODE_ENV 加载 proxy.ts(模块顶层的 isDev 在加载时求值,必须 resetModules) */
async function loadProxy(env: string) {
  const saved = process.env.NODE_ENV
  vi.resetModules()
  process.env.NODE_ENV = env
  try {
    const mod = await import('../proxy')
    return mod.proxy
  } finally {
    if (saved === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = saved
  }
}

function fakeHtmlRequest(pathname: string): NextRequest {
  const headers = new Headers({ host: '127.0.0.1:8801' })
  return {
    nextUrl: { pathname, search: '', clone: () => ({}) },
    headers,
    cookies: { get: () => undefined },
  } as unknown as NextRequest
}

/**
 * 取出 script-src 指令整段。'unsafe-inline' 的"不得出现"断言**必须限定在 script-src**:
 * style-src 保留 'unsafe-inline' 是 csp.ts 头注里明确接受的残余风险(Next/Tailwind 运行时
 * <style> 依赖它),拿全串断言会把合法形态误判成缺陷。
 */
function scriptSrcOf(csp: string | null): string {
  if (csp === null) return ''
  return (
    csp
      .split(';')
      .map((s) => s.trim())
      .find((s) => s === 'script-src' || s.startsWith('script-src ')) ?? ''
  )
}

describe('proxy.ts CSP 分发不变式(铁律①:请求头==响应头同一条字符串)', () => {
  it("dev:HTML 路径放行响应,请求头与响应头的 CSP 逐字节相等,且都含 'unsafe-eval'", async () => {
    const proxy = await loadProxy('development')
    const res = (await proxy(fakeHtmlRequest('/login'))) as NextResponseStubInstance

    const resCsp = res.headers.get('content-security-policy')
    const reqCsp = res.__requestHeaders?.get('content-security-policy')
    expect(resCsp).not.toBeNull()
    expect(reqCsp).not.toBeNull()
    // 不变式本体:两边必须是同一条字符串
    expect(reqCsp).toBe(resCsp)
    // dev 形态:nonce 分支补上 unsafe-eval(响应头 = 浏览器实际执行的策略)
    const scriptSrc = scriptSrcOf(resCsp)
    expect(scriptSrc).toContain("'unsafe-eval'")
    expect(scriptSrc).toContain("'nonce-")
    expect(scriptSrc).toContain("'strict-dynamic'")
    expect(scriptSrc).not.toContain("'unsafe-inline'")
    // x-nonce 与 CSP 里内嵌的 nonce 必须同源一致(Next 打标依据)
    const xNonce = res.__requestHeaders?.get('x-nonce')
    expect(xNonce).toBeTruthy()
    expect(resCsp).toContain(`'nonce-${xNonce}'`)
  })

  it("production:同一路径响应头含 nonce 但不含 'unsafe-eval'(反向牙:放宽不外溢)", async () => {
    const proxy = await loadProxy('production')
    const res = (await proxy(fakeHtmlRequest('/login'))) as NextResponseStubInstance

    const resCsp = res.headers.get('content-security-policy')
    const reqCsp = res.__requestHeaders?.get('content-security-policy')
    expect(reqCsp).toBe(resCsp)
    const scriptSrc = scriptSrcOf(resCsp)
    expect(scriptSrc).toContain("'nonce-")
    expect(scriptSrc).not.toContain("'unsafe-eval'")
    expect(scriptSrc).not.toContain("'unsafe-inline'")
  })

  it('非 HTML 资产路径不发 nonce(既有豁免面不因本改动走形)', async () => {
    const proxy = await loadProxy('development')
    const res = (await proxy(
      fakeHtmlRequest('/_next/static/chunks/app.js'),
    )) as NextResponseStubInstance
    expect(res.headers.get('content-security-policy')).toBeNull()
    expect(res.__requestHeaders?.get('content-security-policy')).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
