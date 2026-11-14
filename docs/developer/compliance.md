<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 合规口径(Compliance)

> 面向第三方 Agent 开发者,也面向需要向审计方/法务方解释平台行为的接入方。
> 本文的铁律是**只写仓库里真实存在的东西**:每条断言带 `file:line`;
> 代码里不存在的机制一律标"**待补**"或"**暂无**",不编造邮箱、表单 URL 或留存承诺。
> 与 [data-classes.md](./data-classes.md) 的接缝:那篇讲"调用留下什么归因",
> 本文第 4 节讲"这些归因里的正文能存多久、怎么消失"。

## 1. 范围与诚实前提

| 项               | 口径                                                                        |
| ---------------- | --------------------------------------------------------------------------- |
| 本文治理对象     | 开放面产生的**调用记录与正文**、对外可见的**发现文档**、以及**受理外部主张的渠道** |
| 单一事实源       | 代码与 migration,不是任何一份承诺文本                                       |
| 平台性质         | 中间件/能力后端。生成结果的发布与传播责任在**调用方**                        |
| 版权/联系主体    | `package.json:98` author 为 `李春川 (Li Chunchuan) <IHUI AI (智汇AI)>`,`package.json:102` homepage 为 `https://aizhs.top` |
| 运营主体名称     | `吉林省李氏数字文化有限公司`(成立于 2024 年 12 月)—— 仅出现在小程序端隐私政策正文 `apps/miniapp-taro/src/pkg-about/about/privacy.tsx:515`,根 `package.json` 内**没有**独立法务主体字段 |

## 2. 真实存在的受理与举报渠道

下表每一项都在仓库里可定位。**注意用途边界**:它们是"通报/举报"入口,
不是"侵权通知"入口(第 3 节说明为什么)。

| 渠道                                  | 用途                                       | 认证要求           | 落点                                                                |
| ------------------------------------- | ------------------------------------------ | ------------------ | ------------------------------------------------------------------- |
| `security@aizhs.top`                  | 安全漏洞披露(**勿在公开渠道披露细节**)   | —                  | `SECURITY.md:28`(`SECURITY.md:26` 明确禁止公开渠道)                |
| GitHub 私密漏洞报告                   | 同上,走 Private vulnerability reporting  | GitHub 账号        | `SECURITY.md:29`(URL 即文件内所写)                                 |
| `security@aizhs.top` + 主题 `[PGP-KEY-REQUEST]` | 索取 PGP 公钥做加密通报             | —                  | `SECURITY.md:30`                                                    |
| `community@aizhs.top`                 | 上述 SLA 超期后的升级提醒                  | —                  | `SECURITY.md:50`                                                    |
| `conduct@aizhs.top`                   | 行为准则违规举报(骚扰/辱骂等)            | —                  | `CODE_OF_CONDUCT.md:57`、`:103`;`CONTRIBUTING.md:17`(48 小时响应) |
| `POST /api/security/report`           | **上报可疑活动(IP 维度)**,匿名可用      | 无认证,同 IP ≤5 次/分钟 | 处理体 `apps/api/src/routes/security.ts:181-212`;限流常量 `:236`、判定 `:250,:256`;前缀注册 `apps/api/src/routes/index.ts:1123` |
| `POST /api/feedbacks`                 | 产品反馈(bug/feature/improvement/other)  | 需登录             | `apps/api/src/routes/comments.ts:416-418`;插件级统一鉴权 `:91-95`;前缀 `apps/api/src/routes/index.ts:517` |
| App / 小程序内反馈入口 + 书面地址     | 隐私政策自陈的投诉举报方式                 | —                  | `apps/miniapp-taro/src/pkg-about/about/privacy.tsx:495`(投诉/举报声明)、`:499`(站内反馈入口)、`:504`(书面地址) |

