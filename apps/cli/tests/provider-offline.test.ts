// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 生态扩展测试:本地 Provider(Ollama / openai-compatible)+ 离线模式 + MCP 配置标准化。
 *
 * 覆盖:
 *   1. resolveProvider 各分支(显式 ollama / openai-compatible 缺 baseUrl 降级 / offline 兜底 / 默认远端)
 *   2. streamOpenAiCompatible SSE 流解析(mock fetch,不发真实网络请求;文本增量 + tool_calls 聚合 + HTTP 错误语义)
 *   3. listOllamaModels GET /api/tags 探测(mock fetch)
 *   4. env 层映射 IHUI_PROVIDER / IHUI_PROVIDER_BASE_URL / IHUI_OFFLINE
 *   5. normalizeMcpInput / validateMcpConfig(Claude/Cursor {mcpServers:{}} 格式归一化 + schema 校验)
 */
import { describe, expect, it, vi } from 'vitest'
import {
  resolveProvider,
  streamOpenAiCompatible,
  listOllamaModels,
  OLLAMA_DEFAULT_BASE_URL,
} from '../src/provider/local.js'
import { parseEnvOverrides } from '../src/config/env.js'
import { normalizeMcpInput, validateMcpConfig } from '../src/commands/mcp-config.js'

// mock @ihui/api-client(参考 tests/native-fc-config.test.ts):
//   避免真实网络调用与 opentelemetry 等重依赖在 worker 内加载导致 OOM。
vi.mock('@ihui/api-client', () => ({
  streamChat: vi.fn(async () => {}),
  setBaseUrl: vi.fn(),
  setTokenProvider: vi.fn(),
  formatSSEError: (e: Error) => ({ severity: 'unknown', message: e.message, title: '', rawMessage: e.message }),
}))

// ==================== resolveProvider ====================

describe('resolveProvider', () => {
  it('未配置 provider 且非 offline → kind undefined(零回归走远端)', () => {
    expect(resolveProvider({ apiUrl: 'http://backend:8802' })).toEqual({})
  })

  it("provider='ollama' → 默认 baseUrl http://localhost:11434/v1", () => {
    const r = resolveProvider({ provider: 'ollama' })
    expect(r.kind).toBe('ollama')
    expect(r.chatCompletionsUrl).toBe(`${OLLAMA_DEFAULT_BASE_URL}/chat/completions`)
  })

  it("provider='ollama' + providerBaseUrl(带尾斜杠)→ 归一化去斜杠", () => {
    const r = resolveProvider({ provider: 'ollama', providerBaseUrl: 'http://10.0.0.5:11434/v1/' })
    expect(r.chatCompletionsUrl).toBe('http://10.0.0.5:11434/v1/chat/completions')
  })

  it("provider='openai-compatible'(vLLM)→ 用显式 providerBaseUrl", () => {
    const r = resolveProvider({
      provider: 'openai-compatible',
      providerBaseUrl: 'http://localhost:8000/v1',
      defaultModel: 'Qwen/Qwen2.5-7B-Instruct',
    })
    expect(r.kind).toBe('openai-compatible')
    expect(r.chatCompletionsUrl).toBe('http://localhost:8000/v1/chat/completions')
    expect(r.model).toBe('Qwen/Qwen2.5-7B-Instruct')
  })

  it("provider='openai-compatible' 缺 providerBaseUrl → 降级走远端({})", () => {
    expect(resolveProvider({ provider: 'openai-compatible' })).toEqual({})
  })

  it('offline=true 且无显式 apiUrl/provider → 兜底 ollama', () => {
    // loadSettingsV2 会剥离等于默认值的 apiUrl,故 offline 兜底判定基于"用户未显式配置"
    const r = resolveProvider({ offline: true })
    expect(r.kind).toBe('ollama')
    expect(r.chatCompletionsUrl).toBe(`${OLLAMA_DEFAULT_BASE_URL}/chat/completions`)
  })

  it('offline=true 但显式配置 apiUrl → 不强制本地(尊重用户远端配置)', () => {
    expect(resolveProvider({ offline: true, apiUrl: 'https://example.com' })).toEqual({})
  })

  it('model 解析:defaultModel 占位 "default" 时回退 localQwen.modelName', () => {
    const r = resolveProvider({
      provider: 'ollama',
      defaultModel: 'default',
      localQwen: { modelName: 'qwen2.5:7b' },
    })
    expect(r.model).toBe('qwen2.5:7b')
  })
})

