<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

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

- **首选邮件**:`security@aizhs.top`(占位,正式地址以仓库 README 为准)
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
| 安全邮件(占位) | `security@aizhs.top` | 漏洞私披露 |
| GitHub Security Advisory | 仓库 → Security → Report a vulnerability | 端到端追踪漏洞 |
| 维护者 | 见仓库 README | 一般安全咨询 |

**注意**:`security@aizhs.top` 为占位地址,正式地址以仓库 README 公示为准。在正式地址
启用前,优先使用 GitHub Security Advisory 渠道。

---

## 10. 安全加固记录（2026-10-29 全量加固）

本次对生产面做了一次实战级加固,聚焦"缩小攻击面、堵住未授权入口"。遵循项目铁律:
改动后须在 CI/本地把相关测试跑绿再上线。

### 10.1 P0 — DAP 调试代理越权 / RCE 面封禁

- **问题**:`apps/api/src/routes/debug.ts` 把 12 个 DAP 调试端点挂在 `/api/debug/*`,只校验
  "是否登录",无角色限制;而 `apps/ai-service/app/api/v1/debug.py` 的端点**无任何鉴权、无
  userId 作用域隔离**。`launch` 能在 ai-service 服务器上启动任意程序、`attach` 能挂任意进程、
  `eval` 能执行任意表达式、`list_sessions` 跨用户全局可见 —— 任意登录用户即可在服务器上 RCE。
- **修复**:
  1. `debug.ts` 入口守卫由 `authenticate`(仅登录)升为 `requireAdmin`(roleId≥1,只认人用 JWT,
     拒绝 internal service token 提权);
  2. `server.ts` 的 `onRoute` 钩子给 `/api/debug/` 注入 `network: { allowExternal: false }`,
     由 `network-segment` 插件在公网 IP 上硬拦 403(`NETWORK_SEGMENT_POLICY` 默认 `strict`);
  3. 回归测试 `apps/api/src/routes/__tests__/debug.test.ts` 新增"非管理员返回 403"用例钉死。
- **影响**:前端 IDE 调试面板(普通用户)变为管理员专属。在 ai-service 侧补"按 userId 隔离 +
  限定 program/cwd 在项目目录内"的根因修复完成前,调试能力不对普通用户开放。

### 10.2 P1 — chrome-extension Origin 收紧为 fail-closed

- **问题**:`server.ts` 的 CORS origin 函数与 WebSocket `verifyClient` 在 `IHUI_EXTENSION_IDS`
  未配置时,对 `chrome-extension://` 前缀**整体放行**所有已安装扩展(含恶意),仅记日志不拒绝。
- **修复**:未配置 `IHUI_EXTENSION_IDS` 时**拒绝**(fail-closed);已配置时按精确扩展 ID 放行。
  两处(CORS + WebSocket)同步修改。需支持自家扩展时,把扩展 ID 逐枚填入 `IHUI_EXTENSION_IDS`
  (约定填**完整** `chrome-extension://<id>` origin,与代码 `extIds.includes(o)` 比较一致)。
- **实现收敛(2026-10-29 补充)**:两处 Origin 判定已抽到单一纯函数
  `apps/api/src/plugins/cors-origin.ts` 的 `evaluateOriginAllowance`,并由新增单测
  `src/plugins/__tests__/cors-origin.test.ts`(10 用例,含"未配置即拒绝"核心契约)钉死 fail-closed,
  防止未来有人把 `chrome-extension` 误放回 `extAllowed=true` 静默回退。

### 10.3 P1 — nginx 边缘限流落地确认

- `deploy/nginx/conf.d/rate-limit.conf` 已存在,定义 6 个 zone(login/api/static/gateway_key/
  gateway_anon/ws_handshake),与 `nginx-blue-green.conf` 引用一一对应。
- **部署约束**:必须与 `nginx-blue-green.conf` **同批**部署到 `/etc/nginx/conf.d/`;漏放会
  `nginx -t` fail-fast 拒绝加载(宁可起不来,也不静默无限流上线)。

### 10.4 P2 — 可选边缘 WAF

- 新增 `deploy/nginx/conf.d/00-waf.conf`(路径遍历 + 已知恶意 UA 粗滤,宁漏勿误伤)。
- **默认不启用**:只定义 map 变量,需在 server 块内引用 `$waf_block` 才拦截。启用方式见文件头注释。

---

## 11. 密钥与凭证轮转流程

### 11.1 凭证清单

