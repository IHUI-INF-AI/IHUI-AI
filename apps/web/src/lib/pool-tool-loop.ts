// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * pool-tool-loop.ts — 号池模型的工具回路(2026-11-21 立)。
 *
 * 为什么要有它:
 * - 号池模型(workbuddy/hy4flash 等)走 /ws/relay/chat 长连接,该通道此前只做纯对话
 *   (客户端不传 tools、也丢弃上游 tool_calls)⇒ 用户拿号池模型问人事/财务时,模型只能
 *   答"我无法调用工具",而这些能力在平台腿其实都可用。
 * - 服务端 ws-relay-chat 早就把 tools 透传给上游(见该插件 tools/tool_choice 两处),
 *   缺的是客户端这一环:取 schema → 带上工具定义 → 收 tool_calls → 执行 → 续跑。
 *
 * 设计取舍:
 * - **schema 从 /ai/mcp/tools 取**(ai-service 已注册 500+ 工具,含 input_schema),按名字
 *   过滤出本轮该带的那几条;同一份清单缓存 10 分钟,避免每轮拉 200KB。
 * - **执行走 /ai/mcp/tools/call**(api 侧既有代理,权限矩阵由 ai-service 判),前端不复制
 *   任何 RBAC 判据。
 * - **续跑用文本回灌**而非 OpenAI 的 tool 角色协议:上游是第三方号池,不保证认
 *   assistant.tool_calls / role=tool 的组合;把"工具执行结果"写成一条 user 消息最稳,
 *   任何模型都能读懂,也不会因格式挑剔整轮失败。
 * - **只跑有限轮**(默认 4):工具→再调工具的死循环必须有硬上限,超限即收束。
 */

import { fetchApi } from '@/lib/api'
import { streamRelayChat, type RelayChatMessage, type RelayToolCall } from './relay-chat-stream'

/** /ai/mcp/tools 返回的条目(字段来自 ai-service asdict(ToolSpec)) */
interface PoolToolSpec {
  name?: unknown
  description?: unknown
  input_schema?: unknown
}

interface PoolToolCatalogEntry {
  name: string
  description: string
  parameters: Record<string, unknown>
}

interface CatalogCache {
  at: number
  byName: Map<string, PoolToolCatalogEntry>
}

const CATALOG_TTL_MS = 10 * 60 * 1000
let catalogCache: CatalogCache | null = null

/** 单次工具输出的最大字符数(超长结果截断,避免把上游上下文挤爆) */
const MAX_TOOL_OUTPUT_CHARS = 8000

function normalizeSpec(raw: PoolToolSpec): PoolToolCatalogEntry | null {
  const name = typeof raw?.name === 'string' ? raw.name.trim() : ''
  if (!name) return null
  const description = typeof raw?.description === 'string' ? raw.description : ''
  const parameters =
    raw?.input_schema && typeof raw.input_schema === 'object' && !Array.isArray(raw.input_schema)
      ? (raw.input_schema as Record<string, unknown>)
      : { type: 'object', properties: {} }
  return { name, description, parameters }
}

/** 取工具目录(带 10 分钟缓存);取不到返回空表,调用方据此降级为纯对话 */
async function loadCatalog(): Promise<Map<string, PoolToolCatalogEntry>> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) return catalogCache.byName
  const res = await fetchApi<{ list?: PoolToolSpec[] }>('/ai/mcp/tools', {
    method: 'GET',
    timeoutMs: 20_000,
  })
  if (!res.success || !res.data) return catalogCache?.byName ?? new Map()
  const byName = new Map<string, PoolToolCatalogEntry>()
  for (const raw of res.data.list ?? []) {
    const entry = normalizeSpec(raw)
    if (entry) byName.set(entry.name, entry)
  }
  catalogCache = { at: Date.now(), byName }
  return byName
}

/** 把本轮该带上的工具名清单转成 OpenAI tools 定义(目录里没有的跳过) */
export function buildOpenAiTools(
  catalog: Map<string, PoolToolCatalogEntry>,
  names: readonly string[],
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = []
  for (const name of names) {
    const entry = catalog.get(name)
    if (!entry) continue
    out.push({
      type: 'function',
      function: { name: entry.name, description: entry.description, parameters: entry.parameters },
    })
  }
  return out
}

/** 把工具返回值压成一段可读文本(content 数组优先,其余 JSON 兜底) */
function stringifyToolResult(payload: unknown): string {
  const parts: string[] = []
  const push = (v: unknown): void => {
    if (typeof v === 'string' && v.trim()) parts.push(v)
  }
  if (payload && typeof payload === 'object') {
    const content = (payload as { content?: unknown }).content
    if (Array.isArray(content)) {
      for (const item of content) {
        if (typeof item === 'string') push(item)
        else if (item && typeof item === 'object') {
          const text = (item as { text?: unknown }).text
          if (typeof text === 'string') push(text)
        }
      }
    }
    if (parts.length === 0) {
      const structured = (payload as { structuredContent?: unknown }).structuredContent
      if (structured !== undefined) {
        try {
          parts.push(JSON.stringify(structured))
        } catch {
          /* 循环引用:忽略 */
        }
      }
    }
  } else {
    push(payload)
  }
  if (parts.length === 0) {
    try {
      parts.push(JSON.stringify(payload))
    } catch {
      parts.push(String(payload))
    }
  }
  const text = parts.join('\n').trim() || '(工具返回为空)'
  return text.length > MAX_TOOL_OUTPUT_CHARS
    ? `${text.slice(0, MAX_TOOL_OUTPUT_CHARS)}…(已截断)`
    : text
}

