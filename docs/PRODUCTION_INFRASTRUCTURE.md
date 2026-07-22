# 生产基础设施拓扑 (Production Infrastructure)

> 本文档记录 IHUI-AI 生产环境的基础设施拓扑、组件清单、依赖关系与容量规划,
> 是事故响应、容量评估与架构演进的基础参考。

---

## 1. 文档目的

- 沉淀生产环境的组件清单与拓扑关系,便于新人快速了解系统
- 为事故响应 (INCIDENTS.md) 提供基础设施参考
- 为容量规划与扩容决策提供依据
- 为后续 K8s 迁移或架构演进提供现状基线

适用范围:IHUI-AI 生产环境 (aizhs.top)。

---

## 2. 环境总览

| 项目 | 值 |
|------|-----|
| **主域名** | aizhs.top |
| **别名** | www.aizhs.top |
| **部署方式** | 单机 Docker + Blue-Green (详见 [INFRASTRUCTURE_DECISION.md](./INFRASTRUCTURE_DECISION.md)) |
| **操作系统** | Ubuntu 22.04 LTS |
| **服务器规格(建议最低)** | 8 核 CPU / 16GB RAM / 100GB SSD |
| **Docker 版本** | 24.x |
| **Docker Compose 版本** | v2.x |
| **部署目录** | /apps/ihui-ai |
| **部署脚本** | deploy/deploy.sh |

---

## 3. 服务拓扑

```
                        Internet
                           │
                           ▼
                  ┌─────────────────┐
                  │  Nginx (443/80) │  ← SSL 终止 + 反向代理
                  └────────┬────────┘
                           │
            ┌──────────────┴──────────────┐
            ▼                             ▼
   ┌─────────────────┐           ┌─────────────────┐
   │ blue_web:3000   │           │ green_web:3001  │  ← Blue-Green 切换
   └────────┬────────┘           └────────┬────────┘
            │                             │
            └──────────────┬──────────────┘
                           ▼
   ┌─────────────────┐           ┌─────────────────┐
   │ blue_api:8080   │           │ green_api:8081  │  ← Blue-Green 切换
   └────────┬────────┘           └────────┬────────┘
            │                             │
            └──────────────┬──────────────┘
                           │
       ┌───────────┬───────┴───────┬────────────┬─────────────┐
       ▼           ▼               ▼            ▼             ▼
  ┌─────────┐ ┌─────────┐  ┌─────────────┐ ┌─────────┐ ┌───────────┐
  │PostgreSQL│ │  Redis  │  │  ai-service │ │监控栈   │ │ 日志栈    │
  │ (5432)  │ │ (6379)  │  │   (8000)    │ │         │ │           │
  └─────────┘ └─────────┘  └──────┬──────┘ └─────────┘ └───────────┘
                                   │
                                   ▼
                         ┌─────────────────┐
                         │  StepFun LLM    │
                         │  Agnes AI API   │
                         └─────────────────┘

  监控栈:
    Prometheus (9090) ← node-exporter (9100) / api / postgres / redis
    Grafana (3001) ← Prometheus + Loki
    Alertmanager (9093) → 飞书 / 邮件

  日志栈:
    Promtail (9080) → Loki (3100) → Grafana

  追踪栈:
    otel-collector (4317) → Jaeger (16686)
```

---

## 4. 组件清单

