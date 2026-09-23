<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 滥用红线与处置(Abuse Policy)

> 面向第三方 Agent 开发者。本文只写**代码里真实存在的处置手段**,每条都带落点。
> 结论先行:平台当前的处置能力全部是**凭据级 + IP 级 + 窗口级**的自动化闸门,
> 外加管理员手工封禁;自助解除**只覆盖 IP 自动封禁**(人机验证),按 key 与账号的处置
> 仍**没有"人工审核工单→恢复"的自助申诉链路**(见第 6 节)。
> 能力清单与红线 scope 见 [capabilities.md](./capabilities.md) 第 4 节与
> [data-classes.md](./data-classes.md) 第 7 节,本文不重复,只讲"踩了会怎样"。

## 1. 判定原则

| 原则        | 含义                                                                    | 落点                                                     |
| ----------- | ----------------------------------------------------------------------- | -------------------------------------------------------- |
| 默认拒绝    | scope 未登记 / `dataClass=platform` / `thirdPartyEligible=false` → 403   | `apps/api/src/utils/capability-guard.ts:160-179`          |
| 凭据归属人  | 机器调用不得脱离归属用户持有数据                                         | `apps/api/src/utils/open-capability-gate.ts:53-59`        |
| fail-close  | 限流后端不可用且请求属 billable/非低危 → 503,而不是"当作没有限制"       | `apps/api/src/plugins/api-key-auth.ts:145-170,184-193`    |
| 通配不收窄  | `'*'` 只覆盖"已登记且 `isM2MAllowed`"的 scope,platform 域即使持 `'*'` 也 403 | `apps/api/src/plugins/api-key-auth.ts:1119-1137`      |
| share 不继承 | 分享 token 的有效 scope = 源 scopes ∩ thirdPartyEligible,`'*'` 不继承   | `apps/api/src/plugins/api-key-auth.ts:740-746`            |

## 2. 红线行为清单

下表的"当前拦得住吗"是**实测代码结论**,不是设计意图。差别很重要:拦不住的项一旦踩了,
处置依赖第 3 节的窗口/封禁闸门事后收敛。

### 2.1 批量注册 / 囤积 API Key

| 事实              | 结论                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------- |
| 创建入口          | `POST /api/developer/api-keys`(`apps/api/src/routes/developer.ts:108`,全族需登录 `:99`) |
| 单用户 Key 数量上限 | **暂无** —— `createKey()` 只做 `insert`,无任何计数或配额校验(`apps/api/src/services/developer-api-keys-service.ts:106-145`) |
| 创建入口自身限流   | 仅吃到全局 IP 桶 `@fastify/rate-limit`(生产 100 req/min/IP,`apps/api/src/server.ts:382-385`)与边缘 `api_zone`(`deploy/nginx/conf.d/rate-limit.conf:41`) |
| 可用额度是否随 Key 数量放大 | **不会** —— 计费与窗口按 key / 按用户收敛,见第 3 节                          |

诚实口径:**囤 key 目前不是被"禁止创建"挡住的,而是被"创建出来也没用"削弱的。**
`/v1` 面按凭据隔离的边缘配额是 `20r/s`(`deploy/nginx/conf.d/rate-limit.conf:60`),
Key 级窗口(5h/1d/7d)与余额熔断都挂在**单把 key**上;多把 key 只放大管理成本,不放大额度。

### 2.2 用 billable 能力刷额 / 套取额度

| 手段                | 判据                                                        | 落点                                                            |
| ------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| 能力目录 `billable` 标 | `billable: true` 的 scope 才计入收紧面                     | `packages/types/src/capability-catalog.ts:121` 起逐条登记        |
| 收紧面判定          | `entry.billable || entry.risk !== 'low'`,**不硬编码路由名** | `apps/api/src/plugins/api-key-auth.ts:184-193`                   |
| 额度熔断            | `token_balance` / `cost_balance_cents`,`-1` = 无限          | `packages/database/src/schema/developer-api-keys.ts:41-47`       |
| 小时/天配额         | `api_key_quotas.hourly_limit / daily_limit`(默认 1000/10000) | `apps/api/src/utils/api-key-quota.ts:36-37,144`                 |
| 限流后端挂掉时      | fail-close → 503 `RATE_BACKEND_UNAVAILABLE`(默认策略)       | `apps/api/src/plugins/api-key-auth.ts:118-133`                   |

