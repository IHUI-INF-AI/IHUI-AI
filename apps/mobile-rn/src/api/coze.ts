/** Coze 平台 API 客户端 — mobile-rn 端。直连 Coze(用户填 PAT),覆盖 chat(同步+SSE)/conversations/messages/workflows/bots/datasets。 */
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface CozeConfig { token: string; baseUrl: string; botId: string; timeout: number }
export const COZE_DEFAULT_BASE_URL = 'https://api.coze.cn'
export const COZE_DEFAULT_TIMEOUT = 30000
const STORAGE_KEY = 'coze_config_v1'

export async function loadCozeConfig(): Promise<CozeConfig> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      const p = JSON.parse(raw) as Partial<CozeConfig>
      return { token: p.token ?? '', baseUrl: p.baseUrl ?? COZE_DEFAULT_BASE_URL, botId: p.botId ?? '', timeout: p.timeout ?? COZE_DEFAULT_TIMEOUT }
    } catch { /* fallthrough */ }
  }
  return { token: '', baseUrl: COZE_DEFAULT_BASE_URL, botId: '', timeout: COZE_DEFAULT_TIMEOUT }
}

export async function saveCozeConfig(cfg: CozeConfig): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
}

export async function clearCozeConfig(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY)
}

export class CozeApiError extends Error {
  code: number
  detail: string
  constructor(message: string, code: number, detail: string) {
    super(message)
    this.name = 'CozeApiError'
    this.code = code
    this.detail = detail
  }
}

async function requireConfig(): Promise<CozeConfig> {
  const cfg = await loadCozeConfig()
  if (!cfg.token) throw new CozeApiError('Coze token 未配置,请先到 API 设置页填写', -1, '')
  return cfg
}

function buildUrl(baseUrl: string, path: string, params?: Record<string, string | undefined>): string {
  const url = `${baseUrl.replace(/\/$/, '')}${path}`
  if (!params) return url
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.append(k, v)
  }
  const s = qs.toString()
  return s ? `${url}?${s}` : url
}

interface CozeResponse<T> { code: number; msg: string; data: T }

async function cozeRequest<T>(
  path: string,
  opts: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown; params?: Record<string, string | undefined>; timeoutMs?: number } = {},
): Promise<T> {
  const cfg = await requireConfig()
  const url = buildUrl(cfg.baseUrl, path, opts.params)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? cfg.timeout)
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new CozeApiError(`HTTP ${res.status}`, res.status, text)
    }
    const json = (await res.json()) as CozeResponse<T>
    if (json.code !== 0) throw new CozeApiError(json.msg || `业务错误 code=${json.code}`, json.code, JSON.stringify(json))
    return json.data
  } finally {
    clearTimeout(timer)
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  content_type?: 'text' | 'object_string'
  type?: string
  meta_data?: Record<string, unknown>
}
export interface CreateChatOptions {
  bot_id?: string
  user_id: string
  conversation_id?: string
  additional_messages?: ChatMessage[]
  custom_variables?: Record<string, unknown>
  parameters?: Record<string, unknown>
  auto_save_history?: boolean
}
export interface CozeUsage { input_count?: number; output_count?: number; token_count?: number }
export interface ChatCreated { id: string; conversation_id: string; status: string; usage?: CozeUsage }
export interface ChatStatus { status: string; usage?: CozeUsage; last_error?: string; completed_at?: number }
export interface ChatMessageItem { id: string; type: string; content: string; content_type: string; created_at: number }
export interface WorkflowRunResult { execute_id: string; debug_url?: string; data?: unknown }

export function createChat(opts: CreateChatOptions): Promise<ChatCreated> {
  return cozeRequest<ChatCreated>('/v3/chat', {
    method: 'POST',
    body: {
      bot_id: opts.bot_id, user_id: opts.user_id, stream: false, auto_save_history: opts.auto_save_history ?? true,
      additional_messages: opts.additional_messages?.map((m) => ({ role: m.role, type: m.type ?? 'question', content: m.content, content_type: m.content_type ?? 'text', meta_data: m.meta_data })),
      ...(opts.conversation_id ? { conversation_id: opts.conversation_id } : {}),
      ...(opts.custom_variables ? { custom_variables: opts.custom_variables } : {}),
      ...(opts.parameters ? { parameters: opts.parameters } : {}),
    },
  })
}

export function retrieveChat(conversationId: string, chatId: string): Promise<ChatStatus> {
  return cozeRequest<ChatStatus>('/v3/chat/retrieve', { params: { conversation_id: conversationId, chat_id: chatId } })
}

export function listChatMessages(conversationId: string, chatId: string): Promise<{ data: ChatMessageItem[] }> {
  return cozeRequest<{ data: ChatMessageItem[] }>('/v3/chat/message/list', { params: { conversation_id: conversationId, chat_id: chatId } })
}

