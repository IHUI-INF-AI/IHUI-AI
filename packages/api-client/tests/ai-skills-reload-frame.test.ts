// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `reloadAiSkills` 端点 —— 控制帧 `reload_skills` 在 api-client 层的形状证明(2026-10-28 立)
 *
 * 立因:这帧是 D141 正本判定的**真缺**帧(宿主可显式调用 + 必须回报结果)。
 * api-client 这一格要钉死两件事:
 * ① 打的是 **POST**(帧是"调一下",不是"取一下" —— 用 GET 会被代理与缓存当取资源处理);
 * ② **force 默认 true** —— 用户手改 SKILL.md 后 mtime 可能不变(同秒连写 / 编辑器保留
 *    mtime),只走增量会把"改了没生效"报成"没有变化"。这条默认值若被改成 false,
 *    帧还在、但语义已经废了 —— 是那种不会报错、只会"用户说没生效"的坑。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { reloadAiSkills } from '../src/endpoints/ai-skills.js'

function jsonResponse(status: number, data: unknown, message = 'ok') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ code: status === 200 ? 0 : status, message, data }),
    text: async () => JSON.stringify({ code: status === 200 ? 0 : status, message, data }),
    body: null,
  } as unknown as Response
}

describe('reloadAiSkills — 控制帧 reload_skills', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('打 POST /api/ai-skills/reload,默认 force=true', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        total: 3,
        auto: 2,
        added: ['a'],
        removed: [],
        changed: [],
        unchanged: 1,
        lastReload: 1730000000,
        forced: true,
        sourceDirs: ['/tmp/skills'],
      }),
    )

    const res = await reloadAiSkills()

    expect(res.success).toBe(true)
    expect(res.data?.added).toEqual(['a'])

    const call = fetchMock.mock.calls[0]!
    const url = String(call[0])
    const opts = call[1] as RequestInit
    expect(url).toContain('/api/ai-skills/reload')
    expect(opts.method).toBe('POST')
    // force 默认 true:绕过 mtime 判据做全量重扫,否则"改了没生效"会被报成"没有变化"
    expect(JSON.parse(String(opts.body))).toEqual({ force: true })
  })

  it('显式传 force=false 时透传增量语义', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        total: 0,
        auto: 0,
        added: [],
        removed: [],
        changed: [],
        unchanged: 0,
        lastReload: null,
        forced: false,
        sourceDirs: [],
      }),
    )

    await reloadAiSkills({ force: false })

    const opts = fetchMock.mock.calls[0]![1] as RequestInit
    expect(JSON.parse(String(opts.body))).toEqual({ force: false })
  })

  it('失败时走 ApiResult 失败分支并带上原因(不吞错误)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(502, null, 'AI 技能服务暂不可用'))

    const res = await reloadAiSkills()

    expect(res.success).toBe(false)
    // 失败分支必须带 error 载荷 —— 前端要靠它显示"为什么失败"
    expect(res.error).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
