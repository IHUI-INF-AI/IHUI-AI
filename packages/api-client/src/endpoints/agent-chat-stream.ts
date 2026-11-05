// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Agent 会话 SSE 消费出口(B4,2026-11-02 立)。
 *
 * 契约来源 = 提交 247f9f5652(`POST /api/agents/:id/messages/stream`),按代码而非记忆:
 *  - 事件序列 `meta → delta* → done → data: [DONE]`;三帧均带 `id: <seq>`(自 1 递增),
 *    `[DONE]` 不编号、不进回放缓冲;
 *  - 心跳是注释帧 `: ping`(15s),按 SSE 规范被忽略,不占编号 ⇒ 不能当业务帧;
 *  - `Last-Event-ID` 语义:窗口完整 + 原流在飞 ⇒ 接管并只重放 `id > lastSeq`;
 *    原流已收尾但缓冲仍在 60s 保留窗 ⇒ 仅重放缺失段后补 `[DONE]`;
 *    窗口有洞/过期 ⇒ 服务端**重新生成**(会再发一个新的 `meta`),客户端必须据此重置累积文本。
 *
 * 失败策略(本批口径):断线由 `runResumableSSEStream` 带 `Last-Event-ID` 重连一次;
 * 仍失败则回落 `GET ?version=2` 分页读 + 一次性 `POST /messages`,并显式抛错而不是静默收尾。
 * 传输层(重连/退避/读超时/续传游标)复用 client.ts 的唯一实现,本文件不写第二份。
 */
import type { AgentChatMessage } from '@ihui/types'
import {
  fetchApi,
  getBaseUrl,
  getToken,
  getUserAgent,
  isAbortError,
  runResumableSSEStream,
} from '../client.js'

/** `meta` 帧(服务端声明本轮 id 与模型,不是正文)。 */
export interface AgentChatStreamMeta {
  type: 'meta'
  agentId?: string
  messageId?: string
  userMessageId?: string
  model?: string | null
  ts?: number
}

/** 流成功收尾时交给消费方的终态(落库结果读取失败时 messages 为 null)。 */
export interface AgentChatStreamDone {
  type: 'done'
  /** stream = SSE 正常收尾;fallback = 重连仍失败后走分页读 + 一次性 POST */
  mode: 'stream' | 'fallback'
  messageId: string | null
  finishReason: string | null
  /** 服务端最终落库的消息页(供宿主"用最终结果替换本地消息");读取失败为 null */
  messages: AgentChatMessage[] | null
}

/** 回落发生时的显式说明(宿主可据此提示"已降级为一次性请求")。 */
export interface AgentChatStreamFallbackInfo {
  reason: 'transport' | 'server-error' | 'incomplete'
  message: string
}

export interface AgentChatStreamCallbacks {
  /** 收到 `meta`(重连后被服务端重新生成时会再发一次,累积文本已随之重置) */
  onMeta?: (meta: AgentChatStreamMeta) => void
  /** 收到 `delta`;accumulated = 本代际已累积的全文(消费方无需自己拼) */
  onDelta?: (delta: string, accumulated: string) => void
  /** 断线重连前的通知(attempt 从 1 起) */
  onReconnect?: (info: { attempt: number; delayMs: number }) => void
  /** 重连仍失败、开始回落前通知一次 */
  onFallback?: (info: AgentChatStreamFallbackInfo) => void
  /** 终态:只成功收尾时调用一次;失败走 completion 的 reject,不在此伪装成功 */
  onDone?: (done: AgentChatStreamDone) => void
}

export interface AgentChatStreamParams {
  agentId: string
  content: string
}

