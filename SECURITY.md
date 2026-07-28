# 安全策略(Security Policy)

## 支持版本(Supported Versions)

IHUI-AI 是积极开发中的开源项目,仅对最新主版本提供安全更新:

| 版本 | 支持状态 | 备注 |
| --- | --- | --- |
| `v0.2.x` | ✅ 安全更新 | 当前开发分支 |
| `< v0.2.0` | ❌ 不支持 | 早期实验版本,请升级 |

生产部署请始终使用最新 Release tag。预发布 commit(包括 `main` 分支 HEAD)不接受安全 SLA。

---

## 报告漏洞(Reporting a Vulnerability)

### 报告渠道

**请勿在 GitHub Issue / Discussions / 公开渠道披露安全漏洞。**

- **首选邮箱**:`security@aizhs.top`
- **GitHub 私密报告**:使用 GitHub 的 [Security Advisory](https://github.com/IHUI-INF-AI/IHUI-AI/security/advisories/new) 功能(Private vulnerability reporting)
- **PGP 加密**(可选,高敏感漏洞):请求公钥请发邮件至 `security@aizhs.top`,主题含 `[PGP-KEY-REQUEST]`

### 报告应包含

- **漏洞类型**(SQL 注入 / XSS / IDOR / 认证绕过 / SSRF / RCE / 信息泄露 / 供应链 / 其它)
- **受影响版本**(commit SHA 或 release tag)
- **受影响文件 / 路由 / 端**(`apps/api/src/routes/xxx.ts` / `apps/web/src/...`)
- **复现步骤**(可运行的 PoC 优先;无 PoC 也可报告,但请提供详细路径分析)
- **影响范围**(数据泄露 / 权限提升 / 拒绝服务 / 远程代码执行)
- **建议的修复方案**(可选,但对加速修复非常有帮助)

### 响应 SLA

| 阶段 | 时间窗 | 维护者动作 |
| --- | --- | --- |
| 确认收到 | 48 小时内 | 回复邮件确认收到,分配漏洞编号 `IHUI-SEC-YYYY-NNN` |
| 初步评估 | 5 个工作日内 | 评估严重性(Critical / High / Medium / Low),回复评估结论 |
| 修复发布 | Critical 7 天内 / High 14 天 / Medium 30 天 / Low 下个 release | 在私有分支修复,通过 Release 部署补丁 |
| 公开披露 | 修复发布后 90 天(或与报告者协商的协调披露窗口) | 发布 Security Advisory + CVE 申请 |

如未在 SLA 内收到回复,请通过 `community@aizhs.top` 升级提醒。

### 报告者致谢

- 报告者(如愿意)会在修复 Release 的致谢区列出
- 报告 Critical / High 漏洞的贡献者可获得 IHUI-AI 荣誉贡献者徽章
- 我们尊重报告者匿名意愿,可用化名致谢

---

## 已知安全特性(Built-in Security Features)

IHUI-AI 在多层级实施了安全防护:

### 认证与授权(Authn/Authz)

- **JWT + Refresh Token 双 token 机制**:Access Token 短期(15min),Refresh Token 长期(7d),支持吊销
- **基于角色的访问控制(RBAC)**:管理员路由用 Fastify `preHandler` 统一校验 `roleId >= 1`
- **多租户行级安全(Multi-tenant RLS)**:`packages/database/src/rls.ts` + PostgreSQL RLS policy,跨租户数据隔离
- **OAuth2 / SSO**:支持 Google / GitHub / WeChat / 微信企业号 / SAML
- **2FA / MFA**:TOTP + 备份码
- **mTLS**:服务间通信(`apps/api/src/plugins/mtls.ts`)
- **WebSocket 鉴权**:`packages/auth/src/ws-auth.ts`,带 HMAC 签名

### 数据安全(Data Security)

- **AES-256-GCM 加密**:敏感字段(手机号 / 邮箱 / API Key)在数据库层加密
- **API Key 不入库**:只存 `SHA-256` 哈希,创建时一次性返回明文
- **PostgreSQL RLS 行级安全**:340+ 表全部启用 tenant 隔离 policy
- **请求参数 Zod 校验**:所有 API 入参用 Zod schema 校验,禁止裸 `as` 类型断言

### API 安全(API Security)

- **速率限制**:`@fastify/rate-limit`,用户级 + IP 级双层
- **CORS 白名单**:仅允许配置的 origin
- **Helmet 安全头**:`X-Content-Type-Options` / `X-Frame-Options` / `Strict-Transport-Security` / `Content-Security-Policy`
- **CSRF 防护**:SameSite Cookie + 双 token(`apps/api/src/plugins/csrf.ts`)
- **SQL 注入防护**:Drizzle ORM 全参数化查询,禁止字符串拼接
- **HMAC-SHA256 Webhook 验签**:对外 webhook 全部签名验证(`apps/api/src/utils/crypto.ts`)

### 守门脚本(Pre-commit Gatekeepers)

项目内置 30+ 个 pre-commit 守门钩子(见 [`docs/GATEKEEPERS.md`](docs/GATEKEEPERS.md)),包括但不限于:

- API key 泄露检测(`scripts/check-api-routes.mjs`)
- i18n 键完整性校验(`scripts/check-i18n-keys.mjs`)
- 路由一致性 / 权限校验(`scripts/check-api-routes.mjs`)
- IDOR 检测
- TypeScript 类型回退检测
- Python mypy 类型检查(`scripts/check-mypy.mjs`)
- 安全配置漂移检测

### 审计日志(Audit Log)

- 所有敏感操作(登录 / 权限变更 / 数据导出 / 删除)写入 `audit_log` 表
- 审计日志不可篡改(append-only + 哈希链)
- 见 [`apps/api/src/plugins/audit.ts`](apps/api/src/plugins/audit.ts) + [`docs/MONITORING.md`](docs/MONITORING.md)

---

## 安全更新发布(Security Update Releases)

- **Critical / High**:发布专门的 Patch Release(如 `v0.2.1`),在 GitHub Release 描述中附 Security Advisory 链接
- **Medium / Low**:合入下一个常规 Release
- **CVE 申请**:Critical 漏洞修复后,我们会通过 GitHub Security Advisory 申请 CVE 编号
- **公告渠道**:GitHub Release Notes + Discussions 公告 + (Critical 时)`security@aizhs.top` 邮件列表通知

---

## 软件供应链(Supply Chain Security)

- **依赖锁定**:`pnpm-lock.yaml` 提交到仓库,所有依赖版本固定
- **依赖审计**:`pnpm audit --prod` 在 CI 中运行,High/Critical 漏洞阻塞合并
- **SBOM**:每个 Release 附带 SBOM(Software Bill of Materials),见 Release Assets
- **签名**:Release assets 使用 sigstore 签名(规划中)
- **CodeQL**:GitHub CodeQL 自动扫描(见 `.github/workflows/ci.yml`)

---

## 反馈与改进

如对本安全策略有建议,请通过 `security@aizhs.top` 提出,或开一个非敏感的 GitHub Discussion 讨论(请勿在公开渠道讨论具体漏洞细节)。

---

**安全是全员责任。每一位贡献者都是 IHUI-AI 安全防线的守护者。**
