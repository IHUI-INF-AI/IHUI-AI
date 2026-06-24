// ============================================
// useBi - 业务自助 BI composable (P8 阶段 1)
// 提供:
//   - fetchMetrics / fetchDimensions: 元数据
//   - runReport: 执行报表
//   - drilldown: 维度下钻
//   - fetchAnomalies: 异常 + 归因
//   - 共享 loading / error 状态
// ============================================

import { ref } from 'vue'
import http from '@/utils/request'

export interface BiMetric {
  name: string
  label: string
  unit: string
  aggregator: string
}

export interface BiDimension {
  name: string
  label: string
  value_count: number
}

export interface BiReportRequest {
  metric: string
  dimensions: string[]
  filters: Array<{ field: string; op: string; value: unknown }>
  days: number
  limit: number
  order_by: 'value' | 'date'
  order_dir: 'asc' | 'desc'
}

export interface BiReportRow {
  date?: string
  [dim: string]: unknown
  value: number
}

export interface BiReportResult {
  columns: string[]
  rows: BiReportRow[]
  total: number
  metric: string
  metric_label: string
  unit: string
  dimensions: string[]
  days: number
  limit: number
  generated_at: string
}

export interface BiDrilldownResult {
  metric: string
  metric_label: string
  unit: string
  dimension: string
  value: string
  days: number
  series: Array<{ date: string; value: number }>
  sub_dimensions: Array<{ name: string; label: string; top: Array<{ name: string; value: number }> }>
  total: number
  generated_at: string
}

export interface BiAnomaly {
  date: string
  value: number
  expected: number
  z_score: number
  direction: 'up' | 'down'
  severity: 'warning' | 'critical'
  contribution: number
  attribution: Array<{
    dimension: string
    label: string
    top_value: string
    impact: number
    contribution: number
  }>
}

export function useBi() {
  const metrics = ref<BiMetric[]>([])
  const dimensions = ref<BiDimension[]>([])
  const lastReport = ref<BiReportResult | null>(null)
  const lastDrilldown = ref<BiDrilldownResult | null>(null)
  const anomalies = ref<BiAnomaly[]>([])
  const anomalyMeta = ref<{ metric: string; days: number; z_threshold: number; count: number } | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchMetrics = async () => {
    loading.value = true
    error.value = null
    try {
      const res = await http.get('/api/v1/bi/metrics') as unknown as { code?: number | string; message?: string; data?: BiMetric[] }
      const codeNum = typeof res?.code === 'string' ? parseInt(res.code, 10) : res?.code
      if (codeNum === 0) metrics.value = res.data ?? []
    } catch (e: unknown) {
      error.value = (e as { message?: string })?.message || '加载指标失败'
    } finally {
      loading.value = false
    }
  }

  const fetchDimensions = async () => {
    loading.value = true
    error.value = null
    try {
      const res = await http.get('/api/v1/bi/dimensions') as unknown as { code?: number | string; message?: string; data?: BiDimension[] }
      const codeNum = typeof res?.code === 'string' ? parseInt(res.code, 10) : res?.code
      if (codeNum === 0) dimensions.value = res.data ?? []
    } catch (e: unknown) {
      error.value = (e as { message?: string })?.message || '加载维度失败'
    } finally {
      loading.value = false
    }
  }

  const runReport = async (req: BiReportRequest) => {
    loading.value = true
    error.value = null
    try {
      const res = await http.post('/api/v1/bi/report', req) as unknown as { code?: number | string; message?: string; data?: BiReportResult }
      const codeNum = typeof res?.code === 'string' ? parseInt(res.code, 10) : res?.code
      if (codeNum === 0) {
        lastReport.value = res.data ?? null
        return res.data as BiReportResult
      }
      error.value = res?.message || '报表执行失败'
      return null
    } catch (e: unknown) {
      error.value = (e as { message?: string })?.message || '报表执行失败'
      return null
    } finally {
      loading.value = false
    }
  }

  const drilldown = async (
    metric: string,
    dimension: string,
    value: string,
    days: number = 7,
  ) => {
    loading.value = true
    error.value = null
    try {
      const res = await http.get('/api/v1/bi/drilldown', {
        params: { metric, dimension, value, days },
      }) as unknown as { code?: number | string; message?: string; data?: BiDrilldownResult }
      const codeNum = typeof res?.code === 'string' ? parseInt(res.code, 10) : res?.code
      if (codeNum === 0) {
        lastDrilldown.value = res.data ?? null
        return res.data as BiDrilldownResult
      }
      error.value = res?.message || '下钻失败'
      return null
    } catch (e: unknown) {
      error.value = (e as { message?: string })?.message || '下钻失败'
      return null
    } finally {
      loading.value = false
    }
  }

  const fetchAnomalies = async (metric: string, days: number = 30, zThreshold: number = 2.0) => {
    loading.value = true
    error.value = null
    try {
      const res = await http.get('/api/v1/bi/anomalies', {
        params: { metric, days, z_threshold: zThreshold },
      }) as unknown as { code?: number | string; message?: string; data?: { anomalies: BiAnomaly[]; metric: string; days: number; z_threshold: number; count: number } }
      const codeNum = typeof res?.code === 'string' ? parseInt(res.code, 10) : res?.code
      if (codeNum === 0 && res.data) {
        anomalies.value = res.data.anomalies
        anomalyMeta.value = {
          metric: res.data.metric,
          days: res.data.days,
          z_threshold: res.data.z_threshold,
          count: res.data.count,
        }
        return res.data
      }
      error.value = res?.message || '异常检测失败'
      return null
    } catch (e: unknown) {
      error.value = (e as { message?: string })?.message || '异常检测失败'
      return null
    } finally {
      loading.value = false
    }
  }

  return {
    metrics,
    dimensions,
    lastReport,
    lastDrilldown,
    anomalies,
    anomalyMeta,
    loading,
    error,
    fetchMetrics,
    fetchDimensions,
    runReport,
    drilldown,
    fetchAnomalies,
  }
}
