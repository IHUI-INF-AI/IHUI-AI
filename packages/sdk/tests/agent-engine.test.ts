// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, vi } from 'vitest'
import {
  AgentEngineError,
  ENGINE_ERROR_CODES,
  ENGINE_METHODS,
  ENGINE_NOTIFICATIONS,
  createAgent,
  type AgentEngineEvent,
} from '../src/agent-engine'

/** 一帧 SSE 文本(`data: {json}` + 注释心跳 + 收尾 [DONE])。 */
function sseBody(frames: unknown[], withHeartbeat = true): string {
  const parts: string[] = []
  if (withHeartbeat) parts.push(': ping\n\n')
  for (const frame of frames) {
    parts.push(`data: ${JSON.stringify(frame)}\n\n`)
  }
  parts.push('event: done\ndata: [DONE]\n\n')
  return parts.join('')
}

/** 事件通知帧。 */
function eventFrame(event: string, payload: Record<string, unknown>, id?: number) {
  return {
    jsonrpc: '2.0',
    method: 'thread/event',
    params: { threadId: 'thr_1', event, payload },
    ...(id ? { id } : {}),
  }
}

/**
 * 脚本化 fetch:按调用顺序返回预置响应,并记录每次请求的 JSON-RPC 报文。
 * step.kind = 'sse' 返回 text/event-stream;否则返回 application/json。
 */
function makeFetch(
  steps: Array<
    | { kind: 'sse'; frames: unknown[] }
    | { kind: 'json'; body: unknown; status?: number; statusText?: string }
  >,
) {
  const calls: Array<{
    method: string
    params: Record<string, unknown>
    headers: Record<string, string>
  }> = []
  const fetchFn = vi.fn(async (_url: string | URL, init?: RequestInit) => {
    const parsed = JSON.parse(String(init?.body ?? '{}')) as {
      method?: string
      params?: Record<string, unknown>
    }
    calls.push({
      method: String(parsed.method),
      params: parsed.params ?? {},
      headers: (init?.headers ?? {}) as Record<string, string>,
    })
    const step = steps[Math.min(calls.length - 1, steps.length - 1)]
    if (step.kind === 'sse') {
      return new Response(sseBody(step.frames), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      })
    }
    return new Response(step.body === undefined ? '' : JSON.stringify(step.body), {
      status: step.status ?? 200,
      statusText: step.statusText ?? '',
      headers: { 'content-type': 'application/json' },
    })
  })
  return { fetchFn: fetchFn as unknown as typeof fetch, calls }
}

const START_RESULT = {
  jsonrpc: '2.0',
  id: 1,
  result: { threadId: 'thr_1', sessionId: 'thr_1', status: 'idle' },
}

function runResult(overrides: Record<string, unknown> = {}) {
  return {
    threadId: 'thr_1',
    success: true,
    stopReason: 'completed',
    finalResponse: '改好了',
    iterations: 2,
    totalDurationMs: 12.5,
    totalTokensUsed: 42,
    checkpointId: null,
    error: null,
    budget: null,
    compactionEvents: [],
    ...overrides,
  }
}

