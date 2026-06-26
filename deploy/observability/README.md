# ZHS 可观测性部署手册 (2026-06-26 新增)

> 覆盖 Prometheus + Grafana + Alertmanager 接入 `WebSocket auto_recovery` 监控体系的完整流程。
> 目标读者: SRE / 运维 / 想要在 staging/prod 看到告警的开发。

---

## 0. 目录速览

```
deploy/
├── prometheus/
│   └── alerts/
│       ├── ws_auto_recovery.yml     # 11 条告警规则 (PromQL 表达式)
│       ├── _validate_rules.py       # 项目自带规则结构验证
│       └── CHECK.md                 # 旧版使用说明 (保留)
└── grafana/
    ├── dashboards/
    │   ├── zhs_ws_auto_recovery_dashboard.json   # 5 核心面板
    │   ├── _validate_dashboard.py                # 仪表盘指标引用校验
    │   └── _validate_dashboard_live.py           # 仪表盘现场测试
    ├── alerting/
    │   └── zhs_business_alerts.yml               # 业务告警分组规则
    ├── contact_points.yaml         # 4 个 Contact Point (webhook/钉钉/飞书/邮件)
    ├── notification_policies.yaml  # 通知路由
    ├── prometheus_scrape.yml       # 原生 Prometheus 抓取配置样例
    └── servicemonitor.yaml         # Prometheus Operator ServiceMonitor CRD
```

---

## 1. 架构总览

```
┌─────────────────┐  /metrics (15s)  ┌──────────────────┐
│ zhs-backend     │ ───────────────► │ Prometheus       │
│ (FastAPI+uvicorn│                  │ (Operator / 原生) │
│  port 8000)     │                  │                  │
│                 │  /api/v1/system/ │  rule_files      │
│ auto_recovery   │  auto-recovery/  │  ↓               │
│  ↓              │  status          │  ┌────────────┐  │
│ Prometheus      │                  │  │ 告警规则   │  │
│  metrics        │                  │  │ 11 条      │  │
└─────────────────┘                  │  └────────────┘  │
                                     │       ↓ firing   │
                                     │  ┌────────────┐  │
                                     │  │Alertmanager│  │
                                     │  └────────────┘  │
                                     │       ↓          │
                                     │  ┌────────────┐  │
                                     │  │ Webhook /  │  │
                                     │  │ 钉钉/飞书/  │  │
                                     │  │ Slack/邮件 │  │
                                     │  └────────────┘  │
                                     └──────────────────┘
                                              ↑
                              ┌───────────────────────────┐
                              │ Grafana 9+                │
                              │  datasource: Prometheus   │
                              │  dashboard: zhs_ws_auto_  │
                              │  recovery_dashboard.json  │
                              └───────────────────────────┘
```

---

## 2. Prometheus 接入 (2 选 1)

### 2.1 原生 Prometheus (单实例 / VM 部署)

```bash
# 1) 创建规则目录
sudo mkdir -p /etc/prometheus/rules
sudo cp deploy/prometheus/alerts/ws_auto_recovery.yml /etc/prometheus/rules/
sudo chmod 644 /etc/prometheus/rules/ws_auto_recovery.yml

# 2) 编辑 /etc/prometheus/prometheus.yml
cat >> /etc/prometheus/prometheus.yml <<EOF
# 合并 deploy/grafana/prometheus_scrape.yml 样例
rule_files:
  - /etc/prometheus/rules/ws_auto_recovery.yml
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager.zhs.svc.cluster.local:9093']
EOF

# 3) 验证规则 (使用 promtool 2.45+)
promtool check rules /etc/prometheus/rules/ws_auto_recovery.yml

# 4) 热加载
curl -X POST http://prometheus:9090/-/reload

# 5) 验证生效
curl -s http://prometheus:9090/api/v1/rules | jq '.data.groups[].name'
# 期望输出: "zhs_ws_auto_recovery"
```

### 2.2 Prometheus Operator (k8s 推荐)

