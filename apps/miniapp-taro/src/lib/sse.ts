// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序端 SSE 接入薄壳(计划「#12 小程序 AI 增强」的 D138 收口形态)。
 *
 * D138(承 V4 #96):重连/指数退避/读超时/断点续传游标不再在本端自写第二份,
 * 全部下沉 @ihui/api-client 的 runResumableSSEStream(唯一实现);传输介质经
 * utils/taro-stream-transport.ts 注入(weapp = Taro.request enableChunked /
 * H5 = native fetch 降级)。本文件只保留两样:
 * - SSEStreamParser:纯函数式帧缓冲(跨 chunk 半包/粘包重组、SSE id 游标跟踪),
 *   无 Taro 依赖,可被 vitest 直接单测,也是 D136 tool-approval 整行旁路的观察点。
 * - streamSSE:对 runner 的薄封装,把完整行喂回解析器,保持既有 onEvent/onRawLine/
 *   onReconnect 消费面不变(chatStream 的 D136 审批接线零改动)。
 */
import { getToken } from '../utils/auth'
import { STREAM_READ_TIMEOUT_MS } from '@ihui/shared/constants'
import { runResumableSSEStream } from '@ihui/api-client'
import { parseSSEChunk, type SSEEvent } from '@ihui/shared/utils/sse-parse'

/**
 * 纯函数式 SSE 帧解析器。
 *
 * 用法:每条传输层收到的完整行调 push()(行尾补 \n),返回本次解析出的完整事件;
 * 跨行的半包/粘包由 parseSSEChunk 一次性解完。流结束时调用 flush() 收割残余缓冲。
 * SSE `id:` 游标在此跟踪(getLastEventId 读取出口供测试/诊断);**重连时的游标
 * 回传归 api-client runner 独有**,本解析器不参与续传头的写入。
 */
export class SSEStreamParser {
  private buffer = ''
  private lastEventId?: string
  /** D136:整行旁路(可选)。共享解析面不认领的帧族(如 tool-approval)从这里拿原始行自认领。 */
  private onLine?: (line: string) => void

  constructor(onLine?: (line: string) => void) {
    this.onLine = onLine
  }

  /** 把本次已成完整事件的原始文本按行递给旁路(空行不递;半包残余留在下一轮)。 */
  private emitCompleteLines(raw: string, remainder: string): void {
    if (!this.onLine) return
    const complete =
      remainder && raw.endsWith(remainder) ? raw.slice(0, raw.length - remainder.length) : raw
    for (const line of complete.split('\n')) {
      const trimmed = line.endsWith('\r') ? line.slice(0, -1) : line
      if (trimmed) this.onLine(trimmed)
    }
  }

  /** 喂入一条完整行(行尾补 \n;也可以喂任意原始 chunk 文本),返回解析出的完整事件。空输入直接返回 []。 */
  push(raw: string): SSEEvent[] {
    if (!raw) return []
    this.buffer += raw
    const { events, remainder, lastId } = parseSSEChunk(this.buffer)
    this.emitCompleteLines(this.buffer, remainder)
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
    const raw = this.buffer + '\n'
    const { events } = parseSSEChunk(raw)
    this.emitCompleteLines(raw, '')
    this.buffer = ''
    return events
  }

  /** 断点续传游标(对应 SSE `id:` 行)的读取出口(测试/诊断用)。 */
  getLastEventId(): string | undefined {
    return this.lastEventId
  }

  /** 重置解析状态(新一轮对话/重连起点)。 */
  reset(): void {
    this.buffer = ''
    this.lastEventId = undefined
  }
}

/** streamSSE 选项(D138:续传游标初值选项随自写层一并删除 —— 游标归 runner 独有) */
export interface StreamSSEOptions {
  /** 完整请求地址(含 /ai/chat/stream) */
  url: string
  /** 请求体(自动 JSON 序列化) */
  body: unknown
  /** 额外请求头(鉴权头在此之上合并,不覆盖 Authorization) */
  headers?: Record<string, string>
  /** 取消信号(传输介质侧转为 task.abort / fetch signal) */
  signal?: AbortSignal
  /** 每个解析出的 SSE 事件回调;回调抛出 Error 视为本次尝试失败,交由 runner 按统一口径判定是否重连。 */
  onEvent: (evt: SSEEvent) => void
  /**
   * D136(2026-10-01 立):每个已成完整事件的原始行旁路(空行不递)。
   * 共享解析面(@ihui/shared parseSSEChunk)不认领的帧族 —— 如 `tool-approval` ——
   * 由消费方在这里拿原始行自行认领(见 src/lib/tool-approval-frame.ts)。
   * 旁路回调**不得抛错**中断流:认领层内部已全 catch,这里保持直通。
   */
  onRawLine?: (line: string) => void
  /** 重连前通知(指数退避,attempt 从 1 起) */
  onReconnect?: (attempt: number, delayMs: number) => void
  /** 读超时(ms),每个 chunk 间空闲超过该值视为断线;缺省用 @ihui/shared 常量 */
  readTimeoutMs?: number
}

/**
 * 小程序端 SSE 流式传输(D138 起为 runner 薄壳)。
 *
 * 重连/退避/读超时/断点续传与 api-client streamChat **同源**
 * (runResumableSSEStream 缺省:上限 3 次重连、1s→2s→4s 指数退避上限 30s、
 * 业务错误 401/403/429 无 retryAfter 不重试 —— 与旧自写层常量同值)。
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
    readTimeoutMs = STREAM_READ_TIMEOUT_MS,
  } = options

  const token = getToken()
  const headers: Record<string, string> = {
    Authorization: token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
    ...(extraHeaders || {}),
  }

  // 每次尝试用全新解析器(与旧自写层"每 attempt 新建 parser"同语义)
  let parser = new SSEStreamParser(onRawLine)

  await runResumableSSEStream({
    url,
    method: 'POST',
    body: JSON.stringify(body),
    headers,
    signal,
    readTimeoutMs,
    onAttemptStart: () => {
      parser = new SSEStreamParser(onRawLine)
    },
    onLine: (line) => {
      for (const evt of parser.push(line + '\n')) onEvent(evt)
    },
    onReconnect,
  })
}
