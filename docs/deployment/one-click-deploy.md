# 一键部署指南 · One-Click Deploy Guide

> **目标读者**:第一次部署云服务的开发者 · 5 分钟 Fork 到上线
> **家人朋友代部署**:请直接看 [family-friends-guide.md](./family-friends-guide.md)(图文详细版)
> **项目地址**:https://github.com/IHUI-INF-AI/IHUI-AI

---

## 平台对比

| 平台 | 适合部署 | 免费额度 | 优点 | 缺点 |
| ---- | -------- | -------- | ---- | ---- |
| **Vercel** | 前端 Web (Next.js) | 100GB 流量/月 · 100h 构建/月 | 全球 CDN · Next.js 原生支持 · 零配置 | 不支持常驻 Node 服务(后端) |
| **Railway** | 后端 API + 数据库 | $5 额度/月(约 500h) | 支持 pnpm monorepo · PostgreSQL/Redis 一键开 | 超出额度按量计费 |
| **Render** | 全栈(3 服务) | 750h/月 · 自动休眠 | 支持 Docker · Blueprint 多服务 | 免费层 15 分钟无流量休眠 |
| **Heroku** | 全栈(单服务) | 1 个 web dyno(550h/月) | 老牌 PaaS · 生态成熟 | 2023 起无免费数据库 |

---

## 推荐组合(零成本上线)

```
┌─────────────────────────────────────────────────────────┐
│                    用户浏览器                              │
└──────────────┬──────────────────────────┬────────────────┘
               │                          │
               ▼                          ▼
    ┌──────────────────┐        ┌──────────────────┐
    │   Vercel (免费)   │        │  Railway (免费)   │
    │   前端 Web        │ ────▶  │   后端 API        │
    │   Next.js 静态导出 │        │   Fastify 5       │
    │   全球 CDN        │        │                   │
    └──────────────────┘        └────────┬──────────┘
                                         │
                              ┌──────────┴──────────┐
                              │                     │
                              ▼                     ▼
                    ┌──────────────────┐  ┌──────────────────┐
                    │  Render (免费)    │  │  Railway (免费)   │
                    │   AI 服务         │  │   PostgreSQL      │
                    │   FastAPI         │  │   Redis           │
                    └──────────────────┘  └──────────────────┘
```

| 角色 | 平台 | 服务名 | 端口 | 配置文件 |
| ---- | ---- | ------ | ---- | -------- |
| 前端 Web | Vercel | ihui-web | - | `apps/web/vercel.json` |
| 后端 API | Railway | ihui-api | 8802 | `railway.json` |
| AI 服务 | Render | ihui-ai-service | 8803 | `render.yaml` |
| 数据库 | Railway/Render | ihui-postgres | 5432 | - |
| 缓存 | Railway/Render | ihui-redis | 6379 | - |

---

## 部署步骤概览

### 方案 A:Vercel + Railway + Render(推荐,零成本)

1. **Fork 仓库** → 你的 GitHub 账号下
2. **Vercel 部署前端** → [详细步骤](./vercel-deploy.md)
3. **Railway 部署 API + 数据库** → [详细步骤](./railway-deploy.md)
4. **Render 部署 AI 服务** → 用 Render Blueprint(`render.yaml`)
5. **配置环境变量** → 三个服务的 URL 互相指向
6. **验证** → 访问 Vercel 域名,看到首页

### 方案 B:Render 全栈一键部署(最简单)

