# 常见问题(FAQ)

> IHUI-AI 项目的高频问题集锦,覆盖项目定位、技术选型、部署、开发、数据库、认证、AI 服务、多端、守门、i18n、商业化、性能、安全、升级 14 个类别,每条给精确答案 + 文档链接。

---

## 项目定位类

### Q1:本项目是什么?

IHUI-AI 是一个**全栈 AI 平台**(TS Monorepo + pnpm workspace + Turborepo),包含 8 端应用(web / api / ai-service / desktop / extension / mobile-rn / miniapp-taro / cli)+ 13 共享包,提供对话、Agent、RAG、图像 / 视频 / 3D 生成、记忆、MCP 工具等完整 AI 能力。详见 [architecture.md](./architecture.md)。

### Q2:本项目不是什么?

- 不是单一 ChatGPT 套壳(它是平台,不是聊天框)
- 不是 LangChain 的替代品(ai-service 用 LangGraph,但平台本身不卖框架)
- 不是纯前端项目(后端 + AI 服务 + 多端 + CLI + SDK 全栈)
- 不是 SaaS 托管服务(开源自部署,deploy/saas/ 是可选的多租户方案)

### Q3:与 ChatGPT / Claude / Dify / Coze 的区别?

| 维度 | IHUI-AI | ChatGPT/Claude | Dify | Coze |
| --- | --- | --- | --- | --- |
| 定位 | 自部署全栈 AI 平台 | 托管聊天产品 | LLMOps 平台 | Bot 搭建平台 |
| 多端 | 8 端 + 5 语言 SDK | 仅 Web/App | Web 为主 | Web 为主 |
| 后端 | Fastify + LangGraph + LiteLLM | 闭源 | Python | 闭源 |
| 开源 | Apache 2.0 | 否 | 开源 | 闭源 |
| 商业可用 | 是(可商用) | 否(SaaS) | 是 | 否(SaaS) |

### Q4:商业可用性?

可以商用。Apache 2.0 协议允许商业使用、修改、分发、私有化部署,只需保留版权声明。详见 LICENSE 文件。

### Q5:开源协议 Apache 2.0 含义?

- ✅ 商业使用 / 修改 / 分发 / 私有化部署
- ✅ 闭源衍生(你的二次开发不必开源)
- ⚠️ 必须保留版权 / 专利 / 许可声明
- ⚠️ 修改后的文件需标注"已修改"
- ❌ 不得使用商标 "IHUI" 做背书(除非书面授权)

---

## 技术选型类

### Q6:为什么 TS + Python 混合?

TS 负责 web / api / cli / desktop / extension / 小程序(前后端 + 多端覆盖广,生态成熟);Python 负责 ai-service(LangGraph / LiteLLM / 科学计算生态在 Python)。两者通过 HTTP API 解耦,各取所长。详见 [INFRASTRUCTURE_DECISION.md](./INFRASTRUCTURE_DECISION.md)。

### Q7:为什么 Fastify 不 Express?

Fastify 性能比 Express 快 2-3 倍,内置 JSON Schema 校验、插件系统、TypeScript 一等支持,且 API 与 Express 相似迁移成本低。

### Q8:为什么 Drizzle 不 Prisma?

Drizzle 是 SQL-first ORM,生成可预测的 SQL,无 N+1 隐藏陷阱,迁移文件可读,包体积小,TypeScript 类型推导强。Prisma 的生成器 + 二进制引擎在 monorepo 中较重。详见 [DATABASE.md](./DATABASE.md)。

### Q9:为什么 Next.js 不 Remix?

Next.js 15 App Router + React 19 + RSC 生态最成熟,shadcn/ui / Tailwind 4 配套完善,Vercel 部署零配置。Remix 在 SSR 优势场景本项目用不到。

### Q10:为什么 LangGraph 不 LangChain?

LangGraph 提供显式的状态机 + 图结构编排,可控性强,适合复杂 Agent 工作流;LangChain 抽象层过厚,黑盒难调试。详见 [AI_SERVICE.md](./AI_SERVICE.md)。