describe('createAgent 协议对接', () => {
  it('缺少 token 构造即抛 AgentEngineError(invalidRequest)', () => {
    expect(() => createAgent({ token: '' })).toThrow(AgentEngineError)
    try {
      createAgent({ token: '' })
    } catch (e) {
      expect((e as AgentEngineError).code).toBe(ENGINE_ERROR_CODES.invalidRequest)
    }
  })

  it('首个 run 自动 thread.start,再发 thread.prompt;两次调用 id 递增且带 Bearer 头', async () => {
    const { fetchFn, calls } = makeFetch([
      { kind: 'json', body: START_RESULT },
      {
        kind: 'sse',
        frames: [
          eventFrame('tool.before', { tool: 'read_file' }),
          { jsonrpc: '2.0', id: 2, result: runResult() },
        ],
      },
    ])
    const agent = createAgent({ token: 'jwt_x', baseUrl: 'http://test.local', fetch: fetchFn })
    const result = await agent.run('改错别字')

    expect(calls.map((c) => c.method)).toEqual(['thread.start', 'thread.prompt'])
    expect(calls[0].params).toEqual({})
    expect(calls[1].params).toEqual({ threadId: 'thr_1', input: '改错别字' })
    expect(calls[0].headers.Authorization).toBe('Bearer jwt_x')
    expect(result.finalResponse).toBe('改好了')
    expect(agent.threadId).toBe('thr_1')
    expect(agent.lastResult?.totalTokensUsed).toBe(42)
  })

  it('start 参数只下发显式提供的项(未提供不下发 undefined 键)', async () => {
    const { fetchFn, calls } = makeFetch([{ kind: 'json', body: START_RESULT }])
    const agent = createAgent({
      token: 't',
      baseUrl: 'http://test.local',
      fetch: fetchFn,
      model: 'claude-sonnet-4',
      maxIterations: 5,
      permissionMode: 'acceptEdits',
    })
    await agent.start()
    expect(calls[0].params).toEqual({
      model: 'claude-sonnet-4',
      maxIterations: 5,
      permissionMode: 'acceptEdits',
    })
  })

  it('重复 start 不重复建线程(第二次直接返回缓存的 threadId)', async () => {
    const { fetchFn, calls } = makeFetch([{ kind: 'json', body: START_RESULT }])
    const agent = createAgent({ token: 't', baseUrl: 'http://test.local', fetch: fetchFn })
    await agent.start()
    await agent.start()
    expect(calls).toHaveLength(1)
  })
})

describe('createAgent 流式事件', () => {
  it('thread/event 按到达顺序回调,心跳注释帧与 [DONE] 不产出事件', async () => {
    const { fetchFn } = makeFetch([
      { kind: 'json', body: START_RESULT },
      {
        kind: 'sse',
        frames: [
          eventFrame('thinking.delta', { content: '想' }),
          eventFrame('tool.after', { tool: 'read_file', ok: true }),
          eventFrame('message.receive', { content: '完成' }),
          { jsonrpc: '2.0', id: 2, result: runResult() },
        ],
      },
    ])
    const agent = createAgent({ token: 't', baseUrl: 'http://test.local', fetch: fetchFn })
    const seen: AgentEngineEvent[] = []
    await agent.run('跑', { onEvent: (e) => seen.push(e) })

    expect(seen.map((e) => e.name)).toEqual(['thinking.delta', 'tool.after', 'message.receive'])
    expect(seen[0].payload).toEqual({ content: '想' })
    expect(seen[0].type).toBe('agent-event')
    expect(seen[0].threadId).toBe('thr_1')
  })

  it('run 的 options.onEvent 覆盖构造期 onEvent(两者不叠加)', async () => {
    const { fetchFn } = makeFetch([
      { kind: 'json', body: START_RESULT },
      {
        kind: 'sse',
        frames: [eventFrame('tool.before', {}), { jsonrpc: '2.0', id: 2, result: runResult() }],
      },
    ])
    const globalEvents: string[] = []
    const localEvents: string[] = []
    const agent = createAgent({
      token: 't',
      baseUrl: 'http://test.local',
      fetch: fetchFn,
      onEvent: (e) => globalEvents.push(e.name),
    })
    await agent.run('跑', { onEvent: (e) => localEvents.push(e.name) })
    expect(localEvents).toEqual(['tool.before'])
    expect(globalEvents).toEqual([])
  })

  it('stream() 逐帧产出事件,结束后 lastResult 可读', async () => {
    const { fetchFn } = makeFetch([
      { kind: 'json', body: START_RESULT },
      {
        kind: 'sse',
        frames: [
          eventFrame('thinking.delta', { content: 'a' }),
          eventFrame('thinking.delta', { content: 'b' }),
          { jsonrpc: '2.0', id: 2, result: runResult() },
        ],
      },
    ])
    const agent = createAgent({ token: 't', baseUrl: 'http://test.local', fetch: fetchFn })
    const names: string[] = []
    for await (const event of agent.stream('跑')) {
      names.push(String(event.payload.content))
    }
    expect(names).toEqual(['a', 'b'])
    expect(agent.lastResult?.success).toBe(true)
  })

  it('方法响应帧带错误 → 抛 AgentEngineError(应用错误码透传)', async () => {
    const { fetchFn } = makeFetch([
      { kind: 'json', body: START_RESULT },
      {
        kind: 'sse',
        frames: [
          {
            jsonrpc: '2.0',
            id: 2,
            error: { code: ENGINE_ERROR_CODES.threadBusy, message: '线程正在执行中' },
          },
        ],
      },
    ])
    const agent = createAgent({ token: 't', baseUrl: 'http://test.local', fetch: fetchFn })
    const err = (await agent.run('跑').catch((e: unknown) => e)) as AgentEngineError
    expect(err).toBeInstanceOf(AgentEngineError)
    expect(err.code).toBe(ENGINE_ERROR_CODES.threadBusy)
  })

  it('HTTP 非 2xx → AgentEngineError(码为状态码取负)', async () => {
    const { fetchFn } = makeFetch([
      { kind: 'json', body: {}, status: 401, statusText: 'Unauthorized' },
    ])
    const agent = createAgent({ token: 't', baseUrl: 'http://test.local', fetch: fetchFn })
    const err = (await agent.start().catch((e: unknown) => e)) as AgentEngineError
    expect(err.code).toBe(-401)
  })
})