1. **Fork 仓库**
2. 点击 [Deploy to Render](https://render.com/deploy?repo=https://github.com/IHUI-INF-AI/IHUI-AI) 按钮
3. Render 自动读取 `render.yaml`,创建 3 个 web 服务 + 2 个数据库
4. 等待 5-10 分钟构建完成
5. 访问 Render 分配的域名

### 方案 C:Docker Compose 自托管(最灵活)

```bash
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git
cd IHUI-AI
cp .env.example .env          # 编辑 .env 填入密码和密钥
docker compose up -d          # 启动 14 服务(7 业务 + 7 监控)
```

详见根目录 [docker-compose.yml](../../docker-compose.yml) 和 [部署 Runbook](../DEPLOYMENT_RUNBOOK.md)。

---

## 环境变量配置清单

部署后**必须**配置以下环境变量(从根目录 [.env.example](../../.env.example) 复制完整模板):

### 必填(不配置无法启动)

| 变量名 | 配置在 | 说明 | 示例值 |
| ------ | ------ | ---- | ------ |
| `DATABASE_URL` | Railway/Render API | PostgreSQL 连接串 | `postgresql://user:pass@host:5432/ihui` |
| `REDIS_URL` | Railway/Render API | Redis 连接串 | `redis://default:pass@host:6379` |
| `JWT_SECRET` | Railway/Render API | JWT 签名密钥(≥32 字符) | 随机字符串 |
| `CREDENTIALS_ENCRYPTION_KEY` | Railway/Render API | 凭证加密密钥(≥32 字符) | 随机字符串 |
| `AI_CALLBACK_SECRET` | API + AI 服务 | 服务间回调认证(≥32 字符) | 随机字符串 |
| `NEXT_PUBLIC_API_URL` | Vercel Web | 后端 API 公网 URL | `https://ihui-api.up.railway.app` |

### 选填(不配置则降级运行)

| 变量名 | 配置在 | 说明 | 缺失影响 |
| ------ | ------ | ---- | -------- |
| `OPENAI_API_KEY` | Render AI 服务 | OpenAI 模型密钥 | AI 调用返回 stub |
| `ANTHROPIC_API_KEY` | Render AI 服务 | Anthropic Claude 密钥 | 同上 |
| `STEPFUN_API_KEY` | Render AI 服务 | StepFun 密钥(默认 provider) | 同上 |
| `CORS_ORIGIN` | Railway/Render API | 允许的前端域名 | 默认放行所有源 |
| `SMTP_HOST` / `SMTP_PASS` | Railway/Render API | 邮件发送 | 邮件功能不可用 |
| `WX_SHOP_ID` / `WX_PAY_*` | Railway/Render API | 微信支付证书 | 支付功能不可用 |

> **生成随机密钥**:`openssl rand -hex 32` 或访问 https://generate-secret.vercel.app/

---

## 部署后验证

### 1. 健康检查

```bash
# 替换为你的实际域名
curl https://ihui-api.up.railway.app/api/health    # 应返回 {"status":"ok"}
curl https://ihui-ai-service.onrender.com/health   # 应返回 {"status":"ok"}
curl https://ihui-web.vercel.app                   # 应返回 HTML 首页
```

### 2. 功能验证

1. 浏览器访问前端域名 → 看到首页(中英文切换正常)
2. 点击"注册" → 能注册账号(说明 API + 数据库连通)
3. 进入"AI 对话" → 发一条消息 → 收到响应(说明 AI 服务连通)
4. 检查"个人中心" → 能看到积分(说明数据库读写正常)

### 3. 域名配置(可选)

- **Vercel**:Settings → Domains → 添加自定义域名 → 按提示配置 DNS
- **Railway**:Settings → Networking → Generate Domain(免费子域名)
- **Render**:Settings → Custom Domain → 添加域名

---

## 常见问题

### Q1:Vercel 构建失败 `next build` OOM

**原因**:Next.js 15 构建需要大内存,Vercel Hobby 免费层内存受限。

**解决**:在 Vercel 项目 Settings → Environment Variables 添加:
- `NODE_OPTIONS` = `--max-old-space-size=4096`

或升级 Vercel Pro($20/月,8GB 内存)。

### Q2:Railway 部署后服务立即退出

**原因**:`JWT_SECRET` / `CREDENTIALS_ENCRYPTION_KEY` 等必填环境变量未配置。

**解决**:在 Railway 服务 Variables 标签页添加所有必填变量(见上表),服务会自动重启。

### Q3:Render 免费层 15 分钟无流量后休眠

**原因**:Render Free 层策略,web 服务 15 分钟无请求会自动休眠,下次请求有 50 秒冷启动。

**解决**:升级 Render Starter($7/月,不休眠);或用 UptimeRobot 每 10 分钟 ping 一次(免费但影响日志)。

### Q4:前端能访问但 API 报 502 / CORS 错误

**原因**:`NEXT_PUBLIC_API_URL` 未配置或指向错误;后端 `CORS_ORIGIN` 未包含前端域名。

**解决**:
1. Vercel 项目 Settings → Environment Variables → `NEXT_PUBLIC_API_URL` = 你的 Railway API 域名
2. Railway 服务 Variables → `CORS_ORIGIN` = 你的 Vercel 前端域名
3. 重新部署前端(Vercel Redeploy)

### Q5:AI 对话返回 "stub response"

**原因**:AI 服务未配置任何 LLM API Key,降级到 stub 模式。

**解决**:在 Render AI 服务 Variables 中配置至少一个 provider 的 API Key(`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `STEPFUN_API_KEY` 任选)。

### Q6:数据库连接超时

**原因**:Railway/Render 免费 PostgreSQL 有连接数限制(通常 20)。

**解决**:API 服务配置连接池上限 ≤ 10,或升级数据库套餐。

---

## 相关文档

- [家人朋友代部署指南(图文详细版)](./family-friends-guide.md)
- [Vercel 详细部署步骤](./vercel-deploy.md)
- [Railway 详细部署步骤](./railway-deploy.md)
- [端口管理规则](../port-management.md)
- [生产部署 Runbook(蓝绿/回滚/证书)](../DEPLOYMENT_RUNBOOK.md)
- [环境变量完整模板](../../.env.example)
