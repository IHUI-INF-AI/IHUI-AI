<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# IHUI-AI 日志栈（Loki + Promtail + Grafana）

本项目使用 Grafana Loki + Promtail 实现生产环境日志聚合，与 Prometheus 指标监控、告警链路（Alertmanager）一起构成完整可观测性栈。

> **部署模型声明（2026-09-06 修订）**：线上生产环境为 **Windows 原生进程部署**——Loki/Promtail/Grafana/Prometheus/Alertmanager 均为**原生二进制**在 `D:\DevEnv\monitor` 下运行，由 Windows 服务（NSSM）或裸进程托管，**并非 docker 容器**。日志采集对象是**本机应用日志文件**，不是 docker 容器日志。`docker-compose.yml` 中的监控服务仅作为**可选容器化方案保留**，不是当前线上的真实形态。请勿再用 `docker compose up loki promtail` 的思路去理解或操作生产监控栈。

## 一、架构说明

```
应用程序（api:8802 / ai-service:8803 / web:8801，原生 node / python 进程）
       │
       │ 写入本机日志文件（如 apps/api/logs/*.log、D:\DevEnv\logs\svc-*.log）
       ▼
Promtail（原生进程，监听 127.0.0.1:9080，抓取本机日志文件 + 解析 + 打标签）
       │  - static_configs 抓取本机应用日志文件（api-app-logs 等 job）
       │  - pipeline_stages: json 解析 → 提取 level/timestamp/requestId
       │  - 推送地址：127.0.0.1:3100（localhost——绝对不能用 docker 服务名 loki）
       ▼
Loki（原生进程，监听 127.0.0.1:3100，日志聚合 + 索引 + 保留）
       │  - 文件系统存储（D:\DevEnv\monitor 下数据目录）
       │  - boltdb-shipper（历史） + tsdb（2024+）
       │  - 30 天自动清理
       ▼
Grafana Explore（LogQL 查询 + 可视化，127.0.0.1:8816）
       │  - 与 Prometheus 指标联动
       ▼
告警 / 排障 / 分析
```

数据流总结：**应用 → 本机日志文件 → Promtail → Loki（127.0.0.1:3100） → Grafana 查询**

> 没有 systemd journal；Promtail 的 `journal` job 仅适用于 Linux 宿主机，Windows 原生部署不使用。

## 二、真实端口一览表（生产本地 127.0.0.1）

> 这是运维查看、配置数据源、抓取 /metrics、推送日志时**唯一以实际端口为准**的对照表（原生部署，监听 loopback 127.0.0.1）。

| 服务                 | 端口（127.0.0.1） | 说明                                                   | 对应 docker 语义端口 |
| -------------------- | ----------------- | ------------------------------------------------------ | -------------------- |
| web（next）          | 8801              | 前端（next start -H 127.0.0.1 -p 8801）                | —                    |
| api（Fastify）       | 8802              | 业务后端，暴露 /metrics                                | —                    |
| ai-service           | 8803              | FastAPI AI 服务（uvicorn 127.0.0.1:8803）              | —                    |
| Prometheus           | **8815**          | 抓取 /metrics，PromQL/告警规则、/targets               | 9090（容器内）       |
| Grafana              | **8816**          | 仪表盘 + Explore 入口                                  | 8816                 |
| Loki                 | **3100**          | 日志推送 / 查询 / /ready / /metrics                    | 3100                 |
| Promtail             | **9080**          | 自身指标 /health / /targets（抓取目标）                | 9080                 |
| Alertmanager         | **9093**          | 告警分组/抑制/路由                                     | 9093                 |
| alert-webhook-bridge | 9096              | 告警转 Server酱（见 monitoring/alertbridge/README.md） | —                    |
| otel-collector       | 8888              | 当前**未部署**（无进程）                               | 8812/8813            |
| Jaeger               | 16686             | 当前**未部署**（无进程）                               | 8814                 |

> 注意：Prometheus 容器内监听 9090，但**原生部署在 8815**。凡文档/配置里看到服务名端口（如 `prometheus:9090`、`loki:3100`、`alertmanager:9093`），这些都是 docker 网络语义，**在原生 Windows 部署下必须替换成 `127.0.0.1` + 上表真实端口**。

