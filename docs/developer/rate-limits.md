<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 速率与配额(Rate Limits)

> 面向第三方 Agent 开发者。本文所有数字**均为实跑/实读代码所得**,并逐条标注落点。
> 结论先行:开放面当前由**两层真实闸门**(nginx 边缘层 + 应用凭据层)把关;能力目录里的
> `RATE_PROFILES` 是**声明档**(第三层),它在 apps/api 的 `/v1` 运行时**尚未接线**,在 ai-service
> 侧已实现令牌桶但**尚无调用点**。把 `RATE_PROFILES` 的数字当成"现在就会被这样限"是错的,
> 详见第 4 节与第 7 节。

## 1. 三层结构总览

| 层          | 位置                                                     | 是否当前生效 | 粒度                       |
| ----------- | -------------------------------------------------------- | ------------ | -------------------------- |
| L1 边缘     | `deploy/nginx/conf.d/rate-limit.conf` + `nginx-blue-green.conf` | ✅ 生效(需部署该配置) | 按凭据串 / 按来源 IP       |
| L2 应用凭据 | `apps/api/src/plugins/api-key-auth.ts` 及被它调用的服务   | ✅ 生效       | 按 key / 按 key×model / 按用户 |
| L3 能力档   | `packages/types/src/capability-catalog.ts` 的 `RATE_PROFILES` | ⚠️ 仅声明     | 按 scope 的风险档          |

L1 落点:`deploy/nginx/conf.d/rate-limit.conf:60`(`gateway_key_zone`)、`:65-69`(`map` + `gateway_anon_zone`)、`:78`(`limit_req_status 429`);
挂载点 `deploy/nginx/nginx-blue-green.conf:226-228`(`/v1/`)与 `:241-245`(`/v1beta/`)。

L2 落点见第 3 节逐条。L3 落点 `packages/types/src/capability-catalog.ts:107-112`。

## 2. L1:边缘限流(唯一按"凭据串"隔离的一层)

| zone                 | key                                            | rate    | burst  | 作用面                     |
| -------------------- | ---------------------------------------------- | ------- | ------ | -------------------------- |
| `gateway_key_zone`   | `$http_authorization$http_x_api_key`           | `20r/s` | `60`   | 携带凭据的 `/v1/`、`/v1beta/` |
| `gateway_anon_zone`  | 无凭据时为 `$binary_remote_addr`,有凭据时为空串 | `5r/s`  | `20`   | 未带 key 的探测/爆破流量   |
| `api_zone`           | `$binary_remote_addr`                          | `100r/s`| 见配置 | 人类会话 `/api/`           |
| `login_zone`         | `$binary_remote_addr`                          | `10r/s` | 见配置 | 登录入口                   |
| `ws_handshake_zone`  | `$binary_remote_addr`                          | `10r/s` | `30`   | `/ws` 握手(不含已建立连接) |

取值理由与语义(逐条写在配置文件注释里,不是事后补的说明):

- `20r/s` 相对"默认 per-key 配额 60 rpm(=1r/s)"是 20 倍余量,合法流量撞不到,只掐单把 key 打爆上游的脚本
  (`deploy/nginx/conf.d/rate-limit.conf:47-59`)。
- 无凭据请求在 `gateway_key_zone` 里 key 为空串,nginx 语义是**空 key 不限制**,所以由 `gateway_anon_zone`
  按 IP 兜底;`map` 反向取值(`带 key → 空串`)保证已鉴权客户不会被同出口的 IP 闸误伤
  (`deploy/nginx/conf.d/rate-limit.conf:54-69`)。
- `/v1/` 与 `/v1beta/` **有意共享**同两条 zone:同一把 key 跨两个协议入口合并计数,防止配额变相翻倍
  (`deploy/nginx/nginx-blue-green.conf:241-243`)。
- 流式(SSE)不受影响:`limit_req` 只在 preaccess 阶段对"这一个 HTTP 请求"计数一次,推流 300s 期间不再复查
  (`deploy/nginx/nginx-blue-green.conf:223-225`;`proxy_read_timeout 300s` 见 `:235`)。