要点:**刷额的前提是"有额度可刷"**。新建 key 默认余额 `-1`(无限),所以真正的兜底是
`deploy/nginx` 边缘速率 + Key 级窗口 + 平台侧发放额度,不是"检测到刷额自动停"。
**平台没有实现"异常消费自动熔断"这类专用检测器** —— 现有异常检测是 IP/行为维度(第 3.4 节),
不以"消费金额"为输入维度。

### 2.3 用 `tools/call` / `fetch_url` / `crawl_site` 探测内网(SSRF)

这是**拦截最硬**的一类,三层都在:

| 层          | 机制                                                                | 落点                                                                 |
| ----------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 工具准入    | `fetch_url` / `crawl_site` / `screenshot_url` 属 `_ADMIN_ONLY_TOOLS`,普通角色调用即拒 | `apps/ai-service/app/services/mcp_server.py:271-300`       |
| HTTP 面收敛 | `crawl_site`(递归爬取)**不在 HTTP 层开放**,只留管理员工具定位       | `apps/ai-service/app/routers/web_tools.py:9,50-56`                    |
| URL 校验    | 协议白名单仅 http/https;端口白名单 80/443/8080/8443/3000/8801;域名解析后逐个 IP 复检 | `apps/ai-service/app/services/screenshot_service.py:40-41,74-118`     |
| 内网判据    | private / loopback / link-local(含 `169.254` 云元数据) / reserved / unspecified / multicast 全拒;**无效 IP 按危险处理(fail-closed)** | `apps/ai-service/app/services/screenshot_service.py:51-71`            |
| 出口闸      | MCP export(SSE/streamable)Host 白名单,防 DNS rebinding             | `apps/ai-service/app/core/config.py:126-131`;裁决复用见 `apps/ai-service/app/services/agent_card.py:290-307` |
| API Key 直连 | API Key **不能**直连 ai-service,必须经 apps/api 的 `/v1/mcp/*` 网关换内网principal 头 | `apps/ai-service/app/services/capability_gate.py:89-91` |

已知**有意放行**的例外(不是漏洞,写清楚免得被误报):
`198.18.0.0/15` 基准测试段放行,因为它是 Clash/Surge fake-ip 默认段,拦掉会误杀全部公网 URL
(`apps/ai-service/app/services/screenshot_service.py:43-49,60-62`)。

`/v1/mcp/tools/call` 的对外网关在 `apps/api/src/routes/v1-mcp-gateway.ts:193`,
资源读在 `:260`,工具目录在 `:172`。工具级 scope 由 `capabilities.json` 的 `toolScopeMap` 裁决,
未登记工具直接 `TOOL_NOT_REGISTERED` 拒绝(`apps/ai-service/app/services/capability_gate.py:571-572`);
能力清单文件缺失时,外部凭据的 `tools/call` **一律拒绝**(fail-safe,`:22-25,561`)。

### 2.4 用生成能力分发违法 / 侵权内容

诚实口径:**开放生成面(`/v1/*`)当前没有内置的内容合规过滤器。**

| 事实                       | 结论                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------- |
| 敏感词过滤器               | `filterSensitiveContent()` / `sanitizeUgcInput()` 存在(`apps/api/src/db/sensitive-words-queries.ts:89,168`) |
| 实际接入面                 | **仅 UGC 面**:社区帖/问答/圈子/话题与评论(`apps/api/src/routes/community/*.ts`、`apps/api/src/routes/comments.ts:26`),以及注册链路(`apps/api/src/routes/auth-extended.ts:150`) |
| `/v1` 生成面是否接入       | **未接入** —— 在 `apps/api/src/routes/v1-public.ts` 中检索敏感词调用点为 0             |
| 平台提供什么               | 一个**能力**而不是强制闸:`POST /v1/moderations`(OpenAI 兼容,scope `moderation:write`),`apps/api/src/routes/v1-rerank-moderations.ts:128-129,242-244` |
| 后果                       | 违规内容的分发责任在调用方;平台侧的可追溯依据是第 5 节的调用审计与计费流水             |