`POST /api/security/report` 的后端语义(便于你判断它能不能承载你的举报):
它把事件写进 **IP 信誉**(`ipRep.recordBadEvent(reportIp, 'user-report:<type>')`,
`apps/api/src/routes/security.ts:194`)并在成功登记时写入一条
`score: 50` / `recommendation: 'monitor'` 的异常事件
(`apps/api/src/routes/security.ts:196-207`)。也就是说它**只作用于 IP 信誉**,
不产生工单、不产生人可读的通知、不保证有人回。

## 3. 侵权 / DMCA 通知受理渠道:**公开受理渠道待补**

诚实结论:**仓库里不存在 DMCA / 侵权(IPR)takedown 的专用受理渠道。** 逐条核查记录:

| 核查项                                       | 结果                                                                       |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| 全仓检索 `dmca` / `takedown` / `counter-notice` | 在 `apps/**`、`packages/**`、`docs/**` 的代码与文档中**命中 0**;唯一命中是 `PROJECT_PLAN.md:143` 把"滥用政策/DMCA"列为**未勾选的待办任务**(`- [ ] O16 治理`) |
| `apps/api/src/routes` 下的投诉/举报路由      | 只有 `POST /api/security/report`(可疑活动,IP 维度,`apps/api/src/routes/security.ts:181`)与 `POST /api/feedbacks`(产品反馈,需登录,`apps/api/src/routes/comments.ts:417`)。**两者都不是侵权通知受理面** |
| 通知应包含的要件(权利人身份/权属证明/具体位置/善意声明/签名) | **无任何实现**:没有对应表、没有对应端点、没有对应工单类型                 |
| 反通知(counter-notice)与恢复流程             | **无任何实现**                                                             |
| 受理时限承诺                                 | **无**。`SECURITY.md:41-48` 的 SLA 表只覆盖**安全漏洞**,不覆盖侵权主张     |
| 现成的受理邮箱                               | 仓库内公开披露的通报邮箱只有 `security@aizhs.top` / `community@aizhs.top`(`SECURITY.md:28,50`)与 `conduct@aizhs.top`(`CODE_OF_CONDUCT.md:57`)。这些是**安全/社区**渠道,把它们当 DMCA 入口使用属于误用,本文不做此等推荐 |

一处**容易被误读成"已有侵权通道"**的文本:小程序隐私政策结尾写道"如果有其他侵权的因素,
请通知智汇社进行删除"(`apps/miniapp-taro/src/pkg-about/about/privacy.tsx:515`),
但同节给出的联系方式只有站内反馈入口与书面地址(`:499`、`:504`),
**没有**侵权通知专用的邮箱、表单或处置时限。这是一句声明,不是一条通道。

**因此**:若权利人要就平台生成/分发的内容提出侵权主张,当前**只能借第 2 节的通用通报渠道**
(`security@aizhs.top` 或登录后的 `POST /api/feedbacks`),并且**平台侧没有承诺受理时限、
没有承诺处置动作、没有反通知通道**。补齐这一节的最小落地项列在第 6 节。

## 4. 数据留存与清除口径(正文级)

这是平台**唯一**成体系的、已接线的留存治理。全部结论来自代码,不是政策文本。

### 4.1 留存什么

`llm_call_logs` 是开放面调用的计费/审计流水。它存的字段分两类:

| 类别       | 代表列                                        | 是否受清除影响                                                                  |
| ---------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| 归因与计量 | `userId` / `apiKeyId` / `clientIp` / token 计数 / 成本 / 状态 | **永不清除** —— 列定义 `packages/database/src/schema/llm-call-logs.ts:40,61,69`,清除语句只动正文列(见 4.3) |
| **正文**   | `prompt`(请求原文)、`response`(响应原文)   | 按下面的策略到期清除                                                            |
| 留存控制列 | `raw_retention_days` / `raw_retained` / `raw_purged_at` | `packages/database/src/schema/llm-call-logs.ts:91,93,95`                        |

三列由迁移 `packages/database/drizzle/20260921130000_llm_call_logs_raw_retention.sql`
落库(`:31-33` 三条 `ADD COLUMN IF NOT EXISTS`,全部向后兼容;列语义注释 `:35-40`)。

