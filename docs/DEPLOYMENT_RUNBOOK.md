<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 部署运维手册(Deployment Runbook)

IHUI-AI 生产环境的部署、运维、监控、回滚与故障排查。适用于 DevOps / 值班 oncall。

> **2026-09-21 起本文档与生产实际对齐**:生产为**原生 Windows Server + NSSM Windows 服务 +
> Cloudflare Tunnel**的"**push → 自动拉取部署**"模式。原 Docker Compose 蓝绿方案
> (`docker-compose.{blue,green}.yml` + Nginx upstream 切流)**已弃用**
> (GitHub Actions 蓝绿流水线 2026-09-07 起未再成功运行,`docker-compose.yml` 仅保留用于本地开发)。

生产拓扑(实测 2026-09-21):

- 生产机:Windows Server(主机名 `win-20251101pxt`),代码检出在 `D:\IHUI-AI`
- 运行时:Node(源码直跑,api=tsx / web=next / ai-service=uvicorn),无容器
- 入口:`Cloudflared` 服务(Cloudflare Tunnel)把 `aizhs.top` / `api.aizhs.top` 流量转到本机 8801/8802
- 部署:推送 `origin/main` 后,`IHUI-DEPLOYLOOP` 服务每 60s 轮询自动拉取 → 构建 → 重启 → 健康门禁 → 失败自动回滚

---

## 1. 前置条件

### 1.1 主机 / 软件

| 项 | 最低 | 推荐 / 生产实测 |
|---|---|---|
| OS | Windows Server 2019+ | Windows Server(生产机 `win-20251101pxt`) |
| CPU / 内存 / 磁盘 | 2 核 / 4 GB / 40 GB | 4 核+ / 8 GB+ / 100 GB+ SSD |
| Node.js | `>=20.10.0` | `D:\DevEnv\runtimes\node`(服务上下文 PATH 由此注入) |
| pnpm | `>=9.0.0` | `D:\DevEnv\tools\npm-global` |
| PowerShell | 5.1 可跑 | **pwsh 7**(`C:\Program Files\PowerShell\7`,deployloop 依赖) |
| NSSM | 2.24 | 全部服务由 nssm 托管(`C:\Windows\System32\nssm.exe`) |
| Cloudflared | 任意稳定版 | `C:\Program Files (x86)\cloudflared`(Tunnel 对外入口) |
| PostgreSQL | `15` | `IHUI-PG` 服务 |
| Redis | `7` | `IHUI-REDIS` 服务 |

> 旧 Linux + Docker 蓝绿方案见本文件 git 历史(`git log docs/DEPLOYMENT_RUNBOOK.md`),仅作参考不再维护。

### 1.2 端口规划

| 端口 | 服务 | 对外 |
|---|---|---|
| — | Cloudflare Tunnel(`Cloudflared` 服务) | ✅(aizhs.top / api.aizhs.top,无 80/443 监听) |
| 8801 / 8802 / 8803 | web / api / ai-service | ❌(经 Tunnel;本机 127.0.0.1+) |
| 5432 / 6379 | IHUI-PG / IHUI-REDIS | ❌(仅本机) |
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
| `PROMETHEUS_PORT` / `GRAFANA_PORT` / `NODE_EXPORTER_PORT` | 8815 / 8816 / 9100 | 主机映射 |
| `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` | `admin` / `ihui-admin` | **生产必改强密码** |
| `ENABLE_WORKER` / `AI_CALLBACK_SECRET` | `true` / _(空)_ | BullMQ Worker / ai-service 回调校验(建议配置) |
| `OTEL_ENABLED` / `DATABASE_READ_REPLICA_URL` | `false` / _(空)_ | OpenTelemetry / 读副本 |

### 2.4 微信支付(生产必填)

- 缺 `WX_PAY_PRIVATE_KEY` → API 启动中止(`apps/api/src/index.ts` 的 `checkProductionConfig`)
- 缺 `WX_PAY_PLATFORM_CERT` → API 启动中止(回调验签失败)
- 证书位置:`cert/` 目录(`.gitignore` 已配置 `cert/`、`*.pem`、`*.p12`、`*.key`)

---

## 3. 数据库初始化

生产 db / redis 由 `IHUI-PG` / `IHUI-REDIS` 服务(nssm)常驻,无需容器编排:

```powershell
# 1. 确认数据服务在跑
sc query IHUI-PG | findstr STATE ; sc query IHUI-REDIS | findstr STATE

# 2. 应用迁移(在生产 checkout D:\IHUI-AI 下,Node/pnpm 走 D:\DevEnv 注入的 PATH)
pnpm install
pnpm --filter @ihui/database db:migrate
pnpm --filter @ihui/database db:check

# 3. 灌入种子(仅首次/重置;7 步模式化 + 容错隔离)
pnpm --filter @ihui/database seed
# 单步:pnpm --filter @ihui/database seed -- --step=ai-fresh-2026

# 4. 验证
curl -s http://127.0.0.1:8802/api/health/ready
```

---

## 4. 服务清单与启动顺序

全部服务由 NSSM 托管(`AUTO_START`,开机自启),`sc query` 实测清单(2026-09-21):

| 服务 | 职责 |
|---|---|
| `IHUI-PG` / `IHUI-REDIS` | PostgreSQL 15 / Redis 7 |
| `IHUI-AI-SERVICE` | FastAPI 8803(uvicorn 源码直跑) |
| `IHUI-API` | Fastify 8802(pwsh → tsx,目录 `D:\IHUI-AI\apps\api`) |
| web(8801) | Next.js;由 `ihui-deploy.ps1` 拉起的常驻 Node 进程(非 nssm),重启机后由 deployloop 首轮部署恢复 |
| `IHUI-DEPLOYLOOP` | **自动部署循环**:`pwsh -File ihui-deploy-loop.ps1 -Daemon -IntervalSeconds 60`,每 60s 轮询 origin/main |
| `IHUI-GIT-GUARD` | git 写入守门(防并发破坏) |
| `IHUI-PG-BACKUP` | PostgreSQL 每日备份 |
| `IHUI-MONITOR` / `ihui-prometheus` / `ihui-grafana` / `ihui-alertmanager` / `ihui-alert-bridge` | 监控告警栈 |
| `ihui-loki` / `ihui-promtail` | 日志聚合 |
| `ihui-pg-exporter` | PG 指标导出 |
| `IHUI-OLLAMA` | 本地模型推理 |
| `Cloudflared` | Cloudflare Tunnel(对外入口) |

依赖与启动顺序:

```
IHUI-PG / IHUI-REDIS ──► IHUI-AI-SERVICE ──► IHUI-API ──► web(8801)
        └────────────────────────► IHUI-DEPLOYLOOP(每 60s 轮询部署)
Cloudflared(入口) ──► 8801/8802
```

```powershell
# 常用服务操作
sc query IHUI-API | findstr STATE      # 看状态(期望 4 RUNNING)
nssm restart IHUI-API                  # 重启 api
nssm get IHUI-API AppStderr            # 看服务日志路径
Get-Content D:\DevEnv\logs\svc-api-nssm-err.log -Tail 30   # api 崩溃日志
Get-Content D:\IHUI-AI\deploy\win\deploy-loop.log -Tail 50 # 部署循环日志
```

---

## 5. 健康检查端点清单

### 5.1 API(Fastify 8802,实现 `apps/api/src/routes/health.ts`)

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
| ai-service(FastAPI 8803) | `GET /health`、`GET /metrics` |
| Crew(在 API 内,前缀 `/api/crew`) | `GET /api/crew/health`、`/agents`、`/models` |
| Prometheus / Grafana / Node Exporter / Jaeger | `:8815/-/healthy`、`:3001/api/health`、`:9100/metrics`、`:16686/` |

```bash
curl -s http://localhost:8802/api/health/ready | jq . && curl -s http://localhost:8803/health && curl -s http://localhost:8815/-/healthy
```

---

## 6. 部署流程(push → Windows 服务自拉)

**标准流程就是 `git push origin main`,无需任何手工操作**:

```
push origin/main
  └─► IHUI-DEPLOYLOOP(nssm 服务,每 60s 轮询)
        └─► deploy\win\ihui-deploy.ps1(阶段失败即中止,不切流):
              1. git fetch + 以 FETCH_HEAD 计算落后提交数(behind=0 幂等退出)
              2. git merge --ff-only FETCH_HEAD(禁 force,不动他人未提交改动)
              3. 备份当前 web 构建产物(.next → .rollback)
              4. 重建 web(next build);api/ai-service 源码直跑(tsx/uvicorn)无需构建
              5. 重启 NSSM 服务(IHUI-API / IHUI-AI-SERVICE / web)
              6. 健康门禁:web 200 + /api/health ok + ai-service 8803/health 可达
              7. 门禁未过 → 自动回滚(恢复 .rollback 构建 + 重启)
```