### Q11:为什么 LiteLLM 不直接调 SDK?

LiteLLM 统一 100+ 模型厂商的调用接口(OpenAI 兼容格式),避免每家 SDK 升级都要改代码,支持负载均衡 / 重试 / fallback。详见 [LLM_SETUP.md](./LLM_SETUP.md)。

### Q12:为什么 pnpm 不 yarn?

pnpm 硬链接 + 内容寻址存储节省磁盘,workspace 协议严格,monorepo 依赖隔离好,Turborepo 原生支持。

### Q13:为什么 Turborepo 不 Nx?

Turborepo 配置极简(`turbo.json` 几行),增量构建 + 远程缓存开箱即用,学习成本低;Nx 配置繁琐,生成器生态对 TS monorepo 过重。

---

## 部署类

### Q14:最低硬件配置?

| 场景 | CPU | 内存 | 磁盘 | 说明 |
| --- | --- | --- | --- | --- |
| 开发 / 测试 | 2 核 | 4 GB | 20 GB | 单机 docker compose |
| 小规模生产(<100 用户) | 4 核 | 8 GB | 50 GB | web + api + ai-service + DB + Redis 同机 |
| 中规模(100-1000) | 8 核 | 16 GB | 100 GB | DB / Redis 独立,ai-service 可水平扩展 |
| 大规模(>1000) | 按需 | 按需 | 按需 | K8s 集群,DB 主从,Redis 集群 |

详见 [PRODUCTION_INFRASTRUCTURE.md](./PRODUCTION_INFRASTRUCTURE.md)。

### Q15:是否必须 Docker?

不必须,但推荐。Docker 隔离环境、版本固定、一键部署。裸机部署见下条。

### Q16:能否裸机部署?

可以。安装 Node 20+ / Python 3.12+ / PostgreSQL 15+ / Redis 7+,pnpm install + build,用 systemd / pm2 管理进程。详见 [DEVELOPMENT.md](./DEVELOPMENT.md)。

### Q17:数据库能否用 MySQL / SQLite?

- **MySQL**:不建议。Drizzle schema 基于 PostgreSQL 特性(pgvector / JSONB / RLS),迁移到 MySQL 需大量改写。
- **SQLite**:仅开发测试可行(`apps/api` 支持 SQLite driver),生产不支持(并发 / RLS / 向量索引缺失)。详见 [DATABASE.md](./DATABASE.md)。

### Q18:Redis 能否用 Memcached?

不建议。本项目用 Redis 做:会话存储 / 限流 / 任务队列 / 缓存 / pub-sub。Memcached 无 pub-sub、无持久化、无数据结构,无法替代。

### Q19:能否不用 Nginx?

可以。可用 Caddy(自动 HTTPS)、Traefik(deploy/saas/ 已用)、HAProxy。但 Nginx 配置已在 `deploy/nginx/` 提供,蓝绿部署脚本依赖它。详见 [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md)。

### Q20:如何 HTTPS?

```bash
# Let's Encrypt + certbot
sudo certbot --nginx -d api.your-domain.com -d your-domain.com
# 续期由 deploy/cron/cert-renew.sh 自动执行(每月 1 日)
# 到期检查:node scripts/cert-expiry-check.mjs
```

### Q21:如何配置域名?

修改 `deploy/nginx/conf.d/bsm-subdomain.conf` 中的 `server_name`,DNS 解析 A 记录指向服务器 IP。详见 [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md)。

---

## 开发类

### Q22:如何启动?

```bash
pnpm install
pnpm dev   # 同时启动 web(3000)+ api(3001)+ ai-service(8000)
```

完整启动语义见根 AGENTS.md §18。详见 [DEVELOPMENT.md](./DEVELOPMENT.md)。

### Q23:如何调试?

- web / api:VSCode launch.json 已配置,Attach to port 9229
- ai-service:`uvicorn app.main:app --reload --port 8000`
- CLI:`pnpm --filter @ihui/cli dev`(tsx 直跑源码,支持断点)