### 4.2 留存多久:默认 30 天

| 项              | 值 / 语义                                                                                     | 落点                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 全局默认天数    | **30 天**(代码常量,非文档口径)                                                               | `apps/api/src/services/audit-log-service.ts:352` `DEFAULT_RAW_RETENTION_DAYS = 30` |
| 环境变量覆盖    | `LLM_CALL_LOG_RAW_RETENTION_DAYS`(非负整数;非法/空/负数回落 30)                              | 解析函数 `audit-log-service.ts:383-397`,兜底逻辑 `:367-375,:391`           |
| **按 key 关闭写入即零原文** | `LLM_CALL_LOG_RAW_RETENTION_DISABLED_KEY_IDS` 填具体 key id(逗号分隔)→ 该 key 的行**根本不落正文**;填 `*` → 全量关闭 | 解析 `audit-log-service.ts:386-390,:396`;判定与写回 `buildRawTextColumns()` `:429-437`(关闭时 `prompt=''`、`response=NULL`、`rawRetained=false`) |
| 入口侧生效位置  | 计费落库**前**调用,因此"关闭"是"永不落盘"而不是"迟到清除"                                    | `apps/api/src/services/relay-billing-service.ts:57`(导入)、`:1117`(调用) |
| 单行覆盖        | `llm_call_logs.raw_retention_days`,`NULL` = 落全局默认;`0` = 本行不留存                      | `packages/database/src/schema/llm-call-logs.ts:88-91`                       |
| 生效优先级      | 全量关闭(`*`)> 行内显式值 > 全局默认                                                        | `audit-log-service.ts:400-406` `effectiveRetentionDays()`                   |

关于配置位置的一个**易踩坑事实**:`LLM_CALL_LOG_RAW_RETENTION_DAYS` **不在**
`apps/api/src/config/index.ts` 里。全仓检索该变量名的读取点只有
`apps/api/src/services/audit-log-service.ts:391`,源码注释说明了理由 ——
"纯函数,便于单测;不读 config 是为了不改 config/index.ts"
(`apps/api/src/services/audit-log-service.ts:379-382`)。
按 `config/index.ts` 去找这个键会一无所获。

为什么默认 30 而不是 0,源码与迁移注释给了同一个理由:**保留失败复现能力**
(排障要看真实请求),同时把"永久留存"收敛为"有期限"
(`apps/api/src/services/audit-log-service.ts:347`;
`packages/database/drizzle/20260921130000_llm_call_logs_raw_retention.sql:20-23`)。

### 4.3 怎么清除:每日定时批次

| 项        | 事实                                                                          |
| --------- | ------------------------------------------------------------------------------ |
| 任务名    | `llm-call-log-purge-daily`                                                     |
| 注册      | `apps/api/src/plugins/scheduler.ts:46`(任务名枚举)、`:169-173`(定义)        |
| cron      | `15 4 * * *` → **每日 04:15**(`apps/api/src/plugins/scheduler.ts:171`)       |
| 选点理由  | 错开 `data-archive-daily`(04:30)与 `alert-check-daily`(04:00),且早于二者   |
| 落点      | `apps/api/src/plugins/scheduler.ts:164-167`                                    |
| 执行      | `apps/api/src/workers/scheduler-worker.ts:589-596` 调 `purgeAllExpiredLlmCallLogRawText()`(`apps/api/src/services/audit-log-service.ts:516`),循环到 `hasMore=false` |
| 到期判据  | `created_at < now() - COALESCE(raw_retention_days, defaultDays) * interval '1 day'` → `apps/api/src/services/audit-log-service.ts:477` |
| 清除动作  | `SET prompt = '', response = NULL, raw_retained = false, raw_purged_at = now()` → `apps/api/src/services/audit-log-service.ts:491` |
| 并发安全  | `FOR UPDATE SKIP LOCKED` + 单批上限 `DEFAULT_PURGE_BATCH = 500`,与在线计费写入互不阻塞 → `apps/api/src/services/audit-log-service.ts:497`、`:355` |
| 幂等      | 谓词带 `raw_retained = true`(`apps/api/src/services/audit-log-service.ts:486`),重复执行 0 行受影响 |
| 失败处置  | 表未建/权限不足/迁移未跑 → 降级告警不抛出,不打断定时任务 → `apps/api/src/services/audit-log-service.ts:504-510` |

