# 数据分级(dataClass)与「开放功能、不开放数据」

> 面向第三方 Agent 开发者。回答一个问题:**你把 API Key 交出来之后,平台到底给了你什么、没给你什么。**
> 单一事实源:`packages/types/src/capability-catalog.ts`;机器可读产物:
> `packages/types/generated/capabilities.json`(共 62 个 scope,数字为实跑
> `node scripts/check-capability-catalog.mjs --json` 与读取产物所得)。

## 1. 命题:能力可以开放,数据不行

平台的开放姿态是一句话:**开放功能,不开放数据**(设计原则见
[capabilities.md](./capabilities.md) 第 1 节)。落到实现上,是每条能力都带一个 `dataClass` 字段
(`packages/types/src/capability-catalog.ts:114-132` 的 `CapabilityEntry`,`dataClass` 在 `:118`),
它决定这次调用**在数据面上能触达什么**。

关键差别:

- `scope`(如 `chat:write`)决定**能不能进这道门** —— 由能力闸裁决;
- `dataClass` 决定**进门之后能看见多少** —— 由数据闸裁决,与 scope 正交。

只授 scope 不看 dataClass,等于把"读全库"包装成"给了一个能力位"。这是本表存在的唯一理由。

## 2. 四类 dataClass(实测分布)

| dataClass      | 数量 | 一句话含义                                     | 数据可见范围                                   | 映射的 DB 访问模式 |
| -------------- | ---- | ---------------------------------------------- | ---------------------------------------------- | ------------------ |
| `compute`      | 26   | 只消耗算力(推理/生成/检索临时输入)             | **禁止**读业务实体表,只允许写自有运行记录      | `self-metadata`    |
| `scoped-read`  | 19   | 读该能力自带的数据视图                          | 强制按凭据归属人(owner)过滤                    | `read-owned`       |
| `scoped-write` | 14   | 写自有资源(建助手、传文件、存记忆)             | 强制 owner 过滤 + 幂等键登记                   | `write-owned`      |
| `platform`     | 3    | 平台运营面(本机控制、对外发布、内部运维)       | **机器凭据一律 403,永不开放**                 | `unrestricted`     |

数量与映射均为实读:`capabilities.json` 的 `capabilities[].dataClass` 聚合
(compute 26 / scoped-read 19 / scoped-write 14 / platform 3 = 62),
`dataClass → DbAccessMode` 映射在 `packages/types/src/capability-catalog.ts:71-76`,
访问模式枚举在 `:54-63`(`forbidden` / `self-metadata` / `read-owned` / `write-owned` / `unrestricted`)。

`unrestricted` 只给 `platform` 类,而 `platform` 类对机器凭据根本进不来 ——
即"数据不受限"的那一档**永远不会被第三方 key 命中**,这是两闸串联的结果,不是 dataClass 单独保证的。

兼容说明:历史上存在 `self-metadata-implicit` 写法,由 `effectiveDataClass()` 归一为 `compute`
(`packages/types/src/capability-catalog.ts:958-963,983-986`);当前目录内无条目使用它,读产物时看到的都是四类规范值。

## 3. `compute` 的例外白名单(可写的自有表)

`compute` 不是"什么都不许写",而是"只许写自己这次调用的痕迹"。白名单
`COMPUTE_ALLOWED_TABLES`(`packages/types/src/capability-catalog.ts:82-90`):

| 表                        | 为什么算"自有运行记录"                       |
| ------------------------- | -------------------------------------------- |
| `llm_call_logs`           | 本次调用的 token/成本/时延流水                |
| `agent_runs`              | 本次 agent 执行的运行状态                     |
| `agent_checkpoints`       | 运行中间态                                     |
| `api_key_usage_windows`   | 你自己 key 的用量窗口                         |
| `webhook_delivery_logs`   | 你订阅的 webhook 投递结果                     |
| `audit_logs`              | 归因审计(见第 6 节)                          |
| `security_logs`           | 安全事件                                       |

判定规则(`apps/api/src/utils/scoped-guard.ts:154-159` 注释即口径):