interface ToolExecution {
  ok: boolean
  output: string
}

/** 执行一次工具调用(权限、审计、配额全部在 ai-service 侧) */
async function executeToolCall(call: RelayToolCall): Promise<ToolExecution> {
  let args: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(call.arguments || '{}') as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      args = parsed as Record<string, unknown>
    }
  } catch {
    return { ok: false, output: `参数不是合法 JSON:${call.arguments.slice(0, 200)}` }
  }
  const res = await fetchApi<Record<string, unknown>>('/ai/mcp/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: call.name, arguments: args }),
    timeoutMs: 60_000,
  })
  if (!res.success) {
    return { ok: false, output: res.error || '工具执行失败' }
  }
  // 失败态两档都认:① 工具协议层 isError;② 业务层拒绝(如算薪缺配置被引擎挡下,
  // 返回 ok=false 但 HTTP 200)。只认传输层会把"这次没算成"渲染成"已完成",误导人。
  const payload = res.data as { isError?: unknown; ok?: unknown; success?: unknown } | null
  const isError = Boolean(payload?.isError) || payload?.ok === false || payload?.success === false
  return { ok: !isError, output: stringifyToolResult(res.data) }
}

export interface PoolToolLoopOptions {
  model: string
  messages: RelayChatMessage[]
  conversationId?: string
  signal?: AbortSignal
  reasoningEffort?: string
  /** 本轮该携带的工具名清单(空数组 ⇒ 等价于纯对话) */
  toolNames?: readonly string[]
  /** 正文增量(与平台腿同一条回调) */
  onDelta: (delta: string) => void
  /** 某个工具开始执行(调用方据此在消息上挂 toolCall 卡片) */
  onToolStart?: (call: RelayToolCall, args: Record<string, unknown>) => void
  /** 某个工具执行结束 */
  onToolEnd?: (call: RelayToolCall, ok: boolean, output: string) => void
  onError: (message: string) => void
  onUsage?: (usage: { promptTokens: number; completionTokens: number; totalTokens: number }) => void
  /** 全部轮次结束(只回调一次;单轮纯对话也走这里) */
  onDone?: () => void
  /** 工具往返轮数上限,默认 4 */
  maxRounds?: number
}

/**
 * 跑一条号池通道的对话(必要时带工具)。
 * 永不 reject:失败经 onError 呈现,与 streamRelayChat 的既有调用姿势一致。
 */
export async function runPoolToolLoop(opts: PoolToolLoopOptions): Promise<void> {
  const roundLimit = Math.max(1, opts.maxRounds ?? 4)
  const toolNames = (opts.toolNames ?? []).filter((n) => typeof n === 'string' && n.length > 0)
  let tools: Array<Record<string, unknown>> = []
  if (toolNames.length > 0) {
    try {
      const catalog = await loadCatalog()
      tools = buildOpenAiTools(catalog, toolNames)
    } catch {
      // 目录取不到:降级纯对话,由模型自己说明能力边界(不冒充成功)
      tools = []
    }
  }

  let messages: RelayChatMessage[] = [...opts.messages]

  for (let round = 0; round < roundLimit; round += 1) {
    let roundText = ''
    let roundCalls: RelayToolCall[] = []
    let failedMessage: string | null = null

    await streamRelayChat({
      model: opts.model,
      messages,
      ...(opts.signal ? { signal: opts.signal } : {}),
      ...(opts.conversationId ? { conversationId: opts.conversationId } : {}),
      ...(opts.reasoningEffort ? { reasoningEffort: opts.reasoningEffort } : {}),
      ...(tools.length > 0 ? { tools } : {}),
      onDelta: (delta) => {
        roundText += delta
        opts.onDelta(delta)
      },
      ...(opts.onUsage ? { onUsage: opts.onUsage } : {}),
      onToolCalls: (calls) => {
        roundCalls = calls
      },
      onError: (message) => {
        failedMessage = message
      },
    })

    if (failedMessage) {
      opts.onError(failedMessage)
      return
    }
    if (opts.signal?.aborted) return
    // 本轮没有工具调用 = 模型已给出最终答复,正常收束
    if (roundCalls.length === 0) {
      opts.onDone?.()
      return
    }

    const outputs: string[] = []
    for (const call of roundCalls) {
      let args: Record<string, unknown> = {}
      try {
        const parsed = JSON.parse(call.arguments || '{}') as unknown
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          args = parsed as Record<string, unknown>
        }
      } catch {
        args = {}
      }
      opts.onToolStart?.(call, args)
      const result = await executeToolCall(call)
      opts.onToolEnd?.(call, result.ok, result.output)
      outputs.push(`【${call.name}】${result.ok ? '' : '(失败) '}${result.output}`)
      if (opts.signal?.aborted) return
    }

    // 文本回灌:比 OpenAI tool 角色协议更抗上游格式挑剔(见文件头注)
    messages = [
      ...messages,
      {
        role: 'assistant',
        content: roundText.trim() || `（调用工具：${roundCalls.map((c) => c.name).join('、')}）`,
      },
      {
        role: 'user',
        content: `以下是刚执行完的工具返回结果,请据此继续回答用户(不要再重复调用已成功的同一工具,除非确实需要补充参数):\n\n${outputs.join('\n\n')}`,
      },
    ]
  }

  // 到达轮数上限:收束并在正文里说明,不装作已完成
  opts.onError(`工具往返已达 ${roundLimit} 轮上限,本轮到此为止`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
