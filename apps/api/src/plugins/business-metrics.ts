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
// 号池 provider 的封闭集单一真相源(不在本文件重写一份列表 —— §0.6)
import { RELAY_PROVIDERS } from '../services/relay-account-format.js'
import { PROVIDER_HEALTH_STATUSES, type ProviderHealthStatus } from '@ihui/types'
import {
  classifyClientFamily,
  classifyScanProbe,
  CLIENT_FAMILIES,
  SCAN_PROBE_KINDS,
  type ClientFamily,
  type ScanProbeKind,
} from '../utils/bot-detection.js'

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
 * 13. 访客 PV/UV 聚合(gauge,由 scheduler 的 traffic-stats-hourly 每 60 秒刷新,见
 *     `services/traffic-stats-service.ts`;UV 是按 IP/session 去重的开放集,
 *     **聚合后**才成指标,IP/session 原文永不入标签)：
 *     - ihui_traffic_page_views{window,source}
 *     - ihui_traffic_unique_visitors{window,source}
 *     - ihui_traffic_family_page_views{window,source,client_family}
 *     - ihui_traffic_family_unique_visitors{window,source,client_family}
 *     - ihui_traffic_family_breakdown_truncated{window,source}  (1 = 族分解只是下界)
 *     - ihui_traffic_aggregation_last_success_timestamp_seconds  (0 = 本进程从未聚合成功)
 * 14. 中转号池健康(gauge,由 scheduler 的 relay-pool-gauge 刷新,见
 *     `services/relay-pool-stats-service.ts`;两个池子 = ai_relay_key_pool 的
 *     API key 池 + ai_relay_account_pool 的账号池。健康态是**封闭四档**
 *     (unknown/healthy/degraded/down,唯一份见本文件 RELAY_POOL_HEALTH_STATES),
 *     逐档开零基线 ⇒ 面板读到 down 是"库里真是 down",不会与"埋点没接"同形;
 *     key/账号展示标签经 sanitizeIhuiLabel 洗 + 碰撞计数,基数帽同全族纪律):
 *     - ihui_relay_key_pool_health_state{provider_code,key}        (0..3,越大越坏)
 *     - ihui_relay_key_pool_schedulable{provider_code,key}         (1 = 选路选得到它)
 *     - ihui_relay_key_pool_health_age_seconds{provider_code,key}  (距上次健康检查)
 *     - ihui_relay_key_pool_keys{provider_code,state}              (每 provider 每态 key 数)
 *     - ihui_relay_key_pool_schedulable_keys{provider_code}        (每 provider 可用 key 数)
 *     - ihui_relay_account_pool_health_state{provider_code,account}        (0..3)
 *     - ihui_relay_account_pool_schedulable{provider_code,account}         (0/1)
 *     - ihui_relay_account_pool_schedulable_accounts{provider_code}        (每 provider 可调度账号数,与 key 族 schedulable_keys 同族同节拍)
 *     - ihui_relay_account_pool_enabled_accounts{provider_code}            (每 provider is_enabled 账号数 —— 没有它,"可调度 0"与"压根没号"同形)
 *     - ihui_relay_account_pool_accounts{provider_code}                    (每 provider 账号行数,含停用)
 *     - ihui_relay_account_pool_zero_capacity{provider_code}               (1 = 有 enabled 号但可调度 0 ⇒ 账号池回落正在静默发生)
 *     - ihui_relay_upstream_fallback_total{reason}                          (静默回落计数;reason 封闭四档,见 RELAY_UPSTREAM_FALLBACK_REASONS)
 *     - ihui_relay_stream_interrupt_total{provider_code}                    (上游流没说完就断的计数;provider 封闭四档=RELAY_PROVIDERS)
 *     - ihui_relay_account_pool_consecutive_failures{provider_code,account}
 *     - ihui_relay_account_pool_total_calls{provider_code,account}         (累计转发调用)
 *     - ihui_relay_account_pool_token_expires_in_seconds{provider_code,account} (可为负 = 已过期)
 *     - ihui_relay_account_pool_refresh_age_seconds{provider_code,account}
 *     - ihui_relay_key_pool_refresh_last_success_timestamp_seconds / _account_pool_  (0 = 从未刷新成功)
 *     - ihui_relay_key_pool_rows_skipped_total / _label_collisions_total  (账号池同族两枚)
 *
 * 路由通过 server.recordFunnel / recordApiCall / recordOrder / recordPayment / recordAiCall
 * 及新增的 record* 系列装饰器上报。
 *
 * 2026-10-18 埋点实接核对(现读,不是宣称):上面那句"路由通过 …上报"对这三族曾经只是
 * 契约文字、全仓零调用点。现已接到真实链路,射程如下 ——
 * - `business_funnel_total`：`register` 由自助注册端点上报(`routes/auth.ts` 的
 *   POST /auth/register、`routes/auth-extended.ts` 的 POST /auth/register/email 与
 *   POST /sms-proxy/register)。`channel` 这些入口没有真实渠道入参 ⇒ 一律落
 *   `FUNNEL_DEFAULT_CHANNEL`,不编渠道名。**`activate` 无任何代码路径可报**:
 *   `users` 表没有激活列(`packages/database/src/schema/users.ts` 的 status 只有
 *   0=禁用/1=正常/3=注销,且创建即 1),不存在"激活"这一迁移 ⇒ 该 stage 恒为 0 是
 *   "没有这个事件源",不是"没发生过"。**`paid` 未接**:漏斗按人头计,而支付回调
 *   链上判"该用户是否首次付费"要新增一次 DB 读(= 给资金链路添新的失效模式),
 *   不在"只观察、不改控制流"的额度内 ⇒ 该 stage 同样没有埋点。
 * - `business_orders_total` / `business_payments_total`：见
 *   `recordFunnelSample` 一段的写入实现与 `services/order-service.ts` 的五个调用点
 *   (pending / paid / cancelled / refunded 四个状态迁移 + attempt / success / refund
 *   三个支付档口)。
 *
 * AI 那一族的真实收口不在路由里,而在 `plugins/ai-cost.ts` 的 `recordAiCost()`(所有 AI
 * 成本调用方都汇到它),因此由它单点桥接到本文件的模块级 AI 采样入口
 * `recordAiCallSample()` —— 装饰器 `recordAiCall` 与桥接走的是同一个实现、同一份状态,
 * 不另立第二套标签形状(AGENTS §0.6 单一真相源)。
 */

/**
 * 漏斗阶段封闭枚举 —— 文档第 1 条的 `register|activate|paid` 即这一份。
 * 必须是**运行时数组**而非纯类型:渲染侧要逐枚举值开零基线(见
 * `seedFunnelClosedEnumBaseline`),类型编译期就没了。`FunnelStage` 由它派生,
 * 不得再抄第二份(AGENTS §0.6 单一真相源)。
 */
export const FUNNEL_STAGES = ['register', 'activate', 'paid'] as const
export type FunnelStage = (typeof FUNNEL_STAGES)[number]
/**
 * `recordFunnel` 未显式传 channel 时的落点。渠道本身是**开放集**(入参是任意串,
 * 全仓无封闭声明)⇒ 基线只开这个源码里已知存在的缺省档,不编造渠道名。
 */
export const FUNNEL_DEFAULT_CHANNEL = 'default'

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

/**
 * 封闭枚举零基线(2026-10-17 立)。本端点是**进程内存快照**,重启即清空:某个枚举值
 * 在还没发生任何事件之前(含刚重启、含埋点压根没人调)只有 `# HELP`/`# TYPE` 两行、
 * 零条样本 ⇒ Prometheus 里 series=0 ⇒ Grafana 面板恒显 "No data",而"没人发生过"与
 * "指标坏了"在面板上同形(实测 business_funnel_total 等族即此型)。
 * 对**标签值封闭且已在源码里声明**的族,逐枚举值开一条 0 样本 —— 0 才是"没发生"的真相。
 * 基线走真实自增用的同一条计数器路径(`counterInc` / `ihuiCounterInc`,`by=0`),
 * 所以后续真实事件是把这条 0 顶成 1,不是再开一条 ⇒ 不重复计数。
 * 标签值为**开放集**的族(tenant_id / source_ip / 试卷 category / vendor+model)
 * 一律不开基线:编造 `tenant_id="unknown"` 比 "No data" 更坏。
 */