### Q24:如何加新 API?

1. `packages/database/src/schema/` 加表(若需要)
2. `apps/api/src/routes/<feature>.ts` 加路由(用 Zod 校验 + Drizzle 查询)
3. `packages/types/src/` 加请求 / 响应类型
4. `apps/api/src/routes/index.ts` 注册路由
5. 若公开,在 `packages/sdk/src/` 加对应模块方法

详见 [API_REFERENCE.md](./API_REFERENCE.md) 与 [CONTRIBUTING.md](./CONTRIBUTING.md)。

### Q25:如何加新页面?

`apps/web/app/<route>/page.tsx` 创建 Next.js App Router 页面,复用 `packages/ui` 组件。每页 < 250 行。详见 [UI_GUIDELINES.md](./UI_GUIDELINES.md)。

### Q26:如何加新语言(i18n)?

1. `apps/web/messages/<locale>.json` 新建语言文件
2. `apps/cli/src/i18n/messages/<locale>.ts` 同步 CLI 翻译
3. 在 `scripts/scan-i18n-zh-residue.mjs` 的 `LOCALE_CONFIG` 加配置
4. 跑 `node scripts/check-i18n-keys.mjs` 确认 parity

详见 [I18N.md](./I18N.md) 与根 AGENTS.md §20。

### Q27:如何加新守门?

1. `scripts/check-<name>.mjs` 编写脚本
2. `.husky/pre-commit` 加一行调用
3. 根 AGENTS.md 守门速查表登记

详见 [GATEKEEPERS.md](./GATEKEEPERS.md)。

### Q28:如何加新端?

1. `apps/<new-end>/` 创建应用
2. `pnpm-workspace.yaml` 加路径
3. 复用 `@ihui/api-client` / `@ihui/types` / `@ihui/ui-react`
4. 根 AGENTS.md §9 多端同步规则

### Q29:如何加新 SDK?

参考 `packages/sdk/python/` 结构,实现 13 模块 + SdkConfig + 异常体系,版本号与 TS 对齐。详见 [SDK.md](./SDK.md)。

---

## 数据库类

### Q30:迁移怎么写?

```bash
pnpm --filter @ihui/database drizzle-kit generate   # 生成迁移 SQL
pnpm --filter @ihui/api db:migrate                   # 执行迁移
```

迁移文件在 `packages/database/src/migrations/`,SQL 人类可读。详见 [DATABASE.md](./DATABASE.md)。

### Q31:schema 怎么改?

编辑 `packages/database/src/schema/<table>.ts`(Drizzle table 定义),然后 `drizzle-kit generate` 生成迁移。禁止手改已生成的迁移文件。

### Q32:RLS 怎么开?

PostgreSQL Row Level Security 在 schema 中用 `pgPolicy` 定义,多租户隔离靠 `tenant_id` 列 + RLS 策略。详见 [DATABASE.md](./DATABASE.md) RLS 章节。

### Q33:种子怎么加?

`packages/database/src/seed.ts` 加种子数据,`pnpm --filter @ihui/database db:seed` 执行。

### Q34:备份怎么做?

```bash
./deploy/scripts/backup-db.sh    # pg_dump 到 /backups/ihui-<timestamp>.sql.gz
./deploy/scripts/restore-db.sh /backups/ihui-xxx.sql.gz  # 恢复
```

SaaS 多租户备份见 `deploy/saas/scripts/backup-customer.sh`。详见 [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md)。

### Q35:漂移怎么修?

```bash
node scripts/check-db-schema-drift.mjs   # 检测 schema 与 DB 实际结构差异
```

若漂移:生成补全迁移 → 在 staging 验证 → 生产执行。详见 [DATABASE.md](./DATABASE.md)。

---

## 认证类

### Q36:JWT 怎么验?

`packages/auth` 提供 `authenticate` 函数,验证 `Authorization: Bearer <jwt>` 头,解析 payload 中的 `userId` / `tenantId` / `roleId`。详见 [AUTHENTICATION.md](./AUTHENTICATION.md)。