```bash
# 1) 应用 ServiceMonitor
kubectl apply -f deploy/grafana/servicemonitor.yaml

# 2) 把告警规则转成 PrometheusRule CRD
python3 - <<'PY'
import yaml
src = yaml.safe_load(open("deploy/prometheus/alerts/ws_auto_recovery.yml"))
dst = {
    "apiVersion": "monitoring.coreos.com/v1",
    "kind": "PrometheusRule",
    "metadata": {
        "name": "zhs-ws-auto-recovery",
        "namespace": "monitoring",
        "labels": {"prometheus": "k8s", "role": "alert-rules"},
    },
    "spec": {"groups": src["groups"]},
}
with open("deploy/prometheus/alerts/zhs-ws-auto-recovery.prometheusrule.yaml", "w") as f:
    yaml.dump(dst, f, sort_keys=False)
PY
kubectl apply -f deploy/prometheus/alerts/zhs-ws-auto-recovery.prometheusrule.yaml

# 3) 验证
kubectl get prometheusrule -n monitoring zhs-ws-auto-recovery -o yaml
# 期望 spec.groups[0].name == "zhs_ws_auto_recovery"
```

---

## 3. Grafana 接入

### 3.1 导入仪表盘

**UI 方式 (推荐)**:
1. 登录 Grafana → Dashboards → New → Import
2. 上传 `deploy/grafana/dashboards/zhs_ws_auto_recovery_dashboard.json`
3. 选择 Prometheus 数据源 (或临时填 `http://prometheus:9090`)
4. 确认导入, 跳转到仪表盘

**API 方式** (Provision 化):

```bash
# 先把仪表盘 + provider 配置 mount 到 Grafana 容器
# deploy/grafana/dashboards/zhs_ws_auto_recovery_dashboard.json
#   → /etc/grafana/provisioning/dashboards/zhs_ws_auto_recovery_dashboard.json

# dashboards.yaml provider 样例:
cat > /etc/grafana/provisioning/dashboards/zhs.yaml <<'EOF'
apiVersion: 1
providers:
  - name: 'zhs'
    orgId: 1
    folder: 'ZHS'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
EOF

# datasources.yaml 样例 (自动创建 Prometheus 数据源):
cat > /etc/grafana/provisioning/datasources/zhs.yaml <<'EOF'
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus.monitoring:9090
    isDefault: true
    editable: false
EOF
```

### 3.2 配置 Contact Point (告警接收方)

```bash
# 1) 通过环境变量注入敏感 URL (不要硬编码到 yaml)
export ZHS_ALERT_WEBHOOK_URL='https://oapi.dingtalk.com/robot/send?access_token=xxx'
export ZHS_DINGTALK_WEBHOOK="$ZHS_ALERT_WEBHOOK_URL"
export ZHS_FEISHU_WEBHOOK='https://open.feishu.cn/open-apis/bot/v2/hook/xxx'
export ZHS_ALERT_EMAIL='ops@zhs.com'

# 2) envsubst 渲染
envsubst < deploy/grafana/contact_points.yaml > /etc/grafana/contact_points.yaml
envsubst < deploy/grafana/notification_policies.yaml > /etc/grafana/notification_policies.yaml

# 3) 挂载到 Grafana 容器
# /etc/grafana/contact_points.yaml
# /etc/grafana/notification_policies.yaml
# 重启 Grafana, 验证
curl -u admin:$GRAFANA_PASSWORD http://grafana:3000/api/v1/provisioning/contact-points
```

### 3.3 验证仪表盘引用指标正确

```bash
# 项目自带的静态校验: 检查所有 panel 引用的指标都在 auto_recovery_metrics.py 中定义
python deploy/grafana/dashboards/_validate_dashboard.py

# 现场连通性测试 (需要 Prometheus + 后端都在跑)
python deploy/grafana/dashboards/_validate_dashboard_live.py \
  --prometheus http://prometheus:9090 \
  --backend http://zhs-backend:8000
```

---

## 4. 告警链路打通

### 4.1 部署 Alertmanager

```bash
# k8s (用 prometheus-operator 自带)
kubectl apply -f https://raw.githubusercontent.com/prometheus-operator/prometheus-operator/main/example/prometheus-operator-crd/alertmanager.crd.yaml
kubectl apply -f - <<'EOF'
apiVersion: monitoring.coreos.com/v1
kind: Alertmanager
metadata:
  name: zhs-main
  namespace: monitoring
spec:
  replicas: 3
  alertmanagerConfigSelector:
    matchLabels:
      alertmanagerConfig: zhs-main
EOF
```

