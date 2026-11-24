// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * BYOK 的 Google 分支:凭据只许走 x-goog-api-key 头(2026-11-01 安全强化)。
 *
 * 原先这行把用户填的 key 拼进 URL:`.../v1beta/models/<m>:generateContent?key=<apiKey>`。
 * URL 比头多走几条能被第三方读到的路:访问日志按 URL 记录、上游错误摘要里带
 * request.url、任何把 endpoint 打进日志的调试行。原生端点认头,且**本仓 Node 侧另一条
 * 腿早就用头形态**调同一个端点(routes/ai-vendors/proxy-llm.ts +
 * vendor-auth-strategies.ts 的 `x-goog-api-key`,由 ai-vendor-v2-routes.test.ts 钉着),
 * 所以查询串只剩泄露面,没有兼容收益。
 *
 * 另开一个文件而不是加进 ai-user-model-chat-ssrf.test.ts:那个文件第 29 行有一枚
 * HEAD 面就存在的 `consistent-type-imports` 违规,不是本票内容,不去动它。
 */
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as undiciModule from 'undici'

const { outbound } = vi.hoisted(() => ({ outbound: vi.fn() }))
vi.mock('undici', async (importOriginal) => {
  const actual = await importOriginal<typeof undiciModule>()
  return { ...actual, fetch: outbound }
})

// 只做出站断言:把库/鉴权/计费这几条依赖链截断,零连库(AGENTS §5 测试隔离)。
vi.mock('../src/db/index.js', () => ({ db: {} }))
vi.mock('../src/plugins/auth.js', () => ({ checkAuth: vi.fn(async () => true) }))
vi.mock('../src/plugins/ai-cost.js', () => ({ recordAiCost: vi.fn() }))
vi.mock('../src/routes/v1-shared.js', () => ({ maskKey: (k: string) => k }))

import { callLLM } from '../src/routes/ai-user-model-chat.js'

const API_KEY = 'AIzaDUMMY-KEY-not-real'

const geminiOk = () =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

beforeEach(() => {
  outbound.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

async function callGoogle(): Promise<{ content: string }> {
  outbound.mockResolvedValue(geminiOk())
  return callLLM({
    vendor: 'google',
    modelId: 'gemini-1.5-pro',
    // IP 字面量:443 在 ssrf-guard 白名单内且不必走 DNS —— 用例不得依赖网络解析
    baseUrl: 'https://1.1.1.1',
    apiKey: API_KEY,
    messages: [{ role: 'user', content: 'hi' }],
  })
}

describe('callLLM(google):鉴权只进头', () => {
  it('URL 不含 key,而头里必须含 key', async () => {
    const out = await callGoogle()
    expect(out.content).toBe('ok')
    expect(outbound).toHaveBeenCalledTimes(1)
    const [url, init] = outbound.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/v1beta/models/gemini-1.5-pro:generateContent')
    expect(url).not.toContain('key=')
    const headers = init.headers as Record<string, string>
    expect(headers['x-goog-api-key']).toBe(API_KEY)
  })

  it('反向牙口:整条出站里那枚 key 只许出现在头,不许出现在被记录的 URL 上', async () => {
    await callGoogle()
    const [url] = outbound.mock.calls[0] as [string]
    expect(url).not.toContain(API_KEY)
    // 若哪天有人"为了改而改"把 key 整个删掉,生产表现是全线 401 —— 这条把住
    const [, init] = outbound.mock.calls[0] as [string, RequestInit]
    expect(JSON.stringify(init.headers)).toContain(API_KEY)
  })

  it('接线锁:实现里不得再长出查询串形态的 generateContent 拼法', () => {
    const src = readFileSync(
      new URL('../src/routes/ai-user-model-chat.ts', import.meta.url),
      'utf8',
    )
    expect(src).not.toMatch(/generateContent\?key=/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
