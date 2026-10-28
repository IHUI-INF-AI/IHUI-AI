// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * lingma(通义灵码)提取器 + 适配器行为单测(2026-10-27 立)。
 *
 * 覆盖点:
 * - 提取器两态:目录/文件缺失 ⇒ LINGMA_NO_SESSION(未判定点名);
 *   credentials 文件存在 ⇒ raw 直通 + 摘要零回显;非 JSON ⇒ LINGMA_BAD_CREDENTIALS
 * - buildChatRequest:国内/国际双域名、Bearer、body 透传
 * - checkHealth:401 ⇒ authFailed;形状不符 ⇒ indeterminate(未判定不冒绿)
 * - getQuota:无公开端点 ⇒ 未判定且不发请求
 * - isAuthFailure / translateStreamChunk / classifyUpstreamFailure
 *
 * fetch 全部打桩,不发真实网络请求。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { AdapterAccountContext, StreamState } from '../src/services/relay-upstream-adapters.js'
import { lingmaAdapter } from '../src/services/upstream-adapters/lingma-adapter.js'

const HERE = dirname(fileURLToPath(import.meta.url))

/** 提取器是 scripts/lib 下的 .mjs(§0.6 同仓共用),经 file:// 动态导入(与既有测试同款做法) */
interface ExtractResult {
  providerCode: string
  accounts: Array<Record<string, unknown>>
  meta: Record<string, unknown>
}
const extractLingmaAccounts = (
  (await import(
    pathToFileURL(resolve(HERE, '../../../scripts/lib/lingma-auth-extract.mjs')).href
  )) as {
    extractLingmaAccounts: (opts?: Record<string, unknown>) => Promise<ExtractResult>
  }
).extractLingmaAccounts

const mockFetch = vi.fn()
global.fetch = mockFetch as unknown as typeof fetch

function makeTmpDir(): string {
  return mkdtempSync(`${tmpdir()}/lingma-test-`.replace(/\\/g, '/'))
}

async function errorCodeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p
    return ''
  } catch (e) {
    return (e as { code?: string }).code ?? ''
  }
}

function makeCtx(secrets: Record<string, unknown> = { region: 'cn' }): AdapterAccountContext {
  return {
    row: { id: 'row-1', providerCode: 'lingma', uid: 'u1', name: 'n' },
    credentials: {
      token: 'lm-test-token',
      refreshToken: null,
      cookies: [],
      secrets,
    },
  } as unknown as AdapterAccountContext
}

function chunkOf(obj: unknown): string {
  return JSON.stringify(obj)
}

