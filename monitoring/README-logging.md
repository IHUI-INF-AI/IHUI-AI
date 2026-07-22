# IHUI-AI 日志栈(Loki + Promtail + Grafana)

本项目使用 Grafana Loki + Promtail 实现生产环境日志聚合,与现有 Prometheus 指标监控、Jaeger 链路追踪一起构成完整可观测性栈。

## 一、架构说明

```
应用程序 (api/ai-service/web)
       │
       │ stdout/stderr
       ▼
Docker json-file 日志驱动
(/var/lib/docker/containers/<id>/<id>-json.log)
       │
       ▼
Promtail (抓取 + 解析 + 标签)
       │  - docker_sd_configs: 自动发现带 logging=promtail 标签的容器
       │  - pipeline_stages: json 解析 → 提取 level/timestamp/requestId
       │  - 推送到 Loki
       ▼
Loki (日志聚合 + 索引 + 保留)
       │  - 文件系统存储
       │  - boltdb-shipper(历史) + tsdb(2024+)
       │  - 30 天自动清理
       ▼
Grafana Explore(LogQL 查询 + 可视化)
       │  - 与 Prometheus 指标联动
       │  - 与 Jaeger 链路追踪关联
       ▼
告警/排障/分析
```

数据流总结:**应用 → stdout → Docker json-file → Promtail → Loki → Grafana 查询**

## 二、文件清单

| 路径                                                          | 用途                                   |
| ------------------------------------------------------------- | -------------------------------------- |
| `monitoring/loki/loki-config.yml`                             | Loki 服务配置(端口/存储/索引/保留策略) |
| `monitoring/promtail/promtail-config.yml`                     | Promtail 采集配置(抓取目标/pipeline)   |
| `monitoring/grafana/provisioning/datasources/datasources.yml` | Grafana 数据源(新增 Loki)              |
| `docker-compose.yml`                                          | 编排 loki + promtail 服务(新增 2 个)   |

## 三、启动命令

```bash
# 启动 Loki + Promtail(后台运行)
docker-compose up -d loki promtail

# 查看运行状态
docker-compose ps loki promtail

# 查看实时日志
docker-compose logs -f loki
docker-compose logs -f promtail

# 重启
docker-compose restart loki promtail

# 停止
docker-compose stop loki promtail

# 完全移除(含数据卷)
# ⚠️ 会删除所有日志数据
docker-compose down -v  # 不要轻易执行
```

启动后服务地址:

- Loki HTTP API: http://localhost:3100
- Loki 健康检查: http://localhost:3100/ready
- Loki 指标: http://localhost:3100/metrics
- Promtail 健康检查: http://localhost:9080/ready
- Promtail 指标: http://localhost:9080/metrics

## 四、容器接入日志采集

要让某个容器日志被 Promtail 抓取,需在 docker-compose 服务的 labels 中添加:

```yaml
services:
  api:
    # ... 其他配置
    labels:
      - 'logging=promtail' # ← 加这个标签
```

> 当前未加标签的容器默认不会被采集,避免噪音。
> 如需采集所有容器,修改 `promtail-config.yml` 中 docker_sd_configs 的 filters 节,移除 `logging=promtail` 过滤条件。

## 五、Grafana 查询指南

