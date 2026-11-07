// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 控制帧客户端出口 · 收发两侧形状证明(2026-11-06 补)
 *
 * 本册只判 api-client 这一格:请求打对了地址/方法/参数,回执按严格契约解包;
 * 失败必须显式抛错(控制帧"处理失败"不许静默吞成空对象)。服务端行为由 ai-service
 * pytest 与 apps/api 代理测试各钉一格。
 *
 * 覆盖 5 帧:
 *   get_context_usage / stop_task / seed_read_state / mcp_reconnect / mcp_toggle
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  getContextUsage,
  stopTask,
  seedReadState,
  reconnectMcpServer,
  setMcpServerEnabled,
} from '../src/endpoints/control-frames.js'

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

/** 一份七类齐全、窗口已知的合法账本(解析器 strict 判据的正面样本)。 */
const VALID_LEDGER = {
  model: 'fixture-model',
  contextLimit: 128000,
  usedTokens: 3000,
  percentage: 2.34,
  categories: [
    { category: 'system_prompt', tokens: 0, percent: 0 },
    { category: 'system_tools', tokens: 0, percent: 0 },
    { category: 'skills', tokens: 0, percent: 0 },
    { category: 'messages', tokens: 3000, percent: 2.34 },
    { category: 'other', tokens: 0, percent: 0 },
    { category: 'free_space', tokens: 125000, percent: 97.66 },
    { category: 'auto_compact', tokens: 0, percent: 0 },
  ],
  tokenizer: 'heuristic',
  compacted: false,
  capturedAt: '2026-11-06T00:00:00.000Z',
}

function engineEnvelope(result: unknown) {
  return { jsonrpc: '2.0', id: 'x', result }
}

