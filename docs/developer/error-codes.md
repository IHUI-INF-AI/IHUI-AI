# 错误码(Open Surface Error Codes)

> 覆盖范围:`/v1/*`、`/v1beta/*`、`/v1/messages*`、`/v1/mcp/*` 与开发者自助面 `/api/developer/*`。
> 每条断言都给了代码落点。**表里没有的码,平台不会返回**;若你在线上收到未列出的码,那是缺陷,请按
> [SECURITY.md](../../SECURITY.md) 的流程反馈。

## 1. 先认清三种响应形状(实测,不是规范)

同一个 `/v1` 前缀下并存三种体,**不能只按一种解析**:

| 形状 | 触发路径 | 体 | 落点 |
| ---- | -------- | -- | ---- |
| A 信封形 | 鉴权/能力/配额类拒绝(Fastify preHandler 层) | `{ code, message, data: null, errorCode?, retryAfter? }` | `apps/api/src/plugins/api-key-auth.ts:1063-1070` |
| A′ 精简信封 | preHandler 内直接 reply 的授权拒绝 | `{ code, message, errorCode, requiredScope? / requiredAnyOf? / scope / method / path }` | `apps/api/src/utils/capability-guard.ts:90-96,101-107,144-150,169-175` |
| B 全局 handler | 抛出的 `AppError` / Zod 校验失败 | `{ code, message, errorCode? }`(`code` 恒等于 HTTP 状态码) | `apps/api/src/server.ts:144,164-168` |
| C OpenAI 错误形 | 少数开放面内联业务拒绝 | `{ error: { message, type, code } }` | `apps/api/src/routes/v1-public.ts:1412-1418,1437-1444` |

要点:

- **`code` 字段有两种语义**。形状 A/A′/B 里它通常是 HTTP 状态码(401/403/429/503/400),
  只有在 429 时会被替换成业务码 1007/1008/1010(`apps/api/src/plugins/api-key-auth.ts:1064`,
  判据 `statusCode === 429 ? (e.code ?? 429) : statusCode`)。
  因此**解析顺序应为 `errorCode` → HTTP status → `code`**,不要拿 `code` 当稳定枚举。
- 上游(ai-service / 第三方模型渠道)的错误经"透传规则"翻译后,仍以形状 A 返回:
  `reply.status(passthrough.status).send(error(passthrough.status, passthrough.message))`
  (`apps/api/src/routes/v1-public.ts:1055-1059`)。**`/v1` 上没有统一的 `error.type` 分类体系** ——
  全仓检索 `invalid_request_error` / `authentication_error` / `rate_limit_error` 在 `apps/api/src` 内零命中,
  只有形状 C 的两个自定义 `type`。`docs/developer/api/error-handling.md` 里"统一 OpenAI 错误格式"的说法
  与实际不符,以本文为准(该文件不在本任务改动范围)。

## 2. 开放面 HTTP 状态 × `errorCode` 全表

### 2.1 凭据层(`apps/api/src/plugins/api-key-auth.ts`)

| HTTP | `errorCode`              | 触发条件                                                                 | 落点 |
| ---- | ------------------------ | ------------------------------------------------------------------------ | ---- |
| 401  | —                        | 未携带凭据 / key 不存在 / `status !== 'active'`(含已吊销)              | `:898,913`;`authenticateApiKey` 抛错 `:71-75` |
| 401  | —                        | secret 校验不通过(`X-Api-Secret` 值错)                                | `:919-920` |
| 401  | `SECRET_REQUIRED`        | `API_KEY_REQUIRE_SECRET=true`(默认)且未带 `X-Api-Secret`             | `:111-116,921-922`;默认值 `apps/api/src/config/index.ts:206` |
| 401  | —                        | `expiresAt` 已过期                                                       | `:927-928,505-512` |
| 401  | —                        | share token 无效/过期/已撤销,或**源 Key 已过期/已非 active**           | `:779,783,784,787,793` |
| 403  | —                        | 命中 `blockedIps`,或 `allowedIps` 非空且不在名单内(黑名单优先)         | `:932-936` → `apps/api/src/services/key-rate-window-service.ts:196-215` |
| 403  | —                        | `model` 不在 `allowedModels`                                             | `:941-942,533-541` |
| 403  | —                        | `body.max_tokens` 超 `maxTokensPerReq`(请求前预检)                    | `:946-949,548-555` |
| 403  | —                        | 权限点缺失(`requireApiKeyPermission` 老闸,`message: "Missing permission: <scope>"`) | `:1133-1135` |
| 402  | —                        | 余额/额度类拒绝(token 余额、成本余额、Key 已吊销的计费侧表达)         | `apps/api/src/routes/v1-public.ts:1335-1356` |
| 429  | —                        | 单模型 RPM / TPM(业务码 1007/1008)、Key 级窗口(1010)、Key 总量 TPM(1008) | 见第 3 节 |
| 503  | `RATE_BACKEND_UNAVAILABLE` | fail-close:限流后端不可用且请求属收紧面(`Retry-After: 5`)           | `:122-128,145-170` |

