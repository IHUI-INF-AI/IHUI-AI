// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 本地模型 Provider 生态(Ollama / vLLM / openai-compatible)。
 *
 * 设计动机:CLI 的 LLM 调用统一走 @ihui/api-client 的 streamChat(SSE,POST {baseUrl}/ai/chat/stream)。
 * Ollama 与 vLLM 都暴露 OpenAI 兼容端点但不支持该自定义 SSE 协议,因此本模块提供一个
 * **OpenAI 兼容流式客户端**(fetch + SSE 解析),消息/工具协议与 streamChat 对齐,
 * 供 runToolLoop 在 provider==='ollama'/'openai-compatible' 时替换默认采样路径。
 *
 * 配置解析(resolveProviderSettings):
 *   - settings.provider === 'ollama' → baseUrl 默认 http://localhost:11434/v1
 *   - settings.provider === 'openai-compatible'(vLLM 等)→ 必须显式 provider.baseUrl
 *   - offline=true 且用户未显式配置 apiUrl → 强制指向本地 ollama(离线模式兜底)
 *
 * 零依赖:仅用 node fetch(Node >=20),不引入 openai SDK。
 */

import type { Settings } from '../commands/settings.js';

/** Ollama 默认端点(OpenAI 兼容层挂在 /v1 下) */
export const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434/v1';
/** Ollama 原生 API 根(模型列表探测用 GET /api/tags) */
export const OLLAMA_NATIVE_ROOT = 'http://localhost:11434';

export type LocalProviderKind = 'ollama' | 'openai-compatible';

/** provider 解析结果 */
export interface ResolvedProvider {
  /** undefined = 沿用远端后端(apiUrl);'ollama'/'openai-compatible' = 本地直连 */
  kind?: LocalProviderKind;
  /** OpenAI 兼容 chat/completions 完整 URL(kind 存在时有效) */
  chatCompletionsUrl?: string;
  /** 本地默认模型名(kind 存在且 defaultModel 非占位 'default' 时用 defaultModel) */
  model?: string;
}

/** 归一化 baseUrl:去尾部斜杠 */
function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * 从 Settings 解析本地 provider 配置。
 *
 * 规则(优先级从高到低):
 * 1. settings.provider 显式为 'ollama'/'openai-compatible' → 本地直连
 *    - ollama:baseUrl = settings.providerBaseUrl ?? OLLAMA_DEFAULT_BASE_URL
 *    - openai-compatible:baseUrl = settings.providerBaseUrl(必填,缺失返回 undefined 走远端)
 * 2. settings.offline === true 且无显式 apiUrl → 兜底为 ollama 默认端点
 * 3. 其他 → kind undefined(沿用远端后端 streamChat 路径,零回归)
 */
export function resolveProvider(settings: Settings): ResolvedProvider {
  const explicit = settings.provider;
  const offlineForcesLocal =
    settings.offline === true && !settings.apiUrl && !explicit;

  const kind: LocalProviderKind | undefined =
    explicit === 'ollama' || explicit === 'openai-compatible'
      ? explicit
      : offlineForcesLocal
        ? 'ollama'
        : undefined;

  if (!kind) return {};

  const base =
    settings.providerBaseUrl?.trim() ||
    (kind === 'ollama' ? OLLAMA_DEFAULT_BASE_URL : '');
  // openai-compatible 缺 baseUrl 无法直连,降级走远端
  if (!base) return {};

  const model =
    settings.defaultModel && settings.defaultModel !== 'default'
      ? settings.defaultModel
      : kind === 'ollama'
        ? settings.localQwen?.modelName
        : undefined;

  return { kind, chatCompletionsUrl: `${trimSlash(base)}/chat/completions`, model };
}

// ==================== OpenAI 兼容流式客户端 ====================

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

export interface OpenAiStreamOptions {
  /** chat/completions 完整 URL */
  url: string;
  model: string;
  messages: ChatCompletionMessage[];
  /** 原生 tools schema(OpenAI function calling 格式,可选) */
  tools?: unknown[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** 文本增量回调 */
  onDelta?: (delta: string) => void;
  /** 完整 tool_call 回调(流内聚合结束后触发) */
  onToolCall?: (call: { id: string; name: string; arguments: Record<string, unknown> }) => void;
  /** 请求超时毫秒(默认 120_000,本地推理可能较慢) */
  timeoutMs?: number;
}

export interface OpenAiStreamResult {
  /** 聚合后的完整文本 */
  text: string;
  /** 聚合后的 tool_calls(arguments 已 JSON.parse,失败保留原始字符串于 error 路径) */
  toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  /** 结束原因:stop / tool_calls / length / abort / error */
  finishReason: string;
  /** 流内错误(网络/HTTP 错误也归入此字段,不抛出,与 sampleWithRetry 的 errMsg 语义对齐) */
  error?: string;
}

/**
 * 解析一行 SSE data(`data: {...}` → JSON;`data: [DONE]` → null)。
 * 非 data 行(:注释、event: 行)返回 undefined。
 */
function parseSseLine(line: string): unknown | '[DONE]' | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return undefined;
  const payload = trimmed.slice(5).trim();
  if (payload === '[DONE]') return '[DONE]';
  try {
    return JSON.parse(payload);
  } catch {
    return undefined;
  }
}

