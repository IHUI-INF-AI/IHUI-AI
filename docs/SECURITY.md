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

- **入口层(边缘)**:`deploy/win/ihui-api-router.mjs` 的单 IP 令牌桶(默认 500 rps / 1000 burst,
  超限 429 + Retry-After,回环豁免)。本机生产的入口就是这个 Node 反代,**不是 nginx** ——
  详见 §10.3 与 §10.5。
- 应用层限流:`apps/api/src/services/security-service.ts` → `RateLimiter`(Redis 滑动窗口)
  - 每分钟 60 次 / 每小时 1000 次(默认,可按路由覆盖)
  - `@fastify/rate-limit` 插件提供框架级限流
- IP 黑名单:`isIpBlacklisted()`(Redis set `sec:ip:blacklist`)
- 异常检测:`recordIpFailure()` 连续失败 10 次自动拉黑 1 小时
- IP 提取:`X-Forwarded-For` > `X-Real-IP` > `request.ip`(支持反代)
  - 注:入口限流**刻意不用** XFF 做 key(可伪造),只用 TCP 对端地址;应用层的 XFF 提取
    用于业务风控,不能当作限流依据。

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

### 10.3 ⚠️ 更正 — 本机生产的边缘层**不是 nginx**(2026-10-29 实测)

> 本节原写「nginx 边缘限流已落地确认」,与实测不符,已按真相改写。留原结论会让人以为
> 边缘有 6 套 zone 在挡 —— 那比没写更危险。

- **实测**(`Get-Service`/`netstat -ano`/`Win32_Service`):本机无 `nginx.exe` 进程、无 docker。
  8802(API)与 8801(web)均由 `deploy/win/ihui-api-router.mjs`(Node 反代,NSSM 服务
  `IHUI-API-ROUTER` / `IHUI-WEB-ROUTER`)承载。
- **因此** `deploy/nginx/conf.d/rate-limit.conf` 的 6 个 zone 与 `00-waf.conf` 在本机生产
  **从未生效**。它们只在 docker / 独立 nginx 形态下有意义(保留,不删)。
- **真实边缘防护由 EdgeOne 承担**(腾讯云边缘,含 DDoS 防护与部分 WAF 能力)。
- **源站暴露是已知权衡**:web 的 8801 必须绑 `0.0.0.0`(EdgeOne 源站直填本机公网 IP,
  只绑回环会让回源恒 522)⇒ 知道源站 IP 即可绕过 EdgeOne 直连。这是 router 层必须
  自带限流的原因,见 §10.5。

### 10.4 P2 — 可选边缘 WAF(仅 nginx 形态)

- `deploy/nginx/conf.d/00-waf.conf`(路径遍历 + 已知恶意 UA 粗滤,宁漏勿误伤)。
- **默认不启用**:只定义 map 变量,需在 server 块内引用 `$waf_block` 才拦截。启用方式见文件头注释。
- **本机生产不适用**:见 §10.3,本机没有 nginx。

### 10.5 P0 — 入口层限流(真实承载体 = Node router)

- **问题**:§10.3 更正后暴露的真实缺口 —— 入口 router 是纯反代,零限流、零 WAF、零超时收紧。
  而 web 源站可被直连绕过 EdgeOne,该层是唯一还能拦一手的。
- **实现**:`deploy/win/lib/ip-rate-limit.mjs`(单 IP 令牌桶),`ihui-api-router.mjs` 接线。
  - key = **TCP 对端地址**,绝不用 `X-Forwarded-For`(客户端可任意伪造,等于把限流开关交给攻击者);
  - 默认 **500 rps / 1000 burst**。定位是挡单 IP 扫描/小规模 CC,**不是**抗分布式 DDoS ——
    那种量级归 EdgeOne,单进程内存计数扛不住也不该扛(把 router 拖死等于替攻击者完成攻击);
  - 阈值给宽是因为 EdgeOne 回源时所有请求共享出口 IP;
  - 超限 `429` + `Retry-After`;日志每 IP 10s 节流(防被刷时日志盘先满,那也是一种打垮);
  - **回环豁免**(`127.0.0.1` / `::1` / `::ffff:127.0.0.1` / `127.*`):内部服务
    `ai-service → /api/internal/*` 与健康检查都从回环进来,不豁免会让批量内部调用把自己的通道限死;
  - 应急逃生舱:`IHUI_BG_RATE_LIMIT=off`(要的是「一条命令止血」,不是猜一个够大的数字)。