- `forbidden` → 一律 `DATA_ACCESS_DENIED`;
- `self-metadata` → 仅上表白名单可写,其余 `DATA_ACCESS_DENIED`;
- `read-owned` / `write-owned` → 语句必须带 owner 谓词,否则 `OWNER_FILTER_REQUIRED`;
- **表名不可判定(裸 SQL / CTE / 存储过程)→ 默认拒绝**,绝不静默放行
  (`apps/api/src/utils/scoped-guard.ts:24` 及 `:79-87`)。

## 4. 真实 scope 举例(取自 `capabilities.json`)

标注格式:`scope`(risk / 是否计费 / 是否要求幂等键 / 第三方可申请)。

### 4.1 `compute` —— 你能拿到"结果",拿不到"别人的数据"

| scope            | risk     | billable | idem | thirdParty | 端点形态                        |
| ---------------- | -------- | -------- | ---- | ---------- | ------------------------------- |
| `models:read`    | low      | 否       | 否   | ✅         | `GET /v1/models`(元数据)      |
| `chat:write`     | high     | ✅       | 是   | ✅         | `POST /v1/chat/completions`   |
| `responses:write`| high     | ✅       | 是   | ✅         | `POST /v1/responses`          |
| `embeddings:write`| medium  | ✅       | 否   | ✅         | `POST /v1/embeddings`         |
| `images:write`   | medium   | ✅       | 否   | ✅         | 图像生成                        |
| `tools:call`     | high     | ✅       | 是   | ✅         | `POST /v1/mcp/tools/call`     |
| `realtime:connect`| high    | ✅       | 否   | ✅         | `WS /v1/realtime`             |
| `web:fetch`      | high     | ✅       | 否   | ✅         | URL 抓取(输入是你给的 URL)     |
| `sandbox:run`    | critical | 否       | 否   | ❌         | 沙箱执行(红线,见第 7 节)      |
| `im:send`        | high     | 否       | 是   | ❌         | 以你身份触达真人(红线)        |

注意 `compute` 里也混着 `thirdPartyEligible=false` 的红线能力 —— dataClass 管"数据面",
`thirdPartyEligible` 管"给不给你用",两者都要过。

### 4.2 `scoped-read` —— 读到的只有"你自己的"

| scope           | risk   | 说明                                             |
| --------------- | ------ | ------------------------------------------------ |
| `assistants:read` | low  | 只列你归属人名下的助手                            |
| `threads:read`  | medium | 会话线程,owner 过滤                              |
| `files:read`    | medium | 你上传的文件                                     |
| `memory:read`   | high   | 记忆条目(高危:内容敏感,风险档最高)             |
| `batches:read`  | low    | 你提交的批任务                                    |
| `billing:read`  | medium | 你自己的账单/额度                                |
| `codebase:read` | medium | 代码库语义检索(billable,检索结果限 owner)      |
| `connectors:read` / `skills:read` / `edu:read` | low | 清单类只读          |

### 4.3 `scoped-write` —— 写自己的资源,且要求幂等

14 个 scope **全部** `idempotencyRequired=true`(实读产物),典型:`assistants:write`、`threads:write`、
`files:write`(risk high)、`memory:write`(risk high + billable)、`knowledge:write`、`webhooks:manage`。
其中四样不对第三方开放:`diff:apply`(critical)、`connectors:write`、`skills:write`、`oauth:manage`。

幂等键的实际语义要如实说清:能力闸**登记** `Idempotency-Key` 供重放层消费,但当前**不会**因为缺键而返回 400 ——
理由写在代码注释里:OpenAI 官方 SDK 不发这个头,硬性要求会打断标准客户端互操作性
(`apps/api/src/utils/capability-guard.ts:109-115`)。`idempotencyRequired` 目前是**声明 + 登记**,
不是**强制**。幂等重放层本身在源码里标注为后续项(`:109` "供重放层(O10)消费")。

### 4.4 `platform` —— 只有 3 个,且永不开放

| scope             | risk     | 原因                                       |
| ----------------- | -------- | ------------------------------------------ |
| `computer:operate`| critical | 本机 GUI / 键鼠 / 剪贴板控制                |
| `publish:operate` | critical | 向第三方社媒发布(对外可见、不可撤回)        |
| `ops:execute`     | critical | 平台内部运维(db_query / git / 定时任务 / PR) |

三者全部 `thirdPartyEligible=false`(枚举定义 `packages/types/src/api-key.ts:142,166,174`,
注释即此意)。