即:**"能查"≠"会拦"**。把 `/v1/moderations` 当成平台替你做了审核是错的,它是给你自己接的。

### 2.5 抓取型调用绕开 `declareCapability` 迁移期端点

`declareCapability()` 的语义是**迁移期登记**:注入 `request.capability` 并拦截 platform 域,
但**不因缺少 scope 而 403**(`apps/api/src/utils/capability-guard.ts:182-198`)。

| 项                             | 现状                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| 仍使用 `declareCapability` 的  | 唯一剩余调用点:`apps/api/src/routes/v1-realtime.ts:744`(`realtime:connect`,WS 升级)      |
| 已被 O6 收口(登记→强制)的遗留族 | `apps/api/src/routes/other/v1-tools-routes.ts:18-25`、`other/v1-content-routes.ts:21`、`other/v1-customer-service-routes.ts:38` |
| 收口机制                       | 根级 `openCapabilityGateway` + 端点级 `requireOpenCapability`,路径→scope 映射取自登记表,不写第二份真相(`apps/api/src/utils/open-capability-gate.ts:14-27`) |
| 登记表                         | `apps/api/src/config/open-capability-registry.ts`(webhook 面示例 `:135-136`)              |

红线定义:**以"该端点暂不校验 scope"为前提,把抓取流量定向到迁移期端点来规避配额或数据隔离**。
处置口径与踩其它红线一致(第 3 节)。注意数据面不因"登记不强制"而放开:
`request.apiKey` + `request.capability` 双双就位后,数据闸 `isDataScopeEnforced` 自动接管
(`apps/api/src/utils/open-capability-gate.ts:27-29`)。

## 3. 处置手段(全部指向真实实现)

### 3.1 吊销凭据:`developer_api_keys.status = 'revoked'`

| 维度        | 事实                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| 列定义      | `varchar('status') default 'active' notNull`,取值 `active` / `revoked`                                              |
| 落点        | `packages/database/src/schema/developer-api-keys.ts:21,36`                                                          |
| 吊销动作    | `revokeKey()` 单向迁移:已 revoked 直接返回 true(幂等),否则 `set status='revoked'`                                  |
| 落点        | `apps/api/src/services/developer-api-keys-service.ts:299-326`                                                       |
| 自助端点    | `POST /api/developer/relay/keys/:id/revoke`(仅归属人,`request.userId`)                                             |
| 落点        | `apps/api/src/routes/developer-relay.ts:269-286`,挂载前缀 `/api`(`apps/api/src/routes/index.ts:1154`)              |
| **即时生效判据** | 鉴权每次请求查**主库**(注释 P1-3:原用读副本会因复制延迟查不到/副本故障雪崩),`row.status !== 'active'` → 401 `Invalid or revoked API key` |
| 落点        | `apps/api/src/plugins/api-key-auth.ts:905-913`                                                                      |
| share 联动  | share token 额外要求源 Key `status === 'active'`,否则 401 `Source API key inactive` —— **吊销源 Key 即连带掐断其全部 share token** |
| 落点        | `apps/api/src/plugins/api-key-auth.ts:787`                                                                          |

**生效时延 = 0**(无缓存层、无 TTL):`authenticateApiKey` 每个请求都直查主库行
(`apps/api/src/plugins/api-key-auth.ts:907-911`),不存在"吊销后要等 N 分钟"的窗口。

与"删除"的区别:`deleteKey()` 是**硬删除**(`apps/api/src/services/developer-api-keys-service.ts:245`),
`revokeKey()` 保留行与 `llm_call_logs` 关联记录(`apps/api/src/routes/developer-relay.ts:271-272` 注释明确),
所以**取证必须走吊销,不要走删除**。

恢复路径存在且是设计内的:`PATCH` 允许把 `status` 改回 `active`
(`apps/api/src/services/developer-api-keys-service.ts:205-221`,端点 `apps/api/src/routes/developer-relay.ts:218`)。

