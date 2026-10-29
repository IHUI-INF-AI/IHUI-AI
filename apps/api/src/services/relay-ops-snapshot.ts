// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 运营面板 WS 实时快照组装服务(2026-09-18,#58 运营面板 WS 实时化)。
 *
 * 单一职责:把「告警规则+告警事件 / 渠道组+熔断统计 / 用量总览」三段数据
 * 组装成与对应 REST 端点**完全同形状**的快照,供 ws-relay-ops 插件周期推送。
 *
 * 形状契约(与前端 useQuery 缓存逐字段对齐,前端直接 setQueryData 热替换):
 * - alerts.rules   ↔ GET /api/admin/relay/alert-rules          → r.data.list
 * - alerts.events  ↔ GET /api/admin/relay/alert-rules/events   → r.data.events
 * - channels       ↔ channels/page.tsx queryFn                 → { groups, stats }
 * - usage.overview ↔ GET /api/admin/relay/stats/overview       → r.data
 *
 * 说明:告警段直接复用 relay-alert-rules-service;渠道组/熔断统计与用量聚合
 * 与 relay-channels.ts / relay-stats.ts 的 handler 逻辑保持同构(那些 handler
 * 是内联实现,为不动共享路由文件,此处按相同 SQL 语义实现并注明来源)。
 */
import { and, eq, inArray, sql, gte, lte } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import {
  aiRelayChannelGroups,
  aiRelayChannelGroupMembers,
  aiRelayKeyPool,
  llmCallLogs,
} from '@ihui/database'
import { getCircuitState, getRecentCalls } from './relay-channel-router.js'
import { listAlertRules, listRecentAlertEvents } from './relay-alert-rules-service.js'

// ===== 类型(与 REST 响应逐字段一致) =====

export interface RelayOpsChannelMember {
  memberId: string
  keyPoolId: string
  weight: number
  keyPoolName: string | null
  keyPoolProviderCode: string | null
  keyPoolEnabled: boolean | null
  circuitState: string
  failureCount: number
  lastFailureAt: number | null
  recentCallsCount: number
  avgLatencyMs: number | null
  createdAt: Date | null
}

export interface RelayOpsGroupStat {
  group: {
    id: string
    name: string
    loadBalanceStrategy: string
    priority: number
    enabled: boolean
  }
  memberCount: number
  circuitSummary: { closed: number; open: number; halfOpen: number }
  totalRecentCalls: number
  members: RelayOpsChannelMember[]
}

export interface RelayOpsPeriodAggregate {
  callCount: number
  totalTokens: number
  totalCostCents: number
  errorCount: number
  errorRate: number
  avgLatencyMs: number
  p95LatencyMs: number
}

export interface RelayOpsRangeAggregate {
  callCount: number
  totalCostCents: number
  errorRate: number
}

export interface RelayOpsOverview {
  today: RelayOpsPeriodAggregate
  yesterday: RelayOpsPeriodAggregate
  delta: {
    callCountDelta: number
    totalCostCentsDelta: number
    errorRateDelta: number
  }
  last7d: RelayOpsRangeAggregate
  last30d: RelayOpsRangeAggregate
}

export interface RelayOpsSnapshot {
  ts: string
  alerts: {
    rules: Awaited<ReturnType<typeof listAlertRules>>
    events: Awaited<ReturnType<typeof listRecentAlertEvents>>
  }
  channels: {
    groups: Array<{
      id: string
      name: string
      description: string | null
      loadBalanceStrategy: string
      enabled: boolean
      priority: number
      memberCount: number
      createdAt: Date | null
      updatedAt: Date | null
    }>
    stats: Array<RelayOpsGroupStat | null>
  }
  usage: {
    overview: RelayOpsOverview | null
  }
}

// ===== 时区工具:Asia/Shanghai 日界(UTC 表示)——与 relay-stats.ts 同语义 =====
function shanghaiDayStartUtc(daysAgo = 0): Date {
  const shanghaiNow = new Date(Date.now() + 8 * 3600 * 1000)
  return new Date(
    Date.UTC(
      shanghaiNow.getUTCFullYear(),
      shanghaiNow.getUTCMonth(),
      shanghaiNow.getUTCDate() - daysAgo,
    ) -
      8 * 3600 * 1000,
  )
}

