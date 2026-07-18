# 安全策略(Security Policy)

本文件描述 IHUI-AI 项目的安全策略,包括漏洞报告流程、响应时间承诺、支持版本范围、
已部署的安全措施清单与依赖扫描策略。

IHUI-AI 是面向 C 端用户的全栈 AI 平台,涉及用户身份、支付(微信支付 V3)、
AI 调用计费、第三方 OAuth 凭证等敏感场景,安全是项目的核心约束。

---

## 1. 报告漏洞流程

### 1.1 私披露原则

**不要在公开 Issue、Discussion、Pull Request 或任何公共渠道披露安全漏洞。**
所有安全报告必须通过私密渠道提交,我们会在修复并发布后公开致谢。

### 1.2 报告渠道

- **首选邮件**:`security@ihui.ai`(占位,正式地址以仓库 README 为准)
- **GitHub Security Advisory**(推荐):仓库 → Security → Report a vulnerability
  → 私披露流程,可端到端追踪并生成 CVE
- **加密通信**:PGP 公钥指纹请通过仓库 README 获取(若有)

### 1.3 报告模板

请在报告中提供:

| 字段 | 说明 |
|---|---|
| 漏洞标题 | 简述漏洞类型与受影响组件 |
| 受影响版本 | Git commit hash 或 release tag |
| 受影响组件 | 文件路径(如 `apps/api/src/services/security-service.ts`)或路由 |
| 复现步骤 | 详细的命令 / HTTP 请求 / 输入 payload |
| 影响评估 | 用户数据泄漏 / RCE / 支付绕过 / DoS / 权限提升 |
| 修复建议 | 若有,可选 |
| 报告人身份 | 用于致谢(可匿名) |

### 1.4 期望

- **不要** 在漏洞修复前公开发布 PoC、截图、视频。
- **不要** 测试生产环境(`aizhs.top`),请使用本地或 staging 环境验证。
- **不要** 利用漏洞获取或修改其他用户的数据,仅做最小验证。

---

## 2. 响应时间承诺

| 阶段 | 时间 | 行动 |
|---|---|---|
| 确认收到 | 报告后 **24 小时内** | 维护者回复邮件,确认收到并分配内部工单号 |
| 初步评估 | 报告后 **72 小时内** | 评估漏洞等级(CVSS)、影响范围、是否接受 |
| 修复发布 | 报告后 **7 天内**(Critical / High)<br />**30 天内**(Medium / Low) | 提交修复 PR + 测试 + 发布 patch release |
| 公开披露 | 修复发布后 **7 天内** | 在 CHANGELOG / SECURITY ADVISORY 公开,致谢报告人 |

**特殊情况**:若报告人在修复前公开披露,我们将立即发布 advisory 并加速修复流程,
但保留拒绝致谢的权利。

---

## 3. 支持版本范围

| 分支 / 版本 | 支持状态 | 说明 |
|---|---|---|
| `main`(最新) | ✅ 完全支持 | 接收所有安全修复 |
| 最近一个 `release/*` | ✅ 完全支持 | 接收 Critical / High 回填 |
| 更早 `release/*` | ❌ 不支持 | 请升级到最新 `main` |
| `develop` | ⚠️ 仅安全评估 | 修复合入 `develop` 后会择机进入 `main` |
| 旧架构(Python FastAPI `server/` + Vue `client/`) | ❌ 不支持 | 已弃用,见 `docs/CHANGELOG.md` 的 Deprecated |

**用户应始终保持部署在 `main` 分支的最新 commit 或最近 release tag 上。**

---

## 4. 安全措施清单

IHUI-AI 在多个层面部署了安全措施,下表汇总各层防御点。

### 4.1 HTTP 安全头

由 `apps/api/src/services/security-service.ts` 中的 `SECURITY_HEADERS` 与
`@fastify/helmet` 插件(`apps/api/src/server.ts`)共同配置:

