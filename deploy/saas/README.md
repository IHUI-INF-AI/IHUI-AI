# IHUI-AI SaaS 托管平台

> 多租户 SaaS 部署架构 — **子域名路由 + 每租户独立 docker-compose**
> 项目自托管:Apache-2.0 开源 → 每个客户独立部署一套完整环境
> 本目录是 SaaS 化的基础设施层(P0 阶段 1)

## 架构图

```
                          [公网 DNS *.saas.example.com → 主机 IP]
                                       │
                                       ▼
                ┌──────────────────────────────────────┐
                │     Traefik v3 (顶层共享)             │
                │  - 通配符证书 (Let's Encrypt DNS-01) │
                │  - SNI 路由                          │
                │  - Docker provider 自动发现          │
                │     网络: ihui-saas-net               │
                └──────────────────────────────────────┘
                          │           │           │
                  ┌───────┘    ┌──────┘    └───────┐
                  ▼            ▼                   ▼
        ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
        │ customer-demo  │  │ customer-acme  │  │ customer-beta  │
        │ (独立 docker)  │  │ (独立 docker)  │  │ (独立 docker)  │
        │                │  │                │  │                │
        │ demo.saas.     │  │ acme.saas.     │  │ beta.saas.     │
        │ example.com    │  │ example.com    │  │ example.com    │
        │                │  │                │  │                │
        │ ├─ db (pg15)   │  │ ├─ db (pg15)   │  │ ├─ db (pg15)   │
        │ ├─ redis (7)   │  │ ├─ redis (7)   │  │ ├─ redis (7)   │
        │ ├─ api         │  │ ├─ api         │  │ ├─ api         │
        │ ├─ web         │  │ ├─ web         │  │ ├─ web         │
        │ └─ ai-service  │  │ └─ ai-service  │  │ └─ ai-service  │
        │                │  │                │  │                │
        │ 故障隔离 ✅    │  │ 故障隔离 ✅    │  │ 故障隔离 ✅    │
        │ 数据隔离 ✅    │  │ 数据隔离 ✅    │  │ 数据隔离 ✅    │
        └────────────────┘  └────────────────┘  └────────────────┘
```

## 目录结构

```
deploy/saas/
├── README.md                              # 本文档
├── .env.example                           # 顶层环境变量样例
├── docker-compose.yml                     # Traefik 编排
├── traefik/
│   ├── traefik.yml                        # 静态配置
│   └── dynamic/
│       └── customers.yml.template         # 动态路由模板(由 create-customer.sh 自动生成实际文件)
├── templates/
│   └── customer/                          # 客户租户模板(只读,不可改)
│       ├── .env.template
│       ├── docker-compose.yml
│       └── init-db.sql
├── scripts/                               # 运维脚本
│   ├── create-customer.sh
│   ├── destroy-customer.sh
│   └── list-customers.sh
├── customers/                             # 运行时生成的客户目录(.gitignore)
│   └── <slug>/
└── backups/                               # 备份目录(.gitignore)
```

## 快速开始

### 1. 准备顶层环境

```bash
cd deploy/saas
cp .env.example .env
# 编辑 .env,关键配置:
#   BASE_DOMAIN=saas.example.com      # 客户子域名 = {slug}.{BASE_DOMAIN}
#   ACME_EMAIL=ops@example.com        # Let's Encrypt 通知邮箱
#   DNS_PROVIDER=alidns               # DNS provider(通配符证书必须 DNS-01)
#   ALIYUN_ACCESS_KEY_ID=xxx          # 阿里云 DNS API 凭证
#   ALIYUN_ACCESS_KEY_SECRET=xxx
```

### 2. 启动 Traefik

```bash
docker compose up -d
docker compose ps  # 确认 traefik 已 Up
```

### 3. 创建客户租户

```bash
./scripts/create-customer.sh demo
```

输出示例:
```
客户 'demo' 创建成功
访问地址:    https://demo.saas.example.com
凭据(请妥善保存,不会再次显示):
  数据库密码: xxx
  Redis 密码: xxx
  JWT 密钥:   xxx
```

### 4. 查看所有客户

```bash
./scripts/list-customers.sh
```

### 5. 销毁客户

```bash
./scripts/destroy-customer.sh demo
# 或保留数据备份:
./scripts/destroy-customer.sh demo --keep-data
```

## 本地 PoC 验证(nip.io)