function deltaRate(curr: number, prev: number): number {
  if (prev === 0) return curr === 0 ? 0 : 1
  return (curr - prev) / prev
}

// ===== 用量聚合(与 relay-stats.ts aggregatePeriod/aggregateRange 同语义) =====
async function aggregatePeriod(start: Date, end: Date): Promise<RelayOpsPeriodAggregate> {
  const rows = await dbRead
    .select({
      callCount: sql<number>`count(*)::int`,
      totalTokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint::int`,
      totalCostCents: sql<number>`coalesce(sum(((${llmCallLogs.metadata}->>'costCents')::numeric)), 0)::int`,
      errorCount: sql<number>`count(*) filter (where ${llmCallLogs.status} = 'error')::int`,
      avgLatencyMs: sql<number>`coalesce(avg(${llmCallLogs.latencyMs}), 0)::int`,
      p95LatencyMs: sql<number>`coalesce(percentile_cont(0.95) WITHIN GROUP (ORDER BY ${llmCallLogs.latencyMs})::int, 0)`,
    })
    .from(llmCallLogs)
    .where(and(gte(llmCallLogs.createdAt, start), lte(llmCallLogs.createdAt, end)))
  const r = rows[0]!
  const callCount = r.callCount
  return {
    callCount,
    totalTokens: r.totalTokens,
    totalCostCents: r.totalCostCents,
    errorCount: r.errorCount,
    errorRate: callCount > 0 ? r.errorCount / callCount : 0,
    avgLatencyMs: r.avgLatencyMs,
    p95LatencyMs: r.p95LatencyMs,
  }
}

async function aggregateRange(start: Date, end: Date): Promise<RelayOpsRangeAggregate> {
  const rows = await dbRead
    .select({
      callCount: sql<number>`count(*)::int`,
      totalCostCents: sql<number>`coalesce(sum(((${llmCallLogs.metadata}->>'costCents')::numeric)), 0)::int`,
      errorCount: sql<number>`count(*) filter (where ${llmCallLogs.status} = 'error')::int`,
    })
    .from(llmCallLogs)
    .where(and(gte(llmCallLogs.createdAt, start), lte(llmCallLogs.createdAt, end)))
  const r = rows[0]!
  const callCount = r.callCount
  return {
    callCount,
    totalCostCents: r.totalCostCents,
    errorRate: callCount > 0 ? r.errorCount / callCount : 0,
  }
}

// ===== 渠道段:组列表 + 每组熔断统计(与 relay-channels.ts handler 同语义) =====
async function buildChannelsSection(): Promise<RelayOpsSnapshot['channels']> {
  const groups = await dbRead
    .select({
      id: aiRelayChannelGroups.id,
      name: aiRelayChannelGroups.name,
      description: aiRelayChannelGroups.description,
      loadBalanceStrategy: aiRelayChannelGroups.loadBalanceStrategy,
      enabled: aiRelayChannelGroups.enabled,
      priority: aiRelayChannelGroups.priority,
      createdAt: aiRelayChannelGroups.createdAt,
      updatedAt: aiRelayChannelGroups.updatedAt,
    })
    .from(aiRelayChannelGroups)
    .orderBy(sql`${aiRelayChannelGroups.priority} DESC`, aiRelayChannelGroups.createdAt)

  if (groups.length === 0) return { groups: [], stats: [] }

  // 批量成员数(与 REST /groups 相同)
  const groupIds = groups.map((g) => g.id)
  const countRows = await dbRead
    .select({ groupId: aiRelayChannelGroupMembers.groupId, count: sql<number>`count(*)::int` })
    .from(aiRelayChannelGroupMembers)
    .where(inArray(aiRelayChannelGroupMembers.groupId, groupIds))
    .groupBy(aiRelayChannelGroupMembers.groupId)
  const countMap = new Map<string, number>(countRows.map((r) => [r.groupId, r.count]))

  const groupsWithCount = groups.map((g) => ({ ...g, memberCount: countMap.get(g.id) ?? 0 }))

  // 每组统计(与 REST /groups/:id/stats 相同:成员 + 熔断态 + 近期调用)
  const stats: Array<RelayOpsGroupStat | null> = await Promise.all(
    groupsWithCount.map(async (g) => {
      try {
        const members = await dbRead
          .select({
            memberId: aiRelayChannelGroupMembers.id,
            keyPoolId: aiRelayChannelGroupMembers.keyPoolId,
            weight: aiRelayChannelGroupMembers.weight,
            createdAt: aiRelayChannelGroupMembers.createdAt,
            keyPoolName: aiRelayKeyPool.name,
            keyPoolProviderCode: aiRelayKeyPool.providerCode,
            keyPoolEnabled: aiRelayKeyPool.isEnabled,
          })
          .from(aiRelayChannelGroupMembers)
          .leftJoin(aiRelayKeyPool, eq(aiRelayKeyPool.id, aiRelayChannelGroupMembers.keyPoolId))
          .where(eq(aiRelayChannelGroupMembers.groupId, g.id))

        const memberList: RelayOpsChannelMember[] = await Promise.all(
          members.map(async (m) => {
            const circuit = await getCircuitState(m.keyPoolId)
            const recent = getRecentCalls(m.keyPoolId)
            const avgLatency =
              recent.length > 0
                ? recent.reduce((sum, r) => sum + r.latencyMs, 0) / recent.length
                : null
            return {
              memberId: m.memberId,
              keyPoolId: m.keyPoolId,
              weight: m.weight,
              keyPoolName: m.keyPoolName,
              keyPoolProviderCode: m.keyPoolProviderCode,
              keyPoolEnabled: m.keyPoolEnabled,
              circuitState: circuit.state,
              failureCount: circuit.failureCount,
              lastFailureAt: circuit.lastFailureAt || null,
              recentCallsCount: recent.length,
              avgLatencyMs: avgLatency,
              createdAt: m.createdAt,
            }
          }),
        )

        const openCount = memberList.filter((m) => m.circuitState === 'open').length
        const halfOpenCount = memberList.filter((m) => m.circuitState === 'half-open').length
        const closedCount = memberList.filter((m) => m.circuitState === 'closed').length

        return {
          group: {
            id: g.id,
            name: g.name,
            loadBalanceStrategy: g.loadBalanceStrategy,
            priority: g.priority,
            enabled: g.enabled,
          },
          memberCount: memberList.length,
          circuitSummary: { closed: closedCount, open: openCount, halfOpen: halfOpenCount },
          totalRecentCalls: memberList.reduce((sum, m) => sum + m.recentCallsCount, 0),
          members: memberList,
        }
      } catch {
        // 单组统计失败不拖垮整帧快照,前端该组显示为 null(与 REST 失败分支一致)
        return null
      }
    }),
  )

  return { groups: groupsWithCount, stats }
}

// ===== 用量段:overview(与 REST /stats/overview 同语义) =====
async function buildUsageSection(): Promise<RelayOpsSnapshot['usage']> {
  const todayStart = shanghaiDayStartUtc(0)
  const yesterdayStart = shanghaiDayStartUtc(1)
  const last7dStart = shanghaiDayStartUtc(6)
  const last30dStart = shanghaiDayStartUtc(29)
  const now = new Date()

  const [today, yesterday, last7d, last30d] = await Promise.all([
    aggregatePeriod(todayStart, now),
    aggregatePeriod(yesterdayStart, todayStart),
    aggregateRange(last7dStart, now),
    aggregateRange(last30dStart, now),
  ])

  return {
    overview: {
      today,
      yesterday,
      delta: {
        callCountDelta: deltaRate(today.callCount, yesterday.callCount),
        totalCostCentsDelta: deltaRate(today.totalCostCents, yesterday.totalCostCents),
        errorRateDelta: today.errorRate - yesterday.errorRate,
      },
      last7d,
      last30d,
    },
  }
}

// ===== 快照组装入口(单帧;段级容错,一段失败不拖垮整帧) =====
export async function buildRelayOpsSnapshot(): Promise<RelayOpsSnapshot> {
  const [alerts, channels, usage] = await Promise.all([
    (async (): Promise<RelayOpsSnapshot['alerts']> => {
      try {
        const [rules, events] = await Promise.all([listAlertRules(), listRecentAlertEvents(50)])
        return { rules, events }
      } catch {
        return { rules: [], events: [] }
      }
    })(),
    buildChannelsSection().catch((): RelayOpsSnapshot['channels'] => ({ groups: [], stats: [] })),
    buildUsageSection().catch((): RelayOpsSnapshot['usage'] => ({ overview: null })),
  ])

  return {
    ts: new Date().toISOString(),
    alerts,
    channels,
    usage,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
