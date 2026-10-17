// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { ttftMonitor, type TtftStats } from '../utils/ttft-monitor.js'
import { authenticate } from '../plugins/auth.js'
import { isSystemAdmin } from './require-permission.js'
import { error } from '../utils/response.js'
import { logger } from '../utils/logger.js'

/**
 * 业务漏斗与自定义业务指标插件。
 *
 * 指标（Prometheus 文本格式，暴露于 /business-metrics）：
 * 1. 转化漏斗（counter）：注册 → 激活 → 付费
 *    - business_funnel_total{stage="register|activate|paid",channel}
 * 2. API 调用成功率与延迟（histogram，Grafana 用 histogram_quantile 算分位数）：
 *    - business_api_call_duration_ms_bucket{route,status,le}
 *    - business_api_call_total{route,status}
 * 3. 自定义业务指标：
 *    - business_orders_total{type,status}
 *    - business_payments_total{channel,status}
 *    - business_ai_calls_total{vendor,model,call_type,status}
 *    - business_ai_tokens_total{vendor,model,direction="input|output"}
 *    - business_ai_cost_minor_units_total{vendor,model,currency}   (值 = 最小货币单位「分」)
 *    - business_ai_record_failures_total{vendor,model}
 *    - business_ai_series_dropped_total                            (基数上限丢弃计数)
 * 4. 用户指标（gauge）：
 *    - business_users_total
 *    - business_users_active_24h
 * 5. HLS 视频指标：
 *    - business_hls_transcode_seconds{video_id} (histogram)
 *    - business_hls_segments_total{bitrate} (counter)
 *    - business_hls_transcode_total{result} (counter)
 * 6. 通知推送指标：
 *    - business_notice_pushed_total{topic,scope} (counter)
 *    - business_notice_delivered_total{topic} (counter)
 * 7. WebSocket pub/sub 指标：
 *    - business_ws_pubsub_reconnects_total{result} (counter)
 *    - business_ws_pubsub_messages_total{channel} (counter)
 *    - business_ws_heartbeat_drops_total (counter)
 *    - business_ws_auth_failures_total{reason} (counter)
 *    - business_ws_room_broadcasts_total{room_id} (counter)
 * 8. 缓存指标：
 *    - business_cache_hits_total{key_prefix} (counter)
 *    - business_cache_misses_total{key_prefix} (counter)
 *    - business_cache_hit_ratio{key_prefix} (gauge)
 * 9. 任务执行指标：
 *    - business_job_executions_total{job_name,status} (counter)
 *    - business_job_duration_seconds{job_name} (histogram)
 * 10. WebSocket 连接指标（gauge）：
 *     - business_ws_connections
 *     - business_ws_notice_subscriptions
 *     - business_ws_rooms                          (live-chat 活跃房间数)
 *     - business_ws_message_latency_ms (histogram) (live-chat 消息处理延迟)
 * 11. 业务异常指标：
 *     - business_errors_total{endpoint,error_type} (counter)
 * 12. TTFT (Time To First Token) 指标：
 *     - business_ttft_seconds{model,endpoint} (histogram)
 *     - business_ttft_total{model,result} (counter)
 *     - business_ttft_p50_seconds / p95_seconds / p99_seconds (gauge)
 *     - business_ttft_alerts_total (counter)
 *
 * 路由通过 server.recordFunnel / recordApiCall / recordOrder / recordPayment / recordAiCall
 * 及新增的 record* 系列装饰器上报。
 *
 * AI 那一族的真实收口不在路由里,而在 `plugins/ai-cost.ts` 的 `recordAiCost()`(所有 AI
 * 成本调用方都汇到它),因此由它单点桥接到本文件的模块级 AI 采样入口
 * `recordAiCallSample()` —— 装饰器 `recordAiCall` 与桥接走的是同一个实现、同一份状态,
 * 不另立第二套标签形状(AGENTS §0.6 单一真相源)。
 */

type FunnelStage = 'register' | 'activate' | 'paid'

interface BusinessMetrics {
  // 现有指标
  funnel: Map<string, number> // key: stage|channel
  apiCallTotal: Map<string, number> // key: route|status
  apiDurationBuckets: Map<string, number> // key: route|status|le
  apiDurationSum: Map<string, number>
  apiDurationCount: Map<string, number>
  orders: Map<string, number> // key: type|status
  payments: Map<string, number> // key: channel|status
  aiCalls: Map<string, number> // key: vendor|model|call_type|status
  aiTokens: Map<string, number> // key: vendor|model|direction
  aiCostMinorUnits: Map<string, number> // key: vendor|model|currency(值 = 最小货币单位「分」)
  aiRecordFailures: Map<string, number> // key: vendor|model
  // 新增：用户指标（Gauge，单值）
  usersTotal: number
  usersActive24h: number
  // 新增：HLS 视频指标
  hlsTranscodeBuckets: Map<string, number> // key: video_id|le
  hlsTranscodeSum: Map<string, number> // key: video_id
  hlsTranscodeCount: Map<string, number> // key: video_id
  hlsSegmentsTotal: Map<string, number> // key: bitrate
  hlsTranscodeTotal: Map<string, number> // key: result
  // 新增：通知推送指标
  noticePushedTotal: Map<string, number> // key: topic|scope
  noticeDeliveredTotal: Map<string, number> // key: topic
  // 新增：WebSocket pub/sub 指标
  wsPubsubReconnectsTotal: Map<string, number> // key: result
  wsPubsubMessagesTotal: Map<string, number> // key: channel
  wsHeartbeatDropsTotal: number
  wsAuthFailuresTotal: Map<string, number> // key: reason
  wsRoomBroadcastsTotal: Map<string, number> // key: room_id
  // 新增：缓存指标
  cacheHitsTotal: Map<string, number> // key: key_prefix
  cacheMissesTotal: Map<string, number> // key: key_prefix
  cacheHitRatio: Map<string, number> // key: key_prefix
  // 新增：任务执行指标
  jobExecutionsTotal: Map<string, number> // key: job_name|status
  jobDurationBuckets: Map<string, number> // key: job_name|le
  jobDurationSum: Map<string, number> // key: job_name
  jobDurationCount: Map<string, number> // key: job_name
  // 新增：WebSocket 连接指标（Gauge，单值）
  wsConnections: number
  wsNoticeSubscriptions: number
  // 新增：WebSocket 事件计数器（Counter，单值）
  wsConnectTotal: number
  wsMessageReceivedTotal: number
  wsMessageSentTotal: number
  wsDisconnectTotal: number
  // 新增：live-chat 房间数（Gauge）与消息处理延迟（Histogram，单一系列）
  wsRooms: number
  wsMessageLatencyBuckets: Map<string, number> // key: le
  wsMessageLatencySum: number
  wsMessageLatencyCount: number
  // 新增：业务异常指标
  errorsTotal: Map<string, number> // key: endpoint|error_type
  // 新增：TTFT 指标
  ttftBuckets: Map<string, number> // key: model|endpoint|le
  ttftSum: Map<string, number> // key: model|endpoint
  ttftCount: Map<string, number> // key: model|endpoint
  ttftTotal: Map<string, number> // key: model|result
  ttftAlertsTotal: number
  // 新增：连续包月扣款明细(8.3.1)
  // key: result(charged|failed|skipped|trial_extended)
  recurringChargeTotal: Map<string, number>
  /** 本次扫扣发现的到期签约数(用于观察随时间增长趋势) */
  recurringChargeDueGauge: number
  // 新增：旧事件名 deprecation 计数(8.3.2)
  // key: deprecated event_type
  recurringWebhookDeprecatedTotal: Map<string, number>
}

const LATENCY_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000] as const
// HLS 转码耗时桶（秒）：0.5s ~ 10min
const HLS_TRANSCODE_SECONDS_BUCKETS = [0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600] as const
// 任务执行耗时桶（秒）：0.1s ~ 10min
const JOB_DURATION_SECONDS_BUCKETS = [0.1, 0.5, 1, 5, 10, 30, 60, 120, 300, 600] as const
// TTFT 耗时桶（秒）：50ms ~ 30s
const TTFT_SECONDS_BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5, 10, 30] as const

function counterInc(map: Map<string, number>, key: string, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by)
}

function observeHistogram(metrics: BusinessMetrics, baseKey: string, valueMs: number): void {
  counterInc(metrics.apiDurationCount, baseKey)
  metrics.apiDurationSum.set(baseKey, (metrics.apiDurationSum.get(baseKey) ?? 0) + valueMs)
  for (const le of LATENCY_BUCKETS) {
    if (valueMs <= le) {
      counterInc(metrics.apiDurationBuckets, `${baseKey}|le=${le}`)
    }
  }
  counterInc(metrics.apiDurationBuckets, `${baseKey}|le=+Inf`)
}

/** 观察 live-chat 消息处理耗时（毫秒）到直方图（单一系列，无维度标签） */
function observeWsMessageLatency(metrics: BusinessMetrics, valueMs: number): void {
  metrics.wsMessageLatencyCount++
  metrics.wsMessageLatencySum += valueMs
  for (const le of LATENCY_BUCKETS) {
    if (valueMs <= le) {
      counterInc(metrics.wsMessageLatencyBuckets, String(le))
    }
  }
  counterInc(metrics.wsMessageLatencyBuckets, '+Inf')
}

/** 观察 HLS 转码耗时（秒）到直方图 */
function observeHlsTranscode(metrics: BusinessMetrics, videoId: string, seconds: number): void {
  counterInc(metrics.hlsTranscodeCount, videoId)
  metrics.hlsTranscodeSum.set(videoId, (metrics.hlsTranscodeSum.get(videoId) ?? 0) + seconds)
  for (const le of HLS_TRANSCODE_SECONDS_BUCKETS) {
    if (seconds <= le) {
      counterInc(metrics.hlsTranscodeBuckets, `${videoId}|le=${le}`)
    }
  }
  counterInc(metrics.hlsTranscodeBuckets, `${videoId}|le=+Inf`)
}

/**
 * 模块级桥接:HLS 转码耗时采样(2026-10-17 接线,此前为定义齐全零调用的空壳)。
 * transcode-service 的 ffmpeg close 回调不持 fastify 实例,与 recordAiCallSample 同范式;
 * 与 aiState 不同,hls 直方图 state 在插件闭包 m 里,故这里用**回调槽注入**:插件注册
 * 装饰器时把自己的实现赋给槽,桥接与装饰器走同一实现、同一份状态。
 * videoId 经 sanitizeIhuiLabel 白名单洗 + 基数上限;永不抛(观测层异常不得带崩转码)。
 */
let hlsTranscodeRecorder: ((videoId: string, seconds: number) => void) | null = null
export function recordHlsTranscodeSample(videoId: string, seconds: number): void {
  safeRecord('recordHlsTranscodeSample', () => {
    if (hlsTranscodeRecorder) {
      hlsTranscodeRecorder(sanitizeIhuiLabel(videoId) || 'unknown', seconds)
    }
    // 插件未注册时样本丢弃:转码完成只出现在服务运行期,彼时插件必已注册
  })
}

/** 观察任务执行耗时（秒）到直方图 */
function observeJobDuration(metrics: BusinessMetrics, jobName: string, seconds: number): void {
  counterInc(metrics.jobDurationCount, jobName)
  metrics.jobDurationSum.set(jobName, (metrics.jobDurationSum.get(jobName) ?? 0) + seconds)
  for (const le of JOB_DURATION_SECONDS_BUCKETS) {
    if (seconds <= le) {
      counterInc(metrics.jobDurationBuckets, `${jobName}|le=${le}`)
    }
  }
  counterInc(metrics.jobDurationBuckets, `${jobName}|le=+Inf`)
}

/** 观察 TTFT 首 token 延迟（秒）到直方图 */
function observeTtft(metrics: BusinessMetrics, baseKey: string, seconds: number): void {
  counterInc(metrics.ttftCount, baseKey)
  metrics.ttftSum.set(baseKey, (metrics.ttftSum.get(baseKey) ?? 0) + seconds)
  for (const le of TTFT_SECONDS_BUCKETS) {
    if (seconds <= le) {
      counterInc(metrics.ttftBuckets, `${baseKey}|le=${le}`)
    }
  }
  counterInc(metrics.ttftBuckets, `${baseKey}|le=+Inf`)
}

