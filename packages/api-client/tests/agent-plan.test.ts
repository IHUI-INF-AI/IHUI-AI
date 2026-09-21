// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAgentPlan, getAgentPlan, decideAgentPlan } from '../src/endpoints/agent-plan.js'

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ code: 0, message: 'ok', data }),
    text: async () => JSON.stringify({ code: 0, message: 'ok', data }),
    body: null,
  } as unknown as Response
}

function errorResponse(message: string, status: number): Response {
  return {
    ok: false,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ code: status, message, data: null }),
    text: async () => JSON.stringify({ code: status, message, data: null }),
    body: null,
  } as unknown as Response
}

describe('agent-plan endpoints — /api/agent-plan*', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('createAgentPlan — POST /api/agent-plan 返回 plan_id/plan_md/readonly_tools', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        plan_id: 'plan_123',
        plan_md: '# Plan\n- step 1',
        readonly_tools: ['read_file', 'search_codebase'],
      }),
    )
    const res = await createAgentPlan({ goal: 'write tests', session_id: 's1', model: 'gpt' })
    expect(res.success).toBe(true)
    expect(res.data?.plan_id).toBe('plan_123')
    expect(res.data?.readonly_tools).toEqual(['read_file', 'search_codebase'])

    const call = fetchMock.mock.calls[0]!
    const url = String(call[0])
    const opts = call[1] as RequestInit
    expect(url).toContain('/api/agent-plan')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(String(opts.body))).toEqual({
      goal: 'write tests',
      session_id: 's1',
      model: 'gpt',
    })
  })

  it('createAgentPlan — 可选字段省略时不发送', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ plan_id: 'p', plan_md: 'm', readonly_tools: [] }))
    await createAgentPlan({ goal: 'g' })
    const body = JSON.parse(String((fetchMock.mock.calls[0]![1] as RequestInit).body))
    expect(body).toEqual({ goal: 'g' })
  })

  it('getAgentPlan — GET /api/agent-plan/{id} 返回详情', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        plan_id: 'plan_123',
        goal: 'write tests',
        status: 'draft',
        plan_md: '# Plan',
        readonly_tools: ['read_file'],
        session_id: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        result: null,
      }),
    )
    const res = await getAgentPlan('plan_123')
    expect(res.success).toBe(true)
    expect(res.data?.status).toBe('draft')
    expect(res.data?.result).toBeNull()

    const call = fetchMock.mock.calls[0]!
    expect(String(call[0])).toContain('/api/agent-plan/plan_123')
    // GET 不显式带 method(fetch 默认 GET),接受 undefined 或 'GET'
    expect((call[1] as RequestInit).method ?? 'GET').toBe('GET')
  })

  it('decideAgentPlan — 批准时带 edited_plan_md 与 tools,默认 130s 超时', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        plan_id: 'plan_123',
        status: 'done',
        result: {
          success: true,
          final_response: 'done',
          stop_reason: 'completed',
          error: null,
          iterations: 3,
        },
      }),
    )
    const res = await decideAgentPlan('plan_123', {
      approve: true,
      edited_plan_md: '# Edited',
      tools: ['read_file'],
    })
    expect(res.success).toBe(true)
    expect(res.data?.status).toBe('done')
    expect(res.data?.result?.iterations).toBe(3)

    const call = fetchMock.mock.calls[0]!
    const url = String(call[0])
    const opts = call[1] as RequestInit
    expect(url).toContain('/api/agent-plan/plan_123/decision')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(String(opts.body))).toEqual({
      approve: true,
      edited_plan_md: '# Edited',
      tools: ['read_file'],
    })
  })

  it('decideAgentPlan — 拒绝时不发送 edited_plan_md/tools', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ plan_id: 'plan_123', status: 'rejected' }))
    const res = await decideAgentPlan('plan_123', { approve: false })
    expect(res.success).toBe(true)
    expect(res.data?.status).toBe('rejected')
    const body = JSON.parse(String((fetchMock.mock.calls[0]![1] as RequestInit).body))
    expect(body).toEqual({ approve: false })
  })

  it('后端 404 → ApiResult.success=false 且 status=404', async () => {
    fetchMock.mockResolvedValue(errorResponse('plan not found', 404))
    const res = await getAgentPlan('missing')
    expect(res.success).toBe(false)
    expect(res.status).toBe(404)
  })

  it('后端 409(非法状态迁移) → ApiResult.success=false 且 status=409', async () => {
    fetchMock.mockResolvedValue(errorResponse('invalid transition', 409))
    const res = await decideAgentPlan('plan_123', { approve: true, edited_plan_md: 'x' })
    expect(res.success).toBe(false)
    expect(res.status).toBe(409)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