describe('createAgent 宿主工具回传', () => {
  it('tool/execute → 本进程执行 handler → tools.result 回传 requestId + result', async () => {
    const { fetchFn, calls } = makeFetch([
      { kind: 'json', body: START_RESULT },
      // start() 自动注册宿主工具(第 2 次调用)
      { kind: 'json', body: { jsonrpc: '2.0', id: 2, result: { name: 'read_file' } } },
      {
        kind: 'sse',
        frames: [
          {
            jsonrpc: '2.0',
            method: 'tool/execute',
            params: {
              requestId: 'req_1',
              threadId: 'thr_1',
              name: 'read_file',
              arguments: { path: 'README.md' },
              timeoutMs: 5000,
            },
          },
          { jsonrpc: '2.0', id: 3, result: runResult() },
        ],
      },
      { kind: 'json', body: { jsonrpc: '2.0', id: 4, result: { applied: true } } },
    ])
    const handler = vi.fn(async () => ({ content: 'hello' }))
    const agent = createAgent({
      token: 't',
      baseUrl: 'http://test.local',
      fetch: fetchFn,
      hostTools: { read_file: handler },
    })
    // 宿主工具在 start 时经 tools.register 注入
    const result = await agent.run('读文件')

    expect(calls.map((c) => c.method)).toEqual([
      'thread.start',
      'tools.register',
      'thread.prompt',
      'tools.result',
    ])
    expect(result.success).toBe(true)
    expect(handler).toBeCalledTimes(1)
    expect(handler.mock.calls[0][0]).toMatchObject({
      requestId: 'req_1',
      name: 'read_file',
      arguments: { path: 'README.md' },
      timeoutMs: 5000,
    })
    // 工具执行结果经独立调用回传(不占用 SSE 流)
    expect(calls[3].params).toEqual({ requestId: 'req_1', result: { content: 'hello' } })
  })

  it('tools.register 在 start 时下发宿主工具描述与 schema', async () => {
    const { fetchFn, calls } = makeFetch([
      { kind: 'json', body: START_RESULT },
      { kind: 'json', body: { jsonrpc: '2.0', id: 2, result: { name: 'read_file' } } },
      { kind: 'sse', frames: [{ jsonrpc: '2.0', id: 3, result: runResult() }] },
    ])
    const agent = createAgent({
      token: 't',
      baseUrl: 'http://test.local',
      fetch: fetchFn,
      hostTools: { read_file: async () => 'x' },
      hostToolSpecs: {
        read_file: {
          description: '读文件',
          parameters: { type: 'object', properties: { path: { type: 'string' } } },
        },
      },
    })
    await agent.run('跑')
    expect(calls.map((c) => c.method)).toEqual(['thread.start', 'tools.register', 'thread.prompt'])
    expect(calls[1].params).toEqual({
      threadId: 'thr_1',
      name: 'read_file',
      description: '读文件',
      parameters: { type: 'object', properties: { path: { type: 'string' } } },
    })
  })

  it('handler 抛错 → tools.result 回传 error 字段(不中断事件流)', async () => {
    const captured: Record<string, unknown>[] = []
    const steps: Array<{ kind: 'sse'; frames: unknown[] } | { kind: 'json'; body: unknown }> = [
      { kind: 'json', body: START_RESULT },
      { kind: 'json', body: { jsonrpc: '2.0', id: 2, result: { name: 'boom' } } },
      {
        kind: 'sse',
        frames: [
          {
            jsonrpc: '2.0',
            method: 'tool/execute',
            params: { requestId: 'req_9', name: 'boom', arguments: {}, timeoutMs: 1000 },
          },
          { jsonrpc: '2.0', id: 3, result: runResult() },
        ],
      },
      { kind: 'json', body: { jsonrpc: '2.0', id: 4, result: {} } },
    ]
    const { fetchFn } = makeFetch(steps)
    // 记录 tools.result 调用的 params
    const spyFetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const parsed = JSON.parse(String(init?.body ?? '{}')) as {
        method?: string
        params?: Record<string, unknown>
      }
      if (parsed.method === 'tools.result') captured.push(parsed.params ?? {})
      return fetchFn(url, init)
    }) as unknown as typeof fetch

    const agent = createAgent({
      token: 't',
      baseUrl: 'http://test.local',
      fetch: spyFetch,
      hostTools: {
        boom: async () => {
          throw new Error('磁盘满了')
        },
      },
    })
    const result = await agent.run('跑')
    expect(result.success).toBe(true)
    expect(captured[0]).toEqual({ requestId: 'req_9', error: '磁盘满了' })
  })

  it('宿主未注册的工具被请求 → 回传 error 指明未注册', async () => {
    const captured: Record<string, unknown>[] = []
    const { fetchFn } = makeFetch([
      { kind: 'json', body: START_RESULT },
      {
        kind: 'sse',
        frames: [
          {
            jsonrpc: '2.0',
            method: 'tool/execute',
            params: { requestId: 'req_x', name: 'unknown_tool', arguments: {}, timeoutMs: 1000 },
          },
          { jsonrpc: '2.0', id: 2, result: runResult() },
        ],
      },
      { kind: 'json', body: { jsonrpc: '2.0', id: 3, result: {} } },
    ])
    const spyFetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const parsed = JSON.parse(String(init?.body ?? '{}')) as {
        method?: string
        params?: Record<string, unknown>
      }
      if (parsed.method === 'tools.result') captured.push(parsed.params ?? {})
      return fetchFn(url, init)
    }) as unknown as typeof fetch

    const agent = createAgent({ token: 't', baseUrl: 'http://test.local', fetch: spyFetch })
    await agent.run('跑')
    expect(String(captured[0].error)).toContain('unknown_tool')
  })

  it('字符串形态的 arguments 也能解析为对象传给 handler', async () => {
    const { fetchFn } = makeFetch([
      { kind: 'json', body: START_RESULT },
      { kind: 'json', body: { jsonrpc: '2.0', id: 2, result: { name: 'echo' } } },
      {
        kind: 'sse',
        frames: [
          {
            jsonrpc: '2.0',
            method: 'tool/execute',
            params: {
              requestId: 'r',
              name: 'echo',
              arguments: '{"q":"hi"}',
              timeoutMs: 100,
            },
          },
          { jsonrpc: '2.0', id: 3, result: runResult() },
        ],
      },
      { kind: 'json', body: { jsonrpc: '2.0', id: 4, result: {} } },
    ])
    const handler = vi.fn(async () => 'ok')
    const agent = createAgent({
      token: 't',
      baseUrl: 'http://test.local',
      fetch: fetchFn,
      hostTools: { echo: handler },
    })
    await agent.run('跑')
    expect(handler.mock.calls[0][0].arguments).toEqual({ q: 'hi' })
  })

  it('无法解析的 arguments 文本不被丢弃(以 raw 兜底传给 handler)', async () => {
    const { fetchFn } = makeFetch([
      { kind: 'json', body: START_RESULT },
      { kind: 'json', body: { jsonrpc: '2.0', id: 2, result: { name: 'echo' } } },
      {
        kind: 'sse',
        frames: [
          {
            jsonrpc: '2.0',
            method: 'tool/execute',
            params: { requestId: 'r', name: 'echo', arguments: 'not-json{', timeoutMs: 100 },
          },
          { jsonrpc: '2.0', id: 3, result: runResult() },
        ],
      },
      { kind: 'json', body: { jsonrpc: '2.0', id: 4, result: {} } },
    ])
    const handler = vi.fn(async () => 'ok')
    const agent = createAgent({
      token: 't',
      baseUrl: 'http://test.local',
      fetch: fetchFn,
      hostTools: { echo: handler },
    })
    await agent.run('跑')
    expect(handler.mock.calls[0][0].arguments).toEqual({ raw: 'not-json{' })
  })
})

