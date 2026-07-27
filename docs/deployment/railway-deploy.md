# Railway 部署详细指南

> **部署目标**:后端 API(Fastify 5)+ PostgreSQL + Redis
> **免费额度**:$5 信用额度/月(约 500 小时 · 500MB 内存 · 1GB 存储)
> **配置文件**:`railway.json`(根目录)

---

## 1. 前置条件

- GitHub 账号(已 Fork [IHUI-AI](https://github.com/IHUI-INF-AI/IHUI-AI) 仓库)
- Railway 账号(https://railway.app/login,用 GitHub 登录)
- 至少一个 LLM API Key(可选,缺失则 AI 降级 stub)

---

## 2. 部署步骤

### 2.1 创建项目

1. 登录 https://railway.app → 点 **"New Project"**
2. 选 **"Deploy from GitHub repo"**
3. 找到你 Fork 的 `IHUI-AI` 仓库 → Select

> **截图占位**:![Railway 选仓库](images/railway-select-repo.png)

### 2.2 配置服务

Railway 自动检测 `railway.json`,显示配置:

| 配置项 | 值 | 说明 |
| ------ | -- | ---- |
| Builder | NIXPACKS | 自动检测 pnpm |
| Build Command | `pnpm --filter @ihui/api... build` | 自动读取 |
| Start Command | `node apps/api/dist/index.js` | 自动读取 |
| Healthcheck Path | `/api/health` | 自动读取 |

点 **"Deploy"** 开始构建。

### 2.3 添加 PostgreSQL 数据库

1. 项目页面 → 点右上角 **"+"**(New)
2. 选 **"Database"** → **"PostgreSQL"
3. 等待 30 秒创建完成
4. 服务列表多了一个 `postgres` 节点

> **截图占位**:![Railway 加 PostgreSQL](images/railway-postgres.png)

### 2.4 添加 Redis 数据库

1. 再次点 **"+"** → **"Database"** → **"Redis"**
2. 等待 30 秒创建完成
3. 服务列表多了一个 `redis` 节点

### 2.5 连接数据库到 API 服务

**获取连接串:**

1. 点 **`postgres`** 节点 → **"Connect"** 标签页
2. 复制 **"Postgres Connection URL"**(格式 `postgresql://postgres:密码@主机:端口/railway`)

**配置到 API:**

1. 点 **`ihui-api`** 节点(或你的服务名)→ **"Variables"** 标签页
2. 点 **"New Variable"**
3. Name: `DATABASE_URL`,Value: 粘贴上面复制的连接串 → Add
4. 重复步骤,把 Redis 连接串加到 `REDIS_URL` 变量

> **截图占位**:![Railway 配置变量](images/railway-variables.png)

### 2.6 生成密钥

在 **ihui-api** → Variables 标签页,添加以下变量:

| 变量名 | 如何生成 | 必填 |
| ------ | -------- | ---- |
| `JWT_SECRET` | 点 "Generate" 按钮 / 或访问 https://generate-secret.vercel.app/ | ✅ |
| `CREDENTIALS_ENCRYPTION_KEY` | 同上(必须是不同的新随机串) | ✅ |
| `AI_CALLBACK_SECRET` | 同上(再生成一个) | ✅ |
| `CORS_ORIGIN` | 填前端域名(如 `https://ihui-ai.vercel.app`) | ✅ |
| `AI_SERVICE_URL` | 填 AI 服务域名(Render 部署后回填) | ✅ |
| `NODE_ENV` | `production` | ✅ |
| `PORT` | `8802`(或 Railway 自动注入 `$PORT`) | ✅ |

> **必填变量未配置 → 服务启动失败**(日志看到 "JWT_SECRET 未配置" 等错误)

### 2.7 生成公网域名

1. 点 **ihui-api** → **"Settings"** 标签页
2. 滚到 **"Networking"** 区域
3. 点 **"Generate Domain"**
4. Railway 分配域名(格式 `ihui-api-production-xxx.up.railway.app`)
5. **记下这个域名**,前端 `NEXT_PUBLIC_API_URL` 和 AI 服务 `API_SERVICE_URL` 都要用

> **截图占位**:![Railway 生成域名](images/railway-generate-domain.png)

### 2.8 验证部署

```bash
# 替换为你的实际域名
curl https://你的-api-域名/api/health
# 应返回 {"status":"ok","timestamp":"..."}
```

浏览器访问该 URL 也应看到 JSON 响应 = 部署成功 ✅

---

## 3. 数据库迁移

API 服务首次启动时,需要运行数据库迁移(创建表结构):

### 3.1 方式一:Railway CLI(推荐)

1. 本地安装 Railway CLI:`npm i -g @railway/cli`
2. 链接项目:`railway link`(选择你的项目)
3. 运行迁移:`railway run pnpm --filter @ihui/api db:migrate`

### 3.2 方式二:Railway 控制台

1. 点 **ihui-api** → **"Settings"** → **"Start Command"**
2. 临时改为:`pnpm --filter @ihui/api db:migrate && node apps/api/dist/index.js`
3. 等 30 秒(迁移完成)
4. 改回:`node apps/api/dist/index.js`

### 3.3 验证迁移

```bash
# 检查表是否创建(在 Railway PostgreSQL Console 执行)
\dt
# 应看到 100+ 张表
```

---

## 4. 环境变量完整清单

| 变量名 | 必填 | 示例值 | 说明 |
| ------ | ---- | ------ | ---- |
| `DATABASE_URL` | ✅ | `postgresql://...` | PostgreSQL 连接串 |
| `REDIS_URL` | ✅ | `redis://...` | Redis 连接串 |
| `JWT_SECRET` | ✅ | 32 字符随机串 | JWT 签名密钥 |
| `CREDENTIALS_ENCRYPTION_KEY` | ✅ | 32 字符随机串 | 凭证加密密钥 |
| `AI_CALLBACK_SECRET` | ✅ | 32 字符随机串 | 服务间回调认证 |
| `CORS_ORIGIN` | ✅ | `https://xxx.vercel.app` | 允许的前端域名 |
| `AI_SERVICE_URL` | ✅ | `https://xxx.onrender.com` | AI 服务公网 URL |
| `NODE_ENV` | ✅ | `production` | Node 环境 |
| `PORT` | ✅ | `8802` 或 `$PORT` | 监听端口 |
| `SMTP_HOST` | 否 | `smtp.gmail.com` | 邮件服务(可选) |
| `SMTP_USER` | 否 | `xxx@gmail.com` | 邮件用户名 |
| `SMTP_PASS` | 否 | 应用专用密码 | 邮件密码 |
| `OPENAI_API_KEY` | 否 | `sk-...` | 在 AI 服务配置,不在 API |

> 完整变量列表见根目录 [`.env.example`](../../.env.example)

---

## 5. 常见错误排查

### 5.1 服务启动失败:`JWT_SECRET 未配置`

**日志特征**:
```
Error: JWT_SECRET 未配置,请在 .env 设置强密钥(≥32 字符)
```

**解决**:ihui-api → Variables → 添加 `JWT_SECRET`(随机 32 字符串)→ 服务自动重启

### 5.2 服务启动失败:`CREDENTIALS_ENCRYPTION_KEY 未配置`

**解决**:同上,添加 `CREDENTIALS_ENCRYPTION_KEY` 变量

### 5.3 服务启动失败:`DB_PASSWORD 未配置`

**原因**:`DATABASE_URL` 未配置或格式错误

**解决**:
1. 检查 `DATABASE_URL` 是否从 PostgreSQL 节点的 Connect 标签页复制
2. 格式应为 `postgresql://postgres:密码@主机.railway.app:端口/railway`
3. 检查密码部分有没有 URL 编码问题(特殊字符)

### 5.4 健康检查失败

**日志特征**:
```
Health check failed: GET /api/health returned 502
```

**原因**:服务启动慢(60 秒内未就绪)或路由错误

**解决**:
1. ihui-api → Settings → 把 `Healthcheck Timeout` 改为 `120`(秒)
2. 查看服务日志,确认启动成功
3. 手动 curl 验证:`curl https://你的域名/api/health`

### 5.5 构建失败:`pnpm install` 超时

**解决**:
1. 确认仓库根目录有 `pnpm-lock.yaml`(锁定文件)
2. 改 `railway.json` 的 buildCommand 为 `pnpm install --frozen-lockfile && pnpm --filter @ihui/api... build`
3. 如果用 NIXPACKS,确认 `NIXPACKS_BUILD_COMMAND` 环境变量正确

### 5.6 月度额度用尽

**Railway 免费层 $5 额度**:
- 500 小时服务运行 ≈ 21 天 24/7
- 超出后服务暂停(数据保留)

**解决**:
1. 升级到 Developer Plan($5/月,无小时限制)
2. 或在 Settings → Sleep 选项,配置空闲时自动休眠
3. 监控额度:https://railway.app/account/usage

### 5.7 数据库连接数超限

**日志特征**:
```
Error: remaining connection slots are reserved for non-replication superuser connections
```

**解决**:
1. API 配置连接池上限 ≤ 10
2. 升级 Railway PostgreSQL 到 Pro(更多连接数)
3. 用 PgBouncer 连接池中间件

---

## 6. 升级到付费

免费层够个人使用,以下场景升级 Developer Plan($5/月):

- 服务 24/7 运行(免费层 21 天用尽)
- 需要更多内存(>512MB)
- 需要更多数据库连接(>10)
- 需要自定义域名(免费子域名够用)

升级:https://railway.app/account/billing → Subscribe to Developer Plan

---

## 7. 相关文档

- [一键部署总览](./one-click-deploy.md)
- [Vercel 部署指南](./vercel-deploy.md)
- [家人朋友代部署指南](./family-friends-guide.md)
- [Railway 官方文档](https://docs.railway.app)
- [NIXPACKS 构建器文档](https://nixpacks.io)
- [环境变量完整模板](../../.env.example)
