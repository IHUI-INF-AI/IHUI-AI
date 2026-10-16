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
| `EDU_ARREAR_REMIND_CHANNELS` | `wechat` | 每天 09:00 欠费自动催缴的外发通道,可 `sms` 或 `wechat,sms`。**默认不开短信**——那是按名单计费的批量动作,须运营显式确认;未配短信密钥时逐收件人回 `not_configured`,该人没留号码回 `no_phone`,两者都不算"已送达" |
| — 催缴效果怎么查 | `GET /api/edu-ai-management/fee-reminder/stats?days=30` | 按通道/状态/日聚合的**留痕**统计(留痕≠送达,该说明随响应 `caveat` 字段返回)。要看真实触达率需先把逐收件人回执持久化 |
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
| `IHUI-PG` / `IHUI-REDIS` | PostgreSQL 18 / Redis 7 |
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

### 10.6 App 提示「网络较慢」(公网高 TTFB,2026-10-14 诊断立档)

**症状**:手机 App 顶部琥珀横幅「网络较慢」(慢网 ≠ 断网);公网 `https://api.aizhs.top/api/health` TTFB 1.5–4.4s。**服务端无故障**:handler 零 I/O、纯内存返回(`apps/api/src/routes/health.ts:24-31`),SLA 口径 P99 100ms 已含代理;延迟 ~99% 花在**链路**上。

**链路分段画像**(真机 Redmi 5G + 本机双向实测):

| 段 | 实测 | 性质 |
|---|---|---|
| 手机(移动 5G)→ CF anycast 边缘 | ICMP RTT min/avg/max = 353/493/586ms | 物理下限,不可消除 |
| TLS 握手 | 单独 0.8s(≈1.6 RTT) | 跨境 RTT + QUIC 重传叠加 |
| 请求/响应全程 TTFB | 1.5–4.4s,长尾 6.37s | 见下方根因① |
| CF 边缘 → cloudflared → 源站 8802 | TLS 后仍 +0.7–0.9s | 根因①主战场 |
| Fastify handler | 1–5ms(本机 PG 0.3–2ms) | 非瓶颈 |

**根因①(可修,主因):cloudflared 传输协议为默认 QUIC。** 国内运营商对跨境 UDP 的 QoS 远差于 TCP;仓内 2026-08-05 既有读数「http2 比 quic 公网 TTFB 快约 2 倍」(`deploy/scripts/prod-bundle/health-check-bare.ps1:156`),且该健康检查第 10 项**长期因服务未带 `--protocol http2` 而 WARN** —— 但安装端(`deploy/scripts/prod-bundle/cloudflared/install-service-windows.ps1`)与启动端(`scripts/start-cloudflared-tunnel.ps1`)此前都不写协议参数,守门只能干喊。2026-10-14 起两处已从源头固化 `--protocol http2`(仅对**新装/重启加载**生效;存量运行中的服务不重装不会变,见下)。

**生产主机存量服务切换(免重装,注册表直改 + 重启)。** 生产主机 = `deploy/scripts/prod-bundle/` 的目标 Windows 主机(cloudflared 服务 + api:8802 所在机);**开发机不是生产机**(实测:开发机无 cloudflared 二进制、无 `D:\DevEnv\logs`、无 UDP 7844 监听)。以下命令**只在生产主机上执行**;切换窗口期内经 Tunnel 的全站流量会断,约数十秒:

```powershell
# 1. 看当前协议(期望输出含 --protocol http2)
(Get-CimInstance Win32_Service -Filter "Name='Cloudflared'").PathName

# 2. 切换 http2(把 <TOKEN> 换成 CF Zero Trust 隧道 token;或用仓内安装脚本免 token:
#    & 'C:\Program Files (x86)\cloudflared\cloudflared.exe' service uninstall
#    & 'C:\Program Files (x86)\cloudflared\cloudflared.exe' service install <TOKEN> --protocol http2)
$cf = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
$tok = '<TOKEN>'
sc.exe config Cloudflared binPath= "`"$cf`" service run $tok --protocol http2"
Restart-Service Cloudflared
(Get-CimInstance Win32_Service -Filter "Name='Cloudflared'").PathName   # 复核已生效

