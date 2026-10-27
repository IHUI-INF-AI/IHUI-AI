// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * Loomy 上游适配器 + 本机会话提取器 行为单测(2026-10-27 立)。
 *
 * 覆盖点:
 * - 提取器两态:目录缺失 ⇒ LOOMY_NO_SESSION;目录在盘 ⇒ 形状(leveldb 锚点扫描 +
 *   raw 直通 + meta 零泄漏);os_crypt v10 解密纯函数回路;v20 非 v10 形如实未判定
 * - 适配器:buildChatRequest 推断构造(Bearer 票)、translateStreamChunk 透传、
 *   isAuthFailure(401/403/登录墙/文案)、checkHealth 三态、getQuota 401⇒authFailed
 *   与 200⇒未判定(不猜字段)、classifyUpstreamFailure 状态粗分
 *
 * fetch 全部打桩,不发真实网络请求;提取器全部用临时目录,不碰真实 %APPDATA%。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRequire } from 'node:module'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AdapterAccountContext, StreamState } from '../src/services/relay-upstream-adapters.js'
import {
  loomyAdapter,
  LoomyUpstreamError,
} from '../src/services/upstream-adapters/loomy-adapter.js'

// 提取器是仓级 scripts/lib 下的 .mjs(ESM);TS 测试经 createRequire 加载(避免模块解析面)
const require = createRequire(import.meta.url)
const loomyExtract = require('../../../scripts/lib/loomy-auth-extract.mjs') as {
  extractLoomyAccounts: (opts?: { roamingDir?: string; shellBin?: string }) => Promise<{
    providerCode: string
    accounts: Array<{ source: string; key: string; value: string; host?: string }>
    meta: Record<string, unknown>
  }>
  __test__: {
    decryptOsCryptString: (blob: Buffer, aesKey: Buffer) => string
    finalizeValue: (raw: string) => string | null
    scanLocalStorageEntries: (dir: string) => { entries: unknown[]; skips: string[] }
    summarizeEntry: (e: unknown) => Record<string, unknown>
    pickImportableEntries: (entries: unknown[]) => { valid: unknown[]; skipped: number }
  }
}

const mockFetch = vi.fn()
global.fetch = mockFetch as unknown as typeof fetch

function makeCtx(): AdapterAccountContext {
  return {
    row: { id: 'row-1', providerCode: 'loomy', uid: 'u1', name: 'n' },
    credentials: {
      token: 'loomy-session-token-test',
      refreshToken: null,
      cookies: [],
      secrets: {},
    },
  } as unknown as AdapterAccountContext
}

describe('loomy 提取器:目录缺失 ⇒ NO_SESSION(§0.3 未判定)', () => {
  it('roamingDir 不存在 → throw code=LOOMY_NO_SESSION,消息点名目录', async () => {
    const err = await loomyExtract
      .extractLoomyAccounts({ roamingDir: 'Z:/no/such/ihui-loomy-e2e' })
      .catch((e: NodeJS.ErrnoException) => e)
    expect((err as { code?: string }).code).toBe('LOOMY_NO_SESSION')
    expect(String(err.message)).toMatch(/未找到 Loomy 数据目录/)
  })
})

