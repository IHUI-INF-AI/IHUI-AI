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
 * - 适配器:buildCookieHeader(cookies 逐条直通 / 坏条剔除 / token 兜底 / 双空抛错)、
 *   buildChatRequest(POST /chat/completion 单数端点 + cmd 信封 body + 多轮扁平化)、
 *   translateStreamChunk(三通道增量:CHUNK_DELTA / patch_op / STREAM_MSG_NOTIFY;
 *     end_type 1/2/3;STREAM_ERROR 冒泡;同 block 全量重发去重)、
 *   isAuthFailure(401/403/登录墙)、
 *   checkHealth(2026-11-10 实证判据:POST /im/conversation/batch_get ——
 *     status_code 0 + user_id ⇒ ok;710012001/712012001 ⇒ authFailed;
 *     其他业务码/5xx/形状不符 ⇒ 未判定;行内 doubaoUserId 不符 ⇒ authFailed)、
 *   getQuota 401⇒未判定 与 200⇒未判定(不猜字段)、classifyUpstreamFailure
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
    expect(String(err instanceof Error ? err.message : '')).toMatch(/未找到豆包数据目录/)
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
    // 捆绑单账号(2026-10-28):整套 passport 族 cookie 打成一个账号,不拆逐 cookie 行号池
    expect(out.accounts).toHaveLength(1)
    const bundle = out.accounts[0] as unknown as {
      token: string
      cookies: Array<{ source: string; key: string; host: string; value: string }>
    }
    expect(bundle.cookies.map((c) => c.key).sort()).toEqual([
      'sessionid',
      'sessionid_ss',
      'sid_guard',
    ])
    // 主票按登录判据优先级取:sessionid 最先
    expect(bundle.token).toBe('sess-plain-abc')
    const sessionid = bundle.cookies.find((c) => c.key === 'sessionid')
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
    expect(String(err instanceof Error ? err.message : '')).toMatch(/0 条会话族命中/)
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

  it('cookie 值含非 Latin-1(如 U+FFFD 解码残留)⇒ 剔除该条,保住其余好票', () => {
    const ctx = makeCtx()
    ctx.credentials.cookies = [
      { name: 'sessionid', value: `sess-ok-\uFFFD-tail` },
      { name: 'ttwid', value: 'plain-ascii' },
    ]
    const header = buildCookieHeader(ctx)
    // 2026-11-10 实测:把坏值 percent-encode 后 undici 8.x 仍报
    // `UND_ERR_INVALID_ARG: invalid cookie header` 拒收**整个头**,
    // 会连带废掉其余好票 ⇒ 只能剔除坏条
    expect(header).toBe('ttwid=plain-ascii')
    expect(header).not.toContain('%EF%BF%BD')
  })

  it('cookie 名含分隔符(分号/逗号/空格)同样剔除', () => {
    const ctx = makeCtx()
    ctx.credentials.cookies = [
      { name: 'bad;name', value: 'v' },
      { name: 'has space', value: 'v' },
      { name: 'sessionid', value: 'ok' },
    ]
    expect(buildCookieHeader(ctx)).toBe('sessionid=ok')
  })

  it('token 兜底:纯 ASCII 票直通;含损坏字节则抛错(不伪造可构造的头)', () => {
    const plain = makeCtx()
    plain.credentials.cookies = []
    expect(buildCookieHeader(plain)).toBe(
      'sessionid_ss=doubao-sessionid-test; sessionid=doubao-sessionid-test',
    )
    const dirty = makeCtx()
    dirty.credentials.cookies = []
    dirty.credentials.token = `ticket-\uFFFD-x`
    expect(() => buildCookieHeader(dirty)).toThrow(DoubaoUpstreamError)
  })
})

