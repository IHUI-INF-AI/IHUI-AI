// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序端 SSE 流式传输层(计划「#12 小程序 AI 增强」核心交付之一)。
 *
 * 设计目标:把 chat.tsx 既有的「Taro.request enableChunked 逐 chunk 渲染 +
 * H5 端 fetch ReadableStream 降级 + 断点续传 + 指数退避重连 + 读超时 + AbortSignal 取消」
 * 收敛到单一可测试模块,复用 @ihui/shared 的 parseSSEChunk 作为帧解析单一真源。
 *
 * - SSEStreamParser:纯函数式帧缓冲,处理跨 chunk 半包/粘包重组、Last-Event-ID 游标跟踪,
 *   无 Taro 依赖,可被 vitest 直接单测。
 * - streamSSE:真实传输,小程序端走 Taro.request enableChunked,Web/H5 走原生 fetch +
 *   ReadableStream;用 RequestTask.abort()(小程序)与 AbortSignal(H5)实现取消;
 *   业务错误(401/403/429 无 retryAfter)不重试,其余指数退避重连。
 */
import Taro from '@tarojs/taro'
import { getToken } from '../utils/auth'
import {
  STREAM_READ_TIMEOUT_MS,
  STREAM_MAX_RETRIES,
  STREAM_INITIAL_RETRY_DELAY,
  STREAM_MAX_RETRY_DELAY,
} from '@ihui/shared/constants'
import { parseSSEChunk, type SSEEvent } from '@ihui/shared/utils/sse-parse'

/** SSE 错误对象携带的元信息(字段名与 @ihui/api-client client.ts attachErrorMeta 一致) */
type SSEError = Error & { code?: number; errorCode?: string; retryAfter?: number }

/** 判断错误是否为用户主动中断(AbortController / Taro abort) */
function isAbortError(err: unknown): boolean {
  const name = (err as Error | undefined)?.name
  return name === 'AbortError' || name === 'CanceledError'
}

/** 从 SSE 错误对象提取重试元信息(code / errorCode / retryAfter) */
function extractSSEErrorInfo(
  err: unknown,
): { code?: number; errorCode?: string; retryAfter?: number } | undefined {
  const e = err as SSEError | undefined
  if (!e || typeof e !== 'object') return undefined
  if (e.code === undefined && e.errorCode === undefined && e.retryAfter === undefined)
    return undefined
  return { code: e.code, errorCode: e.errorCode, retryAfter: e.retryAfter }
}