describe('loomy 提取器:目录在盘 ⇒ 形状(临时目录伪造 leveldb)', () => {
  it('命中 login-phone / loomy-session 键 → raw 直通,meta 零凭证明文', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-loomy-test-'))
    const ldbDir = path.join(dir, 'Local Storage', 'leveldb')
    fs.mkdirSync(ldbDir, { recursive: true })
    const anchor = Buffer.from('_file://\x00\x01', 'latin1')
    const rec1 = Buffer.concat([
      anchor,
      Buffer.from('login-phone'),
      Buffer.from('13800000000'),
      Buffer.from([0x01]),
    ])
    const rec2 = Buffer.concat([
      anchor,
      Buffer.from('loomy-session'),
      Buffer.from('{"token":"tok-loomy-test-123"}'),
      Buffer.from([0x02]),
    ])
    // 干扰项:session_token 作为更长键存在时,短键 session 不得误吞(守卫用例同时占位)
    const rec3 = Buffer.concat([
      anchor,
      Buffer.from('session_token'),
      Buffer.from('tok-longer-key-999'),
      Buffer.from([0x03]),
    ])
    fs.writeFileSync(path.join(ldbDir, '000003.log'), Buffer.concat([rec1, rec2, rec3]))

    const out = await loomyExtract.extractLoomyAccounts({ roamingDir: dir })
    expect(out.providerCode).toBe('loomy')
    const keys = out.accounts.map((a) => a.key).sort()
    expect(keys).toEqual(['login-phone', 'loomy-session', 'session_token'])
    const session = out.accounts.find((a) => a.key === 'loomy-session')
    expect(session?.value).toBe('{"token":"tok-loomy-test-123"}') // raw 直通,零映射
    const phone = out.accounts.find((a) => a.key === 'login-phone')
    expect(phone?.value).toBe('13800000000')

    // meta 零泄漏:值明文不进 meta,只打 sha256 前 12 位指纹/长度
    const flat = JSON.stringify(out.meta)
    expect(flat).not.toContain('tok-loomy-test-123')
    expect(flat).not.toContain('13800000000')
    expect(flat).not.toContain('tok-longer-key-999')
    const sessions = out.meta['sessions'] as Array<Record<string, unknown>>
    expect(sessions).toHaveLength(3)
    for (const s of sessions) {
      expect(String(s['valueFingerprint'])).toMatch(/^[0-9a-f]{12}$/)
      expect(typeof s['valueLength']).toBe('number')
    }
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('os_crypt v10 解密回路:加密 → 解密一致;v20 形 → throw 未判定', () => {
    const key = crypto.randomBytes(32)
    const nonce = crypto.randomBytes(12)
    const plain = 'plain-cookie-value-42'
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce)
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    const blob = Buffer.concat([Buffer.from('v10', 'ascii'), nonce, ct, tag])
    expect(loomyExtract.__test__.decryptOsCryptString(blob, key)).toBe(plain)

    const bad = Buffer.concat([Buffer.from('v20', 'ascii'), nonce, ct, tag])
    expect(() => loomyExtract.__test__.decryptOsCryptString(bad, key)).toThrow(/非 v10\/v11|未判定/)
  })
})

describe('loomy buildChatRequest(推断构造)', () => {
  it('端点/Bearer 头/OpenAI 同构 body 透传', () => {
    const http = loomyAdapter.buildChatRequest(makeCtx(), {
      model: 'glm-5.3',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.7,
      maxTokens: 100,
      stream: true,
    })
    expect(http.url).toBe('https://loomy.xunfei.cn/api/chat/completions')
    expect(http.method).toBe('POST')
    const body = JSON.parse(http.rawBody ?? '') as Record<string, unknown>
    expect(body).toMatchObject({
      model: 'glm-5.3',
      stream: true,
      temperature: 0.7,
      max_tokens: 100,
    })
    expect(http.headers['authorization']).toBe('Bearer loomy-session-token-test')
    expect(http.headers['accept']).toBe('text/event-stream')
  })

  it('缺 token ⇒ 抛错(该账号不可转发)', () => {
    const ctx = makeCtx()
    ctx.credentials.token = ''
    expect(() =>
      loomyAdapter.buildChatRequest(ctx, { model: 'm', messages: [], stream: true }),
    ).toThrow(LoomyUpstreamError)
  })
})

describe('loomy translateStreamChunk / translateNonStream(透传,零映射)', () => {
  const ctx = makeCtx()
  const state: StreamState = {}

  it('JSON 帧原样透传;[DONE]/心跳/空帧 → null', () => {
    const frame = {
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: { content: '你好' }, finish_reason: null }],
    }
    const out = loomyAdapter.translateStreamChunk(ctx, JSON.stringify(frame), state)
    expect(out?.openaiChunk).toEqual(frame)
    expect(loomyAdapter.translateStreamChunk(ctx, 'data: [DONE]', state)).toBeNull()
    expect(loomyAdapter.translateStreamChunk(ctx, ': keep-alive', state)).toBeNull()
    expect(loomyAdapter.translateStreamChunk(ctx, '', state)).toBeNull()
  })

  it('非流式:JSON 对象透传;非对象 ⇒ 抛错(形状未实证 ⇒ 未判定)', () => {
    const body = { id: 'x', choices: [{ message: { content: 'hi' } }] }
    expect(loomyAdapter.translateNonStream(ctx, body)).toEqual(body)
    expect(() => loomyAdapter.translateNonStream(ctx, 'not-object')).toThrow(/非 JSON 对象/)
  })
})

describe('loomy isAuthFailure / isAuthError', () => {
  it('401/403 → true;400/500 → false', () => {
    expect(loomyAdapter.isAuthFailure(401, '')).toBe(true)
    expect(loomyAdapter.isAuthFailure(403, '')).toBe(true)
    expect(loomyAdapter.isAuthFailure(400, 'bad request')).toBe(false)
    expect(loomyAdapter.isAuthFailure(500, 'gateway error')).toBe(false)
  })

  it('HTTP 200 但凭证文案 / HTML 登录墙 → true', () => {
    expect(loomyAdapter.isAuthFailure(200, '{"error":"token expired"}')).toBe(true)
    expect(loomyAdapter.isAuthFailure(200, '请先登录')).toBe(true)
    expect(loomyAdapter.isAuthFailure(200, '<html><head>登录</head></html>')).toBe(true)
  })

  it('isAuthError:结构化 401/403 → true,其余 → false', () => {
    expect(loomyAdapter.isAuthError!(new LoomyUpstreamError(401, 'x'))).toBe(true)
    expect(loomyAdapter.isAuthError!(new LoomyUpstreamError(403, 'x'))).toBe(true)
    expect(loomyAdapter.isAuthError!(new LoomyUpstreamError(500, 'x'))).toBe(false)
    expect(loomyAdapter.isAuthError!(new Error('socket hang up'))).toBe(false)
  })
})