正式部署需真实域名 + DNS provider。本地验证用 [nip.io](https://nip.io) 动态 DNS:

```bash
# 1. 修改 .env
BASE_DOMAIN=127.0.0.1.nip.io  # 任意 .nip.io 子域名都会解析到 IP

# 2. 启动 Traefik(此时 DNS_PROVIDER 留空,用自签证书)
# 修改 docker-compose.yml 临时移除 ACME DNS-01 配置,改用自签证书

# 3. 创建客户
./scripts/create-customer.sh demo

# 4. 访问(忽略证书警告)
curl -k https://demo.127.0.0.1.nip.io:443/
```

**注意**: nip.io 方式不能签发真实证书,仅用于功能验证。

## 资源限制

通过 `.env` 全局默认值 + 单租户 .env 覆盖:

| 资源 | 默认 | 客户 .env 覆盖 |
|---|---|---|
| Memory | 2G | `MEMORY_LIMIT=4G` |
| CPU | 1.0 | `CPU_LIMIT=2.0` |
| Storage | 20G | volume 限制在 Docker 层另设 |

## 客户生命周期管理(P1 阶段 2.1)

### 脚本层(直接调用)

```bash
# 暂停/恢复
./scripts/pause-customer.sh demo    # 停止容器,数据保留
./scripts/resume-customer.sh demo   # 重启容器

# 备份/恢复
./scripts/backup-customer.sh demo             # 默认存到 backups/demo/<timestamp>/
./scripts/restore-customer.sh demo            # 恢复最新备份
./scripts/restore-customer.sh demo 20260721_120000  # 恢复指定备份

# 列表(显示 state=active|paused)
./scripts/list-customers.sh
```

### Admin API(程序化)

启动后监听 `127.0.0.1:8081`(仅本机,不暴露公网)。

```bash
# 1. 在 .env 中设置 ADMIN_API_KEY(用 openssl rand -hex 32 生成)

# 2. 启动 admin-api
docker compose up -d admin-api

# 3. 调用 API
curl -H "X-Admin-API-Key: <your-key>" http://localhost:8081/admin/api/health

# 列出客户
curl -H "X-Admin-API-Key: <key>" http://localhost:8081/admin/api/customers

# 暂停
curl -X POST -H "X-Admin-API-Key: <key>" http://localhost:8081/admin/api/customers/demo/pause

# 备份
curl -X POST -H "X-Admin-API-Key: <key>" http://localhost:8081/admin/api/customers/demo/backup

# 恢复(默认最新备份)
curl -X POST -H "X-Admin-API-Key: <key>" http://localhost:8081/admin/api/customers/demo/restore

# 恢复指定备份
curl -X POST -H "X-Admin-API-Key: <key>" \
     -H "Content-Type: application/json" \
     -d '{"timestamp":"20260721_120000"}' \
     http://localhost:8081/admin/api/customers/demo/restore

# 销毁
curl -X DELETE -H "X-Admin-API-Key: <key>" http://localhost:8081/admin/api/customers/demo
```

### 证书自动续期

```bash
# 部署 cron(每周日 3:00 检查 + 自动重启 Traefik 触发重签)
sudo cp deploy/saas/cron/cert-renew.cron /etc/cron.d/ihui-saas-cert-renew

# 手动触发
bash deploy/saas/cron/cert-renew.sh
```

行为:
- 证书剩余 ≥ 30 天:健康
- 证书剩余 < 30 天:警告(无需干预,Traefik 自动续)
- 证书剩余 < 7 天:重启 Traefik 强制重签
- 同时清理 30 天前的旧备份

## Web 管理后台(P1 阶段 2.2)

`/admin/saas` 路径提供 SaaS 租户管理的可视化操作界面(仅 superadmin 角色可访问)。

### 访问方式

1. **Web 端**:`https://<主域名>/admin/saas` → 侧边栏"租户管理"分组
2. **角色要求**:登录用户角色必须为 `superadmin` 或 `system_admin`,否则 307 → `/forbidden`
3. **审计追溯**:所有操作经 `X-Admin-User` 标识,记录到 `admin-api-audit.log`

### 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `ADMIN_API_URL` | 否 | `http://127.0.0.1:8081` | admin-api 地址(Web 反向代理) |
| `ADMIN_SAAS_API_KEY` | 是 | 空 | 与 admin-api 的 `ADMIN_API_KEY` 一致 |
| `ADMIN_USER_WHITELIST` | 否 | `admin` | 允许调用 admin-api 的 web 用户白名单(逗号分隔) |
| `ENABLE_AUDIT_LOG` | 否 | `true` | 是否启用操作审计日志 |

### 首次启动

```bash
# 1. admin-api 未设置 ADMIN_API_KEY 时,容器启动自动生成并写日志:
#    [WARN] ADMIN_API_KEY not set, auto-generated: <key>
#    持久化到 deploy/saas/.env:
echo "ADMIN_API_KEY=<auto-key>" >> .env

# 2. Web 端配置(apps/web/.env.local):
ADMIN_API_URL=http://127.0.0.1:8081
ADMIN_SAAS_API_KEY=<same-as-admin-api-key>

# 3. 重启 admin-api
docker compose up -d admin-api
```

### 审计日志格式

`deploy/saas/admin-api-audit.log` (JSON Lines,append-only):

```json
{"ts":"2026-07-21T18:00:00.000Z","method":"POST","url":"/admin/api/customers","status":201,"durationMs":"123.4","adminUser":"admin","remoteIp":"127.0.0.1"}
{"ts":"2026-07-21T18:01:30.000Z","method":"POST","url":"/admin/api/customers/demo/pause","status":200,"durationMs":"5.6","adminUser":"admin","remoteIp":"127.0.0.1"}
```

### 支持的 Web 操作

| 操作 | 说明 |
|---|---|
| 租户列表 | 30s 自动轮询,支持按 slug 搜索 + 按 state 筛选 |
| 创建租户 | 弹窗填写 slug/memory/cpu/plan,实时校验 regex |
| 暂停/恢复 | 二次确认弹窗,操作期间显示 loading |
| 备份 | 立即创建快照,服务不受影响 |
| 销毁 | 输入 slug 二次确认,操作不可逆 |
| 租户详情 | `/admin/saas/[slug]`:基本信息 + 容器状态 + 资源配额占位 + 快捷操作 |
| 备份管理 | `/admin/saas/[slug]/backups`:列表 + 恢复 + 删除(时间戳二次确认) |
| 证书状态 | `/admin/saas/certificates`:扫描 Traefik `acme.json`,健康/警告/紧急/已过期分级展示 |
| 资源配额 | 详情页占位卡片(API 调用 / AI Token / 存储),等待 P1-2.3 Prometheus 接入 |

> 全部 P1-2.2a / 2.2b / 2.2c 任务已完成。后端 API、前端 UI、i18n 5 语言均已交付。

## 故障排查

### 证书签发失败

```bash
docker logs ihui-saas-traefik | grep -i acme
```

常见原因:
- DNS provider 凭证错误
- 域名 NS 记录未指向 DNS provider
- `LETSENCRYPT_ENV=staging` 配额限制(改 production 或等 7 天)

### 客户容器无法访问

```bash
./scripts/list-customers.sh           # 检查容器状态
cd customers/demo && docker compose ps
cd customers/demo && docker compose logs api
```

### 数据库连接失败

```bash
docker exec customer-demo-db pg_isready -U ihui_demo -d ihui_demo
docker logs customer-demo-api | grep -i "database"
```

## 安全清单

- [ ] `.env` 文件权限 600
- [ ] `.credentials/` 目录权限 700
- [ ] JWT_SECRET / CREDENTIALS_ENCRYPTION_KEY 至少 32 字节随机
- [ ] 数据库密码至少 24 字符随机
- [ ] 80/443 端口仅暴露给 Traefik,业务容器不直接对外
- [ ] Traefik Dashboard 受 ADMIN_DOMAIN 限制
- [ ] DNS provider 凭证用最小权限子账号

## 已实现 vs 待实现

### ✅ P0 阶段 1(本次)

- Traefik v3 多租户 SNI 路由
- 通配符证书(DNS-01 / Let's Encrypt)
- 客户独立 docker-compose(db + redis + api + web + ai-service)
- 创建/销毁/列表 3 个核心脚本
- 随机凭据生成 + 安全备份
- 健康检查 + 启动等待

### ✅ P1 阶段 2.1 部署层管理增强(本次)

- 客户 pause/resume/backup/restore 脚本(状态持久化到 `.state` 文件)
- Admin API 服务(Fastify 5 + X-Admin-API-Key 鉴权,端口 8081 仅 localhost)
- 证书自动续期 cron(每周日 3:00 + 阈值自动重启 Traefik)
- 备份保留策略(自动保留 7 个 + 30 天前清理)

### ⏳ P1 阶段 2.2 web/admin UI(下次)

- 租户管理后台(web/admin 端扩展,管理客户创建/暂停/删除/查看)
- 需跨 web 端扩展,工作量 3-5 天

### ⏳ P1 阶段 2.3 资源监控(后续)

- Prometheus + Grafana per-tenant dashboard
- 资源配额(API 调用 / 存储 / AI token)

### ⏳ P2 阶段 3(后续)

- 用量采集(api 端埋点)
- 套餐定义 + 阶梯定价
- 账单生成(每月 1 号自动生成)
- 微信支付 / 支付宝集成
- 客户自助账单页面 + 充值

## 与项目已有"应用层多租户"的关系

项目已有 [server-docs/MULTI_TENANT.md](../../server-docs/MULTI_TENANT.md) 描述的"共享数据库 + 行级隔离"应用层多租户(API 端自动注入 `WHERE tenant_id = ?`)。

**本目录是部署层多租户,与应用层可叠加使用**:

| 部署模式 | 适用场景 | 资源成本 | 隔离强度 |
|---|---|---|---|
| 应用层多租户(已有) | 中小客户共享一套,降低运维成本 | 低 | 弱(故障会扩散) |
| 部署层多租户(本次) | VIP 客户独立部署,故障/攻击隔离 | 高 | 强 |
| **混合(推荐)** | 共享层服务普通客户 + 独立层服务 VIP 客户 | 中 | 中 |

未来阶段 2 的租户管理后台会同时管理两种部署模式的客户。
