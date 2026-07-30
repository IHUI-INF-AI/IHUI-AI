/**
 * Playground API 调用层:直连 /v1/* 公开端点(X-Ihui-Api-Key 鉴权由 v1-public.ts 提供,
 * 实际支持 Authorization: Bearer 与 X-Api-Key 两种头,此处用 Bearer)。
 *
 * 不走 fetchApi(那是内部 session 鉴权),playground 用用户自己的 API Key 直接调 /v1/*。
 */

import type {
  PlaygroundMessage,
  PlaygroundParams,
  PlaygroundResponse,
} from '@/components/playground/PlaygroundTypes'

/**
 * 推导 API base URL:
 * - Tauri 环境 / dev 环境(localhost:8801):直连 localhost:8802,绕过 Next.js dev proxy(SSE 会被 proxy 中断)
 * - 生产环境:NEXT_PUBLIC_API_BASE_URL 或同源(留空)
 * 与 apps/web/src/lib/api.ts detectStreamBaseUrl 逻辑保持一致。
 */
function getPlaygroundBaseUrl(): string {
  if (typeof window !== 'undefined') {
    if ('__TAURI_INTERNALS__' in window) {
      return 'http://localhost:8802'
    }
    if (window.location.hostname === 'localhost' && window.location.port === '8801') {
      return 'http://localhost:8802'
    }
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || ''
}

/**
 * 代码生成用的对外 base URL(展示给用户):
 * 有显式 base 用 base,否则用当前 origin,兜底占位。
 */
function getPublicBaseUrl(): string {
  const base = getPlaygroundBaseUrl()
  if (base) return base.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '')
  return 'https://api.ihui.ai'
}

/** 构造请求体(与 OpenAI 兼容格式对齐) */
function buildRequestBody(
  messages: PlaygroundMessage[],
  params: PlaygroundParams,
): Record<string, unknown> {
  return {
    model: params.model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: params.temperature,
    max_tokens: params.maxTokens,
    top_p: params.topP,
    stream: params.stream,
  }
}

/** 安全解析 SSE 行为对象,失败返回 null */
function parseSseJson(line: string): Record<string, unknown> | null {
  if (!line.startsWith('data:')) return null
  const data = line.slice(5).trim()
  if (!data || data === '[DONE]') return null
  try {
    const parsed = JSON.parse(data) as unknown
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>
    }
  } catch {
    // 非 JSON 行,跳过
  }
  return null
}

/** 从 usage 对象安全取数值 */
function safeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0
}

/** 粗略估算 token(1 token ≈ 4 字符,中英文混合) */
function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}

/**
 * 调用 /v1/chat/completions,支持 stream + 非流式。
 * stream=true 时通过 onStreamDelta 实时回调增量文本。
 */
