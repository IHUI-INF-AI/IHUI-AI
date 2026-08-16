/**
 * Coze API 端点(跨端共享)— 直连 Coze 官方 API(PAT 鉴权),不走项目后端。
 * 各端通过 createCozeClient(config) 创建客户端,config 由各端自行持久化。
 */
import type {
  CozeConfig,
  CozeChatMessage,
  CozeCreateChatOptions,
  CozeChatCreated,
  CozeChatStatus,
  CozeChatMessageItem,
  CozeWorkflowRunResult,
  CozeStreamChatHandlers,
} from '@ihui/types'

export const COZE_DEFAULT_BASE_URL = 'https://api.coze.cn'
export const COZE_DEFAULT_TIMEOUT = 30000

/** Coze API 错误(含业务码 + 详情) */
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

/** Coze 客户端接口(所有方法均使用 createCozeClient 传入的 config) */
export interface CozeClient {
  createChat(opts: CozeCreateChatOptions): Promise<CozeChatCreated>
  retrieveChat(conversationId: string, chatId: string): Promise<CozeChatStatus>
  listChatMessages(conversationId: string, chatId: string): Promise<{ data: CozeChatMessageItem[] }>
  pollChatComplete(
    conversationId: string,
    chatId: string,
    opts?: { intervalMs?: number; maxWaitMs?: number },
  ): Promise<{ status: CozeChatStatus; messages: CozeChatMessageItem[] }>
  createConversation(meta?: Record<string, unknown>): Promise<{ id: string; created_at: number }>
  retrieveConversation(
    id: string,
  ): Promise<{ id: string; created_at: number; meta_data?: Record<string, unknown> }>
  runWorkflow(opts: {
    workflow_id: string
    parameters: Record<string, unknown>
    is_async?: boolean
    timeoutMs?: number
  }): Promise<CozeWorkflowRunResult>
  getWorkflowHistory(workflowId: string, executeId: string): Promise<unknown>
  listBots(workspaceId: string): Promise<unknown>
  getBotOnlineInfo(botId: string): Promise<unknown>
  listDatasets(workspaceId: string, pageSize?: number, pageIndex?: number): Promise<unknown>
  createDataset(name: string, workspaceId: string): Promise<{ dataset_id: string }>
  deleteDataset(datasetId: string): Promise<unknown>
  testConnection(): Promise<{ ok: boolean; message: string }>
  streamChat(
    opts: CozeCreateChatOptions,
    handlers: CozeStreamChatHandlers,
    timeoutMs?: number,
  ): Promise<void>
}

interface CozeResponse<T> {
  code: number
  msg: string
  data: T
}

function buildUrl(
  baseUrl: string,
  path: string,
  params?: Record<string, string | undefined>,
): string {
  const url = `${baseUrl.replace(/\/$/, '')}${path}`
  if (!params) return url
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.append(k, v)
  }
  const s = qs.toString()
  return s ? `${url}?${s}` : url
}