describe('createAgent 审批回填', () => {
  it('未配置 onApproval → 默认 reject(安全兜底)', async () => {
    const captured: Record<string, unknown>[] = []
    const { fetchFn } = makeFetch([
      { kind: 'json', body: START_RESULT },
      {
        kind: 'sse',
        frames: [
          {
            jsonrpc: '2.0',
            method: 'approval/request',
            params: {
              requestId: 'ap_1',
              threadId: 'thr_1',
              toolName: 'rm_rf',
              dangerLevel: 'high',
            },
          },
          { jsonrpc: '2.0', id: 2, result: runResult() },
        ],
      },
      { kind: 'json', body: { jsonrpc: '2.0', id: 3, result: { applied: true } } },
    ])
    const spyFetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const parsed = JSON.parse(String(init?.body ?? '{}')) as {
        method?: string
        params?: Record<string, unknown>
      }
      if (parsed.method === 'approval.respond') captured.push(parsed.params ?? {})
      return fetchFn(url, init)
    }) as unknown as typeof fetch

    const agent = createAgent({ token: 't', baseUrl: 'http://test.local', fetch: spyFetch })
    await agent.run('跑')
    expect(captured[0]).toEqual({ approvalId: 'ap_1', decision: 'reject' })
  })

  it('onApproval 返回 approve → approval.respond 回填 approve 并带上请求上下文', async () => {
    const captured: Record<string, unknown>[] = []
    const seen: string[] = []
    const { fetchFn } = makeFetch([
      { kind: 'json', body: START_RESULT },
      {
        kind: 'sse',
        frames: [
          {
            jsonrpc: '2.0',
            method: 'approval/request',
            params: {
              requestId: 'ap_2',
              threadId: 'thr_1',
              toolName: 'write_file',
              toolCallId: 'tc_9',
              dangerLevel: 'medium',
              argsPreview: { path: 'a.ts' },
            },
          },
          { jsonrpc: '2.0', id: 2, result: runResult() },
        ],
      },
      { kind: 'json', body: { jsonrpc: '2.0', id: 3, result: {} } },
    ])
    const spyFetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const parsed = JSON.parse(String(init?.body ?? '{}')) as {
        method?: string
        params?: Record<string, unknown>
      }
      if (parsed.method === 'approval.respond') captured.push(parsed.params ?? {})
      return fetchFn(url, init)
    }) as unknown as typeof fetch

    const agent = createAgent({
      token: 't',
      baseUrl: 'http://test.local',
      fetch: spyFetch,
      onApproval: (req) => {
        seen.push(`${req.toolName}:${req.toolCallId}:${req.dangerLevel}`)
        expect(req.argsPreview).toEqual({ path: 'a.ts' })
        return 'approve'
      },
    })
    await agent.run('跑')
    expect(seen).toEqual(['write_file:tc_9:medium'])
    expect(captured[0]).toEqual({ approvalId: 'ap_2', decision: 'approve' })
  })

  it('onApproval 自身抛错 → 降级 reject(不放行)', async () => {
    const captured: Record<string, unknown>[] = []
    const { fetchFn } = makeFetch([
      { kind: 'json', body: START_RESULT },
      {
        kind: 'sse',
        frames: [
          {
            jsonrpc: '2.0',
            method: 'approval/request',
            params: { requestId: 'ap_3', threadId: 'thr_1', toolName: 'x' },
          },
          { jsonrpc: '2.0', id: 2, result: runResult() },
        ],
      },
      { kind: 'json', body: { jsonrpc: '2.0', id: 3, result: {} } },
    ])
    const spyFetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const parsed = JSON.parse(String(init?.body ?? '{}')) as {
        method?: string
        params?: Record<string, unknown>
      }
      if (parsed.method === 'approval.respond') captured.push(parsed.params ?? {})
      return fetchFn(url, init)
    }) as unknown as typeof fetch

    const agent = createAgent({
      token: 't',
      baseUrl: 'http://test.local',
      fetch: spyFetch,
      onApproval: () => {
        throw new Error('审批服务不可用')
      },
    })
    await agent.run('跑')
    expect(captured[0].decision).toBe('reject')
  })
})