| 凭证 | 环境变量 / 位置 | 用途 | 轮转影响 |
|---|---|---|---|
| JWT 签名密钥 | `JWT_SECRET` | 用户/管理员会话 JWT(HS256) | 轮转后所有现有会话失效,用户需重新登录;建议错峰或双密钥过渡 |
| 内部服务令牌密钥 | `INTERNAL_SERVICE_SECRET` | api↔ai-service 内部调用鉴权 | 轮转需 api 与 ai-service 同步,否则内部调用 401 |
| 回调共享密钥 | `AI_CALLBACK_SECRET` | ai-service→api 回调(`X-Internal-Secret`) | 与 `INTERNAL_SERVICE_SECRET` 类似,双端同步 |
| 凭证加密密钥 | `CREDENTIALS_ENCRYPTION_KEY` | AES-256-GCM 加密第三方 OAuth/支付凭证 | 轮转需先解密再重加密存量,否则凭证不可读 |
| 微信支付证书 | `cert/`(`*.pem`/`*.p12`,`.gitignore`) | 微信支付 V3 验签/回调 | 由微信侧周期换发,`scripts/cert-renew-watchdog.mjs` 监控续期 |
| SSL 证书 | nginx `ssl/` | `aizhs.top` HTTPS | Let's Encrypt 自动续期(certbot --nginx) |
| relay 密钥池 | `ai_relay_key_pool`(DB 表) | 第三方 AI 模型转发凭证 | 池内单条 key 可单独禁用/替换,不影响其他;见 `admin/relay-api-keys` |
| 第三方 API Key | 阿里云短信/`ALIYUN_*`、微信支付/`WECHAT_*`、支付宝/`ALIPAY_*`、OpenAI/火山等 | 外部服务调用 | 各平台控制台轮换,更新对应 env 后重启相关 worker |
| 数据库密码 | `DATABASE_URL` | PostgreSQL 连接 | 改密码后需滚动重启 api/ai-service/worker |
| Redis 密码 | `REDIS_PASSWORD` / `REDIS_URL` | 缓存/限流/会话 | 改密码后需滚动重启所有依赖 Redis 的服务 |
| 部署 PAT | GitHub `GITHUB_TOKEN`(推送用) | 代码推送 | 按 GitHub 侧轮换,更新本地凭据文件 |

### 11.2 轮转通用原则

1. **fail-closed 优先**:任何密钥缺失/错配,生产应启动中止或拒绝服务,而非降级放行(见
   `checkProductionConfig`、`security-service` 启动硬约束)。
2. **双密钥过渡**:会话类密钥(JWT)支持新旧并存窗口,避免全员掉线。
3. **同步双端**:内部通道密钥(`INTERNAL_SERVICE_SECRET`/`AI_CALLBACK_SECRET`)必须 api 与
   ai-service 同一次发布内更新,否则内部链路 401 雪崩。
4. **配置外置**:所有密钥走 env / 密钥管理,禁止硬编码入源码(`scripts/check-safe-parse.mjs`)
   守门扫描)。
5. **轮换即审计**:密钥轮换动作本身写入 `audit_logs`,记录操作人与时间。

---

## 12. 后续收尾待办

- **ai-service 侧 debug 根因修复**:`debug.py` 接入鉴权 + 按 `userId` 隔离会话,并限定 `launch`
  的 `program`/`cwd` 只能在用户项目目录内 —— 完成后可评估放开普通用户的调试能力(否则仅管理员)。
- **依赖漏洞审计**:本机 npm registry 指向 `registry.npmmirror.com`,该镜像**无 audit 端点**,
  `pnpm audit` 直接报 `ERR_PNPM_AUDIT_ENDPOINT_NOT_EXISTS`,无法本地核验。
  **CI/有网环境改用官方 registry 执行**:
  ```bash
  # 整个 workspace(生产依赖)
  pnpm config set registry https://registry.npmjs.org/ && pnpm audit --prod
  # 或针对单包
  cd apps/api && pnpm audit --prod
  ```
  **高频风险面(建议重点盯)**:Fastify 及 `@fastify/*` 全家桶、JWT 签发/验签 `jose`、
  队列/Redis `bullmq`+`ioredis`、密码哈希 `argon2`/`bcrypt`、HTTP 客户端 `axios`/`node-fetch` 等。
  扫描节奏见 §5(CI 每次 + 每周)。
- **定期渗透 / 红队**:建议每季度一次,覆盖 API、relay 面、支付回调。
- **WAF 启用评估**:如 §10.4,评估后可在边缘开启 `00-waf.conf`。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