/**
 * 记录缓存命中/未命中，并自动更新命中率 Gauge。
 * @param metrics 指标集合
 * @param keyPrefix 缓存键前缀（如 "user:" "session:"）
 * @param hit 是否命中
 */
function recordCache(metrics: BusinessMetrics, keyPrefix: string, hit: boolean): void {
  if (hit) {
    counterInc(metrics.cacheHitsTotal, keyPrefix)
  } else {
    counterInc(metrics.cacheMissesTotal, keyPrefix)
  }
  const hits = metrics.cacheHitsTotal.get(keyPrefix) ?? 0
  const misses = metrics.cacheMissesTotal.get(keyPrefix) ?? 0
  const total = hits + misses
  metrics.cacheHitRatio.set(keyPrefix, total > 0 ? hits / total : 0)
}

/** BizTimer 结束回调类型 */
type BizTimerEndCallback = (
  jobName: string,
  seconds: number,
  opts: { userId?: string; tenantId?: string },
) => void

/**
 * 业务端点计时上下文，支持 user_id/tenant_id 维度。
 *
 * 用法：
 *   const timer = server.startBizTimer('video_transcode', { userId: '123', tenantId: 't1' });
 *   // ... 执行业务逻辑 ...
 *   const elapsed = timer.end(); // 自动上报 business_job_duration_seconds
 */
export class BizTimer {
  private readonly jobName: string
  private readonly userId?: string
  private readonly tenantId?: string
  private readonly startTime: bigint
  private readonly onEnd: BizTimerEndCallback
  private ended = false

  constructor(
    jobName: string,
    onEnd: BizTimerEndCallback,
    opts?: { userId?: string; tenantId?: string },
  ) {
    this.jobName = jobName
    this.onEnd = onEnd
    this.userId = opts?.userId
    this.tenantId = opts?.tenantId
    this.startTime = process.hrtime.bigint()
  }

  /** 结束计时并上报耗时（秒）。返回耗时秒数，重复调用返回 0。 */
  end(): number {
    if (this.ended) return 0
    this.ended = true
    const seconds = Number(process.hrtime.bigint() - this.startTime) / 1e9
    this.onEnd(this.jobName, seconds, { userId: this.userId, tenantId: this.tenantId })
    return seconds
  }
}

/**
 * ============================================================================
 * AI 采样状态 —— 模块级单例(全仓唯一的一份 `business_ai_*` 状态与写入入口)
 * ============================================================================
 *
 * 为什么不在插件闭包里:AI 成本/调用的真实收口是 `plugins/ai-cost.ts` 的
 * `recordAiCost()`,它是**不依赖 fastify 实例**的模块级函数(crew-llm-adapter /
 * ai-user-model-chat / conversation-title / semantic-summary 都直接 import 它调用)。
 * 装饰器 `server.recordAiCall` 只能被持有 server 的代码触达 ⇒ 若状态留在插件闭包,
 * 桥接就得把 server 传到这些调用链上(改动面炸开、且必漏)。故状态上移到模块级,
 * 装饰器与桥接都写同一份;`/business-metrics` 渲染读的还是 `m.aiCalls` 等同一批 Map 引用。
 *
 * 纪律(AGENTS §0.7 / 指标层铁律):写入函数内部 try/catch 兜底,**永不抛**——
 * 观测面坏了不能把业务链路带崩(与 ai-cost L2 Redis 降级同一风格)。
 */

/** token 方向:与 ai_cost_records 的 prompt/completion 两列一一对应。 */
export type AiTokenDirection = 'input' | 'output'
/** 调用结果:大屏错误率 = sum(status!="success") / sum(全部)。 */
export type AiCallStatus = 'success' | 'error' | 'cancelled'
/**
 * 调用类型。取值封闭为这 7 个(派生口径见 ai-cost.ts 的 REQUEST_TYPE_TO_CALL_TYPE):
 * - stream              AI 服务流式回调落账(ai-callback-worker 的 requestType='chat')
 * - chat                未带类型标记的对话(默认档)
 * - crew                CrewAI 编排(含 crew / crew_session)
 * - user-model-chat     用户自带模型配置对话
 * - conversation-title  会话标题生成
 * - semantic-summary    语义摘要
 * - other               其余/显式未知
 */
export type AiCallType =
  | 'stream'
  | 'chat'
  | 'crew'
  | 'user-model-chat'
  | 'conversation-title'
  | 'semantic-summary'
  | 'other'

export interface AiCallSampleInput {
  /** 供应商标签(取 ai_cost_records.provider;缺省归 'unknown') */
  vendor: string
  /** 模型标签(取 ai_cost_records.model;调用方常为用户可控值,写入前必洗) */
  model: string
  inputTokens?: number
  outputTokens?: number
  /**
   * 成本,单位 = 该币种的**最小货币单位(分)**。
   * 不再叫 costUsd:`ai_cost_records.cost` 由 pricing-service 以「分」落库、
   * 币种默认 CNY,把它塞进 `..._usd_total` 是在标签上撒谎。
   */
  costMinorUnits?: number
  /** 成本币种(ISO 4217,缺省 'CNY',与 pricing-service DEFAULT_CURRENCY 同档) */
  currency?: string
  status?: AiCallStatus
  callType?: AiCallType
}

/** 标签基数上限:单族最多这么多条序列(model 来自用户可控配置,必须设上限)。 */
const AI_SERIES_CAP = 2048
const AI_LABEL_MAX_LEN = 64

const aiState = {
  /** key: vendor|model|call_type|status */
  calls: new Map<string, number>(),
  /** key: vendor|model|direction */
  tokens: new Map<string, number>(),
  /** key: vendor|model|currency(值 = 累计最小货币单位) */
  costMinorUnits: new Map<string, number>(),
  /** key: vendor|model —— 成本落库失败(ai_cost_records 写不进去,业务侧不可见的静默丢数) */
  recordFailures: new Map<string, number>(),
  /** 因基数上限被拒的**序列写入次数**(一条采样可能同时命中多个族,故按次计不按条计) */
  seriesDroppedTotal: 0,
}

/**
 * 洗标签值:Prometheus 文本里一个未转义的 `"` 或换行会把**整次 scrape** 打回
 * (与 metrics.ts 注过的 2026-09-28 "分位数永远查不出来" 同型失效:坏一个样本、
 * 丢的是整个抓取目标的全部指标)。model 标签是用户可控字符串,只能白名单收口。
 */
function sanitizeAiLabel(value: string | undefined | null, maxLen = AI_LABEL_MAX_LEN): string {
  if (typeof value !== 'string') return 'unknown'
  const cleaned = value.replace(/[^A-Za-z0-9_.:/@+-]/g, '_').slice(0, maxLen)
  return cleaned.length > 0 ? cleaned : 'unknown'
}

/** 基数护栏:超上限的新序列不录(改计入 seriesDroppedTotal)。 */
function aiCounterInc(map: Map<string, number>, key: string, by: number): void {
  if (map.has(key)) {
    map.set(key, (map.get(key) ?? 0) + by)
    return
  }
  if (map.size >= AI_SERIES_CAP) {
    aiState.seriesDroppedTotal++
    return
  }
  map.set(key, by)
}

