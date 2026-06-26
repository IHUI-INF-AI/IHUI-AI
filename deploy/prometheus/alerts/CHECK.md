# ZHS WebSocket 告警规则使用说明 (2026-06-26 新增)

## 1. 校验

```bash
# 完整 PromQL 语法校验
promtool check rules deploy/prometheus/alerts/ws_auto_recovery.yml

# 项目自带的结构性校验 (验证指标已定义 / severity 合法 / 标签规范等)
python deploy/prometheus/alerts/_validate_rules.py
```

## 2. 部署

### 2.1 原生 Prometheus

```yaml
# /etc/prometheus/prometheus.yml
rule_files:
  - /etc/prometheus/rules/ws_auto_recovery.yml

# 然后把 rules 目录挂到容器
volumes:
  - ./deploy/prometheus/alerts:/etc/prometheus/rules:ro
```

### 2.2 Prometheus Operator (k8s)

把 `groups` 字段复制到 `PrometheusRule` CRD 的 `spec.groups`:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: zhs-ws-auto-recovery
  namespace: monitoring
  labels:
    prometheus: k8s
    role: alert-rules
spec:
  groups: <paste from ws_auto_recovery.yml>
```

## 3. 告警一览

| 告警名 | 触发条件 | 严重度 | 等待 |
|--------|---------|--------|------|
| ZHSWSAutoRecoverySystemDown | is_running == 0 持续 2m | critical | 2m |
| ZHSWSAutoRecoveryServiceDegraded | service_status == 0 持续 3m | warning | 3m |
| ZHSWSMessageQueueFull | 队列水位 > 90% 持续 1m | warning | 1m |
| ZHSWSConsecutiveErrorsHigh | consecutive_errors >= 3 持续 90s | warning | 90s |
| ZHSWSRecoveryFailed | 5m 内有 failed 事件 | warning | 0 |
| ZHSWSRecoveryAttemptsExhausted | 5m 内 max_attempts_reached | critical | 0 |
| ZHSWSMonitorTasksFailing | 监控任务失败率 > 30% 持续 5m | warning | 5m |
| ZHSWSBusinessInactiveTooLong | 有连接 + inactive > 15m 持续 5m | warning | 5m |
| ZHSWSMemoryUsageHigh | RSS > 2GB 持续 5m | warning | 5m |
| ZHSWSMonitorExceptionBurst | 异常率 > 5/s 持续 2m | warning | 2m |
| ZHSWSRecoveryLatencyP99High | P99 恢复耗时 > 10s 持续 5m | warning | 5m |

## 4. 配套指标

所有告警引用的指标定义在 `server/app/ws/auto_recovery_metrics.py`:

| 指标 | 类型 | 用途 |
|------|------|------|
| `zhs_ws_auto_recovery_is_running` | Gauge | 告警 1 |
| `zhs_ws_auto_recovery_service_status` | Gauge | 告警 2 |
| `zhs_ws_auto_recovery_queue_size` | Gauge | 告警 3 |
| `zhs_ws_auto_recovery_queue_capacity` | Gauge | 告警 3 |
| `zhs_ws_auto_recovery_consecutive_errors` | Gauge | 告警 4 |
| `zhs_ws_auto_recovery_events_total` | Counter | 告警 5, 6 |
| `zhs_ws_auto_recovery_monitor_tasks_failed` | Gauge | 告警 7 |
| `zhs_ws_auto_recovery_monitor_tasks_total` | Gauge | 告警 7 |
| `zhs_ws_auto_recovery_inactive_seconds` | Gauge | 告警 8 |
| `zhs_ws_auto_recovery_active_connections` | Gauge | 告警 8 |
| `zhs_ws_auto_recovery_memory_usage_mb` | Gauge | 告警 9 |
| `zhs_ws_auto_recovery_exceptions_total` | Counter | 告警 10 |
| `zhs_ws_auto_recovery_recovery_duration_seconds_bucket` | Histogram | 告警 11 |

## 5. Alertmanager 路由建议

```yaml
# /etc/alertmanager/alertmanager.yml
route:
  receiver: 'ws-ops-default'
  group_by: ['alertname', 'severity', 'component']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - matchers:
        - severity = "critical"
        - component = "auto-recovery"
      receiver: 'ws-ops-pagerduty'
      continue: true
    - matchers:
        - severity = "warning"
        - team = "ws-ops"
      receiver: 'ws-ops-slack'
      continue: true

receivers:
  - name: 'ws-ops-default'
    webhook_configs:
      - url: 'http://alertmanager-webhook:9099/zhs-alerts'
  - name: 'ws-ops-pagerduty'
    pagerduty_configs:
      - service_key: '<integration-key>'
  - name: 'ws-ops-slack'
    slack_configs:
      - channel: '#zhs-ws-ops'
        send_resolved: true
```

## 6. 自检清单

修改本文件后, 必须:

- [ ] 运行 `promtool check rules deploy/prometheus/alerts/ws_auto_recovery.yml`
- [ ] 运行 `python deploy/prometheus/alerts/_validate_rules.py`
- [ ] 在 staging 环境的 Alertmanager 中 dry-run 加载
- [ ] 在 #zhs-ws-ops 频道 ack 一次, 确认通知链路畅通