### 2.2 能力层(`apps/api/src/utils/capability-guard.ts`)

| HTTP | `errorCode`             | 触发条件                                                                 | 落点 |
| ---- | ----------------------- | ------------------------------------------------------------------------ | ---- |
| 403  | `SCOPE_REQUIRED`        | key 未授予该 scope;附 `requiredScope`                                    | `:101-107` |
| 403  | `SCOPE_REQUIRED`        | `requireAnyCapability` 全部候选都不命中;附 `requiredAnyOf` 数组          | `:144-150` |
| 403  | `M2M_FORBIDDEN`         | scope 属 `dataClass=platform` / `thirdPartyEligible=false` / 未登记 → 机器凭据不可用 | `:90-96`(`requireCapability`/`enforceCapability`)、`:189-197`(`declareCapability` 也拦) |
| 403  | `CAPABILITY_UNREGISTERED` | 路径规则表未匹配任何规则(默认拒绝);附 `method` + `path`               | `:169-175` |
| 401  | —                        | 能力闸兜底鉴权失败(`ensureApiKey` 自己跑 `authenticateApiKey`)          | `:55-79` |

判定函数 `isM2MAllowed` 在 `packages/types/src/capability-catalog.ts:1032-1037`;
`'*'` 通配**不能**穿透上表(`apps/api/src/utils/capability-guard.ts:99-100`、
`apps/api/src/plugins/api-key-auth.ts:1132` 同口径)。

### 2.3 数据层(`apps/api/src/utils/scoped-guard.ts`)

**三个对外契约码**(注释即契约,"不随内部措辞漂移",`apps/api/src/utils/scoped-guard.ts:56-60`):

| HTTP | `errorCode`                  | 触发条件                                                            | 落点 |
| ---- | ---------------------------- | ------------------------------------------------------------------- | ---- |
| 403  | `DATA_ACCESS_DENIED`         | 该能力的 `dataClass` 不允许触达目标表;**表名无法判定(裸 SQL/CTE/存储过程)同样拒绝** | 枚举 `:64`;抛出点 `:113-121`(码 `:116`,不可判定分支 `:114`);默认拒绝原则 `:28` |
| 403  | `DATA_SCOPE_DENIED`          | 模式允许触达,但本次语句越过归属边界(scoped-* 缺 owner 谓词 / 绑他人 ID) | 枚举 `:66`;抛出点 `:127-138`(码 `:133`);owner 谓词缺失分支 `ownerFilterRequired :140-146` |
| 503  | `DATA_ISOLATION_UNAVAILABLE` | 隔离前提不成立:连接确认为超级用户(RLS 必然不生效),或**生产环境**无法证实非超级用户 | 枚举 `:68`;抛出点 `:149-160`(`statusCode: 503` 在 `:158`);异步判据 `assertNonSuperuserForScopedMode :455-477`,拦截层同步版 `:483-501` |

状态码分工(不得混用,尤其"不得把 503 写成 500",`:87-89`):构造默认 403(`:105`),仅隔离不可用显式覆写 503(`:158`)。
**403 = 换一枚有权限的凭据即可解决;503 = 换凭据也没用,必须运维切非超级用户角色 / 修探测链路**(`:88-89`)。

