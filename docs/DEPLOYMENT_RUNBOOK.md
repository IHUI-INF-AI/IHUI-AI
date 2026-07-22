# 部署运维手册(Deployment Runbook)

IHUI-AI 生产环境的部署、运维、监控、回滚与故障排查。适用于 DevOps / 值班 oncall。

服务编排基于根目录 `docker-compose.yml`,含 `api`(Fastify 8080)、`web`(Next.js 3000)、
`ai-service`(FastAPI 8000)、`db`(PostgreSQL 15)、`redis`(Redis 7)、`migrate`(一次性迁移)、
`prometheus`、`grafana`、`node-exporter`、`jaeger`、`otel-collector`。

---

## 1. 前置条件

### 1.1 主机 / 软件

| 项 | 最低 | 推荐 |
|---|---|---|
| CPU / 内存 / 磁盘 | 2 核 / 4 GB / 40 GB | 4 核+ / 8 GB+ / 100 GB+ SSD |
| OS | Linux x86_64 | Ubuntu 22.04 / Debian 12 |
| Docker | `>=24.0` | `docker --version` |
| Docker Compose | `v2.20+` | `docker compose version` |
| Node.js | `>=20.10.0` | 本地 / SDK 生成用 |
| pnpm | `>=9.0.0`(9.15.0 推荐) | `pnpm --version` |
| PostgreSQL | `15`(compose 用 `postgres:15-alpine`) | 容器自带 |
| Redis | `7`(compose 用 `redis:7-alpine`) | 容器自带 |

### 1.2 端口规划

| 端口 | 服务 | 对外 |
|---|---|---|
| 80 / 443 | Nginx(HTTPS 终止) | ✅ |
| 3000 / 8802 / 8803 | web / api / ai-service | ❌(经 Nginx) |
| 5432 / 6379 | db / redis | ❌(仅内网) |
| 8815 / 3001 / 9100 | Prometheus / Grafana / Node Exporter | ❌(或 VPN) |
| 16686 / 4318 | Jaeger UI / OTLP Collector | ❌ |

---

## 2. 环境变量清单

源文件:`.env.production.example`(根目录)。

```bash
cp .env.production.example .env.production   # 切勿提交,gitignore 已忽略
grep -E '<your-|<generate-' .env.production  # 应无输出(校验占位符)
```

### 2.1 必填项

