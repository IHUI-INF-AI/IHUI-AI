# 可观测性文档(MONITORING)

> IHUI-AI 全栈监控体系 —— Prometheus + Grafana + Loki + Promtail + Jaeger + OpenTelemetry + Alertmanager,21 仪表盘。本文档聚焦监控栈内部实现与运维命令,系统级可观测性概述见 [architecture.md](./architecture.md) §8,告警响应流程见 [INCIDENTS.md](./INCIDENTS.md)(若存在)。

---

## 1. 总览

| 组件 | 版本 | 用途 | 端口 |
|------|------|------|------|
| Prometheus | - | 指标采集与存储 | 9090 |
| Grafana | - | 仪表盘可视化(21 仪表盘) | 3000 |
| Loki | 2.9+ | 日志聚合(tsdb schema) | 3100 |
| Promtail | - | 日志采集(Docker/journal/nginx/app) | 9080 |
| Jaeger | all-in-one | 分布式追踪(OTLP/gRPC) | 16686 |
| OpenTelemetry Collector | - | 追踪与指标中转(OTLP/HTTP → Jaeger + Prometheus) | 4318/8888 |
| Alertmanager | - | 告警路由与通知(4 通道) | 9093 |

**监控栈架构图**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         应用层(apps/*)                                  │
│  apps/api(Fastify)         apps/ai-service(FastAPI)    apps/web(Next)  │
│  ├─ metrics.ts(/metrics)   ├─ prometheus-fastapi-      └─ 浏览器 console │
│  │   HTTP/DB/WS/SQL 指标   │   instrumentator(/metrics)    (生产滤除)    │
│  ├─ otel.ts(OTLP 推送)     ├─ telemetry.py(OTLP 推送)                  │
│  ├─ api-logger.ts         └─ logging.py(Python logging)                │
│  │   (api_logs 表批量写)                                                │
│  └─ Pino(JSON 日志)                                                     │
└────────────┬────────────────────┬───────────────────┬────────────────────┘
             │                    │                   │
             ▼                    ▼                   ▼
     ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
     │  Promtail    │    │  OTel        │    │ Prometheus  │
     │  (日志采集)  │    │  Collector   │    │ (指标抓取)  │
     │  端口 9080   │    │  端口 4318   │    │ 端口 9090   │
     └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
            │                   │                   │
            ▼                   ▼                   │
     ┌──────────────┐    ┌──────────────┐          │
     │  Loki        │    │  Jaeger      │          │
     │  端口 3100   │    │  端口 16686  │          │
     │  (日志存储)  │    │  (追踪存储)  │          │
     └──────┬───────┘    └──────┬───────┘          │
            │                   │                   │
            └──────────┬────────┘                   │
                       ▼                            ▼
                ┌──────────────┐           ┌──────────────┐
                │  Grafana     │◄──────────┤ Alertmanager │
                │  端口 3000   │  查询     │ 端口 9093   │
                │  (21 仪表盘) │           │ (告警通知)  │
                └──────────────┘           └──────┬───────┘
                                                  │
                                    ┌─────────────┼─────────────┐
                                    ▼             ▼             ▼
                              ┌──────────┐ ┌──────────┐ ┌──────────┐
                              │  邮件    │ │  钉钉    │ │  飞书    │
                              │ (Email)  │ │(DingTalk)│ │ (Feishu) │
                              └──────────┘ └──────────┘ └──────────┘
```

---

## 2. 监控栈架构

### 数据流

| 数据类型 | 来源 | 采集 | 存储 | 可视化 |
|----------|------|------|------|--------|
| 指标(Metrics) | apps/api `/metrics` + ai-service `/metrics` + otel-collector `/metrics` | Prometheus 抓取(scrape_interval 15s) | Prometheus TSDB | Grafana 仪表盘 |
| 日志(Logs) | apps/api Pino JSON + ai-service Python logging + Docker stdout | Promtail 采集 | Loki(tsdb schema) | Grafana LogQL |
| 追踪(Traces) | apps/api otel.ts + ai-service telemetry.py(OTLP/HTTP 推送) | OTel Collector | Jaeger(all-in-one) | Grafana + Jaeger UI |
| 告警(Alerts) | Prometheus 规则评估(evaluation_interval 15s) | Alertmanager 路由 | - | 邮件/钉钉/飞书 webhook |

---

## 3. Prometheus 配置

> 配置文件:`monitoring/prometheus/prometheus.yml`

### 抓取目标

```yaml
global:
  scrape_interval: 15s          # 默认抓取间隔
  evaluation_interval: 15s      # 规则评估间隔
  external_labels:
    project: 'ihui-ai'
    environment: 'production'

rule_files:
  - "alerts.yml"

scrape_configs:
  - job_name: 'api'              # Fastify 后端(端口 8080)
    metrics_path: '/metrics'
    static_configs:
      - targets: ['api:8080']
        labels: { service: 'api', layer: 'backend' }

  - job_name: 'ai-service'      # FastAPI AI 服务(端口 8000)
    metrics_path: '/metrics'
    static_configs:
      - targets: ['ai-service:8000']
        labels: { service: 'ai-service', layer: 'ai' }

  - job_name: 'business-metrics' # 业务指标(/business-metrics 端点)
    metrics_path: '/business-metrics'
    static_configs:
      - targets: ['api:8080']
        labels: { service: 'api', layer: 'backend' }

  - job_name: 'otel-collector'  # OTel Collector 自身指标(端口 8888)
    metrics_path: '/metrics'
    static_configs:
      - targets: ['otel-collector:8888']
        labels: { service: 'otel-collector', layer: 'observability' }

  - job_name: 'prometheus'       # Prometheus 自监控
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node'             # Node Exporter(主机指标,可选)
    static_configs:
      - targets: ['node-exporter:9100']
        labels: { service: 'node' }
```

### 抓取目标汇总

| Job | 目标 | 路径 | 间隔 | 说明 |
|-----|------|------|------|------|
| api | `api:8080` | `/metrics` | 15s | Fastify 后端指标 |
| ai-service | `ai-service:8000` | `/metrics` | 15s | FastAPI AI 服务指标 |
| business-metrics | `api:8080` | `/business-metrics` | 15s | 业务漏斗与自定义指标 |
| otel-collector | `otel-collector:8888` | `/metrics` | 15s | OTel Collector 自身指标 |
| prometheus | `localhost:9090` | - | 15s | Prometheus 自监控 |
| node | `node-exporter:9100` | - | 15s | 主机指标(磁盘/内存/CPU) |

---

## 4. Grafana

> 配置文件:`monitoring/grafana/grafana.ini`

### grafana.ini 关键配置

```ini
[server]
http_port = 3000

[security]
admin_user = admin
admin_password = ihui-admin

[auth.anonymous]
enabled = true
org_role = Viewer              # 匿名用户只读访问

[users]
allow_sign_up = false
auto_assign_org = true

[dashboards]
default_home_dashboard_path = /var/lib/grafana/dashboards/ihui-ai-overview.json

[metrics]
enabled = true                 # Grafana 自身指标暴露
```

### 数据源(Provisioning)

> 配置文件:`monitoring/grafana/provisioning/datasources/datasources.yml`

| 数据源 | 类型 | URL | 默认 | 说明 |
|--------|------|-----|------|------|
| Prometheus | prometheus | `http://prometheus:9090` | ✅ | 指标默认数据源,15s 间隔 |
| Jaeger | jaeger | `http://jaeger:16686` | - | 分布式追踪,支持 trace→metrics 跳转 |
| Loki | loki | `http://loki:3100` | - | 日志聚合,支持 trace→logs 关联 |

**链路关联**:Loki 数据源配置 `derivedFields`,通过 `trace_id=(\w+)` 正则匹配日志中的 trace_id,实现 Jaeger trace 详情跳转查询同时间窗的 Loki 日志。

### 21 仪表盘清单

> 目录:`monitoring/grafana/dashboards/`

| 仪表盘 | 文件 | 用途 |
|--------|------|------|
| IHUI-AI Overview | `ihui-ai-overview.json` | 全局总览(默认首页),含服务健康/QPS/错误率/延迟 |
| API Performance | (内置) | API 延迟 P50/P95/P99 趋势 + 状态码分布 |
| AI Cost | `ai-cost.json` | AI 调用成本追踪(token 用量 + 厂商费用) |
| AI Latency | `ai-latency.json` | AI 服务延迟分布(首 token / 完整响应) |
| Alert History | `alert_history.json` | 告警历史记录(触发时间/恢复时间/持续时长) |
| Auth Security | `auth-security.json` | 认证安全(登录失败/异常 IP/token 撤销) |
| BullMQ | `bullmq.json` | 队列任务监控(等待/活跃/完成/失败) |
| Business Funnel | `business-funnel.json` | 业务漏斗(注册→激活→付费转化) |
| Cache | `cache.json` | 缓存命中率 + Redis 操作延迟 |
| Exam Usage | `exam-usage.json` | 考试使用统计(并发/提交/阅卷) |
| HLS | `hls.json` | 直播流媒体(HLS 切片/延迟/带宽) |
| Jaeger | `jaeger.json` | 分布式追踪(span 数/耗时/错误率) |
| Live Room | `live-room.json` | 直播间监控(在线人数/消息 QPS/礼物) |
| Monitor Health | `monitor_health.json` | 监控栈自身健康(各组件存活) |
| Nginx | `nginx.json` | Nginx 反代指标(请求/带宽/upstream) |
| OSS Storage | `oss-storage.json` | 对象存储用量(桶大小/请求/费用) |
| Payment Flow | `payment-flow.json` | 支付流程(下单/回调/退款) |
| PG Deploy | `pg_deploy.json` | PostgreSQL 部署状态(复制/连接/锁) |
| PostgreSQL | `postgresql.json` | PostgreSQL 性能(查询/事务/锁/缓存) |
| Redis Cluster | `redis-cluster.json` | Redis 集群(内存/键/命令/持久化) |
| Tenant Usage | `tenant-usage.json` | 多租户用量(API 调用/存储/Token 配额) |
| WebSocket | `ws.json` | WebSocket 连接(活跃数/消息 QPS/断开) |

### Dashboard Provisioning

> 配置文件:`monitoring/grafana/provisioning/dashboards/dashboards.yml`

Grafana 启动时自动从 `/var/lib/grafana/dashboards/` 加载所有 JSON 仪表盘,无需手动导入。

---

## 5. Loki + Promtail

### Loki 配置

> 配置文件:`monitoring/loki/loki-config.yml`

| 配置项 | 值 | 说明 |
|--------|-----|------|
| HTTP 端口 | 3100 | Loki API(查询/推送) |
| gRPC 端口 | 9096 | 集群节点通信(单机模式仍监听) |
| 数据目录 | `/loki-data` | chunks + rules + tsdb-active + tsdb-cache |
| 副本数 | 1 | 单机模式 |
| 存储后端 | filesystem | 文件系统(生产可切 S3) |
| 索引模式 | boltdb-shipper(历史) + tsdb(2024 起) | tsdb 更高效压缩 |
| 日志保留 | 720h(30 天) | `retention_period` |
| 采集速率 | 10MB/s | `ingestion_rate_mb` |
| 突发大小 | 20MB | `ingestion_burst_size_mb` |
| 拒绝旧样本 | 168h(7 天) | `reject_old_samples_max_age` |
| 单次查询 | 721h(30 天+1 小时) | `max_query_length` |
| 多租户 | 关闭 | `auth_enabled: false` |

### Promtail 配置

> 配置文件:`monitoring/promtail/promtail-config.yml`

**4 个采集 Job**:

| Job | 采集源 | 说明 |
|-----|--------|------|
| `docker` | Docker 容器 stdout/stderr | 自动发现 `logging=promtail` 标签的容器 |
| `journal` | systemd journal | Linux 宿主机系统日志(可选) |
| `nginx` | `/var/log/nginx/*.log` | Nginx combined log 格式 |
| `api-app-logs` | `/apps/api/logs/*.log` | 应用静态日志文件 |

**Docker 容器日志采集**:

- 自动发现带 `logging=promtail` 标签的容器
- 提取 `container`/`stream`/`service`/`project` 标签
- 解析 JSON 日志,提取 `level`/`timestamp`/`requestId`/`msg`
- `level` 提升为标签,便于 LogQL 过滤

### LogQL 查询示例

```logql
# 查询最近 5 分钟所有 error 级别日志
{level="error"} |= "error" | json

# 查询指定 requestId 的完整请求链路
{requestId="abc-123-def"}

# 查询 API 服务 5xx 错误
{service="api", level="error"} |= "500"

# 统计最近 1 小时各容器 error 日志数量
sum by (container) (count_over_time({level="error"}[1h]))

# 查询慢请求(>1s)的日志
{service="api"} | json | duration > 1000
```

---

## 6. Jaeger(分布式追踪)

### OpenTelemetry SDK 注入

#### apps/api(`apps/api/src/plugins/otel.ts`)

```typescript
// 自动 instrument:Fastify / HTTP / ioredis / pg / dns / net
const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? '@ihui/api',
    [ATTR_SERVICE_VERSION]: '1.0.0',
  }),
  traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
  instrumentations: getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-fs': { enabled: false }, // fs 噪声过大
  }),
})
```

**启用门控**:

- `OTEL_ENABLED=true` 显式启用
- `OTEL_EXPORTER_OTLP_ENDPOINT` 配置即启用(未配置时降级 no-op)
- `OTEL_ENABLED=false` 显式禁用(优先级最高)

**配置**:

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `OTEL_ENABLED` | `false` | 显式开关(false 优先级最高) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | OTLP 端点 |
| `OTEL_SERVICE_NAME` | `@ihui/api` | 服务名 |
| `OTEL_TRACES_SAMPLER` | `traceidratio` | 采样器 |
| `OTEL_TRACES_SAMPLER_ARG` | `0.1` | 采样率(10%) |

**traceparent 透传**(W3C Trace Context):

- 客户端带 `traceparent` 头:透传(延续上游 trace,如 web → api)
- 客户端未带:生成 root traceparent(api 端作为 trace 起点)
- `onRequest` 钩子注入 `userId` 到当前 span 属性,实现用户级追踪串联
- `aiServiceFetch` 从 `request.headers['traceparent']` 拿到 parent context,生成 child traceparent 给出站请求(api → ai-service)

#### apps/ai-service(`app/telemetry.py`)

未配置 `OTEL_EXPORTER_OTLP_ENDPOINT` 时降级为 no-op,不阻塞启动。

### OTel Collector 配置

> 配置文件:`monitoring/otel-collector/config.yaml`

```yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318    # 接收 OTLP/HTTP

processors:
  memory_limiter:                  # 内存限制(防 OOM,必须首位)
    limit_mib: 400
    spike_limit_mib: 100
  batch:                           # 批量处理
    timeout: 5s
    send_batch_size: 512
  probabilistic_sampler:          # 采样(100% 保留,生产可调)
    sampling_percentage: 100

exporters:
  otlp/jaeger:                     # 追踪导出到 Jaeger
    endpoint: jaeger:4317
    tls: { insecure: true }
  prometheus:                      # 指标暴露给 Prometheus
    endpoint: 0.0.0.0:8888

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, probabilistic_sampler, batch]
      exporters: [otlp/jaeger]
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [prometheus]
```

---

## 7. Alertmanager

> 配置文件:`monitoring/alertmanager/alertmanager.yml`

### 告警规则

> 配置文件:`monitoring/prometheus/alerts.yml`

| 告警名 | 表达式 | 持续 | 严重度 | 说明 |
|--------|--------|------|--------|------|
| `ApiDown` | `up{job="api"} == 0` | 1m | critical | API 服务宕机 |
| `ApiHighErrorRate` | 5xx 占比 > 5% | 5m | warning | API 5xx 错误率过高 |
| `ApiSlowResponse` | P95 > 1000ms | 5m | warning | API 响应时间过长 |
| `AiServiceDown` | `up{job="ai-service"} == 0` | 1m | critical | AI 服务宕机 |
| `DiskSpaceLow` | 剩余空间 < 10% | 5m | warning | 磁盘空间不足 |
| `MemoryLow` | 可用内存 < 10% | 5m | warning | 内存不足 |

### 噪声抑制规则

> 配置文件:`monitoring/alertmanager/noise-rules.yml`

8 条 inhibition 规则,避免告警风暴:

| 源告警(触发) | 目标告警(抑制) | 条件 |
|---------------|-----------------|------|
| `PGInstanceDown` | `PGConnectionsHigh` | same instance + severity |
| `PGInstanceDown` | `PGReplicationLagHigh` | same instance + severity |
| `PGInstanceDown` | `PGRollbackHigh` | same instance + severity |
| `PGInstanceDown` | `PGBloatHigh` | same instance + severity |
| `PGConnectionsExhausted` | `PGConnectionsHigh` | same instance + severity |
| `PGDeadlockDetected` | `PGRollbackHigh` | same instance + severity |
| `PGLongTransactionCritical` | `PGLongTransaction` | same instance + severity |
| `PGCacheHitLow` | `PGConnectionsHigh` | same instance + severity |

### 告警通道

| 通道 | Receiver | 严重度 | 说明 |
|------|----------|--------|------|
| 邮件 | `default-email` | info + critical(critical 同时发邮件) | SMTP,`send_resolved: true` |
| 钉钉 | `dingtalk` | critical | webhook,`http://dingtalk-webhook:8060` |
| 飞书 | `feishu` | warning | webhook,`http://feishu-webhook:8060` |
| 企业微信 | `wechat` | (备用) | webhook,`http://wechat-webhook:8060` |

**路由策略**:

```yaml
route:
  receiver: 'default-email'
  group_by: ['alertname', 'service']
  group_wait: 30s          # 首次告警等待 30s 聚合
  group_interval: 5m       # 同组告警间隔 5m
  repeat_interval: 4h      # 重复告警间隔 4h
  routes:
    - matchers: ['severity="critical"']
      receiver: 'dingtalk'
      continue: true        # critical 继续进入下游 receiver(同时发邮件)
    - matchers: ['severity="warning"']
      receiver: 'feishu'
    - matchers: ['severity="info"']
      receiver: 'default-email'
```

**抑制规则**:critical 告警抑制同 `alertname` + `service` 的 warning 告警。

---

## 8. 应用层指标

### apps/api Prometheus 指标

> 插件文件:`apps/api/src/plugins/metrics.ts`,暴露 `/metrics` 端点(Prometheus 文本格式)

| 指标名 | 类型 | 标签 | 说明 |
|--------|------|------|------|
| `http_requests_total` | counter | - | HTTP 请求总数 |
| `http_requests_by_method` | counter | `method` | 按方法统计(GET/POST/...) |
| `http_requests_by_status` | counter | `status` | 按状态码统计(200/404/500/...) |
| `http_response_time_ms` | summary | - | 响应时间(sum/count/avg) |
| `http_response_time_bucket` | histogram | `le` | 响应时间桶(<10ms/<50ms/<100ms/<500ms/<1s/<5s/>=5s) |
| `process_uptime_seconds` | gauge | - | 进程运行时间 |
| `active_connections` | gauge | - | 活跃 HTTP 连接数 |
| `websocket_connections` | gauge | - | 活跃 WebSocket 连接数 |
| `ws_messages_received_total` | counter | - | WebSocket 接收消息总数 |
| `ws_messages_sent_total` | counter | - | WebSocket 发送消息总数 |
| `ws_disconnects_total` | counter | - | WebSocket 断开总数 |
| `db_pool_in_use` | gauge | - | DB 连接池使用中 |
| `db_pool_size` | gauge | - | DB 连接池总大小 |
| `db_pool_checkedout` | gauge | - | DB 连接池已检出 |
| `db_pool_overflow` | gauge | - | DB 连接池溢出 |
| `db_pool_connections_total` | counter | - | DB 连接池累计创建 |
| `db_pool_checkout_timeouts_total` | counter | - | DB 连接池 checkout 超时 |
| `sql_query_duration_seconds` | histogram | `table,operation,le` | SQL 查询耗时直方图 |
| `sql_queries_total` | counter | `table,operation` | SQL 查询总数 |

**Map 大小保护**(P0 Round 3 鲁棒性):每个 Map 最多 2000 key,超过时清理最旧的 10%(LRU 近似),防 dynamic route params / table|operation 组合爆炸导致内存泄漏。

### apps/ai-service Prometheus 指标

`prometheus-fastapi-instrumentator` 自动暴露 `/metrics` 端点,排除 `/health`/`/metrics`/`/socket.io` 路径。

---

## 9. 日志体系

### apps/api(Pino 结构化日志)

| 维度 | 说明 |
|------|------|
| 日志库 | Pino 9.5 + pino-pretty |
| 格式 | JSON 结构化 |
| 日志级别 | `LOG_LEVEL` 环境变量配置 |
| 输出 | stdout(Docker 采集)+ 文件(`apps/api/logs/*.log`) |
| 字段 | `level`/`timestamp`/`requestId`/`msg`/`service` + 业务字段 |

### apps/web(浏览器 console)

- 开发环境:完整 console 输出
- 生产构建:自动移除(Next.js 生产构建优化)

### apps/ai-service(Python logging)

| 维度 | 说明 |
|------|------|
| 日志库 | Python 标准库 `logging` |
| 配置 | `app/core/logging.py` |
| 级别 | `LOG_LEVEL` 环境变量(默认 `info`) |
| 输出 | stdout(Docker 采集) |

---

## 10. API 日志批量写

> 插件文件:`apps/api/src/plugins/api-logger.ts`,记录 `/api` 请求到 `api_logs` 表

### 批量写入策略

| 策略 | 值 | 说明 |
|------|-----|------|
| 缓冲区大小 | 100 条(`API_LOG_BATCH_SIZE`) | 满 100 立即 flush |
| flush 间隔 | 5000ms(`API_LOG_FLUSH_INTERVAL_MS`) | 定时 flush |
| 进程退出 | `onClose` 钩子强制 flush | 防止丢失 |
| flush 失败 | 丢弃当前批次 | 日志写入失败不影响业务 |

### 采样策略

| 状态码 | 采样率 | 说明 |
|--------|--------|------|
| 2xx | 10%(`API_LOG_SAMPLE_RATE`) | 成功请求按采样率记录 |
| 4xx | 100%(全量) | 客户端错误全量记录 |
| 5xx | 100%(全量) | 服务端错误全量记录 |
| 健康检查/指标端点 | 0%(不记录) | `/api/health`/`/api/metrics` 跳过 |

### 日志字段

```typescript
interface BufferedLog {
  userId?: string
  method: string         // GET/POST/...
  path: string           // 请求路径(截断 512 字符)
  statusCode: number
  duration: number       // 毫秒
  ip?: string
  userAgent?: string     // 截断 512 字符
  error?: string         // 4xx/5xx 时记录
}
```

### 配置

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `API_LOG_ENABLED` | `true` | 总开关(false 完全关闭) |
| `API_LOG_BATCH_SIZE` | `100` | 缓冲区大小 |
| `API_LOG_FLUSH_INTERVAL_MS` | `5000` | flush 间隔(ms) |
| `API_LOG_SAMPLE_RATE` | `0.1` | 2xx 采样率(10%) |

---

## 11. 健康检查端点

### apps/api(`apps/api/src/routes/health.ts`)

| 端点 | 用途 | 检查项 | 状态码 |
|------|------|--------|--------|
| `GET /api/health` | Liveness(综合) | 无(仅返回 uptime) | 200 |
| `GET /api/health/live` | Liveness 探针 | 无 | 200 |
| `GET /api/health/ready` | Readiness 探针 | DB + Redis + AI service + 微信支付配置 | 200(ready)/ 503(degraded) |
| `GET /api/health/metrics` | 指标摘要 | requestsTotal + avgResponseTime + uptime | 200 |
| `GET /api/health/history` | 健康历史 | 最近 100 次 `/health/ready` 结果 | 200 |

**Readiness 检查项**:

| 检查项 | 说明 | 失败影响 |
|--------|------|----------|
| `database` | `SELECT 1` 验证 DB 连通性 | 阻塞 ready(503) |
| `redis` | `PING` 验证 Redis 连通性 | 阻塞 ready(503),无 Redis 时 skip |
| `aiService` | HTTP `/health` 验证 AI 服务(2s 超时) | 不阻塞(降级 warning,chat 受影响) |
| `wechatPay` | 私钥 + 平台证书配置检查 | 不阻塞(降级 warning,支付走 mock) |

### apps/ai-service(`app/routers/health.py`)

| 端点 | 用途 |
|------|------|
| `GET /` | 服务根端点(基本信息) |
| `GET /health` | Liveness |
| `GET /health/live` | Liveness 探针 |
| `GET /health/ready` | Readiness 探针(LLM 配置 + litellm 可用性) |

### Docker healthcheck

```yaml
# docker-compose.yml
services:
  api:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 40s

  ai-service:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

---

## 12. 业务埋点

### visit-tracking(访问追踪)

| 端点 | 用途 |
|------|------|
| `POST /api/visit-tracking` | 记录页面访问 |
| `GET /api/visit-tracking/page-views` | 页面浏览统计 |
| `GET /api/visit-tracking/unique-visitors` | 独立访客统计 |
| `GET /api/admin/visit-tracking/*` | 管理端访问统计 |

### behavior(行为采集)

| 端点 | 用途 |
|------|------|
| `POST /api/behavior` | 记录用户行为(点击/输入/滚动) |
| `GET /api/admin/behavior/*` | 管理端行为分析 |

### statistics(统计路由)

| 端点 | 用途 |
|------|------|
| `GET /api/statistics/overview` | 全局统计概览 |
| `GET /api/statistics/users` | 用户增长统计 |
| `GET /api/statistics/revenue` | 收入统计 |
| `GET /api/admin/statistics/*` | 管理端深度统计 |

---

## 13. 告警响应流程

> 完整事故响应流程见 [INCIDENTS.md](./INCIDENTS.md)(若存在)。本节仅列流程概要。

```
告警触发(Prometheus 规则)
    │
    ▼
Alertmanager 路由(按 severity 分发)
    │
    ├── critical → 钉钉 + 邮件
    ├── warning → 飞书
    └── info → 邮件
    │
    ▼
Oncall 接收告警
    │
    ▼
排查(Grafana 仪表盘 + Loki 日志 + Jaeger 追踪)
    │
    ▼
修复(代码修复 / 配置调整 / 资源扩容)
    │
    ▼
验证(指标恢复 + 告警 resolved)
    │
    ▼
复盘(记录根因 + 改进措施 + 更新告警规则)
```

---

## 14. SLI/SLO 定义

### SLI(Service Level Indicators)

| SLI | 指标 | 计算方式 |
|-----|------|----------|
| 可用性 | `up{job="api"} == 1` 的时间占比 | `uptime / total_time` |
| 延迟 | `http_response_time_bucket` P95 | `histogram_quantile(0.95, ...)` |
| 错误率 | 5xx 占比 | `5xx_count / total_count` |
| 吞吐量 | QPS | `rate(http_requests_total[5m])` |

### SLO(Service Level Objectives)

| SLO | 目标 | 告警阈值 | 窗口 |
|-----|------|----------|------|
| 可用性 | 99.9% | < 99.9% 持续 5m | 30 天 |
| 延迟 P95 | < 300ms | > 1000ms 持续 5m | 5 分钟 |
| 错误率 | < 0.1% | > 5% 持续 5m | 5 分钟 |
| 吞吐量 | 1000 QPS | - | 实时 |

### 错误预算(Error Budget)

- 99.9% 可用性 = 每月 43.2 分钟停机预算
- 超预算 → 暂停新功能发布,优先修复稳定性

---

## 15. 运维命令

### 启动监控栈

```bash
# 启动全部监控组件
docker compose up -d prometheus grafana loki promtail jaeger otel-collector alertmanager

# 或启动全部服务(含业务)
docker compose up -d

# 验证各组件健康
docker compose ps
curl http://localhost:9090/-/healthy    # Prometheus
curl http://localhost:3000/api/health    # Grafana
curl http://localhost:3100/ready        # Loki
curl http://localhost:16686/             # Jaeger UI
```

### Grafana 访问

| 项 | 值 |
|----|-----|
| URL | `http://localhost:3000` |
| 用户名 | `admin` |
| 密码 | `ihui-admin` |
| 默认仪表盘 | IHUI-AI Overview |
| 匿名访问 | Viewer 角色(只读) |

### PromQL 查询示例

```promql
# API 请求 QPS(最近 5 分钟)
rate(http_requests_total{job="api"}[5m])

# API P95 响应时间
histogram_quantile(0.95, rate(http_response_time_bucket{job="api"}[5m]))

# API 5xx 错误率
sum(rate(http_requests_by_status{job="api",status=~"5.."}[5m]))
/
sum(rate(http_requests_by_status{job="api"}[5m]))

# 活跃 WebSocket 连接数
websocket_connections

# DB 连接池使用率
db_pool_in_use / db_pool_size

# SQL 慢查询(>1s)统计
sum(rate(sql_query_duration_seconds_bucket{le="1"}[5m])) by (table, operation)

# Node Exporter 磁盘使用率
(node_filesystem_avail_bytes{fstype!~"tmpfs|overlay"}
/
node_filesystem_size_bytes{fstype!~"tmpfs|overlay"})

# Node Exporter 内存使用率
1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)
```

### Loki LogQL 查询示例

```logql
# 查询最近 5 分钟所有 error 级别日志
{level="error"} |= "error" | json

# 查询指定 requestId 的完整请求链路
{requestId="abc-123-def"}

# 查询 API 服务 5xx 错误
{service="api", level="error"} |= "500"

# 统计最近 1 小时各容器 error 日志数量
sum by (container) (count_over_time({level="error"}[1h]))

# 查询慢请求(>1s)的日志
{service="api"} | json | duration > 1000

# 关联 trace:从日志中提取 trace_id 查询 Jaeger
{service="api"} | json | line_format "{{.trace_id}}"
```

### Jaeger 查询

| 查询方式 | URL |
|----------|-----|
| Jaeger UI | `http://localhost:16686` |
| 按 service 查询 | `http://localhost:16686/search?service=@ihui/api` |
| 按 trace_id 查询 | `http://localhost:16686/trace/<trace_id>` |
| API 查询 | `http://localhost:16686/api/traces?service=@ihui/api&limit=20` |

### Alertmanager 管理

```bash
# 查看 Alertmanager 状态
curl http://localhost:9093/api/v2/status

# 查看当前告警
curl http://localhost:9093/api/v2/alerts

# 查看静默规则(silences)
curl http://localhost:9093/api/v2/silences

# 创建静默(临时屏蔽告警)
curl -X POST http://localhost:9093/api/v2/silences \
  -H "Content-Type: application/json" \
  -d '{
    "matchers": [{"name": "alertname", "value": "ApiDown", "isRegex": false}],
    "startsAt": "2026-07-22T10:00:00Z",
    "endsAt": "2026-07-22T11:00:00Z",
    "createdBy": "ops",
    "comment": "计划维护"
  }'
```

### 停止与清理

```bash
# 停止监控栈
docker compose stop prometheus grafana loki promtail jaeger otel-collector alertmanager

# 清理监控数据(谨慎!会丢失历史指标与日志)
docker compose down -v  # 删除 volume
```