- **慢速攻击收口**:`headersTimeout` 60s→**30s**、`requestTimeout` 300s→**120s**
  (正常请求远达不到;slowloris 喂头/喂体能占 socket 五分钟的问题被堵)。
- **测试**:`deploy/win/lib/__tests__/ip-rate-limit.test.mjs` 12 条(突发/回补/桶容量硬上限/
  多 IP 独立/淘汰/配置回落/回环正反例);router 冒烟两向实测 —— 回环 30 请求全 200,
  局域网 IP 前 10 个 200、后 15 个 429 且日志点名。

### 10.6 P0 根因 — ai-service 调试面收口(默认关闭 + 归属隔离)

- **问题**:§10.1 只封了 api 网关入口,`apps/ai-service/app/api/v1/debug.py` 本身仍无鉴权、
  无 userId 隔离 —— 直连 8803 即可 launch 任意程序 / eval 任意表达式。
- **修复**:
  1. **默认关闭**:`IHUI_DEBUG_ENABLED` 未显式为真时整面 **404**(router 级依赖,12 端点一处生效)。
     依据是实测**零调用方** —— `apps/web` / `apps/mobile-rn` / `packages` 无任何 `/api/debug`
     引用,MCP 工具面亦无。不用就关,强于任何入口校验。
  2. **身份**:12 端点全部 `Depends(require_request_user_id)`,生产缺身份即 401,不依赖网关转发。
  3. **归属**:`launch`/`attach` 记录 `owner_user_id`,其余端点逐次 `verify_owner` ——
     拿到他人 `session_id` 不能接管;`list_sessions` 只返回自己的(否则枚举到 id 就等于能接管)。
- **刻意不做** `program`/`cwd` 路径白名单:`program` 指向仓库内解释器 + `args` 传 `-c` 即等价 RCE,
  白名单只制造「已防护」的错觉;且 Windows 上 `/tmp` 这类 POSIX 字面量会被解析成盘符相对路径
  而误伤真实调用方。真要做到「开了也只能调自己的代码」必须连 `args` 一起约束,那是另一个量级。
- **测试**:`apps/ai-service/tests/test_debug_hardening.py` 30 条 + 既有 82 条,共 112 条绿。
- **坑位**:归属校验方法原名 `assert_owner` —— `MagicMock` 会把 `assert_*` 属性当断言方法拦截,
  mock manager 的 36 条用例一次性 `AttributeError`,而真实调用方全绿 ⇒ 只在测试面爆,
  极易被误判成「测试写错了」而删判据。已改名 `verify_owner` 并在测试里写成显式断言。

### 10.7 P2 — 依赖审计实测结论(2026-10-29)

本机 registry 指向 npmmirror 无 audit 端点,但一次并发任务产出的 `npm audit --json` 快照
(已归档 `tmp/audit-20261029-1248.json`)给出了可判读的结论:

- 总览:critical 28 / high 49 / moderate 40 / low 10。
- **critical + high 的绝大多数落在 `apps/miniapp-taro` 的 devDependencies**(Taro/miniprogram-ci
  构建链:vm2、protobufjs、form-data、decompress、git-clone、lodash.template、json5 …)。
  威胁模型是**构建机被投毒**,不是线上服务器。
- **生产运行时唯一的 high**:`apps/api` ← `@opentelemetry/auto-instrumentations-node` ←
  `instrumentation-host-metrics` ← `systeminformation@5.33.1`(Windows `services()` 命令注入)。
  **逐行验证判定为不可达**:该 instrumentation 只 `require('systeminformation/lib/network')`
  调 `networkStats()`,**从不调用 `services()`**,且不接收任何用户可控参数。