## 5. 三层执行落点(以及第 2 层的真实接入面)

| 层          | 组件                                                                | 干什么                                                        | 当前状态 |
| ----------- | ------------------------------------------------------------------- | ------------------------------------------------------------- | -------- |
| 授权闸      | `apps/api/src/utils/capability-guard.ts`(`requireCapability` / `requireAnyCapability` / `requireCapabilityRules` / `declareCapability`) | 默认拒绝:未登记、platform、不可对第三方 → 403;命中则把 entry 注入 `request.capability` | ✅ 已铺开:`/v1` 178 个 handler 全部覆盖,其中 164 个强制 scope、14 个迁移期 `declareCapability`(仅登记不强制) |
| 数据闸      | `apps/api/src/utils/scoped-guard.ts`(`assertDbAccessAllowed:220` / `createScopedDb:747` / `scopedWhere:809`) | 按 dataClass 拦截 SQL;owner 谓词缺失即拒;表名不可判定即拒      | ⚠️ **机制已落地并带单测,业务路由接入面为 0** |
| 归属绑定    | `apps/api/src/utils/open-capability-gate.ts:51-56`(`bindKeyOwner`)  | 机器调用必须绑定归属人,不得脱离用户持有数据                    | ✅ `/api` 开放登记表(8 条)已挂根级 preHandler(`apps/api/src/routes/index.ts:485`) |

数据闸"接入面为 0"的具体含义(必须讲清,否则容易被误读成"数据闸在保护你"):

- 拦截器只对**新出口**生效:`dbScoped()` / `dbReadScoped()`
  (`apps/api/src/db/index.ts:81,83`,由 `createScopedDb` 包装既有 `db`/`dbRead`,同一连接池,不改连接语义);
- 启动条件:`principal.capability` 存在**且** `principal.kind === 'apiKey'`
  (`apps/api/src/utils/scoped-guard.ts:195-197`),principal 由全局插件归一
  (`apps/api/src/server.ts:438-441`);
- 全仓检索 `dbScoped` / `dbReadScoped`,除定义/导出/注释外**没有一处业务调用**
  (`apps/api/src/db/index.ts`、`apps/api/src/plugins/principal.ts`、`apps/api/src/server.ts` 之外为零),
  已有的是行为单测 `apps/api/tests/o4-data-scope-gate.test.ts`。

结论:**当前"不开放数据"主要靠第 1 层(能力闸 + 红线 scope)与端点自身的 owner 过滤实现;
第 2 层是它的机械加固,机制就绪但还没被路由接上。** 因此第 3 节的 `DATA_ACCESS_DENIED` 等三条码
现在不会在开放面出现(见 [error-codes.md](./error-codes.md) 第 2.3 节)。

## 6. 归因与审计:开放面上你做的每件事都能追到你

- 审计覆盖从「仅 `/api/`」扩到「`/api/` + `/v1/`、`/v1beta/`」,`OPEN_SURFACE_PREFIXES`
  定义在 `apps/api/src/plugins/audit-logger.ts:44`,记录范围判定在 `:309-315`;
  此前**开放面一条审计都不落**,这正是"哪把 key 调了哪个端点"无法回答的根因(该文件头注释 `:17-25`)。
- 每行审计带 `apiKeyId` / 归属 userId / capability(scope·dataClass·risk·billable·domain)/
  method / url / routePattern / statusCode / durationMs:`buildRequestAttribution()`
  `apps/api/src/plugins/audit-logger.ts:225-250`。
- **绝不记录凭据原文**:注释明确"不读 `request.apiKey.key`"(那是凭据原文,落库等同密钥泄露),
  `apps/api/src/plugins/audit-logger.ts:232-233`。
- 计费流水 `llm_call_logs` 也在顶层列写 `apiKeyId` + `clientIp` + `costCents` + `httpStatus`
  (`packages/database/src/schema/llm-call-logs.ts:61,69,71,73`;写入点
  `apps/api/src/services/relay-billing-service.ts:1148-1174`)。
- 未鉴权流量(无 key 无 JWT)同样落审计,`userId`/`apiKeyId` 为 null 但带 IP + path,
  可回答"谁在探测哪个端点"(`apps/api/src/plugins/audit-logger.ts:24-25`)。