describe('lingma 提取器(两态)', () => {
  it('目录/文件缺失 ⇒ LINGMA_NO_SESSION(未判定,不冒绿)', async () => {
    const empty = makeTmpDir()
    try {
      const err = await extractLingmaAccounts({ homeDir: empty, appDataDir: empty }).then(
        () => null,
        (e: { code?: string; message?: string }) => e,
      )
      expect(err?.code).toBe('LINGMA_NO_SESSION')
      expect(err?.message).toMatch(/未找到灵码登录态|未判定/)
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })

  it('credentials 文件存在 ⇒ raw 直通(零映射)+ 摘要零回显', async () => {
    const home = makeTmpDir()
    try {
      const credObj = { accessToken: 'lingma-secret-token-value-abc', region: 'cn', uid: 'u-1' }
      mkdirSync(`${home}/.lingma`, { recursive: true })
      writeFileSync(`${home}/.lingma/credentials`, JSON.stringify(credObj), 'utf8')
      const result = await extractLingmaAccounts({ homeDir: home, appDataDir: home })
      expect(result.providerCode).toBe('lingma')
      expect(result.meta['route']).toBe('credentials-file')
      expect(result.meta['count']).toBe(1)
      // raw 直通:账号记录与文件内容逐字相等
      expect(result.accounts[0]).toEqual(credObj)
      // 令牌零回显:meta 摘要(JSON 序列化)不含令牌明文,只有指纹;明文仅存于 raw 直通的 accounts
      const metaText = JSON.stringify(result.meta)
      expect(metaText).not.toContain('lingma-secret-token-value-abc')
      const meta = result.meta as { sessions: Array<{ tokenFingerprints: Record<string, string> }> }
      expect(meta.sessions[0].tokenFingerprints['accessToken']).toMatch(/^[0-9a-f]{12}$/)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('credentials 文件非 JSON 对象 ⇒ LINGMA_BAD_CREDENTIALS', async () => {
    const home = makeTmpDir()
    try {
      mkdirSync(`${home}/.lingma`, { recursive: true })
      writeFileSync(`${home}/.lingma/credentials`, 'not-json', 'utf8')
      expect(await errorCodeOf(extractLingmaAccounts({ homeDir: home, appDataDir: home }))).toBe(
        'LINGMA_BAD_CREDENTIALS',
      )
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})

describe('lingma buildChatRequest', () => {
  it('国内域名缺省 + Bearer 头 + body 透传 OpenAI 形状', () => {
    const req = {
      model: 'qwen3-coder-plus',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.7,
      maxTokens: 100,
      stream: true,
    }
    const http = lingmaAdapter.buildChatRequest(makeCtx(), req)
    expect(http.url).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions')
    expect(http.method).toBe('POST')
    expect(http.headers['authorization']).toBe('Bearer lm-test-token')
    const body = JSON.parse(http.rawBody ?? '') as Record<string, unknown>
    expect(body).toMatchObject({
      model: 'qwen3-coder-plus',
      stream: true,
      temperature: 0.7,
      max_tokens: 100,
    })
  })

  it('secrets.region=intl ⇒ 国际域名(alibabacloud.com 侧预留)', () => {
    const http = lingmaAdapter.buildChatRequest(makeCtx({ region: 'intl' }), {
      model: 'qwen3-coder-plus',
      messages: [],
      stream: false,
    })
    expect(http.url).toBe('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions')
    expect(http.headers['accept']).toBe('application/json')
  })
})

describe('lingma checkHealth / listModels(打桩 fetch)', () => {
  // Vitest 4:hook 回调不得隐式返回 mock 函数(会被当作 cleanup 在测后调用),必须块体无返回值。
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('data 数组正常 ⇒ ok;listModels 取 data[].id', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ data: [{ id: 'qwen3-coder-plus' }, { id: 'qwen-max' }] }),
    })
    const health = await lingmaAdapter.checkHealth(makeCtx())
    expect(health.ok).toBe(true)
    const models = await lingmaAdapter.listModels!(makeCtx())
    expect(models).toEqual(['qwen3-coder-plus', 'qwen-max'])
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/models')
    expect(init.method).toBe('GET')
    const headers = init.headers as Record<string, string>
    expect(headers['authorization']).toBe('Bearer lm-test-token')
  })

  it('401 ⇒ ok:false + authFailed:true(承载层据此触发自愈)', async () => {
    mockFetch.mockResolvedValue({
      status: 401,
      ok: false,
      text: async () =>
        JSON.stringify({ code: 'InvalidApiKey', message: 'Invalid API-key provided.' }),
    })
    const health = await lingmaAdapter.checkHealth(makeCtx())
    expect(health.ok).toBe(false)
    expect(health.authFailed).toBe(true)
    expect(health.indeterminate).toBeUndefined()
  })

  it('200 形状不符(缺 data 数组)⇒ ok:false + indeterminate(未判定,不冒绿)', async () => {
    mockFetch.mockResolvedValue({ status: 200, ok: true, text: async () => '{"weird":1}' })
    const health = await lingmaAdapter.checkHealth(makeCtx())
    expect(health.ok).toBe(false)
    expect(health.indeterminate).toBe(true)
    expect(health.error).toMatch(/未判定/)
  })

  it('5xx ⇒ ok:false + indeterminate(上游抖动不误杀好号)', async () => {
    mockFetch.mockResolvedValue({ status: 502, ok: false, text: async () => 'bad gateway' })
    const health = await lingmaAdapter.checkHealth(makeCtx())
    expect(health.ok).toBe(false)
    expect(health.indeterminate).toBe(true)
    expect(health.authFailed).toBeUndefined()
  })
})

describe('lingma getQuota(无公开端点 ⇒ 未判定,不发请求)', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('永远 ok:false + 未判定点名 + 不发网络请求(不猜字段)', async () => {
    const q = await lingmaAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(false)
    expect(q.quota).toBeUndefined()
    expect(q.authFailed).toBeUndefined()
    expect(q.error).toMatch(/未判定/)
    expect(q.error).toMatch(/无公开端点/)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('lingma isAuthFailure', () => {
  it('401/403 → true;429/5xx/400 → false', () => {
    expect(lingmaAdapter.isAuthFailure(401, '')).toBe(true)
    expect(lingmaAdapter.isAuthFailure(403, '')).toBe(true)
    expect(lingmaAdapter.isAuthFailure(429, 'Throttling')).toBe(false)
    expect(lingmaAdapter.isAuthFailure(500, 'gateway error')).toBe(false)
    expect(lingmaAdapter.isAuthFailure(400, '{"code":"InvalidParameter"}')).toBe(false)
  })

  it('HTTP 200 但体带 DashScope 鉴权失效码/文案 → true', () => {
    expect(
      lingmaAdapter.isAuthFailure(200, '{"code":"InvalidApiKey","message":"Invalid API-key."}'),
    ).toBe(true)
    expect(lingmaAdapter.isAuthFailure(200, '{"code":"AccessDenied","message":"denied"}')).toBe(
      true,
    )
    expect(lingmaAdapter.isAuthFailure(200, 'The token has expired')).toBe(true)
  })
})

describe('lingma translateStreamChunk / translateNonStream', () => {
  const ctx = makeCtx()
  const state: StreamState = {}

  it('普通 chunk 原样透传;[DONE]/空帧/非 JSON → null', () => {
    const frame = {
      id: 'cmpl-1',
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: { content: '你好' }, finish_reason: null }],
    }
    const out = lingmaAdapter.translateStreamChunk(ctx, chunkOf(frame), state)
    expect(out?.openaiChunk).toEqual(frame)
    expect(lingmaAdapter.translateStreamChunk(ctx, 'data: [DONE]', state)).toBeNull()
    expect(lingmaAdapter.translateStreamChunk(ctx, ': keep-alive', state)).toBeNull()
  })

  it('{"error":{...}} 帧与 DashScope 原生 {"code","message"} 帧 → done + error', () => {
    const e1 = lingmaAdapter.translateStreamChunk(
      ctx,
      chunkOf({ error: { code: 'InvalidApiKey', message: 'bad key' } }),
      state,
    )
    expect(e1?.done).toBe(true)
    expect((e1?.openaiChunk['error'] as { code: string }).code).toBe('InvalidApiKey')
    const e2 = lingmaAdapter.translateStreamChunk(
      ctx,
      chunkOf({ code: 'Throttling', message: 'Requests rate limit exceeded', request_id: 'r1' }),
      state,
    )
    expect(e2?.done).toBe(true)
    expect((e2?.openaiChunk['error'] as { code: string }).code).toBe('Throttling')
    // 带 choices/usage 的正常帧即便有 code 键也不算错误帧
    const ok = lingmaAdapter.translateStreamChunk(
      ctx,
      chunkOf({ code: 'x', choices: [{ delta: {} }], usage: {} }),
      state,
    )
    expect(ok?.done).toBeUndefined()
  })

  it('translateNonStream:HTTP 200 业务错误体 → 抛错(不得当成功)', () => {
    expect(() =>
      lingmaAdapter.translateNonStream(makeCtx(), {
        code: 'InvalidApiKey',
        message: 'Invalid API-key provided.',
        request_id: 'r1',
      }),
    ).toThrow(/InvalidApiKey/)
  })
})

describe('lingma classifyUpstreamFailure', () => {
  const classify = lingmaAdapter.classifyUpstreamFailure!

  it('Throttling/429 → rate;Arrearage/额度文案 → credit', () => {
    expect(classify(429, 'Requests rate limit exceeded').kind).toBe('rate')
    expect(classify(200, '{"code":"Throttling"}').kind).toBe('rate')
    expect(classify(200, '{"code":"Arrearage","message":"欠费"}').kind).toBe('credit')
    expect(classify(400, '{"message":"insufficient quota"}').kind).toBe('credit')
  })

  it('401/403 → auth;404 → not_found;5xx → server;其他 4xx → client', () => {
    expect(classify(401, '').kind).toBe('auth')
    expect(classify(403, '{"code":"AccessDenied"}').kind).toBe('auth')
    expect(classify(404, 'no such model').kind).toBe('not_found')
    expect(classify(502, 'bad gateway').kind).toBe('server')
    expect(classify(400, 'bad request').kind).toBe('client')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