| 变量 | 说明 |
|---|---|
| `DOMAIN` / `WEB_PORT` | 主域名 / 前端端口 |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | **密码强随机 ≥ 16 字符** |
| `REDIS_PASSWORD` | **强随机 ≥ 16 字符** |
| `JWT_SECRET` | **≥ 32 字符**(`openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | 默认 `7d` |
| `CREDENTIALS_ENCRYPTION_KEY` | **≥ 32 字符** 凭证加密 |
| `CORS_ORIGIN` | 单数,如 `https://aizhs.top` |

### 2.2 AI Provider(至少一个)

`STEPFUN_API_KEY` + `STEPFUN_API_BASE`(默认)/ `AGNES_API_KEY` + `AGNES_API_BASE`(备用)/
`GROQ_API_KEY` / `GEMINI_API_KEY` / `OPENROUTER_API_KEY`(免费)/ `OPENAI_API_KEY` /
`ANTHROPIC_API_KEY`(付费)。`LITELLM_MODEL` 默认 `stepfun/step-3.7-flash`。
全部为空时降级 stub 模式,**不可生产**。

### 2.3 可选

| 变量 | 默认 | 说明 |
|---|---|---|
| `PROMETHEUS_PORT` / `GRAFANA_PORT` / `NODE_EXPORTER_PORT` | 8815 / 3001 / 9100 | 主机映射 |
| `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` | `admin` / `ihui-admin` | **生产必改强密码** |
| `ENABLE_WORKER` / `AI_CALLBACK_SECRET` | `true` / _(空)_ | BullMQ Worker / ai-service 回调校验(建议配置) |
| `OTEL_ENABLED` / `DATABASE_READ_REPLICA_URL` | `false` / _(空)_ | OpenTelemetry / 读副本 |

### 2.4 微信支付(生产必填)

- 缺 `WX_PAY_PRIVATE_KEY` → API 启动中止(`apps/api/src/index.ts` 的 `checkProductionConfig`)
- 缺 `WX_PAY_PLATFORM_CERT` → API 启动中止(回调验签失败)
- 证书位置:`cert/` 目录(`.gitignore` 已配置 `cert/`、`*.pem`、`*.p12`、`*.key`)

---

## 3. 数据库初始化

```bash
# 1. 启动 db + redis,等待 healthy
docker compose up -d db redis && docker compose ps

# 2. 应用迁移(docker-compose.yml 中 migrate 服务基于 Dockerfile.migrate,
#    api depends_on migrate completed_successfully 才启动)
docker compose up -d migrate
# 手动(本地 Node 20 + pnpm 9):
pnpm install && pnpm --filter @ihui/database db:migrate && pnpm --filter @ihui/database db:check

# 3. 灌入种子(packages/database/seed/index.ts,7 步模式化 + 容错隔离)
docker compose exec api pnpm --filter @ihui/database seed
# 单步:pnpm --filter @ihui/database seed -- --step=ai-fresh-2026

# 4. 验证
docker compose exec db psql -U $DB_USER -d $DB_NAME -c "\dt" | head -20
curl -s http://localhost:8802/api/health/ready | jq .checks.database
```

---

## 4. 服务启动顺序

依赖拓扑(由 `docker-compose.yml` 的 `depends_on` 自动处理):

```
db ────┐
       ├──► migrate(一次性)──► api ──► web
redis ─┘                         │
                                 └──► ai-service(独立,依赖 db + redis)
```

启动顺序:`db` → `redis` → `migrate` → `ai-service` → `api` → `web` → 监控栈
(prometheus / grafana / node-exporter / jaeger / otel-collector)。

```bash
# 一键启动(推荐)
docker compose up -d && docker compose ps
# 分步启动(调试):docker compose up -d db redis → up migrate(等退出码 0)→
#   up -d ai-service api web → up -d prometheus grafana node-exporter jaeger otel-collector
docker compose logs --tail=50 api && docker compose logs --tail=50 ai-service
```

---

## 5. 健康检查端点清单

### 5.1 API(Fastify 8080,实现 `apps/api/src/routes/health.ts`)

| 端点 | 用途 |
|---|---|
| `GET /api/health` / `/health/live` | 存活检查 / 轻量存活(不查依赖) |
| `GET /api/health/ready` | 就绪检查(DB + Redis + AI service + 微信支付) |
| `GET /api/health/metrics` / `/health/history` | 指标摘要 / 最近 100 次 ready 历史 |

`/api/health/ready` 的 `checks`:

| check | status | 阻塞 ready? |
|---|---|---|
| `database` | ok / error | ✅(error 返回 503) |
| `redis` | ok / error / skip | ✅(除 skip) |
| `aiService` | ok / error / unreachable | ❌(降级,仅 warning) |
| `wechatPay` | ok / partial / missing | ❌(降级,仅 warning) |

### 5.2 其他服务

| 服务 | 端点 |
|---|---|
| ai-service(FastAPI 8000) | `GET /health`、`GET /metrics` |
| Crew(在 API 内,前缀 `/api/crew`) | `GET /api/crew/health`、`/agents`、`/models` |
| Prometheus / Grafana / Node Exporter / Jaeger | `:8815/-/healthy`、`:3001/api/health`、`:9100/metrics`、`:16686/` |

```bash
curl -s http://localhost:8802/api/health/ready | jq . && curl -s http://localhost:8803/health && curl -s http://localhost:8815/-/healthy
```

---

## 6. 蓝绿部署流程

蓝绿通过两份 compose 文件维护两套环境,Nginx upstream 切换流量。配置:`deploy/nginx/upstream-{blue,green}.conf`(`server 127.0.0.1:8081` / `8082`)。

```bash
# 1. 准备(两份 compose,改容器名与端口避免冲突:blue→8081,green→8082)
cp docker-compose.yml docker-compose.blue.yml && cp docker-compose.yml docker-compose.green.yml

# 2. 部署 Green(不动 Blue),验证 ready
docker compose -f docker-compose.green.yml build api web ai-service
docker compose -f docker-compose.green.yml up -d db redis migrate
docker compose -f docker-compose.green.yml up -d ai-service api web
curl -s http://localhost:8082/api/health/ready | jq .status   # 期望 "ready"

# 3. Nginx 切换流量到 Green,重载并验证
sudo ln -sf /etc/nginx/conf.d/upstream-green.conf /etc/nginx/conf.d/upstream-active.conf
sudo nginx -t && sudo nginx -s reload && curl -s https://aizhs.top/api/health/ready | jq .status

# 4. Green 稳定 10-30 分钟后关闭 Blue(保留镜像与数据卷 24h 用于回滚)
docker compose -f docker-compose.blue.yml down
```

下次部署角色互换:新版本部署到 Blue,流量从 Green 切回 Blue。

---

## 7. 回滚流程

```bash
# 应用层(快速):回退镜像 tag
docker images ihui-api --format '{{.Tag}} {{.CreatedAt}}' | head -10
# 修改 docker-compose.yml 的 image tag(如 ihui-api:v0.1.2)→ docker compose up -d api web → curl /api/health/ready

# 蓝绿回滚:Nginx 切回 blue
sudo ln -sf /etc/nginx/conf.d/upstream-blue.conf /etc/nginx/conf.d/upstream-active.conf
sudo nginx -t && sudo nginx -s reload && curl -s https://aizhs.top/api/health/ready | jq .status

# 数据库回滚(高风险,必须先备份;drizzle 不支持自动 down,需手写 SQL)
docker compose exec db pg_dump -U $DB_USER $DB_NAME > backup-pre-rollback-$(date +%Y%m%d%H%M).sql
docker compose exec db psql -U $DB_USER -d $DB_NAME < rollback-XXXX.sql && docker compose restart api

# 配置回滚
git log --oneline -5 -- .env.production && git checkout <previous-commit> -- .env.production
docker compose up -d api web ai-service
```

---

## 8. 监控与告警

**监控栈**(配置在 `monitoring/`):Prometheus(8815,抓 api / ai-service / node-exporter,配置 `prometheus/prometheus.yml` + `alerts.yml`)、Grafana(3001,默认 `admin` / `ihui-admin`,**生产必改**,配置 `grafana/`)、Node Exporter(9100,主机指标)、Jaeger(16686,分布式追踪)、OTLP Collector(4318,导出 Jaeger + Prometheus)、Alertmanager(9093,告警路由,若启用)。

**关键告警**:

| 告警 | 触发 | 严重度 |
|---|---|---|
| ApiDown / DbDown / RedisDown | `up{job="*"} == 0` 持续 1 分钟 | Critical |
| ApiHighErrorRate / ApiHighLatency | 5xx > 5% / P95 > 2s 持续 5 分钟 | High |
| DbConnectionPoolExhausted | `pg_stat_activity_count` > 80% max | High |
| RedisMemoryHigh | `used / max > 90%` | High |
| CertExpiringSoon | 微信支付证书剩余 < 30 天 | Medium |

---

## 9. 备份与恢复

**保留策略**:PostgreSQL 全量(每日 03:00,30 天)、Redis RDB(每日 04:00,7 天)、配置 / 镜像(每次部署,永久 git / 最近 5 个 tag)。

```bash
# PostgreSQL 自动备份(cron,每日 03:00,保留 30 天)
# /etc/cron.d/ihui-db-backup:
# 0 3 * * * root docker exec ihui-db pg_dump -U ihui ihui | gzip > /var/backups/ihui-db-$(date +\%Y\%m\%d).sql.gz && find /var/backups/ -name "ihui-db-*.sql.gz" -mtime +30 -delete

# 手动备份 / 项目脚本
docker compose exec db pg_dump -U $DB_USER $DB_NAME | gzip > backup-$(date +%Y%m%d%H%M).sql.gz
node apps/api/scripts/pg-backup.mjs

# 恢复(先停 api 避免写入冲突)
docker compose stop api && gunzip -c backup-20260718.sql.gz | docker compose exec -T db psql -U $DB_USER -d $DB_NAME && docker compose start api

# Redis RDB(AOF 已开启 --appendonly yes)
docker compose exec redis redis-cli -a $REDIS_PASSWORD BGSAVE && docker cp ihui-redis:/data/dump.rdb ./redis-backup-$(date +%Y%m%d).rdb
docker compose stop redis && docker cp ./redis-backup-20260718.rdb ihui-redis:/data/dump.rdb && docker compose start redis
```

---

## 10. 常见故障排查

### 10.1 数据库连接失败

**症状**:`/api/health/ready` 返回 `checks.database.status = "error"`,日志含 `ECONNREFUSED` 或 `password authentication failed`。**原因**:`DB_PASSWORD` 不一致(占位符未替换)、连接数耗尽、db 容器未 healthy。

```bash
docker compose ps db && docker compose logs --tail=50 db
docker compose exec db psql -U $DB_USER -d $DB_NAME -c "SELECT 1;"                                  # 直连
docker compose exec db psql -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) FROM pg_stat_activity;"      # 活跃连接
docker compose exec api printenv DATABASE_URL                                                        # API 容器配置
```

### 10.2 Redis 内存满

**症状**:API 报 `OOM command not allowed` 或限流失效。**处理**:docker-compose.yml 的 redis 服务追加 `--maxmemory 1gb --maxmemory-policy allkeys-lru`。

```bash
docker compose exec redis redis-cli -a $REDIS_PASSWORD INFO memory | grep -E "used_memory_human|maxmemory_human|maxmemory_policy"
docker compose exec redis redis-cli -a $REDIS_PASSWORD --bigkeys
```

### 10.3 API 502 Bad Gateway

**症状**:Nginx 返回 502,前端 API 调用失败。**原因**:api 启动失败(配置 / 迁移 / 端口冲突)、OOM、Nginx upstream 错、网络隔离。

```bash
docker compose ps api && docker compose logs --tail=50 api
curl -s http://localhost:8802/api/health                                # api 直连
docker compose exec web wget -qO- http://api:8080/api/health            # 容器间网络
```

### 10.4 WebSocket 断连

**症状**:聊天 / Crew 流式执行中断,前端报 `WebSocket disconnected`。**原因**:Nginx 未配 `Upgrade` / `Connection` 头、`proxy_read_timeout` 过短(需 86400s)、JWT 过期、`ENABLE_WORKER=false`、Redis pub/sub 异常。

```bash
docker compose logs --tail=100 api | grep -i websocket
wscat -c "ws://localhost:8802/ws/chat?token=<JWT>"                      # 需 JWT
docker compose exec redis redis-cli -a $REDIS_PASSWORD PSUBSCRIBE '*'  # pub/sub
```

### 10.5 AI Service 不可达

**症状**:`/api/health/ready` 返回 `checks.aiService.status = "unreachable"`,聊天 / Crew 不可用。**注**:全部 provider key 为空时,ai-service 降级 stub 模式(返回模拟响应)。

```bash
docker compose ps ai-service && docker compose logs --tail=50 ai-service
docker compose exec ai-service curl -s http://localhost:8000/health
docker compose exec ai-service printenv | grep -E "STEPFUN|AGNES|OPENAI|ANTHROPIC|LITELLM_MODEL"
```
