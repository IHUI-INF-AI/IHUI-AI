# API 完整参考(IHUI-AI)

> IHUI-AI 全部 HTTP / WebSocket / SSE 端点的使用参考,涵盖 apps/api(Fastify 业务网关,~1080 端点)+ apps/ai-service(FastAPI AI 推理网关,~55 端点)。系统级架构、两 app 职责分工、启动流程见 [architecture.md](./architecture.md),本文档聚焦端点使用方法。

---

## 0. 总览

| 维度 | apps/api | apps/ai-service |
|------|----------|-----------------|
| 技术栈 | Fastify 5 + Drizzle ORM + @ihui/auth | FastAPI 0.115 + LangGraph + LiteLLM + MCP |
| 职责 | 业务 CRUD + 多厂商代理 + 认证 + WebSocket + 计费 | LLM 网关 + Agent 执行 + MCP 工具 + A2A + Voice |
| 默认端口 | 8080 | 8000 |
| 路由文件 | `apps/api/src/routes/`(80+ 文件) | `apps/ai-service/app/routers/` |
| 协议 | REST + WebSocket(12 端点)+ SSE 流式 | REST + SSE 流式 + Socket.IO |
| 鉴权 | JWT Bearer / Cookie / API Key / WS query token | 共享 JWT_SECRET,JWTAuthMiddleware |
| 路由注册 | `apps/api/src/server.ts` 的 `registerRoutes()` | `apps/ai-service/app/main.py` 的 `create_app()` |

