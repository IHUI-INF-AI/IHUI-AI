/**
 * P9-6 监控数据看板 - Grafana 配置
 *
 * 提供 Grafana dashboard JSON 配置 + datasource 配置
 * 用于可视化 Prometheus + ELK 收集的监控数据
 */

/** Grafana datasource 配置（Prometheus + Elasticsearch） */
export const grafanaDatasources = {
  apiVersion: 1,
  datasources: [
    {
      name: 'Prometheus',
      type: 'prometheus',
      access: 'proxy',
      url: 'http://prometheus:9090',
      isDefault: true,
      editable: true,
      jsonData: {
        timeInterval: '15s',
        queryTimeout: '60s',
        httpMethod: 'POST',
      },
    },
    {
      name: 'Elasticsearch',
      type: 'elasticsearch',
      access: 'proxy',
      url: 'http://elasticsearch:9200',
      isDefault: false,
      editable: true,
      database: 'filebeat-*',
      jsonData: {
        esVersion: '8.11.0',
        timeField: '@timestamp',
        interval: 'Daily',
        logLevelField: 'log.level',
        logMessageField: 'message',
      },
    },
  ],
}

/** Grafana dashboard JSON 配置 */
export const monitoringDashboardConfig = {
  title: '智汇AI - 前端监控看板',
  timezone: 'browser',
  schemaVersion: 39,
  version: 1,
  refresh: '15s',
  time: {
    from: 'now-1h',
    to: 'now',
  },
  panels: [
    {
      id: 1,
      title: 'Core Web Vitals - LCP',
      type: 'stat',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'histogram_quantile(0.75, sum(rate(web_vitals_lcp_bucket[5m])) by (le))',
          legendFormat: 'LCP p75',
        },
      ],
      fieldConfig: {
        defaults: {
          unit: 's',
          thresholds: {
            steps: [
              { color: 'green', value: 0 },
              { color: 'yellow', value: 2.5 },
              { color: 'red', value: 4.0 },
            ],
          },
        },
      },
      gridPos: { h: 6, w: 6, x: 0, y: 0 },
    },
    {
      id: 2,
      title: 'Core Web Vitals - CLS',
      type: 'stat',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'histogram_quantile(0.75, sum(rate(web_vitals_cls_bucket[5m])) by (le))',
          legendFormat: 'CLS p75',
        },
      ],
      fieldConfig: {
        defaults: {
          unit: 'none',
          thresholds: {
            steps: [
              { color: 'green', value: 0 },
              { color: 'yellow', value: 0.1 },
              { color: 'red', value: 0.25 },
            ],
          },
        },
      },
      gridPos: { h: 6, w: 6, x: 6, y: 0 },
    },
    {
      id: 3,
      title: 'Core Web Vitals - INP',
      type: 'stat',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'histogram_quantile(0.75, sum(rate(web_vitals_inp_bucket[5m])) by (le))',
          legendFormat: 'INP p75',
        },
      ],
      fieldConfig: {
        defaults: {
          unit: 'ms',
          thresholds: {
            steps: [
              { color: 'green', value: 0 },
              { color: 'yellow', value: 200 },
              { color: 'red', value: 500 },
            ],
          },
        },
      },
      gridPos: { h: 6, w: 6, x: 12, y: 0 },
    },
    {
      id: 4,
      title: '错误率',
      type: 'stat',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'sum(rate(frontend_errors_total[5m])) / sum(rate(frontend_requests_total[5m])) * 100',
          legendFormat: '错误率 %',
        },
      ],
      fieldConfig: {
        defaults: {
          unit: 'percent',
          thresholds: {
            steps: [
              { color: 'green', value: 0 },
              { color: 'yellow', value: 1 },
              { color: 'red', value: 5 },
            ],
          },
        },
      },
      gridPos: { h: 6, w: 6, x: 18, y: 0 },
    },
    {
      id: 5,
      title: '页面加载性能趋势',
      type: 'timeseries',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'histogram_quantile(0.5, sum(rate(web_vitals_ttfb_bucket[5m])) by (le))',
          legendFormat: 'TTFB p50',
        },
        {
          expr: 'histogram_quantile(0.5, sum(rate(web_vitals_fcp_bucket[5m])) by (le))',
          legendFormat: 'FCP p50',
        },
        {
          expr: 'histogram_quantile(0.5, sum(rate(web_vitals_lcp_bucket[5m])) by (le))',
          legendFormat: 'LCP p50',
        },
      ],
      fieldConfig: {
        defaults: {
          unit: 'ms',
        },
      },
      gridPos: { h: 10, w: 24, x: 0, y: 6 },
    },
    {
      id: 6,
      title: 'CSP 违规上报',
      type: 'timeseries',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'sum(rate(csp_violations_total[5m])) by (directive)',
          legendFormat: '{{directive}}',
        },
      ],
      fieldConfig: {
        defaults: {
          unit: 'ops',
        },
      },
      gridPos: { h: 8, w: 12, x: 0, y: 16 },
    },
    {
      id: 7,
      title: 'API 请求错误分布',
      type: 'piechart',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'sum(rate(api_errors_total[5m])) by (status_code)',
          legendFormat: '{{status_code}}',
        },
      ],
      gridPos: { h: 8, w: 12, x: 12, y: 16 },
    },
    {
      id: 8,
      title: '错误日志（ELK）',
      type: 'logs',
      datasource: 'Elasticsearch',
      targets: [
        {
          query: 'log.level: error OR log.level: fatal',
          refId: 'A',
        },
      ],
      gridPos: { h: 10, w: 24, x: 0, y: 24 },
    },
  ],
}

/** Sentry DSN 配置模板 */
export const sentryConfig = {
  dsn: import.meta.env.VITE_SENTRY_DSN || '',
  environment: import.meta.env.MODE || 'production',
  sampleRate: 1.0,
  tracesSampleRate: 0.1,
  release: import.meta.env.VITE_APP_VERSION || '1.1.0',
  integrations: [
    'BrowserTracing',
    'CaptureConsole',
    'Dedupe',
    'ExtraErrorData',
    'ReportingObserver',
    'HttpContext',
  ],
  beforeSend(event: unknown) {
    // 过滤敏感信息
    return event
  },
}

/** 监控告警规则 */
export const alertRules = [
  {
    name: 'LCP 过高',
    condition: 'web_vitals_lcp > 4000',
    for: '5m',
    severity: 'warning',
    message: 'LCP 超过 4 秒，用户体验不佳',
  },
  {
    name: 'CLS 过高',
    condition: 'web_vitals_cls > 0.25',
    for: '5m',
    severity: 'warning',
    message: 'CLS 超过 0.25，页面布局不稳定',
  },
  {
    name: '错误率过高',
    condition: 'error_rate > 5',
    for: '2m',
    severity: 'critical',
    message: '前端错误率超过 5%',
  },
  {
    name: 'CSP 违规激增',
    condition: 'rate(csp_violations_total[5m]) > 10',
    for: '1m',
    severity: 'warning',
    message: 'CSP 违规上报激增，可能存在安全风险',
  },
]