export async function callPlayground(
  messages: PlaygroundMessage[],
  params: PlaygroundParams,
  apiKey: string,
  onStreamDelta?: (delta: string) => void,
): Promise<PlaygroundResponse> {
  const base = getPlaygroundBaseUrl()
  const url = `${base}/v1/chat/completions`
  const startTime = Date.now()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
  const body = JSON.stringify(buildRequestBody(messages, params))

  const resp = await fetch(url, { method: 'POST', headers, body })
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    throw new Error(`请求失败 (${resp.status}): ${errText.slice(0, 300) || resp.statusText}`)
  }

  if (params.stream && onStreamDelta && resp.body) {
    // 流式 SSE 解析
    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let content = ''
    let promptTokens = 0
    let completionTokens = 0
    let totalTokens = 0
    let model = params.model

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, '').trim()
        buffer = buffer.slice(nl + 1)
        const json = parseSseJson(line)
        if (!json) continue
        if (typeof json.model === 'string') model = json.model
        const choices = json.choices
        if (Array.isArray(choices) && choices.length > 0) {
          const choice = choices[0] as Record<string, unknown>
          const delta = choice.delta as Record<string, unknown> | undefined
          if (delta && typeof delta.content === 'string' && delta.content) {
            content += delta.content
            onStreamDelta(delta.content)
          }
        }
        const usage = json.usage as Record<string, unknown> | undefined
        if (usage) {
          promptTokens = safeNumber(usage.prompt_tokens) || promptTokens
          completionTokens = safeNumber(usage.completion_tokens) || completionTokens
          totalTokens = safeNumber(usage.total_tokens) || totalTokens
        }
      }
    }

    // 流式无 usage 时按字符估算
    if (totalTokens === 0) {
      completionTokens = estimateTokens(content)
      promptTokens = estimateTokens(messages.map((m) => m.content).join(''))
      totalTokens = promptTokens + completionTokens
    }

    return {
      content,
      promptTokens,
      completionTokens,
      totalTokens,
      costCents: 0,
      latencyMs: Date.now() - startTime,
      model,
    }
  }

  // 非流式
  const data = (await resp.json()) as Record<string, unknown>
  let content = ''
  const choices = data.choices
  if (Array.isArray(choices) && choices.length > 0) {
    const choice = choices[0] as Record<string, unknown>
    const message = choice.message as Record<string, unknown> | undefined
    if (message && typeof message.content === 'string') {
      content = message.content
    }
  }
  const usage = (data.usage as Record<string, unknown> | undefined) ?? {}
  const promptTokens = safeNumber(usage.prompt_tokens)
  const completionTokens = safeNumber(usage.completion_tokens)
  const totalTokens =
    safeNumber(usage.total_tokens) || promptTokens + completionTokens
  const model = typeof data.model === 'string' ? data.model : params.model

  return {
    content,
    promptTokens,
    completionTokens,
    totalTokens,
    costCents: 0,
    latencyMs: Date.now() - startTime,
    model,
  }
}

/** 拉取 /v1/models 模型列表(用 API Key 鉴权) */
export async function fetchPlaygroundModels(apiKey: string): Promise<string[]> {
  const base = getPlaygroundBaseUrl()
  const resp = await fetch(`${base}/v1/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!resp.ok) {
    throw new Error(`获取模型列表失败 (${resp.status})`)
  }
  const data = (await resp.json()) as Record<string, unknown>
  const arr = data.data
  if (!Array.isArray(arr)) return []
  const ids: string[] = []
  for (const m of arr) {
    if (typeof m === 'object' && m !== null) {
      const id = (m as Record<string, unknown>).id
      if (typeof id === 'string' && id) ids.push(id)
    }
  }
  return ids
}

/** 生成 cURL 代码 */
export function generateCurlCode(
  messages: PlaygroundMessage[],
  params: PlaygroundParams,
  apiKey: string,
): string {
  const base = getPublicBaseUrl()
  const body = JSON.stringify(buildRequestBody(messages, params), null, 2)
  return `curl -X POST ${base}/v1/chat/completions \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '${body}'`
}

/** 生成 Python 代码(openai SDK) */
export function generatePythonCode(
  messages: PlaygroundMessage[],
  params: PlaygroundParams,
  apiKey: string,
): string {
  const base = getPublicBaseUrl()
  const messagesJson = JSON.stringify(
    messages.map((m) => ({ role: m.role, content: m.content })),
  )
  return `from openai import OpenAI

client = OpenAI(
    api_key="${apiKey}",
    base_url="${base}/v1",
)

response = client.chat.completions.create(
    model="${params.model}",
    messages=${messagesJson},
    temperature=${params.temperature},
    max_tokens=${params.maxTokens},
    top_p=${params.topP},
    stream=${params.stream},
)
print(response.choices[0].message.content)`
}

/** 生成 Node.js 代码(openai SDK) */
export function generateNodejsCode(
  messages: PlaygroundMessage[],
  params: PlaygroundParams,
  apiKey: string,
): string {
  const base = getPublicBaseUrl()
  const messagesJson = JSON.stringify(
    messages.map((m) => ({ role: m.role, content: m.content })),
    null,
    2,
  )
  return `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "${apiKey}",
  baseURL: "${base}/v1",
});

const response = await client.chat.completions.create({
  model: "${params.model}",
  messages: ${messagesJson},
  temperature: ${params.temperature},
  max_tokens: ${params.maxTokens},
  top_p: ${params.topP},
  stream: ${params.stream},
});
console.log(response.choices[0].message.content);`
}
