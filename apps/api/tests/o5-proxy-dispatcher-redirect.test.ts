// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-736(2026-09-27):出站**有界重定向 + 跨 origin 剥自定义头 + 响应字节上限**的回归钉。
//
// 机制出处:上游 ZCode v3.14.3 `marketplace.ts:447-494`(剥头注记在 :476-480)。改造前
// `apps/api/src/utils/proxy-dispatcher.ts` 把重定向整个交给 undici 的 `redirect:'follow'`,
// 自定义头(`Authorization`、厂商 key header、调用方塞的任何头)**逐跳原样带过去** ——
// 于是"厂商域 302 到第三方 CDN"这一链上,凭据是我们自己的出口主动送出去的。
//
// 夹具口径(§22c:判"形态"的判据,输入必须逐字取自真实形态,不得只复刻实现形状):
// 假传输层收到的 `init` 就是生产 `boundedEgressFetch` 循环里逐跳发出去的那一份,
// 所以这里断言的是**生产判据的逐跳结果**,不是测试自己 reimplement 的规则。
// 全程不连库、不连 Redis、不发真实网络请求(§5 测试隔离铁律);注入的 PROXY_URL 指向保留
// 测试端口 59999,且 proxiedFetch 的每一处都传假 transport ⇒ 不会真的建立连接。

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  boundedEgressFetch,
  crossesEgressOrigin,
  directEgressFetch,
  EGRESS_MAX_REDIRECTS,
  EgressLimitError,
  proxiedFetch,
  readEgressFacts,
  type EgressRequestInit,
  type EgressTransport,
} from '../src/utils/proxy-dispatcher.js'

/** 测试涉及的 env 逐条存取,不得盲删(宿主 shell / .env.test 都可能已带值)。*/
const MANAGED_VARS = ['PROXY_URL', 'PROXY_DOMAINS'] as const
let saved: Record<string, string | undefined> = {}

beforeEach(() => {
  saved = {}
  for (const name of MANAGED_VARS) {
    saved[name] = process.env[name]
    delete process.env[name]
  }
})

afterEach(() => {
  for (const name of MANAGED_VARS) {
    if (saved[name] === undefined) delete process.env[name]
    else process.env[name] = saved[name]
  }
})

const VENDOR = 'https://api.vendor.test/v1/thing'
const SAME_ORIGIN_NEXT = 'https://api.vendor.test/v1/thing2'
const CROSS_ORIGIN_NEXT = 'https://cdn.third-party-cdn.test/pull'

const CUSTOM_HEADERS: Record<string, string> = {
  Authorization: 'Bearer sk-secret-vendor-key',
  'x-goog-api-key': 'vendor-key-header',
  'X-Trace-Id': 'trace-1',
}

/** 逐跳记录:断言"第 N 跳到底带了什么头"只能把每一跳的 init 取出来看。*/
interface RecordedCall {
  url: string
  init: EgressRequestInit
}

function makeTransport(
  route: (url: string, callIndex: number) => Response,
): { transport: EgressTransport; calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  const transport: EgressTransport = async (url, init) => {
    calls.push({ url, init })
    return route(url, calls.length - 1)
  }
  return { transport, calls }
}

/** 固定路由表:按 URL 命中;命中不到直接失败 —— 漏配不得静默变成"没这一跳"。*/
function routeBy(script: Record<string, Response>): (url: string) => Response {
  return (url) => {
    const hit = script[url]
    if (!hit) throw new Error(`夹具未编排该 URL:${url}`)
    return hit
  }
}

/** 3xx 只带 Location。*/
function redirect(location: string, status = 302): Response {
  return new Response(null, { status, headers: { location } })
}

const encoder = new TextEncoder()

/** 无 Content-Length 的分块流(用来验"流式超限时是抛错而不是静默截断")。*/
function chunkStream(chunks: string[]): ReadableStream<Uint8Array> {
  let index = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close()
        return
      }
      controller.enqueue(encoder.encode(chunks[index] ?? ''))
      index += 1
    },
  })
}