### 3.2 IP 黑名单:`blockedIps`(CIDR,按 key 生效)

| 维度       | 事实                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| 存储       | `developer_api_keys.blockedIps`(jsonb),创建时 `undefined → null`(= 不限制)                            |
| 落点       | `apps/api/src/services/developer-api-keys-service.ts:132`;列定义 `packages/database/src/schema/developer-api-keys.ts:71`(`blocked_ips` jsonb;白名单 `:64`) |
| 写入端点   | `PATCH /api/developer/relay/keys/:id`(`apps/api/src/routes/developer-relay.ts:218`)                    |
| 匹配算法   | 精确 / 前缀(尾点或尾冒号)/ **CIDR**(`/` 且前缀为纯十进制整数);IPv4 按 32 bit、IPv6 按 128 bit **各自族内**逐位比较 |
| 落点       | `apps/api/src/plugins/api-key-auth.ts:348-370`(`ipInList`)、`:475-483`(`isCidrMatch`)                 |
| 归一       | `2001:db8::1` ≡ `2001:0DB8:0:0:0:0:0:1`;`::ffff:10.0.0.1` ≡ `10.0.0.1`(`:451-464`)                    |
| 优先级     | **黑名单命中优先于白名单**,两侧都空则放行                                                             |
| 落点       | `apps/api/src/services/key-rate-window-service.ts:196-213`(`checkKeyIpAcl`)→ `apps/api/src/plugins/api-key-auth.ts:932-936` |
| share 同闸 | share 分支复用**同一个** `checkKeyIpAcl`,不复制第二套算法(`apps/api/src/plugins/api-key-auth.ts:799-807`) |

两个值得记住的实现细节(都在源码注释里,不是事后补的):

1. **族不同直接不匹配**。把 IPv4 塞进 128-bit 的 `::ffff:` 空间比较,会让 `/24` 退化成
   "前 24 位恒为 0"从而匹配任意 IPv4 —— 白名单全线绕过。故 `isCidrMatch` 先比 `family`,
   且 prefix 不得超过该族位宽(`apps/api/src/plugins/api-key-auth.ts:466-483`)。
2. **畸形条目一律不匹配**。`"33/44"`、`"-1"`、非整数前缀都不参与匹配
   (`apps/api/src/plugins/api-key-auth.ts:358-364`;回归见 `apps/api/tests/ip-cidr.test.ts`)。

`blockedIps` 是**按 key** 的封禁:它封的是"这把 key 不接受来自这些地址的调用",
不是"这些地址不能再调平台"。全局面见 3.4。

### 3.3 Key 级窗口 5h / 1d / 7d

| 项        | 事实                                                                          |
| --------- | ------------------------------------------------------------------------------ |
| 列        | `rate_limit_5h / rate_limit_1d / rate_limit_7d`,`NULL` = 不限                  |
| 落点      | `packages/database/src/schema/developer-api-keys.ts`;读取 `apps/api/src/services/key-rate-window-service.ts:46-55` |
| 检查      | `checkKeyRateWindows()` `apps/api/src/services/key-rate-window-service.ts:72-120`,由鉴权链路调用 `apps/api/src/plugins/api-key-auth.ts:1024-1031` |
| 超限表现 | **429**,业务码 **1010**,带 `Retry-After` + `X-RateLimit-Limit/-Remaining/-Reset/-Window` |
| 落点      | `apps/api/src/plugins/api-key-auth.ts:268-291`                                 |
| 计数      | 带 `model` 的调用由 relay 计费链路 `recordCall` +1;不经计费的非 model 端点在 `reply.raw.on('finish')` 且 2xx 时补计,**避免双计** |
| 落点      | `apps/api/src/plugins/api-key-auth.ts:1100-1106`;`incrKeyRateWindows` `apps/api/src/services/key-rate-window-service.ts:127` |