### Q37:token 怎么刷新?

刷新 token 有效期 30 天,access token 有效期 15 分钟。前端在 access token 过期前用 refresh token 调 `/api/auth/refresh` 换新。详见 [AUTHENTICATION.md](./AUTHENTICATION.md)。

### Q38:OAuth 怎么配?

在 `.env` 配置 OAuth provider 凭证(GitHub / Google / 微信等),`apps/api/src/routes/auth.ts` 已实现 OAuth 回调。详见 [AUTHENTICATION.md](./AUTHENTICATION.md)。

### Q39:2FA 怎么开?

用户设置页绑定 TOTP(基于 otpauth 库),登录时除密码外还需输入 6 位动态码。详见 [AUTHENTICATION.md](./AUTHENTICATION.md)。

### Q40:API Key 怎么生成?

Web 控制台 → 设置 → API Keys → 创建,生成 `ihui_xxx` 格式 key + 可选 secret。Key 关联到用户 / 租户,可设过期时间 / 权限范围。详见 [SDK.md](./SDK.md) SdkConfig。

### Q41:多租户怎么隔离?

- DB 层:`tenant_id` 列 + RLS 策略
- API 层:每个请求解析 `tenantId`,查询自动加 `WHERE tenant_id = ?`
- 部署层:`deploy/saas/` 提供每租户独立 docker-compose + Traefik 路由

详见 [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) SaaS 章节。

---

## AI 服务类

### Q42:怎么接 OpenAI?

`.env` 配 `OPENAI_API_KEY`,LiteLLM 自动识别 `openai/gpt-4o` 模型名。详见 [LLM_SETUP.md](./LLM_SETUP.md)。

### Q43:怎么接 Claude?

`.env` 配 `ANTHROPIC_API_KEY`,模型名 `anthropic/claude-sonnet-4`。详见 [LLM_SETUP.md](./LLM_SETUP.md)。

### Q44:怎么接 Gemini?

`.env` 配 `GEMINI_API_KEY`,模型名 `gemini/gemini-2.5-pro`。详见 [LLM_SETUP.md](./LLM_SETUP.md)。

### Q45:怎么接国内模型?

通过 LiteLLM 接入:智谱(`zhipu/glm-4`)、文心(`wenxin/ernie-bot`)、通义(`dashscope/qwen-max`)、火山引擎(`volcengine/doubao`)。`.env` 配对应 API Key。详见 [LLM_SETUP.md](./LLM_SETUP.md) 与 [AI_LEADERBOARD.md](./AI_LEADERBOARD.md)。

### Q46:stub 模式是什么?

未配置真实 API Key 时,ai-service 返回模拟响应(stub),用于开发 / 测试 / CI 不消耗真实 token。环境变量 `AI_STUB_MODE=true` 开启。详见 [AI_SERVICE.md](./AI_SERVICE.md)。

### Q47:LangGraph 怎么写工作流?

`apps/ai-service/app/graphs/` 下定义 StateGraph,节点是函数,边是条件路由。详见 [AI_SERVICE.md](./AI_SERVICE.md)。

### Q48:MCP 怎么加工具?

1. `~/.ihui/mcp.json` 配置 MCP server(stdio / http / sse)
2. CLI 用 `ihui mcp add <name> <command>` 添加
3. Agent 主循环自动加载 MCP 工具

详见 [CLI.md](./CLI.md) MCP 命令。

### Q49:A2A 怎么用?

A2A(Agent-to-Agent)通过 `apps/api/src/routes/agents.ts` 的 pipeline / parallel 端点实现多 Agent 协作。SDK 调用 `client.agents.pipeline(req)` / `client.agents.parallel(req)`。详见 [SDK.md](./SDK.md) Agent 模块。

---

## 多端类

### Q50:8 端是否必须全用?

不必。可只用 web + api 部署最小可用版本。但根 AGENTS.md §9 规定**开发任务默认全端同步**,新增功能需在受影响端同步落地。详见 [MULTI_END.md](./MULTI_END.md)。