1. 打开 Grafana(http://localhost:8816,默认 admin / 配置的 GRAFANA_ADMIN_PASSWORD)
2. 左侧菜单 → **Explore**(放大镜图标)
3. 数据源下拉选择 **Loki**
4. 在查询输入框中写 LogQL

### LogQL 示例

```logql
# === 基础查询 ===

# 查 api 容器的 ERROR 日志
{container="api"} |= "ERROR"

# 查 ai-service 异常
{container="ai-service"} |= "exception"

# 查 web 容器 next.js 的 error 日志(json 解析后按 level 过滤)
{container="web"} |= "next" | json | level="error"

# 查所有容器的 stderr 流
{stream="stderr"}

# === 字段过滤 ===

# 按 requestId 追踪一条请求的完整日志链
{container="api"} | json | requestId="abc-123-def"

# 按 level 过滤
{container="api"} | json | level="error"
{container="ai-service"} | json | level=~"error|fatal"

# === 多条件组合 ===

# 包含 ERROR 但不含 timeout
{container="api"} |= "ERROR" != "timeout"

# 正则匹配异常堆栈
{container="ai-service"} |~ "Traceback|Exception|Error"

# === 聚合统计 ===

# 5 分钟内 api 容器日志计数
count_over_time({container="api"}[5m])

# 按级别分组统计 1 小时日志量
sum by (level) (count_over_time({container="api"}[1h]))

# 各容器最近 5 分钟错误率
sum by (container) (count_over_time({stream="stderr"}[5m]))

# === 时间范围 ===

# 最近 15 分钟所有 ERROR
{container=~"api|ai-service|web"} |= "ERROR" [15m]
```

### LogQL 语法速查

| 操作符             | 含义           | 示例                         |
| ------------------ | -------------- | ---------------------------- |
| `\|=`              | 包含字符串     | `\|= "ERROR"`                |
| `\|!=`             | 不包含字符串   | `\|!= "debug"`               |
| `\|~`              | 正则匹配       | `\|~ "Err[0-9]+"`            |
| `\|!~`             | 正则不匹配     | `\|!~ "info\|debug"`         |
| `\| json`          | 解析 JSON 日志 | `\| json`                    |
| `\| label="value"` | 字段过滤       | `\| level="error"`           |
| `[5m]`             | 时间窗口       | `count_over_time({...}[5m])` |

## 六、日志保留策略

Loki 配置 30 天(720 小时)自动清理:

- `limits_config.retention_period: 720h` — 日志保留 30 天
- `limits_config.reject_old_samples_max_age: 168h` — 拒收 7 天以上的旧样本
- `compactor.retention_enabled: true` — 启用 compactor 自动清理
- `compactor.retention_delete_delay: 2h` — 标记删除后 2 小时真正删除
- `compactor.retention_delete_worker_count: 150` — 并发删除 worker 数

Compactor 每 10 分钟扫描一次,自动清理超过保留期的日志 chunk。

如需调整保留期,修改 `monitoring/loki/loki-config.yml` 中 `retention_period` 后重启 Loki:

```bash
docker-compose restart loki
```

## 七、故障排查

### 1. Promtail 抓不到日志

**检查清单:**

```bash
# 1) Promtail 容器是否运行
docker-compose ps promtail
docker-compose logs promtail | tail -50

# 2) 是否发现目标容器
# 访问 http://localhost:9080/targets 看抓取目标列表
curl http://localhost:9080/targets | jq

# 3) 容器是否带 logging=promtail 标签
docker inspect <container_name> | grep -A5 Labels

# 4) Promtail 是否能访问 docker.sock
docker exec ihui-promtail ls -la /var/run/docker.sock

# 5) positions 是否正常写入
docker exec ihui-promtail cat /tmp/positions.yaml
```

**常见原因:**

- 容器未加 `logging=promtail` 标签 → 加上后重启容器
- `/var/run/docker.sock` 未挂载 → 检查 docker-compose volumes
- 容器名解析失败 → 检查 relabel_configs 的 regex
- 日志文件路径不存在 → 检查 static_configs 的 `__path__`

### 2. Loki 429 Too Many Requests

**原因:** Promtail 推送速率超过 Loki 的 `ingestion_rate_mb` 限制(默认 4MB/s)。

**解决:**

```bash
# 1) 查看 Loki 限流
curl http://localhost:8818/metrics | grep loki_request

# 2) 调高 ingestion 限制(已在 loki-config.yml 中设为 10MB/s)
#    如仍不够,继续调高 ingestion_rate_mb 与 ingestion_burst_size_mb

# 3) 查看具体哪个 stream 被限流
docker-compose logs loki | grep "429"
docker-compose logs loki | grep "rate_limited"
```

**配置位置:** `monitoring/loki/loki-config.yml` 中 `limits_config.ingestion_rate_mb` 和 `ingestion_burst_size_mb`。

### 3. Loki 启动失败

```bash
# 查看启动日志
docker-compose logs loki | head -100

# 常见错误:
# - "mkdir /loki-data: permission denied" → 检查 volume 权限
# - "invalid config" → 检查 YAML 语法
# - "ring not ready" → 等待 30 秒启动期完成

# 验证配置文件语法(在容器内)
docker exec ihui-loki sh -c 'loki -config.file=/etc/loki/local-config.yaml -verify-config'
```

### 4. Grafana 查询 Loki 报错

```bash
# 1) Grafana 是否能连通 Loki
#    Grafana → Connections → Data Sources → Loki → Save & Test
#    应显示 "Data source connected and labels found."

# 2) 检查 Loki 服务是否健康
curl http://localhost:3100/ready
#    应返回 "ready"

# 3) 检查网络
docker exec ihui-grafana wget -qO- http://loki:3100/ready

# 4) 查询超时 → 调小查询时间范围或优化 LogQL
```

### 5. 磁盘占用过高

```bash
# 查看 Loki 数据卷大小
docker-compose exec loki du -sh /loki-data

# 查看各子目录占用
docker-compose exec loki du -sh /loki-data/*

# 紧急清理(会丢数据,慎用):
# 1) 停服: docker-compose stop loki
# 2) 删除卷: docker volume rm ihui-ai_loki-data
# 3) 重启: docker-compose up -d loki
```

## 八、与现有监控栈的关系

```
┌──────────────────────────────────────────────────────────────┐
│  Grafana (统一可视化)                                         │
│  ├─ Prometheus 数据源 → 指标(CPU/内存/QPS/延迟)              │
│  ├─ Loki 数据源      → 日志(应用/容器/系统)                  │
│  └─ Jaeger 数据源    → 链路(分布式追踪 span)                 │
└──────────────────────────────────────────────────────────────┘
       ▲                  ▲                  ▲
       │                  │                  │
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Prometheus   │  │ Loki         │  │ Jaeger       │
│ (拉取 /metrics)│  │ (Promtail 推) │  │ (OTel 推)    │
└──────────────┘  └──────────────┘  └──────────────┘
       ▲                  ▲                  ▲
       │                  │                  │
┌──────────────────────────────────────────────────────┐
│  应用容器 (api / ai-service / web)                    │
│  ├─ /metrics 端点  → Prometheus                      │
│  ├─ stdout 日志    → Docker json-file → Promtail → Loki│
│  └─ OTel SDK      → OTel Collector → Jaeger          │
└──────────────────────────────────────────────────────┘
```

- **Prometheus**: 拉模式,抓 `/metrics` 指标(数值时序)
- **Loki**: 推模式,由 Promtail 推送日志文本
- **Jaeger**: 推模式,由 OpenTelemetry SDK 推 span

三者解耦:任一服务异常不影响其他。Loki 不被 Prometheus 抓取(其内部指标可单独查询 http://loki:3100/metrics 如需接 Prometheus,后续可加 scrape_configs)。

## 九、性能与资源建议

| 服务           | 镜像                   | CPU | 内存              | 磁盘                              |
| -------------- | ---------------------- | --- | ----------------- | --------------------------------- |
| Loki 2.9.0     | grafana/loki:2.9.0     | 1.0 | 1G(可放宽到 512M) | 与日志量成正比,30 天保留约 5-50GB |
| Promtail 2.9.0 | grafana/promtail:2.9.0 | 0.5 | 256M              | <100MB(positions 文件)            |

生产环境推荐:

- 日志量大(>50GB/天):Loki 接 S3/MinIO 替代 filesystem
- 高可用:Loki 切到微服务模式,ring 用 etcd/consul
- 大规模查询:开启 chunk cache + 结果缓存(redis/memcached)

## 十、参考文档

- Loki 官方文档: https://grafana.com/docs/loki/latest/
- LogQL 语法: https://grafana.com/docs/loki/latest/logql/
- Promtail 配置: https://grafana.com/docs/loki/latest/send-data/promtail/configuration/
- Grafana Loki 数据源: https://grafana.com/docs/grafana/latest/datasources/loki/