三条**必须知道**的口径细节:

1. **清除只动正文两列**,token 计数、成本、状态、`apiKeyId` 全部保留 ——
   计费与"哪把 key 调了哪个模型"的归因不受影响
   (`apps/api/src/services/audit-log-service.ts:452-454`)。
   也就是说:**"原文没了"不等于"这条调用查不到了"。**
2. `raw_retention_days = 0` 的行**不是**同一批次立刻清除 —— 同事务刚插入的行
   `created_at = now()` 不满足严格小于,要等下一轮
   (`apps/api/src/services/audit-log-service.ts:474-476`,注释明写这是有意的边界取舍)。
   要真正"零原文",用 4.2 的入口侧关闭(`buildRawTextColumns()`),而不是依赖清除器。
3. 站内会话与开放面**都不在审计日志里落 prompt 正文**(审计记的是形状摘要);
   本节治理的是 `llm_call_logs` 表自身存的那两份原文
   (`apps/api/src/services/audit-log-service.ts:343-346`)。

### 4.4 凭据侧的留存:不存在"原文可被清"这回事

平台的取向是**根本不落凭据明文**,而不是"存了再定期清":

| 凭据类型              | 存储形态                                                     | 落点                                                          |
| --------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| 开发者 API Key secret | `sha256:<64 hex>` 摘要,明文仅创建/轮换那一次返回             | `apps/api/src/utils/api-key-hash.ts:23-25`;生成规则 `:55-59`   |
| 校验方式              | 摘要比对走**恒定时间**比较(抗时序);过渡期兼容老明文          | `apps/api/src/utils/api-key-hash.ts:31-33,43-48`               |
| OAuth client_secret(新注册 / DCR) | `v1hmac$<saltHex>$<digestHex>`,HMAC-SHA256 + 每客户端随机 salt | `packages/auth/src/oauth2.ts:634,644-650`                      |
| OAuth client_secret(存量)         | 按前缀识别 bcrypt `$2*` / argon2 `$argon2*` 形态摘要,交给 apps/api 侧 verifier | `packages/auth/src/oauth2.ts:680,694-697`;`apps/api/src/routes/auth-extended.ts:209-211,233` |
| `oauth_apps` 列       | `client_secret` + `client_secret_hash`                        | `packages/database/src/schema/oauth.ts:34,41`                  |

**一处必须纠正的常见误解**:`oauth_apps.client_secret_hash` 的 schema 注释把它描述为
"bcrypt 哈希(cost=12)"(`packages/database/src/schema/oauth.ts:36-39`),
但**新注册路径实际写的是 HMAC-SHA256 摘要(`v1hmac$`)** —— 理由是 client_secret 是
高熵随机串、不存在离线字典攻击面,故不引 bcryptjs 进 `@ihui/auth`
(`packages/auth/src/oauth2.ts:637-642,644-650`)。bcrypt/argon2 只作为**存量摘要**被接受。
因此"oauth 密钥是 bcrypt 哈希"这一句在合规问卷里**不能照 schema 注释抄**。

同理,开发者 API Key 用 sha256 而非 bcrypt 也有显式理由:
"API key 是高熵随机串(非低熵用户密码),sha256 足够且可索引"
(`apps/api/src/utils/api-key-hash.ts:8-12`)。

