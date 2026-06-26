# WebSocket 自动恢复系统

> 2026-06-26 新增 Prometheus 指标集成
>
> 迁移自 `coze_zhs_py/websocket_auto_recovery.py`，解决 WebSocket 服务停掉但项目没停的问题。

## 目录

- [架构概览](#架构概览)
- [组件](#组件)
- [Prometheus 指标](#prometheus-指标)
- [API 端点](#api-端点)
- [配置 (环境变量)](#配置-环境变量)
- [Grafana 仪表盘示例](#grafana-仪表盘示例)
- [Alertmanager 告警示例](#alertmanager-告警示例)
- [测试](#测试)
- [排障指南](#排障指南)

---

## 架构概览

```
┌────────────────────────────────────────────────────────────────┐
│                  FastAPI lifespan (app/main.py)                │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  WebSocketAutoRecoveryManager  (app/ws/auto_recovery.py)  │    │
│  │  ├── _health_monitor      ──┐                         │    │
│  │  ├── _service_monitor       │ 5 个并发监控协程        │    │
│  │  ├── _connection_monitor    │                         │    │
│  │  ├── _memory_monitor        │                         │    │
│  │  └── _task_monitor        ──┘                         │    │
│  │                                                       │    │
│  │  _trigger_recovery ─── _perform_recovery              │    │
│  │       │                                                │    │
│  │       └── 埋点 ──→  app/ws/auto_recovery_metrics.py   │    │
│  │                          │                             │    │
│  │                          ▼                             │    │
│  │                  prometheus_client                     │    │
│  │                  (全局 registry)                        │    │
│  │                          │                             │    │
│  │                          ▼                             │    │
│  │                  GET /metrics  (FastAPI)               │    │
│  │                  GET /api/v1/system/auto-recovery/*    │    │
│  └──────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────┘
```

**关键设计**：

1. **解耦**：监控业务 (`auto_recovery.py`) 与指标导出 (`auto_recovery_metrics.py`) 通过延迟 import 解耦，metrics 模块故障不影响业务循环。
2. **全局 registry**：复用 `prometheus_client` 默认 registry，`/metrics` 端点一并输出所有指标。
3. **零阻塞埋点**：所有埋点调用包裹在 `try/except` 中，异常时仅 `logger.debug` 记录，绝不中断监控主循环。
4. **Cardinality 保护**：`reason` label 截断到 200 字符，避免 PromQL 维度爆炸。

---

## 组件

| 组件 | 路径 | 职责 |
|------|------|------|
| `WebSocketAutoRecoveryManager` | [app/ws/auto_recovery.py](../../app/ws/auto_recovery.py) | 主管理器，启动/停止 5 个监控协程，触发恢复 |
| `auto_recovery_metrics` | [app/ws/auto_recovery_metrics.py](../../app/ws/auto_recovery_metrics.py) | Prometheus 指标定义 + `update_gauges` 同步函数 |
| 路由 | [app/api/v1/system/auto_recovery.py](../../app/api/v1/system/auto_recovery.py) | 3 个 HTTP 端点 (metrics/status/history) |
| 测试 | [tests/test_auto_recovery_metrics.py](../../tests/test_auto_recovery_metrics.py) | 单元 + 集成测试 |
| 历史 JSON 端点 | `/cozeZhsApi/ws/websocket/auto-recovery-status` | 兼容已有运维拉取入口 |

### 5 个监控协程

| 监控器 | 间隔 | 职责 | 关键阈值 (env) |
|--------|------|------|----------------|
| `_health_monitor` | 60s | 队列水位 + 后台任务健康 | `WS_RECOVERY_QUEUE_HIGH_WATERMARK=0.9` |
| `_service_monitor` | 30s | 累计消息 / API 调用活跃度 | `WS_RECOVERY_MAX_INACTIVE_SEC=900` |
| `_connection_monitor` | 120s | 清理僵尸连接 (DISCONNECTED/CLOSED/CLOSING) | — |
| `_memory_monitor` | 300s | RSS 内存超阈值时 GC | `WS_RECOVERY_MAX_MEMORY_MB=2048` |
| `_task_monitor` | 180s | 处理任务数超阈值时清理 | `WS_RECOVERY_TASKS_HIGH_WATERMARK=500` |

---

## Prometheus 指标

所有指标以 `zhs_ws_auto_recovery_` 为前缀，与 `zhs_http_*` / `zhs_biz_*` / `zhs_ws_*` 命名空间保持一致。

### Counter（累计事件）

| 指标 | 标签 | 说明 |
|------|------|------|
| `zhs_ws_auto_recovery_events_total` | `event_type`, `reason` | 恢复事件计数，event_type ∈ {triggered, succeeded, failed} |
| `zhs_ws_auto_recovery_exceptions_total` | `monitor`, `exception_type` | 监控协程异常计数，monitor ∈ {health_monitor, service_monitor, ...} |

### Gauge（实时状态）

| 指标 | 说明 |
|------|------|
| `zhs_ws_auto_recovery_is_running` | 系统是否运行 (1=运行, 0=停止) |
| `zhs_ws_auto_recovery_service_status` | 服务状态 (1=healthy, 0=其他) |
| `zhs_ws_auto_recovery_consecutive_errors` | 连续错误数（成功时重置） |
| `zhs_ws_auto_recovery_total_errors` | 累计错误总数 |
| `zhs_ws_auto_recovery_recovery_count` | 累计恢复次数 |
| `zhs_ws_auto_recovery_memory_usage_mb` | 进程 RSS 内存 MB |
| `zhs_ws_auto_recovery_queue_size` | 出箱消息队列当前大小 |
| `zhs_ws_auto_recovery_queue_capacity` | 出箱消息队列容量 |
| `zhs_ws_auto_recovery_queue_full_count` | 队列满累计次数 |
| `zhs_ws_auto_recovery_active_connections` | 活跃 WS 连接数 |
| `zhs_ws_auto_recovery_active_api_calls` | 在飞 API 调用数 |
| `zhs_ws_auto_recovery_processing_tasks` | 处理中后台任务数 |
| `zhs_ws_auto_recovery_total_messages_queued` | 累计入队消息数 |
| `zhs_ws_auto_recovery_last_health_check_timestamp` | 上次健康检查 unix 时间戳 |
| `zhs_ws_auto_recovery_last_activity_timestamp` | 上次业务活动 unix 时间戳 |
| `zhs_ws_auto_recovery_inactive_seconds` | 距上次活动秒数 |
| `zhs_ws_auto_recovery_monitor_tasks_total` | 监控任务总数 |
| `zhs_ws_auto_recovery_monitor_tasks_active` | 活跃监控任务数 |
| `zhs_ws_auto_recovery_monitor_tasks_failed` | 失败监控任务数 |

### Histogram（分布）

| 指标 | 标签 | Buckets | 说明 |
|------|------|---------|------|
| `zhs_ws_auto_recovery_recovery_duration_seconds` | `result` (succeeded \| failed) | 0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0 | 单次恢复操作耗时 |

### 标签 cardinality 保护

- `reason` label 截断到 **200 字符**（避免超长错误信息爆炸 PromQL 维度）
- `exception_type` 限定为 Python 内置异常类名（最多几十种）
- `monitor` 限定为 5 个固定值（health/service/connection/memory/task）
- `event_type` 限定为 3 个固定值（triggered/succeeded/failed）

---

## API 端点

### 1. `GET /api/v1/system/auto-recovery/metrics`

返回 **Prometheus 文本格式**（与 `/metrics` 一致），便于 Prom server 抓取。

```bash
$ curl -s http://127.0.0.1:8000/api/v1/system/auto-recovery/metrics | head -20

# HELP zhs_ws_auto_recovery_is_running Auto-recovery system running (1) or stopped (0)
# TYPE zhs_ws_auto_recovery_is_running gauge
zhs_ws_auto_recovery_is_running 1.0
# HELP zhs_ws_auto_recovery_recovery_count Cumulative recovery attempt count
# TYPE zhs_ws_auto_recovery_recovery_count gauge
zhs_ws_auto_recovery_recovery_count 0.0
...
```

Content-Type: `text/plain; version=0.0.4; charset=utf-8`

### 2. `GET /api/v1/system/auto-recovery/status`

返回 **JSON** 格式状态报告（与 `/cozeZhsApi/ws/websocket/auto-recovery-status` 互补）。

```json
{
  "success": true,
  "data": {
    "auto_recovery": {
      "is_running": true,
      "service_status": "healthy",
      "recovery_count": 0,
      "consecutive_errors": 0,
      "memory_usage_mb": 142.3,
      "queue_size": 0,
      "active_connections": 5,
      ...
    }
  },
  "timestamp": 1782449363.123
}
```

### 3. `GET /api/v1/system/auto-recovery/history?limit=50`

返回最近 N 条恢复历史（limit 范围 1-50，超过截断）。

```json
{
  "success": true,
  "data": {
    "history": [
      {
        "time": "2026-06-26T12:00:00+00:00",
        "reason": "监控任务异常: health_monitor",
        "attempt": 1
      }
    ],
    "count": 1,
    "recovery_count": 1
  },
  "timestamp": 1782449363.123
}
```

---

## 配置 (环境变量)

| 变量 | 默认 | 说明 |
|------|------|------|
| `WS_RECOVERY_HEALTH_INTERVAL` | 60.0 | health_monitor 间隔秒 |
| `WS_RECOVERY_SERVICE_INTERVAL` | 30.0 | service_monitor 间隔秒 |
| `WS_RECOVERY_MAX_MEMORY_MB` | 2048 | 内存阈值 MB |
| `WS_RECOVERY_MAX_INACTIVE_SEC` | 900 | 最大空闲秒（触发诊断） |
| `WS_RECOVERY_MAX_ATTEMPTS` | 5 | 恢复最大尝试次数 |
| `WS_RECOVERY_QUEUE_HIGH_WATERMARK` | 0.9 | 队列水位告警比例 |
| `WS_RECOVERY_TASKS_HIGH_WATERMARK` | 500 | 处理任务数告警阈值 |
| `WS_RECOVERY_CONSECUTIVE_ERRORS` | 3 | 触发恢复的连续错误数 |

---

## Grafana 仪表盘示例

> 推荐导入 [`deploy/grafana/dashboards/incident_trace.json`](../../deploy/grafana/dashboards/incident_trace.json) 作为基础模板，
> 添加 auto-recovery 面板。

### 关键面板 PromQL

**1. 自动恢复触发频率（最近 5min）**
```promql
sum(rate(zhs_ws_auto_recovery_events_total{event_type="triggered"}[5m]))
```

**2. 恢复成功率**
```promql
sum(rate(zhs_ws_auto_recovery_events_total{event_type="succeeded"}[5m]))
/
sum(rate(zhs_ws_auto_recovery_events_total{event_type="triggered"}[5m]))
```

**3. 队列水位（百分比）**
```promql
zhs_ws_auto_recovery_queue_size / zhs_ws_auto_recovery_queue_capacity * 100
```

**4. 内存使用趋势**
```promql
zhs_ws_auto_recovery_memory_usage_mb
```

**5. 恢复耗时 P95**
```promql
histogram_quantile(0.95,
  rate(zhs_ws_auto_recovery_recovery_duration_seconds_bucket[10m])
)
```

**6. 监控任务失败数**
```promql
zhs_ws_auto_recovery_monitor_tasks_failed
```

---

## Alertmanager 告警示例

> 复制到 `deploy/docker/prometheus/rules.yml` 或 `deploy/grafana/alerts/zhs-biz-alerts.yml`。

```yaml
groups:
  - name: zhs_ws_auto_recovery
    rules:
      # 1. 自动恢复系统停止
      - alert: WSAutoRecoveryStopped
        expr: zhs_ws_auto_recovery_is_running == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "WebSocket 自动恢复系统已停止"
          description: "is_running=0 持续 1 分钟，需立即检查 lifespan/import 错误"

      # 2. 连续错误数过高
      - alert: WSAutoRecoveryConsecutiveErrors
        expr: zhs_ws_auto_recovery_consecutive_errors > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "WebSocket 监控连续错误 {{ $value }} 次"

      # 3. 内存超阈值
      - alert: WSAutoRecoveryHighMemory
        expr: zhs_ws_auto_recovery_memory_usage_mb > 3072
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "WS 进程内存 {{ $value }}MB 超过 3GB"

      # 4. 恢复失败率 > 50%
      - alert: WSAutoRecoveryFailureRate
        expr: |
          sum(rate(zhs_ws_auto_recovery_events_total{event_type="failed"}[10m]))
          /
          sum(rate(zhs_ws_auto_recovery_events_total{event_type="triggered"}[10m]))
          > 0.5
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "WS 自动恢复失败率 {{ $value | humanizePercentage }}"

      # 5. 监控任务失败
      - alert: WSAutoRecoveryMonitorTaskFailed
        expr: zhs_ws_auto_recovery_monitor_tasks_failed > 0
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "{{ $value }} 个监控任务失败"

      # 6. 服务降级
      - alert: WSAutoRecoveryServiceDegraded
        expr: zhs_ws_auto_recovery_service_status == 0
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "WebSocket 服务降级"
```

---

## 测试

```bash
# 仅 auto_recovery metrics 测试
cd server
python -m pytest tests/test_auto_recovery_metrics.py -v

# 与已有 auto_recovery 集成测试一起跑
python -m pytest tests/test_ws_auto_recovery_integration.py tests/test_auto_recovery_metrics.py -v
```

测试覆盖：

- [x] 模块 import / 22 个 metric 注册到全局 registry
- [x] `update_gauges()` 同步 manager 状态到 Gauge（含 ws_manager 字段缺失场景）
- [x] `inc_recovery_*` / `inc_monitor_exception` 计数正确性
- [x] `RecoveryTimer` 上下文管理器 succeeded / failed 两种路径
- [x] `get_histogram_count()` 辅助函数：读取 Histogram 在指定 label 下的观测次数（避免直接访问 `_count` 等内部 API）
- [x] FastAPI 路由 `/metrics` 返回 Prometheus 文本格式
- [x] FastAPI 路由 `/status` 返回 JSON
- [x] FastAPI 路由 `/history` 返回历史 + limit 截断
- [x] 完整链路：触发恢复 → update_gauges → /metrics 端点文本包含关键 metric
- [x] 反向兼容：metrics 模块 import 失败时 auto_recovery 仍可加载

---

## 排障指南

### 1. `/metrics` 端点看不到 auto_recovery 指标

**症状**：`curl /api/v1/system/auto-recovery/metrics` 不包含 `zhs_ws_auto_recovery_*`

**排查**：
1. 确认 `app.ws.auto_recovery` 已被 import（lifespan 启动会自动 import）
2. 检查 `_METRICS_AVAILABLE` 全局标志：
   ```python
   from app.ws import auto_recovery
   print(auto_recovery._METRICS_AVAILABLE)  # 应为 True
   ```
3. 检查 prometheus_client registry：
   ```python
   from prometheus_client import REGISTRY
   for metric in REGISTRY.collect():
       if "zhs_ws_auto_recovery" in metric.name:
           print(metric.name)
   ```

### 2. 触发恢复但 events_total 不增

**症状**：手动制造错误后，recovery_count 增加但 `events_total{event_type="triggered"}` 不变

**排查**：
1. 检查 `update_gauges` 是否被调用（`grep` `_health_monitor` 中应有 `update_gauges(self)`）
2. 手动调用验证：
   ```python
   from app.ws.auto_recovery_metrics import inc_recovery_triggered
   inc_recovery_triggered("debug")
   ```
3. 检查 `_trigger_recovery` 中是否有 `if inc_recovery_triggered is not None` 守卫分支

### 3. Counter label cardinality 爆炸

**症状**：Prometheus TSDB 内存暴涨，label `reason` 维度达百万

**原因**：`reason` 未截断

**修复**：
1. 确认 `auto_recovery_metrics.py` 中 `inc_recovery_triggered(reason)` 内部有 `reason[:200]`
2. 检查 `app/ws/auto_recovery.py` 中所有调用方是否传入可控的 reason
3. 紧急：在 PromQL 中 drop 异常 label：
   ```promql
   label_replace(zhs_ws_auto_recovery_events_total, "reason", "other", "reason", ".*")
   ```

### 4. /metrics 端点超时

**症状**：Prometheus 抓取超时 (>10s)

**原因**：metrics 文本过大 (单个 metric > 10000 维度)

**排查**：
1. 检查 histogram bucket 数量 × label 笛卡尔积
2. 用 `promtool check metrics` 验证格式
3. 必要时拆分 endpoint（auto-recovery 用独立端口）

---

## 变更日志

- **2026-06-26** 新增 Prometheus 指标集成
  - 新增 `app/ws/auto_recovery_metrics.py` (22 个 metric + 同步函数 + 计时上下文)
  - `app/ws/auto_recovery.py` 关键节点埋点（5 个监控器 + 恢复触发 + 异常处理）
  - 新增 `app/api/v1/system/auto_recovery.py` 3 个路由（metrics/status/history）
  - 新增 `tests/test_auto_recovery_metrics.py` 单元 + 集成测试
- **2026-06-26** 完善版：加 `asyncio.Lock` 串行化队列操作、task_done 计数、参数化阈值
- 迁移自 `coze_zhs_py/websocket_auto_recovery.py`
