// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 真机取证过的缺陷:HTTP 错误响应体是**空白字符串**时,api-client 会把这段"可见长度为 0"的
// 文本当作有效 error 返回。调用方普遍写 `showToast(res.error || t('…'))` —— 同一个 `||`
// 也兜不住空白(truthy),于是 App 上渲染出一个**只有图标、没有文字**的深色方块
// (实测约 57×63dp,首页/广场都拍到)。
//
// 四条断言各守一侧,少一条就退化成"看起来改了":
//   ① 空白 body ⇒ 必须走兜底文案(缺陷面)
//   ② JSON 里 message 是空白 ⇒ 同上
//      (2026-09-27 收口:这一族原先有**两份实现**且已漂 —— 兜底串一处全角一处半角、detail 一处
//      else-if 一处裸 if。现三条腿共用 `deriveFailureFromBody`,同形性由
//      `error-body-single-source.test.ts` 的"三条腿同一个答案 + 形状锁"两节看守,本文件只守空白这一面)
//   ③ 正常 message ⇒ 逐字保留(trim 不得吃掉真文案,阳性对照)
//   ④ status 必须仍在(守门 135 那一型的前提:身份不能靠文案正则猜)
import { describe, it, expect, afterEach, vi } from 'vitest'

import { fetchApi } from '../src/client.js'
import { setTransport, type Transport } from '../src/transport.js'

function respond(status: number, body: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => body,
    json: async () => JSON.parse(body),
  }
}

describe('错误体空白不得冒充有效文案', () => {
  afterEach(() => {
    setTransport(undefined as unknown as Transport)
  })

  it('① body 是一个空格 ⇒ 走兜底文案,而不是把空格交给调用方', async () => {
    setTransport(vi.fn(async () => respond(404, ' ')) as unknown as Transport)
    const r = await fetchApi('/api/cache/agent-category-dict/categories')
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.trim()).not.toBe('', '空白 error 会渲染成"只有图标没有文字"的 toast')
      expect(r.error).toContain('404')
      expect(r.status).toBe(404)
    }
  })

  it('② JSON 的 message 是空白 ⇒ 同样不得当成有效文案', async () => {
    setTransport(
      vi.fn(async () =>
        respond(400, JSON.stringify({ code: 400, message: '   ' })),
      ) as unknown as Transport,
    )
    const r = await fetchApi('/api/plaza/list')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.trim()).not.toBe('')
  })

  it('③ 阳性对照:真文案必须逐字保留(trim 只判空,不改内容)', async () => {
    setTransport(
      vi.fn(async () =>
        respond(400, JSON.stringify({ code: 400, message: '额度不足,请充值后再试' })),
      ) as unknown as Transport,
    )
    const r = await fetchApi('/api/plaza/list')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toBe('额度不足,请充值后再试')
  })

  it('④ 401 仍带 status —— 守门 135 的判序靠它,不能退化成猜文案', async () => {
    setTransport(
      vi.fn(async () =>
        respond(401, JSON.stringify({ code: 401, message: 'Invalid or expired token' })),
      ) as unknown as Transport,
    )
    const r = await fetchApi('/api/ai/models')
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.status).toBe(401)
      expect(r.error).toBe('Invalid or expired token')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