/** 把整个流读完并返回(抛出的错误一并返回)—— 用于"读取时才触限"的两态对照。*/
async function drain(res: Response): Promise<{ text: string; error: unknown }> {
  const reader = res.body?.getReader()
  if (!reader) return { text: '', error: null }
  const decoder = new TextDecoder()
  let text = ''
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      text += decoder.decode(chunk.value, { stream: true })
    }
    return { text, error: null }
  } catch (error) {
    return { text, error }
  }
}

describe('跨 origin 判据(剥头这一维的唯一实现)', () => {
  it('同 origin 不同 path/query → 不剥;端口或协议不同 → 剥(判据是 URL.origin,不是字符串前缀)', () => {
    expect(crossesEgressOrigin('https://a.test/x', 'https://a.test/y?q=1')).toBe(false)
    expect(crossesEgressOrigin('https://a.test/x', 'https://a.test:8443/x')).toBe(true)
    expect(crossesEgressOrigin('https://a.test/x', 'http://a.test/x')).toBe(true)
    expect(crossesEgressOrigin('https://a.test/x', 'https://b.test/x')).toBe(true)
  })

  it('解析不出来源 → 失败闭合判"跨 origin"(判不出同源就剥,不"大概同源吧")', () => {
    expect(crossesEgressOrigin('not-a-url', 'https://a.test/x')).toBe(true)
    expect(crossesEgressOrigin('https://a.test/x', 'also-not-a-url')).toBe(true)
  })
})

describe('有界重定向 —— 同 origin 保留 / 跨 origin 剥全部自定义头', () => {
  it('①正向:302 → 同 origin 第二跳**保留**自定义头(同域继续可用凭据)', async () => {
    const { transport, calls } = makeTransport(
      routeBy({
        [VENDOR]: redirect(SAME_ORIGIN_NEXT),
        [SAME_ORIGIN_NEXT]: new Response('payload-2', { status: 200 }),
      }),
    )

    const res = await boundedEgressFetch(VENDOR, { headers: CUSTOM_HEADERS, transport })

    expect(calls).toHaveLength(2)
    expect(calls[0]?.init.headers).toEqual(CUSTOM_HEADERS)
    expect(calls[1]?.init.headers).toEqual(CUSTOM_HEADERS)
    expect(calls[1]?.init.redirect).toBe('manual')
    expect(await res.text()).toBe('payload-2')
  })

  it('②跨 origin 第二跳**不含** Authorization 与任何自定义头(凭据不过境给第三方 CDN)', async () => {
    const { transport, calls } = makeTransport(
      routeBy({
        [VENDOR]: redirect(CROSS_ORIGIN_NEXT),
        [CROSS_ORIGIN_NEXT]: new Response('from-cdn', { status: 200 }),
      }),
    )

    const res = await boundedEgressFetch(VENDOR, { headers: CUSTOM_HEADERS, transport })

    expect(calls).toHaveLength(2)
    expect(calls[0]?.init.headers).toEqual(CUSTOM_HEADERS)
    // **整份**丢弃(不是"只剥 Authorization")——厂商自定义头同样可能带凭据
    expect(calls[1]?.init.headers).toBeUndefined()
    const forwarded = JSON.stringify(calls[1]?.init ?? {})
    expect(forwarded).not.toContain('sk-secret-vendor-key')
    expect(forwarded).not.toContain('vendor-key-header')
    expect(forwarded).not.toContain('Authorization')
    expect(await res.text()).toBe('from-cdn')
  })

  it('②b 剥掉之后不复活:第三跳与第二跳同 origin,也不会把上一跳丢的头带回来', async () => {
    const portNext = 'https://api.vendor.test:8443/v1/thing'
    const backNext = 'https://api.vendor.test:8443/v1/other'
    const { transport, calls } = makeTransport(
      routeBy({
        [VENDOR]: redirect(portNext),
        [portNext]: redirect(backNext),
        [backNext]: new Response('done', { status: 200 }),
      }),
    )

    await boundedEgressFetch(VENDOR, { headers: CUSTOM_HEADERS, transport })

    expect(calls[1]?.init.headers).toBeUndefined()
    expect(calls[2]?.init.headers).toBeUndefined()
  })

  it('②c Location 无法按当前 URL 解析 → 原样交回这一跳,不猜、不当成已跟随', async () => {
    const badBase = 'not-a-url'
    const { transport, calls } = makeTransport(
      routeBy({ [badBase]: new Response('body-3xx', { status: 302, headers: { location: 'https://a.test/x' } }) }),
    )

    const res = await boundedEgressFetch(badBase, { transport, maxResponseBytes: 4_096 })

    expect(calls).toHaveLength(1)
    expect(res.status).toBe(302)
    expect(await res.text()).toBe('body-3xx')
  })
})