> **职责边界审计规则**:审计 AI 能力迁移完整性时**必须同时看两 app**,不可仅看单一 app(详见 [architecture.md §0](./architecture.md#0-monorepo-两-app-职责边界审计必读))。

---

## 1. 统一响应格式

所有 REST 端点统一返回 `{ code, message, data }` 结构,由 `apps/api/src/utils/response.ts` 的 `success()` / `error()` 生成。

### 1.1 成功响应

```typescript
interface ApiSuccess<T> {
  code: 0
  message: 'success'
  data: T
}
```

### 1.2 错误响应

```typescript
interface ApiError {
  code: number         // 与 HTTP status 对齐:400/401/403/404/409/429/500/502/503
  message: string      // 人类可读错误信息(已脱敏)
  errorCode?: string   // 稳定业务标识符,前端可基于此做 i18n key 映射
}
```

### 1.3 分页响应

列表端点统一返回分页结构,字段约定:

| 字段 | 类型 | 说明 |
|------|------|------|
| `list` | `T[]` | 当前页数据 |
| `total` | `number` | 总记录数 |
| `page` | `number` | 当前页码(1-based) |
| `pageSize` | `number` | 每页条数(默认 10,最大 100) |

请求参数:`?page=1&pageSize=20`(部分老端点使用 `page_size`,见 `apps/api/src/routes/user-sk.ts`)。

---

## 2. 认证方式

详细机制见 [AUTHENTICATION.md](./AUTHENTICATION.md),本节仅列端点使用要点。

| 方式 | 适用场景 | 传参位置 | 示例 |
|------|---------|---------|------|
| Bearer JWT | 浏览器 / App 普通请求 | `Authorization: Bearer <accessToken>` | `curl -H "Authorization: Bearer eyJ..."` |
| Cookie | 浏览器同源页面刷新 | `auth_token` httpOnly cookie(后端 Set-Cookie) | 浏览器自动携带 |
| X-Tenant-ID | 多租户隔离 | 请求头 `X-Tenant-Id: <uuid 或 slug>` | 见 [architecture.md §12](./architecture.md#12-多租户架构原-server-docsmulti_tenantmd2026-07-22-整合) |
| WS query token | WebSocket 握手 | `?token=<wsToken>` 或 `socket.handshake.auth.token` | `wss://host/ws/notifications?token=xxx` |
| API Key | 对外公开 API `/v1/*` | `Authorization: Bearer <apiKey>`(前缀 `sk-`) | 见 §10 |
| Challenge Token | 2FA 登录中间态 | `Authorization: Bearer <challengeToken>`(type=challenge,5min,仅限 `/auth/2fa/login-verify`) | 见 [AUTHENTICATION.md](./AUTHENTICATION.md) |

公开端点(无需认证):`/api/health/*`、`/api/auth/login`、`/api/auth/register`、`/api/auth/send-code`、`/api/csrf-token`、`/api/agreements/*`、`/api/exchange-rates/*`、`/api/share/*`、`/api/carousels`、`/docs`、`/openapi.json`。

---

## 3. 错误码体系

错误码定义在 `apps/api/src/errors/codes.ts`,`code` 字段与 HTTP status 对齐,`errorCode` 是稳定的业务标识符。

| errorCode | HTTP status | 含义 | 触发场景 |
|-----------|-------------|------|---------|
| `VALIDATION_FAILED` | 400 | 参数校验失败 | Zod schema safeParse 失败,由 `parseOrThrow()` 抛出 |
| `UNAUTHORIZED` | 401 | 未认证 / token 失效 | 缺少 Authorization、token 过期、refresh token 当作 access token |
| `FORBIDDEN` | 403 | 无权限 | `roleId < 1` 访问 admin 端点、跨租户访问 |
| `NOT_FOUND` | 404 | 资源不存在 | 路由 404、租户不存在、资源 ID 无效 |
| `CONFLICT` | 409 | 资源冲突 | 重复注册、并发更新 |
| `MEMBER_EXISTS` | 409 | 会员已存在 | 重复购买会员 |
| `OPTIMISTIC_LOCK` | 409 | 乐观锁冲突 | `version` 字段不匹配 |
| `LOCKED` | 423 | 资源锁定 | 账户被锁定(连续登录失败) |
| `RATE_LIMITED` | 429 | 限流 | 全局 100/min 或 auth 10/min 触发 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 | 未捕获异常(已脱敏为"服务器错误") |
| `UPSTREAM_FAILURE` | 502 | 上游服务失败 | AI-service / 微信支付网关不可达 |
| `SERVICE_UNAVAILABLE` | 503 | 服务不可用 | 健康检查 `degraded` 状态、Redis 全宕机 |
| `INVALID_MONEY` | 400 | 金额格式错误 | 金额非整数(以分为单位) |
| `INVALID_TIMEZONE` | 400 | 时区格式错误 | 非法 IANA 时区字符串 |

> 全局错误处理器在 `apps/api/src/server.ts` 的 `errorHandler()` 中,Zod 错误自动映射为 `VALIDATION_FAILED`,5xx 错误日志记录完整 stack 但响应 message 脱敏为"服务器错误"。

---

## 4. 限流策略

由 `@fastify/rate-limit` + 自研 `distributed-rate-limit.ts`(Redis 滑动窗口 + 公平权重)实现,多实例生效。

| 维度 | 限制 | 失败响应 |
|------|------|---------|
| 全局 IP(生产) | 100 req/min/IP | 429 `{ code: 429, errorCode: 'RATE_LIMITED' }` |
| 全局 IP(开发) | 1000 req/min/IP | 同上 |
| auth 端点(login/register/send-code) | 10 req/min/IP | 同上 |
| `/api/llm/*`(ai-service) | 60 req/min/user | 429 |
| `/api/v1/chat/*`(ai-service) | 30 req/min/user | 429 |
| 租户配额(apiCalls) | 10000/天/租户(默认) | 429 + `tenantQuotas` 表计数 |
| 租户配额(storage) | 10 GB/租户 | 上传拒绝 |
| 租户配额(users) | tenantQuotas.userLimit | 拒绝新用户 |

环境变量:`NODE_ENV=production` 启用生产限流,`TENANT_STRICT_MODE=true` 启用多租户严格模式(未携带租户标识 → 401)。

---

## 5. 公共路由分组(apps/api)

按业务域归类,每类列出代表性端点。完整端点清单见 `apps/api/src/routes/<域>.ts`。所有公共路由前缀 `/api`(管理员路由见 §6,AI 服务路由见 §7,公开 API 见 §10)。

### 5.1 认证与会话(auth)

文件:`routes/auth.ts` + `routes/auth-extended.ts` + `routes/auth-sso.ts` + `routes/auth-identity.ts`

| 方法 | 路径 | 用途 |
|------|------|------|
| POST | `/api/auth/register` | 注册(手机号 + 密码 + 验证码 + 可选邀请码) |
| POST | `/api/auth/login` | 账号密码登录(支持手机号 / 邮箱 / 用户名) |
| POST | `/api/auth/login/phone` | 手机号 + 密码登录 |
| POST | `/api/auth/login/sms` | 短信验证码登录 |
| POST | `/api/auth/login/wechat` | 微信小程序 code 登录(jscode2session) |
| POST | `/api/auth/refresh` | 刷新 access token(token-family 旋转 + reuse 检测) |
| POST | `/api/auth/logout` | 登出(revoke refresh token + 加入黑名单) |
| GET | `/api/auth/me` | 获取当前用户信息 + 权限码 |
| POST | `/api/auth/send-code` | 发送短信验证码(scene: register/login/reset/phone-binding) |
| PUT | `/api/auth/password` | 修改密码(需登录) |
| DELETE | `/api/auth/account` | 注销账号(status=3,软删除) |
| POST | `/api/auth/2fa/enable` | 启用 2FA(TOTP RFC 6238) |
| POST | `/api/auth/2fa/verify` | 2FA 验证 |
| POST | `/api/auth/2fa/login-verify` | 2FA 登录验证(challenge token 端点) |
| POST | `/api/auth/sso/code` | SSO 授权码生成(跨子项目共享登录态) |
| POST | `/api/auth/sso/exchange` | SSO code 换 token |
| POST | `/api/auth/sso/logout` | SSO 统一登出 |
| POST | `/api/auth/identity/realname` | 实名认证提交 |
| GET | `/api/auth/identity/realname` | 实名认证查询 |

### 5.2 用户与社交(user / users / social / community / interactions)

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/users/:id` | 用户公开信息 |
| PUT | `/api/users/:id` | 更新用户资料(nickname/avatar/bio) |
| GET | `/api/users/:id/followers` | 粉丝列表 |
| POST | `/api/social/follows` | 关注用户 |
| DELETE | `/api/social/follows/:userId` | 取消关注 |
| POST | `/api/social/favorites` | 收藏资源 |
| GET | `/api/social/tags` | 标签云 |
| POST | `/api/interactions/like` | 点赞(评论/资源/话题) |
| POST | `/api/interactions/comment` | 评论 |
| GET | `/api/circles` | 社区圈子列表 |
| POST | `/api/circles` | 创建圈子 |
| GET | `/api/asks` | 问答列表 |
| POST | `/api/asks` | 提问 |

### 5.3 计费与电商(billing / order / vip / wallet / fund / finance)

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/billing/plans` | 订阅方案列表 |
| POST | `/api/orders` | 创建订单(微信 / 支付宝 / USDC) |
| GET | `/api/orders/:id` | 订单详情 |
| POST | `/api/payments/wechat/notify` | 微信支付回调(幂等) |
| POST | `/api/payments/alipay/notify` | 支付宝回调 |
| GET | `/api/vip/me` | 当前会员状态 |
| GET | `/api/wallet/balance` | 钱包余额 |
| POST | `/api/wallet/withdraw` | 提现申请 |
| GET | `/api/fund/transactions` | 资金流水 |
| GET | `/api/finance/commission` | 佣金统计 |
| POST | `/api/payments/recurring/sign` | 周期扣款签约(连续包月) |

### 5.4 内容与学习(content / learn / exam / news / topic / articles)

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/content/list` | 内容列表(支持分页 + 缓存) |
| GET | `/api/learn/courses` | 课程列表 |
| GET | `/api/learn/courses/:id/lessons` | 课程章节 |
| GET | `/api/learn/lessons/:id/video` | 课时视频签名 URL(HMAC-SHA256,1h 过期) |
| POST | `/api/learn/records` | 上传学习记录 |
| GET | `/api/exam/papers` | 试卷列表 |
| POST | `/api/exam/records` | 提交考试 |
| GET | `/api/news` | 资讯列表 |
| GET | `/api/topics` | 专题列表 |
| GET | `/api/articles` | 文章列表 |

### 5.5 聊天与智能体(chat / agents / crew / coze)

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/chat/sessions` | 对话会话列表 |
| POST | `/api/chat` | 发送对话消息(SSE 流式) |
| GET | `/api/chat/sessions/:id/messages` | 历史消息 |
| GET | `/api/agents/list` | 智能体列表 |
| GET | `/api/agents/:agentId` | 智能体详情 |
| POST | `/api/agents/create` | 创建智能体 |
| GET | `/api/agents/categories/list` | 智能体分类 |
| GET | `/api/agents/settlement/list` | 结算列表 |
| POST | `/api/crew/sessions` | 多智能体 Crew 会话 |
| POST | `/api/coze/chat` | Coze 平台对话代理 |
| GET | `/api/coze/datasets` | Coze 数据集 |
| POST | `/api/coze/oauth/authorize` | Coze OAuth 授权(device/web/pkce/jwt) |

### 5.6 文件与资源(files / oss / resource / chunked-upload)

| 方法 | 路径 | 用途 |
|------|------|------|
| POST | `/api/files/upload` | 文件上传(单文件 ≤100MB) |
| POST | `/api/files/chunked/init` | 分片上传初始化 |
| POST | `/api/files/chunked/upload` | 上传分片 |
| POST | `/api/files/chunked/merge` | 合并分片 |
| GET | `/api/files/versions/:id` | 文件版本列表 |
| POST | `/api/files/versions/:id/rollback` | 版本回滚 |
| GET | `/api/oss/upload-auth` | OSS 直传签名 |
| GET | `/api/resources` | 资源库列表 |
| POST | `/api/resources/:id/download` | 资源下载(计费) |

### 5.7 团队与协作(teams / workspace / groups / schedule)

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/teams` | 团队列表 |
| POST | `/api/teams` | 创建团队 |
| GET | `/api/workspace` | 工作区概览 |
| GET | `/api/workspace/permissions` | 工作区权限 |
| GET | `/api/groups` | 用户组列表 |
| GET | `/api/schedule` | 定时任务调度 |

### 5.8 消息与通知(message / notifications / push)

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/messages` | 站内消息列表 |
| POST | `/api/messages` | 发送站内消息 |
| GET | `/api/notifications` | 通知列表 |
| POST | `/api/push/register` | 注册推送 token(FCM / 个推) |
| POST | `/api/push/send` | 发送推送 |

### 5.9 搜索与发现(search / ranking / leaderboard / plaza)

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/search` | 全文搜索(GIN tsvector 索引) |
| GET | `/api/ranking` | 排行榜 |
| GET | `/api/leaderboard` | 积分排行榜(区别于 `/api/model-leaderboard` 大模型排行榜) |
| GET | `/api/plaza` | 广场 |

### 5.10 教育与会员(learn / exam / member / point / checkin / certificate)

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/learn/courses/:id` | 课程详情 |
| POST | `/api/exam/papers/:id/submit` | 提交试卷 |
| GET | `/api/members/me` | 会员信息 |
| GET | `/api/points/balance` | 积分余额 |
| POST | `/api/checkin` | 每日签到 |
| GET | `/api/certificates/me` | 我的证书 |

### 5.11 系统与运维(health / setting / dict / oss / behavior / visit-tracking / monitor / telemetry)

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/health` | 健康检查(基础) |
| GET | `/api/health/ready` | 就绪检查(DB + Redis + AI-service + 微信支付) |
| GET | `/api/health/live` | 存活检查 |
| GET | `/api/health/history` | 健康检查历史 |
| GET | `/api/health/metrics` | 指标摘要 |
| GET | `/api/openapi/tags` | OpenAPI tag 统计 |
| GET | `/api/openapi/tag/:tagName` | 按 tag 过滤的 OpenAPI 子文档 |
| GET | `/api/dict/data/type/:dictType` | 字典查询 |
| GET | `/api/settings` | 公开系统配置 |
| GET | `/api/monitor` | 监控指标 |
| POST | `/api/v1/telemetry/ingest` | Telemetry 上报 |

### 5.12 工作流与工具(workflows / tools / skills / memory / mcp-extended)

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/workflows` | 工作流列表 |
| POST | `/api/workflows/:id/execute` | 执行工作流 |
| GET | `/api/tools` | 工具目录 |
| GET | `/api/skills` | Skill 列表 |
| POST | `/api/skills` | 创建 Skill |
| GET | `/api/memory` | 读取记忆(cli / ai-service / api 三端同步) |
| POST | `/api/memory` | 写入记忆 |
| POST | `/api/knowledge/ingest` | 知识库 RAG 入库 |
| POST | `/api/knowledge/search` | 知识库语义搜索 |

### 5.13 其他业务域(简表)

| 业务域 | 路由文件 | 代表前缀 |
|--------|---------|---------|
| 股票分析 | `stock.ts` | `/api/stock` |
| 直播 | `live.ts` | `/api/live` |
| 客服 | `customer-service.ts` | `/api/customer-service` |
| 退款审核 | `refund-audit.ts` | `/api/refunds` |
| GDPR | `gdpr.ts` | `/api/gdpr/export` / `/api/gdpr/erase` |
| 多租户管理 | `tenant.ts` | `/api/tenants` |
| TBox IoT | `tbox.ts` | `/api/tbox` |
| 金丝雀发布 | `canary.ts` | `/api/canary` |
| 敏感词 / 协议 / 汇率 | `admin-sensitive-words.ts` 等 | `/api/admin/sensitive-words` |
| IM 平台 gateway | `im-gateway.ts` | `/api/im-gateway/webhook/:platform` |
| 插件市场 | `plugins.ts` | `/api/plugins` |
| AI 自动控制 | `agent-control.ts` | `/api/agent-control` |
| 浏览器降级 | `browser.ts` | `/api/browser/screenshot` |
| 自媒体 skill | `self-media-routes.ts` | `/api/self-media` |
| 多平台发布 | `publish-routes.ts` | `/api/publish` |
| 用户 LLM 配置 | `user-llm-configs.ts` + `user-llm-configs-v2.ts` | `/api/user/llm-configs` / `/api/v2/user/llm-providers` |
| CLI 配置导入 | `cli-import.ts` | `/api/user/cli-import` |
| SRS 媒体服务器 | `srs.ts` | `/api/srs` |
| 远程设备 | `remote-device.ts` | `/api/remote-device` |
| WebRTC 语音 | `webrtc-voice.ts` | `/api/webrtc-voice` |
| 外呼编排 | `outbound.ts` | `/api/outbound` |
| 一键视频编排 | `ai-video-compose.ts` | `/api/ai-video-compose` |
| LangChain 兼容 | `legacy-langchain.ts` | `/api/langchain` |
| 激励视频广告 | `rewarded-video-ad.ts` | `/api/rewarded-video-ad` |
| Agent Runtime | `agent-runtime.ts` | `/api/agent-runtime` |
| n8n 代理 | `n8n-proxy.ts` | `/api/n8n` |
| 腾讯混元 3D | `tencent-hunyuan-3d.ts` | `/api/tencent-hunyuan-3d` |
| 报表生成器 | `report.ts` | `/api/admin/reports` |
| 推送服务 | `push.ts` | `/api/push` |
| 文件转码 | `transcode.ts` | `/api/transcode` |
| DAP 调试代理 | `debug.ts` | `/api/debug` |
| 代码库语义搜索 | `v1-codebase-search.ts` | `/api/v1/codebase/search` |
| Inline Diff Apply | `v1-apply-diff.ts` | `/api/v1/ai/apply-diff` |
| AI 资讯聚合 | `ai-feed.ts` | `/api/ai-feed` |
| 大模型排行榜 | `leaderboard.ts` | `/api/model-leaderboard` |
| AI 教育模块 | `ai-education.ts` | `/api/ai-education` |
| BI Dashboard | `bi-dashboard.ts` | `/api/admin/bi` |
| AI World | `ai-world.ts` | `/api/ai-world` |
| 戏剧 / 分销 / 公告 / OpenClaw | `drama.ts` / `distribution.ts` / `announcements.ts` / `openclaw-routes.ts` | `/api/drama` / `/api/distribution` / `/api/announcements` / `/api/openclaw` |

---

## 6. 管理员路由(/api/admin/*)

前缀 `/api/admin`,通过 `plugins/require-permission.ts` 的 `requireAdmin` preHandler 统一鉴权(`roleId >= 1`)。系统内置管理员还受 DB 触发器 + 应用层双重锁保护(`users.isSystemAdmin = true` 禁止 UPDATE/DELETE)。

| 模块 | 代表端点 | 路由文件 |
|------|---------|---------|
| dashboard | `/api/admin/dashboard` | `admin.ts` |
| 用户管理 | `/api/admin/users` / `/api/admin/users/:id/resetPwd` | `admin.ts` |
| RBAC 角色 / 权限 | `/api/admin/roles` / `/api/admin/permissions` / `/api/admin/rbac/check` | `rbac.ts` |
| 项目管理 | `/api/admin/projects` | `admin.ts` |
| 订单管理 | `/api/admin/orders` | `order.ts` |
| 工作流管理 | `/api/admin/workflows` | `workflows.ts` |
| 内容审核 | `/api/admin/content/{type}/:id`(POST/PATCH/DELETE) | `admin/content/crud.ts` |
| 内容运营 | `/api/admin/content-ops` | `admin-content-routes.ts` |
| 标签管理 | `/api/admin/tags` | `admin.ts` |
| 系统配置 | `/api/admin/configs` / `/api/admin/integrations` | `system.ts` |
| 反馈管理 | `/api/admin/feedbacks` | `comments.ts` |
| 公告管理 | `/api/admin/announcements` | `content.ts` |
| 文档 / 帮助 | `/api/admin/docs` / `/api/admin/help/articles` | `content.ts` |
| 系统日志 | `/api/admin/logs` / `/api/admin/logininfor` | `system.ts` + `admin-sys.ts` |
| 系统事件 | `/api/admin/events` | `system.ts` |
| 统计 | `/api/admin/statistics` / `/api/admin/reports/signup` | `statistics.ts` + `admin.ts` |
| 行为追踪 | `/api/admin/behavior` | `behavior.ts` |
| 访问追踪 | `/api/admin/visit-tracking` | `visit-tracking.ts` |
| OSS 管理 | `/api/admin/oss` | `oss.ts` |
| 教育设置 | `/api/admin/edu-settings` | `setting.ts` |
| 菜单管理 | `/api/admin/menu` | `admin-sys.ts` |
| 部门 / 岗位 / 字典 | `/api/admin/dept` / `/api/admin/post` / `/api/admin/dict` | `admin-sys.ts` |
| AI 厂商 | `/api/admin/ai/vendors` | `ai-vendors.ts` |
| 退款审核 | `/api/admin/refunds` | `refund-audit.ts` |
| 客服管理 | `/api/admin/customer-service` | `customer-service.ts` |
| FAQ | `/api/admin/faq` | `admin-faq.ts` |
| 区域管理 | `/api/admin/zones` | `admin-zone.ts` |
| 需求广场 | `/api/admin/demand-square` | `admin-demand-square.ts` |
| 课程审核 | `/api/admin/course-audit` | `edu-extended.ts` |
| ZHS 课程 / 组织 | `/api/admin/course` / `/api/admin/organization` | `zhs-course.ts` / `zhs-organization.ts` |
| 智能体免费试用 | `/api/admin/agent-free-times` | `user-agent-free-times.ts` |
| 服务注册发现 | `/api/admin/service-catalog` | `service-catalog.ts` |
| 教育平台同步 | `/api/admin/education-platform` | `education-platform.ts` |
| 敏感词 / 协议 / 汇率 / 私信 | `/api/admin/sensitive-words` / `/api/admin/agreements` / `/api/admin/exchange-rates` / `/api/admin/private-letters` | 对应路由文件 |
| 灰度发布 | `/api/admin/gray-release` | `admin-gray-release.ts` |
| 错误看板 | `/api/admin/error-dashboard` | `admin-error-dashboard.ts` |
| API 平台 | `/api/admin/api-platform` | `admin-api-platform.ts` |
| 监控 / 鉴权 / 教务 | `/api/admin/monitoring` / `/api/admin/auth-edu` | `admin-monitoring-routes.ts` / `admin-auth-edu-routes.ts` |
| 商城 / 发票 | `/api/admin/shop` / `/api/admin/invoices` | `admin-shop-routes.ts` / `admin-invoices.ts` |
| 插件市场统计 | `/api/admin/plugins/stats` | `admin-plugin-stats.ts` |
| BI Dashboard | `/api/admin/bi` | `bi-dashboard.ts` |
| 报表生成 | `/api/admin/reports` | `report.ts` |
| 推送 / 转码 | `/api/admin/push` / `/api/admin/transcode` | `push.ts` / `transcode.ts` |
| Clawdbot | `/api/admin/clawdbot` | `clawdbot.ts` |
| i18n 仪表盘 | `/api/admin/i18n` | `i18n-dashboard.ts` |
| public_socket(9 端点) | `/api/admin/public-socket` | `public-socket.ts` |

> `i18nDashboardRoutes` 也注册在 `/api/admin` 前缀下。审计日志路由 `audit.ts` 同样挂在 `/api/admin`。

---

## 7. AI 服务端点(apps/ai-service)

apps/ai-service 在 `app/main.py` 中以 `prefix="/api"` 注册 router,完整路径形如 `/api/llm/complete`。

| 模块 | 代表端点 | 用途 |
|------|---------|------|
| health | `GET /` / `GET /health` / `GET /health/live` / `GET /health/ready` | 健康检查 |
| llm | `POST /api/llm/complete` | LLM 同步补全(LiteLLM 网关) |
| llm | `GET /api/llm/models` | 模型列表 |
| llm | `POST /api/llm/complete/stream` | LLM 流式补全(SSE) |
| mcp | `GET /api/mcp/tools` | MCP 工具列表(11 工具) |
| mcp | `POST /api/mcp/tools/:name/execute` | 执行 MCP 工具 |
| mcp | `GET /api/mcp/resources` | MCP 资源列表(3 资源) |
| mcp | `GET /api/mcp/prompts` | MCP 提示词列表(3 提示词) |
| agents | `POST /api/agents/execute` | Agent 执行(LangGraph) |
| agents | `POST /api/agents/execute/stream` | Agent 流式执行 |
| a2a | `POST /api/a2a/agents/register` | A2A Agent 注册 |
| a2a | `GET /api/a2a/agents` | A2A Agent 列表 |
| a2a | `POST /api/a2a/tasks` | 创建 A2A 任务 |
| a2a | `GET /api/a2a/tasks/{task_id}/status` | 任务状态 |
| a2a | `GET /api/a2a/tasks/{task_id}/result` | 任务结果 |
| agent-runtime | `POST /api/agent-runtime/execute` | Agent Runtime 执行(PermissionGuard 5 mode) |
| agent-runtime | `POST /api/agent-runtime/execute/stream` | 流式执行 |
| agent-runtime | `GET /api/agent-runtime/sessions` | 会话列表 |
| agent-runtime | `POST /api/agent-runtime/sessions/:id/resume` | 恢复会话 |
| agent-runtime | `GET /api/agent-runtime/memory` | 读取记忆 |
| agent-runtime | `POST /api/agent-runtime/memory` | 写入记忆 |
| agent-runtime | `GET /api/agent-runtime/permission/check` | 权限检查 |
| tools | `POST /api/tools/search-codebase` | 代码库语义搜索 |
| personas | `/api/personas/*` | Persona 管理 |
| voice_stt | `/api/voice/*` | 语音 STT |
| self_media | `/api/self-media/*` | 自媒体 skill(公众号文章 + 口播稿) |
| publish | `/api/publish/*` | 多平台一键发布(14 平台) |
| opencompass | `/api/opencompass/*` | OpenCompass 排行榜抓取(Playwright) |
| screenshot | `/api/screenshot/*` | 截图服务(Playwright headless) |
| memory | `/api/memory/*` | 四层记忆 + Dream 梦境系统 |
| message-bus | `/api/message-bus/*` | 多通道消息总线(5 通道 + 优先级 + 降级) |
| v1 业务流 | `/api/v1/*` | 对话 / 智能体 / RAG |
| lsp | `/api/v1/lsp/*` | LSP 转发(web IDE 调试面板) |
| debug | `/api/v1/debug/*` | DAP 调试 |
| legacy | `/socketio/status` / `/card/convert` / `/category/cache` 等 | 历史兼容端点 |

ai-service 全局异常兜底返回 `{ code: 500, message: '服务内部错误', data: None }`,CORS / JWT 中间件 / OpenTelemetry / 审计 / 输入净化 / 响应脱敏 / 限流中间件均在 `create_app()` 中注册。

---

## 8. WebSocket 端点(12 个)

WS 端点总览见 [architecture.md §3 的表](./architecture.md#websocket-端点apps/apisrcpluginsws-tsts12-端点),本节聚焦使用方法。

### 8.1 握手 URL 与鉴权

所有 WS 端点通过 `wsAuth(socket, token)` 校验短期 WS token(type='ws',5min 过期,与 access token 隔离)。token 优先级:

1. `socket.handshake.auth.token`(socket.io 推荐)
2. `Authorization: Bearer <token>` header
3. `?token=<wsToken>` query(兜底,会写入 access log,不推荐)

| 端点 | URL | 鉴权 | 多实例 |
|------|-----|------|--------|
| 全局通知 | `wss://host/ws/notifications` | WS token | Redis Pub/Sub 广播 |
| 聊天室 | `wss://host/ws/room/:roomId` | WS token | Redis Pub/Sub |
| 客服会话 | `wss://host/ws/customer-service` | WS token | 1:1 |
| 支付状态 | `wss://host/ws/payment/status/:orderNo` | WS token | 1:1 |
| 通用广播 | `wss://host/ws/broadcast` | WS token | Redis Pub/Sub |
| Agent 流式 | `wss://host/ws/agent/stream` | WS token | 1:1 |
| TTS 流式 | `wss://host/ws/tts/stream` | WS token | 1:1 |
| 实时音频 | `wss://host/ws/realtime/pcm` | WS token | 1:1(PCM16 16kHz) |
| AI 能力流 | `wss://host/v1/ai/capabilities/ws/stream` | WS token | 1:1(代理到 ai-service SSE) |
| 股票行情 | `wss://host/ws/stock/stream` | WS token | 1:1 |
| 音色克隆 | `wss://host/ws/timbre/generate` | WS token | 1:1 |
| Coze 对话 | `wss://host/ws/coze/chat` | WS token | 1:1 |
| live-chat | `wss://host/ws/live-chat?roomId=xxx` | WS token | 房间广播 |
| IM 消息 | `wss://host/ws/messages` | WS token | Redis Pub/Sub(`im:user:{userId}`) |
| 任务进度 | `wss://host/ws/tasks/:taskId` | WS token | Redis Pub/Sub(`task:{taskId}`) |

> WS 端点不纳入 OpenAPI 3.0 spec(协议不兼容),如需机器可读规范建议使用 AsyncAPI。

### 8.2 心跳

客户端发送 `ping` 或 `{"type":"ping"}`,服务端响应 `pong`。

### 8.3 消息格式

```typescript
// 客户端 → 服务端
{ "type": "chat_message", "data": { "content": "你好" } }

// 服务端 → 客户端(Agent 流式)
{ "type": "capability.start", "data": { "id": "xxx" } }
{ "type": "capability.delta", "data": { "delta": "你好" } }
{ "type": "capability.done", "data": { "usage": { "tokens": 100 } } }
```

### 8.4 客户端代码示例(浏览器)

```typescript
import { io } from 'socket.io-client'

// 1. 先获取 WS token(需登录)
const wsTokenRes = await fetch('/api/auth/ws-token', { method: 'POST', credentials: 'include' })
const { wsToken } = await wsTokenRes.json()

// 2. 建立 WS 连接
const socket = io('/ws/notifications', {
  auth: { token: wsToken },
  transports: ['websocket'],
})

socket.on('connect', () => console.log('WS connected'))
socket.on('notification', (msg) => console.log('收到通知:', msg))
socket.on('disconnect', (reason) => console.log('WS disconnected:', reason))

// 3. 心跳(客户端库自动处理,如需手动)
setInterval(() => socket.emit('ping'), 25000)
```

---

## 9. SSE 流式端点

### 9.1 Agent 流式

端点:`POST /api/chat`(SSE)+ `POST /api/ai/chat/stream`(小程序端)+ ai-service `POST /api/llm/complete/stream` + `POST /api/agents/execute/stream`。

事件类型:

| 事件 | 说明 |
|------|------|
| `capability.start` | 流式开始,携带 request id |
| `capability.delta` | 增量内容(token 级) |
| `capability.done` | 流式完成,携带 usage 统计 |
| `capability.interrupt` | 中断(用户取消 / 安全拦截) |
| `capability.continue` | 继续(中断后恢复) |
| `capability.cancel` | 取消(用户主动取消) |

### 9.2 TTS 流式

端点:`POST /api/ai/tts/stream` + WS `/ws/tts/stream`。

事件类型:`tts.start` / `tts.delta`(音频 chunk,base64 PCM)/ `tts.done` / `tts.interrupt`。

### 9.3 SSE 客户端示例

```typescript
const eventSource = new EventSource('/api/chat?sessionId=xxx', {
  withCredentials: true,
})

eventSource.addEventListener('capability.start', (e) => {
  const { id } = JSON.parse(e.data)
  console.log('stream started:', id)
})

eventSource.addEventListener('capability.delta', (e) => {
  const { delta } = JSON.parse(e.data)
  // 渲染增量内容
})

eventSource.addEventListener('capability.done', (e) => {
  const { usage } = JSON.parse(e.data)
  console.log('usage:', usage)
  eventSource.close()
})

eventSource.onerror = () => eventSource.close()
```

---

## 10. 对外公开 API(/v1/*,API Key 鉴权)

独立于 `/api` 业务路由,使用 API Key 鉴权(前缀 `sk-`),供第三方开发者集成。路由文件:`routes/v1-public.ts` + `v1-ai-core.ts` + `v1-multimodal.ts` + `v1-knowledge-tools.ts`。

| 类别 | 端点数 | 代表端点 |
|------|--------|---------|
| AI 核心 | 20 | `POST /v1/chat/completions` / `POST /v1/embeddings` / `GET /v1/models` / `POST /v1/agents/execute` |
| 多模态 | 21 | `POST /v1/audio/speech` / `POST /v1/images/generations` / `POST /v1/videos/generations` / `POST /v1/3d/generations` |
| 知识工具 | 57 | `POST /v1/knowledge/search` / `POST /v1/memory/search` / `POST /v1/messages` / `POST /v1/files/upload` / `POST /v1/workflow/execute` |

完整 SDK 见 `packages/sdk/`(TypeScript / Go / Java / Python / .NET 5 语言),SDK 内置熔断器 + 流式 + 自动重试。

### API Key / PAT / SK 三种凭证区别

| 凭证 | 路由 | 用途 | 前缀 |
|------|------|------|------|
| API Key | `/v1/*` + `routes/developer.ts` | 第三方开发者集成 OpenAPI | `sk-` |
| Personal Access Token (PAT) | `routes/sdks.ts` | 用户个人长期访问令牌 | `pat-` |
| User SK | `routes/user-sk.ts`(`/ihui-ai-api/user-sk/*`) | 用户 SK 密钥(迁移自 D 盘 coze_zhs_py) | `sk-` |

详细区别与使用场景见 [AUTHENTICATION.md](./AUTHENTICATION.md)。

---

## 11. OpenAPI spec

### 11.1 生成与暴露

- 由 `@fastify/swagger` + `@fastify/swagger-ui` 自动生成,仅在 `SWAGGER_ENABLED=true` 时挂载(默认关闭,生产环境防 API 路由枚举攻击)。
- 暴露端点:`GET /docs`(Swagger UI)/ `GET /docs/json`(OpenAPI 3.0 JSON)。
- 启动开发服务后访问 `http://localhost:8080/docs` 查看交互式文档。

### 11.2 守门脚本

`scripts/openapi-check.mjs`(pre-commit 第 10 项,informational-only,不阻塞):

- 统计 `apps/api/src/routes/` 下的 `.ts` 路由文件数量
- 检查 `apps/api/openapi.json` 是否存在
- 缺失时建议运行 `pnpm --filter @ihui/api dev` 后访问 `/docs/json` 生成 spec

### 11.3 tag 子文档

`GET /api/openapi/tags` 按 tag 统计端点数;`GET /api/openapi/tag/:tagName` 返回指定 tag 的 OpenAPI 子文档(便于按业务域生成精简文档)。

---

## 12. 客户端调用示例

### 12.1 curl(登录 → 调用受保护端点 → 刷新 → 登出)

```bash
# 1. 登录
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"13800138000","password":"yourpassword"}' \
  -c cookies.txt
# 响应: { "code":0, "message":"success", "data":{ "token":"eyJ...", "refreshToken":"eyJ...", "user":{...} } }

# 2. 调用受保护端点(Bearer JWT 或 cookie)
curl http://localhost:8080/api/auth/me \
  -H "Authorization: Bearer eyJ..." \
  -b cookies.txt

# 3. 多租户请求
curl http://localhost:8080/api/users/me \
  -H "Authorization: Bearer eyJ..." \
  -H "X-Tenant-Id: 00000000-0000-0000-0000-000000000000"

# 4. 刷新 token
curl -X POST http://localhost:8080/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"eyJ..."}'

# 5. 登出
curl -X POST http://localhost:8080/api/auth/logout \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"eyJ..."}'
```

### 12.2 fetch(浏览器)

```typescript
// 统一封装见 apps/web/src/lib/api.ts 的 fetchApi<T>
async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include', // 自动携带 auth_token cookie
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  const json = await res.json()
  if (json.code !== 0) {
    throw new Error(json.message)
  }
  return json.data as T
}

// 调用
const me = await fetchApi<{ id: string; nickname: string }>('/api/auth/me')
```

### 12.3 @ihui/api-client(TypeScript SDK)

`packages/api-client/src/client.ts` 提供带熔断器 + token 注入 + URL 规范化的统一客户端,被 web / desktop / extension / mobile-rn / miniapp-taro 5 端复用。

```typescript
import {
  setBaseUrl,
  setTokenProvider,
  fetchApi,
} from '@ihui/api-client'

// 1. 注入 base URL 和 token provider
setBaseUrl('http://localhost:8080')
setTokenProvider({ getToken: () => localStorage.getItem('access_token') })

// 2. 调用(自动拼接 /api 前缀 + 注入 Authorization + 熔断)
const me = await fetchApi<{ id: string; nickname: string }>('/auth/me')
const plans = await fetchApi<{ list: unknown[]; total: number }>('/billing/plans', {
  params: { page: 1, pageSize: 20 },
})
```

### 12.4 其他语言 SDK

| 语言 | 包路径 | 入口 |
|------|--------|------|
| Go | `packages/sdk/go/` | `ihui.go` |
| Java | `packages/sdk/java/` | `com.ihui.ai.sdk.IhuiClient` |
| Python | `packages/sdk/python/` | `ihui_ai.client.IhuiClient` |
| .NET | `packages/sdk/dotnet/` | `Ihui.AI.Client.IhuiClient` |

所有 SDK 模块统一为:AgentsApi / AiApi / AudioApi / FilesApi / GenerationApi / ImagesApi / KnowledgeApi / MemoryApi / MessagesApi / ThreeDApi / ToolsApi / UserApi / VideosApi。

---

## 13. CORS 与可信代理

| 配置 | 值 | 说明 |
|------|-----|------|
| CORS origin | `CORS_ORIGIN` env(默认 `http://localhost:8801`,逗号分隔多域名) | `credentials: true`,支持 OPTIONS 预检 |
| CORS methods | GET / POST / PUT / PATCH / DELETE / OPTIONS | |
| trustProxy | `TRUSTED_PROXIES` env(逗号分隔 IP/CIDR) | 严禁 `true`,防 X-Forwarded-For 伪造绕过 IP 限流 |
| bodyLimit | 10 MB | 文件上传走 multipart(单文件 ≤100MB) |

---

## 14. 参考

- [architecture.md](./architecture.md) — 系统架构、两 app 职责边界、性能基线
- [DATABASE.md](./DATABASE.md) — 数据库设计、schema 模块、迁移管理
- [AUTHENTICATION.md](./AUTHENTICATION.md) — JWT、token-family、OAuth2、RBAC、WS auth
- [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) — 部署与回滚流程
- [SECURITY.md](./SECURITY.md) — 安全设计、2FA、CSRF、XSS 防护
- `apps/api/src/errors/codes.ts` — 错误码源定义
- `apps/api/src/utils/response.ts` — 响应格式源定义
- `apps/api/src/server.ts` — 路由注册总入口
- `apps/ai-service/app/main.py` — AI 服务路由注册总入口