| 服务 | 端口 | 镜像 / 版本 | 健康检查 | 备注 |
|------|------|-------------|----------|------|
| nginx | 80 / 443 | nginx:1.25 | `/nginx-health` | 反向代理 + SSL |
| web (blue) | 3000 | ihui/web:latest | `/api/health` | Next.js SSR |
| web (green) | 3001 | ihui/web:latest | `/api/health` | Next.js SSR (蓝绿备用) |
| api (blue) | 8080 | ihui/api:latest | `/api/health` | Fastify REST |
| api (green) | 8081 | ihui/api:latest | `/api/health` | Fastify REST (蓝绿备用) |
| ai-service | 8000 | ihui/ai-service:latest | `/health` | FastAPI Python |
| postgres | 5432 | postgres:16-alpine | `pg_isready` | 主数据库 |
| redis | 6379 | redis:7-alpine | `redis-cli ping` | 缓存 + 队列 |
| prometheus | 9090 | prom/prometheus:v2.50.0 | `/-/healthy` | 指标采集 |
| grafana | 3001 | grafana/grafana:10.2.0 | `/api/health` | 可视化 |
| loki | 3100 | grafana/loki:2.9.0 | `/ready` | 日志聚合 |
| promtail | 9080 | grafana/promtail:2.9.0 | `/ready` | 日志收集 |
| jaeger | 16686 | jaegertracing/all-in-one:1.50 | `/` | 分布式追踪 |
| otel-collector | 4317 | otel/opentelemetry-collector-contrib:0.95.0 | `/` | OTLP 收集 |
| alertmanager | 9093 | prom/alertmanager:v0.26.0 | `/-/healthy` | 告警路由 |
| node-exporter | 9100 | prom/node-exporter:v1.7.0 | `/metrics` | 主机指标 |

---

## 5. 数据持久化

| 数据卷 | 挂载点 | 用途 | 备份策略 | 保留期 |
|--------|--------|------|----------|--------|
| `postgres-data` | /var/lib/postgresql/data | PostgreSQL 主数据 | 每日 02:00 pg_dump | 7 天 |
| `redis-data` | /data | Redis RDB 快照 | 每日 02:30 RDB | 3 天 |
| `loki-data` | /loki | Loki 日志存储 | 不备份(可重建) | 30 天 |
| `grafana-data` | /var/lib/grafana | Grafana 仪表板与配置 | git 版本控制(IaC) | 永久 |
| `promtail-positions` | /positions | Promtail 读取位置 | 不备份 | - |
| `prometheus-data` | /prometheus | Prometheus 指标(15s 粒度) | 不备份 | 15 天 |
| `/var/log/nginx/` | 主机路径 | Nginx 访问/错误日志 | Promtail 采集到 Loki | 30 天 |
| `/apps/api/logs/` | 主机路径 | API 应用日志 | Promtail 采集到 Loki | 30 天 |

---

## 6. 网络拓扑

### 6.1 Docker 网络

```
┌──────────────────────────────────────────────┐
│  网络: ihui-net (Docker bridge)              │
│                                              │
│  所有服务通过服务名互访:                       │
│  - api → postgres:5432                       │
│  - api → redis:6379                          │
│  - api → ai-service:8000                     │
│  - prometheus → api:8080 / postgres / redis  │
│  - promtail → 各容器 /var/log/*              │
│  - grafana → prometheus:9090 / loki:3100     │
└──────────────────────────────────────────────┘
```

### 6.2 端口暴露策略

| 类型 | 端口 | 绑定方式 | 说明 |
|------|------|----------|------|
| 公开 | 80 | 0.0.0.0:80 | HTTP → 重定向到 443 |
| 公开 | 443 | 0.0.0.0:443 | HTTPS 入口 |
| 内部 | 8810 (PostgreSQL) | 127.0.0.1:8810 | 仅本机访问(宿主映射,容器内 5432) |
| 内部 | 8811 (Redis) | 127.0.0.1:8811 | 仅本机访问(宿主映射,容器内 6379) |
| 内部 | 8815 (Prometheus) | 127.0.0.1:8815 | 仅本机访问(宿主映射,容器内 9090) |
| 内部 | 8816 (Grafana) | 127.0.0.1:8816 | 通过 Nginx 反代(宿主映射,容器内 3000) |
| 内部 | 8818 (Loki) | 127.0.0.1:8818 | 仅本机访问(宿主映射,容器内 3100) |
| 内部 | 8814 (Jaeger) | 127.0.0.1:8814 | 通过 Nginx 反代(宿主映射,容器内 16686) |