- 边缘层返回的状态码固定为 **429**(`limit_req_status 429`,`deploy/nginx/conf.d/rate-limit.conf:78`)。
- 权衡披露:`limit_req` 在共享内存里保存 key **原文**而非哈希,该 shm 中会出现调用方凭据串;不写任何日志,
  也不出现在 `nginx -T` 输出(`deploy/nginx/conf.d/rate-limit.conf:56-59`)。

**部署前提**:以上是仓库内的配置文件。若你的接入环境没有加载 `deploy/nginx/conf.d/rate-limit.conf`,
L1 就不存在,只剩 L2。自验方法见第 8 节。

## 3. L2:应用层凭据闸门(当前真正生效的配额)

按请求处理顺序排列。"默认值"一栏是**不配置该字段时的行为**。

| # | 闸门                       | 载体/字段                                              | 默认值                      | 超限表现                                   | 落点 |
| - | -------------------------- | ------------------------------------------------------ | --------------------------- | ------------------------------------------ | ---- |
| 1 | 全局 IP 桶(`@fastify/rate-limit`) | 按 IP,所有路由(含 `/v1`)                         | 生产 `100 req/min/IP`;非生产 `1000` | 429                          | `apps/api/src/server.ts:382-385` |
| 2 | Key 小时/天配额            | `api_key_quotas.hourly_limit / daily_limit`             | `1000 / 小时`、`10000 / 天` | 429 + `Retry-After`                        | `apps/api/src/utils/api-key-quota.ts:36-37,144`;`packages/database/src/schema/security.ts:19-20` |
| 3 | 单模型 RPM                 | `developer_api_keys.per_model_rpm_limit`(jsonb `{"gpt-4o":60}`) | `NULL` = 不限       | 429 + `Retry-After`,业务码 **1007**        | `apps/api/src/plugins/api-key-auth.ts:651-717,955-974` |
| 4 | 单模型 TPM                 | `developer_api_keys.per_model_tpm_limit`                | `NULL` = 不限               | 429 + `Retry-After`,业务码 **1008**        | 同上;列由 migration `packages/database/drizzle/20260921100000_developer_api_keys_per_model_limits.sql` 落地 |
| 5 | Key 级 TPM(总量)         | `developer_api_keys.tpm_limit`                          | `NULL` = 不限               | 429,业务码 **1008**                        | `apps/api/src/plugins/api-key-auth.ts:1036-1050`;`apps/api/src/services/api-key-tpm-service.ts:143-182` |
| 6 | Key 级窗口 5h / 1d / 7d    | `rate_limit_5h` / `rate_limit_1d` / `rate_limit_7d`      | `NULL` = 不限(三列全 NULL 时零查询直接放行) | 429,业务码 **1010** + `X-RateLimit-*` | `apps/api/src/services/key-rate-window-service.ts:72-120`;`apps/api/src/plugins/api-key-auth.ts:1024-1031,272-291` |
| 7 | 单次请求 token 上限        | `max_tokens_per_req`(请求前用 `body.max_tokens` 预检)   | `NULL` = 不限               | 403(不是 429)                            | `apps/api/src/plugins/api-key-auth.ts:944-949,548-555` |
| 8 | 用户级并发在途数           | env `RELAY_USER_CONCURRENCY_LIMIT`(进程内计数)         | `20`                        | 429,OpenAI 错误形状 `code: user_concurrency_limit` | `apps/api/src/services/user-concurrency-service.ts:23-28`;`apps/api/src/routes/v1-public.ts:1409-1421` |
| 9 | 余额/额度熔断              | `token_balance` / `cost_balance_cents`(`-1` = 无限)     | 新建 key 默认 `-1`          | 402(额度类)                              | `packages/database/src/schema/developer-api-keys.ts:41-47`;`apps/api/src/routes/v1-public.ts:1332-1356` |