### Q51:能否只用 web?

可以。web + api + ai-service + DB + Redis 即可提供完整 AI 能力,其他端可选。详见 [MULTI_END.md](./MULTI_END.md)。

### Q52:desktop 是否支持 Mac / Linux / Windows?

是。desktop 跨平台(Electron / Tauri),winget(Windows)/ Homebrew(macOS)/ Snap(Linux)分发。详见 [RELEASE.md](./RELEASE.md) desktop 矩阵。

### Q53:extension 支持 Chrome / Firefox / Edge?

基于 WXT 0.19 构建,主要面向 Chrome / Edge(Chromium 内核)。Firefox 需在 `wxt.config.ts` 加 manifest 兼容配置。详见 [MULTI_END.md](./MULTI_END.md)。

### Q54:mobile-rn 是否支持 iOS / Android?

是。React Native 跨平台,EAS Build 同时构建 iOS + Android,App Store + Play Store 双端提交。详见 [RELEASE.md](./RELEASE.md) mobile-rn 矩阵。

### Q55:miniapp-taro 是否支持支付宝 / 百度小程序?

Taro 4.2 支持构建 weapp(微信)/ alipay(支付宝)/ swan(百度)/ tt(抖音)/ h5 五端,见 `apps/miniapp-taro/package.json` scripts。默认发布微信,其他端需对应平台开发者账号。详见 [MULTI_END.md](./MULTI_END.md)。

---

## 守门类

### Q56:为什么这么多守门?

历史上多次发生:API key 泄露 / i18n 漏翻 / schema 漂移 / 圆角违规 / 单端改动未同步 / commit 后忘 push 等事故。守门脚本把人工自觉变成机制强制,避免重复踩坑。详见 [GATEKEEPERS.md](./GATEKEEPERS.md)。

### Q57:能否关闭?

可以临时跳过:`HUSKY_SKIP_HOOKS=1 git commit ...`(跳过所有 pre-commit)。但**不推荐**,除非明确知道某守门误报。

### Q58:--no-verify 何时合法?

根 AGENTS.md §12 + §16 明确:**仅当 hook 失败原因是其他 agent 代码**(schema drift / 其他模块 TS 错误等,不在本任务范围)时合法跳过;若 hook 失败因本任务自己代码,必须修复后正常 commit,禁止 `--no-verify`。详见 [GATEKEEPERS.md](./GATEKEEPERS.md)。

### Q59:守门失败怎么修?

看脚本输出的错误信息,每条守门都有明确修复指引。例如:

| 守门 | 失败原因 | 修复 |
| --- | --- | --- |
| `check-i18n-keys.mjs` | key parity 不一致 | 补齐缺失 key |
| `check-db-schema-drift.mjs` | schema 与 DB 不符 | 生成迁移并执行 |
| `check-rounded-full.mjs` | 用了 `rounded-full` | 改为尺寸梯度圆角 |
| `git-push-guard.mjs` | 本地未 push | `git push origin <branch>` |

### Q60:如何加新守门?

1. `scripts/check-<name>.mjs` 编写(exit 0 通过 / 非 0 阻塞)
2. `.husky/pre-commit` 加调用
3. 根 AGENTS.md 守门速查表登记编号 + 用途
4. 若 warn-only,在脚本内 `console.warn` 但 `process.exit(0)`

详见 [GATEKEEPERS.md](./GATEKEEPERS.md)。

---

## i18n 类

### Q61:5 语言是否必须全翻译?

是。`zh-CN.json` 是基准,其他 4 语言(zh-TW / ko / ja / en)必须 parity(key 集合完全一致)。`check-i18n-keys.mjs` 守门。详见 [I18N.md](./I18N.md)。

### Q62:zh-TW 怎么处理?

用 opencc 字形转换检测简体字残留(`scan-i18n-zh-residue.mjs zh-TW`),禁止简体字混入。翻译策略见根 AGENTS.md §20。详见 [I18N.md](./I18N.md)。

