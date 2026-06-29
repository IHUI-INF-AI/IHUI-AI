/**
 * P9-6 监控数据看板验证
 * - src/config/monitoring-dashboard.ts 存在且导出完整配置
 * - grafana/dashboard.json 是有效的 Grafana 看板配置
 * - grafana/datasources.json 包含 Prometheus + Elasticsearch
 * - grafana/alerts.yml 包含告警规则
 * - .env.production 包含监控相关环境变量
 */

import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'

const ROOT = 'g:/1/client'
const DASHBOARD_TS_PATH = `${ROOT}/src/config/monitoring-dashboard.ts`
const GRAFANA_DASHBOARD_PATH = `${ROOT}/grafana/dashboard.json`
const GRAFANA_DATASOURCES_PATH = `${ROOT}/grafana/datasources.json`
const GRAFANA_ALERTS_PATH = `${ROOT}/grafana/alerts.yml`
const ENV_PROD_PATH = `${ROOT}/.env.production`

function readText(path: string): string {
  return readFileSync(path, 'utf-8')
}

function readJSON(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

test.describe('P9-6 监控数据看板 - 源码审查', () => {
  test('monitoring-dashboard.ts 文件存在且导出完整配置', () => {
    const content = readText(DASHBOARD_TS_PATH)
    expect(content.length, '文件应有内容').toBeGreaterThan(1000)
    expect(content, '导出 grafanaDatasources').toMatch(/export const grafanaDatasources/)
    expect(content, '导出 monitoringDashboardConfig').toMatch(/export const monitoringDashboardConfig/)
    expect(content, '导出 sentryConfig').toMatch(/export const sentryConfig/)
    expect(content, '导出 alertRules').toMatch(/export const alertRules/)
    console.log('[P9-6] monitoring-dashboard.ts 导出完整 ✅')
  })

  test('monitoring-dashboard.ts 包含 Prometheus + Elasticsearch 数据源', () => {
    const content = readText(DASHBOARD_TS_PATH)
    expect(content, '包含 Prometheus 数据源').toMatch(/Prometheus/)
    expect(content, '包含 Elasticsearch 数据源').toMatch(/Elasticsearch/)
    expect(content, '包含 Prometheus URL').toMatch(/http:\/\/prometheus:9090/)
    expect(content, '包含 Elasticsearch URL').toMatch(/http:\/\/elasticsearch:9200/)
    console.log('[P9-6] 数据源配置完整 ✅')
  })

  test('monitoring-dashboard.ts 包含 Core Web Vitals 面板', () => {
    const content = readText(DASHBOARD_TS_PATH)
    expect(content, '包含 LCP 面板').toMatch(/LCP/)
    expect(content, '包含 CLS 面板').toMatch(/CLS/)
    expect(content, '包含 INP 面板').toMatch(/INP/)
    expect(content, '包含错误率面板').toMatch(/错误率/)
    console.log('[P9-6] Core Web Vitals 面板完整 ✅')
  })

  test('monitoring-dashboard.ts 包含 Sentry 配置', () => {
    const content = readText(DASHBOARD_TS_PATH)
    expect(content, '包含 Sentry DSN').toMatch(/VITE_SENTRY_DSN/)
    expect(content, '包含 sampleRate').toMatch(/sampleRate/)
    expect(content, '包含 tracesSampleRate').toMatch(/tracesSampleRate/)
    expect(content, '包含 integrations').toMatch(/integrations/)
    console.log('[P9-6] Sentry 配置完整 ✅')
  })

  test('monitoring-dashboard.ts 包含告警规则', () => {
    const content = readText(DASHBOARD_TS_PATH)
    expect(content, '包含 LCP 告警').toMatch(/LCP 过高/)
    expect(content, '包含 CLS 告警').toMatch(/CLS 过高/)
    expect(content, '包含错误率告警').toMatch(/错误率过高/)
    expect(content, '包含 CSP 告警').toMatch(/CSP 违规激增/)
    console.log('[P9-6] 告警规则完整 ✅')
  })
})

test.describe('P9-6 监控数据看板 - Grafana 配置验证', () => {
  test('grafana/dashboard.json 是有效的 JSON', () => {
    const dashboard = readJSON(GRAFANA_DASHBOARD_PATH) as Record<string, unknown>
    expect(dashboard, 'dashboard 应为对象').toBeTruthy()
    expect(dashboard.title, '应包含标题').toBe('智汇AI - 前端监控看板')
    expect(dashboard.refresh, '刷新间隔 15s').toBe('15s')
    expect(dashboard.schemaVersion, 'schemaVersion 应为 39').toBe(39)
    console.log('[P9-6] Grafana dashboard.json 有效 ✅')
  })

  test('Grafana dashboard 包含 8 个面板', () => {
    const dashboard = readJSON(GRAFANA_DASHBOARD_PATH) as { panels: unknown[] }
    expect(dashboard.panels, '应包含 panels 数组').toBeTruthy()
    expect(dashboard.panels.length, '应有 8 个面板').toBe(8)
    console.log(`[P9-6] Grafana 面板数量: ${dashboard.panels.length} ✅`)
  })

  test('Grafana dashboard 包含 Core Web Vitals 面板', () => {
    const dashboard = readJSON(GRAFANA_DASHBOARD_PATH) as { panels: Array<{ title: string }> }
    const titles = dashboard.panels.map((p) => p.title)
    expect(titles.some((t) => t.includes('LCP')), '应包含 LCP 面板').toBe(true)
    expect(titles.some((t) => t.includes('CLS')), '应包含 CLS 面板').toBe(true)
    expect(titles.some((t) => t.includes('INP')), '应包含 INP 面板').toBe(true)
    expect(titles.some((t) => t.includes('错误率')), '应包含错误率面板').toBe(true)
    console.log('[P9-6] Core Web Vitals 面板存在 ✅')
  })

  test('grafana/datasources.json 包含 Prometheus + Elasticsearch', () => {
    const datasources = readJSON(GRAFANA_DATASOURCES_PATH) as { datasources: Array<{ name: string; type: string }> }
    expect(datasources.datasources.length, '应至少 2 个数据源').toBeGreaterThanOrEqual(2)
    const names = datasources.datasources.map((d) => d.name)
    expect(names, '应包含 Prometheus').toContain('Prometheus')
    expect(names, '应包含 Elasticsearch').toContain('Elasticsearch')
    console.log('[P9-6] Grafana 数据源配置完整 ✅')
  })

  test('grafana/alerts.yml 包含告警规则', () => {
    const content = readText(GRAFANA_ALERTS_PATH)
    expect(content, '包含 LCP 告警').toMatch(/LCPTooHigh/)
    expect(content, '包含 CLS 告警').toMatch(/CLSTooHigh/)
    expect(content, '包含 INP 告警').toMatch(/INPTooHigh/)
    expect(content, '包含错误率告警').toMatch(/FrontendErrorRateHigh/)
    expect(content, '包含 CSP 告警').toMatch(/CSPViolationsSpike/)
    expect(content, '包含 API 错误告警').toMatch(/ApiErrorRateHigh/)
    console.log('[P9-6] Grafana 告警规则完整 ✅')
  })
})

test.describe('P9-6 监控数据看板 - 环境变量验证', () => {
  test('.env.production 包含监控相关环境变量', () => {
    const content = readText(ENV_PROD_PATH)
    expect(content, '包含 VITE_ENABLE_MONITOR').toMatch(/VITE_ENABLE_MONITOR=true/)
    expect(content, '包含 VITE_MONITOR_REPORT_URL').toMatch(/VITE_MONITOR_REPORT_URL/)
    expect(content, '包含 VITE_SENTRY_DSN').toMatch(/VITE_SENTRY_DSN=/)
    expect(content, '包含 VITE_ERROR_TRACKER_ENV').toMatch(/VITE_ERROR_TRACKER_ENV=production/)
    expect(content, '包含 VITE_ERROR_TRACKER_SAMPLE_RATE').toMatch(/VITE_ERROR_TRACKER_SAMPLE_RATE/)
    expect(content, '包含 VITE_WEB_VITALS_ALERT_URL').toMatch(/VITE_WEB_VITALS_ALERT_URL/)
    expect(content, '包含 VITE_MONITORING_WS_URL').toMatch(/VITE_MONITORING_WS_URL/)
    expect(content, '包含 VITE_CSP_REPORT_URI').toMatch(/VITE_CSP_REPORT_URI/)
    console.log('[P9-6] .env.production 监控变量完整 ✅')
  })

  test('.env.production 监控配置段落存在', () => {
    const content = readText(ENV_PROD_PATH)
    expect(content, '包含监控配置段落标题').toMatch(/监控配置（P9-6）/)
    console.log('[P9-6] .env.production 监控配置段落存在 ✅')
  })
})