> 除 80/443 外,所有端口绑定到 127.0.0.1,仅通过 Nginx 反向代理对外。

---

## 7. SSL/TLS

| 项目 | 值 |
|------|-----|
| **证书颁发机构** | Let's Encrypt (certbot) |
| **续期脚本** | `deploy/deploy_certs.sh renew` |
| **续期频率** | 每月 1 日 03:00 (cron) |
| **证书路径** | `/etc/nginx/ssl/aizhs.top.crt` / `aizhs.top.key` |
| **协议** | TLSv1.2 + TLSv1.3 |
| **密码套件** | 现代浏览器推荐套件 (Mozilla intermediate) |
| **HSTS** | 开启, max-age=31536000, includeSubDomains |
| **证书监控** | 到期前 14 天 / 7 天 / 1 天告警 |

### Nginx SSL 关键配置

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_stapling on;
ssl_stapling_verify on;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

---

## 8. 备份策略

| 数据 | 备份方式 | 频率 | 保留期 | 存储位置 |
|------|----------|------|--------|----------|
| PostgreSQL | `pg_dump` 全量 | 每日 02:00 | 7 天 | 本地 /backup/ + OSS (后续) |
| Redis | RDB 快照 (`BGSAVE`) | 每日 02:30 | 3 天 | 本地 /backup/ |
| 配置文件 | git 版本控制 | 实时 | 永久 | 代码仓库 |
| Grafana 仪表板 | 导出 JSON + git | 每次变更 | 永久 | 代码仓库 |
| Nginx 配置 | git 版本控制 | 实时 | 永久 | 代码仓库 |
| 用户上传文件 | 异步同步到 OSS | 实时(后续实现) | 永久 | 阿里云 OSS |

### 备份恢复演练

- 每季度进行一次 PostgreSQL 备份恢复演练
- 验证备份完整性与恢复时间
- 记录恢复步骤到 `DEPLOYMENT_RUNBOOK.md`

---

## 9. 监控告警

### 9.1 指标采集

| 采集器 | 目标 | 间隔 | 说明 |
|--------|------|------|------|
| Prometheus | api (Fastify metrics) | 15s | HTTP 请求、错误率、延迟 |
| Prometheus | PostgreSQL (postgres_exporter) | 15s | 连接数、查询数、缓存命中 |
| Prometheus | Redis (redis_exporter) | 15s | 内存、命中率、key 数 |
| Prometheus | node-exporter | 15s | CPU、内存、磁盘、网络 |
| Prometheus | nginx (nginx_exporter) | 15s | 请求量、状态码分布 |

### 9.2 告警链路

```
   Prometheus (规则评估)
        │
        ▼
   Alertmanager (路由 + 分组 + 抑制)
        │
        ├──→ 飞书群 (P0/P1 即时)
        ├──→ 邮件 (P2/P3 汇总)
        └──→ 电话 (P0 升级,后续接入)
```

- 告警规则: `monitoring/prometheus/rules/*.yml`
- 告警路由配置: `monitoring/alertmanager/config.yml`
- 告警静默: 维护窗口通过 Alertmanager silence 临时屏蔽

### 9.3 核心告警规则

| 告警 | 条件 | 等级 | 通知方式 |
|------|------|------|----------|
| API 5xx 错误率 | `http_5xx_rate > 5%` 持续 1 分钟 | P1 | 飞书 + 邮件 |
| API 不可达 | `up{job="api"} == 0` 持续 1 分钟 | P0 | 飞书 + 电话 |
| PostgreSQL 不可达 | `pg_up == 0` 持终 1 分钟 | P0 | 飞书 + 电话 |
| Redis 不可达 | `redis_up == 0` 持续 1 分钟 | P1 | 飞书 + 邮件 |
| CPU 使用率 | `cpu_usage > 80%` 持续 5 分钟 | P2 | 邮件 |
| 磁盘使用率 | `disk_usage > 90%` 持续 1 分钟 | P1 | 飞书 + 邮件 |
| 内存使用率 | `memory_usage > 90%` 持续 3 分钟 | P1 | 飞书 + 邮件 |
| 证书即将过期 | `cert_expire_days < 14` | P2 | 邮件 |