关键实现与加固(实测沉淀,见脚本头注释):

- 并发锁:`deploy\win\.deploy.lock`(PID 存活检测,死锁自动清理),daemon 与手工部署互斥
- 日志:`deploy\win\deploy-loop.log`,50MB 自动轮转保留 5 份,时间戳带时区(生产机时钟为 UTC)
- 服务上下文 PATH 不含 node/pnpm,脚本显式前置 `D:\DevEnv\runtimes\node` 等(否则 pnpm build 报 '"node"' 不是内部或外部命令)
- 计划任务(SCHTASKS)在本机被安全策略禁用且模块损坏(2026-09-13 实测三重不可用),周期任务一律走 nssm 服务

### 6.1 手动操作

```powershell
cd D:\IHUI-AI
powershell -ExecutionPolicy Bypass -File deploy\win\ihui-deploy.ps1 -dryrun        # 只 fetch+报告差距
powershell -ExecutionPolicy Bypass -File deploy\win\ihui-deploy.ps1 -diagnose      # 只读诊断(仓库/网络/服务/锁/日志)
powershell -ExecutionPolicy Bypass -File deploy\win\ihui-deploy.ps1 -deployLatest  # 强制部署到 origin/main
powershell -ExecutionPolicy Bypass -File deploy\win\ihui-deploy.ps1 -rollbackOnly  # 仅用上次 .rollback 恢复
```

`scripts/deploy-online.ps1` 是早期一键部署脚本(pull + web 构建 + 拉服务 + 资产指纹验证),日常优先用 `ihui-deploy.ps1`;`deploy/` 下 Docker/Nginx 蓝绿配置(`docker-compose.blue/green.yml`、`deploy/nginx/upstream-*.conf`)已弃用仅存档。

### 6.2 部署前自检(推送者守则,2026-09-21 事故沉淀)

deployloop 会**原样拉取 main**,推送残缺代码 = 生产直接 502。推送前必须:

1. `pnpm --filter @ihui/api typecheck && pnpm --filter @ihui/api build`(本地能构建 ≈ 生产能启动)
2. **新增 `import './xxx.js'` 时,确认被引文件已 `git add`**(2026-09-21 事故:hub 引 12 个模块只推了 6 个,生产 `ERR_MODULE_NOT_FOUND` 循环崩溃)
3. 迁移类提交单独先行,给 deployloop 留出拉取间隔,避免"代码已到迁移未跑"

---

## 7. 回滚流程

```powershell
# 应用层(首选):用上次健康构建直接恢复(.rollback 由每次部署自动生成)
cd D:\IHUI-AI
powershell -ExecutionPolicy Bypass -File deploy\win\ihui-deploy.ps1 -rollbackOnly

# 应用层(代码回退):revert 出问题提交后 push,deployloop 60s 内自动拉取重部署
git revert <bad-commit> && git push origin main

# 服务层:仅重启某个服务
nssm restart IHUI-API

# 数据库回滚(高风险,必须先备份;drizzle 不支持自动 down,需手写 SQL)
node apps/api/scripts/pg-backup.mjs   # 先备份
psql -U $DB_USER -d $DB_NAME < rollback-XXXX.sql ; nssm restart IHUI-API

# 配置回滚
git log --oneline -5 -- .env.production ; git checkout <previous-commit> -- .env.production
nssm restart IHUI-API ; nssm restart IHUI-AI-SERVICE
```

---

## 8. 监控与告警

**监控栈**(配置在 `monitoring/`):Prometheus(8815,抓 api / ai-service / node-exporter,配置 `prometheus/prometheus.yml` + `alerts.yml`)、Grafana(8816,默认 `admin` / `ihui-admin`,**生产必改**,配置 `grafana/`)、Node Exporter(9100,主机指标)、Jaeger(16686,分布式追踪)、OTLP Collector(4318,导出 Jaeger + Prometheus)、Alertmanager(9093,告警路由,若启用)。

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

**保留策略**:PostgreSQL 全量(每日,`IHUI-PG-BACKUP` 服务执行)、Redis AOF(常驻)+ RDB、配置(git 永久)、web 构建(`D:\DevEnv\backups\deploy`,最近若干次,供 `-rollbackOnly`)。