### 4.2 路由建议 (从 ws_auto_recovery.yml CHECK.md 移植)

```yaml
# /etc/alertmanager/alertmanager.yml
route:
  receiver: 'zhs-webhook-default'
  group_by: ['alertname', 'severity', 'component']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - matchers:
        - severity = "critical"
        - component = "auto-recovery"
      receiver: 'zhs-dingtalk-critical'
      continue: true
    - matchers:
        - severity = "warning"
        - team = "ws-ops"
      receiver: 'zhs-feishu-warning'
      continue: true

receivers:
  - name: 'zhs-webhook-default'
    webhook_configs:
      - url: 'http://alertmanager-webhook:9099/zhs-alerts'
  - name: 'zhs-dingtalk-critical'
    webhook_configs:
      - url: '${ZHS_DINGTALK_WEBHOOK}'
  - name: 'zhs-feishu-warning'
    webhook_configs:
      - url: '${ZHS_FEISHU_WEBHOOK}'
```

---

## 5. 端到端冒烟验证 (10 分钟跑完)

### 5.1 后端 /metrics 端点

```bash
# 1) 健康检查
curl -s http://zhs-backend:8000/health | jq
# 期望: {"status": "ok", ...}

# 2) 指标端点
curl -s http://zhs-backend:8000/metrics | head -30
# 期望: 前 30 行包含 # HELP / # TYPE 注释

# 3) 检查 zhs_ws_auto_recovery_* 指标已注册
curl -s http://zhs-backend:8000/metrics | grep -E '^zhs_ws_auto_recovery_(is_running|service_status|queue_size|events_total|recovery_duration_seconds_count)' | head -20
# 期望: 至少 5 个指标有值
```

### 5.2 /api/v1/system/auto-recovery/status

```bash
curl -s http://zhs-backend:8000/api/v1/system/auto-recovery/status | jq
# 期望:
# {
#   "auto_recovery": {
#     "is_running": true,
#     "service_status": "healthy",
#     "recovery_count": 0,
#     "error_count": 0,
#     "active_connections": 0,
#     "queue_size": 0,
#     "queue_capacity": 1000,
#     ...
#   }
# }
```

### 5.3 Prometheus 抓取验证

```bash
# 1) 抓取目标状态
curl -s http://prometheus:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job | contains("zhs"))'
# 期望: health=up, lastScrape 有最近时间戳

# 2) 即时查询: is_running 当前值
curl -s 'http://prometheus:9090/api/v1/query?query=zhs_ws_auto_recovery_is_running' | jq
# 期望: data.result[0].value == ["...", "1"]

# 3) 告警规则已加载
curl -s http://prometheus:9090/api/v1/rules | jq '.data.groups[] | select(.name == "zhs_ws_auto_recovery") | .rules | length'
# 期望: 11
```

### 5.4 手动触发一次告警 (Dry-run)

```bash
# 方法 A: 临时把 is_running 强制为 0
python3 -c "
import requests
# 走 admin 端点 (需权限)
r = requests.post('http://zhs-backend:8000/api/v1/admin/ws/auto-recovery/stop', headers={'Authorization': 'Bearer <admin-token>'})
print(r.status_code)
"
sleep 150  # 等 for: 2m + 30s
curl -s http://prometheus:9090/api/v1/alerts | jq '.data.alerts[] | select(.labels.alertname == "ZHSWSAutoRecoverySystemDown")'
# 期望: state=firing

# 方法 B: 用 amtool 直接 inject 告警 (推荐, 不影响生产)
amtool alert add alert_name=foo severity=critical
sleep 30
# 通过 Alertmanager UI 验证收到
```

### 5.5 验证恢复通知

```bash
# 重新启动后端 / 重启 auto_recovery
python3 -c "
import requests
r = requests.post('http://zhs-backend:8000/api/v1/admin/ws/auto-recovery/start', headers={'Authorization': 'Bearer <admin-token>'})
print(r.status_code)
"
sleep 30
curl -s http://prometheus:9090/api/v1/alerts | jq '.data.alerts[] | select(.labels.alertname == "ZHSWSAutoRecoverySystemDown" and .state == "firing")'
# 期望: 空数组 (告警已 resolved)
# 同时钉钉/飞书应收到 "已恢复" 通知
```

