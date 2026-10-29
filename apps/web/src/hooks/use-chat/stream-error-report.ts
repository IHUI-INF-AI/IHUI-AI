// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-248 / G-916415 R1 web 腿(2026-10-17 立):流失败错误上报体 —— 帧级 traceId 的
 * web 端消费点。端上消费方拍板 = 错误上报(票面原文,与 miniapp R2 的"客户端日志"档不同)。
 *
 * 链路:streamChat onError(errMsg, info) → buildStreamErrorReport(挑字段构造上报体)
 * → reportStreamError(fire-and-forget POST /api/crash-reports,与 ErrorBoundary 崩溃
 * 上报同一条发射面;服务端 crashBodySchema 默认剥离未知键 ⇒ 白名单扩展键随请求体发出、
 * 不会 400,落库接入由 apps/api 扩 schema 承担,不在本票范围)。
 *
 * 三条纪律(逐条对齐 packages/api-client/src/client.ts 的 SSEErrorInfo 契约):
 * - **字段白名单**:上报体只带 SSEErrorInfo 允许的结构化键(code/errorCode/retryAfter/
 *   recoverable)+ frameTraceId,绝不整包展开原始 Error(防 stack/用户路径出浏览器);
 * - **缺席 = 无键**:info.traceId 不存在 ⇒ 上报体没有 frameTraceId 键,绝不写
 *   `frameTraceId: undefined` 顶掉"无键"这一态(与 api-client client.ts:2436 同纪律);
 * - **命名区分**:帧级 traceId 在本文件的投影键名 = `frameTraceId`(跟随 shared
 *   sse-parse `frameTraceIdOfLine` / D174"帧级 traceId"的既有命名),与端内动作链
 *   traceId(user-action-telemetry 的 ActionSpan.traceId,端上自造)是两个体系,
 *   不得同名混写。
 *
 * 发射语义:onError 只在 api-client 内部自动重连用尽后触发 ⇒ 进这里的都是终局失败,
 * 不是可自愈抖动;上报严格旁路(失败静默,不回压不重试,不影响用户可见错误路径)。
 */

import { redactCrashText } from '@ihui/shared/utils/redact'
import type { SSEErrorInfo } from '@ihui/api-client'
import type { FrameWatermarkFacts } from '@ihui/api-client'
import { fetchApi } from '@/lib/api'

/** 服务端 crashBodySchema.errorMessage 上限(zod .max(4000)),超限会被 400 静默拒收。 */
const MAX_ERROR_MESSAGE = 4000

/**
 * web 端流失败错误上报体。可选键一律"缺席 = 无键"(spread 省略),不写 undefined。
 * frameTraceId = 失败前本轮 attempt 流内帧带过的合法 traceId(SSEErrorInfo.traceId
 * 透传改名);命名与动作链 traceId 区分,理由见文件头。
 */
export interface StreamErrorReport {
  platform: 'web'
  errorMessage: string
  route: string
  code?: number
  errorCode?: string
  retryAfter?: number
  recoverable?: boolean
  frameTraceId?: string
}

/**
 * 从 errMsg + SSEErrorInfo 构造上报体(纯函数,便于单测钉"有值进/无键缺席")。
 * message/route 过共享层唯一脱敏出口 redactCrashText(crash-reports 是匿名可写端点,
 * 客户端脱敏不是唯一防线,但发射前仍必须过);route 允许显式注入(测试/SSR),缺省取
 * window.location.pathname。
 */
export function buildStreamErrorReport(input: {
  message: string
  info?: SSEErrorInfo
  route?: string
}): StreamErrorReport {
  const { info } = input
  const route = input.route ?? (typeof window !== 'undefined' ? window.location.pathname : '')
  return {
    platform: 'web',
    errorMessage: redactCrashText(input.message).slice(0, MAX_ERROR_MESSAGE) || 'unknown error',
    route,
    ...(info?.code !== undefined ? { code: info.code } : {}),
    ...(info?.errorCode !== undefined ? { errorCode: info.errorCode } : {}),
    ...(info?.retryAfter !== undefined ? { retryAfter: info.retryAfter } : {}),
    ...(info?.recoverable !== undefined ? { recoverable: info.recoverable } : {}),
    ...(info?.traceId !== undefined ? { frameTraceId: info.traceId } : {}),
  }
}

/**
 * 发射(fire-and-forget):经端内 sanctioned 包装 `@/lib/api` 的 fetchApi 发出
 * (端内禁止裸 fetch 直连后端 —— AGENTS §3,守门 73;ErrorBoundary 的历史裸 fetch
 * 是基线存量,新增点必须走 fetchApi,不得把它一起拖进基线)。SSR 不发;任何失败静默。
 */
export function reportStreamError(report: StreamErrorReport): void {
  if (typeof window === 'undefined') return
  try {
    void fetchApi('/api/crash-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    }).catch(() => {})
  } catch {
    /* 上报失败静默:绝不打断用户可见错误路径 */
  }
}

/**
 * b76-15(2026-10-29 立):帧水位事实 → 诊断行(纯函数,可单测)。
 *
 * 为什么要这一层而不是直接把 facts 塞进 crash-reports:crash-reports 是**失败轮**
 * 才发的面,而水位事实在**成功的流**上同样需要可见(全程零丢弃也是要读到的读数)。
 * 所以本函数产出的是可进 console 与可并入失败上报体的通用投影,两条面共用一份
 * 文案拼装(§0.6 单一真相源),不各写一套。
 *
 * 判据纪律(逐条对应 AGENTS §0.3「没判绝不能写成判过」):
 * - `payloadWatermarkSeen === false` ⇒ 输出里必须**点名** `generation=undetermined
 *   epoch=undetermined`,绝不许因为"没报错"就让这一行读起来像三维全绿;
 * - `cursor === null` ⇒ 写 `seq=undetermined`,不写 0(0 是一个合法 seq);
 * - `dropped` 是**有效读数**,0 照写(它不是"未采到")。
 */
export function formatFrameWatermarkFacts(facts: FrameWatermarkFacts): string {
  const cursor = facts.cursor === null ? 'undetermined' : String(facts.cursor)
  const dims = facts.payloadWatermarkSeen
    ? 'generation=judged epoch=judged'
    : 'generation=undetermined epoch=undetermined'
  return `kind=${facts.kind} dropped=${String(facts.dropped)} seq=${cursor} payloadWatermark=${facts.payloadWatermarkSeen ? 'seen' : 'absent'} ${dims}`
}

/**
 * 帧水位事实的端内消费点(唯一)。
 *
 * 落点选择:进 console(dev 与生产都留,与既有 `[SSE-DEBUG]` / `[markdown-stream]`
 * 同族诊断面),失败轮另由 `send-message` / `send-answer` 并入既有错误上报体
 * (`frameWatermark` 键,白名单内、默认被服务端 schema 剥离)。刻意**不上屏**:
 * 丢帧是内部协议事实,用户看到的是"回答被截断"这类既有文案,不把内部计数顶到界面。
 */
export function reportFrameWatermarkFacts(facts: FrameWatermarkFacts): void {
  // 只在有可读事实时打一行:终态兜底在每轮流末都会来一次,静默流也要留读数
  // (否则"没丢"这一读数永远没人看得见)。丢弃事件用 warn 提高可检索性。
  const line = `[frame-watermark] ${formatFrameWatermarkFacts(facts)}`
  if (facts.dropped > 0) console.warn(line)
  else console.info(line)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