# 3. 回滚(确认 http2 反而更慢时):去掉 --protocol http2 改回默认 QUIC 后同样重启
```

**验证**:重跑 `deploy/scripts/prod-bundle/health-check-bare.ps1` 第 10 项转 PASS;公网复测 TTFB 应显著回落(仓内旧读数预期减半);App 横幅随之消失。

**根因②(物理下限,不可修,只能校准阈值):** 手机→CF 边缘 RTT ~493ms,一次 HTTPS 探针需 TCP 1 RTT + TLS 1–2 RTT + 请求 1 RTT ≈ 4 RTT ≈ 2s 起步(`apps/mobile-rn/src/lib/network-probe.ts:30-35` 同源注释)。而旧慢网阈值 `slowLatencyMs = 1500ms`(`packages/shared/src/utils/connectivity.ts:72`)低于该物理下限 ⇒ 即使链路最优,横幅也常态化亮起。**机主已拍板(2026-10-14):上调至 `2500ms`**(`connectivity.ts:72`),高于 http2 后正常 TTFB 上限 ~2.2s,只为真·劣化(单轮最快应答 ≥ 2500ms)亮横幅,健康跨境链路不再误判。该调整不改变"慢网 ≠ 断网"语义(G-1113920 锁),离线/未判定档位逻辑未动。

**根因④(2026-10-16 立案,本机实测,跨境段硬约束):** 公网入口 TTFB 1.3s~16.4s、约一半请求 25s 超时,而同轮 `127.0.0.1:8801` 只要 3~17ms。逐项排除与定档见下表 —— 结论是**慢在「本机(长春联通)↔ Cloudflare 洛杉矶 PoP」这条跨境段**,不是服务、不是隧道进程、也不是本机拥塞。

| 判据 | 实测(2026-10-16 23:16–23:55 +0800) | 结论 |
|---|---|---|
| 本地直连 8801(`/sso/login`、`/api/health`) | 3–17ms,全 200 | 服务段排除 |
| 公网 TCP 建连 / TLS 握手 | 0.30s / 0.64s(能完成) | 边缘可达 |
| 公网 TTFB | 1.30s ~ 16.36s,约一半 >25s 超时 | 卡在回源那一跳 |
| cloudflared metrics `server_locations` | 4 条腿全部 lax05/lax09/lax12/lax13(洛杉矶) | 跨境段落点在美国 |
| ICMP 到 1.1.1.1 / 站点 IP 104.21.15.184 | ≈300ms / ≈700ms(对照阿里 DNS 223.5.5.5 = 19ms) | 跨境段又远又丢包 |
| TCP 重传率(30s 窗口) | 27% | 丢包实证 |
| 上行占用 | 198 KB/s(≈1.6Mbps);ICMP 0 丢包;MTU 1500 + DF 通 | 非拥塞、非 MTU 黑洞 |
| 重启 Cloudflared 后 4 分钟复测 | 仍 10–16s / 超时 | 重启不治,不是腿坏了 |

**可行动的两条路(除此之外都是白查):**

1. **换出口** —— 让 cloudflared 到 CF 边缘的流量走一条到 CF 更近的线路(代理 / 中转机,落点争取 nrt / icn / sin / hkg)。`--region` 参数**只支持 `us`**(Cloudflare 官方口径),本机已在美国 ⇒ 没有「选更近 PoP」的旋钮;`--edge-ip-version` 只切地址族,实测 IPv4 / IPv6 同样劣化(1.3s vs 10.4s,均伴随超时),也不治本。
2. **减少回源** —— 提高 CF 边缘缓存命中率(静态资源长缓存 / Cache Rules),把跨太平洋回源的次数压下去;顺带把监控探针自身的回源频次降下来(它每轮 12–24 次请求,本身就是这条劣化链路的加压者)。

**隧道侧可观测性(2026-10-16 补齐两条,今天定位时就是缺这两样):**

1. **指标时间轴(已自动,零人工)**:`scripts/record-tunnel-metrics.mjs` 每 15 分钟把 cloudflared metrics 的白名单指标**追加一行**到 `.workbuddy/tunnel-metrics.jsonl`(腿数 / 累计请求 / 回源错误 / 落点 PoP / 进程启动时刻 / origin 连接均值),并给出与上一轮的差分 —— **进程重启过则差分记 `null`**(不同进程的累计值相减会得出负数或天量,是台账污染的头号来源)。派发点 `git-guardian.mjs: auditTunnelMetrics()`。回看:`tail -n 50 .workbuddy/tunnel-metrics.jsonl`。**为什么不挂 Prometheus**:metrics 端点**端口每次启动会变**,静态 target 天然会漂;本尺子按 pid 从 netstat 现读端口。
2. **运行期日志(2026-10-17 已落地)**:Cloudflared 服务 ImagePath 曾为裸 `tunnel run`,隧道握手 / 重连错误不落任何文件。已补 `--logfile D:\DevEnv\logs\cloudflared.log --loglevel info`,当前 ImagePath(全局位写法):

   ```
   "C:\Program Files\cloudflared\cloudflared.exe" --logfile D:\DevEnv\logs\cloudflared.log --loglevel info tunnel run --protocol http2 --token-file C:\ProgramData\cloudflared\token
   ```

   ⚠️ **血的教训(2026-10-17 实测)**:`--logfile` / `--loglevel` 是**全局 flag,必须放在子命令 `tunnel run` 之前**。cloudflared 2026.7.3 若按 `tunnel run ... --logfile ...` 子命令后置写法传递,服务模式直接秒退(SCM 报「函数不正确」,即 exe exit 1),而**前台探测是秒退 code=0 且零输出**——极易误判为「参数被接受」。正确姿势与踩坑记录:

   ```powershell
   $p = 'HKLM:\SYSTEM\CurrentControlSet\Services\Cloudflared'
   $cur = (Get-ItemProperty -Path $p).ImagePath
   if ($cur -notmatch '--logfile') {
     # 全局位:flag 插在 cloudflared.exe 之后、tunnel 之前;原值以引号包裹 exe 路径
     $new = $cur -replace '^(.*?cloudflared\.exe")\s*(.*)$', '$1 --logfile D:\DevEnv\logs\cloudflared.log --loglevel info $2'
     [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('SYSTEM\CurrentControlSet\Services\Cloudflared', $true).
       SetValue('ImagePath', $new, [Microsoft.Win32.RegistryValueKind]::String)
   }
   (Get-ItemProperty -Path $p).ImagePath      # 复核已生效
   Restart-Service Cloudflared
   ```

   验证三连:服务 `Running` ⇒ `D:\DevEnv\logs\cloudflared.log` 开始生长 ⇒ `curl --noproxy '*' https://aizhs.top/` 200(**必须绕代理**,bash 默认走 7897 会得出假结论)。改错值时的回滚:写回原 ImagePath + `Start-Service Cloudflared`,窗口约 1 分钟。前台探测 flag 形态:`& cloudflared.exe --logfile <tmp> --loglevel info tunnel run --protocol http2 --token-file ...`(10 秒内退 = 参数没被接受)。

**已固化的判据:** `scripts/check-tunnel-leg-health.mjs` 新增第五维 `edge-location`(读本机 cloudflared metrics 的 `server_locations`,metrics 端口按 pid 从 netstat 现读、不硬编码)。落点全在非亚太 PoP 时**只报数不判红**(本机在国内、CF 无大陆 PoP ⇒ 这是常态形态,判红即 §12e 恒红门),并在正文写明「入口慢先归因跨境段,别去查 web/api」;`scripts/git-guardian.mjs` 的入口段出路同步点名该维。运维读法:`node scripts/check-tunnel-leg-health.mjs --json`。

**根因③(远期,需预算):** CF 边缘→源站段走公网绕行。Cloudflare Argo Smart Routing(付费订阅)可让该段走 CF 优化骨干;另 `api.aizhs.top` 未接入 img 子域同款「优选 IP」机制(`deploy/cf-preferred-ip.mjs` 仅支持 A 记录,Tunnel 的 CNAME 形态不适用),二者均为结构性改进,记录备选。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