| 安全头 | 值 | 作用 |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | HSTS,强制 HTTPS |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline'; ...` | CSP,限制资源加载 |
| `X-Content-Type-Options` | `nosniff` | 禁止 MIME 嗅探 |
| `X-Frame-Options` | `DENY` | 禁止 iframe 嵌入(防点击劫持) |
| `X-XSS-Protection` | `1; mode=block` | 浏览器 XSS 过滤(兼容旧版) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Referrer 限制 |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` | 禁用危险 API |

**配置位置**:
- 应用层:`apps/api/src/services/security-service.ts` → `SECURITY_HEADERS`
- 框架层:`apps/api/src/server.ts` → `@fastify/helmet` 插件
- 反代层:`deploy/nginx/` → Nginx 配置(对外统一注入)

### 4.2 CSRF 防护

- 实现:`apps/api/src/services/security-service.ts` → `CSRFProtection` 类
- 插件:`apps/api/src/plugins/csrf.ts`
- Token 生成:`randomBytes(32).toString('hex')`,SHA-256 哈希后存 Redis
- TTL:`86400s`(24 小时),Redis 自动过期
- 绑定:Token 与 sessionId 绑定,跨会话不可重用

### 4.3 XSS 防护

- 实现:`apps/api/src/services/security-service.ts` → `InputValidator.sanitizeString()`
- 模式匹配:移除 `<script>` / `javascript:` / `onerror=` / `onload=` / `eval(` 等
- 前端:React 19 默认转义,`dangerouslySetInnerHTML` 禁用(守门:
  `scripts/check-sanitizer-bypass.mjs`)
- 输出编码:`apps/web` 中所有动态内容通过 React 模板渲染,禁止字符串拼接 HTML

### 4.4 SQL 注入防护

- ORM:Drizzle ORM 0.38(参数化查询,默认安全)
- 输入检测:`apps/api/src/services/security-service.ts` →
  `InputValidator.checkSqlInjection()`(关键字 + 引号组合检测)
- 禁止裸字符串拼接:`scripts/check-safe-parse.mjs` + ESLint 规则
- 健康检查:`/api/health/ready` 返回 `checks.database.status`

### 4.5 认证与授权(RBAC)

- JWT:`@fastify/jwt` + `packages/auth/src/jwt.ts`,密钥来自 `JWT_SECRET` 环境变量
- 过期:`JWT_EXPIRES_IN=7d`(可配置)
- RBAC:`apps/api/src/plugins/auth.ts` + `apps/api/src/db/rbac-queries.ts`
- 数据范围:`packages/auth/src/data-scope.ts`(行级数据权限)
- 黑名单:`packages/auth/src/blacklist.ts`(主动登出 / 强制下线)
- OAuth2:`packages/auth/src/oauth2.ts`(第三方登录)
- WebSocket 鉴权:`packages/auth/src/ws-auth.ts`

### 4.6 限流与异常检测

- 限流:`apps/api/src/services/security-service.ts` → `RateLimiter`(Redis 滑动窗口)
  - 每分钟 60 次 / 每小时 1000 次(默认,可按路由覆盖)
  - `@fastify/rate-limit` 插件提供框架级限流
- IP 黑名单:`isIpBlacklisted()`(Redis set `sec:ip:blacklist`)
- 异常检测:`recordIpFailure()` 连续失败 10 次自动拉黑 1 小时
- IP 提取:`X-Forwarded-For` > `X-Real-IP` > `request.ip`(支持反代)

### 4.7 凭证加密存储

- 密钥:`CREDENTIALS_ENCRYPTION_KEY`(至少 32 字符随机字符串)
- 用途:加密第三方 OAuth 凭证、支付凭证等敏感数据
- 实现:`apps/api/src/utils/crypto.ts`
- 启动校验:生产环境缺失时启动中止(`apps/api/src/index.ts` 的
  `checkProductionConfig`)

### 4.8 审计日志

- 实现:`apps/api/src/plugins/audit.ts`
- 范围:登录 / 登出 / 权限变更 / 支付操作 / 关键配置变更
- 查询:`apps/api/src/routes/audit.ts`(管理员可见)
- 落库:PostgreSQL `audit_logs` 表,不可篡改(只增不删)

### 4.9 支付安全(微信支付 V3)

- 启动硬约束(生产环境):
  - 缺失商户私钥 → 启动中止(无法调用真实支付 API)
  - 缺失平台证书 → 启动中止(回调验签失败,订单无法标记 paid)
- 证书位置:`cert/` 目录(`.gitignore` 已配置 `cert/`、`*.pem`、`*.p12`、`*.key`、
  `apiclient_*`)
- 凭证轮换:`scripts/cert-renew-watchdog.mjs` + `scripts/cert-expiry-check.mjs`
- 健康检查:`/api/health/ready` 返回 `checks.wechatPay.status`(ok/partial/missing)
- 证书续期:`deploy/cron/cert-renew.cron` + `deploy/cron/cert-renew.sh`

### 4.10 IDOR 防护

- 实现:`apps/api/src/utils/idor-guard.ts`
- 范围:资源访问前校验归属,防止越权访问他人数据

### 4.11 内部服务回调安全

- 共享密钥:`AI_CALLBACK_SECRET`(ai-service → api 回调时携带 `X-Internal-Secret` 头)
- 默认空(仅靠网络隔离),生产环境强烈建议配置随机字符串

---

## 5. 依赖扫描

### 5.1 频率

| 工具 | 频率 | 配置位置 |
|---|---|---|
| **Dependabot** | 每周一扫描 | `.github/dependabot.yml`(若未配置,见下文建议) |
| **Snyk** | 每次 PR + 每日定时 | `.github/workflows/`(集成 Snyk action) |
| **`pnpm audit`** | 每次 CI + 每周 | `pnpm audit --prod` |
| **GitHub Dependabot Alerts** | 实时 | 仓库 Settings → Security & analysis |

### 5.2 漏洞依赖处理流程

1. 收到 Dependabot / Snyk 告警
2. 评估漏洞等级与受影响路径(是否在生产路径中调用)
3. Critical / High:24 小时内升级 + 回归测试 + 发布 patch
4. Medium:7 天内升级
5. Low:随下一个 release 升级
6. 若上游无修复:用 `pnpm.overrides` 强制升版本(见根 `package.json` 已有用法)

### 5.3 锁定关键依赖

根 `package.json` 的 `pnpm.overrides` 已锁定:

```json
{
  "ioredis": "5.4.2",
  "webpack": "5.91.0",
  "@types/react": "19.2.17",
  "@types/react-dom": "19.3.2",
  "drizzle-orm": "0.38.4"
}
```

新增 override 需在 PR 描述说明原因(CVE 编号 / 兼容性)。

---

## 6. 安全头配置位置索引

| 安全能力 | 配置位置 | 备注 |
|---|---|---|
| HTTP 安全头(应用层) | `apps/api/src/services/security-service.ts` → `SECURITY_HEADERS` | Fastify reply header |
| HTTP 安全头(框架层) | `apps/api/src/server.ts` → `@fastify/helmet` 插件 | 兜底 + CSP |
| HTTP 安全头(反代层) | `deploy/nginx/` → Nginx 配置 | 对外统一注入 |
| CORS 白名单 | `apps/api/src/config/index.ts` → `CORS_ORIGIN` 环境变量 | 单一域名 |
| CSRF Token | `apps/api/src/services/security-service.ts` → `CSRFProtection` | Redis 存储 |
| 限流 | `apps/api/src/services/security-service.ts` → `RateLimiter` + `@fastify/rate-limit` | 双层限流 |
| JWT 签发 / 校验 | `packages/auth/src/jwt.ts` + `apps/api/src/plugins/auth.ts` | HS256 |
| RBAC 权限 | `apps/api/src/db/rbac-queries.ts` + `apps/api/src/routes/rbac.ts` | 角色 / 资源 / 操作 |
| 数据行级权限 | `packages/auth/src/data-scope.ts` | tenant 隔离 |
| 凭证加密 | `apps/api/src/utils/crypto.ts` | AES-256-GCM |
| 输入校验 | `apps/api/src/services/security-service.ts` → `InputValidator` | XSS / SQL / 文件类型 |
| IDOR 防护 | `apps/api/src/utils/idor-guard.ts` | 资源归属校验 |
| 审计日志 | `apps/api/src/plugins/audit.ts` + `apps/api/src/routes/audit.ts` | 落库 PostgreSQL |
| 微信支付证书 | `cert/` 目录(`.gitignore`) | 私钥 + 平台证书 |
| 证书轮换监控 | `scripts/cert-renew-watchdog.mjs` + `scripts/cert-expiry-check.mjs` | 自动化 |
| 内部回调密钥 | `AI_CALLBACK_SECRET` 环境变量 + `X-Internal-Secret` 头 | ai-service ↔ api |
| 多租户隔离 | `packages/database/src/rls.ts` + `apps/api/src/plugins/tenant.ts` | PostgreSQL RLS |

---

## 7. 安全相关变更同步

任何安全相关变更(新增 / 修改 / 移除安全能力)必须:

1. 在 `docs/CHANGELOG.md` 的 `Security` 小节追加条目
2. 更新本文件(`docs/SECURITY.md`)的对应小节
3. 评估是否需要发 patch release(Critical / High 必须)
4. 在 PR 描述标注 `Security` 标签,触发安全 Reviewer 评审

---

## 8. 致谢

感谢以下安全研究者对 IHUI-AI 的贡献(本节由维护者维护,首次发布后填充):

| 报告人 | 漏洞简述 | 修复版本 | 报告日期 |
|---|---|---|---|
| _(暂无)_ | - | - | - |

---

## 9. 联系方式

| 渠道 | 地址 | 用途 |
|---|---|---|
| 安全邮件(占位) | `security@ihui.ai` | 漏洞私披露 |
| GitHub Security Advisory | 仓库 → Security → Report a vulnerability | 端到端追踪漏洞 |
| 维护者 | 见仓库 README | 一般安全咨询 |

**注意**:`security@ihui.ai` 为占位地址,正式地址以仓库 README 公示为准。在正式地址
启用前,优先使用 GitHub Security Advisory 渠道。