function nonNegativeNumber(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

/**
 * 记录一次 AI 调用采样(计数 + token 双向 + 成本)。
 * 装饰器 `server.recordAiCall` 与 `recordAiCost()` 桥接共用这一个写入实现。
 */
export function recordAiCallSample(input: AiCallSampleInput): void {
  try {
    const vendor = sanitizeAiLabel(input.vendor)
    const model = sanitizeAiLabel(input.model)
    const status: AiCallStatus = input.status ?? 'success'
    const callType: AiCallType = input.callType ?? 'chat'
    aiCounterInc(aiState.calls, `${vendor}|${model}|${callType}|${status}`, 1)

    const inputTokens = nonNegativeNumber(input.inputTokens)
    const outputTokens = nonNegativeNumber(input.outputTokens)
    if (inputTokens > 0) aiCounterInc(aiState.tokens, `${vendor}|${model}|input`, inputTokens)
    if (outputTokens > 0) aiCounterInc(aiState.tokens, `${vendor}|${model}|output`, outputTokens)

    const cost = nonNegativeNumber(input.costMinorUnits)
    if (cost > 0) {
      const currency = sanitizeAiLabel(input.currency ?? 'CNY', 8).toUpperCase()
      aiCounterInc(aiState.costMinorUnits, `${vendor}|${model}|${currency}`, cost)
    }
  } catch (err) {
    // 观测层异常绝不允许冒泡到业务(调用点不 catch 也必须安全)
    logger.warn(`[business-metrics] recordAiCallSample 异常,已跳过该采样: ${String(err)}`)
  }
}

/** 记录一次「AI 成本落库失败」。同样是永不抛的观测写入。 */
export function recordAiCostWriteFailure(vendor: string, model: string): void {
  try {
    aiCounterInc(aiState.recordFailures, `${sanitizeAiLabel(vendor)}|${sanitizeAiLabel(model)}`, 1)
  } catch (err) {
    logger.warn(`[business-metrics] recordAiCostWriteFailure 异常,已跳过: ${String(err)}`)
  }
}

/** 清 AI 单例状态(resetAllMetrics 与测试各自要用)。 */
function resetAiState(): void {
  aiState.calls.clear()
  aiState.tokens.clear()
  aiState.costMinorUnits.clear()
  aiState.recordFailures.clear()
  aiState.seriesDroppedTotal = 0
}

/**
 * ============================================================================
 * 业务域指标单例(ihui_* Prometheus 大屏族)
 * ============================================================================
 *
 * 状态放模块级(而非插件闭包)的架构决策与 aiState 完全同型:本族指标的真实
 * 调用点横跨路由层 / DB 层 / service 层 / scheduler-worker,其中
 * db/queries.ts、db/certificate-queries.ts、db/exam-queries.ts、
 * services/order-service.ts、services/storage-service.ts、websocket/chat-server.ts
 * 均**不持有 fastify 实例**。若把状态留在插件闭包,桥接就得把 server 一路穿透
 * 传参(改动面炸开且有漏接风险);装饰器 `server.recordXxx` 与下面的模块级
 * `recordXxx` 写的是**同一份状态**,只是两个入口。
 *
 * 横切纪律(录入指标层铁律):
 * - 所有写入函数 try/catch 兜底 logger.warn,**永不抛**(safeRecord 统一兜);
 * - 用户可控标签(tenant_id/source_ip/room_id/category/channel/reason)写入前
 *   一律 sanitizeIhuiLabel 白名单洗,标签族基数上限 IHUI_SERIES_CAP=512,
 *   超限新序列丢弃并计入 seriesDroppedTotal;
 * - 单位:live gift income = 平台币;payment amount = 分(最小货币单位);
 *   oss bytes = 字节。
 */

const IHUI_SERIES_CAP = 512
const IHUI_LABEL_MAX_LEN = 64

const ihuiState = {
  // ---- auth 7 ----
  authLoginAttemptTotal: 0,
  authLoginSuccessTotal: 0,
  /** key: source_ip(用户可控,白名单洗 + 基数上限) */
  authLoginFailedTotal: new Map<string, number>(),
  authJwtIssuedTotal: 0,
  /** key: reason(refresh_rotation/logout/reuse_detected/force_logout/session_revoke/...) */
  authTokenRevokedTotal: new Map<string, number>(),
  auth2faUsedTotal: 0,
  /** key: reason(deny/challenge/review/lockout) */
  authLoginAnomalyTotal: new Map<string, number>(),
  // ---- exam 7 ----
  examStartedTotal: 0,
  examSubmittedTotal: 0,
  /** Gauge:pending(近24h started)的 exam_records 数,scheduler 定时刷新 */
  examActiveTotal: 0,
  /** key: category(试卷分类) */
  examQuestionUsedTotal: new Map<string, number>(),
  examCertificateIssuedTotal: 0,
  /** 成绩样本和(float)—— 面板 avg = sum/count */
  examScoreSum: 0,
  examScoreCount: 0,
  // ---- live 4 ----
  /** Gauge,per-room:set 语义(房间删除时 deleteKey);基数由 chat-server MAX_ROOMS 界定 */
  liveOnlineByRoom: new Map<string, number>(),
  /** key: room_id */
  liveDanmakuTotal: new Map<string, number>(),
  /** key: room_id;单位 = 平台币,float 累加 */
  liveGiftIncomeTotal: new Map<string, number>(),
  liveStreamDisconnectedTotal: 0,
  // ---- oss 6 ----
  /** 单位 = 字节 */
  ossUploadBytesTotal: 0,
  /** 单位 = 字节 */
  ossDownloadBytesTotal: 0,
  /** key: driver(local/aliyun-oss/tencent-cos/...) */
  ossRequestsTotal: new Map<string, number>(),
  /** key: driver|error_type */
  ossErrorsTotal: new Map<string, number>(),
  /** Gauge:磁盘扫描总量(字节),scheduler 定时刷新 */
  ossStorageUsedBytes: 0,
  /** Gauge:文件数,scheduler 定时刷新 */
  ossFileCount: 0,
  // ---- payment 8 ----
  /** key: channel(wechat/alipay/usdt/mock/...) */
  paymentAttemptTotal: new Map<string, number>(),
  paymentSuccessTotal: new Map<string, number>(),
  paymentRefundTotal: new Map<string, number>(),
  /** key: channel|reason */
  paymentExceptionTotal: new Map<string, number>(),
  /** key: channel;单位 = 分(最小货币单位) */
  paymentAmountTotal: new Map<string, number>(),
  wxpayCallbackTotal: 0,
  wxpayCallbackSuccessTotal: 0,
  wxpayCallbackFailedTotal: 0,
  // ---- tenant 4 ----
  /** key: tenant_id(白名单洗 + 基数上限,防恶意 header 炸基数) */
  tenantApiCallsTotal: new Map<string, number>(),
  /** key: tenant_id */
  tenantRatelimitTotal: new Map<string, number>(),
  /** Gauge,key: tenant_id|resource(api_calls|storage_mb|users) */
  tenantResourceUsed: new Map<string, number>(),
  /** Gauge,key: tenant_id|resource */
  tenantResourceQuota: new Map<string, number>(),
  // ---- 横切:基数上限丢弃计数(单族超 512 条序列后每次新序列写入 +1) ----
  seriesDroppedTotal: 0,
}

/** 标签值白名单洗(复用 sanitizeAiLabel 同型实现;引号/换行等会打爆整次 scrape)。 */
function sanitizeIhuiLabel(value: string | undefined | null, maxLen = IHUI_LABEL_MAX_LEN): string {
  if (typeof value !== 'string') return 'unknown'
  const cleaned = value.replace(/[^A-Za-z0-9_.:/@+-]/g, '_').slice(0, maxLen)
  return cleaned.length > 0 ? cleaned : 'unknown'
}

/** 基数护栏:超上限的新序列不录(计入 seriesDroppedTotal)。 */
function ihuiCounterInc(map: Map<string, number>, key: string, by = 1): void {
  if (map.has(key)) {
    map.set(key, (map.get(key) ?? 0) + by)
    return
  }
  if (map.size >= IHUI_SERIES_CAP) {
    ihuiState.seriesDroppedTotal++
    return
  }
  map.set(key, by)
}

/** 非负有限数(否则 0)。 */
function ihuiNonNegativeNumber(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

/** 写入函数统一 try/catch 兜底:观测层异常不得带崩业务链路。 */
function safeRecord(name: string, fn: () => void): void {
  try {
    fn()
  } catch (err) {
    logger.warn(`[business-metrics] ${name} 异常,已跳过: ${String(err)}`)
  }
}

// ============================== auth 7 ==============================

export function recordAuthLoginAttempt(): void {
  safeRecord('recordAuthLoginAttempt', () => {
    ihuiState.authLoginAttemptTotal++
  })
}

export function recordAuthLoginSuccess(): void {
  safeRecord('recordAuthLoginSuccess', () => {
    ihuiState.authLoginSuccessTotal++
  })
}

export function recordAuthLoginFailed(sourceIp: string): void {
  safeRecord('recordAuthLoginFailed', () => {
    ihuiCounterInc(ihuiState.authLoginFailedTotal, sanitizeIhuiLabel(sourceIp))
  })
}

export function recordAuthJwtIssued(): void {
  safeRecord('recordAuthJwtIssued', () => {
    ihuiState.authJwtIssuedTotal++
  })
}

export function recordAuthTokenRevoked(reason: string): void {
  safeRecord('recordAuthTokenRevoked', () => {
    ihuiCounterInc(ihuiState.authTokenRevokedTotal, sanitizeIhuiLabel(reason))
  })
}

export function recordAuth2faUsed(): void {
  safeRecord('recordAuth2faUsed', () => {
    ihuiState.auth2faUsedTotal++
  })
}

export function recordAuthLoginAnomaly(reason: string): void {
  safeRecord('recordAuthLoginAnomaly', () => {
    ihuiCounterInc(ihuiState.authLoginAnomalyTotal, sanitizeIhuiLabel(reason))
  })
}

// ============================== exam 7 ==============================

export function recordExamStarted(): void {
  safeRecord('recordExamStarted', () => {
    ihuiState.examStartedTotal++
  })
}

export function recordExamSubmitted(): void {
  safeRecord('recordExamSubmitted', () => {
    ihuiState.examSubmittedTotal++
  })
}

/** Gauge:set 语义(整数,负值归 0)。scheduler 定时刷新。 */
export function setExamActive(count: number): void {
  safeRecord('setExamActive', () => {
    const n = Math.max(0, Math.floor(ihuiNonNegativeNumber(count)))
    ihuiState.examActiveTotal = n
  })
}

export function recordExamQuestionUsed(category: string, by = 1): void {
  safeRecord('recordExamQuestionUsed', () => {
    ihuiCounterInc(
      ihuiState.examQuestionUsedTotal,
      sanitizeIhuiLabel(category),
      ihuiNonNegativeNumber(by),
    )
  })
}

export function recordExamCertificateIssued(): void {
  safeRecord('recordExamCertificateIssued', () => {
    ihuiState.examCertificateIssuedTotal++
  })
}

/** 成绩样本(float,sum/count 成对累加,保证 avg 口径一致)。 */
export function recordExamScore(score: number): void {
  safeRecord('recordExamScore', () => {
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) return
    ihuiState.examScoreSum += score
    ihuiState.examScoreCount++
  })
}

// ============================== live 4 ==============================

/** per-room 在线数 Gauge(set 语义)。 */
export function setLiveOnline(roomId: string, count: number): void {
  safeRecord('setLiveOnline', () => {
    ihuiState.liveOnlineByRoom.set(sanitizeIhuiLabel(roomId), Math.max(0, Math.floor(count)))
  })
}

/** 房间清空/删除时移除对应序列,防 per-room gauge 无界累积。 */
export function deleteLiveOnline(roomId: string): void {
  safeRecord('deleteLiveOnline', () => {
    ihuiState.liveOnlineByRoom.delete(sanitizeIhuiLabel(roomId))
  })
}

export function recordLiveDanmaku(roomId: string): void {
  safeRecord('recordLiveDanmaku', () => {
    ihuiCounterInc(ihuiState.liveDanmakuTotal, sanitizeIhuiLabel(roomId))
  })
}

/** 打赏收入(单位 = 平台币,float 累加)。 */
export function recordLiveGiftIncome(roomId: string, amount: number): void {
  safeRecord('recordLiveGiftIncome', () => {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return
    ihuiCounterInc(ihuiState.liveGiftIncomeTotal, sanitizeIhuiLabel(roomId), amount)
  })
}

export function recordLiveStreamDisconnected(): void {
  safeRecord('recordLiveStreamDisconnected', () => {
    ihuiState.liveStreamDisconnectedTotal++
  })
}

// ============================== oss 6 ==============================

/** 上传字节数(单位 = 字节)。 */
export function recordOssUploadBytes(bytes: number): void {
  safeRecord('recordOssUploadBytes', () => {
    if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return
    ihuiState.ossUploadBytesTotal += bytes
  })
}

/** 下载字节数(单位 = 字节)。 */
export function recordOssDownloadBytes(bytes: number): void {
  safeRecord('recordOssDownloadBytes', () => {
    if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return
    ihuiState.ossDownloadBytesTotal += bytes
  })
}

export function recordOssRequest(driver: string): void {
  safeRecord('recordOssRequest', () => {
    ihuiCounterInc(ihuiState.ossRequestsTotal, sanitizeIhuiLabel(driver))
  })
}

export function recordOssError(driver: string, errorType: string): void {
  safeRecord('recordOssError', () => {
    ihuiCounterInc(
      ihuiState.ossErrorsTotal,
      `${sanitizeIhuiLabel(driver)}|${sanitizeIhuiLabel(errorType)}`,
    )
  })
}

/** Gauge:一次扫描 set 两个(存储字节 + 文件数)。scheduler 定时刷新。 */
export function setOssStorageStats(totalBytes: number, totalFiles: number): void {
  safeRecord('setOssStorageStats', () => {
    ihuiState.ossStorageUsedBytes = Math.max(0, Math.floor(ihuiNonNegativeNumber(totalBytes)))
    ihuiState.ossFileCount = Math.max(0, Math.floor(ihuiNonNegativeNumber(totalFiles)))
  })
}

// ============================== payment 8 ==============================

export function recordPaymentAttempt(channel: string): void {
  safeRecord('recordPaymentAttempt', () => {
    ihuiCounterInc(ihuiState.paymentAttemptTotal, sanitizeIhuiLabel(channel))
  })
}

export function recordPaymentSuccess(channel: string): void {
  safeRecord('recordPaymentSuccess', () => {
    ihuiCounterInc(ihuiState.paymentSuccessTotal, sanitizeIhuiLabel(channel))
  })
}

export function recordPaymentRefund(channel: string): void {
  safeRecord('recordPaymentRefund', () => {
    ihuiCounterInc(ihuiState.paymentRefundTotal, sanitizeIhuiLabel(channel))
  })
}

export function recordPaymentException(channel: string, reason: string): void {
  safeRecord('recordPaymentException', () => {
    ihuiCounterInc(
      ihuiState.paymentExceptionTotal,
      `${sanitizeIhuiLabel(channel)}|${sanitizeIhuiLabel(reason)}`,
    )
  })
}

/** 支付金额(单位 = 分,最小货币单位,float 累加)。 */
export function recordPaymentAmount(channel: string, amountMinorUnits: number): void {
  safeRecord('recordPaymentAmount', () => {
    if (
      typeof amountMinorUnits !== 'number' ||
      !Number.isFinite(amountMinorUnits) ||
      amountMinorUnits <= 0
    )
      return
    ihuiCounterInc(ihuiState.paymentAmountTotal, sanitizeIhuiLabel(channel), amountMinorUnits)
  })
}

export function recordWxpayCallback(): void {
  safeRecord('recordWxpayCallback', () => {
    ihuiState.wxpayCallbackTotal++
  })
}

export function recordWxpayCallbackSuccess(): void {
  safeRecord('recordWxpayCallbackSuccess', () => {
    ihuiState.wxpayCallbackSuccessTotal++
  })
}

export function recordWxpayCallbackFailed(): void {
  safeRecord('recordWxpayCallbackFailed', () => {
    ihuiState.wxpayCallbackFailedTotal++
  })
}

// ============================== tenant 4 ==============================

export function recordTenantApiCall(tenantId: string): void {
  safeRecord('recordTenantApiCall', () => {
    ihuiCounterInc(ihuiState.tenantApiCallsTotal, sanitizeIhuiLabel(tenantId, 32))
  })
}

export function recordTenantRateLimit(tenantId: string): void {
  safeRecord('recordTenantRateLimit', () => {
    ihuiCounterInc(ihuiState.tenantRatelimitTotal, sanitizeIhuiLabel(tenantId, 32))
  })
}

/** Gauge:set 语义。resource ∈ api_calls|storage_mb|users。 */
export function setTenantResourceUsed(
  tenantId: string,
  resource: 'api_calls' | 'storage_mb' | 'users',
  value: number,
): void {
  safeRecord('setTenantResourceUsed', () => {
    if (!Number.isFinite(value) || value < 0) return
    ihuiState.tenantResourceUsed.set(
      `${sanitizeIhuiLabel(tenantId, 32)}|${sanitizeIhuiLabel(resource, 32)}`,
      value,
    )
  })
}

/** Gauge:set 语义。与 resource_used 同源成对刷新。 */
export function setTenantResourceQuota(
  tenantId: string,
  resource: 'api_calls' | 'storage_mb' | 'users',
  value: number,
): void {
  safeRecord('setTenantResourceQuota', () => {
    if (!Number.isFinite(value) || value < 0) return
    ihuiState.tenantResourceQuota.set(
      `${sanitizeIhuiLabel(tenantId, 32)}|${sanitizeIhuiLabel(resource, 32)}`,
      value,
    )
  })
}

// ============================== 重置 ==============================

/** 清业务域单例状态(resetAllMetrics 与测试各自要用)。 */
export function resetIhuiState(): void {
  ihuiState.authLoginAttemptTotal = 0
  ihuiState.authLoginSuccessTotal = 0
  ihuiState.authLoginFailedTotal.clear()
  ihuiState.authJwtIssuedTotal = 0
  ihuiState.authTokenRevokedTotal.clear()
  ihuiState.auth2faUsedTotal = 0
  ihuiState.authLoginAnomalyTotal.clear()
  ihuiState.examStartedTotal = 0
  ihuiState.examSubmittedTotal = 0
  ihuiState.examActiveTotal = 0
  ihuiState.examQuestionUsedTotal.clear()
  ihuiState.examCertificateIssuedTotal = 0
  ihuiState.examScoreSum = 0
  ihuiState.examScoreCount = 0
  ihuiState.liveOnlineByRoom.clear()
  ihuiState.liveDanmakuTotal.clear()
  ihuiState.liveGiftIncomeTotal.clear()
  ihuiState.liveStreamDisconnectedTotal = 0
  ihuiState.ossUploadBytesTotal = 0
  ihuiState.ossDownloadBytesTotal = 0
  ihuiState.ossRequestsTotal.clear()
  ihuiState.ossErrorsTotal.clear()
  ihuiState.ossStorageUsedBytes = 0
  ihuiState.ossFileCount = 0
  ihuiState.paymentAttemptTotal.clear()
  ihuiState.paymentSuccessTotal.clear()
  ihuiState.paymentRefundTotal.clear()
  ihuiState.paymentExceptionTotal.clear()
  ihuiState.paymentAmountTotal.clear()
  ihuiState.wxpayCallbackTotal = 0
  ihuiState.wxpayCallbackSuccessTotal = 0
  ihuiState.wxpayCallbackFailedTotal = 0
  ihuiState.tenantApiCallsTotal.clear()
  ihuiState.tenantRatelimitTotal.clear()
  ihuiState.tenantResourceUsed.clear()
  ihuiState.tenantResourceQuota.clear()
  ihuiState.seriesDroppedTotal = 0
}

const businessMetricsPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  const m: BusinessMetrics = {
    // 现有指标
    funnel: new Map(),
    apiCallTotal: new Map(),
    apiDurationBuckets: new Map(),
    apiDurationSum: new Map(),
    apiDurationCount: new Map(),
    orders: new Map(),
    payments: new Map(),
    aiCalls: aiState.calls,
    aiTokens: aiState.tokens,
    aiCostMinorUnits: aiState.costMinorUnits,
    aiRecordFailures: aiState.recordFailures,
    // 用户指标
    usersTotal: 0,
    usersActive24h: 0,
    // HLS 视频指标
    hlsTranscodeBuckets: new Map(),
    hlsTranscodeSum: new Map(),
    hlsTranscodeCount: new Map(),
    hlsSegmentsTotal: new Map(),
    hlsTranscodeTotal: new Map(),
    // 通知推送指标
    noticePushedTotal: new Map(),
    noticeDeliveredTotal: new Map(),
    // WebSocket pub/sub 指标
    wsPubsubReconnectsTotal: new Map(),
    wsPubsubMessagesTotal: new Map(),
    wsHeartbeatDropsTotal: 0,
    wsAuthFailuresTotal: new Map(),
    wsRoomBroadcastsTotal: new Map(),
    // 缓存指标
    cacheHitsTotal: new Map(),
    cacheMissesTotal: new Map(),
    cacheHitRatio: new Map(),
    // 任务执行指标
    jobExecutionsTotal: new Map(),
    jobDurationBuckets: new Map(),
    jobDurationSum: new Map(),
    jobDurationCount: new Map(),
    // WebSocket 连接指标
    wsConnections: 0,
    wsNoticeSubscriptions: 0,
    wsConnectTotal: 0,
    wsMessageReceivedTotal: 0,
    wsMessageSentTotal: 0,
    wsDisconnectTotal: 0,
    // live-chat 房间数与消息延迟
    wsRooms: 0,
    wsMessageLatencyBuckets: new Map(),
    wsMessageLatencySum: 0,
    wsMessageLatencyCount: 0,
    // 业务异常指标
    errorsTotal: new Map(),
    // 新增：TTFT 指标
    ttftBuckets: new Map(),
    ttftSum: new Map(),
    ttftCount: new Map(),
    ttftTotal: new Map(),
    ttftAlertsTotal: 0,
    // 新增：连续包月扣款明细(8.3.1)
    recurringChargeTotal: new Map(),
    recurringChargeDueGauge: 0,
    // 新增：旧事件名 deprecation 计数(8.3.2)
    recurringWebhookDeprecatedTotal: new Map(),
  }

  // P2 修复:统一重置所有 metrics Map 与 number gauge,防止长期运行内存累积。
  // 触发场景:① 进程 onClose 释放内存;② admin 手动 POST /business-metrics/reset。
  function resetAllMetrics(): void {
    // AI 四族的状态在模块级单例上(m 里存的是同一批 Map 引用),含一个不在 m 上的
    // seriesDroppedTotal 计数,故显式走单例的重置出口。
    resetAiState()
    // 业务域指标族(ihui_*)状态同样在模块级单例 ihuiState 上,走独立重置出口。
    resetIhuiState()
    for (const value of Object.values(m)) {
      if (value instanceof Map) {
        value.clear()
      }
    }
    // 重置所有 number 类型 gauge/counter(非 Map 字段)
    m.usersTotal = 0
    m.usersActive24h = 0
    m.wsHeartbeatDropsTotal = 0
    m.wsConnections = 0
    m.wsNoticeSubscriptions = 0
    m.wsConnectTotal = 0
    m.wsMessageReceivedTotal = 0
    m.wsMessageSentTotal = 0
    m.wsDisconnectTotal = 0
    m.wsRooms = 0
    m.wsMessageLatencySum = 0
    m.wsMessageLatencyCount = 0
    m.ttftAlertsTotal = 0
    m.recurringChargeDueGauge = 0
  }

  // 自动采集 API 调用成功率与延迟（按路由+状态码）
  // P2 修复:早返回判断保留在钩子同步段(快速跳过非 /api/ 与健康检查路径);
  // 实际指标更新挪到 setImmediate,避免同步遍历 LATENCY_BUCKETS + 更新 3 个 Map
  // 拖慢 onResponse 钩子链(高 QPS 热点)。
  //
  // 2026-10-16 根因修复:钩子**必须声明为 async**。
  // Fastify 5 对 onResponse 钩子按形参个数判风格:3 参(request, reply, done)走回调、
  // 需显式 done();2 参则按 Promise 处理。此前写成同步 2 参函数,既不调 done 也不返回
  // Promise ⇒ Fastify 一直等这个钩子的完成信号,onResponse 链在此**静默停滞**:
  // 请求照常 200 返回、不报错、不告警,但**本插件之后注册的所有 onResponse 钩子永不再执行**。
  // 实测后果:api_logger(server.ts 注册序在本插件之后)从未触发 ⇒ api_logs 全生命周期 0 行,
  // 监控大屏「今日 API 调用 / API 失败率 / TOP5 接口」恒为 0;
  // n1-detector / open-idempotency / point·search·tenant aspect 等同批后置 onResponse 能力一并静默失效。
  // 最小修法:函数体一字不改,只把钩子声明改为 async(返回 Promise,让 Fastify 立即续链)。
  // 函数体本身仍是同步的(早返回 + setImmediate 异步上报 histogram):async 仅用于向
  // Fastify 交回完成信号,高 QPS 下不会因同步遍历 LATENCY_BUCKETS 拖慢钩子链。
  // 早返回判断保留在同步段(快速跳过非 /api/ 与健康检查路径);实际指标更新挪到 setImmediate。
  server.addHook('onResponse', async (request, reply: FastifyReply) => {
    const url = request.url.split('?')[0] ?? ''
    if (!url.startsWith('/api/')) return
    if (url === '/api/health' || url === '/api/metrics' || url === '/api/business-metrics') return
    const route = request.routeOptions?.url ?? url
    const key = `${route}|${reply.statusCode}`
    // 异步上报,不阻塞 onResponse 钩子链
    setImmediate(() => {
      counterInc(m.apiCallTotal, key)
      observeHistogram(m, key, Math.round(reply.elapsedTime))
      // oss 请求/错误计数:过滤 /api/files、/api/oss 前缀(真实字节面)。
      // driver 标签取配置值(本地存储默认 local);错误按响应码粗分 error_type。
      if (url.startsWith('/api/files/') || url.startsWith('/api/oss')) {
        const driver = sanitizeIhuiLabel(process.env.OSS_DRIVER_TYPE ?? 'local', 32)
        ihuiCounterInc(ihuiState.ossRequestsTotal, driver)
        if (reply.statusCode >= 400) {
          ihuiCounterInc(
            ihuiState.ossErrorsTotal,
            `${driver}|status_${Math.floor(reply.statusCode / 100)}xx`,
          )
        }
      }
    })
  })

  // ===== 现有业务上报装饰器 =====
  server.decorate('recordFunnel', (stage: FunnelStage, channel = 'default') => {
    counterInc(m.funnel, `${stage}|${channel}`)
  })
  server.decorate('recordOrder', (type: string, status: string) => {
    counterInc(m.orders, `${type}|${status}`)
  })
  server.decorate('recordPayment', (channel: string, status: string) => {
    counterInc(m.payments, `${channel}|${status}`)
  })
  server.decorate(
    'recordAiCall',
    (
      vendor: string,
      model: string,
      tokens: number,
      costUsd: number,
      options?: {
        /** tokens 计入哪个方向;缺省 'input'(= 旧实现把 tokens 全记为 prompt 的行为) */
        direction?: AiTokenDirection
        /** 调用结果;缺省 'success' */
        status?: AiCallStatus
        /** 调用类型;缺省 'other'(旧签名不带该维度,不做乐观猜测) */
        callType?: AiCallType
        /** 成本币种;costUsd 旧语义为美元,故缺省 'USD' */
        currency?: string
      },
    ) => {
      const direction: AiTokenDirection = options?.direction ?? 'input'
      recordAiCallSample({
        vendor,
        model,
        inputTokens: direction === 'input' ? tokens : 0,
        outputTokens: direction === 'output' ? tokens : 0,
        // 旧第 4 参 costUsd 的单位是「美元」,本族统一存最小货币单位,故 ×100 换算
        costMinorUnits: Math.round(nonNegativeNumber(costUsd) * 100),
        currency: options?.currency ?? 'USD',
        status: options?.status ?? 'success',
        callType: options?.callType ?? 'other',
      })
    },
  )

  // ===== 新增：用户指标装饰器 =====
  server.decorate('recordUsersTotal', (count: number) => {
    m.usersTotal = count
  })
  server.decorate('recordUsersActive24h', (count: number) => {
    m.usersActive24h = count
  })

  // ===== 新增：HLS 视频指标装饰器 =====
  server.decorate('recordHlsTranscode', (videoId: string, seconds: number) => {
    observeHlsTranscode(m, videoId, seconds)
  })
  // 回调槽注入:让模块级桥接 recordHlsTranscodeSample 也走同一实现同一状态
  // (transcode-service 的 ffmpeg close 回调不持 fastify 实例,见模块级注释)
  hlsTranscodeRecorder = (videoId: string, seconds: number) => {
    observeHlsTranscode(m, videoId, seconds)
  }
  server.decorate('recordHlsSegment', (bitrate: string) => {
    counterInc(m.hlsSegmentsTotal, bitrate)
  })
  server.decorate('recordHlsTranscodeResult', (result: string) => {
    counterInc(m.hlsTranscodeTotal, result)
  })

  // ===== 新增：通知推送指标装饰器 =====
  server.decorate('recordNoticePushed', (topic: string, scope: string) => {
    counterInc(m.noticePushedTotal, `${topic}|${scope}`)
  })
  server.decorate('recordNoticeDelivered', (topic: string) => {
    counterInc(m.noticeDeliveredTotal, topic)
  })

  // ===== 新增：WebSocket pub/sub 指标装饰器 =====
  server.decorate('recordWsPubsubReconnect', (result: string) => {
    counterInc(m.wsPubsubReconnectsTotal, result)
  })
  server.decorate('recordWsPubsubMessage', (channel: string) => {
    counterInc(m.wsPubsubMessagesTotal, channel)
  })
  server.decorate('recordWsHeartbeatDrop', () => {
    m.wsHeartbeatDropsTotal++
  })
  server.decorate('recordWsAuthFailure', (reason: string) => {
    counterInc(m.wsAuthFailuresTotal, reason)
  })
  server.decorate('recordWsRoomBroadcast', (roomId: string) => {
    counterInc(m.wsRoomBroadcastsTotal, roomId)
  })

  // ===== 新增：缓存指标装饰器 =====
  server.decorate('recordCache', (keyPrefix: string, hit: boolean) => {
    recordCache(m, keyPrefix, hit)
  })

  // ===== 新增：任务执行指标装饰器 =====
  server.decorate('recordJobExecution', (jobName: string, status: string) => {
    counterInc(m.jobExecutionsTotal, `${jobName}|${status}`)
  })
  server.decorate('recordJobDuration', (jobName: string, seconds: number) => {
    observeJobDuration(m, jobName, seconds)
  })
  server.decorate(
    'startBizTimer',
    (jobName: string, opts?: { userId?: string; tenantId?: string }) => {
      return new BizTimer(jobName, (name, seconds) => observeJobDuration(m, name, seconds), opts)
    },
  )

  // ===== 新增：WebSocket 连接指标装饰器 =====
  server.decorate('recordWsConnections', (count: number) => {
    m.wsConnections = count
  })
  server.decorate('recordWsNoticeSubscriptions', (count: number) => {
    m.wsNoticeSubscriptions = count
  })
  server.decorate('recordWsConnect', () => {
    m.wsConnectTotal++
  })
  server.decorate('recordWsMessageReceived', () => {
    m.wsMessageReceivedTotal++
  })
  server.decorate('recordWsMessageSent', () => {
    m.wsMessageSentTotal++
  })
  server.decorate('recordWsDisconnect', () => {
    m.wsDisconnectTotal++
  })
  server.decorate('recordWsRooms', (count: number) => {
    m.wsRooms = count
  })
  server.decorate('recordWsMessageLatency', (valueMs: number) => {
    observeWsMessageLatency(m, valueMs)
  })

  // ===== 新增：业务异常指标装饰器 =====
  server.decorate('recordBusinessError', (endpoint: string, errorType: string) => {
    counterInc(m.errorsTotal, `${endpoint}|${errorType}`)
  })

  // ===== 新增：TTFT 指标装饰器 =====
  server.decorate(
    'recordTtft',
    (model: string, endpoint: string, ttftSec: number, result: 'success' | 'error') => {
      const baseKey = `${model}|${endpoint}`
      observeTtft(m, baseKey, ttftSec)
      counterInc(m.ttftTotal, `${model}|${result}`)
    },
  )
  server.decorate('recordTtftAlert', () => {
    m.ttftAlertsTotal++
  })
  server.decorate('getTtftStats', (): TtftStats => {
    return ttftMonitor.stats()
  })

  // ===== 新增：连续包月扣款明细装饰器(8.3.1) =====
  // 一次 recordRecurringCharge 调用内部按 result 维度拆分累加 4 个 counter,
  // 同时设置 due_gauge(本次扫扣的到期签约数)。
  server.decorate(
    'recordRecurringCharge',
    (result: {
      scanned: number
      charged: number
      failed: number
      skipped: number
      trialExtended: number
    }) => {
      counterInc(m.recurringChargeTotal, 'charged', result.charged)
      counterInc(m.recurringChargeTotal, 'failed', result.failed)
      counterInc(m.recurringChargeTotal, 'skipped', result.skipped)
      counterInc(m.recurringChargeTotal, 'trial_extended', result.trialExtended)
      m.recurringChargeDueGauge = result.scanned
    },
  )

  // ===== 新增：旧事件名 deprecation 上报装饰器(8.3.2) =====
  // 微信支付 V3 旧事件名(contract.signed / contract.cancelled / recurring.charge.*)
  // 已被 PAPAY.* / TRANSACTION.* 取代,业务仍兼容但记录埋点便于后续移除。
  server.decorate('recordRecurringWebhookDeprecated', (eventType: string) => {
    counterInc(m.recurringWebhookDeprecatedTotal, eventType)
  })

  // ===== 新增：业务域指标(ihui_*)装饰器 =====
  // 与模块级 record* 导出写同一份 ihuiState(装饰器只服务持有 server 的请求链,
  // db/service/scheduler 层直接 import 模块级函数,不穿透 server 实例)。
  server.decorate('recordAuthLoginAttempt', () => recordAuthLoginAttempt())
  server.decorate('recordAuthLoginSuccess', () => recordAuthLoginSuccess())
  server.decorate('recordAuthLoginFailed', (sourceIp: string) => recordAuthLoginFailed(sourceIp))
  server.decorate('recordAuthJwtIssued', () => recordAuthJwtIssued())
  server.decorate('recordAuthTokenRevoked', (reason: string) => recordAuthTokenRevoked(reason))
  server.decorate('recordAuth2faUsed', () => recordAuth2faUsed())
  server.decorate('recordAuthLoginAnomaly', (reason: string) => recordAuthLoginAnomaly(reason))
  server.decorate('recordExamStarted', () => recordExamStarted())
  server.decorate('recordExamSubmitted', () => recordExamSubmitted())
  server.decorate('setExamActive', (count: number) => setExamActive(count))
  server.decorate('recordExamQuestionUsed', (category: string, by = 1) =>
    recordExamQuestionUsed(category, by),
  )
  server.decorate('recordExamCertificateIssued', () => recordExamCertificateIssued())
  server.decorate('recordExamScore', (score: number) => recordExamScore(score))
  server.decorate('setLiveOnline', (roomId: string, count: number) => setLiveOnline(roomId, count))
  server.decorate('deleteLiveOnline', (roomId: string) => deleteLiveOnline(roomId))
  server.decorate('recordLiveDanmaku', (roomId: string) => recordLiveDanmaku(roomId))
  server.decorate('recordLiveGiftIncome', (roomId: string, amount: number) =>
    recordLiveGiftIncome(roomId, amount),
  )
  server.decorate('recordLiveStreamDisconnected', () => recordLiveStreamDisconnected())
  server.decorate('recordOssUploadBytes', (bytes: number) => recordOssUploadBytes(bytes))
  server.decorate('recordOssDownloadBytes', (bytes: number) => recordOssDownloadBytes(bytes))
  server.decorate('recordOssRequest', (driver: string) => recordOssRequest(driver))
  server.decorate('recordOssError', (driver: string, errorType: string) =>
    recordOssError(driver, errorType),
  )
  server.decorate('setOssStorageStats', (totalBytes: number, totalFiles: number) =>
    setOssStorageStats(totalBytes, totalFiles),
  )
  server.decorate('recordPaymentAttempt', (channel: string) => recordPaymentAttempt(channel))
  server.decorate('recordPaymentSuccess', (channel: string) => recordPaymentSuccess(channel))
  server.decorate('recordPaymentRefund', (channel: string) => recordPaymentRefund(channel))
  server.decorate('recordPaymentException', (channel: string, reason: string) =>
    recordPaymentException(channel, reason),
  )
  server.decorate('recordPaymentAmount', (channel: string, amountMinorUnits: number) =>
    recordPaymentAmount(channel, amountMinorUnits),
  )
  server.decorate('recordWxpayCallback', () => recordWxpayCallback())
  server.decorate('recordWxpayCallbackSuccess', () => recordWxpayCallbackSuccess())
  server.decorate('recordWxpayCallbackFailed', () => recordWxpayCallbackFailed())
  server.decorate('recordTenantApiCall', (tenantId: string) => recordTenantApiCall(tenantId))
  server.decorate('recordTenantRateLimit', (tenantId: string) => recordTenantRateLimit(tenantId))
  server.decorate('setTenantResourceUsed', (tenantId: string, resource: string, value: number) =>
    setTenantResourceUsed(tenantId, resource as 'api_calls' | 'storage_mb' | 'users', value),
  )
  server.decorate('setTenantResourceQuota', (tenantId: string, resource: string, value: number) =>
    setTenantResourceQuota(tenantId, resource as 'api_calls' | 'storage_mb' | 'users', value),
  )

  // P2 修复:运行时手动重置路由(仅 admin),用于长期运行后内存释放
  server.post(
    '/business-metrics/reset',
    {
      // 路由级 admin 鉴权:authenticate + roleId >= 1
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          await authenticate(request)
        } catch (e) {
          const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
          return reply
            .status(statusCode)
            .send(error(statusCode, (e as Error).message || 'Authentication required'))
        }
        // O13b:特权判定走集中谓词(刻意不换 requireAdminRouteGuard —— 那会附带
        // requireActiveUser,属行为收紧,不在本票额度收敛范围内)
        if (!isSystemAdmin(request, { includeInternalChannel: false })) {
          return reply.status(403).send(error(403, '需要管理员权限'))
        }
      },
    },
    async (_request, reply: FastifyReply) => {
      resetAllMetrics()
      return reply.send({ code: 0, message: 'metrics reset', data: { reset: true } })
    },
  )

  server.get('/business-metrics', async (_request, reply: FastifyReply) => {
    const lines: string[] = []

    // 1. 漏斗
    lines.push('# HELP business_funnel_total Business conversion funnel counter')
    lines.push('# TYPE business_funnel_total counter')
    for (const [k, v] of m.funnel) {
      const [stage, channel] = k.split('|')
      lines.push(`business_funnel_total{stage="${stage}",channel="${channel}"} ${v}`)
    }

    // 2. API 调用成功率
    lines.push('# HELP business_api_call_total Business API calls by route and status')
    lines.push('# TYPE business_api_call_total counter')
    for (const [k, v] of m.apiCallTotal) {
      const [route, status] = k.split('|')
      lines.push(`business_api_call_total{route="${route}",status="${status}"} ${v}`)
    }

    // API 延迟直方图
    lines.push('# HELP business_api_call_duration_ms Business API call latency in ms')
    lines.push('# TYPE business_api_call_duration_ms histogram')
    for (const [k, v] of m.apiDurationBuckets) {
      const [base, le] = k.split('|le=')
      const [route, status] = (base ?? '').split('|')
      lines.push(
        `business_api_call_duration_ms_bucket{route="${route}",status="${status}",le="${le}"} ${v}`,
      )
    }
    for (const [k, v] of m.apiDurationSum) {
      const [route, status] = k.split('|')
      lines.push(
        `business_api_call_duration_ms_sum{route="${route}",status="${status}"} ${v.toFixed(2)}`,
      )
    }
    for (const [k, v] of m.apiDurationCount) {
      const [route, status] = k.split('|')
      lines.push(`business_api_call_duration_ms_count{route="${route}",status="${status}"} ${v}`)
    }

    // 3. 自定义业务指标
    lines.push('# HELP business_orders_total Business orders counter')
    lines.push('# TYPE business_orders_total counter')
    for (const [k, v] of m.orders) {
      const [type, status] = k.split('|')
      lines.push(`business_orders_total{type="${type}",status="${status}"} ${v}`)
    }

    lines.push('# HELP business_payments_total Business payments counter')
    lines.push('# TYPE business_payments_total counter')
    for (const [k, v] of m.payments) {
      const [channel, status] = k.split('|')
      lines.push(`business_payments_total{channel="${channel}",status="${status}"} ${v}`)
    }

    // AI 族:标签值一律来自 sanitizeAiLabel(写入侧洗过),这里只做 4/3 段反拆。
    lines.push(
      '# HELP business_ai_calls_total AI model invocation counter (labels: vendor, model, call_type, status)',
    )
    lines.push('# TYPE business_ai_calls_total counter')
    for (const [k, v] of m.aiCalls) {
      const [vendor, model, callType, status] = k.split('|')
      lines.push(
        `business_ai_calls_total{vendor="${vendor}",model="${model}",call_type="${callType}",status="${status}"} ${v}`,
      )
    }

    lines.push(
      '# HELP business_ai_tokens_total AI token consumption counter (direction=input|output)',
    )
    lines.push('# TYPE business_ai_tokens_total counter')
    for (const [k, v] of m.aiTokens) {
      const [vendor, model, direction] = k.split('|')
      lines.push(
        `business_ai_tokens_total{vendor="${vendor}",model="${model}",direction="${direction}"} ${v}`,
      )
    }

    lines.push(
      '# HELP business_ai_cost_minor_units_total AI cost accumulated in currency minor units (1 CNY/USD = 100 分)',
    )
    lines.push('# TYPE business_ai_cost_minor_units_total counter')
    for (const [k, v] of m.aiCostMinorUnits) {
      const [vendor, model, currency] = k.split('|')
      lines.push(
        `business_ai_cost_minor_units_total{vendor="${vendor}",model="${model}",currency="${currency}"} ${v.toFixed(6)}`,
      )
    }

    lines.push(
      '# HELP business_ai_record_failures_total AI cost record (ai_cost_records insert) failures',
    )
    lines.push('# TYPE business_ai_record_failures_total counter')
    for (const [k, v] of m.aiRecordFailures) {
      const [vendor, model] = k.split('|')
      lines.push(`business_ai_record_failures_total{vendor="${vendor}",model="${model}"} ${v}`)
    }

    lines.push(
      '# HELP business_ai_series_dropped_total AI metric series writes dropped at the label cardinality cap (counts overflow writes, not samples)',
    )
    lines.push('# TYPE business_ai_series_dropped_total counter')
    lines.push(`business_ai_series_dropped_total ${aiState.seriesDroppedTotal}`)

    // 4. 用户指标
    lines.push('# HELP business_users_total Total registered users')
    lines.push('# TYPE business_users_total gauge')
    lines.push(`business_users_total ${m.usersTotal}`)

    lines.push('# HELP business_users_active_24h Active users in last 24 hours')
    lines.push('# TYPE business_users_active_24h gauge')
    lines.push(`business_users_active_24h ${m.usersActive24h}`)

    // 5. HLS 视频指标
    lines.push('# HELP business_hls_transcode_seconds HLS transcode duration in seconds')
    lines.push('# TYPE business_hls_transcode_seconds histogram')
    for (const [k, v] of m.hlsTranscodeBuckets) {
      const [videoId, le] = k.split('|le=')
      lines.push(`business_hls_transcode_seconds_bucket{video_id="${videoId}",le="${le}"} ${v}`)
    }
    for (const [videoId, v] of m.hlsTranscodeSum) {
      lines.push(`business_hls_transcode_seconds_sum{video_id="${videoId}"} ${v.toFixed(6)}`)
    }
    for (const [videoId, v] of m.hlsTranscodeCount) {
      lines.push(`business_hls_transcode_seconds_count{video_id="${videoId}"} ${v}`)
    }

    lines.push('# HELP business_hls_segments_total HLS segments generated counter')
    lines.push('# TYPE business_hls_segments_total counter')
    for (const [bitrate, v] of m.hlsSegmentsTotal) {
      lines.push(`business_hls_segments_total{bitrate="${bitrate}"} ${v}`)
    }

    lines.push('# HELP business_hls_transcode_total HLS transcode attempts counter')
    lines.push('# TYPE business_hls_transcode_total counter')
    for (const [result, v] of m.hlsTranscodeTotal) {
      lines.push(`business_hls_transcode_total{result="${result}"} ${v}`)
    }

    // 6. 通知推送指标
    lines.push('# HELP business_notice_pushed_total Notices pushed counter')
    lines.push('# TYPE business_notice_pushed_total counter')
    for (const [k, v] of m.noticePushedTotal) {
      const [topic, scope] = k.split('|')
      lines.push(`business_notice_pushed_total{topic="${topic}",scope="${scope}"} ${v}`)
    }

    lines.push('# HELP business_notice_delivered_total Notices delivered counter')
    lines.push('# TYPE business_notice_delivered_total counter')
    for (const [topic, v] of m.noticeDeliveredTotal) {
      lines.push(`business_notice_delivered_total{topic="${topic}"} ${v}`)
    }

    // 7. WebSocket pub/sub 指标
    lines.push('# HELP business_ws_pubsub_reconnects_total WebSocket pub/sub reconnect attempts')
    lines.push('# TYPE business_ws_pubsub_reconnects_total counter')
    for (const [result, v] of m.wsPubsubReconnectsTotal) {
      lines.push(`business_ws_pubsub_reconnects_total{result="${result}"} ${v}`)
    }

    lines.push('# HELP business_ws_pubsub_messages_total WebSocket pub/sub messages relayed')
    lines.push('# TYPE business_ws_pubsub_messages_total counter')
    for (const [channel, v] of m.wsPubsubMessagesTotal) {
      lines.push(`business_ws_pubsub_messages_total{channel="${channel}"} ${v}`)
    }

    lines.push(
      '# HELP business_ws_heartbeat_drops_total WebSocket connections dropped by heartbeat timeout',
    )
    lines.push('# TYPE business_ws_heartbeat_drops_total counter')
    lines.push(`business_ws_heartbeat_drops_total ${m.wsHeartbeatDropsTotal}`)

    lines.push('# HELP business_ws_auth_failures_total WebSocket authentication failures')
    lines.push('# TYPE business_ws_auth_failures_total counter')
    for (const [reason, v] of m.wsAuthFailuresTotal) {
      lines.push(`business_ws_auth_failures_total{reason="${reason}"} ${v}`)
    }

    lines.push('# HELP business_ws_room_broadcasts_total WebSocket room broadcast events')
    lines.push('# TYPE business_ws_room_broadcasts_total counter')
    for (const [roomId, v] of m.wsRoomBroadcastsTotal) {
      lines.push(`business_ws_room_broadcasts_total{room_id="${roomId}"} ${v}`)
    }

    // 8. 缓存指标
    lines.push('# HELP business_cache_hits_total Cache hit counter by key prefix')
    lines.push('# TYPE business_cache_hits_total counter')
    for (const [keyPrefix, v] of m.cacheHitsTotal) {
      lines.push(`business_cache_hits_total{key_prefix="${keyPrefix}"} ${v}`)
    }

    lines.push('# HELP business_cache_misses_total Cache miss counter by key prefix')
    lines.push('# TYPE business_cache_misses_total counter')
    for (const [keyPrefix, v] of m.cacheMissesTotal) {
      lines.push(`business_cache_misses_total{key_prefix="${keyPrefix}"} ${v}`)
    }

    lines.push('# HELP business_cache_hit_ratio Cache hit ratio by key prefix')
    lines.push('# TYPE business_cache_hit_ratio gauge')
    for (const [keyPrefix, v] of m.cacheHitRatio) {
      lines.push(`business_cache_hit_ratio{key_prefix="${keyPrefix}"} ${v.toFixed(4)}`)
    }

    // 9. 任务执行指标
    lines.push('# HELP business_job_executions_total Job execution counter by name and status')
    lines.push('# TYPE business_job_executions_total counter')
    for (const [k, v] of m.jobExecutionsTotal) {
      const [jobName, status] = k.split('|')
      lines.push(`business_job_executions_total{job_name="${jobName}",status="${status}"} ${v}`)
    }

    lines.push('# HELP business_job_duration_seconds Job execution duration in seconds')
    lines.push('# TYPE business_job_duration_seconds histogram')
    for (const [k, v] of m.jobDurationBuckets) {
      const [jobName, le] = k.split('|le=')
      lines.push(`business_job_duration_seconds_bucket{job_name="${jobName}",le="${le}"} ${v}`)
    }
    for (const [jobName, v] of m.jobDurationSum) {
      lines.push(`business_job_duration_seconds_sum{job_name="${jobName}"} ${v.toFixed(6)}`)
    }
    for (const [jobName, v] of m.jobDurationCount) {
      lines.push(`business_job_duration_seconds_count{job_name="${jobName}"} ${v}`)
    }

    // 10. WebSocket 连接指标
    lines.push('# HELP business_ws_connections Current WebSocket connections')
    lines.push('# TYPE business_ws_connections gauge')
    lines.push(`business_ws_connections ${m.wsConnections}`)

    lines.push('# HELP business_ws_notice_subscriptions Current WebSocket notice subscriptions')
    lines.push('# TYPE business_ws_notice_subscriptions gauge')
    lines.push(`business_ws_notice_subscriptions ${m.wsNoticeSubscriptions}`)

    lines.push('# HELP business_ws_connect_total Total WebSocket connections established')
    lines.push('# TYPE business_ws_connect_total counter')
    lines.push(`business_ws_connect_total ${m.wsConnectTotal}`)

    lines.push('# HELP business_ws_message_received_total Total WebSocket messages received')
    lines.push('# TYPE business_ws_message_received_total counter')
    lines.push(`business_ws_message_received_total ${m.wsMessageReceivedTotal}`)

    lines.push('# HELP business_ws_message_sent_total Total WebSocket messages sent')
    lines.push('# TYPE business_ws_message_sent_total counter')
    lines.push(`business_ws_message_sent_total ${m.wsMessageSentTotal}`)

    lines.push('# HELP business_ws_disconnect_total Total WebSocket disconnections')
    lines.push('# TYPE business_ws_disconnect_total counter')
    lines.push(`business_ws_disconnect_total ${m.wsDisconnectTotal}`)

    lines.push('# HELP business_ws_rooms Current live-chat rooms')
    lines.push('# TYPE business_ws_rooms gauge')
    lines.push(`business_ws_rooms ${m.wsRooms}`)

    lines.push('# HELP business_ws_message_latency_ms live-chat message handling latency in ms')
    lines.push('# TYPE business_ws_message_latency_ms histogram')
    for (const [le, v] of m.wsMessageLatencyBuckets) {
      lines.push(`business_ws_message_latency_ms_bucket{le="${le}"} ${v}`)
    }
    lines.push(`business_ws_message_latency_ms_sum ${m.wsMessageLatencySum}`)
    lines.push(`business_ws_message_latency_ms_count ${m.wsMessageLatencyCount}`)

    // 11. 业务异常指标
    lines.push('# HELP business_errors_total Business errors by endpoint and error type')
    lines.push('# TYPE business_errors_total counter')
    for (const [k, v] of m.errorsTotal) {
      const [endpoint, errorType] = k.split('|')
      lines.push(`business_errors_total{endpoint="${endpoint}",error_type="${errorType}"} ${v}`)
    }

    // 12. TTFT 指标
    lines.push('# HELP business_ttft_seconds Time to first token in seconds')
    lines.push('# TYPE business_ttft_seconds histogram')
    for (const [k, v] of m.ttftBuckets) {
      const [base, le] = k.split('|le=')
      const [model, endpoint] = (base ?? '').split('|')
      lines.push(
        `business_ttft_seconds_bucket{model="${model}",endpoint="${endpoint}",le="${le}"} ${v}`,
      )
    }
    for (const [k, v] of m.ttftSum) {
      const [model, endpoint] = k.split('|')
      lines.push(
        `business_ttft_seconds_sum{model="${model}",endpoint="${endpoint}"} ${v.toFixed(6)}`,
      )
    }
    for (const [k, v] of m.ttftCount) {
      const [model, endpoint] = k.split('|')
      lines.push(`business_ttft_seconds_count{model="${model}",endpoint="${endpoint}"} ${v}`)
    }

    lines.push('# HELP business_ttft_total TTFT call counter by model and result')
    lines.push('# TYPE business_ttft_total counter')
    for (const [k, v] of m.ttftTotal) {
      const [model, result] = k.split('|')
      lines.push(`business_ttft_total{model="${model}",result="${result}"} ${v}`)
    }

    // TTFT 分位数（从 ttftMonitor 实时计算）
    const ttftStats = ttftMonitor.stats()
    lines.push('# HELP business_ttft_p50_seconds TTFT P50 latency in seconds')
    lines.push('# TYPE business_ttft_p50_seconds gauge')
    lines.push(`business_ttft_p50_seconds ${ttftStats.current.p50}`)
    lines.push('# HELP business_ttft_p95_seconds TTFT P95 latency in seconds')
    lines.push('# TYPE business_ttft_p95_seconds gauge')
    lines.push(`business_ttft_p95_seconds ${ttftStats.current.p95}`)
    lines.push('# HELP business_ttft_p99_seconds TTFT P99 latency in seconds')
    lines.push('# TYPE business_ttft_p99_seconds gauge')
    lines.push(`business_ttft_p99_seconds ${ttftStats.current.p99}`)
    lines.push('# HELP business_ttft_alerts_total TTFT alert counter')
    lines.push('# TYPE business_ttft_alerts_total counter')
    lines.push(`business_ttft_alerts_total ${m.ttftAlertsTotal + ttftStats.alertCount}`)

    // 13. 连续包月扣款明细(8.3.1)
    lines.push(
      '# HELP business_subscription_recurring_charge_total Subscription recurring charge counter by result',
    )
    lines.push('# TYPE business_subscription_recurring_charge_total counter')
    for (const [result, v] of m.recurringChargeTotal) {
      lines.push(`business_subscription_recurring_charge_total{result="${result}"} ${v}`)
    }
    lines.push(
      '# HELP business_subscription_recurring_due Last scan-and-charge due contracts (gauge)',
    )
    lines.push('# TYPE business_subscription_recurring_due gauge')
    lines.push(`business_subscription_recurring_due ${m.recurringChargeDueGauge}`)

    // 14. 旧事件名 deprecation 计数(8.3.2)
    lines.push(
      '# HELP business_subscription_recurring_webhook_deprecated_total Deprecated recurring webhook event_type counter',
    )
    lines.push('# TYPE business_subscription_recurring_webhook_deprecated_total counter')
    for (const [eventType, v] of m.recurringWebhookDeprecatedTotal) {
      lines.push(
        `business_subscription_recurring_webhook_deprecated_total{event_type="${eventType}"} ${v}`,
      )
    }

    // 15. 业务域指标族(ihui_*):auth / exam / live / oss / payment / tenant
    // 写入侧标签值一律 sanitizeIhuiLabel 洗过,这里只做竖线 key 反拆。
    // auth 7
    lines.push('# HELP ihui_auth_login_attempt_total Auth login attempts counter')
    lines.push('# TYPE ihui_auth_login_attempt_total counter')
    lines.push(`ihui_auth_login_attempt_total ${ihuiState.authLoginAttemptTotal}`)

    lines.push('# HELP ihui_auth_login_success_total Auth login success counter')
    lines.push('# TYPE ihui_auth_login_success_total counter')
    lines.push(`ihui_auth_login_success_total ${ihuiState.authLoginSuccessTotal}`)

    lines.push('# HELP ihui_auth_login_failed_total Auth login failures by source_ip')
    lines.push('# TYPE ihui_auth_login_failed_total counter')
    for (const [ip, v] of ihuiState.authLoginFailedTotal) {
      lines.push(`ihui_auth_login_failed_total{source_ip="${ip}"} ${v}`)
    }

    lines.push('# HELP ihui_auth_jwt_issued_total JWT token pairs issued counter')
    lines.push('# TYPE ihui_auth_jwt_issued_total counter')
    lines.push(`ihui_auth_jwt_issued_total ${ihuiState.authJwtIssuedTotal}`)

    lines.push(
      '# HELP ihui_auth_token_revoked_total Refresh tokens revoked by reason (rotation counts toward the 1h increase panel)',
    )
    lines.push('# TYPE ihui_auth_token_revoked_total counter')
    for (const [reason, v] of ihuiState.authTokenRevokedTotal) {
      lines.push(`ihui_auth_token_revoked_total{reason="${reason}"} ${v}`)
    }

    lines.push('# HELP ihui_auth_2fa_used_total 2FA login-verify passed counter')
    lines.push('# TYPE ihui_auth_2fa_used_total counter')
    lines.push(`ihui_auth_2fa_used_total ${ihuiState.auth2faUsedTotal}`)

    lines.push('# HELP ihui_auth_login_anomaly_total Login risk-engine hits by reason')
    lines.push('# TYPE ihui_auth_login_anomaly_total counter')
    for (const [reason, v] of ihuiState.authLoginAnomalyTotal) {
      lines.push(`ihui_auth_login_anomaly_total{reason="${reason}"} ${v}`)
    }

    // exam 7
    lines.push('# HELP ihui_exam_started_total Exam sessions started counter')
    lines.push('# TYPE ihui_exam_started_total counter')
    lines.push(`ihui_exam_started_total ${ihuiState.examStartedTotal}`)

    lines.push('# HELP ihui_exam_submitted_total Exam papers submitted counter')
    lines.push('# TYPE ihui_exam_submitted_total counter')
    lines.push(`ihui_exam_submitted_total ${ihuiState.examSubmittedTotal}`)

    lines.push(
      '# HELP ihui_exam_active_total Exam records in progress (pending, started in last 24h) gauge',
    )
    lines.push('# TYPE ihui_exam_active_total gauge')
    lines.push(`ihui_exam_active_total ${ihuiState.examActiveTotal}`)

    lines.push('# HELP ihui_exam_question_used_total Exam questions served by paper category')
    lines.push('# TYPE ihui_exam_question_used_total counter')
    for (const [category, v] of ihuiState.examQuestionUsedTotal) {
      lines.push(`ihui_exam_question_used_total{category="${category}"} ${v}`)
    }

    lines.push('# HELP ihui_exam_certificate_issued_total Certificates issued counter')
    lines.push('# TYPE ihui_exam_certificate_issued_total counter')
    lines.push(`ihui_exam_certificate_issued_total ${ihuiState.examCertificateIssuedTotal}`)

    lines.push('# HELP ihui_exam_score_sum Exam score sample sum (avg = sum / count)')
    lines.push('# TYPE ihui_exam_score_sum gauge')
    lines.push(`ihui_exam_score_sum ${ihuiState.examScoreSum}`)

    lines.push('# HELP ihui_exam_score_count Exam score sample count (paired with score_sum)')
    lines.push('# TYPE ihui_exam_score_count gauge')
    lines.push(`ihui_exam_score_count ${ihuiState.examScoreCount}`)

    // live 4
    lines.push('# HELP ihui_live_online_total Live-chat online connections per room (gauge)')
    lines.push('# TYPE ihui_live_online_total gauge')
    for (const [roomId, v] of ihuiState.liveOnlineByRoom) {
      lines.push(`ihui_live_online_total{room_id="${roomId}"} ${v}`)
    }

    lines.push('# HELP ihui_live_danmaku_total Live-chat messages (danmaku) per room')
    lines.push('# TYPE ihui_live_danmaku_total counter')
    for (const [roomId, v] of ihuiState.liveDanmakuTotal) {
      lines.push(`ihui_live_danmaku_total{room_id="${roomId}"} ${v}`)
    }

    lines.push(
      '# HELP ihui_live_gift_income_total Live gift income per room (unit = platform coins)',
    )
    lines.push('# TYPE ihui_live_gift_income_total counter')
    for (const [roomId, v] of ihuiState.liveGiftIncomeTotal) {
      lines.push(`ihui_live_gift_income_total{room_id="${roomId}"} ${v}`)
    }

    lines.push('# HELP ihui_live_stream_disconnected_total Tencent cloud stream-end callbacks')
    lines.push('# TYPE ihui_live_stream_disconnected_total counter')
    lines.push(`ihui_live_stream_disconnected_total ${ihuiState.liveStreamDisconnectedTotal}`)

    // oss 6
    lines.push('# HELP ihui_oss_upload_bytes_total OSS upload bytes total (bytes)')
    lines.push('# TYPE ihui_oss_upload_bytes_total counter')
    lines.push(`ihui_oss_upload_bytes_total ${ihuiState.ossUploadBytesTotal}`)

    lines.push('# HELP ihui_oss_download_bytes_total OSS download bytes total (bytes)')
    lines.push('# TYPE ihui_oss_download_bytes_total counter')
    lines.push(`ihui_oss_download_bytes_total ${ihuiState.ossDownloadBytesTotal}`)

    lines.push('# HELP ihui_oss_requests_total OSS requests by storage driver')
    lines.push('# TYPE ihui_oss_requests_total counter')
    for (const [driver, v] of ihuiState.ossRequestsTotal) {
      lines.push(`ihui_oss_requests_total{driver="${driver}"} ${v}`)
    }

    lines.push('# HELP ihui_oss_errors_total OSS errors by storage driver and error_type')
    lines.push('# TYPE ihui_oss_errors_total counter')
    for (const [k, v] of ihuiState.ossErrorsTotal) {
      const [driver, errorType] = k.split('|')
      lines.push(`ihui_oss_errors_total{driver="${driver}",error_type="${errorType}"} ${v}`)
    }

    lines.push('# HELP ihui_oss_storage_used_bytes Storage used bytes (gauge, scheduler scan)')
    lines.push('# TYPE ihui_oss_storage_used_bytes gauge')
    lines.push(`ihui_oss_storage_used_bytes ${ihuiState.ossStorageUsedBytes}`)

    lines.push('# HELP ihui_oss_file_count Storage file count (gauge, scheduler scan)')
    lines.push('# TYPE ihui_oss_file_count gauge')
    lines.push(`ihui_oss_file_count ${ihuiState.ossFileCount}`)

    // payment 8
    lines.push('# HELP ihui_payment_attempt_total Payment order attempts by channel')
    lines.push('# TYPE ihui_payment_attempt_total counter')
    for (const [channel, v] of ihuiState.paymentAttemptTotal) {
      lines.push(`ihui_payment_attempt_total{channel="${channel}"} ${v}`)
    }

    lines.push('# HELP ihui_payment_success_total Payment successes by channel')
    lines.push('# TYPE ihui_payment_success_total counter')
    for (const [channel, v] of ihuiState.paymentSuccessTotal) {
      lines.push(`ihui_payment_success_total{channel="${channel}"} ${v}`)
    }

    lines.push('# HELP ihui_payment_refund_total Completed refunds by channel')
    lines.push('# TYPE ihui_payment_refund_total counter')
    for (const [channel, v] of ihuiState.paymentRefundTotal) {
      lines.push(`ihui_payment_refund_total{channel="${channel}"} ${v}`)
    }

    lines.push('# HELP ihui_payment_exception_total Payment exceptions by channel and reason')
    lines.push('# TYPE ihui_payment_exception_total counter')
    for (const [k, v] of ihuiState.paymentExceptionTotal) {
      const [channel, reason] = k.split('|')
      lines.push(`ihui_payment_exception_total{channel="${channel}",reason="${reason}"} ${v}`)
    }

    lines.push(
      '# HELP ihui_payment_amount_total Paid amount by channel (unit = minor currency units, 1 CNY = 100)',
    )
    lines.push('# TYPE ihui_payment_amount_total counter')
    for (const [channel, v] of ihuiState.paymentAmountTotal) {
      lines.push(`ihui_payment_amount_total{channel="${channel}"} ${v}`)
    }

    lines.push('# HELP ihui_payment_wxpay_callback_total WeChat pay callbacks received')
    lines.push('# TYPE ihui_payment_wxpay_callback_total counter')
    lines.push(`ihui_payment_wxpay_callback_total ${ihuiState.wxpayCallbackTotal}`)

    lines.push(
      '# HELP ihui_payment_wxpay_callback_success_total WeChat pay callbacks replied SUCCESS',
    )
    lines.push('# TYPE ihui_payment_wxpay_callback_success_total counter')
    lines.push(`ihui_payment_wxpay_callback_success_total ${ihuiState.wxpayCallbackSuccessTotal}`)

    lines.push('# HELP ihui_payment_wxpay_callback_failed_total WeChat pay callbacks replied FAIL')
    lines.push('# TYPE ihui_payment_wxpay_callback_failed_total counter')
    lines.push(`ihui_payment_wxpay_callback_failed_total ${ihuiState.wxpayCallbackFailedTotal}`)

    // tenant 4
    lines.push('# HELP ihui_tenant_api_calls_total API calls by tenant')
    lines.push('# TYPE ihui_tenant_api_calls_total counter')
    for (const [tenantId, v] of ihuiState.tenantApiCallsTotal) {
      lines.push(`ihui_tenant_api_calls_total{tenant_id="${tenantId}"} ${v}`)
    }

    lines.push('# HELP ihui_tenant_ratelimit_total Rate-limited (429) requests by tenant')
    lines.push('# TYPE ihui_tenant_ratelimit_total counter')
    for (const [tenantId, v] of ihuiState.tenantRatelimitTotal) {
      lines.push(`ihui_tenant_ratelimit_total{tenant_id="${tenantId}"} ${v}`)
    }

    lines.push(
      '# HELP ihui_tenant_resource_used Tenant resource usage gauge (resource=api_calls|storage_mb|users)',
    )
    lines.push('# TYPE ihui_tenant_resource_used gauge')
    for (const [k, v] of ihuiState.tenantResourceUsed) {
      const [tenantId, resource] = k.split('|')
      lines.push(`ihui_tenant_resource_used{tenant_id="${tenantId}",resource="${resource}"} ${v}`)
    }

    lines.push(
      '# HELP ihui_tenant_resource_quota Tenant resource quota gauge (resource=api_calls|storage_mb|users)',
    )
    lines.push('# TYPE ihui_tenant_resource_quota gauge')
    for (const [k, v] of ihuiState.tenantResourceQuota) {
      const [tenantId, resource] = k.split('|')
      lines.push(`ihui_tenant_resource_quota{tenant_id="${tenantId}",resource="${resource}"} ${v}`)
    }

    // 横切:基数上限丢弃计数
    lines.push(
      '# HELP ihui_series_dropped_total ihui_* metric series writes dropped at the label cardinality cap',
    )
    lines.push('# TYPE ihui_series_dropped_total counter')
    lines.push(`ihui_series_dropped_total ${ihuiState.seriesDroppedTotal}`)

    reply.type('text/plain').send(lines.join('\n'))
  })

  // P2 修复:进程关闭时统一释放所有 metrics Map 内存,防止进程退出前内存峰值
  server.addHook('onClose', async () => {
    resetAllMetrics()
  })
}

