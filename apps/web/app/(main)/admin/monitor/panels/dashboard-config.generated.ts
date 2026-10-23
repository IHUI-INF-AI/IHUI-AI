// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 监控面板原生配置(自动生成,请勿手改)。
 *
 * 由 scripts/generate-monitor-panels.mjs 从 monitoring/panel-defs/panels/*.json 转译;
 * 表达式与 Grafana 盘逐条同源(355 条),模板变量已归一为 All 档(.*)。
 * $__interval / $__range 为占位符,由 /admin/monitor/panels 页面按时间窗替换。
 */
export interface PanelTarget {
  ref: string
  expr: string
  legend: string
}

export type PanelKind = 'timeseries' | 'stat' | 'gauge' | 'table' | 'pie' | 'logs'
export type PanelBackend = 'prometheus' | 'loki'

export interface NativePanel {
  id: string
  title: string
  kind: PanelKind
  backend: PanelBackend
  unit?: string
  /** Grafana fieldConfig.defaults 显式声明的量程(gauge 量程以此为准,不再自造) */
  min?: number
  max?: number
  /** Grafana thresholds.steps(从 -Inf 起升序),gauge 渲染成轴色带 */
  thresholds?: Array<{ color: string; value: number | null }>
  span: 'full' | 'half'
  targets: PanelTarget[]
}

export interface NativeDashboard {
  uid: string
  title: string
  group: string
  panels: NativePanel[]
}