// ==================== streamOpenAiCompatible ====================

/**
 * 构造 mock fetch 响应:body 为按行切分的 SSE 流(每行独立 chunk,含结尾换行)。
 * 注意:read() 必须自增游标并在耗尽后返回 done:true,否则消费方死循环撑爆内存。
 */
function mockFetchResponse(lines: string[], ok = true, status = 200): unknown {
  const encoder = new TextEncoder()
  return {
    ok,
    status,
    text: async () => '',
    body: {
      getReader: () => {
        let i = 0
        return {
          read: async () => {
            if (i >= lines.length) return { value: undefined, done: true }
            const line = lines[i]
            i++
            return { value: encoder.encode(line), done: false } as { value: Uint8Array; done: boolean }
          },
        }
      },
    },
  }
}

function sseChunk(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n`
}

describe('streamOpenAiCompatible', () => {
  it('聚合 delta.content 并触发 onDelta,[DONE] 正常结束', async () => {
    const fetchMock = vi.fn(async () =>
      mockFetchResponse([
        sseChunk({ choices: [{ delta: { content: '你好' } }] }),
        sseChunk({ choices: [{ delta: { content: ',世界' }, finish_reason: 'stop' }] }),
        'data: [DONE]\n',
      ]),
    ) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchMock)
    try {
      const deltas: string[] = []
      const r = await streamOpenAiCompatible({
        url: 'http://localhost:11434/v1/chat/completions',
        model: 'qwen2.5:7b',
        messages: [{ role: 'user', content: 'hi' }],
        onDelta: (d) => deltas.push(d),
      })
      expect(r.error).toBeFalsy()
      expect(r.text).toBe('你好,世界')
      expect(deltas).toEqual(['你好', ',世界'])
      expect(r.finishReason).toBe('stop')
      expect(r.toolCalls).toEqual([])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('tool_calls 增量按 index 聚合,arguments 完成后 JSON.parse', async () => {
    const call = (idx: number, extra: Record<string, unknown>) =>
      sseChunk({ choices: [{ delta: { tool_calls: [{ index: idx, ...extra }] } }] })
    const fetchMock = vi.fn(async () =>
      mockFetchResponse([
        call(0, { id: 'call_a', function: { name: 'read_', arguments: '{"pa' } }),
        call(0, { function: { name: 'file', arguments: 'th":"a.ts"}' } }),
        call(1, { id: 'call_b', function: { name: 'list_dir', arguments: '{}' } }),
        sseChunk({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }),
        'data: [DONE]\n',
      ]),
    ) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchMock)
    try {
      const r = await streamOpenAiCompatible({
        url: 'http://x/chat/completions',
        model: 'm',
        messages: [],
      })
      expect(r.error).toBeFalsy()
      expect(r.finishReason).toBe('tool_calls')
      expect(r.toolCalls).toHaveLength(2)
      expect(r.toolCalls[0]).toEqual({ id: 'call_a', name: 'read_file', arguments: { path: 'a.ts' } })
      expect(r.toolCalls[1]).toEqual({ id: 'call_b', name: 'list_dir', arguments: {} })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('HTTP 非 2xx → 不抛出,返回 { error }', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => 'boom',
      body: null,
    })) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchMock)
    try {
      const r = await streamOpenAiCompatible({
        url: 'http://x/chat/completions',
        model: 'm',
        messages: [],
      })
      expect(r.error).toContain('500')
      expect(r.toolCalls).toEqual([])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('网络异常(fetch reject)→ 不抛出,返回 { error }', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchMock)
    try {
      const r = await streamOpenAiCompatible({
        url: 'http://x/chat/completions',
        model: 'm',
        messages: [],
      })
      expect(r.error).toContain('ECONNREFUSED')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

// ==================== listOllamaModels ====================

describe('listOllamaModels', () => {
  it('GET /api/tags 解析模型名列表(baseUrl 带 /v1 时剥离到根)', async () => {
    const fetchMock = vi.fn(async (url: unknown) => {
      expect(String(url)).toBe('http://localhost:11434/api/tags')
      return {
        ok: true,
        json: async () => ({ models: [{ name: 'qwen2.5:7b' }, { name: 'llama3' }, { nope: 1 }] }),
      }
    }) as unknown as typeof fetch
    const names = await listOllamaModels(OLLAMA_DEFAULT_BASE_URL, fetchMock)
    expect(names).toEqual(['qwen2.5:7b', 'llama3'])
  })

  it('服务未启动(fetch reject)→ 空数组', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch
    expect(await listOllamaModels(undefined, fetchMock)).toEqual([])
  })

  it('HTTP 非 2xx → 空数组', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false })) as unknown as typeof fetch
    expect(await listOllamaModels('http://x:11434/v1', fetchMock)).toEqual([])
  })
})

// ==================== env 层映射 ====================

describe('offline/provider 配置解析', () => {
  it('parseEnvOverrides 映射 IHUI_PROVIDER / IHUI_PROVIDER_BASE_URL / IHUI_OFFLINE', () => {
    const partial = parseEnvOverrides({
      IHUI_PROVIDER: 'ollama',
      IHUI_PROVIDER_BASE_URL: 'http://10.0.0.9:11434/v1',
      IHUI_OFFLINE: '1',
    })
    expect(partial.provider).toBe('ollama')
    expect(partial.providerBaseUrl).toBe('http://10.0.0.9:11434/v1')
    expect(partial.offline).toBe(true)
  })

  it('IHUI_OFFLINE=0 → false', () => {
    expect(parseEnvOverrides({ IHUI_OFFLINE: '0' }).offline).toBe(false)
  })
})

// ==================== MCP 配置标准化 ====================

describe('normalizeMcpInput / validateMcpConfig', () => {
  it('Claude/Cursor {mcpServers:{}} 外部格式归一化为原生数组格式', () => {
    const norm = normalizeMcpInput({
      mcpServers: {
        fs: { command: 'npx', args: ['-y', 'server-fs'], env: { K: 'V' } },
        remote: { url: 'http://localhost:9000/sse' },
      },
    })
    expect(norm.servers).toHaveLength(2)
    const fs = norm.servers.find((s) => s.name === 'fs')
    expect(fs?.transport).toBe('stdio')
    expect(fs?.command).toBe('npx')
    const remote = norm.servers.find((s) => s.name === 'remote')
    expect(remote?.transport).toBe('http')
  })

  it('IHUI 原生 {servers:[...]} 格式原样通过', () => {
    const norm = normalizeMcpInput({ servers: [{ name: 'a', command: 'x' }] })
    expect(norm.servers).toEqual([{ name: 'a', command: 'x' }])
  })

  it('非法输入(数组/null/标量)→ { servers: [] }', () => {
    expect(normalizeMcpInput([1, 2])).toEqual({ servers: [] })
    expect(normalizeMcpInput(null)).toEqual({ servers: [] })
    expect(normalizeMcpInput('str')).toEqual({ servers: [] })
  })

  it('validateMcpConfig:stdio 缺 command / http 缺 url / args 类型错 → errors', () => {
    const r = validateMcpConfig({
      servers: [
        { name: 'no-cmd', transport: 'stdio' },
        { name: 'no-url', transport: 'http' },
        { name: 'bad-args', command: 'x', args: [1, 2] },
        { name: 'ok', command: 'x', args: ['a'] },
      ],
    })
    expect(r.valid.map((s) => s.name)).toEqual(['ok'])
    expect(r.errors).toHaveLength(3)
  })

  it('validateMcpConfig:兼容外部格式并完成校验', () => {
    const r = validateMcpConfig({ mcpServers: { good: { command: 'npx', args: ['-y', 'pkg'] } } })
    expect(r.errors).toEqual([])
    expect(r.valid).toHaveLength(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