- 处置:**不升级**(patch 版本虽兼容,但本仓多会话并发,动 lockfile 冲突风险高于收益);
  改为登记判定依据。下次该依赖升级时自然带修复(修复版 >= 5.33.16)。
- **机读判据已补(2026-10-29,同日收尾)**:守门 **260** `scripts/check-prod-dep-advisories.mjs`
  (blocking)。判据:生产可达(非 devOnly)的 critical/high 必须全被**未过期** waiver 覆盖;
  构建链存量只报数不拦(§12e)。豁免清单 = `scripts/data/dep-audit-policy.json`(三要素
  module/reason/expiresAt,reason <20 字即红、过期即红)。数据源是审计快照
  `.ihui-agent/state/dep-audit-cache.json`,缺失或超 30 天自动刷新(`pnpm audit --registry`,
  实测 6.8s),刷新失败 ⇒ exit 2 未判定。**这 28 个 critical 从此不再依赖人读文档。**
  当前水位:生产未豁免 0 条 / 已豁免 3 枚(systeminformation、image-size、zod,均带硬证据与
  2027-01-31 到期日)/ 构建链存量 23 条只报数。

### 10.8 P0 — 源站收敛:回源鉴权(两半均已落地,控制台侧由脚本直落)

**问题**:web 的 8801 必须绑 `0.0.0.0`(EdgeOne 回源直填公网 IP),知道源站 IP 即可绕过
EdgeOne 直连 —— 边缘那 500rps 限流和 EdgeOne 的 DDoS 防护都形同虚设。

**为什么不用防火墙 IP 白名单**(逐条读腾讯云文档 1552/76086,2026-09-03 版):
1. 回源 IP 段**只对付费套餐开放**,免费版拿不到;
2. 平均 **3-6 个月变一次**,变更通知窗口 14 天,漏一次就是整站回源失败;
3. 文档自己写明「回源 IP 网段内也可能存在少数不归属于 EdgeOne 的 IP」,并**建议叠加
   回源鉴权**(回源时携带自定义鉴权信息,由源站校验通过后再响应)形成多层防护。

**两半都已落地**:
- **源站侧**:`deploy/win/lib/edge-origin-guard.mjs` + `ihui-api-router.mjs` 接线。
- **控制台侧**:`scripts/eo-origin-guard-rule.mjs` 直接调 teo API 落地「修改 HTTP 回源请求头」规则
  (`ModifyRequestHeader` → `X-IHUI-Edge-Secret`),**不再需要人去控制台点**。幂等:条件按站点
  在线加速域名枚举,密钥读 `IHUI-WEB-ROUTER` 服务的 `AppEnvironmentExtra`,取值不落日志。

两个实现约束(实测 2026-10-29,踩过才写):
- `ModifyL7AccRule` 只传 `{RuleId,RuleName,Status}` 会回 `InternalError`,改造用 Delete + Create;
- `Condition` **不接受空串 / `true`**(`ErrNilCondition` / `Invalid Matching type: 'true'`),
  而 `uri.path in ['/']` 只精确匹配根路径(同名缓存规则就只缓存首页)—— 所以按域名枚举。

三档,**默认 `off`**(线上关键路径上新装 403 开关,默认必须什么都不做):

| 档位 | env | 行为 |
|---|---|---|
| off(默认) | 不设 / `IHUI_EDGE_SECRET_MODE=off` | 完全不校验 |
| observe | `=observe` + `IHUI_EDGE_SECRET=<随机串>` | **只统计不拦** —— 上线第一步必须走这档 |
| enforce | `=enforce` + `IHUI_EDGE_SECRET=<随机串>` | 不带头/头不匹配 ⇒ 403 |