export const MONITOR_DASHBOARDS: NativeDashboard[] = [
  {
    "uid": "ihui-ai-ai-agent",
    "title": "IHUI-AI · Agent 与工具链路",
    "group": "AI 可观测",
    "panels": [
      {
        "id": "301",
        "title": "循环执行速率(按收尾原因)",
        "kind": "timeseries",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (status) (rate(ihui_agent_loop_runs_total{job=\"ai-service\"}[1h]))",
            "legend": "{{status}}"
          }
        ]
      },
      {
        "id": "302",
        "title": "循环错误速率(按错误类型)",
        "kind": "timeseries",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (error_type) (rate(ihui_agent_loop_errors_total{job=\"ai-service\"}[1h]))",
            "legend": "{{error_type}}"
          }
        ]
      },
      {
        "id": "304",
        "title": "LLM 重试速率(按错误类型)",
        "kind": "timeseries",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (error_type) (rate(ihui_agent_loop_llm_retries_total{job=\"ai-service\"}[1h]))",
            "legend": "{{error_type}}"
          }
        ]
      },
      {
        "id": "305",
        "title": "工具重试次数(区间)",
        "kind": "stat",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_agent_loop_tool_retries_total{job=\"ai-service\"}[$__range]))",
            "legend": "n"
          }
        ]
      },
      {
        "id": "306",
        "title": "收尾为 max_iterations 的占比",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "percentunit",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 0.05
          },
          {
            "color": "red",
            "value": 0.2
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_agent_loop_runs_total{job=\"ai-service\",status=\"max_iterations\"}[$__range])) / sum(increase(ihui_agent_loop_runs_total{job=\"ai-service\"}[$__range]))",
            "legend": "ratio"
          }
        ]
      },
      {
        "id": "308",
        "title": "融合提案/评审调用速率",
        "kind": "timeseries",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(llm_fusion_proposers_called_total{job=\"ai-service\"}[1h]))",
            "legend": "proposers"
          },
          {
            "ref": "A",
            "expr": "sum(rate(llm_fusion_judge_called_total{job=\"ai-service\"}[1h]))",
            "legend": "judge"
          }
        ]
      },
      {
        "id": "309",
        "title": "融合成功率",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "percentunit",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "red",
            "value": null
          },
          {
            "color": "green",
            "value": 0.7
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(llm_fusion_success_total{job=\"ai-service\"}[$__range])) / (sum(increase(llm_fusion_success_total{job=\"ai-service\"}[$__range])) + sum(increase(llm_fusion_failure_total{job=\"ai-service\"}[$__range])))",
            "legend": "ok"
          }
        ]
      },
      {
        "id": "310",
        "title": "压缩后 token 比 P95",
        "kind": "stat",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "histogram_quantile(0.95, sum by (le) (rate(llm_token_compaction_ratio_bucket{job=\"ai-service\"}[1h])))",
            "legend": "p95"
          }
        ]
      },
      {
        "id": "312",
        "title": "切换触发(主→备)",
        "kind": "timeseries",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (primary_model, backup_model) (rate(llm_fallback_triggered_total{job=\"ai-service\"}[1h]))",
            "legend": "{{primary_model}} → {{backup_model}}"
          }
        ]
      },
      {
        "id": "313",
        "title": "切换失败(主→备)",
        "kind": "timeseries",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (primary_model, backup_model) (rate(llm_fallback_failure_total{job=\"ai-service\"}[1h]))",
            "legend": "{{primary_model}} → {{backup_model}}"
          }
        ]
      },
      {
        "id": "314",
        "title": "Combo 策略配置构成(本机生效值)",
        "kind": "table",
        "backend": "prometheus",
        "unit": "short",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (strategy) (llm_combo_strategy_configs{job=\"ai-service\"})",
            "legend": "{{strategy}}"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-ai-cost",
    "title": "IHUI-AI 模型成本与用量",
    "group": "AI 可观测",
    "panels": [
      {
        "id": "201",
        "title": "区间总支出(USD)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "currencyUSD",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_llm_cost_usd_total{job=\"ai-service\",provider=~\".*\"}[$__range]))",
            "legend": "total"
          }
        ]
      },
      {
        "id": "202",
        "title": "每小时支出",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "currencyUSD",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_llm_cost_usd_total{job=\"ai-service\",provider=~\".*\"}[1h]))",
            "legend": "per-hour"
          }
        ]
      },
      {
        "id": "203",
        "title": "每千 token 单价(USD)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "currencyUSD",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(ihui_llm_cost_usd_total{job=\"ai-service\",provider=~\".*\"}[1h])) / clamp_min(sum(rate(ihui_llm_tokens_total{job=\"ai-service\",direction=~\"input|output\"}[1h])),0.0001) * 1000",
            "legend": "k"
          }
        ]
      },
      {
        "id": "204",
        "title": "支出是否在被采集",
        "kind": "stat",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "red",
            "value": 0
          },
          {
            "color": "green",
            "value": 1
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "count(ihui_llm_cost_usd_total{job=\"ai-service\",provider=~\".*\"})",
            "legend": "series"
          }
        ]
      },
      {
        "id": "206",
        "title": "支出趋势(按厂商)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "currencyUSD",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (provider) (rate(ihui_llm_cost_usd_total{job=\"ai-service\",provider=~\".*\"}[1h]))",
            "legend": "{{provider}}"
          }
        ]
      },
      {
        "id": "207",
        "title": "支出趋势(按模型)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "currencyUSD",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (model) (rate(ihui_llm_cost_usd_total{job=\"ai-service\",provider=~\".*\"}[1h]))",
            "legend": "{{model}}"
          }
        ]
      },
      {
        "id": "208",
        "title": "Token 输入/输出速率",
        "kind": "timeseries",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(ihui_llm_tokens_total{job=\"ai-service\",direction=\"input\"}[1h]))",
            "legend": "input"
          },
          {
            "ref": "A",
            "expr": "sum(rate(ihui_llm_tokens_total{job=\"ai-service\",direction=\"output\"}[1h]))",
            "legend": "output"
          },
          {
            "ref": "A",
            "expr": "sum(rate(ihui_llm_tokens_total{job=\"ai-service\",direction=\"cache_read\"}[1h]))",
            "legend": "cache_read"
          },
          {
            "ref": "A",
            "expr": "sum(rate(ihui_llm_tokens_total{job=\"ai-service\",direction=\"cache_read\"}[1h]))",
            "legend": "cache_creation"
          }
        ]
      },
      {
        "id": "209",
        "title": "模型支出排行(区间)",
        "kind": "table",
        "backend": "prometheus",
        "unit": "currencyUSD",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (model, provider) (increase(ihui_llm_cost_usd_total{job=\"ai-service\",provider=~\".*\"}[$__range]))",
            "legend": "m"
          }
        ]
      },
      {
        "id": "501",
        "title": "区间 AI 支出(CNY 元)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "currencyCNY",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(business_ai_cost_minor_units_total{job=\"business-metrics\",vendor=~\".*\"}[$__range])) / 100",
            "legend": "cost"
          }
        ]
      },
      {
        "id": "502",
        "title": "落账调用速率(按类型)",
        "kind": "timeseries",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (call_type, status) (rate(business_ai_calls_total{job=\"business-metrics\",vendor=~\".*\"}[1h]))",
            "legend": "{{call_type}} {{status}}"
          }
        ]
      },
      {
        "id": "503",
        "title": "Token 速率(按方向)",
        "kind": "timeseries",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (direction) (rate(business_ai_tokens_total{job=\"business-metrics\",vendor=~\".*\"}[1h]))",
            "legend": "{{direction}}"
          }
        ]
      },
      {
        "id": "504",
        "title": "成本落库失败(区间,应为 0)",
        "kind": "stat",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "green",
            "value": null
          },
          {
            "color": "red",
            "value": 1
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "(sum(increase(business_ai_record_failures_total{job=\"business-metrics\"}[$__range]))) or vector(0)",
            "legend": "fail"
          }
        ]
      },
      {
        "id": "505",
        "title": "被基数护栏拒掉的序列写入(区间)",
        "kind": "stat",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 1
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(business_ai_series_dropped_total{job=\"business-metrics\"}[$__range]))",
            "legend": "dropped"
          }
        ]
      },
      {
        "id": "506",
        "title": "端点抓取存活",
        "kind": "stat",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "red",
            "value": null
          },
          {
            "color": "green",
            "value": 1
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "up{job=\"business-metrics\"}",
            "legend": "up"
          }
        ]
      },
      {
        "id": "507",
        "title": "厂商×模型支出排行(区间 CNY 元)",
        "kind": "table",
        "backend": "prometheus",
        "unit": "currencyCNY",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (vendor, model) (increase(business_ai_cost_minor_units_total{job=\"business-metrics\",vendor=~\".*\"}[$__range])) / 100",
            "legend": "m"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-deep-pipeline",
    "title": "IHUI-AI · AI 深度链路(压缩 / MCP / TTFT)",
    "group": "AI 可观测",
    "panels": [
      {
        "id": "stat-0",
        "title": "号池冷却中的腿数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(ihui_llm_pool_leg_in_cooldown)",
            "legend": "冷却中的腿"
          }
        ]
      },
      {
        "id": "stat-1",
        "title": "LLM 请求平均耗时(秒)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "s",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_llm_request_duration_seconds_sum[$__range])) / clamp_min(sum(increase(ihui_llm_request_duration_seconds_count[$__range])), 0.000001)",
            "legend": "平均耗时"
          }
        ]
      },
      {
        "id": "stat-2",
        "title": "首 token 时延 TTFT(秒)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "s",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "orange",
            "value": 2
          },
          {
            "color": "red",
            "value": 5
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_llm_ttft_seconds_sum[$__range])) / clamp_min(sum(increase(ihui_llm_ttft_seconds_count[$__range])), 0.000001)",
            "legend": "TTFT"
          }
        ]
      },
      {
        "id": "timeseries-3",
        "title": "TTFT 事件计数(窗口内)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_llm_ttft_seconds_count[$__range]))",
            "legend": "TTFT 事件"
          },
          {
            "ref": "B",
            "expr": "sum(increase(ihui_llm_stream_interrupt_total[$__range]))",
            "legend": "流式中断"
          }
        ]
      },
      {
        "id": "timeseries-4",
        "title": "Token 压缩:触发 / 成功 / 失败",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(llm_token_compaction_triggered_total[$__range]))",
            "legend": "触发"
          },
          {
            "ref": "B",
            "expr": "sum(increase(llm_token_compaction_success_total[$__range]))",
            "legend": "成功"
          },
          {
            "ref": "C",
            "expr": "sum(increase(llm_token_compaction_failure_total[$__range]))",
            "legend": "失败"
          }
        ]
      },
      {
        "id": "timeseries-5",
        "title": "Token 压缩比(压缩后/压缩前,越小越好)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(llm_token_compaction_ratio_sum[$__range])) / clamp_min(sum(increase(llm_token_compaction_ratio_count[$__range])), 0.000001)",
            "legend": "压缩比"
          }
        ]
      },
      {
        "id": "timeseries-6",
        "title": "上下文压缩事件数",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_compaction_events_total[$__range]))",
            "legend": "压缩事件"
          },
          {
            "ref": "B",
            "expr": "sum(increase(ihui_context_recall_queries_total[$__range]))",
            "legend": "上下文召回查询"
          }
        ]
      },
      {
        "id": "timeseries-7",
        "title": "上下文压缩:run 结局分布",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (outcome) (increase(ihui_compaction_run_outcomes_total[$__range]))",
            "legend": "{{outcome}}"
          }
        ]
      },
      {
        "id": "timeseries-8",
        "title": "上下文压缩平均耗时(秒)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "s",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_compaction_duration_seconds_sum[$__range])) / clamp_min(sum(increase(ihui_compaction_duration_seconds_count[$__range])), 0.000001)",
            "legend": "压缩耗时"
          }
        ]
      },
      {
        "id": "timeseries-9",
        "title": "上下文压缩比(越小越好)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_compaction_ratio_sum[$__range])) / clamp_min(sum(increase(ihui_compaction_ratio_count[$__range])), 0.000001)",
            "legend": "压缩比"
          }
        ]
      },
      {
        "id": "timeseries-10",
        "title": "推理内容保留率(越高越好)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_compaction_reasoning_retention_sum[$__range])) / clamp_min(sum(increase(ihui_compaction_reasoning_retention_count[$__range])), 0.000001)",
            "legend": "保留率"
          }
        ]
      },
      {
        "id": "timeseries-11",
        "title": "MCP 工具调用次数",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_mcp_tool_calls_total[$__range]))",
            "legend": "工具调用"
          }
        ]
      },
      {
        "id": "timeseries-12",
        "title": "MCP 工具平均耗时(秒)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "s",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_mcp_tool_latency_seconds_sum[$__range])) / clamp_min(sum(increase(ihui_mcp_tool_latency_seconds_count[$__range])), 0.000001)",
            "legend": "工具耗时"
          }
        ]
      },
      {
        "id": "timeseries-13",
        "title": "MCP schema 不匹配次数",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "red",
            "value": 1
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_mcp_schema_mismatch_total[$__range]))",
            "legend": "schema 不匹配"
          }
        ]
      },
      {
        "id": "timeseries-14",
        "title": "压缩决策链长度",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_compaction_decision_chain_entries_sum[$__range])) / clamp_min(sum(increase(ihui_compaction_decision_chain_entries_count[$__range])), 0.000001)",
            "legend": "决策链条目"
          }
        ]
      },
      {
        "id": "stat-15",
        "title": "可用 relay key 数(选路选得到)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "green",
            "value": 0.5
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(ihui_relay_key_pool_schedulable_keys{job=\"business-metrics\"})",
            "legend": "可用 key"
          }
        ]
      },
      {
        "id": "stat-16",
        "title": "异常 relay key 数(degraded + down)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "orange",
            "value": 1
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(ihui_relay_key_pool_keys{job=\"business-metrics\",state=~\"degraded|down\"})",
            "legend": "异常 key"
          }
        ]
      },
      {
        "id": "stat-17",
        "title": "可用 relay 账号数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "green",
            "value": 0.5
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(ihui_relay_account_pool_schedulable{job=\"business-metrics\"})",
            "legend": "可用账号"
          }
        ]
      },
      {
        "id": "stat-18",
        "title": "key 池刷新滞后(秒;5 分钟一轮)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "s",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "orange",
            "value": 600
          },
          {
            "color": "red",
            "value": 1800
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "time() - ihui_relay_key_pool_refresh_last_success_timestamp_seconds{job=\"business-metrics\"}",
            "legend": "刷新滞后"
          }
        ]
      },
      {
        "id": "timeseries-19",
        "title": "Relay key 健康态分布(按 provider 折叠)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (provider_code, state) (ihui_relay_key_pool_keys{job=\"business-metrics\"})",
            "legend": "{{provider_code}}·{{state}}"
          }
        ]
      },
      {
        "id": "timeseries-20",
        "title": "账号连续失败(熔断计数,按账号)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "orange",
            "value": 3
          },
          {
            "color": "red",
            "value": 5
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "ihui_relay_account_pool_consecutive_failures{job=\"business-metrics\"}",
            "legend": "{{provider_code}}/{{account}}"
          }
        ]
      },
      {
        "id": "timeseries-21",
        "title": "账号 token 临期(秒;负 = 已过期)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "s",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "ihui_relay_account_pool_token_expires_in_seconds{job=\"business-metrics\"}",
            "legend": "{{provider_code}}/{{account}}"
          }
        ]
      },
      {
        "id": "timeseries-22",
        "title": "最陈的 10 条 key(健康检查年龄,秒)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "s",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "topk(10, ihui_relay_key_pool_health_age_seconds{job=\"business-metrics\"})",
            "legend": "{{provider_code}}/{{key}}"
          }
        ]
      },
      {
        "id": "timeseries-23",
        "title": "账号累计转发调用(按账号)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "ihui_relay_account_pool_total_calls{job=\"business-metrics\"}",
            "legend": "{{provider_code}}/{{account}}"
          }
        ]
      },
      {
        "id": "timeseries-24",
        "title": "号池采集丢失(窗口增量;脏行 + 标签撞车)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "red",
            "value": 1
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_relay_key_pool_rows_skipped_total{job=\"business-metrics\"}[$__range]))",
            "legend": "key 脏行"
          },
          {
            "ref": "B",
            "expr": "sum(increase(ihui_relay_key_pool_label_collisions_total{job=\"business-metrics\"}[$__range]))",
            "legend": "key 标签撞车"
          },
          {
            "ref": "C",
            "expr": "sum(increase(ihui_relay_account_pool_rows_skipped_total{job=\"business-metrics\"}[$__range]))",
            "legend": "账号脏行"
          },
          {
            "ref": "D",
            "expr": "sum(increase(ihui_relay_account_pool_label_collisions_total{job=\"business-metrics\"}[$__range]))",
            "legend": "账号标签撞车"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-ai-latency",
    "title": "IHUI-AI 模型延迟分布",
    "group": "AI 可观测",
    "panels": [
      {
        "id": "101",
        "title": "P50 延迟",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "s",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 3
          },
          {
            "color": "red",
            "value": 10
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "histogram_quantile(0.5, sum by (le) (rate(ihui_llm_request_duration_seconds_bucket{job=\"ai-service\"}[1h])))",
            "legend": "P50"
          }
        ]
      },
      {
        "id": "102",
        "title": "P95 延迟",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "s",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 5
          },
          {
            "color": "red",
            "value": 15
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "histogram_quantile(0.95, sum by (le) (rate(ihui_llm_request_duration_seconds_bucket{job=\"ai-service\"}[1h])))",
            "legend": "P95"
          }
        ]
      },
      {
        "id": "103",
        "title": "P99 延迟",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "s",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 10
          },
          {
            "color": "red",
            "value": 30
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "histogram_quantile(0.99, sum by (le) (rate(ihui_llm_request_duration_seconds_bucket{job=\"ai-service\"}[1h])))",
            "legend": "P99"
          }
        ]
      },
      {
        "id": "104",
        "title": "错误占比(含超时)",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "percentunit",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 0.01
          },
          {
            "color": "red",
            "value": 0.05
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_llm_calls_total{job=\"ai-service\",status=\"error\"}[$__range])) / sum(increase(ihui_llm_calls_total{job=\"ai-service\",provider=~\".*\"}[$__range]))",
            "legend": "timeout"
          }
        ]
      },
      {
        "id": "106",
        "title": "TTFT P95(按厂商)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "s",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "histogram_quantile(0.95, sum by (le, provider) (rate(ihui_llm_ttft_seconds_bucket{job=\"ai-service\"}[1h])))",
            "legend": "{{provider}}"
          }
        ]
      },
      {
        "id": "107",
        "title": "流式中断速率(按原因)",
        "kind": "timeseries",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (provider, reason) (rate(ihui_llm_stream_interrupt_total{job=\"ai-service\"}[1h]))",
            "legend": "{{provider}} {{reason}}"
          }
        ]
      },
      {
        "id": "109",
        "title": "模型调用速率 Top10",
        "kind": "timeseries",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "topk(10, sum by (model) (rate(ihui_llm_calls_total{job=\"ai-service\",provider=~\".*\"}[1h])))",
            "legend": "{{model}}"
          }
        ]
      },
      {
        "id": "110",
        "title": "模型 P95 延迟 Top10",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "s",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "topk(10, histogram_quantile(0.95, sum by (le, model) (rate(ihui_llm_request_duration_seconds_bucket{job=\"ai-service\"}[1h]))))",
            "legend": "{{model}}"
          }
        ]
      },
      {
        "id": "111",
        "title": "厂商错误率",
        "kind": "timeseries",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (provider) (rate(ihui_llm_provider_errors_total{job=\"ai-service\",provider=~\".*\"}[1h]))",
            "legend": "{{provider}}"
          }
        ]
      },
      {
        "id": "112",
        "title": "P95 延迟热区(厂商×模型)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "s",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "histogram_quantile(0.95, sum by (le, provider, model) (rate(ihui_llm_request_duration_seconds_bucket{job=\"ai-service\"}[1h])))",
            "legend": "{{provider}}/{{model}}"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-logs",
    "title": "IHUI-AI 智能体与模型日志(可下钻)",
    "group": "AI 可观测",
    "panels": [
      {
        "id": "201",
        "title": "日志速率(按服务)",
        "kind": "timeseries",
        "backend": "loki",
        "unit": "logs/s",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (job) (rate({job=~\"api|ai-service\"}[$__interval]))",
            "legend": "{{job}}"
          }
        ]
      },
      {
        "id": "202",
        "title": "AI 服务错误/失败/告警(15m 滚动计数)",
        "kind": "timeseries",
        "backend": "loki",
        "unit": "short",
        "thresholds": [
          {
            "color": "text",
            "value": null
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(count_over_time({job=\"ai-service\"} |~ \"(?i)error|exception|traceback\" [15m]))",
            "legend": "错误/异常"
          },
          {
            "ref": "B",
            "expr": "sum(count_over_time({job=\"ai-service\"} |~ \"(?i)failed|failure\" [15m]))",
            "legend": "失败"
          },
          {
            "ref": "C",
            "expr": "sum(count_over_time({job=\"ai-service\"} |~ \"(?i)warning|warn\" [15m]))",
            "legend": "告警"
          }
        ]
      },
      {
        "id": "204",
        "title": "模型降级(fallback,15m 滚动计数)",
        "kind": "timeseries",
        "backend": "loki",
        "unit": "short",
        "thresholds": [
          {
            "color": "orange",
            "value": null
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(count_over_time({job=\"ai-service\"} |~ \"(?i)fallback\" [15m]))",
            "legend": "降级"
          }
        ]
      },
      {
        "id": "205",
        "title": "超时事件(15m 滚动计数)",
        "kind": "timeseries",
        "backend": "loki",
        "unit": "short",
        "thresholds": [
          {
            "color": "red",
            "value": null
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(count_over_time({job=\"ai-service\"} |~ \"(?i)timeout|timed out\" [15m]))",
            "legend": "超时"
          }
        ]
      },
      {
        "id": "206",
        "title": "当前时间窗内 AI 错误行总数",
        "kind": "stat",
        "backend": "loki",
        "unit": "short",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "orange",
            "value": 1000
          },
          {
            "color": "red",
            "value": 10000
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(count_over_time({job=\"ai-service\"} |~ \"(?i)error|exception|traceback\" [$__range]))",
            "legend": "错误行总数"
          }
        ]
      },
      {
        "id": "208",
        "title": "AI 服务异常日志流",
        "kind": "logs",
        "backend": "loki",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "{job=\"ai-service\"} |~ \"(?i)error|exception|traceback|fallback|timeout\"",
            "legend": ""
          }
        ]
      },
      {
        "id": "209",
        "title": "Python 堆栈(Traceback)",
        "kind": "logs",
        "backend": "loki",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "{job=\"ai-service\"} |~ \"Traceback|raise |Error:\"",
            "legend": ""
          }
        ]
      },
      {
        "id": "210",
        "title": "厂商 / 模型 / 网关日志",
        "kind": "logs",
        "backend": "loki",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "{job=\"ai-service\"} |~ \"(?i)provider|model|litellm|api_key\"",
            "legend": ""
          }
        ]
      },
      {
        "id": "211",
        "title": "API 侧异常日志流(与 AI 链路对照)",
        "kind": "logs",
        "backend": "loki",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "{job=\"api\"} |~ \"(?i)error|exception|unhandled\"",
            "legend": ""
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-alert-history",
    "title": "IHUI-AI 告警历史与趋势",
    "group": "AI 可观测",
    "panels": [
      {
        "id": "1",
        "title": "24h 告警总数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 100
          },
          {
            "color": "red",
            "value": 500
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(alertmanager_alerts_received_total{instance=~\".*\"}[$__range]))",
            "legend": "接收告警数"
          }
        ]
      },
      {
        "id": "2",
        "title": "告警状态分布",
        "kind": "pie",
        "backend": "prometheus",
        "unit": "short",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (state) (alertmanager_alerts{instance=~\".*\"})",
            "legend": "{{state}}"
          }
        ]
      },
      {
        "id": "3",
        "title": "告警平均处理耗时 (ms)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "ms",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 15
          },
          {
            "color": "red",
            "value": 60
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "1000 * sum(rate(alertmanager_dispatcher_alert_processing_duration_seconds_sum{instance=~\".*\"}[5m])) / sum(rate(alertmanager_dispatcher_alert_processing_duration_seconds_count{instance=~\".*\"}[5m]))",
            "legend": "平均处理耗时"
          }
        ]
      },
      {
        "id": "4",
        "title": "聚合组数量",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "max": 100,
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 20
          },
          {
            "color": "red",
            "value": 50
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "max(alertmanager_dispatcher_aggregation_groups{instance=~\".*\"})",
            "legend": "聚合组"
          }
        ]
      },
      {
        "id": "5",
        "title": "告警投递台账(窗口内增量)",
        "kind": "table",
        "backend": "prometheus",
        "unit": "short",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(alertmanager_alerts_received_total{instance=~\".*\", status=\"firing\"}[$__range]))",
            "legend": "收到(触发)"
          },
          {
            "ref": "B",
            "expr": "sum(increase(alertmanager_alerts_received_total{instance=~\".*\", status=\"resolved\"}[$__range]))",
            "legend": "收到(恢复)"
          },
          {
            "ref": "C",
            "expr": "sum(increase(ihui_alertbridge_alerts_dedup_suppressed_total{instance=~\".*\"}[$__range]))",
            "legend": "去重抑制"
          },
          {
            "ref": "D",
            "expr": "sum(increase(ihui_alertbridge_mail_alerts_delivered_total{instance=~\".*\"}[$__range]))",
            "legend": "投递到人"
          },
          {
            "ref": "E",
            "expr": "sum(increase(ihui_alertbridge_mail_batches_failed_total{instance=~\".*\"}[$__range]))",
            "legend": "投递失败"
          }
        ]
      },
      {
        "id": "6",
        "title": "告警接收速率 (按状态)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "reqps",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (status) (rate(alertmanager_alerts_received_total{instance=~\".*\"}[5m]))",
            "legend": "{{status}}"
          }
        ]
      },
      {
        "id": "7",
        "title": "邮件桥投递速率",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "reqps",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(ihui_alertbridge_alerts_received_total{instance=~\".*\"}[5m]))",
            "legend": "收到"
          },
          {
            "ref": "B",
            "expr": "sum(rate(ihui_alertbridge_alerts_dedup_suppressed_total{instance=~\".*\"}[5m]))",
            "legend": "去重抑制"
          },
          {
            "ref": "C",
            "expr": "sum(rate(ihui_alertbridge_mail_alerts_delivered_total{instance=~\".*\"}[5m]))",
            "legend": "投递到人"
          },
          {
            "ref": "D",
            "expr": "sum(rate(ihui_alertbridge_mail_batches_failed_total{instance=~\".*\"}[5m]))",
            "legend": "投递失败"
          }
        ]
      },
      {
        "id": "8",
        "title": "活跃与抑制告警数趋势",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (state) (alertmanager_alerts{instance=~\".*\"})",
            "legend": "{{state}}"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-app-golden-signals",
    "title": "IHUI-AI 应用层黄金指标",
    "group": "基础设施",
    "panels": [
      {
        "id": "1",
        "title": "API 总 QPS",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "reqps",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(http_requests_by_status[$__interval]))",
            "legend": "QPS"
          }
        ]
      },
      {
        "id": "2",
        "title": "5xx 占比",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "percent",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "orange",
            "value": 1
          },
          {
            "color": "red",
            "value": 5
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "100 * sum(rate(http_requests_by_status{status=~\"5..\"}[$__range])) / clamp_min(sum(rate(http_requests_by_status[$__range])), 0.000001)",
            "legend": "5xx %"
          }
        ]
      },
      {
        "id": "3",
        "title": "在途请求数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(inflight_requests)",
            "legend": "在途"
          }
        ]
      },
      {
        "id": "4",
        "title": "请求速率(按状态码)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "reqps",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (status) (rate(http_requests_by_status[$__interval]))",
            "legend": "{{status}}"
          }
        ]
      },
      {
        "id": "5",
        "title": "请求速率(按方法)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "reqps",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (method) (rate(http_requests_by_method[$__interval]))",
            "legend": "{{method}}"
          }
        ]
      },
      {
        "id": "6",
        "title": "API 平均响应耗时(ms)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "ms",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "http_response_time_ms_avg",
            "legend": "平均耗时"
          }
        ]
      },
      {
        "id": "7",
        "title": "ai-service 平均请求耗时(秒)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "s",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(http_request_duration_seconds_sum[$__range])) / clamp_min(sum(increase(http_request_duration_seconds_count[$__range])), 0.000001)",
            "legend": "平均耗时"
          }
        ]
      },
      {
        "id": "8",
        "title": "数据库连接池使用率",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "percent",
        "min": 0,
        "max": 100,
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "orange",
            "value": 60
          },
          {
            "color": "red",
            "value": 85
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "100 * db_pool_in_use / clamp_min(db_pool_size, 1)",
            "legend": "使用率"
          }
        ]
      },
      {
        "id": "9",
        "title": "连接池水位(size / 在用 / 检出)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "db_pool_size",
            "legend": "池容量"
          },
          {
            "ref": "B",
            "expr": "db_pool_in_use",
            "legend": "在用"
          },
          {
            "ref": "C",
            "expr": "db_pool_checkedout",
            "legend": "检出"
          },
          {
            "ref": "D",
            "expr": "db_pool_overflow",
            "legend": "溢出"
          }
        ]
      },
      {
        "id": "10",
        "title": "连接池检出超时速率",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "red",
            "value": 1
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(db_pool_checkout_timeouts_total[$__interval]))",
            "legend": "超时/秒"
          }
        ]
      },
      {
        "id": "11",
        "title": "应用侧缓存命中率",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "percent",
        "min": 0,
        "max": 100,
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "orange",
            "value": 50
          },
          {
            "color": "green",
            "value": 80
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "business_cache_hit_ratio * 100",
            "legend": "命中率"
          }
        ]
      },
      {
        "id": "12",
        "title": "SQL 平均耗时(秒)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "s",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(sql_query_duration_seconds_sum[$__interval])) / clamp_min(sum(rate(sql_query_duration_seconds_count[$__interval])), 0.000001)",
            "legend": "平均耗时"
          }
        ]
      },
      {
        "id": "13",
        "title": "SQL 速率(按操作类型)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "ops",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (operation) (rate(sql_queries_total[$__interval]))",
            "legend": "{{operation}}"
          }
        ]
      },
      {
        "id": "14",
        "title": "进程常驻内存(按 job)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "bytes",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (job) (process_resident_memory_bytes)",
            "legend": "{{job}}"
          }
        ]
      },
      {
        "id": "15",
        "title": "进程 CPU 使用率(按 job)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "percent",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (job) (rate(process_cpu_seconds_total[$__interval])) * 100",
            "legend": "{{job}}"
          }
        ]
      },
      {
        "id": "16",
        "title": "进程打开文件数(按 job)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (job) (process_open_fds)",
            "legend": "{{job}}"
          }
        ]
      },
      {
        "id": "17",
        "title": "Python GC 回收速率(按 job)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (job) (rate(python_gc_objects_collected_total[$__interval]))",
            "legend": "{{job}}"
          }
        ]
      },
      {
        "id": "18",
        "title": "活跃连接数",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "active_connections",
            "legend": "活跃连接"
          },
          {
            "ref": "B",
            "expr": "tcp_connections",
            "legend": "TCP 连接"
          }
        ]
      },
      {
        "id": "19",
        "title": "出站连接失败速率(按 job)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (job) (rate(net_conntrack_dialer_conn_failed_total[$__interval]))",
            "legend": "{{job}}"
          }
        ]
      },
      {
        "id": "20",
        "title": "模型同步:在库模型数",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "model_sync_total_models_in_db",
            "legend": "{{instance}}"
          }
        ]
      },
      {
        "id": "21",
        "title": "模型同步平均耗时(秒)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "s",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(model_sync_latency_seconds_sum[$__range])) / clamp_min(sum(increase(model_sync_latency_seconds_count[$__range])), 0.000001)",
            "legend": "平均耗时"
          }
        ]
      },
      {
        "id": "22",
        "title": "RSSHub 请求与错误速率",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "reqps",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(rsshub_request_total[$__interval]))",
            "legend": "请求/秒"
          },
          {
            "ref": "B",
            "expr": "sum(rate(rsshub_request_error_total[$__interval]))",
            "legend": "错误/秒"
          }
        ]
      },
      {
        "id": "23",
        "title": "HTTP 请求速率",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (job) (rate(http_requests_total[5m]))",
            "legend": "job={{job}}"
          },
          {
            "ref": "B",
            "expr": "sum by (method) (rate(http_requests_by_method[5m]))",
            "legend": "method={{method}}"
          }
        ]
      },
      {
        "id": "24",
        "title": "HTTP 耗时(P95 与平均)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "s",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[6h])))",
            "legend": "P95"
          },
          {
            "ref": "B",
            "expr": "sum(http_request_duration_seconds_sum) / sum(http_request_duration_seconds_count)",
            "legend": "平均"
          }
        ]
      },
      {
        "id": "25",
        "title": "SQL 查询耗时 P95(按操作)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "s",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "histogram_quantile(0.95, sum by (le, operation) (rate(sql_query_duration_seconds_bucket[5m])))",
            "legend": "{{operation}}"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-auth-security",
    "title": "IHUI-AI 认证安全监控",
    "group": "业务",
    "panels": [
      {
        "id": "gauge-0",
        "title": "登录成功率",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "percentunit",
        "min": 0,
        "max": 1,
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "yellow",
            "value": 0.7
          },
          {
            "color": "green",
            "value": 0.9
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_auth_login_success_total{instance=~\".*\"}[5m])) / sum(increase(ihui_auth_login_attempt_total{instance=~\".*\"}[5m]))",
            "legend": "登录成功"
          }
        ]
      },
      {
        "id": "stat-1",
        "title": "JWT 签发数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "ops",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(ihui_auth_jwt_issued_total{instance=~\".*\"}[5m]))",
            "legend": "JWT/s"
          }
        ]
      },
      {
        "id": "stat-2",
        "title": "异常登录数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 20
          },
          {
            "color": "red",
            "value": 100
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_auth_login_anomaly_total{instance=~\".*\"}[1h]))",
            "legend": "异常登录"
          }
        ]
      },
      {
        "id": "stat-3",
        "title": "Token 撤销数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_auth_token_revoked_total{instance=~\".*\"}[1h]))",
            "legend": "撤销"
          }
        ]
      },
      {
        "id": "table-4",
        "title": "失败登录 Top10 IP",
        "kind": "table",
        "backend": "prometheus",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "topk(10, sum by (source_ip) (increase(ihui_auth_login_failed_total{instance=~\".*\"}[1h])))",
            "legend": "{{source_ip}}"
          }
        ]
      },
      {
        "id": "timeseries-5",
        "title": "登录成功率趋势",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "percentunit",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (instance) (rate(ihui_auth_login_success_total{instance=~\".*\"}[5m])) / sum by (instance) (rate(ihui_auth_login_attempt_total{instance=~\".*\"}[5m]))",
            "legend": "{{instance}}"
          }
        ]
      },
      {
        "id": "timeseries-6",
        "title": "JWT 签发趋势",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "ops",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (instance) (rate(ihui_auth_jwt_issued_total{instance=~\".*\"}[5m]))",
            "legend": "{{instance}}"
          }
        ]
      },
      {
        "id": "timeseries-7",
        "title": "异常登录趋势",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "ops",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (reason) (rate(ihui_auth_login_anomaly_total{instance=~\".*\"}[5m]))",
            "legend": "{{reason}}"
          }
        ]
      },
      {
        "id": "timeseries-8",
        "title": "2FA 使用率",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "percentunit",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (instance) (rate(ihui_auth_2fa_used_total{instance=~\".*\"}[5m])) / sum by (instance) (rate(ihui_auth_login_success_total{instance=~\".*\"}[5m]))",
            "legend": "{{instance}} 2FA 使用率"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-bullmq",
    "title": "IHUI-AI 任务队列监控",
    "group": "基础设施",
    "panels": [
      {
        "id": "1",
        "title": "任务执行速率",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "reqps",
        "min": 0,
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 1000
          },
          {
            "color": "red",
            "value": 5000
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (status) (rate(business_job_executions_total{instance=~\".*\"}[5m]))",
            "legend": "{{status}}"
          }
        ]
      },
      {
        "id": "2",
        "title": "在跑作业数 (15m 内有执行)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "count(count by (job_name) (increase(business_job_executions_total{instance=~\".*\"}[15m])))",
            "legend": "作业数"
          }
        ]
      },
      {
        "id": "3",
        "title": "失败任务数 (1h)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 50
          },
          {
            "color": "red",
            "value": 200
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(business_job_executions_total{instance=~\".*\", status=\"failed\"}[1h]))",
            "legend": "失败"
          }
        ]
      },
      {
        "id": "4",
        "title": "状态未知任务数 (1h)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 100
          },
          {
            "color": "red",
            "value": 500
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(business_job_executions_total{instance=~\".*\", status=\"unknown\"}[1h]))",
            "legend": "状态未知"
          }
        ]
      },
      {
        "id": "5",
        "title": "执行速率 Top 10 (按作业)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "reqps",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "topk(10, sum by (job_name) (rate(business_job_executions_total{instance=~\".*\"}[5m])))",
            "legend": "{{job_name}}"
          }
        ]
      },
      {
        "id": "6",
        "title": "处理速度 (jobs/s)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "ops",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(business_job_executions_total{instance=~\".*\"}[$__interval]))",
            "legend": "总处理速率"
          }
        ]
      },
      {
        "id": "7",
        "title": "失败率趋势",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "percentunit",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(business_job_executions_total{instance=~\".*\", status=\"failed\"}[5m])) / sum(rate(business_job_executions_total{instance=~\".*\"}[5m]))",
            "legend": "失败率"
          }
        ]
      },
      {
        "id": "8",
        "title": "状态未知任务分布 (按作业)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "topk(10, sum by (job_name) (increase(business_job_executions_total{instance=~\".*\", status=\"unknown\"}[1h])))",
            "legend": "{{job_name}}"
          }
        ]
      },
      {
        "id": "9",
        "title": "延迟分布 (P50/P95/P99)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "s",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "histogram_quantile(0.5, sum by (le) (rate(business_job_duration_seconds_bucket{instance=~\".*\"}[5m])))",
            "legend": "P50"
          },
          {
            "ref": "B",
            "expr": "histogram_quantile(0.95, sum by (le) (rate(business_job_duration_seconds_bucket{instance=~\".*\"}[5m])))",
            "legend": "P95"
          },
          {
            "ref": "C",
            "expr": "histogram_quantile(0.99, sum by (le) (rate(business_job_duration_seconds_bucket{instance=~\".*\"}[5m])))",
            "legend": "P99"
          }
        ]
      },
      {
        "id": "10",
        "title": "作业执行台账 (按作业/状态)",
        "kind": "table",
        "backend": "prometheus",
        "unit": "short",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (job_name, status) (increase(business_job_executions_total{instance=~\".*\"}[$__range]))",
            "legend": "{{job_name}} / {{status}}"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-business-funnel",
    "title": "IHUI-AI 业务漏斗",
    "group": "业务",
    "panels": [
      {
        "id": "stat-0",
        "title": "注册用户数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(business_funnel_total{stage=\"register\"})",
            "legend": "注册"
          }
        ]
      },
      {
        "id": "stat-1",
        "title": "支付成功数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(business_payments_total{status=\"success\"})",
            "legend": "success(business_payments_total)"
          },
          {
            "ref": "B",
            "expr": "sum(ihui_payment_success_total)",
            "legend": "ihui_payment_success_total"
          }
        ]
      },
      {
        "id": "bargauge-2",
        "title": "转化漏斗（注册→支付成功）",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "short",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(business_funnel_total{stage=\"register\"})",
            "legend": "注册"
          },
          {
            "ref": "B",
            "expr": "sum(business_payments_total{status=\"success\"})",
            "legend": "支付成功"
          }
        ]
      },
      {
        "id": "stat-3",
        "title": "转化率（注册→支付成功）",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "percentunit",
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "yellow",
            "value": 0.1
          },
          {
            "color": "green",
            "value": 0.3
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(business_payments_total{status=\"success\"}) / sum(business_funnel_total{stage=\"register\"})",
            "legend": "注册→支付成功"
          }
        ]
      },
      {
        "id": "timeseries-4",
        "title": "API 调用成功率",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "percentunit",
        "min": 0,
        "max": 1,
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(business_api_call_total{status=~\"2..\"}[5m])) / sum(rate(business_api_call_total[5m]))",
            "legend": "成功率"
          }
        ]
      },
      {
        "id": "timeseries-5",
        "title": "API 延迟分位数 (p50/p95/p99)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "ms",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "histogram_quantile(0.5, sum(rate(business_api_call_duration_ms_bucket[5m])) by (le))",
            "legend": "p50"
          },
          {
            "ref": "B",
            "expr": "histogram_quantile(0.95, sum(rate(business_api_call_duration_ms_bucket[5m])) by (le))",
            "legend": "p95"
          },
          {
            "ref": "C",
            "expr": "histogram_quantile(0.99, sum(rate(business_api_call_duration_ms_bucket[5m])) by (le))",
            "legend": "p99"
          }
        ]
      },
      {
        "id": "timeseries-6",
        "title": "订单量趋势",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "ops",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(business_orders_total[5m])) by (type)",
            "legend": "{{type}}"
          }
        ]
      },
      {
        "id": "piechart-7",
        "title": "支付状态分布",
        "kind": "pie",
        "backend": "prometheus",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (status) (business_payments_total)",
            "legend": "{{status}}"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-cache",
    "title": "IHUI-AI 缓存监控",
    "group": "基础设施",
    "panels": [
      {
        "id": "1",
        "title": "缓存命中率",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "percentunit",
        "min": 0,
        "max": 1,
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "yellow",
            "value": 0.7
          },
          {
            "color": "green",
            "value": 0.9
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(redis_keyspace_hits_total{instance=~\".*\"}) / (sum(redis_keyspace_hits_total{instance=~\".*\"}) + sum(redis_keyspace_misses_total{instance=~\".*\"}))",
            "legend": "命中率"
          }
        ]
      },
      {
        "id": "2",
        "title": "内存使用",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "bytes",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(redis_memory_used_bytes{instance=~\".*\"})",
            "legend": "内存"
          }
        ]
      },
      {
        "id": "3",
        "title": "连接数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(redis_connected_clients{instance=~\".*\"})",
            "legend": "连接"
          }
        ]
      },
      {
        "id": "4",
        "title": "Key 数量",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(redis_db_keys{instance=~\".*\"})",
            "legend": "Keys"
          }
        ]
      },
      {
        "id": "5",
        "title": "命令速率趋势",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "ops",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (instance) (rate(redis_commands_processed_total{instance=~\".*\"}[5m]))",
            "legend": "{{instance}}"
          }
        ]
      },
      {
        "id": "6",
        "title": "慢命令速率趋势",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "ops",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (instance) (rate(redis_commands_slowlog_total{instance=~\".*\"}[5m]))",
            "legend": "{{instance}}"
          }
        ]
      },
      {
        "id": "7",
        "title": "内存使用趋势",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "bytes",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(redis_memory_used_bytes{instance=~\".*\"}) by (instance)",
            "legend": "{{instance}}"
          }
        ]
      },
      {
        "id": "8",
        "title": "Key 数量分布 (按实例/DB)",
        "kind": "table",
        "backend": "prometheus",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (instance, db) (redis_db_keys{instance=~\".*\"})",
            "legend": "{{instance}}-{{db}}"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-cloudflared-tunnel",
    "title": "IHUI-AI 公网隧道(Cloudflared)",
    "group": "基础设施",
    "panels": [
      {
        "id": "1",
        "title": "隧道在线",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "green",
            "value": 1
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "up{job=\"cloudflared\"}",
            "legend": "up"
          }
        ]
      },
      {
        "id": "2",
        "title": "HA 连接数(边缘节点)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "orange",
            "value": 1
          },
          {
            "color": "green",
            "value": 4
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "cloudflared_tunnel_ha_connections",
            "legend": "HA"
          }
        ]
      },
      {
        "id": "3",
        "title": "累计请求总数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "cloudflared_tunnel_total_requests",
            "legend": "请求"
          }
        ]
      },
      {
        "id": "4",
        "title": "请求速率(次/秒)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "reqps",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(cloudflared_tunnel_total_requests[$__interval]))",
            "legend": "QPS"
          }
        ]
      },
      {
        "id": "5",
        "title": "错误速率(次/秒)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "reqps",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(cloudflared_tunnel_request_errors[$__interval]))",
            "legend": "错误/秒"
          }
        ]
      },
      {
        "id": "6",
        "title": "响应码分布(按状态码)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "cloudflared_tunnel_response_by_code",
            "legend": "{{status_code}}"
          }
        ]
      },
      {
        "id": "7",
        "title": "响应码构成(当前值)",
        "kind": "pie",
        "backend": "prometheus",
        "unit": "short",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "cloudflared_tunnel_response_by_code",
            "legend": "{{status_code}}"
          }
        ]
      },
      {
        "id": "8",
        "title": "接入 PoP 节点",
        "kind": "table",
        "backend": "prometheus",
        "unit": "short",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "cloudflared_tunnel_server_locations",
            "legend": "{{id}}"
          }
        ]
      },
      {
        "id": "9",
        "title": "并发请求数",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "cloudflared_tunnel_concurrent_requests_per_tunnel",
            "legend": "并发"
          }
        ]
      },
      {
        "id": "10",
        "title": "累计错误总数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "red",
            "value": 1
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "cloudflared_tunnel_request_errors",
            "legend": "错误"
          }
        ]
      },
      {
        "id": "11",
        "title": "隧道注册成功次数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "cloudflared_tunnel_tunnel_register_success",
            "legend": "注册"
          }
        ]
      },
      {
        "id": "12",
        "title": "RPC 客户端失败 / TCP 活跃会话",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "cloudflared_rpc_client_failures",
            "legend": "RPC 失败"
          },
          {
            "ref": "B",
            "expr": "cloudflared_tcp_active_sessions",
            "legend": "TCP 活跃会话"
          }
        ]
      },
      {
        "id": "13",
        "title": "RPC 客户端操作速率",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (handler, method) (rate(cloudflared_rpc_client_operations[5m]))",
            "legend": "{{handler}} · {{method}}"
          }
        ]
      },
      {
        "id": "14",
        "title": "回源连接延迟 P95",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "s",
        "min": 0,
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 0.1
          },
          {
            "color": "red",
            "value": 0.5
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "histogram_quantile(0.95, sum by (le) (rate(cloudflared_proxy_connect_latency_bucket[5m]))) / 1000",
            "legend": "P95 连接延迟"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-exam-usage",
    "title": "IHUI-AI 考试业务监控",
    "group": "业务",
    "panels": [
      {
        "id": "gauge-0",
        "title": "进行中考试数",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 100
          },
          {
            "color": "red",
            "value": 500
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(ihui_exam_active_total{instance=~\".*\"})",
            "legend": "进行中"
          }
        ]
      },
      {
        "id": "stat-1",
        "title": "考试提交率",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "percentunit",
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "yellow",
            "value": 0.7
          },
          {
            "color": "green",
            "value": 0.9
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_exam_submitted_total{instance=~\".*\"}[1h])) / sum(increase(ihui_exam_started_total{instance=~\".*\"}[1h]))",
            "legend": "提交率"
          }
        ]
      },
      {
        "id": "stat-2",
        "title": "平均分",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "max": 100,
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "yellow",
            "value": 60
          },
          {
            "color": "green",
            "value": 80
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "avg(ihui_exam_score_sum{instance=~\".*\"} / ihui_exam_score_count{instance=~\".*\"})",
            "legend": "平均分"
          }
        ]
      },
      {
        "id": "timeseries-3",
        "title": "考试进行数趋势",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (instance) (ihui_exam_active_total{instance=~\".*\"})",
            "legend": "{{instance}}"
          }
        ]
      },
      {
        "id": "timeseries-4",
        "title": "提交率趋势",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "percentunit",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (instance) (rate(ihui_exam_submitted_total{instance=~\".*\"}[5m])) / sum by (instance) (rate(ihui_exam_started_total{instance=~\".*\"}[5m]))",
            "legend": "{{instance}}"
          }
        ]
      },
      {
        "id": "table-5",
        "title": "分类使用 Top10",
        "kind": "table",
        "backend": "prometheus",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "topk(10, sum by (category) (increase(ihui_exam_question_used_total{instance=~\".*\"}[1h])))",
            "legend": "{{category}}"
          }
        ]
      },
      {
        "id": "timeseries-6",
        "title": "证书签发数趋势",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (instance) (increase(ihui_exam_certificate_issued_total{instance=~\".*\"}[1h]))",
            "legend": "{{instance}} 证书签发"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-hls",
    "title": "IHUI-AI HLS 直播流监控",
    "group": "基础设施",
    "panels": [
      {
        "id": "1",
        "title": "转码延迟 (ms)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "ms",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(business_hls_transcode_seconds_sum{instance=~\".*\"}[5m])) / sum(rate(business_hls_transcode_seconds_count{instance=~\".*\"}[5m])) * 1000",
            "legend": "{{video_id}}"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-overview",
    "title": "IHUI-AI · AI 运行全景",
    "group": "AI 可观测",
    "panels": [
      {
        "id": "2",
        "title": "LLM 调用指标时序数",
        "kind": "stat",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "red",
            "value": 0
          },
          {
            "color": "green",
            "value": 1
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "count(ihui_llm_calls_total{job=\"ai-service\",provider=~\".*\",model=~\".*\"})",
            "legend": "series"
          }
        ]
      },
      {
        "id": "3",
        "title": "Agent 指标时序数",
        "kind": "stat",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "red",
            "value": 0
          },
          {
            "color": "green",
            "value": 1
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "count(ihui_agent_loop_runs_total{job=\"ai-service\"})",
            "legend": "series"
          }
        ]
      },
      {
        "id": "4",
        "title": "AI 服务存活",
        "kind": "stat",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "red",
            "value": 0
          },
          {
            "color": "green",
            "value": 1
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "up{job=\"ai-service\"}",
            "legend": "up"
          }
        ]
      },
      {
        "id": "5",
        "title": "抓取新鲜度(最近一次成功抓取距今秒)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "s",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 60
          },
          {
            "color": "red",
            "value": 300
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "time() - timestamp(up{job=\"ai-service\"})",
            "legend": "seconds"
          }
        ]
      },
      {
        "id": "7",
        "title": "调用尝试速率(次/秒)",
        "kind": "timeseries",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (status) (rate(ihui_llm_calls_total{job=\"ai-service\",provider=~\".*\",model=~\".*\"}[1h]))",
            "legend": "{{status}}"
          }
        ]
      },
      {
        "id": "8",
        "title": "成功率",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "percentunit",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "red",
            "value": null
          },
          {
            "color": "yellow",
            "value": 0.9
          },
          {
            "color": "green",
            "value": 0.98
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_llm_calls_total{job=\"ai-service\",status=\"ok\"}[$__range])) / sum(increase(ihui_llm_calls_total{job=\"ai-service\",provider=~\".*\",model=~\".*\"}[$__range]))",
            "legend": "success"
          }
        ]
      },
      {
        "id": "9",
        "title": "号池冷却中的腿数",
        "kind": "stat",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(ihui_llm_pool_leg_in_cooldown{job=\"ai-service\"})",
            "legend": "cooling legs"
          }
        ]
      },
      {
        "id": "11",
        "title": "端到端延迟 P50 / P95 / P99",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "s",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "histogram_quantile(0.5, sum by (le) (rate(ihui_llm_request_duration_seconds_bucket{job=\"ai-service\"}[1h])))",
            "legend": "P50"
          },
          {
            "ref": "A",
            "expr": "histogram_quantile(0.95, sum by (le) (rate(ihui_llm_request_duration_seconds_bucket{job=\"ai-service\"}[1h])))",
            "legend": "P95"
          },
          {
            "ref": "A",
            "expr": "histogram_quantile(0.99, sum by (le) (rate(ihui_llm_request_duration_seconds_bucket{job=\"ai-service\"}[1h])))",
            "legend": "P99"
          }
        ]
      },
      {
        "id": "12",
        "title": "首字 TTFT P50 / P95 / P99",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "s",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "histogram_quantile(0.5, sum by (le) (rate(ihui_llm_ttft_seconds_bucket{job=\"ai-service\"}[1h])))",
            "legend": "P50"
          },
          {
            "ref": "A",
            "expr": "histogram_quantile(0.95, sum by (le) (rate(ihui_llm_ttft_seconds_bucket{job=\"ai-service\"}[1h])))",
            "legend": "P95"
          },
          {
            "ref": "A",
            "expr": "histogram_quantile(0.99, sum by (le) (rate(ihui_llm_ttft_seconds_bucket{job=\"ai-service\"}[1h])))",
            "legend": "P99"
          }
        ]
      },
      {
        "id": "14",
        "title": "Token 速率(按方向)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (direction) (rate(ihui_llm_tokens_total{job=\"ai-service\",provider=~\".*\",model=~\".*\"}[1h]))",
            "legend": "{{direction}}"
          }
        ]
      },
      {
        "id": "15",
        "title": "支出(区间累计 USD)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "currencyUSD",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_llm_cost_usd_total{job=\"ai-service\",provider=~\".*\",model=~\".*\"}[$__range]))",
            "legend": "cost"
          }
        ]
      },
      {
        "id": "16",
        "title": "缓存命中占输入比",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "percentunit",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "red",
            "value": null
          },
          {
            "color": "green",
            "value": 0.2
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_llm_tokens_total{job=\"ai-service\",direction=\"cache_read\"}[$__range])) / sum(increase(ihui_llm_tokens_total{job=\"ai-service\",direction=\"input\"}[$__range]))",
            "legend": "hit"
          }
        ]
      },
      {
        "id": "18",
        "title": "按厂商调用速率",
        "kind": "timeseries",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (provider) (rate(ihui_llm_calls_total{job=\"ai-service\",provider=~\".*\",model=~\".*\"}[1h]))",
            "legend": "{{provider}}"
          }
        ]
      },
      {
        "id": "19",
        "title": "按厂商错误分布",
        "kind": "timeseries",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (provider, status) (rate(ihui_llm_provider_errors_total{job=\"ai-service\",provider=~\".*\"}[1h]))",
            "legend": "{{provider}} {{status}}"
          }
        ]
      },
      {
        "id": "20",
        "title": "厂商健康(1=健康 0=不健康)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "model_sync_provider_health{job=\"ai-service\"}",
            "legend": "{{provider_code}}"
          }
        ]
      },
      {
        "id": "22",
        "title": "备用切换触发速率(按原因)",
        "kind": "timeseries",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (reason) (rate(llm_fallback_triggered_total{job=\"ai-service\"}[1h]))",
            "legend": "{{reason}}"
          }
        ]
      },
      {
        "id": "23",
        "title": "备用切换成功率",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "percentunit",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "red",
            "value": null
          },
          {
            "color": "green",
            "value": 0.5
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(llm_fallback_success_total{job=\"ai-service\"}[$__range])) / sum(increase(llm_fallback_triggered_total{job=\"ai-service\"}[$__range]))",
            "legend": "ok"
          }
        ]
      },
      {
        "id": "24",
        "title": "上下文压缩触发次数(区间)",
        "kind": "stat",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(llm_token_compaction_triggered_total{job=\"ai-service\"}[$__range]))",
            "legend": "n"
          }
        ]
      },
      {
        "id": "509",
        "title": "落账调用速率(按调用类型)",
        "kind": "timeseries",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (call_type) (rate(business_ai_calls_total{job=\"business-metrics\",vendor=~\".*\",model=~\".*\"}[1h]))",
            "legend": "{{call_type}}"
          }
        ]
      },
      {
        "id": "510",
        "title": "落账支出(区间累计 CNY 元)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "currencyCNY",
        "thresholds": [
          {
            "color": "green",
            "value": null
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(business_ai_cost_minor_units_total{job=\"business-metrics\",vendor=~\".*\",model=~\".*\"}[$__range])) / 100",
            "legend": "cost"
          }
        ]
      },
      {
        "id": "511",
        "title": "业务口径时序数",
        "kind": "stat",
        "backend": "prometheus",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "red",
            "value": 0
          },
          {
            "color": "green",
            "value": 1
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "count(business_ai_calls_total{job=\"business-metrics\",vendor=~\".*\",model=~\".*\"})",
            "legend": "series"
          }
        ]
      },
      {
        "id": "902",
        "title": "真人/首方 vs 其余(入口请求速率)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "reqps",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(ihui_traffic_requests_total{client_family=~\"human-browser|first-party\"}[5m]))",
            "legend": "真人 + 首方"
          },
          {
            "ref": "B",
            "expr": "sum(rate(ihui_traffic_requests_total{client_family!~\"human-browser|first-party\"}[5m]))",
            "legend": "其余全部(机器/脚本/爬虫/无 UA)"
          }
        ]
      },
      {
        "id": "903",
        "title": "近 24h 网页访客(visit_logs 去重)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "max(ihui_traffic_unique_visitors{window=\"24h\",source=\"visit_logs\"})",
            "legend": "独立访客"
          }
        ]
      },
      {
        "id": "904",
        "title": "近 1h 恶意路径形态命中",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "orange",
            "value": 1
          },
          {
            "color": "red",
            "value": 9
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_traffic_scan_hits_total[1h]))",
            "legend": "探测命中"
          }
        ]
      },
      {
        "id": "906",
        "title": "可用 relay key 数(选路选得到)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "green",
            "value": 0.5
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(ihui_relay_key_pool_schedulable_keys{job=\"business-metrics\"})",
            "legend": "可用 key"
          }
        ]
      },
      {
        "id": "907",
        "title": "异常 relay key 数(degraded + down)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "orange",
            "value": 1
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(ihui_relay_key_pool_keys{job=\"business-metrics\",state=~\"degraded|down\"})",
            "legend": "异常 key"
          }
        ]
      },
      {
        "id": "908",
        "title": "可用 relay 账号数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "green",
            "value": 0.5
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(ihui_relay_account_pool_schedulable{job=\"business-metrics\"})",
            "legend": "可用账号"
          }
        ]
      },
      {
        "id": "909",
        "title": "key 池刷新滞后(秒;5 分钟一轮)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "s",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "orange",
            "value": 600
          },
          {
            "color": "red",
            "value": 1800
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "time() - ihui_relay_key_pool_refresh_last_success_timestamp_seconds{job=\"business-metrics\"}",
            "legend": "刷新滞后"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-live-room",
    "title": "IHUI-AI 直播业务监控",
    "group": "业务",
    "panels": [
      {
        "id": "gauge-0",
        "title": "在线总人数",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "yellow",
            "value": 100
          },
          {
            "color": "green",
            "value": 1000
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(ihui_live_online_total{instance=~\".*\"})",
            "legend": "在线"
          }
        ]
      },
      {
        "id": "stat-1",
        "title": "断流次数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 5
          },
          {
            "color": "red",
            "value": 20
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_live_stream_disconnected_total{instance=~\".*\"}[1h]))",
            "legend": "断流"
          }
        ]
      },
      {
        "id": "timeseries-2",
        "title": "在线人数趋势",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (room_id) (ihui_live_online_total{instance=~\".*\"})",
            "legend": "room {{room_id}}"
          }
        ]
      },
      {
        "id": "timeseries-3",
        "title": "弹幕量趋势",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "ops",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (room_id) (rate(ihui_live_danmaku_total{instance=~\".*\"}[5m]))",
            "legend": "room {{room_id}}"
          }
        ]
      },
      {
        "id": "timeseries-4",
        "title": "礼物收入趋势 (按房间 · 平台币)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (room_id) (increase(ihui_live_gift_income_total{instance=~\".*\"}[5m]))",
            "legend": "room {{room_id}}"
          }
        ]
      },
      {
        "id": "timeseries-5",
        "title": "断流次数趋势",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (room_id) (increase(ihui_live_stream_disconnected_total{instance=~\".*\"}[5m]))",
            "legend": "room {{room_id}}"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-log-stack-health",
    "title": "IHUI-AI 日志栈与监控栈自健康",
    "group": "基础设施",
    "panels": [
      {
        "id": "1",
        "title": "抓取目标在线数(共 13)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "green",
            "value": 13
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(up)",
            "legend": "在线"
          }
        ]
      },
      {
        "id": "2",
        "title": "TSDB 活跃序列数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "prometheus_tsdb_head_series",
            "legend": "序列"
          }
        ]
      },
      {
        "id": "3",
        "title": "配置重载是否成功",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "green",
            "value": 1
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "prometheus_config_last_reload_successful",
            "legend": "重载"
          }
        ]
      },
      {
        "id": "4",
        "title": "各目标抓取耗时(秒)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "s",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "scrape_duration_seconds",
            "legend": "{{job}}"
          }
        ]
      },
      {
        "id": "5",
        "title": "抓取目标在线明细",
        "kind": "table",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "green",
            "value": 1
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "up",
            "legend": "{{job}} {{instance}}"
          }
        ]
      },
      {
        "id": "6",
        "title": "告警通知丢弃速率(告警链路断裂信号)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "red",
            "value": 1
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(prometheus_notifications_dropped_total[$__interval]))",
            "legend": "丢弃/秒"
          }
        ]
      },
      {
        "id": "7",
        "title": "超出样本上限的抓取",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(prometheus_target_scrapes_exceeded_sample_limit_total[$__interval]))",
            "legend": "超限/秒"
          }
        ]
      },
      {
        "id": "8",
        "title": "Loki 入站速率(字节/秒)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "Bps",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(loki_distributor_bytes_received_total[$__interval]))",
            "legend": "入站"
          },
          {
            "ref": "B",
            "expr": "sum(rate(loki_discarded_bytes_total[$__interval]))",
            "legend": "丢弃"
          }
        ]
      },
      {
        "id": "9",
        "title": "Loki 在途请求数",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(loki_inflight_requests)",
            "legend": "在途"
          }
        ]
      },
      {
        "id": "10",
        "title": "Promtail 日志采集速率(行/秒)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "red",
            "value": 1
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(promtail_read_lines_total[$__interval]))",
            "legend": "读取"
          },
          {
            "ref": "B",
            "expr": "sum(rate(promtail_sent_entries_total[$__interval]))",
            "legend": "已发送"
          },
          {
            "ref": "C",
            "expr": "sum(rate(promtail_dropped_entries_total[$__interval]))",
            "legend": "丢弃"
          }
        ]
      },
      {
        "id": "11",
        "title": "Promtail 活跃目标 / 活跃文件",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(promtail_targets_active_total)",
            "legend": "活跃目标"
          },
          {
            "ref": "B",
            "expr": "sum(promtail_files_active_total)",
            "legend": "活跃文件"
          }
        ]
      },
      {
        "id": "12",
        "title": "已发现抓取目标数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "yellow",
            "value": null
          },
          {
            "color": "green",
            "value": 13
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(prometheus_sd_discovered_targets)",
            "legend": "已发现目标"
          }
        ]
      },
      {
        "id": "13",
        "title": "Loki 请求速率(按 route)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (route) (rate(loki_request_duration_seconds_count[5m]))",
            "legend": "{{route}}"
          }
        ]
      },
      {
        "id": "14",
        "title": "Loki 请求耗时(P95 与平均)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "s",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "histogram_quantile(0.95, sum by (le) (rate(loki_request_duration_seconds_bucket[5m])))",
            "legend": "P95"
          },
          {
            "ref": "B",
            "expr": "sum(rate(loki_request_duration_seconds_sum[5m])) / sum(rate(loki_request_duration_seconds_count[5m]))",
            "legend": "平均"
          }
        ]
      },
      {
        "id": "15",
        "title": "Loki 5xx 错误率",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "percent",
        "min": 0,
        "max": 100,
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 1
          },
          {
            "color": "red",
            "value": 5
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "100 * (sum(rate(loki_request_duration_seconds_count{status_code=~\"5..\"}[5m])) / sum(rate(loki_request_duration_seconds_count[5m])))",
            "legend": "5xx 占比"
          }
        ]
      },
      {
        "id": "16",
        "title": "Promtail 日志读取速率(Top5 文件)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "Bps",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "topk(5, sum by (path) (rate(promtail_read_bytes_total[5m])))",
            "legend": "{{path}}"
          }
        ]
      },
      {
        "id": "17",
        "title": "告警桥自监控",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 1
          },
          {
            "color": "red",
            "value": 5
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(ihui_alertbridge_alerts_received_total)",
            "legend": "累计接收告警"
          },
          {
            "ref": "B",
            "expr": "sum(ihui_alertbridge_mail_undelivered)",
            "legend": "邮件未投递"
          }
        ]
      },
      {
        "id": "18",
        "title": "Prometheus 规则评估耗时(按分位)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "s",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "prometheus_rule_evaluation_duration_seconds",
            "legend": "q={{quantile}}"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-monitor-health",
    "title": "IHUI-AI 监控系统健康",
    "group": "基础设施",
    "panels": [
      {
        "id": "1",
        "title": "Prometheus 抓取成功率",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "percent",
        "min": 0,
        "max": 1,
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "yellow",
            "value": 0.9
          },
          {
            "color": "green",
            "value": 0.99
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "100 * (sum(up{instance=~\".*\"}) / count(up{instance=~\".*\"}))",
            "legend": "抓取成功率"
          }
        ]
      },
      {
        "id": "3",
        "title": "Alertmanager 活跃告警数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 10
          },
          {
            "color": "red",
            "value": 50
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(alertmanager_alerts{instance=~\".*\", state=\"active\"})",
            "legend": "活跃告警"
          }
        ]
      },
      {
        "id": "4",
        "title": "抓取成功率趋势",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "percent",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "100 * avg by (job) (up{instance=~\".*\"})",
            "legend": "{{job}}"
          }
        ]
      },
      {
        "id": "6",
        "title": "告警数趋势",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (state) (alertmanager_alerts{instance=~\".*\"})",
            "legend": "{{state}}"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-oss-storage",
    "title": "IHUI-AI 对象存储监控",
    "group": "基础设施",
    "panels": [
      {
        "id": "gauge-0",
        "title": "存储用量 (GB)",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "decgbytes",
        "min": 0,
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 500
          },
          {
            "color": "red",
            "value": 1000
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(ihui_oss_storage_used_bytes{instance=~\".*\"}) / 1024 / 1024 / 1024",
            "legend": "用量"
          }
        ]
      },
      {
        "id": "stat-1",
        "title": "文件总数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(ihui_oss_file_count{instance=~\".*\"})",
            "legend": "文件"
          }
        ]
      },
      {
        "id": "stat-2",
        "title": "错误率",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "percentunit",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 0.01
          },
          {
            "color": "red",
            "value": 0.05
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(ihui_oss_errors_total{instance=~\".*\"}[5m])) / (sum(rate(ihui_oss_requests_total{instance=~\".*\"}[5m])))",
            "legend": "错误率"
          }
        ]
      },
      {
        "id": "timeseries-3",
        "title": "存储用量趋势 (按 driver)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "decgbytes",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (driver) (ihui_oss_storage_used_bytes{instance=~\".*\"}) / 1024 / 1024 / 1024",
            "legend": "{{driver}}"
          }
        ]
      },
      {
        "id": "timeseries-4",
        "title": "上传/下载带宽",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "bps",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (instance) (rate(ihui_oss_upload_bytes_total{instance=~\".*\"}[5m])) * 8",
            "legend": "upload {{instance}}"
          },
          {
            "ref": "B",
            "expr": "sum by (instance) (rate(ihui_oss_download_bytes_total{instance=~\".*\"}[5m])) * 8",
            "legend": "download {{instance}}"
          }
        ]
      },
      {
        "id": "timeseries-5",
        "title": "文件数趋势 (按 driver)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (driver) (ihui_oss_file_count{instance=~\".*\"})",
            "legend": "{{driver}}"
          }
        ]
      },
      {
        "id": "timeseries-6",
        "title": "错误率趋势 (按类型)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "ops",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (error_type) (rate(ihui_oss_errors_total{instance=~\".*\"}[5m]))",
            "legend": "{{error_type}}"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-payment-flow",
    "title": "IHUI-AI 支付漏斗监控",
    "group": "业务",
    "panels": [
      {
        "id": "gauge-0",
        "title": "支付成功率",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "percentunit",
        "min": 0,
        "max": 1,
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "yellow",
            "value": 0.9
          },
          {
            "color": "green",
            "value": 0.97
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_payment_success_total{instance=~\".*\"}[1h])) / sum(increase(ihui_payment_attempt_total{instance=~\".*\"}[1h]))",
            "legend": "成功率"
          }
        ]
      },
      {
        "id": "stat-1",
        "title": "退款率",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "percentunit",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 0.05
          },
          {
            "color": "red",
            "value": 0.1
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_payment_refund_total{instance=~\".*\"}[1h])) / sum(increase(ihui_payment_success_total{instance=~\".*\"}[1h]))",
            "legend": "退款率"
          }
        ]
      },
      {
        "id": "stat-2",
        "title": "异常订单数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 10
          },
          {
            "color": "red",
            "value": 50
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_payment_exception_total{instance=~\".*\"}[1h]))",
            "legend": "异常订单"
          }
        ]
      },
      {
        "id": "stat-3",
        "title": "微信回调成功率",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "percentunit",
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "yellow",
            "value": 0.9
          },
          {
            "color": "green",
            "value": 0.98
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(increase(ihui_payment_wxpay_callback_success_total{instance=~\".*\"}[1h])) / sum(increase(ihui_payment_wxpay_callback_total{instance=~\".*\"}[1h]))",
            "legend": "微信回调"
          }
        ]
      },
      {
        "id": "timeseries-4",
        "title": "支付金额趋势 (按渠道)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "currencyCNY",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (channel) (increase(ihui_payment_amount_total{instance=~\".*\"}[5m])) / 100",
            "legend": "{{channel}}"
          }
        ]
      },
      {
        "id": "timeseries-5",
        "title": "支付渠道分布",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "ops",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (channel) (rate(ihui_payment_success_total{instance=~\".*\"}[5m]))",
            "legend": "{{channel}}"
          }
        ]
      },
      {
        "id": "timeseries-6",
        "title": "退款趋势",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (channel) (increase(ihui_payment_refund_total{instance=~\".*\"}[5m]))",
            "legend": "refund {{channel}}"
          }
        ]
      },
      {
        "id": "table-7",
        "title": "异常订单明细",
        "kind": "table",
        "backend": "prometheus",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "topk(20, sum by (reason, channel) (increase(ihui_payment_exception_total{instance=~\".*\"}[1h])))",
            "legend": "{{channel}} {{reason}}"
          }
        ]
      },
      {
        "id": "timeseries-8",
        "title": "微信回调成功率趋势",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "percentunit",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (instance) (rate(ihui_payment_wxpay_callback_success_total{instance=~\".*\"}[5m])) / sum by (instance) (rate(ihui_payment_wxpay_callback_total{instance=~\".*\"}[5m]))",
            "legend": "{{instance}} 回调成功"
          },
          {
            "ref": "B",
            "expr": "sum by (instance) (rate(ihui_payment_wxpay_callback_failed_total{instance=~\".*\"}[5m]))",
            "legend": "{{instance}} 回调失败"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-pg-deploy",
    "title": "IHUI-AI 数据库运行态",
    "group": "基础设施",
    "panels": [
      {
        "id": "1",
        "title": "采集器健康度 (%)",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "percent",
        "min": 0,
        "max": 1,
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "yellow",
            "value": 0.85
          },
          {
            "color": "green",
            "value": 0.95
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "100 * (sum(pg_scrape_collector_success{instance=~\".*\"}) / count(pg_scrape_collector_success{instance=~\".*\"}))",
            "legend": "采集成功率"
          }
        ]
      },
      {
        "id": "2",
        "title": "exporter 最近一次抓取耗时 (s)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "s",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "pg_exporter_last_scrape_duration_seconds{instance=~\".*\"}",
            "legend": "抓取耗时"
          }
        ]
      },
      {
        "id": "3",
        "title": "WAL 归档失败数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 1
          },
          {
            "color": "red",
            "value": 5
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(pg_stat_archiver_failed_count{instance=~\".*\"})",
            "legend": "归档失败"
          }
        ]
      },
      {
        "id": "4",
        "title": "各库活动连接数",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "s",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (datname) (pg_stat_database_numbackends{instance=~\".*\"})",
            "legend": "{{datname}}"
          }
        ]
      },
      {
        "id": "5",
        "title": "复制延迟 (s)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "s",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "red",
            "value": 1
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "pg_replication_lag_seconds{instance=~\".*\"}",
            "legend": "复制延迟"
          }
        ]
      },
      {
        "id": "6",
        "title": "各库占用明细",
        "kind": "table",
        "backend": "prometheus",
        "unit": "bytes",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (datname) (pg_database_size_bytes{instance=~\".*\"})",
            "legend": "{{datname}}"
          }
        ]
      },
      {
        "id": "7",
        "title": "WAL 归档速率",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "ops",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(pg_stat_archiver_archived_count{instance=~\".*\"}[$__interval]))",
            "legend": "归档速率"
          }
        ]
      },
      {
        "id": "8",
        "title": "死锁与冲突速率",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "reqps",
        "min": 0,
        "max": 1,
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(pg_stat_database_deadlocks{instance=~\".*\"}[5m]))",
            "legend": "死锁"
          },
          {
            "ref": "B",
            "expr": "sum(rate(pg_stat_database_conflicts{instance=~\".*\"}[5m]))",
            "legend": "冲突"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-postgresql",
    "title": "IHUI-AI PostgreSQL 监控",
    "group": "基础设施",
    "panels": [
      {
        "id": "1",
        "title": "连接数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(pg_stat_database_numbackends{instance=~\".*\"})",
            "legend": "连接"
          }
        ]
      },
      {
        "id": "2",
        "title": "TPS",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "ops",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(pg_stat_database_xact_commit{instance=~\".*\"}[1m]) + rate(pg_stat_database_xact_rollback{instance=~\".*\"}[1m]))",
            "legend": "TPS"
          }
        ]
      },
      {
        "id": "3",
        "title": "最长查询耗时 (s)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "s",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 10
          },
          {
            "color": "red",
            "value": 50
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "max(pg_query_max_duration_seconds{instance=~\".*\"})",
            "legend": "最长查询"
          }
        ]
      },
      {
        "id": "4",
        "title": "写锁数量",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 5
          },
          {
            "color": "red",
            "value": 20
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(pg_locks_count{instance=~\".*\", mode=~\"exclusivelock|rowexclusivelock|shareupdateexclusivelock\"})",
            "legend": "写锁"
          }
        ]
      },
      {
        "id": "5",
        "title": "TPS 趋势",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "ops",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(pg_stat_database_xact_commit{instance=~\".*\"}[5m]) + rate(pg_stat_database_xact_rollback{instance=~\".*\"}[5m])) by (instance)",
            "legend": "{{instance}}"
          }
        ]
      },
      {
        "id": "6",
        "title": "最长查询耗时趋势 (按库)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "s",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "max by (datname) (pg_query_max_duration_seconds{instance=~\".*\"})",
            "legend": "{{datname}}"
          }
        ]
      },
      {
        "id": "7",
        "title": "复制延迟 (秒)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "s",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "max(pg_replication_lag_seconds{instance=~\".*\"})",
            "legend": "{{instance}}"
          }
        ]
      },
      {
        "id": "8",
        "title": "各库体积 Top 10",
        "kind": "table",
        "backend": "prometheus",
        "unit": "bytes",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "topk(10, sum by (datname) (pg_database_size_bytes{instance=~\".*\"}))",
            "legend": "{{datname}}"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-redis-cluster",
    "title": "IHUI-AI Redis 实例监控",
    "group": "基础设施",
    "panels": [
      {
        "id": "1",
        "title": "实例在线",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "yellow",
            "value": 3
          },
          {
            "color": "green",
            "value": 6
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "up{job=\"redis\", instance=~\".*\"}",
            "legend": "在线(1=是)"
          }
        ]
      },
      {
        "id": "2",
        "title": "副本节点数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "redis_connected_slaves{instance=~\".*\"}",
            "legend": "副本"
          }
        ]
      },
      {
        "id": "3",
        "title": "内存峰值占用",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "bytes",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "redis_memory_used_peak_bytes{instance=~\".*\"}",
            "legend": "峰值"
          }
        ]
      },
      {
        "id": "4",
        "title": "键空间命中率",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "percentunit",
        "min": 0,
        "max": 1,
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "yellow",
            "value": 0.7
          },
          {
            "color": "green",
            "value": 0.95
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(redis_keyspace_hits_total{instance=~\".*\"}) / (sum(redis_keyspace_hits_total{instance=~\".*\"}) + sum(redis_keyspace_misses_total{instance=~\".*\"}))",
            "legend": "命中率"
          }
        ]
      },
      {
        "id": "5",
        "title": "过期与逐出速率",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "ops",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(redis_expired_keys_total{instance=~\".*\"}[5m]))",
            "legend": "过期键"
          },
          {
            "ref": "B",
            "expr": "sum(rate(redis_evicted_keys_total{instance=~\".*\"}[5m]))",
            "legend": "逐出键"
          }
        ]
      },
      {
        "id": "6",
        "title": "慢命令 Top (按命令)",
        "kind": "table",
        "backend": "prometheus",
        "unit": "ops",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "topk(10, sum by (cmd) (rate(redis_commands_slowlog_total{instance=~\".*\"}[5m])))",
            "legend": "{{cmd}}"
          }
        ]
      },
      {
        "id": "7",
        "title": "内存构成",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "bytes",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "redis_memory_used_bytes{instance=~\".*\"}",
            "legend": "数据集"
          },
          {
            "ref": "B",
            "expr": "redis_memory_used_rss_bytes{instance=~\".*\"}",
            "legend": "RSS"
          },
          {
            "ref": "C",
            "expr": "redis_memory_used_overhead_bytes{instance=~\".*\"}",
            "legend": "开销"
          }
        ]
      },
      {
        "id": "8",
        "title": "键平均 TTL",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "s",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "redis_db_avg_ttl_seconds{instance=~\".*\"}",
            "legend": "平均 TTL"
          }
        ]
      },
      {
        "id": "9",
        "title": "连接数与命令速率",
        "kind": "table",
        "backend": "prometheus",
        "unit": "short",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "redis_connected_clients{instance=~\".*\"}",
            "legend": "连接数"
          },
          {
            "ref": "B",
            "expr": "sum(rate(redis_commands_processed_total{instance=~\".*\"}[5m]))",
            "legend": "命令速率"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-tenant-usage",
    "title": "IHUI-AI 多租户业务监控",
    "group": "业务",
    "panels": [
      {
        "id": "gauge-0",
        "title": "活跃租户数",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "yellow",
            "value": 10
          },
          {
            "color": "green",
            "value": 50
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "count(count by (tenant_id) (increase(ihui_tenant_api_calls_total{instance=~\".*\"}[1h])))",
            "legend": "活跃租户"
          }
        ]
      },
      {
        "id": "stat-1",
        "title": "租户 API 调用总数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "ops",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(ihui_tenant_api_calls_total{instance=~\".*\"}[5m]))",
            "legend": "API QPS"
          }
        ]
      },
      {
        "id": "stat-2",
        "title": "限流命中数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "ops",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 10
          },
          {
            "color": "red",
            "value": 100
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(ihui_tenant_ratelimit_total{instance=~\".*\"}[5m]))",
            "legend": "限流"
          }
        ]
      },
      {
        "id": "stat-3",
        "title": "租户资源占用 (%)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "percentunit",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (tenant_id, resource) (ihui_tenant_resource_used{instance=~\".*\"}) / sum by (tenant_id, resource) (ihui_tenant_resource_quota{instance=~\".*\"})",
            "legend": "占用率"
          }
        ]
      },
      {
        "id": "table-4",
        "title": "租户 API 调用 Top10",
        "kind": "table",
        "backend": "prometheus",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "topk(10, sum by (tenant_id) (rate(ihui_tenant_api_calls_total{instance=~\".*\"}[5m])))",
            "legend": "{{tenant_id}}"
          }
        ]
      },
      {
        "id": "timeseries-5",
        "title": "租户活跃数趋势",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "count(count by (tenant_id) (increase(ihui_tenant_api_calls_total{instance=~\".*\"}[1h])))",
            "legend": "活跃租户"
          }
        ]
      },
      {
        "id": "timeseries-6",
        "title": "限流命中趋势 (按租户)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "ops",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "topk(10, sum by (tenant_id) (rate(ihui_tenant_ratelimit_total{instance=~\".*\"}[5m])))",
            "legend": "{{tenant_id}}"
          }
        ]
      },
      {
        "id": "table-7",
        "title": "租户资源占用 Top10",
        "kind": "table",
        "backend": "prometheus",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "topk(10, sum by (tenant_id, resource) (ihui_tenant_resource_used{instance=~\".*\"}))",
            "legend": "{{tenant_id}}"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-visitor-bot",
    "title": "访客与机器人流量",
    "group": "业务",
    "panels": [
      {
        "id": "1",
        "title": "入口请求速率(按客户端族)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "reqps",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (client_family) (rate(ihui_traffic_requests_total{instance=~\".*\"}[5m]))",
            "legend": "{{client_family}}"
          }
        ]
      },
      {
        "id": "2",
        "title": "真人/首方 vs 自动化(自述口径)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "reqps",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(ihui_traffic_requests_total{client_family=~\"human-browser|first-party\",instance=~\".*\"}[5m]))",
            "legend": "真人浏览器 + 首方客户端"
          },
          {
            "ref": "B",
            "expr": "sum(rate(ihui_traffic_requests_total{client_family!~\"human-browser|first-party\",instance=~\".*\"}[5m]))",
            "legend": "其余全部(机器/脚本/爬虫/无 UA)"
          }
        ]
      },
      {
        "id": "3",
        "title": "各客户端族 24 小时请求量",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (client_family) (increase(ihui_traffic_requests_total{instance=~\".*\"}[24h]))",
            "legend": "{{client_family}}"
          }
        ]
      },
      {
        "id": "4",
        "title": "恶意路径形态命中(按形态 / 按自述族)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (kind) (increase(ihui_traffic_scan_hits_total{instance=~\".*\"}[1h]))",
            "legend": "kind={{kind}}"
          },
          {
            "ref": "B",
            "expr": "sum by (client_family) (increase(ihui_traffic_scan_hits_total{instance=~\".*\"}[1h]))",
            "legend": "自称 {{client_family}}"
          }
        ]
      },
      {
        "id": "5",
        "title": "各族 4xx/5xx 速率(外部访客是不是在被门挡住)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "reqps",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (client_family) (rate(ihui_traffic_requests_total{status_class=~\"status_4xx|status_5xx\",instance=~\".*\"}[10m]))",
            "legend": "{{client_family}}"
          }
        ]
      },
      {
        "id": "6",
        "title": "business-metrics 采集器存续",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "green",
            "value": 1
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "count(up{job=\"business-metrics\"} == 1)",
            "legend": "在采的实例数"
          }
        ]
      },
      {
        "id": "7",
        "title": "PV / UV(滚动窗口聚合值,小时级刷新)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "max by (window, source) (ihui_traffic_page_views{instance=~\".*\"})",
            "legend": "PV {{source}}/{{window}}"
          },
          {
            "ref": "B",
            "expr": "max by (window, source) (ihui_traffic_unique_visitors{instance=~\".*\"})",
            "legend": "UV {{source}}/{{window}}"
          }
        ]
      },
      {
        "id": "8",
        "title": "真人 vs 自动化占比(近 24h 聚合 PV,按自述族)",
        "kind": "pie",
        "backend": "prometheus",
        "unit": "short",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (client_family) (ihui_traffic_family_page_views{window=\"24h\",source=\"api_logs\",instance=~\".*\"} > 0)",
            "legend": "{{client_family}}"
          }
        ]
      },
      {
        "id": "9",
        "title": "聚合器新鲜度(多久没成功刷过 PV/UV)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "s",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "red",
            "value": 7200
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "time() - max(ihui_traffic_aggregation_last_success_timestamp_seconds{instance=~\".*\"})",
            "legend": "距今"
          }
        ]
      },
      {
        "id": "10",
        "title": "族分解是否被 UA 种类预算截断(1 = 族值只是下界)",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "min": 0,
        "max": 1,
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "red",
            "value": 1
          }
        ],
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "max by (window, source) (ihui_traffic_family_breakdown_truncated{instance=~\".*\"})",
            "legend": "{{window}}/{{source}}"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-windows-host",
    "title": "IHUI-AI Windows 宿主机",
    "group": "基础设施",
    "panels": [
      {
        "id": "1",
        "title": "IHUI 服务运行状态",
        "kind": "table",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "green",
            "value": 1
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "max by (name) (windows_service_state{job=\"windows\",name=~\"IHUI.*\",state=\"running\"})",
            "legend": "{{name}}"
          }
        ]
      },
      {
        "id": "2",
        "title": "磁盘剩余空间",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "bytes",
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "yellow",
            "value": 21474836480
          },
          {
            "color": "green",
            "value": 53687091200
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "windows_logical_disk_free_bytes{job=\"windows\",volume=~\"[A-Z]:\"}",
            "legend": "{{volume}}"
          }
        ]
      },
      {
        "id": "3",
        "title": "磁盘使用率",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "percent",
        "min": 0,
        "max": 100,
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 75
          },
          {
            "color": "red",
            "value": 90
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "100 * (1 - (windows_logical_disk_free_bytes{job=\"windows\",volume=~\"[A-Z]:\"} / windows_logical_disk_size_bytes{job=\"windows\",volume=~\"[A-Z]:\"}))",
            "legend": "{{volume}}"
          }
        ]
      },
      {
        "id": "4",
        "title": "物理内存空闲",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "bytes",
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "yellow",
            "value": 2147483648
          },
          {
            "color": "green",
            "value": 8589934592
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "windows_os_physical_memory_free_bytes{job=\"windows\"}",
            "legend": "物理内存空闲"
          }
        ]
      },
      {
        "id": "5",
        "title": "虚拟内存空闲",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "bytes",
        "thresholds": [
          {
            "color": "red",
            "value": null
          },
          {
            "color": "yellow",
            "value": 4294967296
          },
          {
            "color": "green",
            "value": 17179869184
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "windows_os_virtual_memory_free_bytes{job=\"windows\"}",
            "legend": "虚拟内存空闲"
          }
        ]
      },
      {
        "id": "6",
        "title": "物理内存使用率",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "percent",
        "min": 0,
        "max": 100,
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 75
          },
          {
            "color": "red",
            "value": 90
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "100 * (1 - (windows_os_physical_memory_free_bytes{job=\"windows\"} / windows_cs_physical_memory_bytes{job=\"windows\"}))",
            "legend": "内存使用率"
          }
        ]
      },
      {
        "id": "7",
        "title": "系统进程数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 500
          },
          {
            "color": "red",
            "value": 800
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "windows_system_processes{job=\"windows\"}",
            "legend": "进程数"
          }
        ]
      },
      {
        "id": "8",
        "title": "CPU 使用率",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "percent",
        "min": 0,
        "max": 100,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "100 - (avg by (instance) (rate(windows_cpu_time_total{job=\"windows\",mode=\"idle\"}[5m])) * 100)",
            "legend": "CPU 使用率"
          }
        ]
      },
      {
        "id": "9",
        "title": "网络入向速率",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "Bps",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "rate(windows_net_bytes_received_total{job=\"windows\"}[5m])",
            "legend": "{{nic}} 入向"
          }
        ]
      },
      {
        "id": "10",
        "title": "网络出向速率",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "Bps",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "rate(windows_net_bytes_sent_total{job=\"windows\"}[5m])",
            "legend": "{{nic}} 出向"
          }
        ]
      },
      {
        "id": "11",
        "title": "磁盘读写吞吐",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "Bps",
        "min": 0,
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "rate(windows_logical_disk_read_bytes_total{job=\"windows\",volume=~\"[A-Z]:\"}[5m])",
            "legend": "{{volume}} 读"
          },
          {
            "ref": "B",
            "expr": "rate(windows_logical_disk_write_bytes_total{job=\"windows\",volume=~\"[A-Z]:\"}[5m])",
            "legend": "{{volume}} 写"
          }
        ]
      },
      {
        "id": "12",
        "title": "主机已运行时长",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "d",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "(time() - windows_system_boot_time_timestamp_seconds{job=\"windows\"}) / 86400",
            "legend": "已运行"
          }
        ]
      },
      {
        "id": "13",
        "title": "内存提交率",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "percent",
        "min": 0,
        "max": 100,
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 80
          },
          {
            "color": "red",
            "value": 95
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "100 * (windows_memory_committed_bytes{job=\"windows\"} / windows_memory_commit_limit{job=\"windows\"})",
            "legend": "提交率"
          }
        ]
      },
      {
        "id": "14",
        "title": "IHUI 服务运行数(运行 / 异常)",
        "kind": "table",
        "backend": "prometheus",
        "unit": "short",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "count(windows_service_state{name=~\"IHUI.*\",state=\"running\"} == 1) or vector(0)",
            "legend": "运行中"
          },
          {
            "ref": "B",
            "expr": "count(windows_service_state{name=~\"IHUI.*\",state!=\"running\"} == 1) or vector(0)",
            "legend": "非 running"
          }
        ]
      },
      {
        "id": "15",
        "title": "系统上下文切换速率",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "rate(windows_system_context_switches_total[5m])",
            "legend": "上下文切换/秒"
          }
        ]
      }
    ]
  },
  {
    "uid": "ihui-ai-ws",
    "title": "IHUI-AI WebSocket 监控",
    "group": "业务",
    "panels": [
      {
        "id": "stat-0",
        "title": "在线连接数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(business_ws_connections{instance=~\".*\"})",
            "legend": "连接"
          }
        ]
      },
      {
        "id": "stat-1",
        "title": "消息 QPS",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "ops",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(business_ws_message_received_total{instance=~\".*\"}[1m]))",
            "legend": "QPS"
          }
        ]
      },
      {
        "id": "gauge-2",
        "title": "断连率",
        "kind": "gauge",
        "backend": "prometheus",
        "unit": "percentunit",
        "min": 0,
        "max": 1,
        "thresholds": [
          {
            "color": "green",
            "value": null
          },
          {
            "color": "yellow",
            "value": 0.05
          },
          {
            "color": "red",
            "value": 0.15
          }
        ],
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(business_ws_disconnect_total{instance=~\".*\"}[5m])) / sum(rate(business_ws_connect_total{instance=~\".*\"}[5m]))",
            "legend": "断连率"
          }
        ]
      },
      {
        "id": "stat-3",
        "title": "活跃房间数",
        "kind": "stat",
        "backend": "prometheus",
        "unit": "short",
        "span": "half",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(business_ws_rooms{instance=~\".*\"})",
            "legend": "房间"
          }
        ]
      },
      {
        "id": "timeseries-4",
        "title": "连接数趋势",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "short",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(business_ws_connections{instance=~\".*\"}) by (instance)",
            "legend": "{{instance}}"
          }
        ]
      },
      {
        "id": "timeseries-5",
        "title": "消息 QPS 趋势",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "ops",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum(rate(business_ws_message_received_total{instance=~\".*\"}[5m])) by (instance)",
            "legend": "{{instance}}"
          }
        ]
      },
      {
        "id": "timeseries-6",
        "title": "消息延迟 (ms)",
        "kind": "timeseries",
        "backend": "prometheus",
        "unit": "ms",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "histogram_quantile(0.95, sum(rate(business_ws_message_latency_ms_bucket{instance=~\".*\"}[5m])) by (le, instance))",
            "legend": "{{instance}} p95"
          }
        ]
      },
      {
        "id": "table-7",
        "title": "房间数(按实例)",
        "kind": "table",
        "backend": "prometheus",
        "span": "full",
        "targets": [
          {
            "ref": "A",
            "expr": "sum by (instance) (business_ws_rooms{instance=~\".*\"})",
            "legend": "{{instance}}"
          }
        ]
      }
    ]
  }
]

export const PANEL_GROUPS = Array.from(new Set(MONITOR_DASHBOARDS.map((d) => d.group)))
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