### 9.4 日志与追踪

- **日志聚合**: Loki + Promtail (30 天保留)
- **可视化**: Grafana LogQL 查询
- **分布式追踪**: Jaeger + OpenTelemetry (OTLP)
- **追踪采样率**: 生产环境 10% (高流量时动态调整)

---

## 10. 容量规划

| 指标 | 当前值 | 容量上限 | 扩容阈值 |
|------|--------|----------|----------|
| **QPS (峰值)** | ~100 | ~1000 (api 8 workers) | - |
| **CPU 使用率** | ~30% | - | > 70% 持续 5 分钟 |
| **内存使用率** | ~40% | - | > 80% 持续 5 分钟 |
| **磁盘使用率** | ~35% | - | > 80% 持续 1 小时 |
| **PostgreSQL 连接数** | ~50 | 200 | > 150 |
| **Redis 内存** | ~500MB | 2GB | > 1.5GB |

### 扩容方式

1. **水平扩容 (首选)**: `docker-compose up --scale api=3 -d`
2. **垂直扩容**: 升级服务器规格 (8C → 16C, 16GB → 32GB)
3. **读写分离**: PostgreSQL 增加只读副本 (后续)
4. **K8s 迁移**: 触发条件详见 [INFRASTRUCTURE_DECISION.md](./INFRASTRUCTURE_DECISION.md)

### K8s 迁移触发条件

- 单机 QPS 持续 > 800
- 多次因单机故障导致 P0 事故
- 需要多区域部署 / 灰度发布
- 团队具备 K8s 运维能力

---

## 11. 依赖外部服务

| 服务 | 用途 | 端点 | 故障影响 | 降级方案 |
|------|------|------|----------|----------|
| StepFun LLM API | AI 对话 / 推理 | https://api.stepfun.com | AI 功能不可用 | 提示用户稍后重试 |
| Agnes AI API | AI 多模态生成 | https://apihub.agnes-ai.com | AI 生成功能不可用 | 提示用户稍后重试 |
| 微信支付 API | 支付下单 / 回调 | https://api.mch.weixin.qq.com | 支付功能不可用 | 关闭支付入口 + 公告 |
| 阿里云 OSS (后续) | 用户上传文件存储 | https://oss-cn-hangzhou.aliyuncs.com | 上传功能不可用 | 提示用户稍后重试 |
| 飞书开放平台 | OAuth 登录 | https://open.feishu.cn | 飞书登录不可用 | 引导其他登录方式 |
| Coze 平台 | OAuth 登录 / Bot | https://api.coze.cn | Coze 相关功能不可用 | 关闭相关入口 |

### 外部依赖监控

- 每个外部服务配置可用性探测 (Prometheus blackbox_exporter)
- 探测间隔 30s,失败 3 次触发 P2 告警
- 月度统计各服务 SLA,低于 99.5% 评估替代方案

---

## 12. 相关文档链接

- [部署决策](./INFRASTRUCTURE_DECISION.md) — IaC 决策、K8s 迁移触发条件
- [事故响应手册](./INCIDENTS.md) — 事故等级、响应流程、Runbook
- [部署手册](./DEPLOYMENT_RUNBOOK.md) — 部署步骤、回滚流程
- [部署脚本](../deploy/README.md) — deploy.sh / deploy_certs.sh 说明
- [监控日志](../monitoring/README-logging.md) — Prometheus / Loki / Jaeger 配置
- [系统架构](./architecture.md) — 应用层架构、数据库、API 路由