- GET 采样默认 100%,可用 `AUDIT_LOG_GET_SAMPLE_RATE` 调低;4xx 强制全量记录以便复盘
  (`apps/api/src/plugins/audit-logger.ts:84-87,314-316`)。

正文级留存与清除口径见 [compliance.md](./compliance.md) 第 4 节。

## 7. 明确不对第三方开放的能力(红线全清单)

实读产物 `thirdPartyEligible=false` 共 **10** 项(不是"大概几项"):

| scope               | dataClass      | risk     | 为什么给不了                      |
| ------------------- | -------------- | -------- | --------------------------------- |
| `computer:operate`  | platform       | critical | 本机 GUI/键鼠/剪贴板              |
| `publish:operate`   | platform       | critical | 对外发布,不可撤回                |
| `ops:execute`       | platform       | critical | 平台内部运维                      |
| `sandbox:run`       | compute        | critical | 命令执行;开放前提是强制隔离网络且由管理员显式签发 |
| `diff:apply`        | scoped-write   | critical | 把生成内容全量写盘                |
| `browser:operate`   | compute        | high     | 浏览器自动化                      |
| `im:send`           | compute        | high     | 以调用者身份触达真人              |
| `connectors:write`  | scoped-write   | high     | 注册外部 MCP server = 注入可执行行为 |
| `skills:write`      | scoped-write   | high     | 安装技能 = 注入可执行行为         |
| `oauth:manage`      | scoped-write   | high     | 应用注册与密钥轮转(改走自助 DCR)  |

其中 `diff:apply` 有一个额外事实值得注意:守门脚本报告它**被端点闸口引用了**
(`node scripts/check-capability-catalog.mjs` 的 C 类警告 `M2M_FORBIDDEN_GATE`),
即 `apps/api/src/routes/v1-apply-diff.ts` 挂了闸,但该 scope 对机器凭据恒 403 `M2M_FORBIDDEN` ——
这是"有意只给人 JWT"(见该文件 `:36` 注释),不是漏登记。

`'*'` 通配救不了你:它只在"目录已登记且 `isM2MAllowed=true`"的范围内生效
(`packages/types/src/capability-catalog.ts:1032-1037`、
`apps/api/src/utils/capability-guard.ts:99-100`、`apps/api/src/plugins/api-key-auth.ts:1115-1132`)。

## 8. 自检与变更

```bash
pnpm capabilities:export   # 重新生成 packages/types/generated/capabilities.json
pnpm capabilities:check    # 防漂移:产物必须与目录逐字段一致
node scripts/check-capability-catalog.mjs --json   # 四项检查(产物一致/端点覆盖/scope 语义/反向核对)
```

改目录的流程(顺序不可换):scope 先加进 `packages/types/src/api-key.ts` 的枚举 →
在 `capability-catalog.ts` 登记 `dataClass`/`risk`/`billable`/`thirdPartyEligible`/`routes` →
`pnpm capabilities:export` → CI 的 `capabilities:check` + 守门脚本(guardian id 51)必须绿。
未登记的 scope 在服务启动期就会抛错(`requireCapabilityOrThrow`,
`packages/types/src/capability-catalog.ts:992-999`),目录与路由漂移不可能静默上线。

### 关于 `DECLARED_ROUTE_NOT_FOUND` 警告

全量守门当前报 **22** 条 D 类警告(目录声明了 routes 但找不到注册点)。逐条核对后原因是确定的:
这些 scope 的端点**不在 `apps/api/src/routes/` 下**(扫描器只扫这个目录,
`scripts/check-capability-catalog.mjs` 的 `ROUTES_DIR_REL` / `V1_ROUTE_FILE_RE`),
例如 `POST /api/mcp`、`POST /api/sandbox/run`、`POST /api/web/fetch` 属 ai-service(Python),
`/v1/billing/*` 等尚未落地。它们是**扫描范围局限**,不等于端点不存在;
但确实意味着"目录声明 ↔ 真实路由"的这一半只在 apps/api 侧被机械校验过。

## 9. 相关文档

- 能力总览:[capabilities.md](./capabilities.md)
- 速率与配额:[rate-limits.md](./rate-limits.md)
- 错误码:[error-codes.md](./error-codes.md)
- 滥用与封禁:[abuse-policy.md](./abuse-policy.md)
- 合规与数据留存:[compliance.md](./compliance.md)