```powershell
# 手动备份(项目脚本)
node apps/api/scripts/pg-backup.mjs

# 恢复(先停 api 避免写入冲突;psql 连接参数取自生产 .env)
nssm stop IHUI-API
psql -U $DB_USER -d $DB_NAME < backup-20260718.sql
nssm start IHUI-API

# Redis(AOF 已开启;RDB 手动触发)
redis-cli -a $REDIS_PASSWORD BGSAVE
```

---

## 10. 常见故障排查

### 10.1 数据库连接失败

**症状**:`/api/health/ready` 返回 `checks.database.status = "error"`,日志含 `ECONNREFUSED` 或 `password authentication failed`。**原因**:`DB_PASSWORD` 不一致(占位符未替换)、连接数耗尽、IHUI-PG 未运行。

```powershell
sc query IHUI-PG | findstr STATE                                  # 服务状态
Get-Content D:\DevEnv\logs\svc-*.log -Tail 50                     # 相关服务日志
psql -U $DB_USER -d $DB_NAME -c "SELECT 1;"                        # 直连
psql -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) FROM pg_stat_activity;"  # 活跃连接
```

### 10.2 Redis 内存满

**症状**:API 报 `OOM command not allowed` 或限流失效。**处理**:IHUI-REDIS 服务参数追加 `--maxmemory 1gb --maxmemory-policy allkeys-lru`(`nssm get IHUI-REDIS AppParameters` 查看后 `nssm set ...` 修改并 `nssm restart IHUI-REDIS`)。

```powershell
redis-cli -a $REDIS_PASSWORD INFO memory | findstr "used_memory_human maxmemory_human maxmemory_policy"
redis-cli -a $REDIS_PASSWORD --bigkeys
```

### 10.3 API 502 Bad Gateway

**症状**:Cloudflare 返回 502(`error code: 502`),前端 API 调用失败。**含义**:Tunnel 活着但源站 8802 无监听——api 进程没起来(典型:新代码 import 缺失/配置缺失导致启动即崩,nssm 反复拉起反复崩)。web 8801 正常而 api 502 时,先查服务与崩溃日志。

**实战案例(2026-09-21)**:推送者提交 `ai-vendors.ts`(引 12 个子模块)但漏推 7 个文件 → 生产 pull 后 `ERR_MODULE_NOT_FOUND` 循环崩溃 → 全站 API 502 约 2 小时。修复:补推缺失文件 + `git pull` + `nssm restart IHUI-API`。教训见 §6.2。

```powershell
sc query IHUI-API | findstr STATE                                    # 服务 RUNNING ≠ 8802 在听,必须看端口
netstat -ano | findstr :8802 | findstr LISTENING                     # 有监听才说明进程活着
Get-Content D:\DevEnv\logs\svc-api-nssm-err.log -Tail 35             # 崩溃根因(启动错误在这)
curl.exe -s -o NUL -w "%{http_code}" http://127.0.0.1:8802/api/health  # 源站直连
cd D:\IHUI-AI ; git log --oneline -1                                 # 确认生产代码版本
# 修复后:git pull + nssm restart IHUI-API;或整体重部署 ihui-deploy.ps1 -deployLatest
```

### 10.4 WebSocket 断连

**症状**:聊天 / Crew 流式执行中断,前端报 `WebSocket disconnected`。**原因**:代理层未配 `Upgrade` / `Connection` 头、读超时过短(需 86400s)、JWT 过期、`ENABLE_WORKER=false`、Redis pub/sub 异常。

```powershell
Select-String -Path D:\DevEnv\logs\svc-api-nssm.log -Pattern "websocket" | Select-Object -Last 20
npx wscat -s "ws://127.0.0.1:8802/ws/chat?token=<JWT>"               # 需 JWT
redis-cli -a $REDIS_PASSWORD PSUBSCRIBE '*'
```

### 10.5 AI Service 不可达

**症状**:`/api/health/ready` 返回 `checks.aiService.status = "unreachable"`,聊天 / Crew 不可用。**注**:全部 provider key 为空时,ai-service 降级 stub 模式(返回模拟响应)。

```powershell
sc query IHUI-AI-SERVICE | findstr STATE
curl.exe -s http://127.0.0.1:8803/health                             # 直连
Get-Content D:\DevEnv\logs\svc-ai-service*.log -Tail 50
# provider key 配置见生产 .env(STEPFUN/AGNES/OPENAI/ANTHROPIC 等)
```
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