function seedFunnelClosedEnumBaseline(metrics: BusinessMetrics): void {
  for (const stage of FUNNEL_STAGES) {
    counterInc(metrics.funnel, `${stage}|${FUNNEL_DEFAULT_CHANNEL}`, 0)
  }
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
type AiTokenDirection = 'input' | 'output'
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

/**
 * 存储驱动封闭枚举 —— 全仓唯一一份。`routes/oss.ts` 的 `ossDriverTypeSchema`
 * 与 `/oss/drivers` 文档 schema 都从这里派生(原先是同一串字面量抄两处,必漂)。
 * 住在指标文件是因为只有渲染侧需要"逐枚举值开零基线";它不引任何应用模块,
 * 由 oss 路由反向 import ⇒ 不形成循环依赖。
 */
export const OSS_DRIVER_TYPES = [
  'local',
  'aliyun-oss',
  'tencent-cos',
  'qiniu',
  's3',
  'minio',
] as const
export type OssDriverType = (typeof OSS_DRIVER_TYPES)[number]

/**
 * OSS `error_type` 标签口径:HTTP 状态码族 → 标签值。onResponse 钩子写样本与
 * 零基线开样本都走 `ossErrorTypeFor`,这样"基线列出的值"与"真实会写出的值"同源
 * (用例 B6 用真请求把这条锁上)。
 */
const OSS_ERROR_TYPES = ['status_4xx', 'status_5xx'] as const

/**
 * HTTP 状态码族 → 标签值的唯一实现(2026-10-23 抽出)。
 * OSS 的 `error_type` 与流量族的 `status_class` 用的是同一把尺子,这里必须只有一份
 * (§0.6:同类判据第二份必然漂移)。取值总:任何状态码都落进 1..5 五档之一,
 * 不产生枚举外的新序列 ⇒ 零基线列出的键与钩子写出的键同源。
 */
const STATUS_CLASSES = [
  'status_1xx',
  'status_2xx',
  'status_3xx',
  'status_4xx',
  'status_5xx',
] as const
type StatusClass = (typeof STATUS_CLASSES)[number]

function statusClassFor(statusCode: number): StatusClass {
  const bucket = Math.min(5, Math.max(1, Math.floor(statusCode / 100)))
  return STATUS_CLASSES[bucket - 1] as StatusClass
}

function ossErrorTypeFor(statusCode: number): string {
  return statusClassFor(statusCode)
}

/**
 * 登录风控命中原因封闭集。出处两条同向:本文件 `authLoginAnomalyTotal` 的键注释
 * (deny/challenge/review/lockout,四个,无省略号)与 `routes/auth.ts` 里
 * `recordAuthLoginAnomaly(...)` 仅有的四个字面量。写入函数入参用它收窄,
 * 新增原因必须改这份数组才编得过 ⇒ 基线与标签集不会各活各的。
 * 对照 `authTokenRevokedTotal`(注释带 `...`,原因值由调用方按业务随意传)—— 那是开放集。
 */
export const AUTH_LOGIN_ANOMALY_REASONS = ['deny', 'challenge', 'review', 'lockout'] as const
export type AuthLoginAnomalyReason = (typeof AUTH_LOGIN_ANOMALY_REASONS)[number]

/**
 * PV/UV 聚合窗口的封闭枚举(2026-10-23 立)。有界 ⇒ 可以做标签。
 * 数组次序即基线次序;新增窗口必须同时给 `TRAFFIC_WINDOWS` 里这个值一个 SQL 侧
 * 的小时数(见 services/traffic-stats-service.ts 的 `TRAFFIC_WINDOW_HOURS`),
 * 否则新窗口只会有 0 基线、永远不会被刷新。
 */
export const TRAFFIC_WINDOWS = ['1h', '24h'] as const
export type TrafficWindow = (typeof TRAFFIC_WINDOWS)[number]

/**
 * PV/UV 聚合来源表。同样是**有界**维度(表名不会由请求决定)。
 * 两表的 UV 口径不同,看盘别混着比:
 *  - `api_logs`:UV = 去重来源 IP(每个 /api 请求都算一次 PV,含机器人与探测);
 *  - `visit_logs`:UV = 去重 coalesce(session_id, ip)(只有前端埋点上报的页面访问)。
 * 口径写在这条注释与渲染侧的 `# HELP` 里,单一真相源 = `TRAFFIC_SOURCE_UV_LABEL`。
 */
export const TRAFFIC_SOURCES = ['api_logs', 'visit_logs'] as const
export type TrafficSource = (typeof TRAFFIC_SOURCES)[number]

/**
 * 各来源表的 UV 口径(渲染侧 `# HELP` 与面板描述都引这一份,不在两处各抄一遍)。
 * 键集必须与 `TRAFFIC_SOURCES` 逐字相同 —— 由 `services/traffic-stats-service.ts`
 * 的用例 G3 用 `Object.keys` 对账锁住。
 */
const TRAFFIC_SOURCE_UV_LABEL: Record<TrafficSource, string> = {
  api_logs: 'UV = distinct server-observed ip over /api requests (includes bots and probes)',
  visit_logs: 'UV = distinct coalesce(session_id, ip) over reported page visits',
}

/** 一次聚合样本(族维用 `Partial`,缺省族 = 该窗口内该族一次也没出现)。 */
export interface TrafficGaugeSample {
  window: TrafficWindow
  source: TrafficSource
  pageViews: number
  uniqueVisitors: number
  familyPageViews?: Partial<Record<ClientFamily, number>>
  familyUniqueVisitors?: Partial<Record<ClientFamily, number>>
  /** true = 族分解因 UA 种类数超预算而被截断 ⇒ 族值只是下界(不许悄悄少报) */
  familyBreakdownTruncated?: boolean
  /** 本次聚合成功完成的时刻(ms);传 0/不传 = 不推进新鲜度戳 */
  aggregatedAtMs?: number
}

/**
 * 中转号池健康态封闭四档 —— **派生自唯一真相源**(§0.6/§22c,守门 200 裁决:
 * 并表不重述)。档位本体住在 `packages/types/src/ai.ts` 的
 * `PROVIDER_HEALTH_STATUSES`(落库列 health_status + REST 字段 healthStatus +
 * 前端徽章三重对外契约),本处只做指标渲染侧的别名导出(逐档开零基线需要,
 * 与 OSS_DRIVER_TYPES 同例),不再逐字重述档位。
 *
 * 库列是 varchar(16) ⇒ 运行期**必须**过这道闸:枚举外的历史脏值不进标签、
 * 不进数值,由调用方计入 rows_skipped(显式丢失,不悄悄少报)。
 */
export const RELAY_POOL_HEALTH_STATES = PROVIDER_HEALTH_STATUSES
export type RelayPoolHealthState = ProviderHealthStatus

/**
 * 健康态 → 数值(单调:越大越坏)。告警阈值因此可以直接写 `> 2`(= degraded 及以上),
 * 不需要在 PromQL 里维护字符串排序。
 */
export const RELAY_POOL_HEALTH_STATE_VALUE: Record<RelayPoolHealthState, number> = {
  unknown: 0,
  healthy: 1,
  degraded: 2,
  down: 3,
}

export function isRelayPoolHealthState(value: unknown): value is RelayPoolHealthState {
  return (
    typeof value === 'string' && (RELAY_POOL_HEALTH_STATES as readonly string[]).includes(value)
  )
}

/**
 * 上游转发的**静默回落**原因(封闭四档,唯一份)。
 *
 * 立因:这两处回退点此前既无日志也无计数 —— "号池打光"与"上游一切正常"在观面上
 * 同形(AGENTS §0.9 同型缺陷:判据没被真跑到就没有)。本枚举把"为什么回落"变成
 * 有界标签:开放集(模型名/userId)一律不入标签,细节只在 warn 日志里带。
 * - `channel_query_error`      selectChannelCandidates 抛错(key 池压根没探到)
 * - `no_key_pool_candidates`   key 池候选为 0 ⇒ 转投账号池
 * - `account_pool_declined`    账号池返回 null(无 provider/无候选/参数不支持/内部异常)
 * - `account_pool_threw`       账号池调用在承载层直接抛错(被承载层 catch 收口)
 */
export const RELAY_UPSTREAM_FALLBACK_REASONS = [
  'channel_query_error',
  'no_key_pool_candidates',
  'account_pool_declined',
  'account_pool_threw',
] as const
export type RelayUpstreamFallbackReason = (typeof RELAY_UPSTREAM_FALLBACK_REASONS)[number]

/**
 * 一个池子里按 provider 折叠的容量三档(2026-10-26 立)。
 * 唯一生产者 = `relay-pool-stats-service.ts` 的 `foldRelayPoolCapacity()`(直接吃原始行,
 * 与 gauge 的样本折叠共用同一把 `isRelayPoolRowSchedulable` 尺子);本文件只渲染数值、
 * 不再算第二遍(AGENTS §0.6)。三档缺一不可:`schedulable=0` 单独看不出是
 * "号被临时摘光"(enabled>0 ⇒ 容量归零)还是"这个 provider 压根没号"(total=0)。
 */
export interface RelayPoolProviderCapacity {
  providerCode: string
  /** 该 provider 的池行数(含停用、含健康态脏值行) */
  totalRows: number
  /** is_enabled = true 的行数 */
  enabledRows: number
  /** 同 `isRelayPoolRowSchedulable` 口径的行数(启用 ∧ 未被临时摘除) */
  schedulableRows: number
}

/** key 池一行的投影(标签是**未洗**的原始拼接,清洗与撞检在 setter 里做)。 */
export interface RelayPoolKeySample {
  providerCode: string
  /** 展示标签,约定 `${name}-p${priority}`(name 不唯一,撞了由 collisions 计数显式可见) */
  key: string
  healthState: RelayPoolHealthState
  schedulable: boolean
  /** 距上次健康检查的秒数;null = 从未检查过 ⇒ 不发这一序列(没有"编一个 0"的选项) */
  healthAgeSeconds: number | null
}

/** 账号池一行的投影(account = uid,provider+uid 有唯一约束 ⇒ 不会撞)。 */
export interface RelayPoolAccountSample {
  providerCode: string
  account: string
  healthState: RelayPoolHealthState
  schedulable: boolean
  consecutiveFailures: number
  totalCalls: number
  /** token 距过期秒数;null = 库里无过期时刻。**可为负**(负 = 已过期) */
  tokenExpiresInSeconds: number | null
  /** 距上次成功刷新的秒数;null = 从未刷新过 ⇒ 不发 */
  refreshAgeSeconds: number | null
}

/**
 * 一次号池快照(set 语义:整组清空后重写,键消失 = 行被删/被摘,不留给幽灵序列)。
 * 两个数组都**始终在场**(空数组 = 池子真空,与"查询失败"靠新鲜度戳区分:
 * 失败时调用方压根不调本函数,旧值原样保留)。
 */
export interface RelayPoolGaugeSample {
  keys: RelayPoolKeySample[]
  accounts: RelayPoolAccountSample[]
  /**
   * 账号池按 provider 折叠的容量(2026-10-26 立,唯一生产者 = stats 侧
   * `foldRelayPoolCapacity()`,它直接吃原始行 ⇒ 停用行/脏健康态行都算得进来,
   * 而 `accounts` 样本只含健康态在词表内的行)。缺省 = 调用方没给 ⇒ **不发序列**
   * (不拿 0 冒充"容量归零",也不冒充"有号";§0.3)。
   * key 池的 provider 折叠仍在 setter 内现算(与既有 `ihui_relay_key_pool_keys` 同源,
   * 不改它是为了不把已装车的折叠挪成两遍)。
   */
  accountCapacity?: RelayPoolProviderCapacity[]
  /** 刷新成功时刻(ms);两个池各推进自己的新鲜度戳 */
  refreshedAtMs?: number
  /** 调用方已判定的显式丢失(健康态脏值 / 标签撞车),原样加进计数器 */
  keyRowsSkipped?: number
  keyLabelCollisions?: number
  accountRowsSkipped?: number
  accountLabelCollisions?: number
}

const ihuiState = {
  // ---- auth 7 ----
  authLoginAttemptTotal: 0,
  authLoginSuccessTotal: 0,
  /** key: source_ip(开放集:每个来源 IP 都不同,无封闭枚举 ⇒ 不开零基线) */
  authLoginFailedTotal: new Map<string, number>(),
  authJwtIssuedTotal: 0,
  /**
   * key: reason(refresh_rotation/logout/reuse_detected/force_logout/session_revoke/...)
   * —— 出处注释自带省略号,且 `revokeRefreshToken(token, reason = string)` 收任意串,
   * 属开放集 ⇒ 不开零基线(编造原因值比 "No data" 更坏)。
   */
  authTokenRevokedTotal: new Map<string, number>(),
  auth2faUsedTotal: 0,
  /** key: reason —— 封闭集,唯一真相源见 `AUTH_LOGIN_ANOMALY_REASONS`(逐值开零基线) */
  authLoginAnomalyTotal: new Map<string, number>(),
  // ---- exam 7 ----
  examStartedTotal: 0,
  examSubmittedTotal: 0,
  /** Gauge:pending(近24h started)的 exam_records 数,scheduler 定时刷新 */
  examActiveTotal: 0,
  /** key: category —— 试卷 categoryId 由库里的行决定,是开放集,不开零基线 */
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
  /** key: driver —— 封闭集,唯一真相源见 `OSS_DRIVER_TYPES`(逐值开零基线) */
  ossRequestsTotal: new Map<string, number>(),
  /** key: driver|error_type —— driver 封闭(OSS_DRIVER_TYPES),error_type 封闭(OSS_ERROR_TYPES) */
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
  // ---- traffic 2(访客 vs 机器人,2026-10-23 立) ----
  /**
   * key: client_family|status_class —— 两维都是源码里的封闭集
   * (CLIENT_FAMILIES / STATUS_CLASSES),所以逐值开 0 基线;UA 原文、IP、
   * 路由模板一律不入标签(开放集,见本文件"开放集不开零基线"那条纪律)。
   */
  trafficRequestsTotal: new Map<string, number>(),
  /** key: scan_kind|client_family —— 两维同样封闭(SCAN_PROBE_KINDS / CLIENT_FAMILIES) */
  trafficScanHitsTotal: new Map<string, number>(),
  // ---- traffic 3(PV/UV 聚合 Gauge,2026-10-23 立) ----
  // UV 是**开放集**(IP / session 无限),所以它从来不许当标签:聚合在服务端做完,
  // 只把"一个窗口里有多少个"发成单值 gauge;标签只留有界维度(window / source / family)。
  // 状态只活在进程内存里 ⇒ **重启归零**:本次刻意接受这个代价,后果是面板在大屏上
  // 只能看"本进程起来之后"的滚动窗口,历史 PV/UV 要回 `api_logs` / `visit_logs` 查。
  // 之所以不建预聚合表:另一路会话在飞,建表要出 drizzle 迁移、编号会撞(禁改清单内)。
  // 刷新方 = scheduler 的 `traffic-stats-hourly`(2026-10-23 起每 60 秒;键名为历史遗留),
  // **不在 scrape 路径、也不在请求路径**。大屏另有实时快照(getTrafficLiveSnapshot),不读本 gauge。
  /** key: window|source */
  trafficPageViews: new Map<string, number>(),
  /** key: window|source */
  trafficUniqueVisitors: new Map<string, number>(),
  /** key: window|source|client_family —— family 取自 classifyClientFamily(封闭集) */
  trafficFamilyPageViews: new Map<string, number>(),
  /** key: window|source|client_family —— 上界口径:同一 IP 跨两把 UA 会重复计 */
  trafficFamilyUniqueVisitors: new Map<string, number>(),
  /** key: window|source —— 1 = 族分解被 UA 种类预算截断(族值只剩下界,必须显式可见) */
  trafficFamilyBreakdownTruncated: new Map<string, number>(),
  // ---- relay 号池 2(key 池 + 账号池,2026-10-23 立) ----
  // 同 PV/UV 的架构决策:状态在模块级单例 ⇒ 重启归零,只反映"本进程起来之后"
  // 的池子快照;池子的完整历史在 admin 的号池管理页,不建预聚合表(那要出迁移)。
  // 刷新方 = scheduler 的 `relay-pool-gauge`(每5分,两张表各一条不带 where 的
  // 全量 SELECT —— 池子是运营级小表,现读 29/1 行,代价与 tenant_quotas 同档),
  // **不在 scrape 路径、也不在请求路径**。查询失败时本服务压根不调 setter ⇒
  // 旧值原样留着,新鲜度戳不推进,"陈"由 gauge 自己说,不把失败读成空池。
  /** key: provider_code|key —— 健康态数值 0..3(封闭四档,见 RELAY_POOL_HEALTH_STATES) */
  relayKeyHealth: new Map<string, number>(),
  /** key: provider_code|key —— 1 = 选路选得到它(isEnabled ∧ ¬tempUnschedulable) */
  relayKeySchedulable: new Map<string, number>(),
  /** key: provider_code|key —— 距上次健康检查的秒数;从未检查过的 key 不发这一序列 */
  relayKeyHealthAge: new Map<string, number>(),
  /** key: provider_code|state —— 每 provider 每态 key 数(折叠值,由 setter 现算) */
  relayKeyByProviderState: new Map<string, number>(),
  /** key: provider_code —— 每 provider 可用 key 数(折叠值;sum 起来就是池子头条数字) */
  relayKeySchedulableByProvider: new Map<string, number>(),
  /** key: provider_code|account(uid)—— 健康态数值 0..3 */
  relayAccountHealth: new Map<string, number>(),
  /** key: provider_code|account(uid)—— 1 = 选路选得到它 */
  relayAccountSchedulable: new Map<string, number>(),
  /** key: provider_code —— 每 provider 可调度账号数(与 relayKeySchedulableByProvider 同族同节拍) */
  relayAccountSchedulableByProvider: new Map<string, number>(),
  /** key: provider_code —— 每 provider 的 is_enabled 账号数(没有它,"可调度 0"与"没号"同形) */
  relayAccountEnabledByProvider: new Map<string, number>(),
  /** key: provider_code —— 每 provider 的账号行数(含停用/脏健康态行) */
  relayAccountRowsByProvider: new Map<string, number>(),
  /** key: provider_code —— 1 = 有 enabled 号但可调度 0(账号池回落正在静默发生) */
  relayAccountZeroCapacityByProvider: new Map<string, number>(),
  /** key: reason —— 静默回落计数(封闭四档,见 RELAY_UPSTREAM_FALLBACK_REASONS;逐值开零基线) */
  relayUpstreamFallbackTotal: new Map<string, number>(),
  /** key: provider_code —— 上游流未正常收尾的计数(封闭四档=RELAY_PROVIDERS;断流不得算健康) */
  relayStreamInterruptTotal: new Map<string, number>(),
  /** key: provider_code|account(uid)—— 连续转发失败次数(转发层熔断计数) */
  relayAccountFailures: new Map<string, number>(),
  /** key: provider_code|account(uid)—— 累计转发调用次数(bigint → number) */
  relayAccountTotalCalls: new Map<string, number>(),
  /** key: provider_code|account(uid)—— token 距过期秒数,**可为负**(负 = 已过期,这正是要看的) */
  relayAccountTokenExpiresIn: new Map<string, number>(),
  /** key: provider_code|account(uid)—— 距上次成功刷新 token 的秒数;从未刷新过不发 */
  relayAccountRefreshAge: new Map<string, number>(),
  /** 健康态落在封闭四档之外的行数(库是 varchar,历史脏值必须显式可见,不许悄悄丢) */
  relayKeyRowsSkipped: 0,
  relayAccountRowsSkipped: 0,
  /** 标签清洗后仍撞车的条数(name+priority 不唯一,现读 key 池 29 行有 13 个重复前缀) */
  relayKeyLabelCollisions: 0,
  relayAccountLabelCollisions: 0,
  /** 各池最后一次刷新成功的 unix 秒;0 = 本进程从未刷新成功(≠ 池子是空的) */
  relayKeyRefreshedAtSeconds: 0,
  relayAccountRefreshedAtSeconds: 0,
  /** 上次聚合成功完成的 unix 秒。0 = 本进程从未跑成过(与"这段时间真没访客"不同形) */
  trafficAggregatedAtSeconds: 0,
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

/**
 * ihui_* 侧的封闭枚举零基线(口径与设计理由见 `seedFunnelClosedEnumBaseline` 头注):
 * 只给"标签值在源码里已声明为封闭集"的族逐值开 0 —— auth 风控原因、oss 驱动、
 * oss 驱动×错误类型。走 `ihuiCounterInc`(与写入函数同一个入口,含基数护栏),
 * `by=0` ⇒ 真实事件顶替这条 0,不另开序列、不重复计数。
 */
function seedIhuiClosedEnumBaseline(): void {
  for (const reason of AUTH_LOGIN_ANOMALY_REASONS) {
    ihuiCounterInc(ihuiState.authLoginAnomalyTotal, reason, 0)
  }
  for (const driver of OSS_DRIVER_TYPES) {
    ihuiCounterInc(ihuiState.ossRequestsTotal, driver, 0)
    for (const errorType of OSS_ERROR_TYPES) {
      ihuiCounterInc(ihuiState.ossErrorsTotal, `${driver}|${errorType}`, 0)
    }
  }
  for (const family of CLIENT_FAMILIES) {
    for (const statusClass of STATUS_CLASSES) {
      ihuiCounterInc(ihuiState.trafficRequestsTotal, `${family}|${statusClass}`, 0)
    }
    for (const kind of SCAN_PROBE_KINDS) {
      ihuiCounterInc(ihuiState.trafficScanHitsTotal, `${kind}|${family}`, 0)
    }
  }
  // relay 上游回落计数:reason 是源码里的封闭四档 ⇒ 逐值开 0。
  // 这一档不开 0 就等于没装 —— "从来没回落过"与"埋点没接"在面板上会同形(本次要根治的正是它)。
  for (const reason of RELAY_UPSTREAM_FALLBACK_REASONS) {
    ihuiCounterInc(ihuiState.relayUpstreamFallbackTotal, reason, 0)
  }
  // 上游断流计数:provider 同属封闭集(RELAY_PROVIDERS,单一真相源在 relay-account-format)。
  // 不开 0 的话,"从没断过流"与"埋点没接"在面板上同形 —— 与回落计数同一批立的规矩。
  for (const provider of RELAY_PROVIDERS) {
    ihuiCounterInc(ihuiState.relayStreamInterruptTotal, provider, 0)
  }
  // traffic 3(PV/UV 聚合 Gauge):窗口 × 来源 × (族) 全组合预先开线。
  // **只开 0,不开任何"看起来像数据"的值** —— gauge 的 0 在这里表示"还没测到/确实为 0",
  // 而"从来没测过"另有出口(`ihui_traffic_aggregation_last_success_timestamp_seconds` = 0)。
  for (const window of TRAFFIC_WINDOWS) {
    for (const source of TRAFFIC_SOURCES) {
      const key = `${window}|${source}`
      ihuiState.trafficPageViews.set(key, 0)
      ihuiState.trafficUniqueVisitors.set(key, 0)
      ihuiState.trafficFamilyBreakdownTruncated.set(key, 0)
      for (const family of CLIENT_FAMILIES) {
        ihuiState.trafficFamilyPageViews.set(`${key}|${family}`, 0)
        ihuiState.trafficFamilyUniqueVisitors.set(`${key}|${family}`, 0)
      }
    }
  }
}

// 模块加载即开基线:本族状态是模块级单例(不随插件注册/关闭而重建),
// 只在这里开一次 + 在 resetIhuiState 末尾重开,即可保证任何时刻都有样本。
seedIhuiClosedEnumBaseline()

// ============================== 漏斗 / 订单 / 支付(business_* 三族) ==============================

/**
 * `business_funnel_total` / `business_orders_total` / `business_payments_total` 三族的
 * 唯一写入实现(2026-10-18 接线)。
 *
 * 立因:此前这三个族**只有装饰器定义、declare-module 条目和头注那句"路由通过
 * …recordFunnel/recordOrder/recordPayment… 上报",全仓零调用点** ——
 * `business-funnel.json` 的 stage/type/status 三块面板读到的 0 是"埋点压根没人调",
 * 与"这段时间没发生过"在面板上同形,运维分不出来。本次把这些声明的埋点接到真实链路。
 *
 * 为什么沿用回调槽注入(`recordHlsTranscodeSample` 那套既有范式,不是新发明第四种机制):
 * 订单/支付三处的真实收口在 `services/order-service.ts` 的 `placeOrder` /
 * `completeOrder` / `completeOrderWithSaga` / `cancelOrder` / `refundOrder` ——
 * service 层不持有 fastify 实例(与 aiState/ihuiState/hls 的架构决策同型),
 * 而这三族的状态本身是插件闭包 `m` 的字段、`resetAllMetrics` 靠遍历
 * `Object.values(m)` 清零,把状态上移模块级要动 interface,改动面大于收益。
 * ⇒ 插件注册时把自己的写入实现赋给槽,装饰器与桥接**都只调下面这一个实现**,
 * 所以"基线开出的键"与"真实事件写出的键"必然同源(钩子那处 2026-10-17 的教训注记)。
 *
 * 标签纪律(与 ihui_* 同一把尺子,不另立标准):
 * - 标签值一律经本文件唯一洗法 `sanitizeIhuiLabel`:`orders.payType` 是用户可写的
 *   50 字符字符串(`routes/order.ts:152`),一个未转义引号会把**整次 scrape** 打回
 *   (见 `sanitizeAiLabel` 头注同型失效),洗过同时保证 `|` 分隔符不被值里的竖线劈坏;
 * - 序列数走 `ihuiCounterInc` 的 512 上限护栏(超限计入 `ihui_series_dropped_total`)。
 *   注:该 dropped 计数器的 HELP 文案写的是 `ihui_*`,本三族共用它属已知口径外溢,
 *   宁可用同一具计数器,也不复刻第二份基数上限(AGENTS §0.6)。
 * - `safeRecord` 兜底 ⇒ 永不抛(观测层坏了不能把下单/支付回调带崩)。
 */
let funnelRecorder: ((key: string) => void) | null = null
let orderRecorder: ((key: string) => void) | null = null
let paymentRecorder: ((key: string) => void) | null = null

/**
 * 上报一次漏斗事件。`stage` 由 `FUNNEL_STAGES` 收窄(封闭集,唯一真相源);
 * `channel` 是开放集 ⇒ 缺省落 `FUNNEL_DEFAULT_CHANNEL`(调用方没有真实渠道就不要编)。
 */
export function recordFunnelSample(
  stage: FunnelStage,
  channel: string = FUNNEL_DEFAULT_CHANNEL,
): void {
  safeRecord('recordFunnelSample', () => {
    funnelRecorder?.(`${stage}|${sanitizeIhuiLabel(channel)}`)
  })
}

/**
 * 上报一次订单事件。`type` 取 `orders.order_type` 的**原值**(整数码转字符串):
 * 全仓没有覆盖全部码值的封闭枚举(`db/payment-queries.ts:32` 的取值只写在注释里,
 * `services/commission-service.ts:26-29` 仅私有地登记了 1/2/3/4 四枚)⇒ 抄任何一份
 * 都是第二份清单且必然不全,原值才是不撒谎的标签。
 */
export function recordOrderSample(type: string, status: string): void {
  safeRecord('recordOrderSample', () => {
    orderRecorder?.(`${sanitizeIhuiLabel(type)}|${sanitizeIhuiLabel(status)}`)
  })
}

/**
 * 上报一次支付事件。`status` 词汇不自立:只用 `services/order-service.ts` 在
 * 该处已经写进库的状态迁移档口(attempt / success / refund),与同处已接线的
 * `ihui_payment_attempt|success|refund_total` 三个计数器一一对应。
 */
export function recordPaymentSample(channel: string, status: string): void {
  safeRecord('recordPaymentSample', () => {
    paymentRecorder?.(`${sanitizeIhuiLabel(channel)}|${sanitizeIhuiLabel(status)}`)
  })
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

export function recordAuthLoginAnomaly(reason: AuthLoginAnomalyReason): void {
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

/** 上传字节数(单位 = 字节)。经 server.decorate('recordOssUploadBytes') 暴露为实例方法。 */
function recordOssUploadBytes(bytes: number): void {
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

/**
 * 上报一次入口请求的"客户端族 × 状态码族"。
 * 入参类型已由两个封闭枚举收窄 ⇒ 调用方传不进枚举外的值,基线与真实事件必然同形。
 */
function recordTrafficRequest(family: ClientFamily, statusClass: StatusClass): void {
  safeRecord('recordTrafficRequest', () => {
    ihuiCounterInc(ihuiState.trafficRequestsTotal, `${family}|${statusClass}`)
  })
}

/**
 * 上报一次恶意路径形态命中。族维度记的是**自述**(攻击者把自己伪装成 Googlebot 就会
 * 落进 search-crawler)—— 族面不判真伪,真伪留给看盘的人,判据不越权编一个"spoofed"。
 */
function recordTrafficScanHit(kind: ScanProbeKind, family: ClientFamily): void {
  safeRecord('recordTrafficScanHit', () => {
    ihuiCounterInc(ihuiState.trafficScanHitsTotal, `${kind}|${family}`)
  })
}

/**
 * Gauge:写入一次"窗口 × 来源"的 PV/UV 聚合结果(set 语义,不是累加)。
 *
 * 为什么是 gauge 而不是 counter:UV 按定义不可累加(同一 IP 两个窗口都算一个人),
 * 而"滚动窗口里的当前值"正是 gauge 的形状 —— 面板直接读瞬时值,不做 rate/increase。
 *
 * 基数纪律(与本文件那条"开放集不入标签"同源):
 * - `window` / `source` 只接受 `TRAFFIC_WINDOWS` / `TRAFFIC_SOURCES` 里的字面值,
 *   `client_family` 只接受 `CLIENT_FAMILIES` 里的字面值(= `classifyClientFamily` 的值域);
 *   枚举外的键**直接丢弃**,所以这三张图的结构键数恒定 = 2×2(×12),不会被打爆;
 * - IP / session / UA 原文一律不进这里(调用方传不进来:入参只有数字)。
 *
 * 缺省族必须归 0:否则上一小时的族值会一直挂在面板上,把"这一小时没人来"读成"还有人"。
 */
export function setTrafficGaugeSample(sample: TrafficGaugeSample): void {
  safeRecord('setTrafficGaugeSample', () => {
    if (!isTrafficWindow(sample.window) || !isTrafficSource(sample.source)) return
    const key = `${sample.window}|${sample.source}`
    ihuiState.trafficPageViews.set(key, trafficGaugeInt(sample.pageViews))
    ihuiState.trafficUniqueVisitors.set(key, trafficGaugeInt(sample.uniqueVisitors))
    ihuiState.trafficFamilyBreakdownTruncated.set(key, sample.familyBreakdownTruncated ? 1 : 0)
    for (const family of CLIENT_FAMILIES) {
      ihuiState.trafficFamilyPageViews.set(`${key}|${family}`, 0)
      ihuiState.trafficFamilyUniqueVisitors.set(`${key}|${family}`, 0)
    }
    if (sample.familyPageViews) {
      for (const [family, value] of Object.entries(sample.familyPageViews)) {
        if (!isClientFamily(family)) continue
        ihuiState.trafficFamilyPageViews.set(`${key}|${family}`, trafficGaugeInt(value))
      }
    }
    if (sample.familyUniqueVisitors) {
      for (const [family, value] of Object.entries(sample.familyUniqueVisitors)) {
        if (!isClientFamily(family)) continue
        ihuiState.trafficFamilyUniqueVisitors.set(`${key}|${family}`, trafficGaugeInt(value))
      }
    }
    const at = sample.aggregatedAtMs
    if (typeof at === 'number' && Number.isFinite(at) && at > 0) {
      ihuiState.trafficAggregatedAtSeconds = Math.floor(at / 1000)
    }
  })
}

/** 非负整数(浮点向下取整;NaN/负数归 0)。 */
function trafficGaugeInt(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0
  return Math.floor(value)
}

/** 非负 gauge 值(NaN/Infinity 归 0,负数归 0;年龄类只会是正)。 */
function relayGaugeInt(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.floor(value)
}

/** 可负 gauge 值(token 临期:负 = 已过期,正是要看的信号,不许 clamp 掉)。 */
function relaySignedInt(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.floor(value)
}

/** 基数护栏(set 语义版):超上限的新序列不录,计入 seriesDroppedTotal。 */
function relayGaugeSet(map: Map<string, number>, key: string, value: number): void {
  if (map.has(key) || map.size < IHUI_SERIES_CAP) {
    map.set(key, value)
    return
  }
  ihuiState.seriesDroppedTotal++
}

/**
 * Counter:记一次**静默回落**(2026-10-26 立)。
 *
 * 只在 `RELAY_UPSTREAM_FALLBACK_REASONS` 这四档上记账:不在枚举内的入参一律丢弃并计入
 * `ihui_series_dropped_total`(基数护栏 —— 回落点的 model/userId 都是开放集,
 * 进了标签就是下一个炸基数面)。永不抛(safeRecord)。
 */
export function recordRelayUpstreamFallback(reason: RelayUpstreamFallbackReason): void {
  safeRecord('recordRelayUpstreamFallback', () => {
    if (!(RELAY_UPSTREAM_FALLBACK_REASONS as readonly string[]).includes(reason)) {
      ihuiState.seriesDroppedTotal++
      return
    }
    ihuiCounterInc(ihuiState.relayUpstreamFallbackTotal, reason)
  })
}

/**
 * Counter:记一次**上游流未正常收尾**(2026-10-26)。
 *
 * provider 用封闭集 RELAY_PROVIDERS(单一真相源在 relay-account-format);不在集内的入参
 * 丢弃并计基数丢弃,不让任意字符串进标签。判据(什么算断流)住转发层,这里只管记账。
 */
export function recordRelayStreamInterrupt(providerCode: string): void {
  safeRecord('recordRelayStreamInterrupt', () => {
    if (!(RELAY_PROVIDERS as readonly string[]).includes(providerCode)) {
      ihuiState.seriesDroppedTotal++
      return
    }
    ihuiCounterInc(ihuiState.relayStreamInterruptTotal, providerCode)
  })
}

/** 断流计数现读(观测面/测试用;结构上取不到就是空,不用 0 冒充"没量过") */
export function snapshotRelayStreamInterrupts(): Record<string, number> {
  return Object.fromEntries(ihuiState.relayStreamInterruptTotal.entries())
}

/**
 * Gauge:写入一次中转号池快照(两个池子,set 语义)。
 *
 * 与 `setTrafficGaugeSample` 的三条同源纪律,逐条对应:
 * 1. **整组清空重建**:key 池/账号池的行会被删、被摘、被停用 ⇒ 只 set 不清会留下
 *    幽灵序列(行没了,面板上还挂着旧值)。清空的代价是"刷新失败不能调本函数" ——
 *    那正是调用方的契约(失败不碰 gauge,靠新鲜度戳显式变陈)。
 * 2. **标签必须有界**:provider_code / 健康态四档全封闭;key 的展示标签
 *    (name-pN)是运营自定字符串 ⇒ sanitizeIhuiLabel 洗 + 洗后撞车计数
 *    ( collisions 显式进 counter,不悄悄少一条 key)。
 * 3. **显式丢失两路计数**:调用方判掉的脏健康态行(rowsSkipped)与标签撞车
 *    (labelCollisions)都加进本模块 counter,面板/告警能看见"少了"。
 */
export function setRelayPoolGaugeSample(sample: RelayPoolGaugeSample): void {
  safeRecord('setRelayPoolGaugeSample', () => {
    ihuiState.relayKeyHealth.clear()
    ihuiState.relayKeySchedulable.clear()
    ihuiState.relayKeyHealthAge.clear()
    ihuiState.relayKeyByProviderState.clear()
    ihuiState.relayKeySchedulableByProvider.clear()
    ihuiState.relayAccountHealth.clear()
    ihuiState.relayAccountSchedulable.clear()
    ihuiState.relayAccountSchedulableByProvider.clear()
    ihuiState.relayAccountEnabledByProvider.clear()
    ihuiState.relayAccountRowsByProvider.clear()
    ihuiState.relayAccountZeroCapacityByProvider.clear()
    ihuiState.relayAccountFailures.clear()
    ihuiState.relayAccountTotalCalls.clear()
    ihuiState.relayAccountTokenExpiresIn.clear()
    ihuiState.relayAccountRefreshAge.clear()

    const keyCounts = new Map<string, Map<RelayPoolHealthState, number>>()
    const keySchedulable = new Map<string, number>()
    for (const row of sample.keys) {
      if (!isRelayPoolHealthState(row.healthState)) continue
      const provider = sanitizeIhuiLabel(row.providerCode, 32)
      const key = sanitizeIhuiLabel(row.key, 48)
      const mapKey = `${provider}|${key}`
      if (ihuiState.relayKeyHealth.has(mapKey)) {
        ihuiState.relayKeyLabelCollisions++
        continue
      }
      relayGaugeSet(
        ihuiState.relayKeyHealth,
        mapKey,
        RELAY_POOL_HEALTH_STATE_VALUE[row.healthState],
      )
      relayGaugeSet(ihuiState.relayKeySchedulable, mapKey, row.schedulable ? 1 : 0)
      if (row.healthAgeSeconds !== null) {
        relayGaugeSet(ihuiState.relayKeyHealthAge, mapKey, relayGaugeInt(row.healthAgeSeconds))
      }
      const byState = keyCounts.get(provider) ?? new Map<RelayPoolHealthState, number>()
      byState.set(row.healthState, (byState.get(row.healthState) ?? 0) + 1)
      keyCounts.set(provider, byState)
      if (row.schedulable) {
        keySchedulable.set(provider, (keySchedulable.get(provider) ?? 0) + 1)
      }
    }
    // 折叠值逐档开零基线:provider 出现过 ⇒ 四个态都列(缺的态是 0,不是"没有这一列")
    for (const [provider, byState] of keyCounts) {
      for (const state of RELAY_POOL_HEALTH_STATES) {
        relayGaugeSet(
          ihuiState.relayKeyByProviderState,
          `${provider}|${state}`,
          byState.get(state) ?? 0,
        )
      }
      relayGaugeSet(
        ihuiState.relayKeySchedulableByProvider,
        provider,
        keySchedulable.get(provider) ?? 0,
      )
    }

    for (const row of sample.accounts) {
      if (!isRelayPoolHealthState(row.healthState)) continue
      const provider = sanitizeIhuiLabel(row.providerCode, 32)
      const account = sanitizeIhuiLabel(row.account, 48)
      const mapKey = `${provider}|${account}`
      if (ihuiState.relayAccountHealth.has(mapKey)) {
        ihuiState.relayAccountLabelCollisions++
        continue
      }
      relayGaugeSet(
        ihuiState.relayAccountHealth,
        mapKey,
        RELAY_POOL_HEALTH_STATE_VALUE[row.healthState],
      )
      relayGaugeSet(ihuiState.relayAccountSchedulable, mapKey, row.schedulable ? 1 : 0)
      relayGaugeSet(ihuiState.relayAccountFailures, mapKey, relayGaugeInt(row.consecutiveFailures))
      relayGaugeSet(ihuiState.relayAccountTotalCalls, mapKey, relayGaugeInt(row.totalCalls))
      if (row.tokenExpiresInSeconds !== null) {
        relayGaugeSet(
          ihuiState.relayAccountTokenExpiresIn,
          mapKey,
          relaySignedInt(row.tokenExpiresInSeconds),
        )
      }
      if (row.refreshAgeSeconds !== null) {
        relayGaugeSet(
          ihuiState.relayAccountRefreshAge,
          mapKey,
          relayGaugeInt(row.refreshAgeSeconds),
        )
      }
    }

    // 账号池按 provider 折叠的容量三档(值来自 stats 侧 foldRelayPoolCapacity,本处只渲染)。
    // set 语义已由函数开头的 clear 兜住 ⇒ 上一轮有过、这一轮没出现的 provider 序列自动消失。
    for (const row of sample.accountCapacity ?? []) {
      const provider = sanitizeIhuiLabel(row.providerCode, 32)
      const total = relayGaugeInt(row.totalRows)
      const enabled = relayGaugeInt(row.enabledRows)
      const schedulable = relayGaugeInt(row.schedulableRows)
      relayGaugeSet(ihuiState.relayAccountRowsByProvider, provider, total)
      relayGaugeSet(ihuiState.relayAccountEnabledByProvider, provider, enabled)
      relayGaugeSet(ihuiState.relayAccountSchedulableByProvider, provider, schedulable)
      relayGaugeSet(
        ihuiState.relayAccountZeroCapacityByProvider,
        provider,
        enabled > 0 && schedulable === 0 ? 1 : 0,
      )
    }

    ihuiState.relayKeyRowsSkipped += Math.max(0, Math.floor(sample.keyRowsSkipped ?? 0))
    ihuiState.relayAccountRowsSkipped += Math.max(0, Math.floor(sample.accountRowsSkipped ?? 0))
    ihuiState.relayKeyLabelCollisions += Math.max(0, Math.floor(sample.keyLabelCollisions ?? 0))
    ihuiState.relayAccountLabelCollisions += Math.max(
      0,
      Math.floor(sample.accountLabelCollisions ?? 0),
    )
    const at = sample.refreshedAtMs
    if (typeof at === 'number' && Number.isFinite(at) && at > 0) {
      const seconds = Math.floor(at / 1000)
      ihuiState.relayKeyRefreshedAtSeconds = seconds
      ihuiState.relayAccountRefreshedAtSeconds = seconds
    }
  })
}

// 三个"是不是枚举成员"的判定写成值域检查而非类型断言:运行期输入来自 service 层,
// 而 service 层的值又来自 SQL —— 编译期形状守不住脏数据,标签基数只能在这里收口。
function isTrafficWindow(value: string): value is TrafficWindow {
  return (TRAFFIC_WINDOWS as readonly string[]).includes(value)
}

function isTrafficSource(value: string): value is TrafficSource {
  return (TRAFFIC_SOURCES as readonly string[]).includes(value)
}

function isClientFamily(value: string): value is ClientFamily {
  return (CLIENT_FAMILIES as readonly string[]).includes(value)
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
  ihuiState.trafficRequestsTotal.clear()
  ihuiState.trafficScanHitsTotal.clear()
  ihuiState.trafficPageViews.clear()
  ihuiState.trafficUniqueVisitors.clear()
  ihuiState.trafficFamilyPageViews.clear()
  ihuiState.trafficFamilyUniqueVisitors.clear()
  ihuiState.trafficFamilyBreakdownTruncated.clear()
  ihuiState.trafficAggregatedAtSeconds = 0
  ihuiState.relayKeyHealth.clear()
  ihuiState.relayKeySchedulable.clear()
  ihuiState.relayKeyHealthAge.clear()
  ihuiState.relayKeyByProviderState.clear()
  ihuiState.relayKeySchedulableByProvider.clear()
  ihuiState.relayAccountHealth.clear()
  ihuiState.relayAccountSchedulable.clear()
  ihuiState.relayAccountSchedulableByProvider.clear()
  ihuiState.relayAccountEnabledByProvider.clear()
  ihuiState.relayAccountRowsByProvider.clear()
  ihuiState.relayAccountZeroCapacityByProvider.clear()
  ihuiState.relayAccountFailures.clear()
  ihuiState.relayAccountTotalCalls.clear()
  ihuiState.relayAccountTokenExpiresIn.clear()
  ihuiState.relayAccountRefreshAge.clear()
  ihuiState.relayUpstreamFallbackTotal.clear()
  ihuiState.relayStreamInterruptTotal.clear()
  ihuiState.relayKeyRowsSkipped = 0
  ihuiState.relayAccountRowsSkipped = 0
  ihuiState.relayKeyLabelCollisions = 0
  ihuiState.relayAccountLabelCollisions = 0
  ihuiState.relayKeyRefreshedAtSeconds = 0
  ihuiState.relayAccountRefreshedAtSeconds = 0
  ihuiState.seriesDroppedTotal = 0
  // 清零后必须把封闭枚举的 0 基线重新开回去,否则一次 admin reset / onClose 就把
  // 面板打回 "No data"(与本次要根治的形态同形)。
  seedIhuiClosedEnumBaseline()
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

  // 漏斗阶段的 0 基线:标签值封闭(FUNNEL_STAGES),注册即开线,面板读 0 而非 "No data"。
  seedFunnelClosedEnumBaseline(m)

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
    // 封闭枚举 0 基线必须在清零后重开(resetIhuiState 自己末尾重开 ihui_* 那三份),
    // 否则 admin reset / onClose 一次就把面板打回 "No data"。
    seedFunnelClosedEnumBaseline(m)
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
      // 2026-10-17:改走 recordOssRequest/recordOssError 这两个写入出口(此前钩子内
      // 联 ihuiCounterInc,与出口各写一份标签拼装式 ⇒ 零基线列出的键和钩子写出的键
      // 可能不是同一个)。error_type 口径同样收口到 ossErrorTypeFor,与基线同源。
      if (url.startsWith('/api/files/') || url.startsWith('/api/oss')) {
        const driver = process.env.OSS_DRIVER_TYPE ?? 'local'
        recordOssRequest(driver)
        if (reply.statusCode >= 400) {
          recordOssError(driver, ossErrorTypeFor(reply.statusCode))
        }
      }
      // 访客 vs 机器人(2026-10-23 立):UA 走 bot-detection 的族归一唯一出口,
      // 状态码走 statusClassFor 唯一出口 —— 与零基线开的键同源。
      // 不复用 api_logger 的 buffer 做这件事:它 2xx 按 API_LOG_SAMPLE_RATE 采样,
      // 拿它的样本当计数器底会把真人流量按采样率少算(4xx/5xx 才全量)。
      const uaHeader = request.headers['user-agent']
      const ua = Array.isArray(uaHeader) ? uaHeader[0] : uaHeader
      const family = classifyClientFamily(ua)
      recordTrafficRequest(family, statusClassFor(reply.statusCode))
      const scanKind = classifyScanProbe(url)
      if (scanKind) recordTrafficScanHit(scanKind, family)
    })
  })

  // ===== 现有业务上报装饰器 =====
  // 三个装饰器一律**委托给模块级唯一写入实现**(见 recordFunnelSample 那一段注记),
  // 这样持有 server 的路由链与不持有 server 的 service 链写的是同一份 m、同一份键拼装。
  // 回调槽在注册时赋值:运行期(下单/回调/退款)插件必已注册。
  funnelRecorder = (key) => ihuiCounterInc(m.funnel, key)
  orderRecorder = (key) => ihuiCounterInc(m.orders, key)
  paymentRecorder = (key) => ihuiCounterInc(m.payments, key)
  server.decorate('recordFunnel', (stage: FunnelStage, channel = FUNNEL_DEFAULT_CHANNEL) => {
    recordFunnelSample(stage, channel)
  })
  server.decorate('recordOrder', (type: string, status: string) => {
    recordOrderSample(type, status)
  })
  server.decorate('recordPayment', (channel: string, status: string) => {
    recordPaymentSample(channel, status)
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
  server.decorate('recordAuthLoginAnomaly', (reason: AuthLoginAnomalyReason) =>
    recordAuthLoginAnomaly(reason),
  )
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
    // stage 为封闭集(FUNNEL_STAGES),注册时已逐值开 0 基线 ⇒ 面板读 0 而不是 "No data";
    // channel 只开了缺省档 'default'(渠道是开放集,不编造)。
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
    // 不开 0 基线的理由(2026-10-17 立,2026-10-18 埋点实接后复核仍成立):
    // ① type/status 在源码里没有封闭枚举声明 —— 订单类型是整数码
    // (`db/payment-queries.ts:32` 的 1=membership 2=token …只写在注释里,
    // `services/commission-service.ts:26-29` 只私有登记了 4 枚),edu_orders 另有
    // course|card,各表 status 词表还互不相同(pending|paid|cancelled|refunded / created|paying
    // |paid|failed|cancelled / 6 档退款状态),按哪一份开线都是替全部开一份假集合;
    // channel 同理 —— payType 是用户可写字符串,开不出封闭集。
    // ②(原第 ② 条"`server.recordOrder` 装饰器全仓零调用点"已于 2026-10-18 消解:
    // 三族都有真实写入点了 ⇒ 有事件就有线,没有就是真没发生过。)
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
    // **不开 0 基线**:vendor/model 是开放集(取自 ai_cost_records.provider/model,
    // 用户自带模型配置可控),编一个 vendor 出来等于往大屏里灌一条永不增长的假序列;
    // call_type/status/direction 虽然封闭,但主键 vendor|model 不在就整条键都不存在。
    // 真实写入出口 = ai-cost.ts 的 recordAiCost() 桥接(用例见 business-metrics-ai-bridge.test.ts,
    // 其中 T2 正依赖"没事件时该族零样本"这一条)。
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

    // source_ip 是开放集(每个来源一个值,无封闭声明)⇒ 不开 0 基线:第一条真实失败
    // 才会开出该 IP 的序列,这是有 IP 维度的计数器应有的形态。
    lines.push('# HELP ihui_auth_login_failed_total Auth login failures by source_ip')
    lines.push('# TYPE ihui_auth_login_failed_total counter')
    for (const [ip, v] of ihuiState.authLoginFailedTotal) {
      lines.push(`ihui_auth_login_failed_total{source_ip="${ip}"} ${v}`)
    }

    lines.push('# HELP ihui_auth_jwt_issued_total JWT token pairs issued counter')
    lines.push('# TYPE ihui_auth_jwt_issued_total counter')
    lines.push(`ihui_auth_jwt_issued_total ${ihuiState.authJwtIssuedTotal}`)

    // reason 为开放集(revokeRefreshToken 的 reason 形参是 string,db/queries.ts 的
    // 出处注释自带省略号)⇒ 不开 0 基线,只由真实吊销写线。
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

    // reason 封闭(AUTH_LOGIN_ANOMALY_REASONS,四值)⇒ 已逐值开 0 基线,面板读 0 而非 No data。
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

    // category 是开放集(埋点在 routes/exam.ts 的 POST /exam/papers/:id/start,取
    // paper.categoryId,值由试卷表里的行决定)⇒ 不开 0 基线。该族埋点本身是活的,
    // 开过一场试就有线。
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

    // driver 封闭(OSS_DRIVER_TYPES,六值)⇒ 已逐值开 0 基线。本部署实际只会自增
    // env OSS_DRIVER_TYPE 那一档,其余档读 0 是"没发生过",不是假数据。
    lines.push('# HELP ihui_oss_requests_total OSS requests by storage driver')
    lines.push('# TYPE ihui_oss_requests_total counter')
    for (const [driver, v] of ihuiState.ossRequestsTotal) {
      lines.push(`ihui_oss_requests_total{driver="${driver}"} ${v}`)
    }

    // 两维都封闭(OSS_DRIVER_TYPES × OSS_ERROR_TYPES)⇒ 已开 12 条 0 基线;
    // error_type 口径与 onResponse 钩子共用 ossErrorTypeFor,不会开出钩子写不出的键。
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
    // tenant_id 是开放集(每租户一个,埋点在 plugins/tenant.ts 的 onResponse,
    // 值来自 header/subdomain 解析出的真实租户)⇒ 不开 0 基线:编造 tenant_id 比 No data 更坏。
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

    // traffic 2:访客 vs 机器人。两维都是源码封闭枚举 ⇒ 已逐值开 0 基线,
    // 面板读到 0 是"这段时间真没有",不会与"埋点压根没接"同形。
    lines.push(
      '# HELP ihui_traffic_requests_total Entry requests by self-declared client family and status class',
    )
    lines.push('# TYPE ihui_traffic_requests_total counter')
    for (const [k, v] of ihuiState.trafficRequestsTotal) {
      const [family, statusClass] = k.split('|')
      lines.push(
        `ihui_traffic_requests_total{client_family="${family}",status_class="${statusClass}"} ${v}`,
      )
    }

    lines.push(
      '# HELP ihui_traffic_scan_hits_total Requests whose path matches a known-malicious probe shape',
    )
    lines.push('# TYPE ihui_traffic_scan_hits_total counter')
    for (const [k, v] of ihuiState.trafficScanHitsTotal) {
      const [kind, family] = k.split('|')
      lines.push(`ihui_traffic_scan_hits_total{kind="${kind}",client_family="${family}"} ${v}`)
    }

    // traffic 3:PV/UV 聚合(gauge)。UV 是开放集 ⇒ 只在服务端聚合完再发**单值**,
    // 标签只留有界的 窗口 / 来源表 / 客户端族。数值来源 = scheduler 的
    // `traffic-stats-hourly`(每 60 秒,限窗 + 带预算的聚合查询),**不在每次 scrape、也不在请求路径上**。
    // 读 0 的两种含义要分清:看 `ihui_traffic_aggregation_last_success_timestamp_seconds`
    // —— 它是 0 表示"这个进程还没成功聚合过一次",不是"真没有一个访客"。
    lines.push(
      '# HELP ihui_traffic_page_views Rolling-window page/request views (gauge, refreshed every 60s by traffic-stats-hourly)',
    )
    lines.push('# TYPE ihui_traffic_page_views gauge')
    for (const [k, v] of ihuiState.trafficPageViews) {
      const [window, source] = k.split('|')
      lines.push(`ihui_traffic_page_views{window="${window}",source="${source}"} ${v}`)
    }

    lines.push(
      `# HELP ihui_traffic_unique_visitors Rolling-window unique visitors per source (${TRAFFIC_SOURCE_UV_LABEL.api_logs} / ${TRAFFIC_SOURCE_UV_LABEL.visit_logs})`,
    )
    lines.push('# TYPE ihui_traffic_unique_visitors gauge')
    for (const [k, v] of ihuiState.trafficUniqueVisitors) {
      const [window, source] = k.split('|')
      lines.push(`ihui_traffic_unique_visitors{window="${window}",source="${source}"} ${v}`)
    }

    lines.push(
      '# HELP ihui_traffic_family_page_views Rolling-window page views split by self-declared client family',
    )
    lines.push('# TYPE ihui_traffic_family_page_views gauge')
    for (const [k, v] of ihuiState.trafficFamilyPageViews) {
      const [window, source, family] = k.split('|')
      lines.push(
        `ihui_traffic_family_page_views{window="${window}",source="${source}",client_family="${family}"} ${v}`,
      )
    }

    lines.push(
      '# HELP ihui_traffic_family_unique_visitors Upper-bound rolling-window visitors per client family (an ip seen under two user agents of one family counts twice)',
    )
    lines.push('# TYPE ihui_traffic_family_unique_visitors gauge')
    for (const [k, v] of ihuiState.trafficFamilyUniqueVisitors) {
      const [window, source, family] = k.split('|')
      lines.push(
        `ihui_traffic_family_unique_visitors{window="${window}",source="${source}",client_family="${family}"} ${v}`,
      )
    }

    lines.push(
      '# HELP ihui_traffic_family_breakdown_truncated 1 when the family split hit the user-agent kind budget and only reports a lower bound',
    )
    lines.push('# TYPE ihui_traffic_family_breakdown_truncated gauge')
    for (const [k, v] of ihuiState.trafficFamilyBreakdownTruncated) {
      const [window, source] = k.split('|')
      lines.push(
        `ihui_traffic_family_breakdown_truncated{window="${window}",source="${source}"} ${v}`,
      )
    }

    // 每个来源表的 UV 口径就一句,取自 TRAFFIC_SOURCE_UV_LABEL 这份唯一清单(不在 HELP
    // 与面板里各抄一遍);这里只挑 api_logs 那条,另一条在 /visit-tracking 管理页看。
    lines.push(
      '# HELP ihui_traffic_aggregation_last_success_timestamp_seconds Last successful traffic aggregation (unix seconds); 0 means this process never completed one — it does NOT mean there were no visitors',
    )
    lines.push('# TYPE ihui_traffic_aggregation_last_success_timestamp_seconds gauge')
    lines.push(
      `ihui_traffic_aggregation_last_success_timestamp_seconds ${ihuiState.trafficAggregatedAtSeconds}`,
    )

    // relay 号池 2:key 池 + 账号池健康快照(gauge,set 语义,relay-pool-gauge 每5分刷新)。
    // 读数的两条自证:① 每个池都有自己的 refresh_last_success 戳(0 = 本进程从未刷新成功,
    // 不是"池子空了");② rows_skipped / label_collisions 两路显式丢失计数 ——
    // "少了几个 key"必须看得见,不许悄悄少报。
    lines.push(
      '# HELP ihui_relay_key_pool_health_state Relay API-key pool health per key (0=unknown 1=healthy 2=degraded 3=down; higher is worse)',
    )
    lines.push('# TYPE ihui_relay_key_pool_health_state gauge')
    for (const [k, v] of ihuiState.relayKeyHealth) {
      const [provider, key] = k.split('|')
      lines.push(`ihui_relay_key_pool_health_state{provider_code="${provider}",key="${key}"} ${v}`)
    }

    lines.push(
      '# HELP ihui_relay_key_pool_schedulable 1 when the relay key is enabled and not temp-unschedulable (routers can pick it)',
    )
    lines.push('# TYPE ihui_relay_key_pool_schedulable gauge')
    for (const [k, v] of ihuiState.relayKeySchedulable) {
      const [provider, key] = k.split('|')
      lines.push(`ihui_relay_key_pool_schedulable{provider_code="${provider}",key="${key}"} ${v}`)
    }

    lines.push(
      '# HELP ihui_relay_key_pool_health_age_seconds Seconds since the key was last health-checked (series absent = never checked)',
    )
    lines.push('# TYPE ihui_relay_key_pool_health_age_seconds gauge')
    for (const [k, v] of ihuiState.relayKeyHealthAge) {
      const [provider, key] = k.split('|')
      lines.push(
        `ihui_relay_key_pool_health_age_seconds{provider_code="${provider}",key="${key}"} ${v}`,
      )
    }

    lines.push(
      '# HELP ihui_relay_key_pool_keys Relay key count per provider folded by health state',
    )
    lines.push('# TYPE ihui_relay_key_pool_keys gauge')
    for (const [k, v] of ihuiState.relayKeyByProviderState) {
      const [provider, state] = k.split('|')
      lines.push(`ihui_relay_key_pool_keys{provider_code="${provider}",state="${state}"} ${v}`)
    }

    lines.push(
      '# HELP ihui_relay_key_pool_schedulable_keys Routable relay keys per provider (sum across providers = pool headline number)',
    )
    lines.push('# TYPE ihui_relay_key_pool_schedulable_keys gauge')
    for (const [k, v] of ihuiState.relayKeySchedulableByProvider) {
      lines.push(`ihui_relay_key_pool_schedulable_keys{provider_code="${k}"} ${v}`)
    }

    lines.push(
      '# HELP ihui_relay_account_pool_health_state Relay account pool health per account (0=unknown 1=healthy 2=degraded 3=down)',
    )
    lines.push('# TYPE ihui_relay_account_pool_health_state gauge')
    for (const [k, v] of ihuiState.relayAccountHealth) {
      const [provider, account] = k.split('|')
      lines.push(
        `ihui_relay_account_pool_health_state{provider_code="${provider}",account="${account}"} ${v}`,
      )
    }

    lines.push(
      '# HELP ihui_relay_account_pool_schedulable 1 when the relay account is enabled and not temp-unschedulable',
    )
    lines.push('# TYPE ihui_relay_account_pool_schedulable gauge')
    for (const [k, v] of ihuiState.relayAccountSchedulable) {
      const [provider, account] = k.split('|')
      lines.push(
        `ihui_relay_account_pool_schedulable{provider_code="${provider}",account="${account}"} ${v}`,
      )
    }

    // 账号池按 provider 折叠的容量四连(2026-10-26 立,与 key 族 *_schedulable_keys 同族同节拍)。
    // 为什么必须有 enabled/accounts 两档:光看 schedulable=0 判不出"号被临时摘光"还是"这个
    // provider 压根没号",而这正是本次要消灭的"容量归零与一切正常同形"。
    // zero_capacity 是合成档:enabled>0 ∧ schedulable=0 ⇒ 1(判据在 stats 侧的同一份折叠里)。
    lines.push(
      '# HELP ihui_relay_account_pool_schedulable_accounts Routable relay accounts per provider (same family as ihui_relay_key_pool_schedulable_keys; sum across providers = account pool headline number)',
    )
    lines.push('# TYPE ihui_relay_account_pool_schedulable_accounts gauge')
    for (const [k, v] of ihuiState.relayAccountSchedulableByProvider) {
      lines.push(`ihui_relay_account_pool_schedulable_accounts{provider_code="${k}"} ${v}`)
    }

    lines.push(
      '# HELP ihui_relay_account_pool_enabled_accounts Enabled relay accounts per provider (is_enabled=true, regardless of temp-unschedulable)',
    )
    lines.push('# TYPE ihui_relay_account_pool_enabled_accounts gauge')
    for (const [k, v] of ihuiState.relayAccountEnabledByProvider) {
      lines.push(`ihui_relay_account_pool_enabled_accounts{provider_code="${k}"} ${v}`)
    }

    lines.push(
      '# HELP ihui_relay_account_pool_accounts Relay account rows per provider (all rows, disabled and dirty-health ones included)',
    )
    lines.push('# TYPE ihui_relay_account_pool_accounts gauge')
    for (const [k, v] of ihuiState.relayAccountRowsByProvider) {
      lines.push(`ihui_relay_account_pool_accounts{provider_code="${k}"} ${v}`)
    }

    lines.push(
      '# HELP ihui_relay_account_pool_zero_capacity 1 when a provider has enabled accounts but zero schedulable ones (the account-pool fallback is silently degrading to ai-service)',
    )
    lines.push('# TYPE ihui_relay_account_pool_zero_capacity gauge')
    for (const [k, v] of ihuiState.relayAccountZeroCapacityByProvider) {
      lines.push(`ihui_relay_account_pool_zero_capacity{provider_code="${k}"} ${v}`)
    }

    lines.push(
      '# HELP ihui_relay_account_pool_consecutive_failures Consecutive forwarding failures per relay account (circuit-breaker counter; resets on success)',
    )
    lines.push('# TYPE ihui_relay_account_pool_consecutive_failures gauge')
    for (const [k, v] of ihuiState.relayAccountFailures) {
      const [provider, account] = k.split('|')
      lines.push(
        `ihui_relay_account_pool_consecutive_failures{provider_code="${provider}",account="${account}"} ${v}`,
      )
    }

    lines.push(
      '# HELP ihui_relay_account_pool_total_calls Cumulative forwarded calls per relay account (usage)',
    )
    lines.push('# TYPE ihui_relay_account_pool_total_calls gauge')
    for (const [k, v] of ihuiState.relayAccountTotalCalls) {
      const [provider, account] = k.split('|')
      lines.push(
        `ihui_relay_account_pool_total_calls{provider_code="${provider}",account="${account}"} ${v}`,
      )
    }

    lines.push(
      '# HELP ihui_relay_account_pool_token_expires_in_seconds Seconds until the account access token expires (negative = already expired)',
    )
    lines.push('# TYPE ihui_relay_account_pool_token_expires_in_seconds gauge')
    for (const [k, v] of ihuiState.relayAccountTokenExpiresIn) {
      const [provider, account] = k.split('|')
      lines.push(
        `ihui_relay_account_pool_token_expires_in_seconds{provider_code="${provider}",account="${account}"} ${v}`,
      )
    }

    lines.push(
      '# HELP ihui_relay_account_pool_refresh_age_seconds Seconds since the account token was last refreshed (series absent = never refreshed)',
    )
    lines.push('# TYPE ihui_relay_account_pool_refresh_age_seconds gauge')
    for (const [k, v] of ihuiState.relayAccountRefreshAge) {
      const [provider, account] = k.split('|')
      lines.push(
        `ihui_relay_account_pool_refresh_age_seconds{provider_code="${provider}",account="${account}"} ${v}`,
      )
    }

    lines.push(
      '# HELP ihui_relay_key_pool_refresh_last_success_timestamp_seconds Last successful relay key pool refresh (unix seconds); 0 means this process never completed one — it does NOT mean the pool is empty',
    )
    lines.push('# TYPE ihui_relay_key_pool_refresh_last_success_timestamp_seconds gauge')
    lines.push(
      `ihui_relay_key_pool_refresh_last_success_timestamp_seconds ${ihuiState.relayKeyRefreshedAtSeconds}`,
    )

    lines.push(
      '# HELP ihui_relay_account_pool_refresh_last_success_timestamp_seconds Last successful relay account pool refresh (unix seconds); 0 means this process never completed one — it does NOT mean the pool is empty',
    )
    lines.push('# TYPE ihui_relay_account_pool_refresh_last_success_timestamp_seconds gauge')
    lines.push(
      `ihui_relay_account_pool_refresh_last_success_timestamp_seconds ${ihuiState.relayAccountRefreshedAtSeconds}`,
    )

    lines.push(
      '# HELP ihui_relay_key_pool_rows_skipped_total Relay key pool rows dropped because health_status fell outside the closed four-state vocabulary',
    )
    lines.push('# TYPE ihui_relay_key_pool_rows_skipped_total counter')
    lines.push(`ihui_relay_key_pool_rows_skipped_total ${ihuiState.relayKeyRowsSkipped}`)

    lines.push(
      '# HELP ihui_relay_key_pool_label_collisions_total Relay key pool rows dropped because two keys sanitized to the same provider+key label',
    )
    lines.push('# TYPE ihui_relay_key_pool_label_collisions_total counter')
    lines.push(`ihui_relay_key_pool_label_collisions_total ${ihuiState.relayKeyLabelCollisions}`)

    lines.push(
      '# HELP ihui_relay_account_pool_rows_skipped_total Relay account pool rows dropped because health_status fell outside the closed four-state vocabulary',
    )
    lines.push('# TYPE ihui_relay_account_pool_rows_skipped_total counter')
    lines.push(`ihui_relay_account_pool_rows_skipped_total ${ihuiState.relayAccountRowsSkipped}`)

    lines.push(
      '# HELP ihui_relay_account_pool_label_collisions_total Relay account pool rows dropped because two accounts sanitized to the same provider+account label',
    )
    lines.push('# TYPE ihui_relay_account_pool_label_collisions_total counter')
    lines.push(
      `ihui_relay_account_pool_label_collisions_total ${ihuiState.relayAccountLabelCollisions}`,
    )

    // 静默回落计数(2026-10-26 立):此前这两处回退点(no key candidates / account pool 返回 null)
    // 一声不响,healthy 号=0 与"上游一切正常"在观面上完全同形。封闭四档逐值开零基线
    // (见 seedIhuiClosedEnumBaseline),所以"0"在这里读得出"真没回落",不是"埋点没接"。
    lines.push(
      '# HELP ihui_relay_upstream_fallback_total Times the relay upstream path fell back without a usable channel/account (reason: channel_query_error | no_key_pool_candidates | account_pool_declined | account_pool_threw)',
    )
    lines.push('# TYPE ihui_relay_upstream_fallback_total counter')
    for (const [k, v] of ihuiState.relayUpstreamFallbackTotal) {
      lines.push(`ihui_relay_upstream_fallback_total{reason="${k}"} ${v}`)
    }

    // 上游断流计数(2026-10-26 由并行写席的进程内 Map 并入本家族,§0.6 单一真相源):
    // 判据住转发层(什么算"没说完"),记账出口住这里 —— 与 ihui_relay_upstream_fallback_total 同族同节拍。
    lines.push(
      '# HELP ihui_relay_stream_interrupt_total Times an upstream relay stream ended before a terminal frame (provider: trae | workbuddy | codearts | qoder)',
    )
    lines.push('# TYPE ihui_relay_stream_interrupt_total counter')
    for (const [k, v] of ihuiState.relayStreamInterruptTotal) {
      lines.push(`ihui_relay_stream_interrupt_total{provider_code="${k}"} ${v}`)
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
  // 封闭枚举零基线用测试从源文件取清单(§22c:判据不得在测试里抄第二份)
  FUNNEL_STAGES,
  FUNNEL_DEFAULT_CHANNEL,
  OSS_DRIVER_TYPES,
  OSS_ERROR_TYPES,
  AUTH_LOGIN_ANOMALY_REASONS,
  ossErrorTypeFor,
  STATUS_CLASSES,
  statusClassFor,
  // 访客族的清单同样从源文件取(§22c),测试不抄第二份枚举
  CLIENT_FAMILIES,
  SCAN_PROBE_KINDS,
  recordTrafficRequest,
  recordTrafficScanHit,
  // PV/UV 聚合族:窗口与来源表的有界清单 + 写入出口,一律由测试从源文件取
  TRAFFIC_WINDOWS,
  TRAFFIC_SOURCES,
  TRAFFIC_SOURCE_UV_LABEL,
  setTrafficGaugeSample,
  // 中转号池健康族:封闭四档词表 + setter 出口(测试从源文件取,不抄第二份)
  RELAY_POOL_HEALTH_STATES,
  RELAY_POOL_HEALTH_STATE_VALUE,
  isRelayPoolHealthState,
  setRelayPoolGaugeSample,
  // 静默回落族:原因封闭四档 + 写入出口(同上,测试不抄第二份枚举)
  RELAY_UPSTREAM_FALLBACK_REASONS,
  recordRelayUpstreamFallback,
}

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * 上报转化漏斗事件(文档第 1 条)。
     * 射程以本文件头注 2026-10-18 那段现读核对为准:目前只有 `register` 有真实调用点,
     * `activate` 无事件源、`paid` 未接;`channel` 缺省落 FUNNEL_DEFAULT_CHANNEL,
     * 调用方没有真实渠道值时不要传(开放集 ⇒ 编一个比 "No data" 更坏)。
     */
    recordFunnel: (stage: FunnelStage, channel?: string) => void
    /**
     * 上报订单事件。真实调用点在 `services/order-service.ts` 的四个状态迁移处;
     * `type` 传 `orders.order_type` 原值(整数码转字符串),不自立第二份类型清单。
     */
    recordOrder: (type: string, status: string) => void
    /**
     * 上报支付事件。真实调用点与 `recordOrder` 同处;`status` 只用该处已写进库的
     * 档口(attempt / success / refund),与 `ihui_payment_attempt|success|refund_total` 对应。
     */
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
    /** 风控命中原因:入参类型即封闭集 `AuthLoginAnomalyReason`(值来自 AUTH_LOGIN_ANOMALY_REASONS)。 */
    recordAuthLoginAnomaly: (reason: AuthLoginAnomalyReason) => void
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
