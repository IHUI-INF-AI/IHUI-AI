// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 豆包上游适配器 + 本机会话提取器 行为单测(2026-10-27 立)。
 *
 * 覆盖点:
 * - 提取器两态:数据目录缺失 ⇒ DOUBAO_NO_SESSION;目录在盘 ⇒ 形状(临时 Cookies sqlite:
 *   .doubao.com 会话族 raw 直通、meta 零泄漏、外域/非会话键被滤、v20 非 v10 形如实未判定);
 *   os_crypt v10 解密纯函数回路(不触 DPAPI)
 * - 适配器:buildCookieHeader(cookies 整包直通 / token 兜底推断 / 双空抛错)、
 *   buildChatRequest 推断构造、translateStreamChunk 透传、isAuthFailure(401/403/登录墙)、
 *   checkHealth 三态、getQuota 401⇒authFailed 与 200⇒未判定(不猜字段)、classifyUpstreamFailure
 *
 * fetch 全部打桩,不发真实网络请求;提取器全部用临时目录,不碰真实 %LOCALAPPDATA%。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRequire } from 'node:module'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AdapterAccountContext, StreamState } from '../src/services/relay-upstream-adapters.js'
import {
  buildCookieHeader,
  doubaoAdapter,
  DoubaoUpstreamError,
} from '../src/services/upstream-adapters/doubao-adapter.js'

// 提取器是仓级 scripts/lib 下的 .mjs(ESM);TS 测试经 createRequire 加载(避免模块解析面)
const require = createRequire(import.meta.url)
const doubaoExtract = require('../../../scripts/lib/doubao-auth-extract.mjs') as {
  extractDoubaoAccounts: (opts?: {
    userDataDir?: string
    profile?: string
    shellBin?: string
  }) => Promise<{
    providerCode: string
    accounts: Array<{ source: string; key: string; value: string; host?: string }>
    meta: Record<string, unknown>
  }>
  __test__: {
    decryptOsCryptString: (blob: Buffer, aesKey: Buffer) => string
    pickImportableEntries: (entries: unknown[]) => { valid: unknown[]; skipped: number }
    SESSION_COOKIE_NAMES: string[]
  }
}

const mockFetch = vi.fn()
global.fetch = mockFetch as unknown as typeof fetch

function makeCtx(): AdapterAccountContext {
  return {
    row: { id: 'row-1', providerCode: 'doubao', uid: 'u1', name: 'n' },
    credentials: {
      token: 'doubao-sessionid-test',
      refreshToken: null,
      cookies: [
        { name: 'sessionid', value: 'sess-cookie-1' },
        { name: 'ttwid', value: 'ttw-1' },
      ],
      secrets: {},
    },
  } as unknown as AdapterAccountContext
}

/** 造一个带 Chrome cookies 表形状的临时 User Data 目录 */
function makeFakeUserDataDir(
  rows: Array<{ host: string; name: string; value: string; enc?: Buffer }>,
) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-doubao-test-'))
  const netDir = path.join(dir, 'Default', 'Network')
  fs.mkdirSync(netDir, { recursive: true })
  // node:sqlite(22.x experimental)经 createRequire 取用(与提取器同法)
  const sqliteRequire = createRequire(import.meta.url)
  const { DatabaseSync } = sqliteRequire('node:sqlite') as {
    DatabaseSync: new (
      p: string,
      o?: { readOnly?: boolean },
    ) => {
      exec: (sql: string) => void
      prepare: (sql: string) => { run: (...args: unknown[]) => void }
      close: () => void
    }
  }
  const db = new DatabaseSync(path.join(netDir, 'Cookies'))
  db.exec('CREATE TABLE cookies (host_key TEXT, name TEXT, value TEXT, encrypted_value BLOB)')
  const ins = db.prepare(
    'INSERT INTO cookies (host_key, name, value, encrypted_value) VALUES (?, ?, ?, ?)',
  )
  for (const r of rows) ins.run(r.host, r.name, r.value, r.enc ?? null)
  db.close()
  return dir
}

describe('doubao 提取器:目录缺失 ⇒ NO_SESSION(§0.3 未判定)', () => {
  it('userDataDir 不存在 → throw code=DOUBAO_NO_SESSION,消息点名目录', async () => {
    const err = await doubaoExtract
      .extractDoubaoAccounts({ userDataDir: 'Z:/no/such/ihui-doubao-e2e' })
      .catch((e: NodeJS.ErrnoException) => e)
    expect((err as { code?: string }).code).toBe('DOUBAO_NO_SESSION')
    expect(String(err.message)).toMatch(/未找到豆包数据目录/)
  })
})

