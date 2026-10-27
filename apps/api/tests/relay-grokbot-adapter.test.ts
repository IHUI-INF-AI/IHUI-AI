// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Grok Bot(SpaceXAI/xAI 常驻 Agent)提取器 + 适配器行为单测(2026-10-27 立)。
 *
 * 覆盖点:
 * - 提取器两态:数据目录/文件缺失 ⇒ GROKBOT_NO_SESSION(未判定点名);
 *   凭证/连接文件存在(按 2026-10-27 本机实证键形)⇒ raw 直通 + 摘要零回显
 * - buildChatRequest:api.x.ai + Bearer + body 透传
 * - checkHealth:401 ⇒ authFailed;形状不符 ⇒ indeterminate(未判定不冒绿)
 * - getQuota:无公开端点 ⇒ 未判定且不发请求
 * - isAuthFailure / translateStreamChunk / classifyUpstreamFailure
 *
 * fetch 全部打桩,不发真实网络请求。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { AdapterAccountContext, StreamState } from '../src/services/relay-upstream-adapters.js'
import { grokbotAdapter } from '../src/services/upstream-adapters/grokbot-adapter.js'

const HERE = dirname(fileURLToPath(import.meta.url))

/** 提取器是 scripts/lib 下的 .mjs(§0.6 同仓共用),经 file:// 动态导入(与既有测试同款做法) */
interface ExtractResult {
  providerCode: string
  accounts: Array<Record<string, unknown>>
  meta: Record<string, unknown>
}
const extractGrokbotAccounts = (
  (await import(
    pathToFileURL(resolve(HERE, '../../../scripts/lib/grokbot-auth-extract.mjs')).href
  )) as {
    extractGrokbotAccounts: (opts?: Record<string, unknown>) => Promise<ExtractResult>
  }
).extractGrokbotAccounts

const mockFetch = vi.fn()
global.fetch = mockFetch as unknown as typeof fetch

/** 键形照抄 2026-10-27 本机实证(只抄形状,值用占位串) */
const SEALED_CRED = { sandSealedFile: 1, data: 'c2FuZFNlYWxlZC1jcmVkLXBsYWNlaG9sZGVy' }
const SEALED_CONN = { sandSealedFile: 1, data: 'c2FuZFNlYWxlZC1jb25uLXBsYWNlaG9sZGVy' }
const SETTINGS = {
  version: 3,
  activeAccountScope: 'a'.repeat(64),
  hasSeenOnboarding: true,
  localToolPermission: 'ask',
  mcpBoxServers: [],
}

function makeTmpDir(): string {
  return mkdtempSync(`${tmpdir()}/grokbot-test-`.replace(/\\/g, '/'))
}

function makeCtx(): AdapterAccountContext {
  return {
    row: { id: 'row-1', providerCode: 'grokbot', uid: 'u1', name: 'n' },
    credentials: {
      token: 'gk-test-token',
      refreshToken: null,
      cookies: [],
      secrets: {},
    },
  } as unknown as AdapterAccountContext
}

function chunkOf(obj: unknown): string {
  return JSON.stringify(obj)
}