/** tool_call 增量聚合:key = index,累加 function.name / arguments 片段 */
interface ToolCallAccumulator {
  id: string;
  name: string;
  args: string;
}

/**
 * OpenAI 兼容流式 chat completion(GET 语义即 POST /chat/completions + stream:true)。
 *
 * 逐行解析 SSE,聚合 delta.content 与 delta.tool_calls(index 维度拼接),
 * 结束后把 tool_call arguments 字符串 JSON.parse 为对象。
 * 任何 HTTP/网络错误不抛出,统一以 { error } 返回(调用方按错误处理)。
 */
export async function streamOpenAiCompatible(
  opts: OpenAiStreamOptions,
): Promise<OpenAiStreamResult> {
  const empty: OpenAiStreamResult = { text: '', toolCalls: [], finishReason: 'error', error: '' };
  const acc: OpenAiStreamResult = { ...empty, toolCalls: [] };
  const toolAcc = new Map<number, ToolCallAccumulator>();
  let text = '';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 120_000);
  const externalAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', externalAbort, { once: true });

  try {
    const body: Record<string, unknown> = {
      model: opts.model,
      messages: opts.messages,
      stream: true,
    };
    if (opts.tools?.length) body.tools = opts.tools;
    if (opts.temperature !== undefined) body.temperature = opts.temperature;
    if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens;

    const resp = await fetch(opts.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!resp.ok || !resp.body) {
      const detail = await resp.text().catch(() => '');
      return { ...acc, error: `请求失败（${resp.status}）${detail ? ': ' + detail.slice(0, 200) : ''}` };
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let streamEnded = false;
    // 防御:mock/异常实现下 read() 可能返回 { value: undefined, done: false },避免死循环撑爆内存
    for (;;) {
      const { value, done: streamDone } = await reader.read();
      if (streamDone || streamEnded) break;
      if (!value) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        const parsed = parseSseLine(line);
        if (parsed === '[DONE]') { streamEnded = true; break; }
        if (parsed === undefined || typeof parsed !== 'object') continue;
        const chunk = parsed as {
          choices?: Array<{
            delta?: {
              content?: string;
              tool_calls?: Array<{
                index?: number;
                id?: string;
                function?: { name?: string; arguments?: string };
              }>;
            };
            finish_reason?: string | null;
          }>;
        };
        const choice = chunk.choices?.[0];
        if (!choice) continue;
        if (typeof choice.delta?.content === 'string' && choice.delta.content) {
          text += choice.delta.content;
          opts.onDelta?.(choice.delta.content);
        }
        for (const tc of choice.delta?.tool_calls ?? []) {
          const idx = tc.index ?? 0;
          const cur = toolAcc.get(idx) ?? { id: '', name: '', args: '' };
          if (tc.id) cur.id = tc.id;
          if (tc.function?.name) cur.name += tc.function.name;
          if (tc.function?.arguments) cur.args += tc.function.arguments;
          toolAcc.set(idx, cur);
        }
        if (choice.finish_reason) acc.finishReason = choice.finish_reason;
      }
    }

    const toolCalls: OpenAiStreamResult['toolCalls'] = [];
    for (const [, cur] of [...toolAcc.entries()].sort((a, b) => a[0] - b[0])) {
      let args: Record<string, unknown> = {};
      if (cur.args.trim()) {
        try {
          const parsedArgs: unknown = JSON.parse(cur.args);
          args = parsedArgs && typeof parsedArgs === 'object' && !Array.isArray(parsedArgs)
            ? (parsedArgs as Record<string, unknown>)
            : {};
        } catch {
          // arguments 不完整/非法 JSON:视为流错误(上层会当纯文本重试)
          return { ...acc, text, error: `tool_call arguments 解析失败: ${cur.args.slice(0, 120)}` };
        }
      }
      const call = { id: cur.id || `call_${toolCalls.length}`, name: cur.name, arguments: args };
      toolCalls.push(call);
      opts.onToolCall?.(call);
    }
    if (!acc.finishReason) acc.finishReason = toolCalls.length ? 'tool_calls' : 'stop';
    return { ...acc, text, toolCalls };
  } catch (e) {
    if (opts.signal?.aborted) return { ...acc, text, finishReason: 'abort', error: 'aborted' };
    if (controller.signal.aborted) return { ...acc, text, finishReason: 'abort', error: 'timeout' };
    return { ...acc, text, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', externalAbort);
  }
}

// ==================== Ollama 模型探测 ====================

/** GET {root}/api/tags 的模型名列表(Ollama 原生 API,离线模式下服务未启动时返回空数组) */
export async function listOllamaModels(
  baseUrl?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  // baseUrl 可能是 OpenAI 兼容端点(.../v1),/api/tags 挂在根上,需要剥离 /v1
  const root = trimSlash(baseUrl || OLLAMA_NATIVE_ROOT).replace(/\/v1$/, '');
  try {
    const resp = await fetchImpl(`${root}/api/tags`, { method: 'GET' });
    if (!resp.ok) return [];
    const data: unknown = await resp.json();
    if (data && typeof data === 'object' && Array.isArray((data as { models?: unknown }).models)) {
      return ((data as { models: Array<{ name?: unknown }> }).models)
        .map((m) => (typeof m?.name === 'string' ? m.name : ''))
        .filter(Boolean);
    }
    return [];
  } catch {
    return [];
  }
}