describe('doubao 提取器:目录在盘 ⇒ 形状(临时 Cookies sqlite)', () => {
  it('.doubao.com 会话族 raw 直通;外域/非会话键被滤;v20 形如实未判定;meta 零泄漏', async () => {
    const dir = makeFakeUserDataDir([
      { host: '.doubao.com', name: 'sessionid', value: 'sess-plain-abc' },
      { host: '.doubao.com', name: 'sessionid_ss', value: 'sess-plain-xyz' },
      { host: '.doubao.com', name: 'sid_guard', value: 'guard-123' },
      // 干扰:外域(不匹配 host 后缀)与非会话键名(passport_csrf_token 不在会话族清单)
      { host: '.bing.com', name: 'MUID', value: 'noise-bing' },
      { host: '.doubao.com', name: 'passport_csrf_token', value: 'csrf-noise' },
      // 干扰:v20(app-bound)形密文 → skipped 点名,不得影响其余条目
      {
        host: '.doubao.com',
        name: 'ttwid',
        value: '',
        enc: Buffer.concat([Buffer.from('v20'), Buffer.alloc(48, 7)]),
      },
    ])

    const out = await doubaoExtract.extractDoubaoAccounts({ userDataDir: dir })
    expect(out.providerCode).toBe('doubao')
    const keys = out.accounts.map((a) => a.key).sort()
    expect(keys).toEqual(['sessionid', 'sessionid_ss', 'sid_guard'])
    const sessionid = out.accounts.find((a) => a.key === 'sessionid')
    expect(sessionid).toMatchObject({
      source: 'cookies',
      host: '.doubao.com',
      value: 'sess-plain-abc',
    })

    const notes = JSON.stringify(out.meta['notes'] ?? '')
    expect(notes).toContain('ttwid')
    expect(notes).toMatch(/未判定/)

    // meta 零泄漏:值明文不进 meta,只打 sha256 前 12 位指纹/长度
    const flat = JSON.stringify(out.meta)
    expect(flat).not.toContain('sess-plain-abc')
    expect(flat).not.toContain('sess-plain-xyz')
    expect(flat).not.toContain('guard-123')
    expect(flat).not.toContain('csrf-noise')
    const sessions = out.meta['sessions'] as Array<Record<string, unknown>>
    expect(sessions).toHaveLength(3)
    for (const s of sessions) {
      expect(String(s['valueFingerprint'])).toMatch(/^[0-9a-f]{12}$/)
      expect(typeof s['valueLength']).toBe('number')
    }
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('Cookies 库在盘但 0 条会话族命中 → DOUBAO_NO_SESSION', async () => {
    const dir = makeFakeUserDataDir([{ host: '.bing.com', name: 'MUID', value: 'noise' }])
    const err = await doubaoExtract
      .extractDoubaoAccounts({ userDataDir: dir })
      .catch((e: NodeJS.ErrnoException) => e)
    expect((err as { code?: string }).code).toBe('DOUBAO_NO_SESSION')
    expect(String(err.message)).toMatch(/0 条会话族命中/)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('os_crypt v10 解密回路:加密 → 解密一致;v20 形 → throw 未判定(纯函数,不触 DPAPI)', () => {
    const key = crypto.randomBytes(32)
    const nonce = crypto.randomBytes(12)
    const plain = 'plain-cookie-value-42'
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce)
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    const blob = Buffer.concat([Buffer.from('v10', 'ascii'), nonce, ct, tag])
    expect(doubaoExtract.__test__.decryptOsCryptString(blob, key)).toBe(plain)

    const bad = Buffer.concat([Buffer.from('v20', 'ascii'), nonce, ct, tag])
    expect(() => doubaoExtract.__test__.decryptOsCryptString(bad, key)).toThrow(
      /非 v10\/v11|未判定/,
    )
  })
})

describe('doubao buildCookieHeader(推断层)', () => {
  it('cookies 整包直通(name=value 逐条拼接,零字段改写)', () => {
    expect(buildCookieHeader(makeCtx())).toBe('sessionid=sess-cookie-1; ttwid=ttw-1')
  })

  it('cookies 为空且 token 在 → token 充 sessionid_ss/sessionid(推断映射,注释标明)', () => {
    const ctx = makeCtx()
    ctx.credentials.cookies = []
    expect(buildCookieHeader(ctx)).toBe(
      'sessionid_ss=doubao-sessionid-test; sessionid=doubao-sessionid-test',
    )
  })

  it('cookies 与 token 双空 ⇒ 抛错(该账号不可转发)', () => {
    const ctx = makeCtx()
    ctx.credentials.cookies = []
    ctx.credentials.token = ''
    expect(() => buildCookieHeader(ctx)).toThrow(DoubaoUpstreamError)
  })
})

describe('doubao buildChatRequest(推断构造)', () => {
  it('端点/Cookie 头/OpenAI 同构 body 透传', () => {
    const http = doubaoAdapter.buildChatRequest(makeCtx(), {
      model: 'doubao-pro',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.7,
      maxTokens: 100,
      stream: true,
    })
    expect(http.url).toBe('https://www.doubao.com/api/chat/completions')
    expect(http.method).toBe('POST')
    const body = JSON.parse(http.rawBody ?? '') as Record<string, unknown>
    expect(body).toMatchObject({
      model: 'doubao-pro',
      stream: true,
      temperature: 0.7,
      max_tokens: 100,
    })
    expect(http.headers['cookie']).toBe('sessionid=sess-cookie-1; ttwid=ttw-1')
    expect(http.headers['accept']).toBe('text/event-stream')
    expect(http.headers['referer']).toBe('https://www.doubao.com/')
  })
})

describe('doubao translateStreamChunk / translateNonStream(透传,零映射)', () => {
  const ctx = makeCtx()
  const state: StreamState = {}

  it('JSON 帧原样透传;[DONE]/心跳/空帧 → null', () => {
    const frame = {
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: { content: '你好' }, finish_reason: null }],
    }
    const out = doubaoAdapter.translateStreamChunk(ctx, 'data: ' + JSON.stringify(frame), state)
    expect(out?.openaiChunk).toEqual(frame)
    expect(doubaoAdapter.translateStreamChunk(ctx, 'data: [DONE]', state)).toBeNull()
    expect(doubaoAdapter.translateStreamChunk(ctx, ': keep-alive', state)).toBeNull()
  })

  it('非流式:JSON 对象透传;非对象 ⇒ 抛错(形状未实证 ⇒ 未判定)', () => {
    const body = { id: 'x', choices: [{ message: { content: 'hi' } }] }
    expect(doubaoAdapter.translateNonStream(ctx, body)).toEqual(body)
    expect(() => doubaoAdapter.translateNonStream(ctx, 'not-object')).toThrow(/非 JSON 对象/)
  })
})

describe('doubao isAuthFailure / isAuthError', () => {
  it('401/403 → true;400/500 → false', () => {
    expect(doubaoAdapter.isAuthFailure(401, '')).toBe(true)
    expect(doubaoAdapter.isAuthFailure(403, '')).toBe(true)
    expect(doubaoAdapter.isAuthFailure(400, 'bad request')).toBe(false)
    expect(doubaoAdapter.isAuthFailure(500, 'gateway error')).toBe(false)
  })

  it('HTTP 200 但凭证文案 / HTML 登录墙 → true', () => {
    expect(doubaoAdapter.isAuthFailure(200, '{"error":"未登录"}')).toBe(true)
    expect(doubaoAdapter.isAuthFailure(200, '<html><body>Please Login</body></html>')).toBe(true)
  })

  it('isAuthError:结构化 401/403 → true,其余 → false', () => {
    expect(doubaoAdapter.isAuthError!(new DoubaoUpstreamError(401, 'x'))).toBe(true)
    expect(doubaoAdapter.isAuthError!(new DoubaoUpstreamError(403, 'x'))).toBe(true)
    expect(doubaoAdapter.isAuthError!(new DoubaoUpstreamError(429, 'x'))).toBe(false)
    expect(doubaoAdapter.isAuthError!(new Error('socket hang up'))).toBe(false)
  })
})

describe('doubao checkHealth(三态,打桩 fetch)', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('401 → ok:false + indeterminate(2026-10-27 实弹:签名墙 401 与失效不可区分,不误杀)', async () => {
    mockFetch.mockResolvedValue({ status: 401, ok: false, text: async () => 'unauthorized' })
    const h = await doubaoAdapter.checkHealth(makeCtx())
    expect(h.ok).toBe(false)
    expect(h.indeterminate).toBe(true)
    expect(h.authFailed).toBeUndefined()
    expect(h.error).toMatch(/签名墙/)
  })

  it('5xx → ok:false + indeterminate(不误杀好号)', async () => {
    mockFetch.mockResolvedValue({ status: 503, ok: false, text: async () => 'boom' })
    const h = await doubaoAdapter.checkHealth(makeCtx())
    expect(h.ok).toBe(false)
    expect(h.indeterminate).toBe(true)
    expect(h.authFailed).toBeUndefined()
  })

  it('200 → ok:false + indeterminate(端点推断,无法区分真数据/SPA 兜底页 ⇒ 未判定)', async () => {
    mockFetch.mockResolvedValue({ status: 200, ok: true, text: async () => '{}' })
    const h = await doubaoAdapter.checkHealth(makeCtx())
    expect(h.ok).toBe(false)
    expect(h.indeterminate).toBe(true)
    expect(h.error).toMatch(/未判定/)
  })

  it('opts.fetchImpl 注入缝优先于全局 fetch', async () => {
    const injected = vi.fn().mockResolvedValue({ status: 200, ok: true, text: async () => '{}' })
    mockFetch.mockResolvedValue({ status: 500, ok: false, text: async () => 'boom' })
    await doubaoAdapter.checkHealth(makeCtx(), { fetchImpl: injected as unknown as typeof fetch })
    expect(injected).toHaveBeenCalledTimes(1)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('doubao getQuota(无公开额度端点 ⇒ 如实未判定)', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('401 → ok:false 未判定(签名墙 401 与凭证失效不可区分,2026-10-27 实弹)', async () => {
    mockFetch.mockResolvedValue({ status: 401, ok: false, text: async () => 'unauthorized' })
    const q = await doubaoAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(false)
    expect(q.authFailed).toBeUndefined()
    expect(q.error).toMatch(/HTTP 401/)
    expect(q.error).toMatch(/签名墙/)
    expect(q.quota).toBeUndefined()
  })

  it('200 → ok:false 未判定,带响应键名清单(不猜字段读成数字)', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ credit: 66, unit: '算力' }),
    })
    const q = await doubaoAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(false)
    expect(q.quota).toBeUndefined()
    expect(q.error).toContain('响应键=[credit,unit]')
    expect(q.error).toMatch(/未判定/)
  })

  it('200 非 JSON → ok:false 未判定,键=(空)', async () => {
    mockFetch.mockResolvedValue({ status: 200, ok: true, text: async () => 'not-json' })
    const q = await doubaoAdapter.getQuota!(makeCtx())
    expect(q.ok).toBe(false)
    expect(q.error).toContain('响应键=[(空)]')
  })

  it('请求面:GET 推断额度端点 + Cookie 头', async () => {
    mockFetch.mockResolvedValue({ status: 200, ok: true, text: async () => '{}' })
    await doubaoAdapter.getQuota!(makeCtx())
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://www.doubao.com/api/user/quota')
    expect(init.method).toBe('GET')
    expect((init.headers as Record<string, string>)['cookie']).toBe(
      'sessionid=sess-cookie-1; ttwid=ttw-1',
    )
  })
})

describe('doubao classifyUpstreamFailure / refreshToken', () => {
  const classify = doubaoAdapter.classifyUpstreamFailure!

  it('401/403→auth、429→rate、404→not_found、5xx→server、400→request', () => {
    expect(classify(401, '').kind).toBe('auth')
    expect(classify(403, '').kind).toBe('auth')
    expect(classify(429, 'too many').kind).toBe('rate')
    expect(classify(404, 'no such thing').kind).toBe('not_found')
    expect(classify(502, 'bad gateway').kind).toBe('server')
    expect(classify(400, 'bad request').kind).toBe('request')
  })

  it('积分/算力耗尽文案 → credit', () => {
    expect(classify(200, '{"msg":"算力已用尽"}').kind).toBe('credit')
    expect(classify(402, 'payment required').kind).toBe('credit')
  })

  it('refreshToken 恒 null(无实证刷新端点 ⇒ 无法刷新,轮转靠重登)', async () => {
    expect(await doubaoAdapter.refreshToken!(makeCtx())).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
