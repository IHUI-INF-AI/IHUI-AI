// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-104 回归锁(2026-11-08)。
 *
 * 缺陷:音频/声纹 5 个端点(speech/recognize/chat/speaker.register/speaker.compare)
 *      统一用平台 DASHSCOPE_API_KEY,无余额闸、无结算,可脚本无限白嫖。
 * 判据:余额<=0 → 402 且不打上游;成功后按次扣 2 分。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUserPoints: vi.fn(),
  spendPoints: vi.fn(),
  fetch: vi.fn(),
}))

vi.mock('../src/db/gamification-queries.js', () => ({ findUserPoints: mocks.findUserPoints }))
vi.mock('../src/services/points-service.js', () => ({ spendPoints: mocks.spendPoints }))
vi.mock('../src/utils/fetch-deadline.js', () => ({
  fetchWithinDeadline: mocks.fetch,
  isDeadlineAbort: () => false,
}))
vi.mock('../src/plugins/auth.js', () => ({ checkAuth: vi.fn(async () => true) }))
vi.mock('../src/plugins/ws-helpers.js', () => ({
  wsUpgradeRequiresCredential: () => () => undefined,
}))
vi.mock('@ihui/auth', () => ({ verifyAccessToken: vi.fn() }))

import { aiAudioRoutes } from '../src/routes/ai-audio.js'

type ReplyMock = {
  statusCode: number
  body: unknown
  sent: boolean
  status(c: number): ReplyMock
  header(_k: string, _v: string): ReplyMock
  send(b: unknown): ReplyMock
}

function makeReply(): ReplyMock {
  return {
    statusCode: 200,
    body: undefined,
    sent: false,
    status(c: number) {
      this.statusCode = c
      return this
    },
    header() {
      return this
    },
    send(b: unknown) {
      this.body = b
      this.sent = true
      return this
    },
  }
}

type Handler = (request: unknown, reply: unknown) => unknown
const handlers = new Map<string, Handler>()
const server = {
  addHook: () => undefined,
  get: (p: string, ...a: unknown[]) => handlers.set(`GET ${p}`, a[a.length - 1] as Handler),
  post: (p: string, ...a: unknown[]) => handlers.set(`POST ${p}`, a[a.length - 1] as Handler),
  delete: (p: string, ...a: unknown[]) => handlers.set(`DELETE ${p}`, a[a.length - 1] as Handler),
}
await aiAudioRoutes(server as never, {} as never)

const REQUEST = { userId: 'u1', id: 'req-a' }

beforeEach(() => {
  process.env.DASHSCOPE_API_KEY = 'test-dashscope'
  mocks.findUserPoints.mockReset().mockResolvedValue({ points: 100 })
  mocks.spendPoints.mockReset().mockResolvedValue({ balance: 98 })
  mocks.fetch.mockReset()
})

describe('F-104 余额闸', () => {
  it('/audio/speech 余额 0 → 402 且不调用上游', async () => {
    mocks.findUserPoints.mockResolvedValue({ points: 0 })
    const reply = makeReply()
    await handlers.get('POST /audio/speech')!({ ...REQUEST, body: { text: '你好' } }, reply)
    expect(reply.statusCode).toBe(402)
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.spendPoints).not.toHaveBeenCalled()
  })

  it('/audio/recognize 余额 0 → 402 且不调用上游', async () => {
    mocks.findUserPoints.mockResolvedValue({ points: 0 })
    const reply = makeReply()
    await handlers.get('POST /audio/recognize')!(
      { ...REQUEST, body: { audio_url: 'https://a/x.wav' } },
      reply,
    )
    expect(reply.statusCode).toBe(402)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
})

describe('F-104 成功结算(每次 2 分)', () => {
  it('TTS 返回音频流 → 扣分', async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'audio/mp3' },
      arrayBuffer: async () => new ArrayBuffer(8),
    })
    const reply = makeReply()
    await handlers.get('POST /audio/speech')!({ ...REQUEST, body: { text: '你好' } }, reply)
    expect(reply.statusCode).toBe(200)
    expect(mocks.spendPoints).toHaveBeenCalledWith(
      'u1',
      2,
      'ai_call',
      expect.stringContaining('TTS'),
      'req-a',
    )
  })

  it('语音识别(qwen3-asr)成功 → 扣分', async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ output: { choices: [{ message: { content: [{ text: '转写' }] } }] } }),
    })
    const reply = makeReply()
    await handlers.get('POST /audio/recognize')!(
      { ...REQUEST, body: { audio_url: 'https://a/x.wav', model: 'qwen3-asr' } },
      reply,
    )
    expect(reply.statusCode).toBe(200)
    expect(mocks.spendPoints).toHaveBeenCalledWith(
      'u1',
      2,
      'ai_call',
      expect.stringContaining('语音识别'),
      'req-a',
    )
  })

  it('语音对话成功 → 扣分', async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ output: { text: '回复内容' } }),
    })
    const reply = makeReply()
    await handlers.get('POST /audio/chat')!({ ...REQUEST, body: { text: '你好' } }, reply)
    expect(reply.statusCode).toBe(200)
    expect(mocks.spendPoints).toHaveBeenCalledWith(
      'u1',
      2,
      'ai_call',
      expect.stringContaining('语音对话'),
      'req-a',
    )
  })

  it('声纹注册成功 → 扣分', async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ output: { voice_id: 'v1', status: 'registered' } }),
    })
    const reply = makeReply()
    await handlers.get('POST /speaker/register')!(
      { ...REQUEST, body: { voice_id: 'v1', audio_url: 'https://a/x.wav' } },
      reply,
    )
    expect(reply.statusCode).toBe(200)
    expect(mocks.spendPoints).toHaveBeenCalledWith(
      'u1',
      2,
      'ai_call',
      expect.stringContaining('声纹注册'),
      'req-a',
    )
  })

  it('声纹比对成功 → 扣分', async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ output: { matched: true, confidence: 0.9 } }),
    })
    const reply = makeReply()
    // F-106:声纹属主隔离,userId='u1' → 属主前缀 `uu1_`,须比对本人名下声纹
    await handlers.get('POST /speaker/compare')!(
      { ...REQUEST, body: { voice_id: 'uu1_v1', audio_url: 'https://a/x.wav' } },
      reply,
    )
    expect(reply.statusCode).toBe(200)
    expect(mocks.spendPoints).toHaveBeenCalledWith(
      'u1',
      2,
      'ai_call',
      expect.stringContaining('声纹比对'),
      'req-a',
    )
  })

  it('声纹比对他人 voiceId → 403 不扣分(F-106)', async () => {
    const reply = makeReply()
    await handlers.get('POST /speaker/compare')!(
      { ...REQUEST, body: { voice_id: 'u2_victim', audio_url: 'https://a/x.wav' } },
      reply,
    )
    expect(reply.statusCode).toBe(403)
    expect(mocks.spendPoints).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