/** 可被 AbortSignal 中断的 sleep(参照 client.ts sleepWithAbort) */
function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      const e = new Error('aborted')
      e.name = 'AbortError'
      reject(e)
      return
    }
    function onAbort() {
      clearTimeout(timer)
      const e = new Error('aborted')
      e.name = 'AbortError'
      reject(e)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * D136(2026-10-01 立):把"本轮被消费掉的整行"逐行递给旁路观察点(`onRawLine`)。
 *
 * 为什么需要这一层:@ihui/shared/utils/sse-parse 的认领面是一张**静默白名单** ——
 * 不在清单上的帧(现读 `grep -c "'tool-approval'" packages/shared/src/utils/sse-parse.ts` = 0)
 * 会被 `parseSSEChunk` 直接丢掉,onEvent 根本收不到。本端要接审批帧,又不能替跨端裁决去改
 * 共享认领面(那是 packages/shared 的口径,另有对账门),所以在这份唯一真源的**外侧**递原文:
 * 观察者只读不改帧流,18 类既有事件的分发路径一字未动。
 *
 * 次序纪律:必须在 `buffer = remainder` **之前**算出"已消费"的那一段(= 整行,可安全逐行切);
 * 半包留在 remainder 里下一轮再递 ⇒ 同一帧永不递两次,也不会把半截 JSON 当帧。
 */
function feedRawLines(consumed: string, sink?: (line: string) => void): void {
  if (!sink || !consumed) return
  for (const line of consumed.split('\n')) {
    const trimmed = line.replace(/\r$/, '')
    if (trimmed) sink(trimmed)
  }
}

/** 纯函数式 SSE 帧解析器。
 *
 * 用法:每条传输层收到的原始 chunk 调用 push(),返回本次解析出的完整 SSE 事件数组;
 * 跨 chunk 的半包(如一行被网络切在中间)由内部 buffer 自动续接,粘包(多个事件挤在一个
 * chunk)由 parseSSEChunk 一次性解完。流结束时调用 flush() 收割残余缓冲。
 */
export class SSEStreamParser {
  private buffer = ''
  private lastEventId?: string
  /** D136:整行原文的旁路观察点(共享解析面没认领的那一族帧靠它到达端内,见 feedRawLines) */
  private readonly rawLineSink?: (line: string) => void

  constructor(rawLineSink?: (line: string) => void) {
    this.rawLineSink = rawLineSink
  }

  /** 喂入一个原始 chunk(可能不完整),返回本次解析出的完整事件。空输入直接返回 []。 */
  push(raw: string): SSEEvent[] {
    if (!raw) return []
    this.buffer += raw
    const { events, remainder, lastId } = parseSSEChunk(this.buffer)
    // D136(2026-10-01 立):先把**本轮被消费掉的整行**递给旁路观察点,再截断缓冲。
    // 半包留在 remainder 里,下一次 push 才递(不重复、不吞),所以审批帧不会因为
    // 网络把一行切成两片就丢 —— 端内认领层要求整行是完整 JSON,残片自然解不出。
    feedRawLines(
      this.buffer.slice(0, Math.max(0, this.buffer.length - remainder.length)),
      this.rawLineSink,
    )
    this.buffer = remainder
    if (lastId) this.lastEventId = lastId
    return events
  }

  /**
   * 流结束兜底:把剩余缓冲当作最后一行(补 \n)处理,返回残余事件。
   * 若缓冲为空/仅空白,返回 []。
   */
  flush(): SSEEvent[] {
    if (!this.buffer.trim()) return []
    const pending = this.buffer
    const { events } = parseSSEChunk(this.buffer + '\n')
    this.buffer = ''
    // D136:收尾残余同样要过旁路观察点(最后一帧常被流关闭截在这里,漏递就等于丢审批)
    feedRawLines(pending, this.rawLineSink)
    return events
  }

  /** 断点续传游标(对应 SSE `id:` 行),重连时经 Last-Event-ID 头回传。 */
  getLastEventId(): string | undefined {
    return this.lastEventId
  }

  /** 重置解析状态(新一轮对话/重连起点)。 */
  reset(): void {
    this.buffer = ''
    this.lastEventId = undefined
  }
}

/** streamSSE 选项 */
export interface StreamSSEOptions {
  /** 完整请求地址(含 /ai/chat/stream) */
  url: string
  /** 请求体(自动 JSON 序列化) */
  body: unknown
  /** 额外请求头(鉴权头在此之上合并,不覆盖 Authorization) */
  headers?: Record<string, string>
  /** 取消信号(小程序端内部转为 RequestTask.abort) */
  signal?: AbortSignal
  /** 每个解析出的 SSE 事件回调;回调抛出 Error 视为致命错误(终止当前 attempt,不再重试)。 */
  onEvent: (evt: SSEEvent) => void
  /**
   * D136(2026-10-01 立):整行原文的旁路观察点 —— 共享解析面(@ihui/shared/utils/sse-parse)
   * **没认领**的那一族帧(本端今天是 `tool-approval`)不会进 `onEvent`,没有这一层就永远
   * 到不了端内(见文件内 feedRawLines 的注释:为什么认领住在端内而不是改共享解析面)。
   * 只递已完整的行;观察者不改帧流,所以对本端既有 18 类事件分发零影响。
   */
  onRawLine?: (line: string) => void
  /** 重连前通知(指数退避,attempt 从 1 起) */
  onReconnect?: (attempt: number, delayMs: number) => void
  /** 初始断点续传游标(上一次 Last-Event-ID),缺省不携带 */
  lastEventId?: string
  /** 读超时(ms),每个 chunk 间空闲超过该值视为断线;缺省用 @ihui/shared 常量 */
  readTimeoutMs?: number
}

/**
 * 小程序端 SSE 流式传输(真实逐 chunk 渲染)。
 *
 * - 微信小程序:Taro.request({ enableChunked: true }) + task.onChunkReceived 逐帧回调,
 *   取消经 task.abort() 实现(对齐 AbortSignal)。
 * - Web/H5:Taro.getEnv()===WEB 时走原生 fetch + ReadableStream,取消经 fetch 的 signal。
 * - 断点续传:捕获 SSE `id:` 游标,重连时经 Last-Event-ID 头回传。
 * - 重试:指数退避 1s→2s→4s(受 STREAM_MAX_RETRY_DELAY 上限),上限 STREAM_MAX_RETRIES;
 *   业务错误(401/403/429 无 retryAfter)不重试直接抛出。
 */
export async function streamSSE(options: StreamSSEOptions): Promise<void> {
  const {
    url,
    body,
    headers: extraHeaders,
    signal,
    onEvent,
    onRawLine,
    onReconnect,
    lastEventId: initialLastEventId,
    readTimeoutMs = STREAM_READ_TIMEOUT_MS,
  } = options

  const lastEventId = initialLastEventId
  let errored = false

  const buildHeaders = (): Record<string, string> => {
    const token = getToken()
    const header: Record<string, string> = {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
      ...(extraHeaders || {}),
    }
    if (lastEventId) header['Last-Event-ID'] = lastEventId
    return header
  }

  // 微信小程序端:Taro.request + enableChunked 逐 chunk 接收
  const runWeappAttempt = (): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      const decoder = new TextDecoder('utf-8')
      const parser = new SSEStreamParser(onRawLine)
      if (lastEventId) parser.reset() // lastEventId 已在 header 携带,避免重复
      let settled = false
      let idleTimer: ReturnType<typeof setTimeout> | undefined

      const cleanup = () => {
        if (idleTimer) clearTimeout(idleTimer)
        signal?.removeEventListener('abort', onAbort)
      }
      const fail = (e: unknown) => {
        if (settled) return
        settled = true
        cleanup()
        reject(e)
      }
      const succeed = () => {
        if (settled) return
        settled = true
        cleanup()
        resolve()
      }

      const dispatchAll = (events: SSEEvent[]): boolean => {
        for (const evt of events) {
          try {
            onEvent(evt)
          } catch (e) {
            errored = true
            fail(e)
            return false
          }
          if (errored) return false
        }
        return true
      }

      const task = Taro.request({
        url,
        method: 'POST',
        data: body,
        enableChunked: true,
        responseType: 'text',
        header: buildHeaders(),
        success: (res) => {
          if (errored) {
            succeed()
            return
          }
          const tail = parser.flush()
          if (tail.length && !dispatchAll(tail)) return
          if (res.statusCode >= 400) {
            const err = new Error(`HTTP ${res.statusCode}`) as SSEError
            err.name = 'SSEError'
            err.code = res.statusCode
            fail(err)
          } else {
            succeed()
          }
        },
        fail: (err) => {
          // W5:用户主动取消统一归一为 AbortError,避免重试循环误判为网络错误而自动重连
          if (signal?.aborted) {
            const e = new Error('aborted')
            e.name = 'AbortError'
            fail(e)
          } else {
            fail(new Error((err as { errMsg?: string })?.errMsg || '请求失败'))
          }
        },
      })

      function onAbort() {
        task.abort()
        const e = new Error('aborted')
        e.name = 'AbortError'
        fail(e)
      }
      if (signal) signal.addEventListener('abort', onAbort, { once: true })

      // 读超时:小程序无 reader.read(),以 chunk 间空闲时长等价保护
      const armIdleTimeout = () => {
        if (idleTimer) clearTimeout(idleTimer)
        idleTimer = setTimeout(() => {
          task.abort()
          const err = new Error('SSE read timeout') as SSEError
          err.name = 'SSEError'
          fail(err)
        }, readTimeoutMs)
      }
      armIdleTimeout()

      task.onChunkReceived(({ data }) => {
        if (errored || settled) return
        armIdleTimeout()
        const events = parser.push(decoder.decode(data, { stream: true }))
        if (events.length) dispatchAll(events)
      })
    })

  // Web/H5 端:Taro.request 不支持 enableChunked,改用原生 fetch + ReadableStream
  const runH5Attempt = async (): Promise<void> => {
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    const headers = buildHeaders()
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    })
    if (!res.ok || !res.body) {
      const err = new Error(`HTTP ${res.status}`) as SSEError
      err.name = 'SSEError'
      err.code = res.status
      throw err
    }
    const reader = res.body.getReader()
    const readWithTimeout = async (): Promise<{ done: boolean; value?: Uint8Array }> => {
      let timer: ReturnType<typeof setTimeout> | undefined
      const readPromise = reader.read().catch(() => ({ done: true, value: new Uint8Array() }))
      const timeoutPromise = new Promise<{ done: boolean; value?: Uint8Array }>((_, reject) => {
        timer = setTimeout(() => {
          reader.cancel().catch(() => {})
          reject(new Error('SSE read timeout'))
        }, readTimeoutMs)
      })
      try {
        return await Promise.race([readPromise, timeoutPromise])
      } finally {
        if (timer) clearTimeout(timer)
      }
    }
    while (true) {
      const { done, value } = await readWithTimeout()
      if (done) {
        buffer += decoder.decode()
        const { events } = parseSSEChunk(buffer)
        // D136:与 SSEStreamParser.flush() 同一纪律 —— 收尾残余整段递给旁路观察点
        feedRawLines(buffer, onRawLine)
        buffer = ''
        for (const evt of events) {
          try {
            onEvent(evt)
          } catch (e) {
            errored = true
            throw e
          }
        }
        return
      }
      buffer += decoder.decode(value, { stream: true })
      const { events, remainder } = parseSSEChunk(buffer)
      // D136:只递本轮被消费掉的整行(半包留在 remainder,下一轮再递)
      feedRawLines(
        buffer.slice(0, Math.max(0, buffer.length - remainder.length)),
        onRawLine,
      )
      buffer = remainder
      for (const evt of events) {
        try {
          onEvent(evt)
        } catch (e) {
          errored = true
          throw e
        }
      }
    }
  }

  // 重试主循环:指数退避,上限 STREAM_MAX_RETRIES
  let attempt = 0
  for (;;) {
    errored = false
    try {
      if (Taro.getEnv() === Taro.ENV_TYPE.WEB) {
        await runH5Attempt()
      } else {
        await runWeappAttempt()
      }
      return
    } catch (err) {
      if (isAbortError(err)) throw err
      const info = extractSSEErrorInfo(err)
      const code = info?.code
      const isBusinessError =
        code === 401 || code === 403 || (code === 429 && info?.retryAfter === undefined)
      if (isBusinessError || attempt >= STREAM_MAX_RETRIES) throw err
      const delay =
        info?.retryAfter !== undefined
          ? Math.min(info.retryAfter * 1000, STREAM_MAX_RETRY_DELAY)
          : Math.min(STREAM_INITIAL_RETRY_DELAY * 2 ** attempt, STREAM_MAX_RETRY_DELAY)
      attempt++
      onReconnect?.(attempt, delay)
      await sleepWithAbort(delay, signal)
    }
  }
}