## 三、启动 / 查看

监控二进制位于 `D:\DevEnv\monitor`，以 Windows 服务（NSSM）或裸进程方式运行，**不使用 docker-compose up**。

```powershell
# 查看监控各服务安装/运行状态
nssm status ihui-prometheus
nssm status ihui-grafana
nssm status ihui-loki
nssm status ihui-promtail
nssm status ihui-alertmanager

# 服务未运行时，用对应 NSSM 服务重启（服务名以实际安装为准，如 ihui-prometheus）
nssm restart ihui-prometheus
nssm restart ihui-loki
nssm restart ihui-promtail

# 查看各监控服务日志（NSSM 捕获，路径以 D:\DevEnv\logs 及各类子目录为准）
# 如 D:\DevEnv\logs\svc-promtail-nssm*.log（Promtail）、grafana/nssm/*.log（Grafana）
```

启动后服务地址（生产真实）：

- Loki HTTP API：http://127.0.0.1:3100
- Loki 健康检查：http://127.0.0.1:3100/ready
- Loki 指标：http://127.0.0.1:3100/metrics
- Promtail 健康检查：http://127.0.0.1:9080/ready
- Promtail 指标 / 抓取目标：http://127.0.0.1:9080/metrics 、 http://127.0.0.1:9080/targets
- Prometheus：http://127.0.0.1:8815（/targets、/alerts）
- Grafana：http://127.0.0.1:8816

> 若服务丢失/需重建，可参考 `monitoring/alertbridge/README.md` 中"重建命令"一节的 NSSM 写法（Alertmanager、Bridge），Prometheus/Grafana/Loki/Promtail 同理用 `D:\DevEnv\monitor` 下的原生二进制 + `--config.file=...` 注册为 NSSM 服务。

## 四、日志采集对象（本机应用日志文件）

生产环境 Promtail **不采集 docker 容器日志**，也不依赖 `docker.sock`，而是用 `static_configs` 抓取**本机应用日志文件**。核心 job：

| job            | 采集对象                                                    | 关键标签                                   |
| -------------- | ----------------------------------------------------------- | ------------------------------------------ |
| `api-app-logs` | 应用写入的 `*.log`（如 `apps/api/logs/*.log`）              | job=api-app，host=ihui-ai，level/requestId |
| `nginx`        | 反代/Nginx 日志（Linux 布局，Windows 原生可自行改绝对路径） | job=nginx，method/status                   |
| `journal`      | systemd journal（仅 Linux，Windows 不使用）                 | unit/hostname                              |

新增采集时，在 `monitoring/promtail/promtail-config.yml` 的 `scrape_configs` 增加一个 `static_configs`，把 `__path__` 指向目标本机日志文件即可（并配好 json/regex pipeline 解析）。

> 无需给"容器"打 `logging=promtail` 标签；这里不是 docker 采集模型。

## 五、Grafana 查询指南

1. 打开 Grafana（http://127.0.0.1:8816，默认 admin / 配置的 GRAFANA_ADMIN_PASSWORD）
2. 左侧菜单 → **Explore**（放大镜图标）
3. 数据源下拉选择 **Loki**
4. 在查询输入框中写 LogQL

### LogQL 示例