describe('重定向必需的方法/正文转发(按 fetch 标准,不靠猜)', () => {
  it('303 把 POST 降成 GET 且不带正文', async () => {
    const { transport, calls } = makeTransport(
      routeBy({
        [VENDOR]: redirect(SAME_ORIGIN_NEXT, 303),
        [SAME_ORIGIN_NEXT]: new Response('ok', { status: 200 }),
      }),
    )

    await boundedEgressFetch(VENDOR, { method: 'POST', body: '{"a":1}', transport })

    expect(calls[0]?.init.method).toBe('POST')
    expect(calls[0]?.init.body).toBe('{"a":1}')
    expect(calls[1]?.init.method).toBe('GET')
    expect(calls[1]?.init.body).toBeUndefined()
  })

  it('307 保留方法与正文(同 origin 时头也保留)', async () => {
    const { transport, calls } = makeTransport(
      routeBy({
        [VENDOR]: redirect(SAME_ORIGIN_NEXT, 307),
        [SAME_ORIGIN_NEXT]: new Response('ok', { status: 200 }),
      }),
    )

    await boundedEgressFetch(VENDOR, {
      method: 'POST',
      body: '{"a":1}',
      headers: CUSTOM_HEADERS,
      transport,
    })

    expect(calls[1]?.init.method).toBe('POST')
    expect(calls[1]?.init.body).toBe('{"a":1}')
    expect(calls[1]?.init.headers).toEqual(CUSTOM_HEADERS)
  })

  it('3xx 却给不出 Location → 原样交给调用方,不猜、不当成已跟随', async () => {
    const { transport, calls } = makeTransport(
      routeBy({ [VENDOR]: new Response('no-location', { status: 302 }) }),
    )

    const res = await boundedEgressFetch(VENDOR, { transport })

    expect(calls).toHaveLength(1)
    expect(res.status).toBe(302)
    expect(await res.text()).toBe('no-location')
  })
})