窗口口径(#6)是有意不同的三种对齐方式(`apps/api/src/services/key-rate-window-service.ts:9-11,31-37`):

- `5h` → epoch 固定对齐(`floor(epoch/5h)*5h`),不是滑动窗口;
- `1d` → **UTC+8 自然日**;
- `7d` → **UTC+8 周一~周日**。

所以"每 5 小时重置一次"的说法准确,"任意时刻起算的 5 小时内"不准确。

### 3.1 `rateLimit` 字段(每分钟请求数)的真实处境

`developer_api_keys.rate_limit` 默认 `60`(`packages/database/src/schema/developer-api-keys.ts:38`,
创建时兜底同值 `apps/api/src/services/developer-api-keys-service.ts:125`),`packages/types/src/api-key.ts:208-209`
也把它描述为"每分钟请求上限"。但代码里它**没有被当作 RPM 执行**:

- 鉴权链路把 `rateLimit` 注入 `request.apiKey`(`apps/api/src/plugins/api-key-auth.ts:985`),
  但没有任何地方按"每分钟"读它计数;
- 它唯一被当作限额使用的地方是知识库/工具面的配额兜底:
  `hourlyLimit = quotaRow.hourlyLimit ?? apiKey.rateLimit`、`dailyLimit = quotaRow.dailyLimit ?? apiKey.rateLimit * 24`
  (`apps/api/src/routes/v1-knowledge-tools.ts:2857-2859`)—— 即"每小时"和"每天 ×24",不是每分钟。

nginx 的注释也以"60 rpm = 1r/s"作为取值依据(`deploy/nginx/conf.d/rate-limit.conf:51-52`),
而 L2 真正按分钟计的只有 #3/#4/#5。**要限"每分钟请求数",请配 `per_model_rpm_limit`(#3),
不要指望 `rateLimit` 字段。**

### 3.2 逐请求的预估 token 口径

RPM/TPM 检查发生在请求**进入模型之前**,所以只能用预估值:

- #3/#4:`body.max_tokens`,缺失时保守取 `1000`(`apps/api/src/plugins/api-key-auth.ts:958-959,1038-1039`);
- #5 同口径(`:1039`);
- share token 分支用 `ceil(prompt 字符数 / 4) + max_tokens`(`apps/api/src/plugins/api-key-auth.ts:829-840`)。

实际用量在响应结束后回写(`apps/api/src/plugins/api-key-auth.ts:1091-1099`)。
结论:**`max_tokens` 写多大,TPM 就按多大扣**,把 `max_tokens` 顶格设置等于自减吞吐。

## 4. L3:`RATE_PROFILES` 声明档(现状:未接线)

能力目录按风险档声明的四组配额,单一事实源
`packages/types/src/capability-catalog.ts:107-112`,并原样导出进机器可读产物
`packages/types/generated/capabilities.json` 的顶层 `rateProfiles`
(生成器 `packages/types/src/capability-catalog.ts:1111`,产物实读值见下表)。

| risk       | rpm   | burst | dailyCalls | concurrent | maxDurationMs | 直观含义                         |
| ---------- | ----- | ----- | ---------- | ---------- | ------------- | -------------------------------- |
| `low`      | `600` | `120` | `50 000`   | `8`        | `30 000`      | 元数据/只读,30s 单次上限         |
| `medium`   | `120` | `40`  | `10 000`   | `4`        | `120 000`     | 常规生成,2 分钟单次上限          |
| `high`     | `30`  | `10`  | `2 000`    | `2`        | `600 000`     | 计费/写/触达类,10 分钟单次上限   |
| `critical` | `5`   | `2`   | `200`      | `1`        | `900 000`     | 执行类,5 次/分钟、单次 15 分钟   |

目录注释的意图是"可被 key 级配置收紧,不可放宽"(`packages/types/src/capability-catalog.ts:93`),
取值函数 `rateProfileOf(scope)` 同文件 `:1022-1025`。落地情况必须分开讲:

- **apps/api(`/v1` 运行时):不消费。** 全仓检索 `RATE_PROFILES` / `rateProfileOf` 的引用点只有
  `packages/types/src/capability-catalog.ts` 自身与守门脚本 `scripts/check-capability-catalog.mjs:312-331`
  (用于校验产物不漂移),`apps/api/**` 内**零引用**。所以 `/v1` 上不会因为你调的是 `high` 档能力就自动变成 30 rpm。
- **ai-service(MCP tools/call 面):已实现,未接线。** `apps/ai-service/app/services/capability_gate.py:475-489`
  会从 `capabilities.json` 读 `rateProfiles`,`:738-816` 实现了 `MachineKeyRateLimiter`(令牌桶 + 并发位,
  只作用于 `principal.is_machine_channel`,见 `:745-746`;`rpm`/`burst`/`concurrent` 结算,
  `dailyCalls` 与 `maxDurationMs` **明确不在本器结算**,见 `:747-748`),抛错版是 `enforce_rate_limit()`(`:819-823`)
  → 超限 `RateLimitExceeded`(HTTP 429,`errorCode` 默认 `RATE_LIMITED`,见 `:127-143`)。
  但**全仓没有任何调用点**:`enforce_rate_limit` / `machine_rate_limiter` / `RateLimitExceeded` 只出现在该文件内部
  与 `__all__` 导出清单(`:955,965,969`),`routers/mcp_official.py` 与 `services/mcp_export.py` 均未调用。
- **结论**:`RATE_PROFILES` 当前是**契约与预算基线**(供文档、控制台、CI 防漂移、后续接线使用),
  不是运行时限额。真正的运行时限额只有第 2、3 节。

按档位的实际分布(读 `capabilities.json` 统计,`pnpm capabilities:check` 保证与目录一致):
`low` 17 项 / `medium` 23 项 / `high` 17 项 / `critical` 5 项,共 62 个 scope;其中 `billable=true` 23 项。

## 5. fail-close 语义(#3/#4/#5/#6 的降级行为)

限流后端有两类依赖:Redis(per-model RPM/TPM、Key 级 TPM)与数据库读源(5h/1d/7d 窗口计数)。
它们不可用时,**默认拒绝而不是放行**:

- 开关:`API_KEY_RATE_LIMIT_FAIL_MODE`,取值 `close` | `open`,**默认 `close`**
  (`apps/api/src/config/index.ts:203`)。
- 统一处置函数 `enforceRateBackendAvailability()`(`apps/api/src/plugins/api-key-auth.ts:145-170`),
  三类场景共用:`per-model` / `key-window` / `tpm`。
- "收紧面"判据**不硬编码路由名**,而是取能力目录(`apps/api/src/plugins/api-key-auth.ts:184-193`):
  1. 能力闸已注入 `request.capability` → `billable === true` 或 `risk !== 'low'` 即收紧;
  2. 未注入 → 用能力目录 `routes` 模式反查(method + path,`:199-239`),命中同上判定;
  3. 目录也没命中 → **凡 path 以 `/v1/` 开头一律视为收紧面**(`:192`)。
- 结果:
  - `close` + 收紧面 → **503**,`errorCode: "RATE_BACKEND_UNAVAILABLE"`,`Retry-After: 5`
    (`apps/api/src/plugins/api-key-auth.ts:122-128`)。
  - `close` + 低危只读(如 `models:read`) → 仅告警放行(`:153-161`)。
  - `open` → 一律放行(历史行为)。
- share token 路径同判据(`apps/api/src/plugins/api-key-auth.ts:855-858`)。
- 底层检查函数**不自行降级**:`checkPerModelRateLimit` 在 Redis 异常时返回
  `{ allowed: true, backendUnavailable: true }`(`:664-669,713-716`),是否拒绝由上面一处决定。

另外两处独立的 fail-closed(与限流不同源,别混淆):

- **计费熔断**:定价查询失败且无缓存 → 503,`code: "billing_unavailable"`
  (`apps/api/src/routes/v1-public.ts:1433-1445`)。
- **能力清单缺失(ai-service MCP)**:`capabilities.json` 读不到时,外部凭据(JWT/机器通道)的
  `tools/call` 一律拒绝,本地 dev/internal 才回退矩阵(`apps/ai-service/app/services/capability_gate.py:456-465`)。

## 6. 429 与 503 分别意味着什么

| HTTP | 业务码/`errorCode`      | 含义                                   | 你该怎么处理                                       |
| ---- | ----------------------- | -------------------------------------- | -------------------------------------------------- |
| 429  | `1007`                  | 单模型 RPM 超限                        | 按 `Retry-After` 退避;考虑换模型分散或调低并发     |
| 429  | `1008`                  | TPM 超限(单模型或 Key 总量)           | 降 `max_tokens`、拆请求;`Retry-After` 到分钟整点   |
| 429  | `1010`                  | Key 级 5h/1d/7d 窗口打满               | 按 `X-RateLimit-Reset` 等窗口切换,退避到窗口边界   |
| 429  | 无码(`code: 429`)     | 小时/天配额用满(#2)或全局 IP 桶 / nginx 边缘闸 | 先看是否只有你这个 IP;按 `Retry-After` 退避 |
| 429  | `user_concurrency_limit`| 该用户账号在途请求数超 `RELAY_USER_CONCURRENCY_LIMIT` | 关掉空闲长连接/流式会话后重试             |
| 503  | `RATE_BACKEND_UNAVAILABLE` | fail-close:限流后端不可用且该能力属收紧面 | 视为**瞬时**故障,按 `Retry-After: 5` 退避并重试 |
| 503  | `billing_unavailable`   | 定价存储不可用(计费熔断)             | 可重试;持续出现应联系平台                          |

两条要点:

1. **429 = 你超了,503 = 平台没法确定你有没有超。** 两者都要退避,但 503 的重试不该被记成"被限流"的指标。
2. 429 一律带 `Retry-After`。Key 级窗口(`1010`)还额外带四个头:
   `X-RateLimit-Limit` / `-Remaining`(恒 `0`)/ `-Reset`(unix 秒)/ `-Window`(`5h|1d|7d`),
   见 `apps/api/src/plugins/api-key-auth.ts:272-291`;响应组装在 `:1054-1071`。
   其余 429 分支(如 #2、边缘层)**不带** `X-RateLimit-*`,不要假设一定存在。

## 7. 明确不成立/在途的说法(请勿照抄进你的容量模型)

| 说法                                    | 实际状态 | 依据 |
| --------------------------------------- | -------- | ---- |
| 「按 scope 风险档自动限 rpm/burst/并发」 | 未生效   | 第 4 节:apps/api 零引用;ai-service 已实现但无调用点 |
| 「`rateLimit` 字段=每分钟上限」          | 未生效   | 第 3.1 节:唯一消费点是小时/天兜底 |
| 「`critical` 档 1 并发、15 分钟上限」    | 未生效   | 同上;`dailyCalls`/`maxDurationMs` 在 ai-service 实现里也被显式排除(`capability_gate.py:748-749`) |
| 「分布式限流规则覆盖开放面」              | 未生效   | `plugins/distributed-rate-limit.ts` 提供 `ip/user/tenant/api_key/global` 五档(`:48`),但全仓仅注册了一条规则:`apps/api/src/routes/notifications.ts:357-361`(管理员定向推送,`limit:1,windowSec:60,scope:'user'`),`/v1` 未挂 |
| 「多实例下并发计数全局一致」              | 未生效   | #8 是进程内计数,源码注释标注单实例正确、多实例需迁 Redis(`apps/api/src/routes/v1-public.ts:1406-1407`) |
| 「nginx 边缘限流已在你的环境生效」        | 取决于部署 | 仓库内有配置 ≠ 线上已加载;自验见第 8 节 |

## 8. 自验:我怎么确认自己被哪一层限住

```bash
# L2 是否配了窗口/单模型限额(返回体不含限额字段,只能靠打满后观察)
curl -s -o /dev/null -D - -X POST https://<host>/v1/chat/completions \
  -H "Authorization: Bearer $IHUI_KEY" -H "X-Api-Secret: $IHUI_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"ping"}],"max_tokens":8}'

# 只看响应头:命中 1010 时会出现 X-RateLimit-Window / -Reset;
# 只有 Retry-After 而无 X-RateLimit-* 的 429,基本可判定是 #1/#2 或 L1 边缘层。

# L1 是否存在:同一请求以远超 20r/s 打满 60 burst 后是否得到裸 429(无 JSON 业务码),
# 或直连源站端口对比经域名的行为差异。
```

判读顺序:**先看有没有 `errorCode`**(有 = 走到了 L2 应用层;无且响应体是 nginx 默认页 = L1),
**再看 `code` 是不是 1007/1008/1010**(定位到具体那道闸),**最后看 503 + `RATE_BACKEND_UNAVAILABLE`**
(平台侧降级,不是你的配额问题)。

## 9. 相关文档

- 能力目录与 scope 语义:[capabilities.md](./capabilities.md)
- 数据分级与数据闸:[data-classes.md](./data-classes.md)
- 全量错误码:[error-codes.md](./error-codes.md)
- 滥用红线与封禁:[abuse-policy.md](./abuse-policy.md)
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
