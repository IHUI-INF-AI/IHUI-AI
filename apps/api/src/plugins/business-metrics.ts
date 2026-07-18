import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { ttftMonitor, type TtftStats } from '../utils/ttft-monitor.js'

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
 *    - business_ai_calls_total{vendor,model}
 *    - business_ai_tokens_total{vendor,type="prompt|completion"}
 *    - business_ai_cost_usd_total{vendor}
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
  aiCalls: Map<string, number> // key: vendor|model
  aiTokens: Map<string, number> // key: vendor|type
  aiCost: Map<string, number> // key: vendor
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
    aiCalls: new Map(),
    aiTokens: new Map(),
    aiCost: new Map(),
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

  // 自动采集 API 调用成功率与延迟（按路由+状态码）
  server.addHook('onResponse', async (request, reply: FastifyReply) => {
    const url = request.url.split('?')[0] ?? ''
    if (!url.startsWith('/api/')) return
    if (url === '/api/health' || url === '/api/metrics' || url === '/api/business-metrics') return
    const route = request.routeOptions?.url ?? url
    const key = `${route}|${reply.statusCode}`
    counterInc(m.apiCallTotal, key)
    observeHistogram(m, key, Math.round(reply.elapsedTime))
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
    (vendor: string, model: string, tokens: number, costUsd: number) => {
      counterInc(m.aiCalls, `${vendor}|${model}`)
      counterInc(m.aiTokens, `${vendor}|prompt`, tokens)
      m.aiCost.set(vendor, (m.aiCost.get(vendor) ?? 0) + costUsd)
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

    lines.push('# HELP business_ai_calls_total AI model invocation counter')
    lines.push('# TYPE business_ai_calls_total counter')
    for (const [k, v] of m.aiCalls) {
      const [vendor, model] = k.split('|')
      lines.push(`business_ai_calls_total{vendor="${vendor}",model="${model}"} ${v}`)
    }

    lines.push('# HELP business_ai_tokens_total AI token consumption counter')
    lines.push('# TYPE business_ai_tokens_total counter')
    for (const [k, v] of m.aiTokens) {
      const [vendor, type] = k.split('|')
      lines.push(`business_ai_tokens_total{vendor="${vendor}",type="${type}"} ${v}`)
    }

    lines.push('# HELP business_ai_cost_usd_total AI cost in USD counter')
    lines.push('# TYPE business_ai_cost_usd_total counter')
    for (const [vendor, v] of m.aiCost) {
      lines.push(`business_ai_cost_usd_total{vendor="${vendor}"} ${v.toFixed(6)}`)
    }

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

    reply.type('text/plain').send(lines.join('\n'))
  })
}

export default fp(businessMetricsPlugin, {
  name: 'business-metrics-plugin',
  fastify: '5.x',
})

declare module 'fastify' {
  interface FastifyInstance {
    /** 上报转化漏斗事件（register → activate → paid）。 */
    recordFunnel: (stage: FunnelStage, channel?: string) => void
    /** 上报订单事件。 */
    recordOrder: (type: string, status: string) => void
    /** 上报支付事件。 */
    recordPayment: (channel: string, status: string) => void
    /** 上报 AI 调用事件（含 token 与成本）。 */
    recordAiCall: (vendor: string, model: string, tokens: number, costUsd: number) => void
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
  }
}