describe('跳数上限(超限必须抛错并点名是哪一道)', () => {
  /** 无限自跳的环路:每一跳都换 path,永远不会自己收敛。*/
  function loopScript(maxHops: number): Record<string, Response> {
    const script: Record<string, Response> = {}
    for (let i = 0; i <= maxHops; i += 1) {
      script[`https://loop.vendor.test/${i}`] = redirect(`https://loop.vendor.test/${i + 1}`)
    }
    return script
  }

  it('③默认上限 5 跳:第 6 跳即抛 EgressLimitError(kind=redirects)且消息点名 maxRedirects=5', async () => {
    const { transport, calls } = makeTransport(routeBy(loopScript(30)))

    const error = await boundedEgressFetch('https://loop.vendor.test/0', { transport }).catch(
      (e: unknown) => e,
    )

    expect(error).toBeInstanceOf(EgressLimitError)
    expect((error as EgressLimitError).kind).toBe('redirects')
    expect((error as EgressLimitError).limit).toBe(EGRESS_MAX_REDIRECTS)
    expect((error as EgressLimitError).observed).toBe(EGRESS_MAX_REDIRECTS + 1)
    expect((error as Error).message).toContain('maxRedirects=5')
    // 起始请求 + 已跟随的 5 跳 = 6 次发出;第 6 跳被拒,没有第 7 次
    expect(calls).toHaveLength(6)
  })

  it('③b 反向对照:把上限覆盖到 10 就能跑到第 6 跳终态(证明 5 是真边界,不是恒抛)', async () => {
    const script = loopScript(30)
    script['https://loop.vendor.test/6'] = new Response('terminated', { status: 200 })
    const { transport } = makeTransport(routeBy(script))

    const res = await boundedEgressFetch('https://loop.vendor.test/0', {
      transport,
      maxRedirects: 10,
    })

    expect(await res.text()).toBe('terminated')
  })

  it('③c maxRedirects=0 = 一跳都不许跟(合法保守档,不是非法值)', async () => {
    const { transport, calls } = makeTransport(routeBy(loopScript(3)))

    const error = await boundedEgressFetch('https://loop.vendor.test/0', {
      transport,
      maxRedirects: 0,
    }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(EgressLimitError)
    expect((error as Error).message).toContain('maxRedirects=0')
    expect(calls).toHaveLength(1)
  })

  it('上限参数本身有界:Infinity / 负数 / 字节上限 0 一律 RangeError(不得靠取消防线换测试通过)', async () => {
    const { transport } = makeTransport(routeBy({ [VENDOR]: new Response('x', { status: 200 }) }))

    await expect(
      boundedEgressFetch(VENDOR, { transport, maxRedirects: Number.POSITIVE_INFINITY }),
    ).rejects.toBeInstanceOf(RangeError)
    await expect(
      boundedEgressFetch(VENDOR, { transport, maxRedirects: -1 }),
    ).rejects.toBeInstanceOf(RangeError)
    await expect(
      boundedEgressFetch(VENDOR, { transport, maxResponseBytes: 0 }),
    ).rejects.toBeInstanceOf(RangeError)
    await expect(
      boundedEgressFetch(VENDOR, { transport, timeoutMs: Number.POSITIVE_INFINITY }),
    ).rejects.toBeInstanceOf(RangeError)
  })
})

describe('响应字节上限', () => {
  it('④a Content-Length 声明直接超上限 → 当场抛错并点名 maxResponseBytes 与声明值', async () => {
    const { transport } = makeTransport(
      routeBy({
        // 真实 Response 构造接受手写 content-length(本仓 undici 实测),用来验早拒分支:
        // 声明体量已判超限,不必把整份正文拖完。
        [VENDOR]: new Response('tiny', {
          status: 200,
          headers: { 'content-type': 'application/octet-stream', 'content-length': '9999' },
        }),
      }),
    )

    const error = await boundedEgressFetch(VENDOR, { transport, maxResponseBytes: 64 }).catch(
      (e: unknown) => e,
    )

    expect(error).toBeInstanceOf(EgressLimitError)
    expect((error as EgressLimitError).kind).toBe('bytes')
    expect((error as Error).message).toContain('maxResponseBytes=64')
    expect((error as Error).message).toContain('Content-Length=9999')
  })

  it('④b 无 Content-Length 的流式正文超上限 → 读取时抛 EgressLimitError,**不**静默截断', async () => {
    const { transport } = makeTransport(
      routeBy({
        [VENDOR]: new Response(chunkStream(['aaaaaaaaaa', 'bbbbbbbbbb', 'cccccccccc']), {
          status: 200,
        }),
      }),
    )

    const res = await boundedEgressFetch(VENDOR, { transport, maxResponseBytes: 16 })
    const { text, error } = await drain(res)

    // 上限之前的字节确实读到了(不是"一上来就报错"的假防线)
    expect(text).toBe('aaaaaaaaaa')
    expect(error).toBeInstanceOf(EgressLimitError)
    expect((error as EgressLimitError).kind).toBe('bytes')
    expect((error as Error).message).toContain('maxResponseBytes=16')
  })

  it('④c 反向对照:上限内的响应逐字不变', async () => {
    const { transport } = makeTransport(
      routeBy({ [VENDOR]: new Response('exactly-fine', { status: 200 }) }),
    )

    const res = await boundedEgressFetch(VENDOR, { transport, maxResponseBytes: 1024 })
    expect(await res.text()).toBe('exactly-fine')
    expect(res.status).toBe(200)
  })

  it('④d 反向对照:text/event-stream 不套字节上限(把流式对话掐断是功能事故,不是防线)', async () => {
    const { transport } = makeTransport(
      routeBy({
        [VENDOR]: new Response(chunkStream(['data: 0123456789\n\n'.repeat(8)]), {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
      }),
    )

    const res = await boundedEgressFetch(VENDOR, { transport, maxResponseBytes: 32 })
    const text = await res.text()
    expect(text.length).toBeGreaterThan(32)
    expect(text).toContain('data: 0123456789')
  })
})

describe('超时上限(整条重定向链共用一份预算)', () => {
  it('⑤计时器到期 → 抛 EgressLimitError(kind=timeout)并点名 timeoutMs', async () => {
    const hanging: EgressTransport = (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init.signal
        if (!signal) return
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      })

    const error = await boundedEgressFetch(VENDOR, { transport: hanging, timeoutMs: 25 }).catch(
      (e: unknown) => e,
    )

    expect(error).toBeInstanceOf(EgressLimitError)
    expect((error as EgressLimitError).kind).toBe('timeout')
    expect((error as EgressLimitError).limit).toBe(25)
    expect((error as Error).message).toContain('timeoutMs=25')
  })

  it('⑤b 反向对照:调用方主动取消抛的是取消本身,不得被冒充成"我们的超时"', async () => {
    const controller = new AbortController()
    const hanging: EgressTransport = (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
      })

    const pending = boundedEgressFetch(VENDOR, {
      transport: hanging,
      timeoutMs: 5_000,
      signal: controller.signal,
    })
    controller.abort(new Error('caller cancelled'))

    const error = await pending.catch((e: unknown) => e)
    expect(error).not.toBeInstanceOf(EgressLimitError)
    expect((error as Error).message).toBe('caller cancelled')
  })

  it('⑤c 反向对照:上限内正常返回,不被计时器打扰', async () => {
    const { transport } = makeTransport(
      routeBy({ [VENDOR]: new Response('fast', { status: 200 }) }),
    )
    const res = await boundedEgressFetch(VENDOR, { transport, timeoutMs: 2_000 })
    expect(await res.text()).toBe('fast')
  })

  it('⑤d 超时预算跨跳累计:每跳都快但总时长超上限,仍按上限抛(不是逐跳重置)', async () => {
    const slow: EgressTransport = async (url, init) => {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 12)
        init.signal?.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(init.signal?.reason)
        })
      })
      if (url === VENDOR) return redirect(SAME_ORIGIN_NEXT)
      return new Response('late', { status: 200 })
    }

    const error = await boundedEgressFetch(VENDOR, { transport: slow, timeoutMs: 20 }).catch(
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(EgressLimitError)
    expect((error as EgressLimitError).kind).toBe('timeout')
  })
})