### Q63:ko 怎么处理?

字符范围检测中文残留(`scan-i18n-zh-residue.mjs ko`),禁止中文残留。人名用音译(李思涵→리쓰한)。详见 [I18N.md](./I18N.md)。

### Q64:添加新语言流程?

1. `apps/web/messages/<locale>.json` 新建,从 zh-CN.json 复制并翻译
2. `apps/cli/src/i18n/messages/<locale>.ts` 同步 CLI 翻译
3. `scripts/scan-i18n-zh-residue.mjs` 的 `LOCALE_CONFIG` 加配置
4. 跑 parity 检查确认 key 一致
5. 在语言选择器加入口

详见 [I18N.md](./I18N.md) 与 [I18N-COMPLETION-PLAN.md](./I18N-COMPLETION-PLAN.md)。

---

## 商业化类

### Q65:能否商用?

能。Apache 2.0 协议允许商业使用。详见 LICENSE。

### Q66:是否收费?

项目本身免费开源。你可以基于它搭建自己的商业 SaaS(收费或不收费)。

### Q67:如何收费?

自主实现:用户 VIP 等级 / token 计费 / 订阅制。`apps/api/src/routes/` 已有用户 / 工作区 / 统计模块,可扩展计费逻辑。

### Q68:微信支付怎么接?

`apps/api/src/routes/` 有支付路由,`apps/miniapp-taro` 已集成微信支付。激活流程见 [WECHAT_PAY_ACTIVATION_REPORT.md](./WECHAT_PAY_ACTIVATION_REPORT.md)。

### Q69:计费怎么实现?

- token 计费:每次 AI 调用记录 usage,`/v1/user/stats` 汇总
- 套餐订阅:用户表加 `vip_level` / `vip_expires_at` 字段
- 配额限流:`QuotaExceededException`(429)在配额耗尽时返回

### Q70:多租户计费?

`deploy/saas/` 提供每租户独立 docker-compose + 独立 DB,`deploy/saas/scripts/` 有 create / pause / resume / destroy customer 脚本。每租户可独立计费。详见 [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) SaaS 章节。

### Q71:VIP 怎么实现?

用户表加 `vip_level`(0=免费 / 1=基础 / 2=专业)+ `vip_expires_at`,API 层按 vip_level 限流 / 限制模型 / 限制功能。前端按 vip_level 显示对应 UI。

---

## 性能类

### Q72:单机能撑多少用户?

| 配置 | 并发用户 | QPS | 说明 |
| --- | --- | --- | --- |
| 4C8G | 50-100 | 10-20 | web + api + ai-service 同机 |
| 8C16G | 200-500 | 50-100 | DB / Redis 独立 |
| 16C32G | 500-1000 | 100-200 | ai-service 水平扩展 |

瓶颈通常在 AI 模型调用(外部 API 限流),非本机性能。详见 [PERFORMANCE.md](./PERFORMANCE.md)。

### Q73:如何扩容?

- 垂直:加 CPU / 内存
- 水平:api / ai-service 无状态,直接加实例 + 负载均衡
- DB:读写分离 / 连接池
- Redis:集群模式
- AI:LiteLLM 多 key 轮询 + 多厂商 fallback

详见 [PERFORMANCE.md](./PERFORMANCE.md)。

### Q74:数据库如何优化?

- 索引:Drizzle schema 中 `index()` 覆盖高频查询字段
- 连接池:`pg` 连接池配置(默认 10)
- 分页:一律用 cursor 分页,避免 OFFSET
- 向量索引:pgvector + ivfflat 索引

详见 [DATABASE.md](./DATABASE.md) 与 [PERFORMANCE.md](./PERFORMANCE.md)。

### Q75:首屏如何加速?

- Next.js standalone 构建 + 静态生成
- 图片 next/image 优化 + WebP
- 字体子集化 + font-display: swap
- 关键 CSS inline
- CDN 静态资源

详见 [PERFORMANCE.md](./PERFORMANCE.md)。