```logql
# === 基础查询 ===

# 查 api 应用日志文件的 ERROR 日志
{job="api-app"} |= "ERROR"

# 查 ai-service 异常
{host="ihui-ai"} |= "Traceback|Exception"

# 全部应用日志（含 level 标签）
{job=~"api-app|api"} | json | level="error"

# === 字段过滤 ===

# 按 requestId 追踪一条请求的完整日志链
{job="api-app"} | json | requestId="abc-123-def"

# 按 level 过滤
{job="api-app"} | json | level="error"
{job="api-app"} | json | level=~"error|fatal"

# === 多条件组合 ===

# 包含 ERROR 但不含 timeout
{job="api-app"} |= "ERROR" != "timeout"

# 正则匹配异常堆栈
{job="api-app"} |~ "Traceback|Exception|Error"

# === 聚合统计 ===

# 5 分钟内 api 应用日志计数
count_over_time({job="api-app"}[5m])

# 按级别分组统计 1 小时日志量
sum by (level) (count_over_time({job="api-app"}[1h]))

# === 时间范围 ===

# 最近 15 分钟所有 ERROR
{job=~"api-app|api"} |= "ERROR" [15m]
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

```powershell
# 原生部署:重启 Loki 服务(服务名以实际安装为准)
nssm restart ihui-loki
```

## 七、常见部署差异陷阱（docker 名 → localhost 映射）

> 这是本仓库最常踩的坑，务必在修改监控配置后自检，防止回退：

1. **不要把 docker 服务名当主机名**。原生 Windows 部署没有 docker 网络，`loki:3100`、`alertmanager:9093`、`prometheus:9090` 这类名字**无法被解析**，会导致：
   - Promtail 往 `loki:3100` 推日志 → **Loki 一直空，看不到任何日志**；
   - Prometheus 的 alertmanager 目标写成 `alertmanager:9093` → **告警断裂，发了没人收到**。
   - 正确姿势：一律用 `127.0.0.1` + 第二节"真实端口一览表"里的端口。
2. **Prometheus 端口是 8815 不是 9090**。9090 是容器内默认端口，原生部署监听 8815；抓 target / 查告警都看 8815。
3. **没有 systemd journal、没有 /var/log/journal**。Linux 常见的 journal/路径，在 Windows 原生部署直接不可用，别照搬静态路径。
4. **Loki 数据目录 & 配置文件路径是 Windows 绝对路径**（`D:\DevEnv\monitor\...`），不是容器内的 `/loki-data`、`/etc/...`。
5. **追踪（Jaeger / otel-collector）当前未部署**。`docker-compose.yml` 里有服务定义但线上无进程；若临时想用追踪，先在本机起好 `otel-collector(8888)` 与 `jaeger(16686)` 进程，再对接。

## 八、故障排查

### 1. Promtail 抓不到日志 / Loki 查不到数据

**检查清单:**

```powershell
# 1) Promtail 是否运行、监听 9080
nssm status ihui-promtail
Get-NetTCPConnection -LocalPort 9080 -State Listen -ErrorAction SilentlyContinue

# 2) 查看抓取目标
# 浏览器打开 http://127.0.0.1:9080/targets ，看有无 target、有无 parse 失败

# 3) 是否是推送地址用了 docker 名 loki:3100（最常见根因）
#    确认 promtail 实际运行副本配置的 clients url 是 http://127.0.0.1:3100/... 而非 http://loki:3100/...
#    运行副本通常在 D:\DevEnv\monitor\promtail\ 下，勿只改 git 里的模板骗自己

# 4) positions 是否正常
# 查看 promtail 的 positions.yaml（D:\DevEnv\monitor 下），确认文件被读到
```

**常见原因:**

- 推送地址写成了 `loki:3100`（docker 名无法解析）→ 改成 `127.0.0.1:3100` 后重启 Promtail
- `__path__` 指到不存在的文件路径 → 核对本机日志文件真实绝对路径
- 日志文件写入权限 / Promtail 无读权限 → 调整 ACL
- pipeline 的 json 字段与日志实际格式不符 → 日志虽采到但解析不出 level 等

### 2. Loki 429 Too Many Requests

**原因:** Promtail 推送速率超过 Loki 的 `ingestion_rate_mb` 限制(默认 4MB/s,本配置 10MB/s)。

**解决:**

1. 查看 Loki 限流指标:`GET http://127.0.0.1:3100/metrics` 中搜 `loki_request`
2. 仍不够则在 `loki-config.yml` 继续调高 `ingestion_rate_mb` 与 `ingestion_burst_size_mb`,重启 Loki。
3. 查看具体哪个 stream 被限流:查 Loki 运行日志中的 `429` / `rate_limited`。

**配置位置:** `monitoring/loki/loki-config.yml` 中 `limits_config.ingestion_rate_mb` 和 `ingestion_burst_size_mb`。

### 3. Loki 启动失败