describe('doubao buildChatRequest(2026-11-10 实证:POST /chat/completion)', () => {
  it('URL 是单数 /chat/completion(不是 /api/chat/completions),query 带 aid/端类型面', () => {
    const http = doubaoAdapter.buildChatRequest(makeCtx(), {
      model: 'doubao-pro',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    })
    expect(http.url.startsWith('https://www.doubao.com/chat/completion?')).toBe(true)
    const u = new URL(http.url)
    expect(u.searchParams.get('aid')).toBe('497858')
    expect(u.searchParams.get('real_aid')).toBe('497858')
    expect(u.searchParams.get('device_platform')).toBe('web')
    expect(u.searchParams.get('samantha_web')).toBe('1')
    // a_bogus 不是硬门(实测不传也 200)⇒ 适配器不该伪造签名
    expect(u.searchParams.get('a_bogus')).toBeNull()
    expect(http.method).toBe('POST')
    expect(http.headers['cookie']).toBe('sessionid=sess-cookie-1; ttwid=ttw-1')
    expect(http.headers['referer']).toBe('https://www.doubao.com/chat/')
    expect(http.headers['agw-js-conv']).toBe('str, str')
  })

  it('body 是 cmd 信封:content_block[block_type=10000].text_block.text 承载 prompt', () => {
    const http = doubaoAdapter.buildChatRequest(makeCtx(), {
      model: 'x',
      messages: [{ role: 'user', content: '1+1等于几' }],
      stream: true,
    })
    const body = JSON.parse(http.rawBody ?? '') as any
    expect(body.messages).toHaveLength(1)
    expect(body.messages[0].content_block[0].block_type).toBe(10000)
    expect(body.messages[0].content_block[0].content.text_block.text).toBe('1+1等于几')
    expect(body.client_meta.bot_id).toBe('7338286299411103781')
    // 三个开关缺一,上游不下发 CHUNK_DELTA ⇒ 只剩 patch 通道会丢字
    expect(body.option.sse_recv_event_options.support_chunk_delta).toBe(true)
    expect(body.option.agent_mode).toBe(2)
    expect(body.option.conversation_mode).toBe(1)
  })

  it('单条 user 逐字直传;多轮压成带角色标签的一段(豆包一条请求只收一条消息)', () => {
    const single = JSON.parse(
      doubaoAdapter.buildChatRequest(makeCtx(), {
        model: 'x',
        messages: [{ role: 'user', content: '你好' }],
        stream: true,
      }).rawBody!,
    ) as any
    expect(single.messages[0].content_block[0].content.text_block.text).toBe('你好')

    const multi = JSON.parse(
      doubaoAdapter.buildChatRequest(makeCtx(), {
        model: 'x',
        messages: [
          { role: 'system', content: '只回答数字' },
          { role: 'user', content: '2+3' },
        ],
        stream: true,
      }).rawBody!,
    ) as any
    const flat = multi.messages[0].content_block[0].content.text_block.text as string
    expect(flat).toContain('[系统指令] 只回答数字')
    expect(flat).toContain('[用户] 2+3')
  })

  it('自有 conversationId 不冒充豆包会话 id;纯数字长串才透传', () => {
    const own = JSON.parse(
      doubaoAdapter.buildChatRequest(makeCtx(), {
        model: 'x',
        messages: [{ role: 'user', content: 'a' }],
        stream: true,
        conversationId: 'sess_abc',
      }).rawBody!,
    ) as any
    expect(own.client_meta.conversation_id).toBe('')
    expect(own.option.need_create_conversation).toBe(true)

    const doubao = JSON.parse(
      doubaoAdapter.buildChatRequest(makeCtx(), {
        model: 'x',
        messages: [{ role: 'user', content: 'a' }],
        stream: true,
        conversationId: '38452907617626882',
      }).rawBody!,
    ) as any
    expect(doubao.client_meta.conversation_id).toBe('38452907617626882')
    expect(doubao.option.need_create_conversation).toBe(false)
  })
})

