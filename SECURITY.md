<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 安全策略(Security Policy)

## 支持版本(Supported Versions)

IHUI-AI 是积极开发中的开源项目,仅对最新主版本提供安全更新:

| 版本       | 支持状态    | 备注                |
| ---------- | ----------- | ------------------- |
| `v0.2.x`   | ✅ 安全更新 | 当前开发分支        |
| `< v0.2.0` | ❌ 不支持   | 早期实验版本,请升级 |

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

| 阶段     | 时间窗                                                         | 维护者动作                                              |
| -------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| 确认收到 | 48 小时内                                                      | 回复邮件确认收到,分配漏洞编号 `IHUI-SEC-YYYY-NNN`       |
| 初步评估 | 5 个工作日内                                                   | 评估严重性(Critical / High / Medium / Low),回复评估结论 |
| 修复发布 | Critical 7 天内 / High 14 天 / Medium 30 天 / Low 下个 release | 在私有分支修复,通过 Release 部署补丁                    |
| 公开披露 | 修复发布后 90 天(或与报告者协商的协调披露窗口)                 | 发布 Security Advisory + CVE 申请                       |

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

## 机器凭据泄露与吊销(Machine Credential Leak & Revocation)

适用场景:开发者 API Key 的 `secret`、OAuth `client_secret`、或 Webhook 签名密钥
**已经出现在不该出现的地方**(提交进仓库、贴进日志、被前端回显、第三方工具读到)。

这一节与"报告漏洞"是两件事:上面的 SLA 针对**平台自身缺陷**;这里是**你自己凭据的事故处置**。
端点清单与存储纪律**只列本仓库内逐个核对过的实现**,每条带 `file:line`。

### 处置渠道(沿用本文件既有渠道,本节不新增渠道)

