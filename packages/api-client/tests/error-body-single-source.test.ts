// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 非 2xx 响应体的派生逻辑原先在 client.ts 里有**三份副本**,而且已经漂成三个不同答案:
//   - 兜底文案一份全角括号、一份半角;
//   - `message` 与 `detail` 的优先级一份 message 优先、另一份 detail 覆盖;
//   - SSE 那一腿完全不做空白判定,`text ||` 让一个空格的 body 原样进 Error.message。
// 空白 body 不是格式洁癖:nginx 的空 404、被裁过的错误页都返回长度 1 的空白,调用方普遍写
// `showToast(res.error || t('…'))` —— 同一个 `||` 兜不住 truthy 的空白,真机拍到过
// 一个只有图标、没有文字的深色方块。
//
// 现在只有一份实现 `deriveFailureFromBody`,三条腿都从这里取。本文件的职责:
//   ① 出口自身的行为契约(优先级 / 兜底 / 非 JSON / errorCode);
//   ② **三条腿同形** —— 只测出口不够,还得证明每条腿真从它取值且拿到的答案一致;
//   ③ 源码级形状锁 —— 散落副本不得再被写回来(判"有没有第二份实现",不判"我这次改了几行")。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  deriveFailureFromBody,
  fetchAiServiceJson,
  fetchApi,
  setBaseUrl,
  setStreamBaseUrl,
  streamChat,
} from '../src/client.js'
import { setTransport, type Transport } from '../src/transport.js'

const CLIENT_SRC = fileURLToPath(new URL('../src/client.ts', import.meta.url))

function respond(status: number, body: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => body,
    json: async () => JSON.parse(body),
  }
}

describe('① 唯一出口的行为契约', () => {
  it('空白 body ⇒ 走兜底文案,兜底串带状态码(全角括号是下游 getSSEErrorInfo 认的形态之一)', () => {
    expect(deriveFailureFromBody(' ', 500)).toEqual({ message: '请求失败（500）' })
    expect(deriveFailureFromBody('', 404).message).toContain('404')
  })

  it('message 优先于 detail(自家 api 契约是 {code,message,data};detail 只作 FastAPI 透传的补位)', () => {
    const r = deriveFailureFromBody(JSON.stringify({ message: '额度不足', detail: 'quota' }), 400)
    expect(r.message).toBe('额度不足')
  })

  it('只有 detail 时用它 —— 否则 toast 会显示整段原始 JSON 文本', () => {
    const r = deriveFailureFromBody(JSON.stringify({ detail: '字段校验失败' }), 422)
    expect(r.message).toBe('字段校验失败')
  })

  it('message 是空白 ⇒ 不得当成有效文案,继续找 detail,再落兜底', () => {
    expect(deriveFailureFromBody(JSON.stringify({ message: '   ' }), 400).message).not.toBe('   ')
    expect(
      deriveFailureFromBody(JSON.stringify({ message: '  ', detail: '名称重复' }), 400),
    ).toEqual({ message: '名称重复' })
  })

  it('errorCode 一并取出;非 JSON body 保留原文不抛错', () => {
    expect(
      deriveFailureFromBody(JSON.stringify({ message: 'm', errorCode: 'RATE_LIMIT' }), 429),
    ).toEqual({ message: 'm', errorCode: 'RATE_LIMIT' })
    expect(deriveFailureFromBody('<html>502 Bad Gateway</html>', 502).message).toBe(
      '<html>502 Bad Gateway</html>',
    )
  })
})

describe('② 三条腿必须给出同一个答案', () => {
  beforeEach(() => {
    setBaseUrl('http://localhost:8803')
    setStreamBaseUrl('http://localhost:8803')
  })

  afterEach(() => {
    setTransport(undefined as unknown as Transport)
    vi.unstubAllGlobals()
  })

  it('腿 1 fetchApi:空白 body ⇒ 非空 error + status 仍在', async () => {
    setTransport(vi.fn(async () => respond(404, ' ')) as unknown as Transport)
    const r = await fetchApi('/api/plaza/list')
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error).toBe('请求失败（404）')
      expect(r.status).toBe(404)
    }
  })

  it('腿 2 fetchAiServiceJson:同一条 body 得到同一句文案(漂之前这里是半角括号)', async () => {
    setTransport(vi.fn(async () => respond(404, ' ')) as unknown as Transport)
    const r = await fetchAiServiceJson('/mcp/tools')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toBe('请求失败（404）')
  })

  it('腿 3 streamChat:SSE 那一腿原先完全不 trim,空白 body 会抛出 message 为空的 Error', async () => {
    const fetchMock = vi.fn(async () => respond(502, '  '))
    vi.stubGlobal('fetch', fetchMock)
    const promise = streamChat({
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
      maxRetries: 0,
    } as unknown as Parameters<typeof streamChat>[0])
    const err = await promise.catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).name).toBe('SSEError')
    expect((err as Error).message.trim()).not.toBe('')
    expect((err as Error).message).toContain('502')
    // 状态码仍走结构化字段,不靠文案正则(守门 135 同一条取向)
    expect((err as Error & { code?: number }).code).toBe(502)
  })

  it('腿 3 对照:body 自带文案时按 SSE 约定追加 `（status）`,且已含状态码就不重复追加', async () => {
    const fetchMock = vi.fn(async () =>
      respond(401, JSON.stringify({ message: 'Invalid or expired token' })),
    )
    vi.stubGlobal('fetch', fetchMock)
    const err = await streamChat({
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
      maxRetries: 0,
    } as unknown as Parameters<typeof streamChat>[0]).catch((e: unknown) => e)
    expect((err as Error).message).toBe('Invalid or expired token（401）')
  })
})

describe('③ 形状锁:副本不得写回来', () => {
  const src = readFileSync(CLIENT_SRC, 'utf8')
  const countOf = (needle: string) => src.split(needle).length - 1

  it('出口只有一份实现,且三条腿都真的调用它', () => {
    expect(countOf('export function deriveFailureFromBody(')).toBe(1)
    // 1 处定义 + 3 处调用
    expect(countOf('deriveFailureFromBody(')).toBe(4)
  })

  it('散落副本的三种指纹必须归零:空白判据 / JSON.parse(text) / 半角兜底串', () => {
    // 出口内部各留一处;出口之外再出现就是第二份真相(用"总次数"锁死,不是"我这次有没有写")
    expect(countOf('JSON.parse(text)')).toBe(1)
    expect(countOf('text.trim() ||')).toBe(1)
    expect(countOf('请求失败(${response.status})')).toBe(0)
    expect(countOf('text || `请求失败')).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