export interface AgentChatStreamOptions {
  /** 外部取消信号(与 handle.abort 等价;两者任一命中即停) */
  signal?: AbortSignal
  /** 断线重连次数,缺省 1(本批口径:重连一次) */
  maxReconnects?: number
  /** 重连退避初值 ms(缺省 400) */
  reconnectDelayMs?: number
  /** 读空闲上限 ms(缺省 40s;服务端 15s 心跳,留两拍余量) */
  readTimeoutMs?: number
  /** 是否允许回落,缺省 true;关闭后传输失败直接抛错 */
  fallback?: boolean
}

/** 成功终态(与 onDone 同形,但不含 type 字段的口径重复)。 */
export interface AgentChatStreamOutcome {
  mode: 'stream' | 'fallback'
  messageId: string | null
  finishReason: string | null
  content: string
  messages: AgentChatMessage[] | null
}

export interface AgentChatStreamHandle {
  /** 主动取消:之后不再触发任何回调,也不再发起回落请求 */
  abort: () => void
  /** 终态 promise:成功 resolve;失败 reject(abort 也会 reject AbortError) */
  completion: Promise<AgentChatStreamOutcome>
}

/** v2 分页读的响应形状(`pageAgentMessages` 产出,字段逐字对齐后端)。 */
export interface AgentChatMessagesPage {
  items: AgentChatMessage[]
  total: number
  hasMoreOlder: boolean
  nextCursor: number | null
}

const DEFAULT_LIMIT = 50

function agentPath(agentId: string): string {
  return `/api/agents/${encodeURIComponent(agentId)}/messages`
}

/**
 * v2 分页读(核心用途 = 回落路径与"done 后用最终落库结果替换本地消息")。
 *
 * 走 `fetchApi`(凭据注入 / 401 续期 / 熔断都归它),不自己再发裸 fetch。
 * 失败抛错而不是返回空数组:空数组会把"读失败"伪装成"真的没有消息"。
 */
export async function fetchAgentChatMessages(
  agentId: string,
  options: { limit?: number; cursor?: number | null; signal?: AbortSignal } = {},
): Promise<AgentChatMessage[]> {
  const params = new URLSearchParams({
    version: '2',
    limit: String(options.limit ?? DEFAULT_LIMIT),
  })
  if (options.cursor !== null && options.cursor !== undefined) {
    params.set('cursor', String(options.cursor))
  }
  const res = await fetchApi<AgentChatMessagesPage>(`${agentPath(agentId)}?${params.toString()}`, {
    signal: options.signal,
  })
  if (!res.success) throw new Error(res.error)
  return res.data.items
}

type ParsedFrame =
  | { type: 'meta'; raw: Record<string, unknown> }
  | { type: 'delta'; content: string }
  | { type: 'done'; messageId?: string; finishReason?: string }
  | { type: 'error'; reason?: string; message: string }
  | null

function parseFrame(payload: string): ParsedFrame {
  if (payload === '[DONE]') return { type: 'done' }
  let json: Record<string, unknown>
  try {
    json = JSON.parse(payload) as Record<string, unknown>
  } catch {
    return null
  }
  const type = typeof json.type === 'string' ? json.type : null
  if (type === 'meta') return { type: 'meta', raw: json }
  if (type === 'delta') {
    return typeof json.content === 'string' ? { type: 'delta', content: json.content } : null
  }
  if (type === 'done') {
    return {
      type: 'done',
      messageId: typeof json.messageId === 'string' ? json.messageId : undefined,
      finishReason: typeof json.finishReason === 'string' ? json.finishReason : undefined,
    }
  }
  if (type === 'error') {
    return {
      type: 'error',
      reason: typeof json.reason === 'string' ? json.reason : undefined,
      message: typeof json.message === 'string' && json.message ? json.message : '流式回复失败',
    }
  }
  return null
}

function abortErrorOf(): Error {
  if (typeof DOMException !== 'undefined') return new DOMException('Aborted', 'AbortError')
  const err = new Error('Aborted')
  err.name = 'AbortError'
  return err
}