/** 创建 Coze 客户端(config.token 必填,其余字段缺省时使用默认值) */
export function createCozeClient(config: CozeConfig): CozeClient {
  const baseUrl = config.baseUrl || COZE_DEFAULT_BASE_URL
  const timeout = config.timeout || COZE_DEFAULT_TIMEOUT

  async function cozeRequest<T>(
    path: string,
    opts: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
      body?: unknown
      params?: Record<string, string | undefined>
      timeoutMs?: number
    } = {},
  ): Promise<T> {
    if (!config.token) throw new CozeApiError('Coze token 未配置,请先到 API 设置页填写', -1, '')
    const url = buildUrl(baseUrl, path, opts.params)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? timeout)
    try {
      const res = await fetch(url, {
        method: opts.method ?? 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new CozeApiError(`HTTP ${res.status}`, res.status, text)
      }
      const json = (await res.json()) as CozeResponse<T>
      if (json.code !== 0)
        throw new CozeApiError(
          json.msg || `业务错误 code=${json.code}`,
          json.code,
          JSON.stringify(json),
        )
      return json.data
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    createChat(opts: CozeCreateChatOptions): Promise<CozeChatCreated> {
      return cozeRequest<CozeChatCreated>('/v3/chat', {
        method: 'POST',
        body: {
          bot_id: opts.bot_id,
          user_id: opts.user_id,
          stream: false,
          auto_save_history: opts.auto_save_history ?? true,
          additional_messages: opts.additional_messages?.map((m: CozeChatMessage) => ({
            role: m.role,
            type: m.type ?? 'question',
            content: m.content,
            content_type: m.content_type ?? 'text',
            meta_data: m.meta_data,
          })),
          ...(opts.conversation_id ? { conversation_id: opts.conversation_id } : {}),
          ...(opts.custom_variables ? { custom_variables: opts.custom_variables } : {}),
          ...(opts.parameters ? { parameters: opts.parameters } : {}),
        },
      })
    },
    retrieveChat(conversationId: string, chatId: string): Promise<CozeChatStatus> {
      return cozeRequest<CozeChatStatus>('/v3/chat/retrieve', {
        params: { conversation_id: conversationId, chat_id: chatId },
      })
    },
    listChatMessages(
      conversationId: string,
      chatId: string,
    ): Promise<{ data: CozeChatMessageItem[] }> {
      return cozeRequest<{ data: CozeChatMessageItem[] }>('/v3/chat/message/list', {
        params: { conversation_id: conversationId, chat_id: chatId },
      })
    },
    async pollChatComplete(
      conversationId: string,
      chatId: string,
      opts: { intervalMs?: number; maxWaitMs?: number } = {},
    ): Promise<{ status: CozeChatStatus; messages: CozeChatMessageItem[] }> {
      const interval = opts.intervalMs ?? 1500
      const maxWait = opts.maxWaitMs ?? 120000
      const start = Date.now()
      for (;;) {
        const status = await this.retrieveChat(conversationId, chatId)
        if (['completed', 'failed', 'canceled'].includes(status.status)) {
          return {
            status,
            messages: (await this.listChatMessages(conversationId, chatId)).data ?? [],
          }
        }
        if (Date.now() - start > maxWait)
          throw new CozeApiError('轮询超时', -1, `wait > ${maxWait}ms`)
        await new Promise((r) => setTimeout(r, interval))
      }
    },
    createConversation(
      meta?: Record<string, unknown>,
    ): Promise<{ id: string; created_at: number }> {
      return cozeRequest<{ id: string; created_at: number }>('/v3/conversation/create', {
        method: 'POST',
        body: meta ?? {},
      })
    },
    retrieveConversation(
      id: string,
    ): Promise<{ id: string; created_at: number; meta_data?: Record<string, unknown> }> {
      return cozeRequest('/v3/conversation/retrieve', { params: { conversation_id: id } })
    },
    runWorkflow(opts: {
      workflow_id: string
      parameters: Record<string, unknown>
      is_async?: boolean
      timeoutMs?: number
    }): Promise<CozeWorkflowRunResult> {
      return cozeRequest<CozeWorkflowRunResult>('/v1/workflow/run', {
        method: 'POST',
        body: {
          workflow_id: opts.workflow_id,
          parameters: opts.parameters,
          is_async: opts.is_async ?? false,
        },
        timeoutMs: opts.timeoutMs,
      })
    },
    getWorkflowHistory(workflowId: string, executeId: string): Promise<unknown> {
      return cozeRequest(`/v1/workflows/${workflowId}/run_histories/${executeId}`)
    },
    listBots(workspaceId: string): Promise<unknown> {
      return cozeRequest('/v1/bot/list', { params: { workspace_id: workspaceId } })
    },
    getBotOnlineInfo(botId: string): Promise<unknown> {
      return cozeRequest('/v1/bot/get_online_info', { method: 'POST', body: { bot_id: botId } })
    },
    listDatasets(workspaceId: string, pageSize = 20, pageIndex = 1): Promise<unknown> {
      return cozeRequest('/v1/datasets', {
        params: {
          workspace_id: workspaceId,
          page_size: String(pageSize),
          page_index: String(pageIndex),
        },
      })
    },
    createDataset(name: string, workspaceId: string): Promise<{ dataset_id: string }> {
      return cozeRequest<{ dataset_id: string }>('/v1/datasets', {
        method: 'POST',
        body: { name, workspace_id: workspaceId, capacity: 1 },
      })
    },
    deleteDataset(datasetId: string): Promise<unknown> {
      return cozeRequest(`/v1/datasets/${datasetId}`, { method: 'DELETE' })
    },
    async testConnection(): Promise<{ ok: boolean; message: string }> {
      if (!config.token) return { ok: false, message: '未填写 API 令牌' }
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeout)
      try {
        const res = await fetch(buildUrl(baseUrl, '/v3/conversation/create', {}), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
          body: JSON.stringify({}),
          signal: controller.signal,
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
    },
    async streamChat(
      opts: CozeCreateChatOptions,
      handlers: CozeStreamChatHandlers,
      timeoutMs?: number,
    ): Promise<void> {
      if (!config.token) throw new CozeApiError('Coze token 未配置', -1, '')
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs ?? timeout)
      try {
        const res = await fetch(buildUrl(baseUrl, '/v3/chat', {}), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
          body: JSON.stringify({ ...opts, stream: true }),
          signal: controller.signal,
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
              const json = JSON.parse(data) as {
                code?: number
                msg?: string
                delta?: string
                content?: string
                data?: { content?: string }
              }
              if (json?.code && json.code !== 0)
                throw new CozeApiError(json.msg || `code=${json.code}`, json.code, data)
              const delta = json?.delta ?? json?.content ?? json?.data?.content
              if (typeof delta === 'string' && delta) handlers.onDelta?.(delta)
            } catch (e) {
              if (e instanceof CozeApiError) throw e
            }
          }
        }
        handlers.onDone?.()
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          handlers.onError?.(new Error('请求超时或被取消'))
          return
        }
        handlers.onError?.(err instanceof Error ? err : new Error(String(err)))
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