- 看 Loki 运行日志(NSSM 捕获,如 `D:\DevEnv\logs` 下 loki 相关日志或 grafana/nssm 目录)。
- 常见错误:
  - 数据目录无写权限 → 检查 `D:\DevEnv\monitor\loki-data` ACL
  - `invalid config` → 检查 YAML 语法
  - 端口被占用 → `Get-NetTCPConnection -LocalPort 3100 -State Listen`(Loki 需独占 3100;gRPC 9097 同理勿冲突)

### 4. Grafana 查询 Loki 报错

```powershell
# 1) Grafana 是否能连通 Loki
#    Grafana → Connections → Data Sources → Loki → URL 填 http://127.0.0.1:3100 → Save & Test
#    应显示 "Data source connected and labels found."

# 2) 检查 Loki 服务是否健康
curl http://127.0.0.1:3100/ready
#    应返回 "ready"

# 3) 查询超时 → 调小查询时间范围或优化 LogQL
```

### 5. 磁盘占用过高

```powershell
# 查看 Loki 数据目录大小(D:\DevEnv\monitor\loki-data)
Get-ChildItem D:\DevEnv\monitor\loki-data -Recurse | Measure-Object -Property Length -Sum

# 紧急清理(会丢数据,慎用):
# 1) 停服: nssm stop ihui-loki
# 2) 删除数据目录下可弃 chunk
# 3) 重启: nssm start ihui-loki
```

## 九、与现有监控栈的关系

```
┌──────────────────────────────────────────────────────────────┐
│  Grafana（统一可视化，127.0.0.1:8816）                         │
│  ├─ Prometheus 数据源 → 指标（CPU/内存/QPS/延迟） 127.0.0.1:8815 │
│  ├─ Loki 数据源      → 日志（本机应用日志）      127.0.0.1:3100  │
│  └─ Alertmanager    → 告警（Server酱 → 微信）   127.0.0.1:9093  │
└──────────────────────────────────────────────────────────────┘
       ▲                  ▲                  ▲
┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐
│ Prometheus   │  │ Loki         │  │ Alertmanager + Bridge│
│ (拉 /metrics) │  │ (Promtail 推) │  │ (告警路由 → 微信)     │
└──────────────┘  └──────────────┘  └──────────────────────┘
       ▲                  ▲
┌──────────────────────────────────────┐
│  本机应用进程（api / ai-service / web）│
│  ├─ /metrics 端点  → Prometheus      │
│  ├─ 日志文件        → Promtail → Loki │
└──────────────────────────────────────┘
```

- **Prometheus**: 拉模式,抓 `/metrics` 数值时序。
- **Loki**: 推模式,由 Promtail 推送日志文本(源是本机日志文件)。
- **Alertmanager + alert-webhook-bridge**: 告警最后一跳 → Server酱 → 个人微信(详见 `monitoring/alertbridge/README.md`)。
- **Jaeger / OTel**: 当前未部署,无进程,不作为线上追踪依据。

三者解耦:任一服务异常不影响其他。Loki 自身指标可查 `http://127.0.0.1:3100/metrics`,如需接 Prometheus,可在 `prometheus.yml` 的 `scrape_configs` 中加一个指向 `127.0.0.1:3100` 的 job。

## 十、性能与资源建议

| 服务           | 形态       | CPU | 内存              | 磁盘                              |
| -------------- | ---------- | --- | ----------------- | --------------------------------- |
| Loki 2.9.0     | 原生二进制 | 1.0 | 1G(可放宽到 512M) | 与日志量成正比,30 天保留约 5-50GB |
| Promtail 2.9.0 | 原生二进制 | 0.5 | 256M              | <100MB(positions 文件)            |

生产环境推荐:

- 日志量大(>50GB/天):Loki 接 S3/MinIO 替代 filesystem
- 高可用:Loki 切到微服务模式,ring 用 etcd/consul
- 大规模查询:开启 chunk cache + 结果缓存(redis/memcached)

## 十一、参考文档

- Loki 官方文档: https://grafana.com/docs/loki/latest/
- LogQL 语法: https://grafana.com/docs/loki/latest/logql/
- Promtail 配置: https://grafana.com/docs/loki/latest/send-data/promtail/configuration/
- Grafana Loki 数据源: https://grafana.com/docs/grafana/latest/datasources/loki/

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