describe('grokbot 提取器(两态)', () => {
  it('数据目录缺失 ⇒ GROKBOT_NO_SESSION(未判定,不冒绿)', async () => {
    const empty = makeTmpDir()
    try {
      const err = await extractGrokbotAccounts({ grokbotDir: `${empty}/.grokbot` }).then(
        () => null,
        (e: { code?: string; message?: string }) => e,
      )
      expect(err?.code).toBe('GROKBOT_NO_SESSION')
      expect(err?.message).toMatch(/未找到 Grok Bot 数据目录|未判定/)
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })

  it('实证键形文件齐备 ⇒ raw 直通(零映射)+ 摘要零回显', async () => {
    const dir = makeTmpDir()
    try {
      writeFileSync(`${dir}/local-exec-daemon-credential.json`, JSON.stringify(SEALED_CRED), 'utf8')
      writeFileSync(`${dir}/local-exec-daemon-connection.json`, JSON.stringify(SEALED_CONN), 'utf8')
      writeFileSync(`${dir}/settings.json`, JSON.stringify(SETTINGS), 'utf8')
      // .grokbot-data-root-v1 实证是 {"version":1} 版本标记(不是路径),提取器不消费、不报错
      writeFileSync(`${dir}/.grokbot-data-root-v1`, '{"version":1}', 'utf8')
      const result = await extractGrokbotAccounts({ grokbotDir: dir })
      expect(result.providerCode).toBe('grokbot')
      expect(result.meta['count']).toBe(1)
      // raw 直通:信封内两个文件逐字相等
      expect(result.accounts[0]).toEqual({ credential: SEALED_CRED, connection: SEALED_CONN })
      // 令牌零回显:meta 摘要不进 data 密文,只有指纹与长度;密文仅存于 raw 直通的 accounts
      const metaText = JSON.stringify(result.meta)
      expect(metaText).not.toContain(SEALED_CRED.data)
      expect(metaText).not.toContain(SEALED_CONN.data)
      const meta = result.meta as {
        sessions: Array<{
          credentialDataFingerprint: string
          credentialDataLength: number
          credentialSealedVersion: number
          connectionDataFingerprint: string
          hasActiveAccountScope: boolean
          settingsVersion: number
        }>
      }
      const s = meta.sessions[0]
      expect(s.credentialDataFingerprint).toMatch(/^[0-9a-f]{12}$/)
      expect(s.credentialDataLength).toBe(SEALED_CRED.data.length)
      expect(s.credentialSealedVersion).toBe(1)
      expect(s.connectionDataFingerprint).toMatch(/^[0-9a-f]{12}$/)
      expect(s.hasActiveAccountScope).toBe(true)
      expect(s.settingsVersion).toBe(3)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('有 credential 缺 connection ⇒ GROKBOT_NO_SESSION(点名缺失文件)', async () => {
    const dir = makeTmpDir()
    try {
      writeFileSync(`${dir}/local-exec-daemon-credential.json`, JSON.stringify(SEALED_CRED), 'utf8')
      const err = await extractGrokbotAccounts({ grokbotDir: dir }).then(
        () => null,
        (e: { code?: string; message?: string }) => e,
      )
      expect(err?.code).toBe('GROKBOT_NO_SESSION')
      expect(err?.message).toMatch(/connection 文件不存在/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('grokbot buildChatRequest', () => {
  it('api.x.ai/chat/completions + Bearer 头 + body 透传 OpenAI 形状', () => {
    const req = {
      model: 'grok-4',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.5,
      maxTokens: 256,
      stream: true,
    }
    const http = grokbotAdapter.buildChatRequest(makeCtx(), req)
    expect(http.url).toBe('https://api.x.ai/v1/chat/completions')
    expect(http.method).toBe('POST')
    expect(http.headers['authorization']).toBe('Bearer gk-test-token')
    expect(http.headers['accept']).toBe('text/event-stream')
    const body = JSON.parse(http.rawBody ?? '') as Record<string, unknown>
    expect(body).toMatchObject({
      model: 'grok-4',
      stream: true,
      temperature: 0.5,
      max_tokens: 256,
    })
  })

  it('缺 token ⇒ 抛错(该账号不可转发)', () => {
    const ctx = makeCtx()
    ctx.credentials.token = ''
    expect(() =>
      grokbotAdapter.buildChatRequest(ctx, { model: 'grok-4', messages: [], stream: true }),
    ).toThrow(/缺少 token/)
  })
})

describe('grokbot checkHealth / listModels(打桩 fetch)', () => {
  // Vitest 4:hook 回调不得隐式返回 mock 函数(会被当作 cleanup 在测后调用),必须块体无返回值。
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('data 数组正常 ⇒ ok;listModels 取 data[].id', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ data: [{ id: 'grok-4' }, { id: 'grok-3-mini' }] }),
    })
    const health = await grokbotAdapter.checkHealth(makeCtx())
    expect(health.ok).toBe(true)
    const models = await grokbotAdapter.listModels!(makeCtx())
    expect(models).toEqual(['grok-4', 'grok-3-mini'])
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.x.ai/v1/models')
    expect(init.method).toBe('GET')
    expect((init.headers as Record<string, string>)['authorization']).toBe('Bearer gk-test-token')
  })

  it('401 ⇒ ok:false + authFailed:true(承载层据此触发自愈)', async () => {
    mockFetch.mockResolvedValue({
      status: 401,
      ok: false,
      text: async () => JSON.stringify({ error: { message: 'invalid api key' } }),
    })
    const health = await grokbotAdapter.checkHealth(makeCtx())
    expect(health.ok).toBe(false)
    expect(health.authFailed).toBe(true)
    expect(health.indeterminate).toBeUndefined()
  })

  it('403 ⇒ authFailed;200 形状不符 ⇒ indeterminate(未判定,不冒绿)', async () => {
    mockFetch.mockResolvedValue({ status: 403, ok: false, text: async () => 'forbidden' })
    const h1 = await grokbotAdapter.checkHealth(makeCtx())
    expect(h1.authFailed).toBe(true)

    mockFetch.mockResolvedValue({ status: 200, ok: true, text: async () => '{"weird":1}' })
    const h2 = await grokbotAdapter.checkHealth(makeCtx())
    expect(h2.ok).toBe(false)
    expect(h2.indeterminate).toBe(true)
    expect(h2.error).toMatch(/未判定/)
  })

  it('5xx ⇒ indeterminate(上游抖动不误杀好号)', async () => {
    mockFetch.mockResolvedValue({ status: 503, ok: false, text: async () => 'unavailable' })
    const health = await grokbotAdapter.checkHealth(makeCtx())
    expect(health.ok).toBe(false)
    expect(health.indeterminate).toBe(true)
    expect(health.authFailed).toBeUndefined()
  })
})

describe('grokbot getQuota(无公开端点 ⇒ 未判定,不发请求)', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('永远 ok:false + 未判定点名 + 不发网络请求(不猜字段)', async () => {
    const q = await grokbotAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(false)
    expect(q.quota).toBeUndefined()
    expect(q.authFailed).toBeUndefined()
    expect(q.error).toMatch(/未判定/)
    expect(q.error).toMatch(/无公开.*端点/)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('grokbot isAuthFailure', () => {
  it('401/403 → true;429/5xx/400 → false', () => {
    expect(grokbotAdapter.isAuthFailure(401, '')).toBe(true)
    expect(grokbotAdapter.isAuthFailure(403, '')).toBe(true)
    expect(grokbotAdapter.isAuthFailure(429, 'rate limited')).toBe(false)
    expect(grokbotAdapter.isAuthFailure(500, 'server error')).toBe(false)
    expect(grokbotAdapter.isAuthFailure(400, 'bad request')).toBe(false)
  })

  it('HTTP 200 但体带鉴权失效文案 → true', () => {
    expect(grokbotAdapter.isAuthFailure(200, '{"error":{"message":"invalid api key"}}')).toBe(true)
    expect(grokbotAdapter.isAuthFailure(200, 'Unauthorized')).toBe(true)
    expect(grokbotAdapter.isAuthFailure(200, 'The token has expired')).toBe(true)
  })
})

describe('grokbot translateStreamChunk / translateNonStream', () => {
  const ctx = makeCtx()
  const state: StreamState = {}

  it('普通 chunk 原样透传;[DONE]/空帧/非 JSON → null', () => {
    const frame = {
      id: 'cmpl-1',
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: { content: 'hi' }, finish_reason: null }],
    }
    const out = grokbotAdapter.translateStreamChunk(ctx, chunkOf(frame), state)
    expect(out?.openaiChunk).toEqual(frame)
    expect(grokbotAdapter.translateStreamChunk(ctx, 'data: [DONE]', state)).toBeNull()
    expect(grokbotAdapter.translateStreamChunk(ctx, '', state)).toBeNull()
  })

  it('{"error":{...}} 帧(HTTP 200 也可能出现)→ done + error', () => {
    const out = grokbotAdapter.translateStreamChunk(
      ctx,
      'data: ' + chunkOf({ error: { message: 'quota exceeded for SuperGrok plan' } }),
      state,
    )
    expect(out?.done).toBe(true)
    expect((out?.openaiChunk['error'] as { code: string }).code).toBe('upstream_error')
    expect((out?.openaiChunk['error'] as { message: string }).message).toMatch(/SuperGrok/)
  })

  it('translateNonStream:HTTP 200 业务错误体 → 抛错(不得当成功)', () => {
    expect(() =>
      grokbotAdapter.translateNonStream(makeCtx(), { error: { code: 'x401', message: 'expired' } }),
    ).toThrow(/x401/)
  })
})

describe('grokbot classifyUpstreamFailure', () => {
  const classify = grokbotAdapter.classifyUpstreamFailure!

  it('429 → rate;套餐/额度文案 → credit', () => {
    expect(classify(429, 'too many requests').kind).toBe('rate')
    expect(classify(402, 'payment required').kind).toBe('credit')
    expect(classify(200, '{"error":{"message":"insufficient credit"}}').kind).toBe('credit')
  })

  it('401/403 → auth;404 → not_found;5xx → server;其他 4xx → client', () => {
    expect(classify(401, '').kind).toBe('auth')
    expect(classify(403, '{"error":{"message":"invalid api key"}}').kind).toBe('auth')
    expect(classify(404, 'no such model').kind).toBe('not_found')
    expect(classify(502, 'bad gateway').kind).toBe('server')
    expect(classify(400, 'bad request').kind).toBe('client')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