/** 轮询至对话完成(completed/failed/canceled),返回最终状态 + 消息列表 */
export async function pollChatComplete(conversationId: string, chatId: string, opts: { intervalMs?: number; maxWaitMs?: number } = {}): Promise<{ status: ChatStatus; messages: ChatMessageItem[] }> {
  const interval = opts.intervalMs ?? 1500
  const maxWait = opts.maxWaitMs ?? 120000
  const start = Date.now()
  for (;;) {
    const status = await retrieveChat(conversationId, chatId)
    if (['completed', 'failed', 'canceled'].includes(status.status)) {
      return { status, messages: (await listChatMessages(conversationId, chatId)).data ?? [] }
    }
    if (Date.now() - start > maxWait) throw new CozeApiError('轮询超时', -1, `wait > ${maxWait}ms`)
    await new Promise((r) => setTimeout(r, interval))
  }
}

export function createConversation(meta?: Record<string, unknown>): Promise<{ id: string; created_at: number }> {
  return cozeRequest<{ id: string; created_at: number }>('/v3/conversation/create', { method: 'POST', body: meta ?? {} })
}
export function retrieveConversation(id: string): Promise<{ id: string; created_at: number; meta_data?: Record<string, unknown> }> {
  return cozeRequest('/v3/conversation/retrieve', { params: { conversation_id: id } })
}
export function runWorkflow(opts: { workflow_id: string; parameters: Record<string, unknown>; is_async?: boolean; timeoutMs?: number }): Promise<WorkflowRunResult> {
  return cozeRequest<WorkflowRunResult>('/v1/workflow/run', {
    method: 'POST',
    body: { workflow_id: opts.workflow_id, parameters: opts.parameters, is_async: opts.is_async ?? false },
    timeoutMs: opts.timeoutMs,
  })
}
export function getWorkflowHistory(workflowId: string, executeId: string): Promise<unknown> {
  return cozeRequest(`/v1/workflows/${workflowId}/run_histories/${executeId}`)
}
export function listBots(workspaceId: string): Promise<unknown> {
  return cozeRequest('/v1/bot/list', { params: { workspace_id: workspaceId } })
}
export function getBotOnlineInfo(botId: string): Promise<unknown> {
  return cozeRequest('/v1/bot/get_online_info', { method: 'POST', body: { bot_id: botId } })
}
export function listDatasets(workspaceId: string, pageSize = 20, pageIndex = 1): Promise<unknown> {
  return cozeRequest('/v1/datasets', { params: { workspace_id: workspaceId, page_size: String(pageSize), page_index: String(pageIndex) } })
}
export function createDataset(name: string, workspaceId: string): Promise<{ dataset_id: string }> {
  return cozeRequest<{ dataset_id: string }>('/v1/datasets', { method: 'POST', body: { name, workspace_id: workspaceId, capacity: 1 } })
}
export function deleteDataset(datasetId: string): Promise<unknown> {
  return cozeRequest(`/v1/datasets/${datasetId}`, { method: 'DELETE' })
}

export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  const cfg = await loadCozeConfig()
  if (!cfg.token) return { ok: false, message: '未填写 API 令牌' }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), cfg.timeout)
  try {
    const res = await fetch(buildUrl(cfg.baseUrl, '/v3/conversation/create', {}), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({}), signal: controller.signal,
    })
    if (res.status === 401) return { ok: false, message: 'API 令牌无效(401)' }
    if (res.status === 404) return { ok: false, message: 'Base URL 不可达(404)' }
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` }
    return { ok: true, message: '连接成功' }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : '网络异常' }
  } finally {
    clearTimeout(timer)
  }
}

export interface StreamChatHandlers { onDelta?: (delta: string) => void; onDone?: () => void; onError?: (err: Error) => void }

export async function streamChat(opts: CreateChatOptions, handlers: StreamChatHandlers, timeoutMs?: number): Promise<void> {
  const cfg = await requireConfig()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? cfg.timeout)
  try {
    const res = await fetch(buildUrl(cfg.baseUrl, '/v3/chat', {}), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ ...opts, stream: true }), signal: controller.signal,
    })
    if (!res.ok || !res.body) {
      throw new CozeApiError(`HTTP ${res.status}`, res.status, await res.text().catch(() => ''))
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, '')
        buffer = buffer.slice(nl + 1)
        if (!line || line.startsWith(':') || !line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') continue
        try {
          const json = JSON.parse(data)
          if (json?.code && json.code !== 0) throw new CozeApiError(json.msg || `code=${json.code}`, json.code, data)
          const delta = json?.delta ?? json?.content ?? json?.data?.content
          if (typeof delta === 'string' && delta) handlers.onDelta?.(delta)
        } catch (e) {
          if (e instanceof CozeApiError) throw e
        }
      }
    }
    handlers.onDone?.()
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') { handlers.onError?.(new Error('请求超时或被取消')); return }
    handlers.onError?.(err instanceof Error ? err : new Error(String(err)))
  } finally {
    clearTimeout(timer)
  }
}