describe('createAgent 控制面', () => {
  it('interrupt / state / resume / close 的方法名与参数形态正确', async () => {
    const { fetchFn, calls } = makeFetch([
      { kind: 'json', body: START_RESULT },
      {
        kind: 'json',
        body: { jsonrpc: '2.0', id: 2, result: { interrupted: true, mode: 'pause' } },
      },
      { kind: 'json', body: { jsonrpc: '2.0', id: 3, result: { threadId: 'thr_1', prompts: 1 } } },
      {
        kind: 'sse',
        frames: [{ jsonrpc: '2.0', id: 4, result: runResult({ stopReason: 'resumed' }) }],
      },
      { kind: 'json', body: { jsonrpc: '2.0', id: 5, result: { closed: true } } },
    ])
    const agent = createAgent({ token: 't', baseUrl: 'http://test.local', fetch: fetchFn })
    await agent.start()
    const interrupted = await agent.interrupt('pause')
    await agent.state()
    const resumed = await agent.resume('ckpt_7')
    await agent.close()

    expect(calls.map((c) => c.method)).toEqual([
      'thread.start',
      'thread.interrupt',
      'thread.state',
      'thread.resume',
      'thread.close',
    ])
    expect(interrupted).toEqual({ interrupted: true, mode: 'pause' })
    expect(calls[1].params).toEqual({ threadId: 'thr_1', mode: 'pause' })
    expect(calls[3].params).toEqual({ threadId: 'thr_1', checkpointId: 'ckpt_7' })
    expect(resumed.stopReason).toBe('resumed')
    expect(agent.started).toBe(false)
  })

  it('close 幂等:未启动时不发请求,关闭后再次 close 也不发', async () => {
    const { fetchFn, calls } = makeFetch([{ kind: 'json', body: START_RESULT }])
    const agent = createAgent({ token: 't', baseUrl: 'http://test.local', fetch: fetchFn })
    await agent.close()
    await agent.start()
    await agent.close()
    await agent.close()
    expect(calls.map((c) => c.method)).toEqual(['thread.start', 'thread.close'])
  })

  it('cost / models / listTools 走差异化管理端点', async () => {
    const { fetchFn, calls } = makeFetch([
      { kind: 'json', body: START_RESULT },
      { kind: 'json', body: { jsonrpc: '2.0', id: 2, result: { available: true, report: {} } } },
      { kind: 'json', body: { jsonrpc: '2.0', id: 3, result: { models: [], total: 0 } } },
      { kind: 'json', body: { jsonrpc: '2.0', id: 4, result: { pool: [], total: 0 } } },
    ])
    const agent = createAgent({ token: 't', baseUrl: 'http://test.local', fetch: fetchFn })
    await agent.start()
    await agent.cost({ source: 'relay' })
    await agent.models()
    await agent.listTools()
    expect(calls.map((c) => c.method)).toEqual([
      'thread.start',
      'cost.report',
      'models.list',
      'tools.list',
    ])
    expect(calls[1].params).toEqual({ filter: { source: 'relay' } })
  })

  it('respondApproval 可被宿主直接调用(自行裁决路径)', async () => {
    const { fetchFn, calls } = makeFetch([
      { kind: 'json', body: START_RESULT },
      { kind: 'json', body: { jsonrpc: '2.0', id: 2, result: { applied: true } } },
    ])
    const agent = createAgent({ token: 't', baseUrl: 'http://test.local', fetch: fetchFn })
    await agent.start()
    await agent.respondApproval('ap_9', 'approve')
    expect(calls[1].method).toBe('approval.respond')
    expect(calls[1].params).toEqual({ approvalId: 'ap_9', decision: 'approve' })
  })
})

describe('协议常量(与引擎 handler 表 parity)', () => {
  it('方法名 / 通知名与 agent_engine.py 契约一致', () => {
    expect([...ENGINE_METHODS]).toEqual([
      'engine.initialize',
      'engine.ping',
      'thread.start',
      'thread.prompt',
      'thread.interrupt',
      'thread.resume',
      'thread.state',
      'thread.close',
      'agent.exec',
      'tools.list',
      'tools.register',
      'tools.result',
      'approval.respond',
      'cost.report',
      'models.list',
    ])
    expect([...ENGINE_NOTIFICATIONS]).toEqual(['thread/event', 'tool/execute', 'approval/request'])
    expect(ENGINE_ERROR_CODES.threadClosed).toBe(-32006)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