---

## 6. 故障排查手册

| 现象 | 根因 | 排查命令 |
|------|------|----------|
| Prometheus targets 显示 `down` | 后端 /metrics 不可达 | `curl -v http://zhs-backend:8000/metrics` |
| 指标 `zhs_ws_auto_recovery_is_running` 不存在 | 监控任务未启动 | `kubectl logs -l app=zhs-backend \| grep auto_recovery` |
| 告警规则未加载 | rule_files 路径错 | `promtool check rules /etc/prometheus/rules/*.yml` |
| 告警 firing 但 Alertmanager 未收到 | 路由配置错误 | `amtool config routes --alertmanager.url=http://alertmanager:9093` |
| Contact Point 通知未到钉钉 | URL 编码错误 | `curl -X POST "$ZHS_DINGTALK_WEBHOOK" -d '{"msgtype":"text","text":{"content":"test"}}'` |
| 仪表盘所有 panel "No data" | 数据源 URL 错 / Prometheus 抓取失败 | Grafana → Connections → Data sources → Test |
| `recovery_duration_seconds` 始终 0 | 没触发过恢复 | 手动跑 `python server/scripts/trigger_recovery_for_test.py` |
| `queue_size` 始终 0 | 监控器未上报 queue_size | 检查 `auto_recovery.py` _health_monitor 中 update_gauges 调用 |
| `events_total{event="..."}` 不增长 | 埋点未触发 | 触发对应事件 (如手动 kill 一个监控任务) 验证 |

### 6.1 看 auto_recovery 内部状态 (不依赖 Prometheus)

```bash
# 直接打后端 API
curl -s http://zhs-backend:8000/api/v1/system/auto-recovery/status | jq .auto_recovery

# 关注字段:
# - is_running: 监控循环是否在跑
# - service_status: "healthy" / "degraded"
# - recovery_count: 累计恢复次数 (0 正常, 持续增长需关注)
# - error_count / consecutive_errors: 连续错误 (>=3 触发恢复)
# - active_connections: 当前 WS 连接数
# - queue_size / queue_capacity: 队列水位 (>=90% 报警)
# - queue_full_count: 队列满次数 (累计, 应为 0)
# - memory_usage_mb: 进程 RSS
# - recovery_history: 最近 5 次恢复 (含 reason / time)
```

### 6.2 看 Prometheus 告警当前状态

```bash
# 所有 firing 告警
curl -s http://prometheus:9090/api/v1/alerts | jq '.data.alerts[] | select(.state == "firing") | {name: .labels.alertname, severity: .labels.severity, since: .activeAt}'

# 特定告警的当前值
curl -s 'http://prometheus:9090/api/v1/query?query=zhs_ws_auto_recovery_is_running' | jq '.data.result[0].value[1]'
```

### 6.3 Alertmanager 静默 (临时)

```bash
# 维护窗口用
amtool silence add --alertmanager.url=http://alertmanager:9093 \
  --comment="prometheus upgrade" \
  --duration=2h \
  --matchers='team="ws-ops"'

# 列出当前静默
amtool silence list --alertmanager.url=http://alertmanager:9093
```

---

## 7. 附录

### 7.1 指标 / 告警 一览