另注:`packages/auth/src/oauth2.ts:696` 注释指向的 `verifyClientSecretWithLegacyHashes`
在仓库中**并不存在**为函数(全仓检索仅此一处注释)—— 实际承担该职责的是
`matchesOAuthAppSecret`(`apps/api/src/routes/auth-extended.ts:233`)。注释陈旧,代码可用。

## 5. 对外发现面不返回内网主机与密钥

平台有两处"可被匿名抓取"的出口:**A2A 发现文档**与 **MCP export 传输层**。
两者的设计目标一致:让陌生 agent 能发现能力,但**不成为内网拓扑与密钥的放大器**。

### 5.1 A2A Agent Card(`/.well-known/agent.json`)

| 项          | 事实                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------ |
| 卡片内容    | 只有「能力/契约」级信息(skills、模式、安全方案名),**不含内网主机、端口、密钥** | `apps/ai-service/app/services/agent_card.py:17-19`(`不泄露` 设计约束原文) |
| 对外基址推导 | `resolve_public_base_url()` 从请求 Host 或配置白名单域名推导,复用 `mcp_export` 同一套 Host 判定函数,**不新写逻辑** | `apps/ai-service/app/services/agent_card.py:287-307`(导入白名单函数 `:298-302`) |
| **关键约束:Host 白名单** | Host **未通过**白名单且未配置公网域名时 → 抛 `PublicBaseUrlError`,**不得回落成请求头里的任意 Host**(否则就成了内网主机/端口的放大器);白名单也为空即拒绝猜测,由路由层 403 | `apps/ai-service/app/services/agent_card.py:81-90`、规则注释 `:290-295`、抛出点 `:307` |
| 回显卫生    | 校验通过后才决定是否回显原始 Host;含非法字符的值只回显已校验的主机部分(`_SAFE_HOST_RE` 约束域名/IPv4/带方括号 IPv6 + 单一端口) | `apps/ai-service/app/services/agent_card.py:276-284`         |
| 匿名放行登记 | 两个发现路径写进 `settings.jwt_public_paths`,否则(配了 JWT_SECRET 的)生产环境匿名抓取会 401 | `apps/ai-service/app/core/config.py:108,117-119`             |

### 5.2 MCP export 与内网 principal

| 项            | 事实                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Host 白名单   | 回环始终放行;非回环主机必须**显式登记**(精确匹配主机名,不做子域通配)。代码默认值已含生产域 `aizhs.top / www.aizhs.top / mcp.aizhs.top`,可用 `MCP_EXPORT_ALLOWED_HOSTS` 覆盖 | `apps/ai-service/app/core/config.py:129-134` |
| 复用关系      | Agent Card 的 Host 判定直接复用 `mcp_export` 的 `validate_request_host` / `allowed_request_hosts` / `request_host_of` | `apps/ai-service/app/services/agent_card.py:17-19,298-302` |
| API Key 不能直连 ai-service | 明确提示"请调用 apps/api 的 `/v1/mcp/*` 网关(由其对 key 校验并签发内网 `X-IHUI-Principal` 头转发)" | `apps/ai-service/app/services/capability_gate.py:89-91` |
| principal 头  | HMAC-SHA256(密钥 `ihui_principal_secret`,回退 `ai_callback_secret`),payload 只含 `{sub,role,scopes[],apiKeyId?,exp}` | `apps/ai-service/app/services/capability_gate.py:15-18,186,198-209` |
| 密钥缺失时    | 两个密钥都为空 → **拒绝内网头**(而不是信任裸头)                       | `apps/ai-service/app/services/capability_gate.py:264-267`     |
| 时钟偏移      | `exp` 校验容忍 5s(`CLOCK_SKEW_TOLERANCE_S`)                             | `apps/ai-service/app/services/capability_gate.py:81-82`       |

### 5.3 日志与错误响应同样不落凭据

