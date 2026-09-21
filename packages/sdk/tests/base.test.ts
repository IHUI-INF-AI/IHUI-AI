// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { describe, expect, it, vi } from 'vitest'
import { BaseClient, SdkError, type SdkConfig } from '../src/base'

/** 构造注入用 fetch,记录每次调用的 url/init 并按脚本返回响应。 */
function makeFetch(
  script: Array<{ status?: number; statusText?: string; body?: string | null; throwErr?: Error }>,
) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fetchFn = vi.fn(async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    const step = script[Math.min(calls.length - 1, script.length - 1)]
    if (step.throwErr) throw step.throwErr
    return new Response(step.body === null || step.body === undefined ? null : step.body, {
      status: step.status ?? 200,
      statusText: step.statusText ?? '',
      headers: { 'content-type': 'application/json' },
    })
  })
  return { fetchFn: fetchFn as unknown as typeof fetch, calls }
}

function makeClient(config: Partial<SdkConfig> & { fetch: typeof fetch }): BaseClient {
  return new BaseClient({ apiKey: 'ihui_test_key', ...config })
}

describe('BaseClient 请求体拼装', () => {
  it('POST 请求体按 JSON 序列化,URL 拼接 /v1 前缀', async () => {
    const { fetchFn, calls } = makeFetch([{ body: '{"ok":true}' }])
    const client = makeClient({ baseUrl: 'http://test.local', fetch: fetchFn })
    const body = { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] }
    const out = await client.request<{ ok: boolean }>('POST', '/chat/completions', body)
    expect(out).toEqual({ ok: true })
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('http://test.local/v1/chat/completions')
    expect(calls[0].init.method).toBe('POST')
    expect(calls[0].init.body).toBe(JSON.stringify(body))
  })

  it('可选参数为 undefined 的字段不序列化进请求体(null 除外)', async () => {
    const { fetchFn, calls } = makeFetch([{ body: '{}' }])
    const client = makeClient({ baseUrl: 'http://test.local', fetch: fetchFn })
    await client.request('POST', '/x', { a: 1, b: undefined })
    const sent = JSON.parse(calls[0].init.body as string) as Record<string, unknown>
    expect(sent).toEqual({ a: 1 })
    expect('b' in sent).toBe(false)
  })

  it('GET 请求不携带 body', async () => {
    const { fetchFn, calls } = makeFetch([{ body: '{"data":[]}' }])
    const client = makeClient({ baseUrl: 'http://test.local', fetch: fetchFn })
    await client.request('GET', '/models')
    expect(calls[0].init.body).toBeUndefined()
    expect(calls[0].init.method).toBe('GET')
  })

  it('baseUrl 尾部斜杠被归一化,path 缺前导斜杠时自动补齐', async () => {
    const { fetchFn, calls } = makeFetch([{ body: '{}' }])
    const client = makeClient({ baseUrl: 'http://test.local///', fetch: fetchFn })
    await client.request('GET', 'models/x')
    expect(calls[0].url).toBe('http://test.local/v1/models/x')
  })

  it('鉴权头:Authorization Bearer + 可选 X-Api-Secret + Content-Type', async () => {
    const { fetchFn, calls } = makeFetch([{ body: '{}' }])
    const client = makeClient({ baseUrl: 'http://test.local', secret: 'sec_123', fetch: fetchFn })
    await client.request('GET', '/models')
    const headers = calls[0].init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer ihui_test_key')
    expect(headers['X-Api-Secret']).toBe('sec_123')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('未配置 secret 时不携带 X-Api-Secret 头', async () => {
    const { fetchFn, calls } = makeFetch([{ body: '{}' }])
    const client = makeClient({ baseUrl: 'http://test.local', fetch: fetchFn })
    await client.request('GET', '/models')
    const headers = calls[0].init.headers as Record<string, string>
    expect(headers['X-Api-Secret']).toBeUndefined()
  })

  it('空响应体返回 undefined', async () => {
    const { fetchFn } = makeFetch([{ body: null }])
    const client = makeClient({ baseUrl: 'http://test.local', fetch: fetchFn })
    await expect(client.request('DELETE', '/user/models/m1')).resolves.toBeUndefined()
  })
})

describe('BaseClient 错误映射', () => {
  it('401 + 扁平错误体 → SdkError(status=401, code/message 来自响应体)', async () => {
    const { fetchFn } = makeFetch([
      {
        status: 401,
        statusText: 'Unauthorized',
        body: '{"code":"auth_invalid_api_key","message":"bad key"}',
      },
    ])
    const client = makeClient({ baseUrl: 'http://test.local', fetch: fetchFn })
    const err = await client.request('GET', '/models').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(SdkError)
    const e = err as SdkError
    expect(e.status).toBe(401)
    expect(e.code).toBe('auth_invalid_api_key')
    expect(e.message).toBe('bad key')
  })

  it('404 + 嵌套 error 结构 → 优先取 error.code / error.message / error.details', async () => {
    const { fetchFn } = makeFetch([
      {
        status: 404,
        statusText: 'Not Found',
        body: '{"error":{"code":"model_not_found","message":"no such model","details":{"id":"gpt-9"}}}',
      },
    ])
    const client = makeClient({ baseUrl: 'http://test.local', fetch: fetchFn })
    const err = (await client.request('GET', '/models/gpt-9').catch((e: unknown) => e)) as SdkError
    expect(err.status).toBe(404)
    expect(err.code).toBe('model_not_found')
    expect(err.message).toBe('no such model')
    expect(err.details).toEqual({ id: 'gpt-9' })
  })

  it('错误体非 JSON → 回退 code=http_{status},message=statusText', async () => {
    const { fetchFn } = makeFetch([
      { status: 403, statusText: 'Forbidden', body: '<html>502</html>' },
    ])
    const client = makeClient({ baseUrl: 'http://test.local', fetch: fetchFn })
    const err = (await client.request('GET', '/x').catch((e: unknown) => e)) as SdkError
    expect(err.code).toBe('http_403')
    expect(err.message).toBe('Forbidden')
  })

  it('429 不重试:fetch 只调用一次', async () => {
    const { fetchFn, calls } = makeFetch([
      {
        status: 429,
        statusText: 'Too Many Requests',
        body: '{"code":"rate_limited","message":"slow down"}',
      },
    ])
    const client = makeClient({ baseUrl: 'http://test.local', fetch: fetchFn })
    const err = (await client.request('GET', '/x').catch((e: unknown) => e)) as SdkError
    expect(err.status).toBe(429)
    expect(calls).toHaveLength(1)
  })

  it('500 自动重试至 maxRetries 耗尽后抛 ServerError 语义的 SdkError', async () => {
    const { fetchFn, calls } = makeFetch([
      {
        status: 500,
        statusText: 'Internal Server Error',
        body: '{"code":"boom","message":"server error"}',
      },
    ])
    const client = makeClient({ baseUrl: 'http://test.local', maxRetries: 2, fetch: fetchFn })
    const err = (await client.request('GET', '/x').catch((e: unknown) => e)) as SdkError
    expect(err.status).toBe(500)
    expect(err.code).toBe('boom')
    expect(calls).toHaveLength(3) // 1 次原始 + 2 次重试
  }, 10000)

  it('网络错误 → SdkError(status=0, code=network_error) 并重试', async () => {
    const { fetchFn, calls } = makeFetch([{ throwErr: new TypeError('fetch failed') }])
    const client = makeClient({ baseUrl: 'http://test.local', maxRetries: 1, fetch: fetchFn })
    const err = (await client.request('GET', '/x').catch((e: unknown) => e)) as SdkError
    expect(err.status).toBe(0)
    expect(err.code).toBe('network_error')
    expect(calls).toHaveLength(2)
  }, 10000)
})

describe('BaseClient 配置校验', () => {
  it('缺失 apiKey 时构造即抛 SdkError(missing_api_key)', () => {
    expect(
      () => new BaseClient({ apiKey: '', fetch: undefined as unknown as typeof fetch }),
    ).toThrow(SdkError)
    try {
      new BaseClient({ apiKey: '', fetch: undefined as unknown as typeof fetch })
    } catch (e) {
      const err = e as SdkError
      expect(err.status).toBe(401)
      expect(err.code).toBe('missing_api_key')
    }
  })

  it('requestStream 非 2xx 直接抛 SdkError 且不重试', async () => {
    const { fetchFn, calls } = makeFetch([
      {
        status: 401,
        statusText: 'Unauthorized',
        body: '{"code":"auth_invalid_api_key","message":"bad key"}',
      },
    ])
    const client = makeClient({ baseUrl: 'http://test.local', fetch: fetchFn })
    const err = (await client
      .requestStream('POST', '/chat/completions', {})
      .catch((e: unknown) => e)) as SdkError
    expect(err).toBeInstanceOf(SdkError)
    expect(err.status).toBe(401)
    expect(calls).toHaveLength(1)
  })

  it('requestStream 成功返回 ReadableStream', async () => {
    const { fetchFn } = makeFetch([{ body: 'data: [DONE]\n\n' }])
    const client = makeClient({ baseUrl: 'http://test.local', fetch: fetchFn })
    const stream = await client.requestStream('POST', '/chat/completions', { stream: true })
    expect(stream).toBeInstanceOf(ReadableStream)
  })
})