describe('doubao translateStreamChunk(2026-11-10 实证:三通道增量)', () => {
  const ctx = makeCtx()
  const mk = (): StreamState => ({}) as StreamState
  const pick = (o?: TranslatedChunk | null): string => {
    const ch = o?.openaiChunk as any
    const c = ch?.choices?.[0]?.delta?.content
    return typeof c === 'string' ? c : ''
  }
  const notify = (id: string, t: string) => ({
    content: {
      content_block: [{ block_id: id, block_type: 10000, content: { text_block: { text: t } } }],
    },
  })
  const patch = (id: string, t: string) => ({
    patch_op: [
      {
        patch_object: 1,
        patch_type: 1,
        patch_value: {
          content_block: [
            { block_id: id, block_type: 10000, content: { text_block: { text: t } } },
          ],
        },
      },
    ],
  })

  it('CHUNK_DELTA(obj.text)是增量文本', () => {
    const s = mk()
    expect(pick(doubaoAdapter.translateStreamChunk(ctx, 'data: {"text":"="}', s))).toBe('=')
  })

  it('STREAM_CHUNK patch:只取 block_type=10000,忽略 loading(10101)/tts(111)/ext(50)', () => {
    const s = mk()
    const feed = (o: unknown) =>
      doubaoAdapter.translateStreamChunk(ctx, 'data: ' + JSON.stringify(o), s)
    expect(
      feed({
        patch_op: [
          {
            patch_object: 1,
            patch_value: {
              content_block: [{ block_type: 10101, content: { loading_block: { scene: 2 } } }],
            },
          },
        ],
      }),
    ).toBeNull()
    expect(
      feed({ patch_op: [{ patch_object: 111, patch_value: { tts_content: 'x' } }] }),
    ).toBeNull()
    expect(
      feed({ patch_op: [{ patch_object: 50, patch_value: { ext: { is_finish: '1' } } }] }),
    ).toBeNull()
    expect(
      feed({ patch_op: [{ patch_object: 3, patch_value: { content_status: 100 } }] }),
    ).toBeNull()
    expect(pick(feed(patch('b1', '+')))).toBe('+')
  })

  it('STREAM_MSG_NOTIFY(obj.content.content_block)也收 —— 短回答首字只在这条通道', () => {
    const s = mk()
    expect(
      pick(
        doubaoAdapter.translateStreamChunk(ctx, 'data: ' + JSON.stringify(notify('b0', '1')), s),
      ),
    ).toBe('1')
  })

  it('同 block 全量重发只吐新增尾巴,同串重发返回 null', () => {
    const s = mk()
    const push = (t: string) =>
      doubaoAdapter.translateStreamChunk(ctx, 'data: ' + JSON.stringify(notify('b9', t)), s)
    expect(pick(push('1'))).toBe('1')
    expect(pick(push('1+'))).toBe('+')
    expect(pick(push('1+1'))).toBe('1')
    expect(push('1+1')).toBeNull()
  })

  it('三通道合成完整答案(实测「1+1等于几」→ 1+1=2,任何单通道都少字)', () => {
    const s = mk()
    const feed = (o: unknown) =>
      pick(doubaoAdapter.translateStreamChunk(ctx, 'data: ' + JSON.stringify(o), s))
    let answer = ''
    answer += feed(notify('b0', '1')) // 首字
    answer += feed(patch('b0', '+')) // patch 追加
    answer += feed({ text: '1' }) // CHUNK_DELTA
    answer += feed({ text: '=' })
    answer += feed({ text: '2' })
    expect(answer).toBe('1+1=2')
  })

  it('end_type:1/2 不是终点,3 才是(done + finish_reason=stop)', () => {
    const s = mk()
    expect(doubaoAdapter.translateStreamChunk(ctx, 'data: {"end_type":1}', s)).toBeNull()
    expect(doubaoAdapter.translateStreamChunk(ctx, 'data: {"end_type":2}', s)).toBeNull()
    const end = doubaoAdapter.translateStreamChunk(ctx, 'data: {"end_type":3}', s)
    expect(end?.done).toBe(true)
    expect((end?.openaiChunk as any).choices[0].finish_reason).toBe('stop')
  })

  it('STREAM_ERROR 必须冒泡:限流码归 429(可冷却),其余归 502', () => {
    const s = mk()
    let limited: unknown = null
    try {
      doubaoAdapter.translateStreamChunk(
        ctx,
        'data: {"error_code":710022004,"error_msg":"rate limited"}',
        s,
      )
    } catch (e) {
      limited = e
    }
    expect(limited).toBeInstanceOf(Error)
    expect((limited as { statusCode?: number }).statusCode).toBe(429)
    expect(String((limited as Error).message)).toMatch(/rate limited/)

    let other: unknown = null
    try {
      doubaoAdapter.translateStreamChunk(ctx, 'data: {"error_code":123,"error_msg":"boom"}', s)
    } catch (e) {
      other = e
    }
    expect((other as { statusCode?: number }).statusCode).toBe(502)
  })

  it('心跳/空帧/非 JSON 帧 → null(不产出空 delta)', () => {
    const s = mk()
    expect(doubaoAdapter.translateStreamChunk(ctx, 'data: {}', s)).toBeNull()
    expect(doubaoAdapter.translateStreamChunk(ctx, 'data: [DONE]', s)).toBeNull()
    expect(doubaoAdapter.translateStreamChunk(ctx, ': keep-alive', s)).toBeNull()
  })

  it('非流式:JSON 对象透传;非对象 ⇒ 抛错(形状不符)', () => {
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

describe('doubao checkHealth(2026-11-10 实证判据:IM batch_get)', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  /** 真票形态:status_code 0 + downlink 里的真实 user_id */
  const imOk = (userId: string) => ({
    status: 200,
    ok: true,
    text: async () =>
      JSON.stringify({
        cmd: 1111,
        status_code: 0,
        status_desc: 'OK',
        downlink_body: {
          batch_get_conv_info_downlink_body: { user_id: userId, conversation_info_list: [] },
        },
      }),
  })

  const imBiz = (statusCode: number, statusDesc: string) => ({
    status: 200,
    ok: true,
    text: async () =>
      JSON.stringify({ cmd: 1111, status_code: statusCode, status_desc: statusDesc }),
  })

  it('status_code=0 且带 user_id ⇒ ok:true(真票正例,2026-11-10 实弹)', async () => {
    mockFetch.mockResolvedValue(imOk('59830099522953'))
    const h = await doubaoAdapter.checkHealth(makeCtx())
    expect(h.ok).toBe(true)
    expect(h.authFailed).toBeUndefined()
    expect(h.indeterminate).toBeUndefined()
  })

  it('status_code=712012001「登录校验不合法」⇒ authFailed(空票实测反例)', async () => {
    mockFetch.mockResolvedValue(imBiz(712012001, '登录校验不合法'))
    const h = await doubaoAdapter.checkHealth(makeCtx())
    expect(h.ok).toBe(false)
    expect(h.authFailed).toBe(true)
    expect(h.indeterminate).toBeUndefined()
    expect(h.error).toContain('712012001')
  })

  it('status_code=710012001「登录已过期」(samantha 面同族码)也归 authFailed', async () => {
    mockFetch.mockResolvedValue(imBiz(710012001, '登录已过期，请重新登录'))
    const h = await doubaoAdapter.checkHealth(makeCtx())
    expect(h.authFailed).toBe(true)
  })

  it('其他业务码(如 712012002 编码类型错)⇒ 未判定,绝不判死', async () => {
    mockFetch.mockResolvedValue(imBiz(712012002, '不支持编码类型'))
    const h = await doubaoAdapter.checkHealth(makeCtx())
    expect(h.ok).toBe(false)
    expect(h.indeterminate).toBe(true)
    expect(h.authFailed).toBeUndefined()
  })

  it('status_code=0 但响应无 user_id ⇒ 未判定(形状不符,不冒绿)', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ status_code: 0, downlink_body: {} }),
    })
    const h = await doubaoAdapter.checkHealth(makeCtx())
    expect(h.ok).toBe(false)
    expect(h.indeterminate).toBe(true)
  })

  it('HTTP 401/403 ⇒ authFailed(上游明确拒收)', async () => {
    mockFetch.mockResolvedValue({ status: 401, ok: false, text: async () => '' })
    const h = await doubaoAdapter.checkHealth(makeCtx())
    expect(h.authFailed).toBe(true)
  })

  it('5xx ⇒ 未判定(不误杀好号)', async () => {
    mockFetch.mockResolvedValue({ status: 503, ok: false, text: async () => 'boom' })
    const h = await doubaoAdapter.checkHealth(makeCtx())
    expect(h.ok).toBe(false)
    expect(h.indeterminate).toBe(true)
    expect(h.authFailed).toBeUndefined()
  })

  it('响应非 JSON ⇒ 未判定', async () => {
    mockFetch.mockResolvedValue({ status: 200, ok: true, text: async () => '<html>spa</html>' })
    const h = await doubaoAdapter.checkHealth(makeCtx())
    expect(h.indeterminate).toBe(true)
  })

  it('user_id 与本行登记不符 ⇒ authFailed(票被换/顶号防线)', async () => {
    const ctx = makeCtx()
    ;(ctx.row as unknown as Record<string, unknown>)['extraMetadata'] = {
      doubaoUserId: '59830099522953',
    }
    // 实测:伪造 sessionid 会被派一个游客 id(3018599589489431)
    mockFetch.mockResolvedValue(imOk('3018599589489431'))
    const h = await doubaoAdapter.checkHealth(ctx)
    expect(h.authFailed).toBe(true)
    expect(h.error).toContain('不属于本行账号')
  })

  it('行内已登记且 user_id 一致 ⇒ ok:true', async () => {
    const ctx = makeCtx()
    ;(ctx.row as unknown as Record<string, unknown>)['extraMetadata'] = {
      doubaoUserId: '59830099522953',
    }
    mockFetch.mockResolvedValue(imOk('59830099522953'))
    const h = await doubaoAdapter.checkHealth(ctx)
    expect(h.ok).toBe(true)
  })

  it('请求面:POST /im/conversation/batch_get + 必需 query + encoding=utf-8', async () => {
    mockFetch.mockResolvedValue(imOk('59830099522953'))
    await doubaoAdapter.checkHealth(makeCtx())
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url.startsWith('https://www.doubao.com/im/conversation/batch_get?')).toBe(true)
    expect(url).toContain('aid=497858')
    expect(url).toContain('real_aid=497858')
    expect(url).toContain('device_platform=web')
    expect(url).toContain('version_code=20800')
    expect(init.method).toBe('POST')
    const hdr = init.headers as Record<string, string>
    // 实证:缺 encoding=utf-8 会被回 712012002「不支持编码类型」
    expect(hdr['content-type']).toBe('application/json; encoding=utf-8')
    expect(hdr['agw-js-conv']).toBe('str')
  })

  it('损坏 cookie 被剔除,不能整头进 HTTP(undici invalid cookie header 防线)', async () => {
    const ctx = makeCtx()
    ctx.credentials.cookies = [
      { name: 'sessionid', value: 'sess-cookie-1' },
      // 实测本号 msToken 首字节就是 U+FFFD
      { name: 'msToken', value: '\uFFFDabc' },
      { name: 'sid-guard-x', value: 'v' },
    ]
    mockFetch.mockResolvedValue(imOk('59830099522953'))
    const h = await doubaoAdapter.checkHealth(ctx)
    expect(h.ok).toBe(true)
    // 如实报出坏项,而不是静默丢弃
    expect(h.error).toContain('msToken')
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    const cookie = (init.headers as Record<string, string>)['cookie']
    expect(cookie).toBe('sessionid=sess-cookie-1; sid-guard-x=v')
    expect(cookie).not.toContain('msToken')
    expect(cookie).not.toContain('%EF%BF%BD')
  })

  it('opts.fetchImpl 注入缝优先于全局 fetch', async () => {
    const injected = vi.fn().mockResolvedValue(imOk('59830099522953'))
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