export default fp(businessMetricsPlugin, {
  name: 'business-metrics-plugin',
  fastify: '5.x',
})

/**
 * 测试唯一入口(AGENTS §22c:测试必须用源实现,不许把判据复制一份)。
 * `aiState` 是模块级单例 ⇒ 用例之间必须显式隔离,否则前一个用例的计数会顶掉断言基线。
 */
export const __test__ = {
  aiState,
  resetAiState,
  sanitizeAiLabel,
  AI_SERIES_CAP,
  recordAiCallSample,
  recordAiCostWriteFailure,
  ihuiState,
  resetIhuiState,
  sanitizeIhuiLabel,
  IHUI_SERIES_CAP,
}

declare module 'fastify' {
  interface FastifyInstance {
    /** 上报转化漏斗事件（register → activate → paid）。 */
    recordFunnel: (stage: FunnelStage, channel?: string) => void
    /** 上报订单事件。 */
    recordOrder: (type: string, status: string) => void
    /** 上报支付事件。 */
    recordPayment: (channel: string, status: string) => void
    /**
     * 上报 AI 调用事件（含 token 与成本）。
     * 前 4 个位置参数与旧签名逐一同型(向后兼容);第 5 参带默认值,不传即回旧行为。
     * 注:AI 链路的**首选埋点是 `plugins/ai-cost.ts` 的 `recordAiCost()` 内部桥接**
     * (所有调用方自动受益、不会漏);本装饰器只服务持有 server 的非成本链路。
     */
    recordAiCall: (
      vendor: string,
      model: string,
      tokens: number,
      costUsd: number,
      options?: {
        direction?: AiTokenDirection
        status?: AiCallStatus
        callType?: AiCallType
        currency?: string
      },
    ) => void
    /** 设置用户总数（Gauge）。 */
    recordUsersTotal: (count: number) => void
    /** 设置 24h 活跃用户数（Gauge）。 */
    recordUsersActive24h: (count: number) => void
    /** 上报 HLS 转码耗时（秒，Histogram，按 video_id）。 */
    recordHlsTranscode: (videoId: string, seconds: number) => void
    /** 上报 HLS 分片生成（Counter，按码率）。 */
    recordHlsSegment: (bitrate: string) => void
    /** 上报 HLS 转码结果（Counter，按 result：success/failed）。 */
    recordHlsTranscodeResult: (result: string) => void
    /** 上报通知推送（Counter，按 topic + scope）。 */
    recordNoticePushed: (topic: string, scope: string) => void
    /** 上报通知送达（Counter，按 topic）。 */
    recordNoticeDelivered: (topic: string) => void
    /** 上报 WS pub/sub 重连（Counter，按 result）。 */
    recordWsPubsubReconnect: (result: string) => void
    /** 上报 WS pub/sub 消息（Counter，按 channel）。 */
    recordWsPubsubMessage: (channel: string) => void
    /** 上报 WS 心跳超时掉线（Counter）。 */
    recordWsHeartbeatDrop: () => void
    /** 上报 WS 鉴权失败（Counter，按 reason）。 */
    recordWsAuthFailure: (reason: string) => void
    /** 上报 WS 房间广播（Counter，按 room_id）。 */
    recordWsRoomBroadcast: (roomId: string) => void
    /** 记录缓存命中/未命中，自动更新命中率 Gauge（按 key_prefix）。 */
    recordCache: (keyPrefix: string, hit: boolean) => void
    /** 上报任务执行结果（Counter，按 job_name + status）。 */
    recordJobExecution: (jobName: string, status: string) => void
    /** 上报任务执行耗时（秒，Histogram，按 job_name）。 */
    recordJobDuration: (jobName: string, seconds: number) => void
    /** 启动业务端点计时器（支持 user_id/tenant_id 维度），end() 时自动上报耗时。 */
    startBizTimer: (jobName: string, opts?: { userId?: string; tenantId?: string }) => BizTimer
    /** 设置当前 WebSocket 连接数（Gauge）。 */
    recordWsConnections: (count: number) => void
    /** 设置当前通知订阅数（Gauge）。 */
    recordWsNoticeSubscriptions: (count: number) => void
    /** 上报 WS 连接建立（Counter）。 */
    recordWsConnect: () => void
    /** 上报 WS 消息接收（Counter）。 */
    recordWsMessageReceived: () => void
    /** 上报 WS 消息发送（Counter）。 */
    recordWsMessageSent: () => void
    /** 上报 WS 连接断开（Counter）。 */
    recordWsDisconnect: () => void
    /** 设置当前 live-chat 活跃房间数（Gauge）。 */
    recordWsRooms: (count: number) => void
    /** 上报 live-chat 消息处理耗时（毫秒，Histogram）。 */
    recordWsMessageLatency: (valueMs: number) => void
    /** 上报业务异常（Counter，按 endpoint + error_type）。 */
    recordBusinessError: (endpoint: string, errorType: string) => void
    /** 上报 TTFT 首 token 延迟（秒，Histogram，按 model + endpoint）。 */
    recordTtft: (
      model: string,
      endpoint: string,
      ttftSec: number,
      result: 'success' | 'error',
    ) => void
    /** 上报 TTFT 告警（Counter）。 */
    recordTtftAlert: () => void
    /** 获取 TTFT 监控统计。 */
    getTtftStats: () => TtftStats
    /**
     * 上报连续包月扣款明细(8.3.1)。一次调用内部按 result 维度
     * 累加 4 个 counter(charged/failed/skipped/trial_extended),
     * 并设置 due_gauge(本次扫扣发现的到期签约数)。
     */
    recordRecurringCharge: (result: {
      scanned: number
      charged: number
      failed: number
      skipped: number
      trialExtended: number
    }) => void
    /**
     * 上报旧事件名(8.3.2)。微信 V3 已迁移到 PAPAY.* / TRANSACTION.*,
     * 旧名(contract.signed / contract.cancelled / recurring.charge.*)
     * 仍兼容处理,但调用此装饰器记录埋点用于后续移除决策。
     */
    recordRecurringWebhookDeprecated: (eventType: string) => void
    // ===== 业务域指标(ihui_*)装饰器:写同一份模块级 ihuiState =====
    recordAuthLoginAttempt: () => void
    recordAuthLoginSuccess: () => void
    recordAuthLoginFailed: (sourceIp: string) => void
    recordAuthJwtIssued: () => void
    recordAuthTokenRevoked: (reason: string) => void
    recordAuth2faUsed: () => void
    recordAuthLoginAnomaly: (reason: string) => void
    recordExamStarted: () => void
    recordExamSubmitted: () => void
    setExamActive: (count: number) => void
    recordExamQuestionUsed: (category: string, by?: number) => void
    recordExamCertificateIssued: () => void
    recordExamScore: (score: number) => void
    setLiveOnline: (roomId: string, count: number) => void
    deleteLiveOnline: (roomId: string) => void
    recordLiveDanmaku: (roomId: string) => void
    recordLiveGiftIncome: (roomId: string, amount: number) => void
    recordLiveStreamDisconnected: () => void
    recordOssUploadBytes: (bytes: number) => void
    recordOssDownloadBytes: (bytes: number) => void
    recordOssRequest: (driver: string) => void
    recordOssError: (driver: string, errorType: string) => void
    setOssStorageStats: (totalBytes: number, totalFiles: number) => void
    recordPaymentAttempt: (channel: string) => void
    recordPaymentSuccess: (channel: string) => void
    recordPaymentRefund: (channel: string) => void
    recordPaymentException: (channel: string, reason: string) => void
    recordPaymentAmount: (channel: string, amountMinorUnits: number) => void
    recordWxpayCallback: () => void
    recordWxpayCallbackSuccess: () => void
    recordWxpayCallbackFailed: () => void
    recordTenantApiCall: (tenantId: string) => void
    recordTenantRateLimit: (tenantId: string) => void
    setTenantResourceUsed: (
      tenantId: string,
      resource: 'api_calls' | 'storage_mb' | 'users',
      value: number,
    ) => void
    setTenantResourceQuota: (
      tenantId: string,
      resource: 'api_calls' | 'storage_mb' | 'users',
      value: number,
    ) => void
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