**窗口口径是三种不同的对齐方式**(`apps/api/src/services/key-rate-window-service.ts:9-11,30-37`):
`5h` = epoch 固定对齐(`floor(epoch/5h)*5h`),`1d` = **UTC+8 自然日**,`7d` = **UTC+8 周一~周日**。
所以"每 5 小时重置"准确,"任意时刻起算 5 小时内"不准确。三列全 NULL 的存量 key:
零查询直接放行,行为不变(`apps/api/src/plugins/api-key-auth.ts:1018` 注释;实测同 `rate-limits.md` 第 3 节 #6)。

单模型 RPM/TPM(code 1007/1008)与 Key 级 TPM 的完整数字表在
[rate-limits.md](./rate-limits.md) 第 3 节,本文不重复。

### 3.4 IP 信誉与自动封禁(平台面,非按 key)

| 机制                | 阈值/参数                                                     | 落点                                                            |
| ------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| 反自动化            | 单 IP 每分钟 > 100 → 429;> 200 → 403 + 临时封禁 900s;扫描器路径特征命中 → 封禁 3600s | `apps/api/src/plugins/anti-automation.ts:47-55`                 |
| 扫描器特征          | `/.env` `/.git` `/.aws` `/.ssh` `/wp-admin` `/phpmyadmin` 等    | `apps/api/src/plugins/anti-automation.ts:73-80`                  |
| 威胁检测(信誉分)   | score ≥ 80 自动封禁(递增时长),score ≥ 60 告警放行;响应头 `X-Block-Reason` / `X-Threat-Score` | `apps/api/src/plugins/threat-detector.ts:31-33,125,143-181`     |
| 异常行为检测(6 维) | request-frequency / time-distribution / geo-anomaly / 指纹 / 扫描器 / 基线,加权分 `>80` block、`>60` challenge、`≥30` monitor | `apps/api/src/services/anomaly-detector.ts:152-190`             |
| IP 信誉存储         | `recordBadEvent(ip, reason)` 30 天 TTL;`blockIp(ip, durationSec, reason)` / `getBlockInfo(ip)` / `unblockIp` / `unblockIfAuto` | `apps/api/src/services/ip-reputation.ts:11-13,329,374,402,432,440` |
| 管理员手工封禁      | `POST /api/security/block-ip`(`duration` 默认 3600,上限 30 天)、`DELETE /api/security/block-ip/:ip`,均需 `roleId >= 1` | `apps/api/src/routes/security.ts:44-53,143-164`,前缀 `/api/security`(`apps/api/src/routes/index.ts:1123`) |
| 插件顺序            | 反自动化必须最先(onRequest 拦截),威胁检测其次,异常检测再次      | `apps/api/src/server.ts:593-601`                                 |

**边缘层没有 IP 封禁表。** `deploy/nginx` 只提供**速率** zone,没有 `deny` / `geo` 黑名单:
`login_zone 10r/s`(`deploy/nginx/conf.d/rate-limit.conf:37`)、
`api_zone 100r/s`(`:41`)、`static_zone 1000r/s`(`:45`)、
`gateway_key_zone 20r/s` key = `$http_authorization$http_x_api_key`(`:60`)、
`gateway_anon_zone 5r/s`(`:69`)、`ws_handshake_zone 10r/s`(`:75`),
统一 `limit_req_status 429`(`:78`);`/v1/` 与 `/v1beta/` **有意共用**这两条 zone
(`deploy/nginx/nginx-blue-green.conf:226-228,241-245`)。
所以"nginx 把某 IP 拉黑"这个能力**不存在**,拉黑只发生在应用层(3.2 / 3.4)。

一处需要知晓的权衡(配置文件注释自陈,非本文补充):`limit_req` 在共享内存里保存 key
**原文**而非哈希,该 shm 中会出现调用方凭据串;不写任何日志,也不出现在 `nginx -T` 输出
(`deploy/nginx/conf.d/rate-limit.conf:56-59`)。

### 3.5 凭据轮换(泄露后的第一动作)

`POST /api/developer/relay/keys/:id/reset` → `rotateSecret()` 生成新 secret,
**仅此一次返回明文**,并且显式 `request.skipResponseSanitization = true`
(否则 secret 会被响应脱敏打成 `***`)。
落点 `apps/api/src/routes/developer-relay.ts:249-267`;服务实现
`apps/api/src/services/developer-api-keys-service.ts:328`。
另有兼容路径 `POST /api/developer/keys/:id/reset`
(`apps/api/src/routes/other/developer-routes.ts:61-70`,同一 `rotateSecret`;该族由
`apps/api/src/routes/index.ts:997` 以 `/api` 前缀挂载,创建/删除同族见 `:30,53`)。

## 4. 处置的生效范围速查

| 你想做的事             | 用的开关                          | 影响面                       | 生效时延 |
| ---------------------- | --------------------------------- | ---------------------------- | -------- |
| 停掉一把泄露的 key     | `status='revoked'`(3.1)          | 该 key + 其全部 share token  | 0(每请求查主库) |
| 换掉 secret,保留 key   | `POST .../keys/:id/reset`(3.5)   | 该 key 的 secret             | 0        |
| 只禁某来源地址调此 key | `blockedIps`(3.2)                | 单 key × 地址/CIDR          | 0        |
| 给此 key 套总量上限    | `rate_limit_5h/1d/7d`(3.3)       | 单 key 窗口内请求数          | 0        |
| 全平台封某 IP          | `POST /api/security/block-ip`(3.4) | 该 IP 的所有请求            | 下一请求(`getBlockInfo` 快速路径) |
| 只收紧匿名探测         | `gateway_anon_zone 5r/s`(3.4)     | 未带凭据的 `/v1`、`/v1beta` | 需加载该 nginx 配置 |

## 5. 取证与归因:你能被追到,别人也能

处置之所以有意义,是因为开放面上每一步都带归属:

- 每行审计含 `apiKeyId` / 归属 userId / capability(scope·dataClass·risk·billable·domain)/
  method / url / routePattern / statusCode / durationMs —— `buildRequestAttribution()`
  `apps/api/src/plugins/audit-logger.ts:244`。
- **审计绝不记录凭据原文**:注释原文"**绝不**读 `request.apiKey.key`(那是凭据原文,落库即等同密钥泄露)"
  `apps/api/src/plugins/audit-logger.ts:251`。
- 未鉴权流量(无 key 无 JWT)同样落审计,`userId`/`apiKeyId` 为 null 但带 IP + path,
  可回答"谁在探测哪个端点" `apps/api/src/plugins/audit-logger.ts:24-25`。
- GET 采样默认 100%(`AUDIT_LOG_GET_SAMPLE_RATE` 可调低,钳制到 [0,1]);4xx 强制全量记录以便复盘
  `apps/api/src/plugins/audit-logger.ts:103-105,333-335`。
- 计费流水 `llm_call_logs` 顶层列含 `apiKeyId` + `clientIp` + `costCents` + `httpStatus`
  `packages/database/src/schema/llm-call-logs.ts:61,69,71,73`。
- 用量自查:`GET /api/developer/relay/usage`(按模型/按日聚合)
  `apps/api/src/routes/developer-relay.ts:289`;`GET /api/developer/relay/logs`(明细)`:382`;
  旧面 `GET /api/developer/api-keys/:id/usage` `apps/api/src/routes/developer.ts:158-174`。

## 6. 申诉与复核通道

**诚实口径:面向第三方开发者的自助申诉/复核通道,只有"IP 自动封禁"这一格是通的**,
其余(按 key 的处置、账号处置)仍然没有。逐条说明:

| 你可能以为有的        | 实际情况                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| IP 被封后的自助解除   | **有,但只覆盖自动封禁**。`POST /api/security/challenge` 取挑战 → `POST /api/security/verify-challenge` 答对,即解除来源为 `rate-limit-block` / `scanner-detected` / `high-threat-score` 的封禁(判据 `AUTO_LIFTABLE_REASONS`,`apps/api/src/services/ip-reputation.ts:432`)。**管理员 `block-ip` 下的封禁不在其中** —— 否则人机验证就成了绕过处置的后门。这两条路径在封禁钩子的豁免表内(`apps/api/src/utils/block-exempt-paths.ts`),所以被封的 IP 够得着它们 |
| Key 被封后的自助申诉  | **暂无**。没有"提交复核请求"的端点;`developer*` 路由下只有管理(创建/更新/轮换/吊销/分组/充值)与查询(用量/日志/收益),无申诉类端点 |
| 吊销原因回显          | **暂无**。401 固定文案 `Invalid or revoked API key`(`apps/api/src/plugins/api-key-auth.ts:913`),不区分"不存在/已吊销",这是**防枚举的有意设计**,也就带不了原因 |
| 封禁时长/到期查询     | **被处置方看得见时长**:403 响应带 `Retry-After` 头与 `retryAfterSec` 字段(`apps/api/src/plugins/anti-automation.ts:140-145`、`apps/api/src/plugins/threat-detector.ts:125-130`)。**但没有"查我这台机器还剩多久"的端点** —— `GET /api/security/ip-reputation/:ip` 与 `GET /api/security/anomalies` 都要求 `roleId >= 1`(管理员),见守卫 `apps/api/src/routes/security.ts:74-87` |
| 被吊销 key 的自助恢复 | **技术上存在**:`PATCH /api/developer/relay/keys/:id` 可把 `status` 改回 `active`(`apps/api/src/services/developer-api-keys-service.ts:221`)。**但这是归属人对自己 key 的写权限,不是平台的"复核通过"机制** —— 平台侧没有阻止被处置者自行复活的逻辑,这是当前设计的真实边界 |
| 面向用户的工单        | 有**反馈**入口 `POST /api/feedbacks`(需登录,`apps/api/src/routes/comments.ts:417-418`;插件级鉴权 `:93-95`),但它是产品反馈,不是凭据申诉;admin 侧工单只有列表/状态/回复(`apps/api/src/routes/admin-support-tickets.ts:57,106,145,190`),**没有面向被处置方的建单端点** |
| 可疑活动上报          | **有,且匿名可用**:`POST /api/security/report`(无认证,同 IP 5 次/分钟限流)—— 落点 `apps/api/src/routes/security.ts:181-215`,限流常量 `:236-237`。它是"**你举报别人**",不是"你为自己被处置申诉" |

因此,当前唯一可用的**双向**通道是人工邮件渠道(与漏洞披露共用同一入口,见仓库根
[`SECURITY.md`](../../SECURITY.md) 的"报告渠道"):`security@aizhs.top`,
SLA 内无回复时升级 `community@aizhs.top`(`SECURITY.md:28,50`)。
**这两者是安全/滥用事件的通报邮箱,平台未承诺"申诉必然受理或翻案"。**

若你是被误伤的接入方,建议在邮件里带上:`apiKeyId`、命中时间(UTC+8)、
HTTP 状态码 + `errorCode`、`X-RateLimit-Window`(若 429 为 1010)、以及第 5 节自查到的 usage 区间 ——
这些字段都在真实响应/审计里,能直接对上号。

## 7. 接入方自检

1. 泄露响应?立刻 `POST /api/developer/relay/keys/:id/reset`,**不要**先删 key(删了丢归因)。
2. 怀疑被从某地址滥用?把该地址/CIDR 写进 `blockedIps`,黑名单优先于白名单
   (`apps/api/src/services/key-rate-window-service.ts:203-211`)。
3. 被 429(code 1010)打停?看 `X-RateLimit-Window` 判断是 5h / 1d / 7d,再按 `X-RateLimit-Reset` 对齐,
   不要盲目重试(`apps/api/src/plugins/api-key-auth.ts:284-289`)。
4. 需要"只能从自己服务器调用"?设 `allowedIps` 白名单;不在名单内 → 403
   (`apps/api/src/plugins/api-key-auth.ts:932-936`)。
5. 想确认平台侧到底拦了什么?对照 [rate-limits.md](./rate-limits.md) 第 2/3 节与
   [error-codes.md](./error-codes.md) 第 2 节,那两份是数字与码表的单一说明。

## 8. 相关文档

- 速率与配额三层结构:[rate-limits.md](./rate-limits.md)
- 错误码与 `errorCode` 全表:[error-codes.md](./error-codes.md)
- 能力目录与数据分级:[capabilities.md](./capabilities.md) · [data-classes.md](./data-classes.md)
- 合规与数据留存:[compliance.md](./compliance.md)
- 安全漏洞披露:`SECURITY.md`(仓库根)
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