describe('loomy checkHealth(三态,打桩 fetch)', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('401 → ok:false + authFailed:true(明确拒收)', async () => {
    mockFetch.mockResolvedValue({ status: 401, ok: false, text: async () => 'unauthorized' })
    const h = await loomyAdapter.checkHealth(makeCtx())
    expect(h.ok).toBe(false)
    expect(h.authFailed).toBe(true)
    expect(h.indeterminate).toBe(false)
  })

  it('5xx → ok:false + indeterminate(不误杀好号)', async () => {
    mockFetch.mockResolvedValue({ status: 503, ok: false, text: async () => 'boom' })
    const h = await loomyAdapter.checkHealth(makeCtx())
    expect(h.ok).toBe(false)
    expect(h.indeterminate).toBe(true)
    expect(h.authFailed).toBeUndefined()
  })

  it('200 → ok:false + indeterminate(端点推断,无法区分真数据/SPA 兜底页 ⇒ 未判定)', async () => {
    mockFetch.mockResolvedValue({ status: 200, ok: true, text: async () => '{}' })
    const h = await loomyAdapter.checkHealth(makeCtx())
    expect(h.ok).toBe(false)
    expect(h.indeterminate).toBe(true)
    expect(h.error).toMatch(/未判定/)
  })

  it('网络异常 → indeterminate', async () => {
    mockFetch.mockRejectedValue(new Error('socket hang up'))
    const h = await loomyAdapter.checkHealth(makeCtx())
    expect(h.ok).toBe(false)
    expect(h.indeterminate).toBe(true)
  })
})

describe('loomy getQuota(积分制;无公开额度端点 ⇒ 如实未判定)', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('401 → ok:false + authFailed(承载层据此触发自愈摘除)', async () => {
    mockFetch.mockResolvedValue({ status: 401, ok: false, text: async () => 'unauthorized' })
    const q = await loomyAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(false)
    expect(q.authFailed).toBe(true)
    expect(q.error).toMatch(/HTTP 401/)
    expect(q.quota).toBeUndefined()
  })

  it('200 → ok:false 未判定,带响应键名清单(不猜字段读成数字)', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ points: 88, unit: '积分' }),
    })
    const q = await loomyAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(false)
    expect(q.quota).toBeUndefined()
    expect(q.error).toContain('响应键=[points,unit]')
    expect(q.error).toMatch(/未判定/)
  })

  it('200 非 JSON → ok:false 未判定,键=(空)', async () => {
    mockFetch.mockResolvedValue({ status: 200, ok: true, text: async () => 'not-json' })
    const q = await loomyAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(false)
    expect(q.error).toContain('响应键=[(空)]')
  })

  it('请求面:GET 推断额度端点 + Bearer 头', async () => {
    mockFetch.mockResolvedValue({ status: 200, ok: true, text: async () => '{}' })
    await loomyAdapter.getQuota!(makeCtx())
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://loomy.xunfei.cn/api/user/points')
    expect(init.method).toBe('GET')
    expect((init.headers as Record<string, string>)['authorization']).toBe(
      'Bearer loomy-session-token-test',
    )
  })
})

describe('loomy classifyUpstreamFailure / refreshToken', () => {
  const classify = loomyAdapter.classifyUpstreamFailure!

  it('401/403→auth、429→rate、404→not_found、5xx→server、400→request', () => {
    expect(classify(401, '').kind).toBe('auth')
    expect(classify(403, '').kind).toBe('auth')
    expect(classify(429, 'too many').kind).toBe('rate')
    expect(classify(404, 'no such thing').kind).toBe('not_found')
    expect(classify(502, 'bad gateway').kind).toBe('server')
    expect(classify(400, 'bad request').kind).toBe('request')
  })

  it('积分耗尽文案 → credit(积分制平台)', () => {
    expect(classify(200, '{"msg":"积分已用尽"}').kind).toBe('credit')
    expect(classify(402, 'payment required').kind).toBe('credit')
  })

  it('refreshToken 恒 null(无实证刷新端点 ⇒ 无法刷新)', async () => {
    expect(await loomyAdapter.refreshToken!(makeCtx())).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
