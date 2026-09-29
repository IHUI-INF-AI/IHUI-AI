// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 公开资产出站 fetch 统一出口（G-651，2026-09-29 立）。
 *
 * 出站抓取「无需登录的外部公开资产」（如 ai-feed 图片代理的外部图床）必须走本出口，
 * 不允许调用方再手写裸 fetch + 整包 arrayBuffer()。四件套语义：
 *   1. `credentials: 'omit'` —— 公开资产不带任何凭据/cookie 出站；
 *   2. `redirect: 'error'` —— 禁止跟随重定向（重定向可把白名单校验后的目标换成内网/任意地址）；
 *   3. 流式字节上限 —— reader 循环逐块累计字节数，超 maxBytes 立即 abort 中止读取，
 *      禁止整包 `arrayBuffer()` 无上限读入内存（OOM / 慢攻击面）；
 *   4. 错误归一 —— 失败不抛异构异常，只回 `{ stage, reason }` 形态（ok:false 分支），
 *      stage 指认失败环节（fetch/status/limit/size/stream），reason 为机器可判字符串。
 *
 * 对账：requestId 从上游透传（如 Fastify 的 x-request-id，见 plugins/api-logger-extended.ts）
 * 或缺省自动生成；`formatPublicAssetFailure` 把归一失败转成业务错误 message 并附
 * `(x-request-id:…)`，供用户回报后与后端日志逐条对账。
 *
 * 参照形态：`apps/api/src/utils/fetch-deadline.ts`（deadline 出口）；本出口在其语义之上
 * 加「字节上限 + 归一返回」，不与其共用实现（deadline 管超时收口，本出口管上限与归一）。
 */

import { randomUUID } from 'node:crypto'

/** 归一失败的环节标记。 */
export type PublicAssetStage =
  /** 请求阶段失败（网络错误 / 超时）。 */
  | 'fetch'
  /** 响应状态非 2xx。 */
  | 'status'
  /** content-length 预检超上限（未读 body 即中止）。 */
  | 'limit'
  /** 流式读取累计字节数超上限（读中途中止）。 */
  | 'size'
  /** 响应体读取中途出错。 */
  | 'stream'

/** 归一失败结果：只回 stage/reason（外加对账用 requestId）。 */
export interface PublicAssetFailure {
  ok: false
  stage: PublicAssetStage
  /** 机器可判字符串（如 network_error / timeout / http_503 / body_over_limit）。 */
  reason: string
  /** 对账 ID：上游透传的 x-request-id 或自动生成。 */
  requestId: string
}

/** 归一成功结果。 */
export interface PublicAssetSuccess {
  ok: true
  /** 资产字节（未超 maxBytes，可直接 Buffer.from）。 */
  bytes: Uint8Array
  /** 上游 Content-Type（策略校验留给调用方业务层）。 */
  contentType: string
  requestId: string
}

export type PublicAssetResult = PublicAssetSuccess | PublicAssetFailure

export interface PublicAssetFetchOptions {
  /** 出站 URL（合法性/白名单校验是调用方业务层的职责，本出口不做）。 */
  url: string
  /** 响应体字节上限，累计超过即中止并回 stage:'size'。 */
  maxBytes: number
  /** 超时毫秒，覆盖「发出请求 → 响应体读完」整段。缺省 20s。 */
  timeoutMs?: number
  /** 附加请求头（UA/Referer 等）。 */
  headers?: Record<string, string>
  /** 上游透传的 x-request-id；缺省自动生成 UUID。 */
  requestId?: string
  /** 测试注入点：默认取调用时刻的 globalThis.fetch。 */
  fetchImpl?: typeof fetch
}

/** 缺省超时：与 ai-feed-service 的 FETCH_TIMEOUT_MS 对齐（github 等路由抖动窗口实测值）。 */
export const DEFAULT_PUBLIC_ASSET_TIMEOUT_MS = 20_000

/**
 * 抓一次公开资产，返回归一结果（成功或 {stage, reason} 失败），不抛异常。
 */
export async function fetchPublicAsset(
  options: PublicAssetFetchOptions,
): Promise<PublicAssetResult> {
  const requestId = options.requestId?.trim() ? options.requestId.trim() : randomUUID()
  const timeoutMs = options.timeoutMs ?? DEFAULT_PUBLIC_ASSET_TIMEOUT_MS
  const runFetch = options.fetchImpl ?? globalThis.fetch

  const controller = new AbortController()
  // 超时覆盖整段（headers 到达不解除）：标志位用于把 abort 与普通网络错误分流成不同 reason。
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  // 不引用事件循环：失败路径及时返回时不把挂起句柄留在进程里（能力缺失时忽略）。
  ;(timer as { unref?: () => void }).unref?.()

  try {
    let res: Response
    try {
      res = await runFetch(options.url, {
        method: 'GET',
        headers: options.headers,
        // G-651 四件套之一：公开资产不带凭据出站（字面量按验收 grep 形态书写）。
        credentials: 'omit',
        // G-651 四件套之二：禁止跟随重定向（重定向会绕过调用方已做的目标校验）。
        redirect: 'error',
        signal: controller.signal,
      })
    } catch {
      return {
        ok: false,
        stage: 'fetch',
        reason: timedOut ? 'timeout' : 'network_error',
        requestId,
      }
    }

    if (!res.ok) {
      return { ok: false, stage: 'status', reason: `http_${res.status}`, requestId }
    }

    const contentType = res.headers.get('content-type') ?? ''

    // content-length 预检：超上限直接中止，一个字节都不读。
    const contentLength = res.headers.get('content-length')
    if (contentLength !== null && Number(contentLength) > options.maxBytes) {
      try {
        await res.body?.cancel()
      } catch {
        // 连接回收失败不改变归一结果。
      }
      return { ok: false, stage: 'limit', reason: 'content_length_over_limit', requestId }
    }

    // G-651 四件套之三：流式读取 + 累计字节上限（替代整包 arrayBuffer() 无上限读入）。
    if (!res.body) {
      return { ok: true, bytes: new Uint8Array(0), contentType, requestId }
    }
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
      let readResult: Awaited<ReturnType<typeof reader.read>>
      try {
        readResult = await reader.read()
      } catch {
        return {
          ok: false,
          stage: 'stream',
          reason: timedOut ? 'timeout' : 'read_error',
          requestId,
        }
      }
      if (readResult.done) break
      const value = readResult.value
      if (!value) continue
      total += value.byteLength
      if (total > options.maxBytes) {
        // 超上限即中止：abort 撕掉底层连接，cancel 通知上游流被弃用。
        controller.abort()
        try {
          await reader.cancel()
        } catch {
          // 连接回收失败不改变归一结果。
        }
        return { ok: false, stage: 'size', reason: 'body_over_limit', requestId }
      }
      chunks.push(value)
    }
    return { ok: true, bytes: concatChunks(chunks, total), contentType, requestId }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 归一失败 → 业务错误 message：附 `(x-request-id:…)` 供与后端日志对账。
 * 基础文案由调用方给中文（toUserFriendlyMessage 对含中文 message 原样透传），
 * stage/reason 一并带上，机器与人各取所需。
 */
export function formatPublicAssetFailure(failure: PublicAssetFailure, fallback: string): string {
  return `${fallback} (stage:${failure.stage}, reason:${failure.reason}, x-request-id:${failure.requestId})`
}

function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  if (chunks.length === 1) return chunks[0]!
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