| 指标 | 类型 | 告警 | 阈值 |
|------|------|------|------|
| `zhs_ws_auto_recovery_is_running` | Gauge | SystemDown | ==0 持续 2m |
| `zhs_ws_auto_recovery_service_status` | Gauge | ServiceDegraded | ==0 持续 3m |
| `zhs_ws_auto_recovery_queue_size` | Gauge | MessageQueueFull | > 90% 容量 持续 1m |
| `zhs_ws_auto_recovery_queue_capacity` | Gauge | MessageQueueFull | (denominator) |
| `zhs_ws_auto_recovery_consecutive_errors` | Gauge | ConsecutiveErrorsHigh | >=3 持续 90s |
| `zhs_ws_auto_recovery_events_total{event="recovery.failed"}` | Counter | RecoveryFailed | 5m 内有事件 |
| `zhs_ws_auto_recovery_events_total{event="recovery.max_attempts_reached"}` | Counter | RecoveryAttemptsExhausted | 5m 内有事件 (critical) |
| `zhs_ws_auto_recovery_monitor_tasks_failed` | Gauge | MonitorTasksFailing | 失败率 > 30% 持续 5m |
| `zhs_ws_auto_recovery_monitor_tasks_total` | Gauge | MonitorTasksFailing | (denominator) |
| `zhs_ws_auto_recovery_inactive_seconds` | Gauge | BusinessInactiveTooLong | > 15m 且有连接 持续 5m |
| `zhs_ws_auto_recovery_active_connections` | Gauge | BusinessInactiveTooLong | (filter: > 0) |
| `zhs_ws_auto_recovery_memory_usage_mb` | Gauge | MemoryUsageHigh | > 2048 持续 5m |
| `zhs_ws_auto_recovery_exceptions_total` | Counter | MonitorExceptionBurst | 速率 > 5/s 持续 2m |
| `zhs_ws_auto_recovery_recovery_duration_seconds_bucket` | Histogram | RecoveryLatencyP99High | P99 > 10s 持续 5m |

### 7.2 关键环境变量 (后端)

| 变量 | 默认 | 说明 |
|------|------|------|
| `WS_RECOVERY_HEALTH_INTERVAL` | 60s | 健康检查周期 |
| `WS_RECOVERY_SERVICE_INTERVAL` | 30s | 服务监控周期 |
| `WS_RECOVERY_MAX_MEMORY_MB` | 2048 | 内存告警阈值 |
| `WS_RECOVERY_MAX_INACTIVE_SEC` | 900 | 业务不活跃阈值 (15 分钟) |
| `WS_RECOVERY_MAX_ATTEMPTS` | 5 | 最大恢复次数 (超过告警) |
| `WS_RECOVERY_QUEUE_HIGH_WATERMARK` | 0.9 | 队列高水位 (90%) |
| `WS_RECOVERY_TASKS_HIGH_WATERMARK` | 500 | 处理任务高水位 |
| `WS_RECOVERY_CONSECUTIVE_ERRORS` | 3 | 连续错误触发恢复阈值 |

### 7.3 Promtool 自检命令

```bash
# 1) 规则语法
promtool check rules deploy/prometheus/alerts/ws_auto_recovery.yml

# 2) 仪表盘静态校验 (项目自带)
python deploy/grafana/dashboards/_validate_dashboard.py

# 3) 规则结构校验 (项目自带, 验证指标已定义 / severity 合法)
python deploy/prometheus/alerts/_validate_rules.py

# 4) Promtool 集成到 pre-commit (推荐)
cat > .git/hooks/pre-commit <<'EOF'
#!/bin/bash
echo "[pre-commit] 验证 prometheus 规则..."
promtool check rules deploy/prometheus/alerts/*.yml || exit 1
echo "[pre-commit] 验证 grafana 仪表盘..."
python deploy/grafana/dashboards/_validate_dashboard.py || exit 1
EOF
chmod +x .git/hooks/pre-commit
```

### 7.4 CI 集成 (2026-06-26 已新增)

`.github/workflows/ci.yml` 中的 `prom-alert-e2e` job 会在 PR 阶段跑 promtool 校验。
如需手动触发, 走 workflow_dispatch。

---

## 8. 自检清单 (部署完成后逐项确认)

- [ ] Prometheus targets 页面 `zhs-backend` job 显示 `UP`
- [ ] `curl /api/v1/query?query=up{job="zhs-backend"}` 返回 `1`
- [ ] `promtool check rules` 通过
- [ ] 11 条告警规则在 `/-/rules` 页面可见
- [ ] Grafana 仪表盘 5 个 panel 全部有数据 (不是 "No data")
- [ ] Alertmanager 收到 `ZHSWSAutoRecoverySystemDown` 演练告警 (可用 amtool inject)
- [ ] 钉钉 / 飞书 / 邮件 至少 1 个渠道收到告警通知
- [ ] 演练告警恢复后, 通知发送 "Resolved"
- [ ] `_validate_dashboard.py` 和 `_validate_rules.py` 全部通过
- [ ] Contact Point URL 通过 envsubst 注入, 仓库内无明文 token