- **回环豁免**:健康检查、部署脚本、内部服务调用都从 127.0.0.1 进来,永远不带回源头;
  不豁免的话开启 enforce 的瞬间部署环自己先死。
- **配了档位却没给密钥 ⇒ 放行**(启动日志明说「缺 IHUI_EDGE_SECRET ⇒ 实际不拦」):
  一个手滑漏填 env 不该变成整站 403。
- 校验在**限流之前**(直连者不带头直接 403,不必再耗一个限流令牌)。
- 比较用定长 XOR(不按字节短路泄漏密钥前缀)。

**开启顺序(必须按这个来,跳步就是全站 403)**:
1. 规则侧:`node scripts/eo-origin-guard-rule.mjs`(只读对账)→ `--apply`(落地/修偏);
2. 源站设 `IHUI_EDGE_SECRET=<同一个串>` + `IHUI_EDGE_SECRET_MODE=observe`,重启两个 ROUTER;
3. 观察:`D:\DevEnv\logs\svc-*-router.log` 里搜 `"msg":"edge guard"` ——
   **应当没有** `reason=missing`(有就说明还有流量没走 EdgeOne,先查清再继续);
   `match` 走 `pass` 分支**不写日志**,所以"日志安静"就是正向信号,别把"没日志"读成"没流量":
   主动打几发公网请求(`curl --noproxy '*' https://www.aizhs.top/__probe_<ts>`)再看 `edge guard` 行数增量为 0;
4. 切 `=enforce` 重启,再从外网直连源站 IP 验证返回 403、正常访问不受影响。

**实测**:
- **2026-10-29 线上切换**:规则由 `scripts/eo-origin-guard-rule.mjs --apply` 落地并 enable;
  落地后守卫日志连续 13 分钟零 `reason=missing`(主动打 3 发公网请求,增量 0)才切 enforce。
  切档后:公网 `www.aizhs.top` 200、内网直连源站不带/错头 403、回环不带 200、正确头 200。
- router 冒烟(observe/enforce 两档):局域网不带头 403 / 错头 403 / 正确头 200 / 回环不带头 200;
  observe 档四向全 200(不拦人)。测试 14 例 + `deploy/win/lib/__tests__/edge-origin-guard.test.mjs`。

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

- ~~ai-service 侧 debug 根因修复~~ **已完成(2026-10-29)**:默认关闭 + 逐端点身份 + 会话归属,
  见 §10.6。放开普通用户调试能力的前置仍是「连 `args` 一起约束」,未做。
- ~~依赖漏洞审计~~ **已出结论(2026-10-29)**:生产运行时唯一 high(`systeminformation`)
  判定不可达,构建链存量另计,见 §10.7。**仍未做的是机读判据**(见下条)。
- ~~依赖审计守门~~ **已补(2026-10-29)**:守门 260 + `scripts/data/dep-audit-policy.json`,
  生产 critical/high 不再依赖人读文档,见 §10.7。
- **`systeminformation` 升级**:等 `@opentelemetry/*` 自然带上来(>= 5.33.16),或单独开一次
  lockfile 变更窗口;单独为不可达 CVE 动 lockfile 的冲突风险高于收益(§10.7)。
  **注意 waiver 到期日 2027-01-31**:到期前必须重验,否则守门 260 会红。
- **定期渗透 / 红队**:建议每季度一次,覆盖 API、relay 面、支付回调。
- **WAF 启用评估**:仅 nginx 形态适用(§10.3/§10.4);本机生产走 EdgeOne,应在 EdgeOne
  控制台评估其 WAF/限流规则,而不是改仓库里的 nginx 片段。
- **源站收敛**:代码侧已就绪(§10.8 回源鉴权守卫,默认 off)。**待机主在 EdgeOne 控制台**
  配「修改 HTTP 回源请求头」→ 走 observe ≥24h → 切 enforce。防火墙 IP 白名单路线已排除:
  仅付费套餐开放、3-6 个月变一次、且官方文档自认网段内可能混入非 EdgeOne 的 IP。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
