/**
 * 监控仪表盘配置 — 等价自旧架构 client/src/config/monitoring-dashboard.ts
 * 定义运维监控仪表盘的图表布局、数据源与刷新策略
 */

/** 图表类型 */
export type ChartType = 'line' | 'area' | 'bar' | 'gauge' | 'stat' | 'table' | 'pie'

/** 数据源标识 */
export type MetricSource = 'api' | 'database' | 'redis' | 'websocket' | 'ai-service' | 'system'

export interface DashboardPanel {
  /** 面板 ID */
  id: string
  /** 面板标题 */
  title: string
  /** 图表类型 */
  type: ChartType
  /** 数据源 */
  source: MetricSource
  /** 指标查询表达式（PromQL 风格） */
  query: string
  /** 图表跨度（栅格列数，最大 12） */
  span: number
  /** 行号（同一行的面板并排显示） */
  row: number
  /** 刷新间隔（秒） */
  refreshIntervalSec: number
  /** 单位 */
  unit?: string
  /** 阈值告警（值 -> 颜色） */
  thresholds?: { warning?: number; critical?: number }
  /** 描述 */
  description?: string
}

export interface DashboardConfig {
  /** 仪表盘 ID */
  id: string
  /** 仪表盘标题 */
  title: string
  /** 默认刷新间隔（秒） */
  defaultRefreshSec: number
  /** 默认时间范围（分钟） */
  defaultTimeRangeMin: number
  /** 面板列表 */
  panels: DashboardPanel[]
}

/** API 服务监控仪表盘 */
export const API_DASHBOARD: DashboardConfig = {
  id: 'api-overview',
  title: 'API 服务概览',
  defaultRefreshSec: 15,
  defaultTimeRangeMin: 60,
  panels: [
    {
      id: 'api-rps',
      title: '请求 QPS',
      type: 'line',
      source: 'api',
      query: 'rate(http_requests_total[1m])',
      span: 6,
      row: 1,
      refreshIntervalSec: 10,
      unit: 'req/s',
      description: 'API 每秒请求数',
    },
    {
      id: 'api-latency-p95',
      title: 'P95 延迟',
      type: 'line',
      source: 'api',
      query: 'histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m]))',
      span: 6,
      row: 1,
      refreshIntervalSec: 10,
      unit: 'ms',
      thresholds: { warning: 200, critical: 500 },
    },
    {
      id: 'api-error-rate',
      title: '错误率',
      type: 'gauge',
      source: 'api',
      query:
        'sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))',
      span: 4,
      row: 2,
      refreshIntervalSec: 15,
      unit: '%',
      thresholds: { warning: 1, critical: 5 },
    },
    {
      id: 'api-status-codes',
      title: '状态码分布',
      type: 'pie',
      source: 'api',
      query: 'sum by (status) (rate(http_requests_total[5m]))',
      span: 4,
      row: 2,
      refreshIntervalSec: 15,
    },
    {
      id: 'api-active-instances',
      title: '活跃实例数',
      type: 'stat',
      source: 'api',
      query: 'count(up{job="api"})',
      span: 4,
      row: 2,
      refreshIntervalSec: 30,
    },
  ],
}

/** 数据库监控仪表盘 */
export const DATABASE_DASHBOARD: DashboardConfig = {
  id: 'database-overview',
  title: '数据库概览',
  defaultRefreshSec: 15,
  defaultTimeRangeMin: 60,
  panels: [
    {
      id: 'pg-connections',
      title: '活跃连接数',
      type: 'gauge',
      source: 'database',
      query: 'pg_stat_activity_count',
      span: 4,
      row: 1,
      refreshIntervalSec: 10,
      unit: 'conn',
      thresholds: { warning: 40, critical: 48 },
    },
    {
      id: 'pg-slow-queries',
      title: '慢查询率',
      type: 'line',
      source: 'database',
      query: 'rate(pg_slow_queries_total[5m])',
      span: 4,
      row: 1,
      refreshIntervalSec: 15,
      unit: 'q/s',
      thresholds: { warning: 5, critical: 20 },
    },
    {
      id: 'pg-cache-hit',
      title: '缓存命中率',
      type: 'gauge',
      source: 'database',
      query: 'pg_cache_hit_ratio',
      span: 4,
      row: 1,
      refreshIntervalSec: 15,
      unit: '%',
      thresholds: { warning: 95, critical: 90 },
    },
    {
      id: 'pg-replication-lag',
      title: '复制延迟',
      type: 'line',
      source: 'database',
      query: 'pg_replication_lag_seconds',
      span: 6,
      row: 2,
      refreshIntervalSec: 10,
      unit: 's',
      thresholds: { warning: 1, critical: 5 },
    },
    {
      id: 'pg-txn-duration',
      title: '事务平均耗时',
      type: 'line',
      source: 'database',
      query: 'rate(pg_txn_duration_ms_sum[5m]) / rate(pg_txn_duration_ms_count[5m])',
      span: 6,
      row: 2,
      refreshIntervalSec: 15,
      unit: 'ms',
      thresholds: { warning: 200, critical: 500 },
    },
  ],
}

/** WebSocket 监控仪表盘 */
export const WEBSOCKET_DASHBOARD: DashboardConfig = {
  id: 'websocket-overview',
  title: 'WebSocket 概览',
  defaultRefreshSec: 10,
  defaultTimeRangeMin: 30,
  panels: [
    {
      id: 'ws-connections',
      title: '在线连接数',
      type: 'line',
      source: 'websocket',
      query: 'ws_active_connections',
      span: 6,
      row: 1,
      refreshIntervalSec: 5,
      unit: 'conn',
    },
    {
      id: 'ws-msg-rate',
      title: '消息吞吐',
      type: 'area',
      source: 'websocket',
      query: 'rate(ws_messages_total[1m])',
      span: 6,
      row: 1,
      refreshIntervalSec: 5,
      unit: 'msg/s',
    },
    {
      id: 'ws-connect-fail',
      title: '连接失败率',
      type: 'gauge',
      source: 'websocket',
      query: 'rate(ws_connect_failed_total[5m])',
      span: 12,
      row: 2,
      refreshIntervalSec: 15,
      unit: 'fail/s',
      thresholds: { warning: 1, critical: 10 },
    },
  ],
}

/** 全部仪表盘配置（按 tab 分组） */
export const MONITORING_DASHBOARDS: DashboardConfig[] = [
  API_DASHBOARD,
  DATABASE_DASHBOARD,
  WEBSOCKET_DASHBOARD,
]

/** 按 ID 查询仪表盘配置 */
export function findDashboardById(id: string): DashboardConfig | undefined {
  return MONITORING_DASHBOARDS.find((d) => d.id === id)
}