describe('控制帧客户端出口', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  function lastCall(): { url: string; opts: RequestInit } {
    const call = fetchMock.mock.calls[0]!
    return { url: String(call[0]), opts: call[1] as RequestInit }
  }

  // ───────────────── get_context_usage ─────────────────

  describe('getContextUsage — 控制帧 get_context_usage', () => {
    it('打 POST /api/engine/rpc,method=thread.contextUsage,回执按账本口径解析', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          200,
          engineEnvelope({
            threadId: 'th_1',
            usage: VALID_LEDGER,
            source: 'thread_history',
            status: 'idle',
            capturedAt: VALID_LEDGER.capturedAt,
          }),
        ),
      )

      const res = await getContextUsage({ threadId: 'th_1' })

      expect(res.usage.categories).toHaveLength(7)
      expect(res.usage.usedTokens).toBe(3000)
      expect(res.usage.contextLimit).toBe(128000)
      expect(res.source).toBe('thread_history')
      expect(res.status).toBe('idle')

      const { url, opts } = lastCall()
      expect(url).toContain('/api/engine/rpc')
      expect(opts.method).toBe('POST')
      expect(JSON.parse(String(opts.body))).toMatchObject({
        method: 'thread.contextUsage',
        params: { threadId: 'th_1' },
      })
    })

    it('账本七类不全 ⇒ 显式抛错,不返回半份账本', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          200,
          engineEnvelope({
            threadId: 'th_1',
            usage: { ...VALID_LEDGER, categories: VALID_LEDGER.categories.slice(0, 6) },
            source: 'thread_history',
            status: 'idle',
          }),
        ),
      )

      await expect(getContextUsage({ threadId: 'th_1' })).rejects.toThrow(/不可解析/)
    })

    it('JSON-RPC error 包络 ⇒ 带 code/message 抛错', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, {
          jsonrpc: '2.0',
          id: 'x',
          error: { code: -32000, message: '线程不存在: th_404' },
        }),
      )

      await expect(getContextUsage({ threadId: 'th_404' })).rejects.toThrow(
        /thread\.contextUsage[\s\S]*线程不存在/,
      )
    })

    it('传输层失败 ⇒ 抛错,不静默返回空账本', async () => {
      fetchMock.mockResolvedValue(jsonResponse(502, null, '引擎服务暂不可用'))

      await expect(getContextUsage({ threadId: 'th_1' })).rejects.toThrow()
    })
  })

  // ───────────────── stop_task ─────────────────

  describe('stopTask — 控制帧 stop_task', () => {
    it('打 thread.interrupt,默认 mode=cancel,回执带 interrupted/checkpoint', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          200,
          engineEnvelope({
            threadId: 'th_1',
            interrupted: true,
            mode: 'cancel',
            status: 'idle',
            checkpointId: 'ckp_1',
          }),
        ),
      )

      const res = await stopTask({ threadId: 'th_1' })
      expect(res.interrupted).toBe(true)
      expect(res.mode).toBe('cancel')
      expect(res.checkpointId).toBe('ckp_1')

      const { opts } = lastCall()
      expect(JSON.parse(String(opts.body))).toMatchObject({
        method: 'thread.interrupt',
        params: { threadId: 'th_1', mode: 'cancel' },
      })
    })

    it('pause 档透传;空闲线程 interrupted=false 必须带 reason', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          200,
          engineEnvelope({
            threadId: 'th_1',
            interrupted: false,
            mode: 'pause',
            status: 'idle',
            reason: 'no_active_run',
          }),
        ),
      )

      const res = await stopTask({ threadId: 'th_1', mode: 'pause' })
      expect(res.interrupted).toBe(false)
      expect(res.reason).toBe('no_active_run')
      expect(JSON.parse(String(lastCall().opts.body))).toMatchObject({
        params: { threadId: 'th_1', mode: 'pause' },
      })
    })
  })

  // ───────────────── seed_read_state ─────────────────

  describe('seedReadState — 控制帧 seed_read_state', () => {
    it('逐路径结果原样回传(失败带 reason,不并桶)', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          200,
          engineEnvelope({
            threadId: 'th_1',
            seededCount: 1,
            results: [
              { path: 'src/a.ts', ok: true },
              { path: 'src/missing.ts', ok: false, reason: 'not_found' },
              { path: '../outside.txt', ok: false, reason: 'outside_workspace' },
            ],
          }),
        ),
      )

      const res = await seedReadState({ threadId: 'th_1', paths: ['src/a.ts', 'src/missing.ts', '../outside.txt'] })
      expect(res.seededCount).toBe(1)
      expect(res.results).toEqual([
        { path: 'src/a.ts', ok: true },
        { path: 'src/missing.ts', ok: false, reason: 'not_found' },
        { path: '../outside.txt', ok: false, reason: 'outside_workspace' },
      ])
      expect(JSON.parse(String(lastCall().opts.body))).toMatchObject({
        method: 'thread.seedReadState',
        params: { threadId: 'th_1', paths: ['src/a.ts', 'src/missing.ts', '../outside.txt'] },
      })
    })

    it('results 形状不合法 ⇒ 抛错', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, engineEnvelope({ threadId: 'th_1', seededCount: 0, results: [{}] })),
      )

      await expect(seedReadState({ threadId: 'th_1', paths: ['a.ts'] })).rejects.toThrow(/不可解析/)
    })
  })

  // ───────────────── mcp_reconnect ─────────────────

  describe('reconnectMcpServer — 控制帧 mcp_reconnect', () => {
    it('打 POST .../reconnect(名字编码),回执 connected=true', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, { connected: true, name: 'my server', tools: ['a'] }),
      )

      const res = await reconnectMcpServer('my server')
      expect(res.connected).toBe(true)
      expect(res.server.tools).toEqual(['a'])

      const { url, opts } = lastCall()
      expect(url).toContain('/api/mcp/external/servers/my%20server/reconnect')
      expect(opts.method).toBe('POST')
    })

    it('未连上 ⇒ 显式抛错(不把 connected=false 报成成功)', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, { connected: false, error: 'spawn 失败' }),
      )

      await expect(reconnectMcpServer('broken')).rejects.toThrow(/spawn 失败/)
    })
  })

  // ───────────────── mcp_toggle ─────────────────

  describe('setMcpServerEnabled — 控制帧 mcp_toggle', () => {
    it('打 POST .../toggle,body={enabled:true},回执映射 enabled/running/toolCount', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, { ok: true, name: 'srv', enabled: true, running: true, tool_count: 3 }),
      )

      const res = await setMcpServerEnabled('srv', true)
      expect(res).toEqual({ name: 'srv', enabled: true, running: true, toolCount: 3 })

      const { url, opts } = lastCall()
      expect(url).toContain('/api/mcp/store/srv/toggle')
      expect(JSON.parse(String(opts.body))).toEqual({ enabled: true })
    })

    it('停用档 body={enabled:false}', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, { name: 'srv', enabled: false, running: false, tool_count: 0 }),
      )

      await setMcpServerEnabled('srv', false)
      expect(JSON.parse(String(lastCall().opts.body))).toEqual({ enabled: false })
    })

    it('回执缺 enabled ⇒ 抛错', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { name: 'srv' }))

      await expect(setMcpServerEnabled('srv', true)).rejects.toThrow(/不可解析/)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