describe('directEgressFetch —— 直连侧走同一个有界主循环(G-749)', () => {
  it('直连侧经同一判据剥头:跨 origin 第二跳不含 Authorization 与任何自定义头,与代理侧同一份判据', async () => {
    const { transport, calls } = makeTransport(
      routeBy({
        [VENDOR]: redirect(CROSS_ORIGIN_NEXT),
        [CROSS_ORIGIN_NEXT]: new Response('from-cdn-direct', { status: 200 }),
      }),
    )

    // 生产形态:directEgressFetch 不传 transport = 直连;这里注入假传输以逐跳断言,
    // 主循环判据与 boundedEgressFetch 是同一份代码,不是测试自己复刻的规则。
    const res = await directEgressFetch(VENDOR, { headers: CUSTOM_HEADERS, transport })

    expect(calls).toHaveLength(2)
    expect(calls[0]?.init.headers).toEqual(CUSTOM_HEADERS)
    expect(calls[1]?.init.headers).toBeUndefined()
    const forwarded = JSON.stringify(calls[1]?.init ?? {})
    expect(forwarded).not.toContain('sk-secret-vendor-key')
    expect(forwarded).not.toContain('Authorization')
    expect(await res.text()).toBe('from-cdn-direct')
  })

  it('同 origin 第二跳保留自定义头 + redirect 恒 manual(直连侧不回退成 undici 默认跟随)', async () => {
    const { transport, calls } = makeTransport(
      routeBy({
        [VENDOR]: redirect(SAME_ORIGIN_NEXT),
        [SAME_ORIGIN_NEXT]: new Response('ok-direct', { status: 200 }),
      }),
    )

    const res = await directEgressFetch(VENDOR, { headers: CUSTOM_HEADERS, transport })

    expect(calls[1]?.init.headers).toEqual(CUSTOM_HEADERS)
    expect(calls[1]?.init.redirect).toBe('manual')
    expect(await res.text()).toBe('ok-direct')
  })

  it('默认传输缝:不传 transport 时走直连传输(Node 内置 fetch、redirect manual)—— 形状钉,防两份默认漂移', async () => {
    // 不发真实请求:借 undefined 的 fetch 抛错来证明"默认缝存在且被调用"(测试隔离铁律)。
    const savedFetch = globalThis.fetch
    try {
      const seen: Array<RequestInit | undefined> = []
      globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
        seen.push(init)
        throw new TypeError('fixture: default transport reached')
      }) as typeof fetch

      await expect(directEgressFetch(VENDOR, { headers: CUSTOM_HEADERS })).rejects.toThrow(
        'fixture: default transport reached',
      )
      expect(seen).toHaveLength(1)
      expect(seen[0]?.redirect).toBe('manual')
      expect(seen[0]?.headers).toEqual(CUSTOM_HEADERS)
    } finally {
      globalThis.fetch = savedFetch
    }
  })
})