`OWNER_FILTER_REQUIRED` / `RLS_NOT_ENFORCED` **已降级为 `reason` 细分原因**,不再作为 `errorCode` 下发
(`:69-72` 标 `@deprecated`;字段定义 `:96-97`;回填 `reason` `:136`)。另有 `PROBE_UNAVAILABLE` /
`PROBE_FAILED` 两种 `reason`(`:78-82`),同样不出现在 `errorCode` 里。**客户端只需认上表三个码。**

**注意**:该闸只在 principal 为 `kind === 'apiKey'` 且 `capability` 已注入时启动
(`isDataScopeEnforced :199-201`;零回归边界见头注释 `:30-34`),且查询必须走
`dbScoped()`/`dbReadScoped()` 出口(出口定义 `apps/api/src/db/index.ts:81,83`)。
**当前 `/v1` 路由尚无任何一处经 `dbScoped()` 取数**(全仓 `dbScoped` 引用仅出现在 `db/index.ts`、
`plugins/principal.ts`、`server.ts` 的注释/导出处及 `apps/api/tests/o4-*` 用例)。
所以这三条码现在**不会**在开放面出现 —— 属已实现、待铺开,详见 [data-classes.md](./data-classes.md) 第 5 节。

### 2.4 开放面内联业务拒绝(形状 C)

| HTTP | `error.code` / `error.type`      | 含义                                   | 落点 |
| ---- | -------------------------------- | -------------------------------------- | ---- |
| 429  | `user_concurrency_limit`         | 该归属用户的在途请求数超上限(默认 20) | `apps/api/src/routes/v1-public.ts:1409-1421` |
| 503  | `billing_unavailable`            | 定价不可用 → 计费熔断 fail-closed     | `apps/api/src/routes/v1-public.ts:1433-1445` |
| 502  | `code: 5013`                     | rerank / moderations 上游渠道未配置   | `apps/api/src/routes/v1-rerank-moderations.ts:175,275` |
| 403  | `code: 1003`                     | MCP 网关模型不在白名单(提示加 `mcp-*`) | `apps/api/src/routes/v1-mcp-gateway.ts:182,203,270` |

### 2.5 校验与相邻面(供对照)

| HTTP | `errorCode`          | 含义                                             | 落点 |
| ---- | -------------------- | ------------------------------------------------ | ---- |
| 400  | `VALIDATION_FAILED`  | Zod 校验失败 / `parseBody` 抛错                  | `apps/api/src/utils/response.ts:57-63`;`apps/api/src/server.ts:144` |
| 403  | `TARGET_NOT_CONNECTED` / `EXECUTION_FAILED` / `TIMEOUT` | **仅 `/api/agent-control` 人机交互面**(未挂能力闸,机器凭据进不来) | `apps/api/src/routes/agent-control.ts:232,251,268`;前缀 `apps/api/src/routes/index.ts:865` |
| 402  | `BUDGET_EXHAUSTED`   | 会话流式预算耗尽(`/api` 聊天流,非开放面)       | `apps/api/src/routes/ai-chat-stream.ts:195` |

## 3. 业务码 1000-1010 占用段

**已占用**(避免你自己造码撞车):

| 业务码 | HTTP | 语义                                     | 后端是否真会发出 | 落点 |
| ------ | ---- | ---------------------------------------- | ---------------- | ---- |
| 1000   | 401  | API Key 无效                             | ❌ 未发出(实际发 `code:401`) | 仅前端表 `apps/web/src/components/api-docs/ErrorCodeTable.tsx:31-36` |
| 1001   | 401  | API Key 已过期                           | ❌ 未发出(实际发 `code:401`) | 同上 `:37` |
| 1002   | 403  | IP 不在白名单                             | ❌ 未发出(实际发 `code:403`) | 同上 `:38` |
| 1003   | 403  | 模型不在白名单                            | ✅ 发出          | `apps/api/src/routes/v1-mcp-gateway.ts:182` |
| 1004   | 429  | 超过 QPM 限制                             | ❌ 未发出         | 仅前端表 `:40` |
| 1005   | 402  | 余额不足                                  | ❌ 未发出(实际发 `code:402`) | 仅前端表 `:41`;后端 `apps/api/src/routes/v1-public.ts:1345-1355` |
| 1006   | 413  | 单次 token 超限                           | ❌ 未发出(实际发 `code:403`) | 仅前端表 `:42` |
| 1007   | 429  | 超过单模型 RPM 限制                       | ✅ 发出          | `apps/api/src/plugins/api-key-auth.ts:968,851` |
| 1008   | 429  | 超过 TPM 限制(单模型 / Key 总量)         | ✅ 发出          | `apps/api/src/plugins/api-key-auth.ts:968,1044,851` |
| 1009   | 403  | API Key 不属于该租户                      | ⚠️ 已占用未发出   | 仅前端表 `:56-61`;占用说明 `apps/api/src/plugins/api-key-auth.ts:243-244` |
| 1010   | 429  | Key 级窗口(5h/1d/7d)打满                  | ✅ 发出          | `apps/api/src/plugins/api-key-auth.ts:272-291` |