- 凭据泄露涉及平台侧缺陷(例如脱敏失效、响应回显了他人的 secret):按[报告漏洞](#报告漏洞reporting-a-vulnerability)
  走 `security@aizhs.top` 或 GitHub 私密报告(`SECURITY.md:28-29`),SLA 同上表。
- 仅你自己的密钥外泄、只需吊销动作:用下面任一自助端点即可,**无需**发信给维护者。

### 第一步:自助吊销 / 轮换 / 排查(已核对存在的端点)

`apps/api/src/routes/developer.ts` —— 注册前缀 `/api/developer`
(`apps/api/src/routes/index.ts:736`),全部端点需登录
(`apps/api/src/routes/developer.ts:98` 的 `requireAuth` preHandler):

| 方法     | 路径                                     | 作用                                             | 落点                                             |
| -------- | ---------------------------------------- | ------------------------------------------------ | ------------------------------------------------ |
| `GET`    | `/api/developer/api-keys`                | 列出当前用户全部密钥(排查面:先看有几把在外流通) | `apps/api/src/routes/developer.ts:101`            |
| `POST`   | `/api/developer/api-keys`                | **创建**新密钥;`secret` 明文仅此一次返回         | `apps/api/src/routes/developer.ts:108`(返回体 `:122`) |
| `PATCH`  | `/api/developer/api-keys/:id`            | **更新**权限/配额/有效期/状态                    | `apps/api/src/routes/developer.ts:138`            |
| `DELETE` | `/api/developer/api-keys/:id`            | 删除密钥                                         | `apps/api/src/routes/developer.ts:126`            |
| `GET`    | `/api/developer/api-keys/:id/usage`      | **用量查询**:调用次数 / 最近使用时间 / 热点端点(判断泄露后被人用了多少) | `apps/api/src/routes/developer.ts:158` |

`apps/api/src/routes/developer/` —— 同前缀 `/api/developer`
(`index.ts:1189` 分组、`index.ts:1249` Webhook),均 `requireAuth`
(`developer/api-key-groups.ts:95`;`developer/webhooks.ts:189`):

| 方法     | 路径                                                  | 作用                       | 落点                                        |
| -------- | ----------------------------------------------------- | -------------------------- | ------------------------------------------- |
| `GET`    | `/api/developer/api-key-groups`                       | 列出 Key 分组(共享额度池) | `developer/api-key-groups.ts:98`             |
| `POST`   | `/api/developer/api-key-groups`                       | 创建分组                   | `developer/api-key-groups.ts:118`            |
| `PATCH`  | `/api/developer/api-key-groups/:id`                   | 更新分组                   | `developer/api-key-groups.ts:231`            |
| `DELETE` | `/api/developer/api-key-groups/:id`                   | 删除分组                   | `developer/api-key-groups.ts:284`            |
| `GET`    | `/api/developer/api-key-groups/:id/members`           | 组内成员与子 Key 排行      | `developer/api-key-groups.ts:308`            |
| `POST`   | `/api/developer/api-key-groups/:id/invite`            | 邀请成员                   | `developer/api-key-groups.ts:336`            |
| `GET`    | `/api/developer/webhooks/subscriptions`               | 列出 Webhook 订阅          | `developer/webhooks.ts:192`                  |
| `POST`   | `/api/developer/webhooks/subscriptions`               | 新建订阅(签名密钥在此产生) | `developer/webhooks.ts:203`                  |
| `PATCH`  | `/api/developer/webhooks/subscriptions/:id`           | 更新订阅                   | `developer/webhooks.ts:226`                  |
| `DELETE` | `/api/developer/webhooks/subscriptions/:id`           | 删除订阅                   | `developer/webhooks.ts:257`                  |
| `GET`    | `/api/developer/webhooks/subscriptions/:id/logs`      | 投递日志(判断回调侧泄露) | `developer/webhooks.ts:275`                  |

**一处必须说明的事实**:本小节标题里的 **rotate(轮换)与吊销(revoke)在
`developer.ts` 和 `developer/` 下并不存在对应端点** —— 这两个文件里最接近的只有
`PATCH .../api-keys/:id` 改 `status`(`developer.ts:67` 的 `active|revoked` 枚举)与
`DELETE`(硬删)。真正的轮换/吊销 HTTP 端点在**中转站用户侧路由文件**里,已核对如下
(注册前缀 `/api`,`index.ts:1154`):

| 方法   | 路径                                     | 作用                                                     | 落点                                                  |
| ------ | ---------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------- |
| `POST` | `/api/developer/relay/keys/:id/reset`    | **轮换** secret(`rotateSecret`),新 secret 仅返回一次   | `apps/api/src/routes/developer-relay.ts:252`(服务调用 `:258`) |
| `POST` | `/api/developer/relay/keys/:id/revoke`   | **吊销**(`revokeKey`),单向迁移到 `status='revoked'`,幂等 | `apps/api/src/routes/developer-relay.ts:273`(服务调用 `:279`) |
| `GET`  | `/api/developer/relay/keys`              | 列出中转站 Key(含余额)                                 | `apps/api/src/routes/developer-relay.ts:150`           |
| `GET`  | `/api/developer/relay/usage`             | **用量查询**(聚合)                                     | `apps/api/src/routes/developer-relay.ts:289`           |
| `GET`  | `/api/developer/relay/logs`              | 调用日志明细                                             | `apps/api/src/routes/developer-relay.ts:382`           |

兼容路由另有一处:`POST /api/developer/keys/:id/reset`
(`apps/api/src/routes/other/developer-routes.ts:62`,经 `other/index.ts:60` +
`routes/index.ts:997` 挂载)。吊销的语义说明见
`apps/api/src/routes/developer-relay.ts:270-272`:吊销后配额校验
(`status !== 'active'`)立即拒绝,但 `llm_call_logs` 的关联记录**保留**(审计不随凭据消失)。
底层服务函数:`apps/api/src/services/developer-api-keys-service.ts:304`(`revokeKey`)、
`:328`(`rotateSecret`)。

### 第二步:既有纪律(为什么"泄露"通常不等于"库已泄密")

以下四条是仓库里已实现的机制,决定了泄露事件的**影响半径**:

- **开发者 API Key secret 以 sha256 摘要存储**,不是明文:
  `apps/api/src/utils/api-key-hash.ts:23-25`(`sha256:<64 hex>`)。
  明文只在**创建 / 轮换那一次**出现在响应里
  (`apps/api/src/routes/developer.ts:122`、`developer-relay.ts:260-262`)。
  选型理由与"高熵随机串故用 sha256 而非 bcrypt"见
  `apps/api/src/utils/api-key-hash.ts:8-12`;校验走**恒定时间**比较以防时序侧信道
  (`apps/api/src/utils/api-key-hash.ts:43-48`)。
  Key 的公开标识 `ihui_<24 hex>` 与 secret `sk_<32 hex>` 的分工见
  `apps/api/src/utils/api-key-hash.ts:55-59`。
- **日志侧脱敏**:`apps/api/src/plugins/log-sanitizer.ts:55` 在 `onRequest` 阶段
  用 Proxy 包装 `request.log`(`:25-33`),各日志级别入参先递归脱敏再落盘,
  因此把带凭据的对象交给 `logger` 不会写出明文。
- **响应侧脱敏**:`apps/api/src/plugins/response-sanitizer.ts:26-35` 定义敏感字段名集合
  (`password` / `phone` / `idcard` / `bankcard` / `email` / `token` / `secret` / `apikey`),
  子串包含 + 大小写不敏感匹配(`:19-20`),命中即掩码(`:47,:91`)。
  计量字段 `prompt_tokens` / `completion_tokens` / `total_tokens` 因含 `token` 子串
  被列入 `SAFE_KEYS` 白名单豁免(`:41-45`)。
  唯一显式放行口是 `request.skipResponseSanitization`(`:458`),仅用于上面
  "新 secret 必须明文返回一次"的场景 —— 这是"明文只出现一次"的前提,不是脱敏失效。
- **`oauth_apps` 的 secret 同样不以明文为真相**:列为
  `client_secret` + `client_secret_hash`
  (`packages/database/src/schema/oauth.ts:34,41`)。**注意**:schema 注释把该摘要描述为
  bcrypt(cost=12)(`packages/database/src/schema/oauth.ts:36-39`),但新注册 / DCR
  路径实际写的是 **HMAC-SHA256 + 每客户端随机 salt** 的 `v1hmac$<salt>$<digest>` 形态
  (`packages/auth/src/oauth2.ts:634,644-650`);bcrypt `$2*` / argon2 `$argon2*` 仅作为
  **存量摘要**被识别并交由 apps/api 侧 verifier 校验
  (`packages/auth/src/oauth2.ts:680,694-697`;`apps/api/src/routes/auth-extended.ts:209-211,233`)。
  做事故通报时请按"摘要不可逆投"表述,**不要**照抄"bcrypt"这一句。
- **审计不读凭据原文**:`apps/api/src/plugins/audit-logger.ts:251` 明确只取身份字段,
  **绝不**读 `request.apiKey.key`(落库即等同密钥泄露)。

### 你应当预期到的边界(不粉饰)

- **不存在**集中式"泄露事件上报"端点:仓库内只有面向 IP 信誉的
  `POST /api/security/report`(见 `docs/developer/compliance.md` 第 2 节),它不产生工单。
- **不存在**按泄露 secret 反查受影响调用记录的对客端点;`llm_call_logs` 的
  `apiKeyId` / `clientIp` 归因列保留,但清除器只清正文两列
  (`apps/api/src/services/audit-log-service.ts:452-454,491`),对外无读回接口。
- **不存在**凭据泄露的专门 SLA;`SECURITY.md:41-48` 的时限只针对漏洞报告。
- 自助吊销依赖登录态。若泄露方已同时掌握你的账号口令,请按漏洞报告走
  `security@aizhs.top`,并要求管理员侧处置。

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

## 运行时能力与数据披露(Runtime Capability & Data Disclosure)

本文件讲的是"我们做了什么防护"。下面这份文档讲的是**反面视角**——产品在你的机器上
**实际能做什么、数据实际去了哪里、哪些东西在你不在场时自动执行**,并且逐条给出
`文件路径:行号` 取证:

- **[`docs/runtime-capability-disclosure.md`](docs/runtime-capability-disclosure.md)**

两份文档口径若发生冲突,**以代码与披露文档为准**;披露文档里明确标注了
「未验证」的条目表示我们尚未取证,不代表已确认安全。若你发现其中某条与代码不符,
那属于本文档缺陷,请按下面的渠道报告(与漏洞同级别对待)。

该文档特别需要读者留意的三类事实(不是我们的宣传,是取证结论):

1. 权限模式里**没有任何一档是"永远要确认"的子集**;`IHUI_YOLO` 与服务端
   `DANGEROUS_COMMAND_BLOCKED=false` 会连危险命令硬门整条跳过。
2. OS 级文件隔离在 CLI 侧**默认关闭**;各后端在降级链上的真实强度、
   以及 macOS 后端"全盘可读"、bwrap `denyPaths` 是 tmpfs 遮蔽而非读取屏蔽,都写在里面。
3. `ai-service` 的 `run_command` 是在**跑 ai-service 的那台机器**上执行,
   而 `computer_*` 是在**用户自己的桌面机**上做操作系统级鼠标键盘注入且端上无二次确认。

### 报告渠道

与本文其余部分一致:首选 `security@aizhs.top`,或 GitHub Private vulnerability reporting
(见上文「[报告漏洞](#报告漏洞reporting-a-vulnerability)」的 SLA 与致谢条款)。
**运行时能力披露文档中的不实陈述或遗漏,同样按漏洞受理。**

### 周期性代码审计的公开节奏(承诺)

自本确立即生效,节奏为**每季度一次**,每年 4 次:

| 项 | 承诺内容 |
| --- | --- |
| 频次 | 每季度一轮,滚动覆盖 8 端 + `packages/` 共享层(每轮至少覆盖 2 端 + 1 个共享包,一年内全部覆盖一遍) |
| 每轮产出 | 公开一份审计纪要:本轮**逐条核对了哪些论断**、**证伪了哪些**、**新增/摘除了哪些防线**、**残余未验证清单** |
| 落点 | 纪要追加进 `docs/runtime-capability-disclosure.md` 的「修订记录」,并在 `SECURITY.md` 本节登记日期与轮次 |
| 触发式加审 | 任何一次涉及沙箱、鉴权面、出站目标、自动执行链的架构变更,不等季度节奏,当次即复核并更新披露 |
| 违约口径 | 若某轮未按期公开,请在纪要中如实记一次缺席并说明原因;**不允许**用"内部已审过"替代公开产出 |

**当前状态(如实登记)**:上述节奏自本次起确立,**尚未产生任何一期季度纪要**。
首轮纪要的目标区间为下一个自然季度。在此之前,本文档的取证快照日期见其开头声明。

---

## 反馈与改进

如对本安全策略有建议,请通过 `security@aizhs.top` 提出,或开一个非敏感的 GitHub Discussion 讨论(请勿在公开渠道讨论具体漏洞细节)。

---

**安全是全员责任。每一位贡献者都是 IHUI-AI 安全防线的守护者。**
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