describe('proxiedFetch —— 唯一出口,不得另开第二条 fetch 分支', () => {
  it('未配置 PROXY_URL 仍按既有行为抛错(本票不新增失败模式)', async () => {
    delete process.env.PROXY_URL
    await expect(proxiedFetch(VENDOR, {})).rejects.toThrow('代理未配置(PROXY_URL)')
  })

  it('经同一个出口:跨 origin 剥头生效,且 egress 事实仍挂在响应上(不可枚举,不进 JSON)', async () => {
    process.env.PROXY_URL = 'http://127.0.0.1:59999'
    const { transport, calls } = makeTransport(
      routeBy({
        [VENDOR]: redirect(CROSS_ORIGIN_NEXT),
        [CROSS_ORIGIN_NEXT]: new Response('cdn-body', { status: 200 }),
      }),
    )

    const res = await proxiedFetch(VENDOR, {
      method: 'GET',
      headers: CUSTOM_HEADERS,
      transport,
      maxResponseBytes: 4_096,
    })

    expect(calls).toHaveLength(2)
    expect(calls[0]?.init.headers).toEqual(CUSTOM_HEADERS)
    expect(calls[1]?.init.headers).toBeUndefined()
    expect(calls[1]?.init.redirect).toBe('manual')
    expect(await res.text()).toBe('cdn-body')

    const facts = readEgressFacts(res)
    expect(facts).not.toBeNull()
    expect(facts?.targetHostname).toBe('api.vendor.test')
    // 不可枚举:防它被 JSON.stringify 顺带带进日志/响应体
    expect(Object.keys(res)).not.toContain('egress')
    expect(JSON.stringify(res)).not.toContain('targetHostname')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