/**
 * 流式发一条 Agent 会话消息并增量回调。
 *
 * 回调顺序:onMeta → onDelta* → (onDone | completion reject);断线时先 onReconnect,
 * 回落时再 onFallback。任何回调都带 aborted 闸 —— abort 之后一个都不会再触发。
 */
export function streamAgentChat(
  params: AgentChatStreamParams,
  callbacks: AgentChatStreamCallbacks = {},
  options: AgentChatStreamOptions = {},
): AgentChatStreamHandle {
  const controller = new AbortController()
  let aborted = false
  const abort = () => {
    aborted = true
    controller.abort()
  }
  if (options.signal) {
    if (options.signal.aborted) controller.abort()
    else options.signal.addEventListener('abort', abort, { once: true })
  }

  const guard = <A extends unknown[]>(fn: ((...args: A) => void) | undefined, ...args: A) => {
    if (aborted || !fn) return
    fn(...args)
  }

  const completion = (async (): Promise<AgentChatStreamOutcome> => {
    const url = `${getBaseUrl().replace(/\/$/, '')}${agentPath(params.agentId)}/stream`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    }
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
    headers['X-Requested-With'] = 'XMLHttpRequest'
    const ua = getUserAgent()
    if (ua) headers['User-Agent'] = ua

    let content = ''
    let sawMeta = false
    let sawDone = false
    let messageId: string | null = null
    let finishReason: string | null = null
    let serverError: { reason?: string; message: string } | null = null
    /** 服务端是否发过 `[DONE]`(协议终止符;仅用于失败归因,不单独立成功) */
    let sawTerminator = false

    // TS 的闭包赋值不参与收窄:下面读终态时一律走 getter,避免被判成 never/null 常量。
    const readState = () => ({
      content,
      sawDone,
      messageId,
      finishReason,
      serverError,
      sawTerminator,
    })

    const resetGeneration = () => {
      content = ''
      sawDone = false
      finishReason = null
      sawTerminator = false
    }

    const handleLine = (line: string): void => {
      if (aborted) return
      const text = line.replace(/\r$/, '')
      // 爱心跳/注释帧:按规范忽略(服务端 15s 一笔,不编号、不进事件序列)
      if (text === '' || text.startsWith(':')) return
      if (!text.startsWith('data:')) return
      const payload = text.slice(5).replace(/^\s/, '')
      if (payload === '') return
      const frame = parseFrame(payload)
      if (!frame) return

      if (frame.type === 'meta') {
        // 第二次 meta = 服务端因重放窗口有洞而重新生成:必须丢弃上一代的部分文本,
        // 否则两代内容会被拼成一个从未存在过的回答。
        if (sawMeta) resetGeneration()
        sawMeta = true
        const meta = frame.raw
        messageId = typeof meta.messageId === 'string' ? meta.messageId : null
        guard(callbacks.onMeta, {
          type: 'meta',
          agentId: typeof meta.agentId === 'string' ? meta.agentId : undefined,
          messageId: messageId ?? undefined,
          userMessageId: typeof meta.userMessageId === 'string' ? meta.userMessageId : undefined,
          model: typeof meta.model === 'string' ? meta.model : null,
          ts: typeof meta.ts === 'number' ? meta.ts : undefined,
        })
        return
      }
      if (frame.type === 'delta') {
        if (!frame.content) return
        content += frame.content
        guard(callbacks.onDelta, frame.content, content)
        return
      }
      if (frame.type === 'error') {
        // 显式 error 帧是业务失败:不在 onLine 抛(那会触发一次没意义的传输重连),
        // 记为终态由下方统一走回落。
        serverError = { reason: frame.reason, message: frame.message }
        return
      }
      // done(含 `data: [DONE]`)[DONE] 只是协议终止符,`done` 帧才带 messageId
      if (frame.messageId) messageId = frame.messageId
      if ('finishReason' in frame && frame.finishReason) finishReason = frame.finishReason
      sawDone = sawDone || payload !== '[DONE]'
      sawTerminator = true
    }

    const readFinalPage = async (): Promise<AgentChatMessage[] | null> => {
      try {
        return await fetchAgentChatMessages(params.agentId, { signal: controller.signal })
      } catch {
        return null
      }
    }

    const finish = (
      mode: 'stream' | 'fallback',
      finalContent: string,
      finalMessageId: string | null,
      finalFinishReason: string | null,
      messages: AgentChatMessage[] | null,
    ): AgentChatStreamOutcome => {
      const outcome: AgentChatStreamOutcome = {
        mode,
        messageId: finalMessageId,
        finishReason: finalFinishReason,
        content: finalContent,
        messages,
      }
      guard(callbacks.onDone, {
        type: 'done',
        mode,
        messageId: finalMessageId,
        finishReason: finalFinishReason,
        messages,
      })
      return outcome
    }

    try {
      try {
        await runResumableSSEStream({
          url,
          method: 'POST',
          body: JSON.stringify({ content: params.content }),
          headers,
          signal: controller.signal,
          maxRetries: options.maxReconnects ?? 1,
          initialRetryDelayMs: options.reconnectDelayMs ?? 400,
          maxRetryDelayMs: 2_000,
          readTimeoutMs: options.readTimeoutMs ?? 40_000,
          onLine: handleLine,
          onReconnect: (attempt, delayMs) => guard(callbacks.onReconnect, { attempt, delayMs }),
        })
      } catch (err) {
        if (aborted || isAbortError(err)) throw abortErrorOf()
        throw err
      }

      if (aborted) throw abortErrorOf()
      const state = readState()
      if (state.serverError) {
        const e = new Error(state.serverError.message)
        ;(e as Error & { reason?: string }).reason = state.serverError.reason ?? 'upstream_error'
        throw e
      }
      if (!state.sawDone) {
        const e = new Error(
          state.sawTerminator ? '流以 [DONE] 结束但缺少 done 帧' : '流未以 done 结束',
        )
        ;(e as Error & { reason?: string }).reason = 'incomplete'
        throw e
      }

      const messages = await readFinalPage()
      return finish('stream', state.content, state.messageId, state.finishReason, messages)
    } catch (err) {
      if (aborted || isAbortError(err)) throw abortErrorOf()
      if (options.fallback === false) throw err
      // ---- 回落:version=2 分页读 + 一次性 POST ----
      // 先读一页把界面拉回服务端真相(此时本轮大概率还没落库,读到的只是历史);
      // 再发一次性请求拿最终回答,最后重读一页作为"最终落库结果"。
      const tagged = (err as { reason?: unknown } | null)?.reason
      const reason: AgentChatStreamFallbackInfo['reason'] =
        tagged === 'upstream_error' || tagged === 'aborted'
          ? 'server-error'
          : tagged === 'incomplete'
            ? 'incomplete'
            : 'transport'
      const info: AgentChatStreamFallbackInfo = {
        reason,
        message: err instanceof Error ? err.message : String(err),
      }
      guard(callbacks.onFallback, info)

      try {
        await fetchAgentChatMessages(params.agentId, { signal: controller.signal })
      } catch {
        /* 预读失败不阻断回落:真正的终态由一次性 POST 决定 */
      }
      if (aborted) throw abortErrorOf()

      const res = await fetchApi<AgentChatMessage>(agentPath(params.agentId), {
        method: 'POST',
        body: JSON.stringify({ content: params.content }),
        signal: controller.signal,
      })
      if (aborted) throw abortErrorOf()
      if (!res.success || !res.data) {
        throw new Error(res.success ? '一次性请求未返回消息' : res.error)
      }

      const messages = await readFinalPage()
      return finish('fallback', res.data.content, res.data.id, null, messages)
    } finally {
      if (options.signal) options.signal.removeEventListener('abort', abort)
    }
  })()

  return { abort, completion }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