关于 1010 的取号原因(注释即事实,不是猜测):
`1009` 已被"Key 不属于该租户"占用,故窗口超限新码取 `1010`
(`apps/api/src/plugins/api-key-auth.ts:243-244`)。1010 的响应头见
[rate-limits.md](./rate-limits.md) 第 6 节。

## 4. MCP 面错误码(ai-service,`apps/ai-service/app/services/capability_gate.py`)

| HTTP | `errorCode`             | 触发条件                                                          | 落点 |
| ---- | ----------------------- | ----------------------------------------------------------------- | ---- |
| 401  | —                        | 凭据缺失/无效;`X-Api-Key` 或 `Bearer ihui_*` **直连 ai-service** 被拒并提示改连 `/v1/mcp/*` | `:95-101`(PrincipalAuthError)、`:89-92`(提示语)、`:336-362` 解析顺序 |
| 403  | `SCOPE_DENIED`          | scope 不足(`:584-590`)/ `platform`·非 `thirdPartyEligible` scope 对机器通道拒绝(`:574-583`)/ 清单缺失下的外部拒绝(`:555-563`) | `:105-121`、`check_tool_access :546-591` |
| 403  | `TOOL_NOT_REGISTERED`   | 工具名不在 `capabilities.json` 的 `tool_scope` 映射 → 默认拒绝      | `:566-573`;抛错版 `:595-604` |
| 429  | `RATE_LIMITED`          | 机器通道超 `rateProfile` 配额                                     | `:127-143`(**已实现未接线**,见 [rate-limits.md](./rate-limits.md) 第 4 节) |
| 403  | `forbidden_host`        | MCP export 传输层 Host 非回环且不在白名单(DNS-rebinding 防护);体为 `{code:403, error:"forbidden_host", message}` | `apps/ai-service/app/services/mcp_export.py` 符号 `validate_request_host` / `allowed_request_hosts` / `request_host_of`,拒绝点在 `_ExportDispatcher` 的入口双闸(同文件) |

> ⚠️ **ai-service 侧行号说明**:`apps/ai-service/app/services/{capability_gate,mcp_export}.py` 在本次交付期间
> 正被其他改动并行推进,同一符号的行号在两次读取之间漂移了约 30 行。上表对这两个文件的引用**以符号名为准**
> (行号仅作定位提示);`apps/api`(TS)侧行号已逐条复核。

拒绝体形状:`{ code, message, errorCode, requiredScope }`
(`apps/ai-service/app/services/capability_gate.py:118-121`)。
`POST /api/mcp` 与 `/api/mcp/export/*` 的匿名访问已关闭
(`apps/ai-service/app/routers/mcp_official.py:246,254-257`)。

## 5. WebSocket `/v1/realtime` 关闭码(不是 HTTP 码)

`apps/api/src/routes/v1-realtime.ts:338-347`:

| close code | 含义                         |
| ---------- | ---------------------------- |
| `4001`     | API Key 无效(拒绝升级)      |
| `1003`     | 模型不在白名单               |
| `1011`     | 上游 realtime 连接失败       |
| `5014`     | 上游 realtime 渠道未配置     |