### Q76:AI 首 Token 如何加速?

- LiteLLM 流式响应(stream:true)
- 连接预热(Keep-Alive)
- 模型路由:简单任务用小模型,复杂任务用大模型
- 缓存:相同 prompt 命中缓存

详见 [PERFORMANCE.md](./PERFORMANCE.md)。

---

## 安全类

### Q77:密码怎么存?

bcrypt 哈希(salt rounds 12),不存明文。`packages/auth` 提供 hashPassword / verifyPassword。详见 [SECURITY.md](./SECURITY.md)。

### Q78:凭证怎么加密?

OAuth client secret / 第三方 API Key 用 AES-256-GCM 加密存 DB,密钥在 `.env` 的 `ENCRYPTION_KEY`。详见 [SECURITY.md](./SECURITY.md) 与 [CREDENTIAL_ROTATION_RUNBOOK.md](./CREDENTIAL_ROTATION_RUNBOOK.md)。

### Q79:如何防 SQL 注入?

Drizzle ORM 参数化查询,所有用户输入通过 `sql.placeholder` 或 Drizzle 查询构建器传入,不拼字符串。`check-sanitizer-bypass.mjs` 守门。详见 [SECURITY.md](./SECURITY.md)。

### Q80:如何防 XSS?

- React 默认转义(`{}` 不渲染原始 HTML)
- `dangerouslySetInnerHTML` 受限使用 + DOMPurify 清洗
- CSP 头在 `deploy/nginx/conf.d/security-headers.conf` 配置

详见 [SECURITY.md](./SECURITY.md)。

### Q81:如何防 CSRF?

- SameSite=Strict / Lax cookie
- API 用 Bearer token(非 cookie),天然防 CSRF
- Origin / Referer 校验

详见 [SECURITY.md](./SECURITY.md)。

### Q82:如何防 OAuth 劫持?

- state 参数随机 + 一次性校验
- redirect_uri 白名单严格匹配
- PKCE(S256)扩展流程
- token 交换后才信任

详见 [AUTHENTICATION.md](./AUTHENTICATION.md)。

---

## 升级类

### Q83:如何升级到新版本?

```bash
git fetch origin
git pull origin main
pnpm install --frozen-lockfile
pnpm --filter @ihui/database db:migrate   # 执行新迁移
pnpm build
# 重启服务
```

详见 [RELEASE.md](./RELEASE.md) 部署流程。

### Q84:是否向后兼容?

MINOR / PATCH 版本保证向后兼容(遵循 SemVer)。MAJOR 版本(目前未发)会有迁移指南。`docs/CHANGELOG.md` 标注 `BREAKING CHANGE` 的条目需特别注意。详见 [CHANGELOG.md](./CHANGELOG.md)。

### Q85:数据库迁移是否可逆?

Drizzle 迁移生成 `up` SQL,不自动生成 `down`。回滚靠备份恢复(`restore-db.sh`),或手写反向 SQL。建议生产环境迁移前必备份。详见 [DATABASE.md](./DATABASE.md)。

### Q86:如何回滚?

```bash
# 代码回滚(蓝绿切换,秒级)
./deploy/scripts/rollback.sh

# 指定版本回滚(分钟级)
./deploy/scripts/rollback.sh to v1.2.2

# 数据库回滚
./deploy/scripts/restore-db.sh /backups/ihui-<timestamp>.sql.gz
```

详见 [RELEASE.md](./RELEASE.md) 回滚流程。

---

## 最优下一步建议

- 新用户建议先读 [architecture.md](./architecture.md) 了解整体架构,再按需深入对应文档。
- 部署前必读 [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) + [RELEASE.md](./RELEASE.md),跑 `pre-deploy.mjs`。
- 开发前必读 [CONTRIBUTING.md](./CONTRIBUTING.md) + 根 `AGENTS.md`(守门规则与多端同步红线)。
- 遇到未覆盖的问题,先查 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) 与 [INCIDENTS.md](./INCIDENTS.md)。