| 落点                                            | 事实                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/api/src/plugins/log-sanitizer.ts:25-33`   | 用 Proxy 包装 `request.log`,各日志级别入参先递归脱敏                  |
| `apps/api/src/plugins/log-sanitizer.ts:55`      | 挂载点:`onRequest` 阶段                                                  |
| `apps/api/src/plugins/response-sanitizer.ts:26-35` | 敏感字段名集合:`password` / `phone` / `idcard` / `bankcard` / `email` / `token` / `secret` / `apikey`(子串包含、大小写不敏感 `:19-20`) |
| `apps/api/src/plugins/response-sanitizer.ts:41-45` | 白名单 `SAFE_KEYS` 只豁免 `prompt_tokens`/`completion_tokens`/`total_tokens`(它们含 `token` 子串会被误伤计量字段) |
| `apps/api/src/plugins/response-sanitizer.ts:47,91` | 命中即按策略替换,短值整体替换为 `***`                                |
| `apps/api/src/plugins/audit-logger.ts:251`      | 审计**绝不**读 `request.apiKey.key`(凭据原文,落库等同密钥泄露)      |

一个**必须知道**的例外:创建/轮换 secret 的响应显式设
`request.skipResponseSanitization = true`,否则新 secret 会被脱敏成 `***` 而不可用
(`apps/api/src/routes/developer.ts:120-122`、
`apps/api/src/routes/developer-relay.ts:260-262`、
`apps/api/src/routes/other/developer-routes.ts:67-68`)。放行判定在
`apps/api/src/plugins/response-sanitizer.ts:458`。这是"明文只出现一次"的实现前提,
不是脱敏失效。

## 6. 待补清单(代码里不存在,本文不粉饰)

| #  | 缺口                                             | 现状口径                                                                 |
| -- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| 1  | DMCA / 侵权通知的**公开受理渠道**                | **待补**:无专用邮箱、无表单端点、无受理要件校验                          |
| 2  | 侵权通知的**处置时限承诺**与反通知(counter-notice) | **暂无实现**:无工单类型、无状态机;`SECURITY.md:41-48` 的 SLA 仅限安全漏洞 |
| 3  | 面向被处置凭据持有者的**自助申诉/复核通道**      | 暂无(详见 [abuse-policy.md](./abuse-policy.md))                          |
| 4  | `/v1` 开放生成面的**强制**内容过滤               | 未接入(`apps/api/src/routes/v1-public.ts` 内敏感词调用点命中数为 0);站内 UGC 才有过滤,调用方需自接 `POST /v1/moderations`(`apps/api/src/routes/v1-rerank-moderations.ts:129,244`) |
| 5  | `llm_call_logs` 归因列(`apiKeyId`/`clientIp`/token 计数)的到期清除 | 暂无 —— 清除器**只**动正文两列(`apps/api/src/services/audit-log-service.ts:452-454,:491`) |
| 6  | 原文清除结果的对外可查询接口                     | 暂无:`raw_purged_at` 只在库内(`packages/database/src/schema/llm-call-logs.ts:95`),开发者侧无端点读回 |
| 7  | 根 `package.json` 缺少独立法务/受理联系字段      | 暂无:对外只有 `author`(`:98`)与 `homepage`(`:102`),运营主体名称只在小程序隐私政策正文 `apps/miniapp-taro/src/pkg-about/about/privacy.tsx:515` |
| 8  | `packages/auth/src/oauth2.ts:696` 注释指向的 `verifyClientSecretWithLegacyHashes` | 该函数名不存在,真实实现是 `matchesOAuthAppSecret`(`apps/api/src/routes/auth-extended.ts:233`);注释陈旧,属文档债 |

## 7. 相关文档

- 红线行为与吊销/封禁手段:[abuse-policy.md](./abuse-policy.md)
- 数据分级与"开放功能不开放数据":[data-classes.md](./data-classes.md)
- 能力目录与不开放 scope 清单:[capabilities.md](./capabilities.md)
- 速率与配额:[rate-limits.md](./rate-limits.md)
- 错误码:[error-codes.md](./error-codes.md)
- 机器凭据泄露与吊销操作面:[SECURITY.md](../../SECURITY.md)(仓库根)
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