⚠️ 这里的 `1003`/`1011` 是 **WebSocket close code**,与第 3 节的 HTTP 业务码 1003 同数字不同含义;
`5014` 也未进入 HTTP 业务码表。别把它们混进同一套重试判定。

## 6. 待补:前端文档表落后于代码

`apps/web/src/components/api-docs/ErrorCodeTable.tsx`(全量枚举见 `:30-93`)是站方 `/docs` 页面的错误码表,
**当前缺以下已实现项**(本任务只读确认,不改前端代码,列此备查):

| 缺项                     | 代码侧现状                                             | 影响 |
| ------------------------ | ------------------------------------------------------ | ---- |
| 业务码 `1010`            | 已在生产路径发出(`apps/api/src/plugins/api-key-auth.ts:282`),表内止步于 1009(`:56-61`) | 窗口打满时用户查到的是"没有这个码" |
| `SECRET_REQUIRED`        | 默认开启即会命中(`:111-116,921-922`)                 | 双因子 401 无解释,易被误判成"key 失效" |
| `RATE_BACKEND_UNAVAILABLE` | fail-close 默认态可命中(`:122-128,145-170`)         | 503 被当成上游故障,退避策略错误 |
| `SCOPE_REQUIRED` / `M2M_FORBIDDEN` / `CAPABILITY_UNREGISTERED` | 均已在开放面发出(`apps/api/src/utils/capability-guard.ts:93,104,147,172,193`) | 表内只有数字码列,无 `errorCode` 维度 |
| `DATA_ACCESS_DENIED` / `DATA_SCOPE_DENIED` / `DATA_ISOLATION_UNAVAILABLE` | 契约码已定(`apps/api/src/utils/scoped-guard.ts:62-73`),待路由接 `dbScoped()` 后生效 | 同上 |
| `user_concurrency_limit` / `billing_unavailable` | 已在开放面发出(`apps/api/src/routes/v1-public.ts:1416,1442`) | 形状 C 完全不在表内 |

即:**该表目前只覆盖"数字业务码"一维,而开放面的机器可读判定实际依赖 `errorCode` 字符串。**
补齐属前端任务(不在本次允许改动清单)。

**反向漂移(表里有、后端不发)**:同一张表还列了 `2001/2002/2003/2004/2005/2006/3001/3002`
(`apps/web/src/components/api-docs/ErrorCodeTable.tsx:62-85`)。逐码在 `apps/api/src` 全量检索
(排除测试)命中数为 **0**(`2001`/`2005` 的命中经复核分别是 IPv6 示例地址 `2001:db8::` 与无关注释,
非错误码),即**这些码当前平台不会返回**。第 1 节的"表里没有的码,平台不会返回"针对的是本文;
若你在 `/docs` 页面看到上表并据此写重试分支,请以本文为准。

## 7. 处理建议(按码给动作)

1. **401**:先分辨"缺 secret"还是"key 无效" —— 有 `errorCode=SECRET_REQUIRED` 就是漏带
   `X-Api-Secret`;没有该字段说明是 key 本身(不存在/过期/已吊销)。
2. **403 带 `requiredScope` / `requiredAnyOf`**:按提示补授权(`PATCH /api/developer/api-keys/:id`),
   不要盲目重试。带 `M2M_FORBIDDEN` 表示这能力**永远不给机器凭据**,换 endpoint 而不是换 key。
3. **403 带 `CAPABILITY_UNREGISTERED`**:该端点在迁移期未登记能力,平台默认拒绝;
   改走 `/v1` 协议面等价端点或提工单。
4. **429**:一律按 `Retry-After` 退避 + 指数抖动;有 `X-RateLimit-*` 时按 `-Reset` 对齐窗口边界。
5. **503**:两种都要重试,但 `RATE_BACKEND_UNAVAILABLE` 用 5s 起步,
   `billing_unavailable` 用更长退避并告警(平台侧问题,不该计入你的失败率)。

## 8. 相关文档

- 速率与 fail-close 语义:[rate-limits.md](./rate-limits.md)
- 能力/数据分级:[data-classes.md](./data-classes.md)
- 滥用红线与吊销:[abuse-policy.md](./abuse-policy.md)
- 能力总览与红线清单:[capabilities.md](./capabilities.md)
