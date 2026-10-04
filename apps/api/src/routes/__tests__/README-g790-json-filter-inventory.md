<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# G-790 · JSON 内容过滤 vs 取值 分类清单(现读台账)

> 票号 G-790。本文件是**清单交付物**,不是计划任务文档(§1 的唯一计划文档仍是根目录 `PROJECT_PLAN.md`)。
> 放在 `apps/api/src/routes/__tests__/` 同目录,是为了让常驻尺子
> (`g790-json-filter-discriminator.test.ts`)与本清单彼此可寻;不放仓库根(`§28` 根目录整洁守门)
> 也不放 `docs/`(本票未新增文档目录条目)。
>
> **取证命令**(清单来源,任何一次复核都重跑,不得引用本文件的行数/处数当现值):
>
> ```bash
> git -c safe.directory='*' grep -n -E "json_extract|->>'|payload->>" HEAD -- apps/api/src
> git -c safe.directory='*' grep -c -E "json_extract|->>'|payload->>" HEAD -- apps/api/src
> # 本票补的两条盲区探针(原 pattern 看不见数组包含与 -> 不带 >> 的写法)
> git -c safe.directory='*' grep -n -E "@> |#>|->'" HEAD -- apps/api/src
> git -c safe.directory='*' grep -n -e "json_extract" HEAD -- apps/ai-service/app
> ```
>
> 落票现读:主 pattern **50 行 / 13 文件**;`->'`(不带 `>>`)**0 命中**;`@>` 数组包含 **2 处**
> (都在 `apps/api/src`,原 pattern 看不见);`json_extract` 在 `apps/api` **0 命中**、在
> `apps/ai-service/app/services/session_store.py` **2 处**。数字都是当次读数,派单前重跑。
>
> **判据的关键区分(票面点名):"当过滤条件用" ≠ "当取值/展示用"。** 聚合里的
> `sum((metadata->>'costCents')::numeric)` 只是取数,给它加判别列条件既无意义也会误导下一个人
> 去"修"没坏的东西;而 `WHERE metadata->>'byokMode' = 'true'` 是在**判类别**,才是本票射程。
> 聚合内的 `count(*) filter (where …)` 是第三种形态(见 C 段),单列不并桶。

---

## A. 当过滤条件用(WHERE 谓词里的 JSON 内容判类别)

| #   | 文件                                              | 稳定内容锚点(不用行号)                                                                                                                                           | 判别列现状                                                                                                    | 本票处置                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `apps/api/src/routes/developer-relay.ts`          | `conds.push(sql\`${llmCallLogs.metadata}->>'byokMode' = 'true'\`)`(`mode=byok` 分支)                                                                             | `llm_call_logs` **没有** byok 判别列                                                                          | **已改**:同 conds 里先 `conds.push(isNotNull(llmCallLogs.apiKeyId))`。依据:该顶层键今天的唯一写入者 `relay-billing-service.recordCall` 的 `apiKeyId: string` 是必填并落 `api_key_id` 列 ⇒ 对现存行是 no-op;它不是 byok 本身的列 ⇒ **真收口待迁移**(见 E 段)                                          |
| A2  | 同上                                              | ``sql\`${llmCallLogs.metadata}->>'byokMode' IS NULL OR ${llmCallLogs.metadata}->>'byokMode' != 'true'\``(`mode=relay` 分支)                                      | 同 A1                                                                                                         | **已改**:同一个判别条件覆盖两分支(`if (mode === 'byok'                                                                                                                                                                                                                                               |     | mode === 'relay')`)。否定式筛选风险更高 —— 不限定行族时,用户**任何**非 BYOK 记录都会被算成"中转站调用" |
| A3  | `apps/api/src/routes/earnings-routes.ts`          | `WHERE metadata->>'byokMode' = 'true'`(byok 抽成汇总)与 `(SELECT COUNT(DISTINCT user_id) FROM llm_call_logs WHERE metadata->>'byokMode' = 'true') AS byok_count` | 同 A1(无 byok 列)                                                                                             | **未改(不在本票文件清单)** —— 与 A1/A2 同一型、同一待迁移口径;交 `earnings-routes` 持有人按 A1 的写法同步,否则两处口径分叉                                                                                                                                                                           |
| A4  | `apps/api/src/routes/analytics.ts`                | `isNotNull(sql\`${analyticsEvents.properties}->>'path'\`)`(`/analytics/hot-pages` 的 conds)                                                                      | **已在同一 conds 数组里**:`eq(analyticsEvents.event, 'page_view')`                                            | **合规正例,未改**;由本目录测试 D5 钉成回潮锁(去掉 `event` 条件即红)                                                                                                                                                                                                                                  |
| A5  | `apps/api/src/jobs/audit-evidence-retention.ts`   | `rawHeldCond()` 内 `AND COALESCE(metadata->>'rawRetained', 'true') <> 'false'`                                                                                   | `audit_logs_chain` **无**任何独立判别列承载该事实(同型的 `raw_retained` 列只在 `llm_call_logs` 上)            | **不改,登记待迁移**:已在 `rawHeldCond()` 的 doc 注释里点名"本谓词目前只能按 JSON 内容判",并指向本清单。对照正例:`services/audit-log-service.ts` 的 `and(eq(llmCallLogs.rawRetained, true), scopeCond)` —— 同语义在**有列**的那张表上是走列的                                                         |
| A6  | `apps/api/src/services/relay-billing-service.ts`  | ``sql\`${llmCallLogs.metadata}->>'task_id' = ${taskId}\``(退款查询 conds)                                                                                        | **已带两个独立列**:`sql\`${llmCallLogs.callType} in ('image','video')\``与`eq(llmCallLogs.status, 'success')` | **合规正例,未改**(不在文件清单也不需改)。注:此处 `status='success'` 是**退款资格**判据,不是读面筛除 —— 与本票 D2/D6 那条"读面不得按 status 筛"不冲突,别把它当违规清掉                                                                                                                                |
| A7  | 同上                                              | ``sql\`COALESCE(${llmCallLogs.metadata}->>'refunded','false') <> 'true'\``                                                                                       | `refunded` **无独立列**                                                                                       | **登记待迁移**(与 A6 同一条查询,已有 callType/status 收窄 ⇒ 混入面小);真收口同 E 段                                                                                                                                                                                                                  |
| A8  | `apps/api/src/services/clawdbot/memory.ts`        | ``sql\`${userMemories.metadata}->>'internalId' = ${id}\``(get / update / forget 三处)                                                                            | 三处都带 `eq(userMemories.memoryType, DB_MEMORY_TYPE)`;get 另带 `eq(userMemories.status, 'active')`           | **判别列要求已满足,未改**(不在文件清单)。如实登记另一维:两条 UPDATE 少 `status='active'`,即"已 forgotten 的行仍可被改" —— 那是**写归属**那一维(AGENTS §「已登录不等于可以动这条数据」族),不属本票,归该文件持有人                                                                                     |
| A9  | `apps/api/src/services/order-service.ts`          | ``sql\`${outboxEvents.payload}->>'orderNo' = ${order.orderNo}\``(outbox 幂等预查)                                                                                | **已带**:`eq(outboxEvents.type, 'order.paid')`                                                                | **合规正例,未改**。这条是本票要的形状本身:幂等键 + 事件类型判别列同时进谓词,所以"明天 payload 里多一种带 orderNo 的事件"不会把幂等判成"已发过"                                                                                                                                                       |
| A10 | `apps/api/src/services/budget-alert-service.ts`   | ``sql\`${notifications.data}->>'severity' = ${severity}\``(`isInCooldown`)                                                                                       | **已带**:`eq(notifications.type, ALERT_TYPE)` + `eq(notifications.userId, …)`                                 | **合规正例,未改**                                                                                                                                                                                                                                                                                    |
| A11 | `apps/api/src/services/webhook-relay-notifier.ts` | ``sql\`${webhookSubscriptions.events} @> ${JSON.stringify([event])}::jsonb\``                                                                                    | **已带**:`eq(webhookSubscriptions.userId, userId)` + `eq(webhookSubscriptions.enabled, true)`                 | **合规正例,未改**。登记它**为什么在清单里**:数组包含 `@>` 不在票面给的 grep pattern 内 —— 只按 `->>'` 扫会整族漏掉(与守门 102 左向箭头"一条门只管自己立项那一型"同族)                                                                                                                                |
| A12 | `apps/api/src/db/registry-queries.ts`             | ``conds.push(sql\`${registryItems.categories} @> ${JSON.stringify([query.category])}::jsonb\`)``                                                                 | `registry_items` 有 `source_type` / `source` 列,但该查询里它们只在**调用方传参时**才进 conds                  | **未改、未定论(交人裁)**:语义是"跨类型按分类检索"的分面筛选,不是按内容判类别 ⇒ 加判别列会改变端点行为。本票不替持有人拍板,只把这一格从"看不见"变成"看得见并点名"                                                                                                                                     |
| A13 | `apps/ai-service/app/services/session_store.py`   | `" WHERE json_extract(metadata, '$.conversationId') = ?"`(`resolve_thread_id_for_conversation`)                                                                  | `threads` 表**没有** user_id/conversation 列(该文件自己写明"属主只存在 metadata JSON 里")                     | **未改,越界登记**:`apps/ai-service/**` 在本票禁改区。这是票面上游论证(`dwf-journal-artifacts.ts` 的"带的是嵌套 id 而不是顶层键,但明天未必")在本仓的**同型实例**;`json_extract` 这一族此前**没有任何清单覆盖**(票面 pattern 只写进标题,`apps/api` 面实测 0 命中) ⇒ 归 ai-service 持有人按同一口径复核 |

## B. 当取值/展示用(**不是**本票射程,不得加判别列条件)

| 文件                                             | 锚点形态                                                                                                | 处数(落票现读)   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ---------------- |
| `apps/api/src/routes/admin/relay-logs.ts`        | `totalCostCents: sql\`coalesce(sum(((${llmCallLogs.metadata}->>'costCents')::numeric)::int), 0)::int\`` | 1                |
| `apps/api/src/routes/admin/relay-stats.ts`       | 同型 `sum(…->>'costCents')` + `orderBy(desc(sql\`sum(…)\`))`                                            | 6(另有 1 处头注) |
| `apps/api/src/services/relay-ops-snapshot.ts`    | 同型 `sum(…->>'costCents')`                                                                             | 2                |
| `apps/api/src/services/price-history-service.ts` | `avg(coalesce(nullif(${llmCallLogs.metadata}->>'multiplier', '')::numeric, 1.0))`                       | 1(另有 1 处头注) |
| `apps/api/src/routes/analytics.ts`               | `path: sql\`…->>'path'\` 投影 + `groupBy(sql\`…->>'path'\`)`                                            | 2                |
| `apps/api/src/routes/earnings-routes.ts`         | `CASE WHEN metadata->>'byokMode' = 'true' THEN …`(分档**取数**)                                         | 8(另有 2 处头注) |
| `apps/api/src/services/relay-billing-service.ts` | `jsonb_set(…, '{refunded}', 'true')` —— **写**而非读                                                    | 2                |
| `apps/api/src/routes/developer-relay.ts`         | `sum((…->>'costCents')::numeric)` / `upstreamCostCents` / `platformFeeCents`                            | 6                |

**为什么单列一桶**:把它们混进 A 桶,清单就全是噪声,而票面点名的失效正是"混了就等于给人一张全是噪声的清单"。
**为什么 `jsonb_set` 那两处也算 B**:它是打标动作,不筛行;真按"改后不得再被算成未退"筛的是 A7 那条谓词。

## C. 第三种形态:聚合内 `filter (where …)` 的分类(既非 WHERE 也非纯取值)

`apps/api/src/routes/developer-relay.ts`:`count(*) filter (where ${llmCallLogs.metadata}->>'byokMode' = 'true')`(byok/relay 两档各 2 处,共 4 处)。

- 它**在判类别**,所以不能按 B 桶处理;
- 但它作用的行集已被 A1/A2 的 WHERE 收窄 ⇒ 判别面**继承**自 WHERE,不需要各写一遍(各处再写一份 = 两处算同一件事必漂移)。
- 如实登记的后果:`byokCallCount + relayCallCount` 在 `mode=all` 请求下**不再等于** `totalCalls`(WHERE 未加守卫时按 `mode` 分档的两列仍互斥全覆盖,但 `mode=all` 的那两列只统计"计费流水"内的分布)—— 这是 A1/A2 加条件的**预期结果**,不是新缺陷;数字口径变化需在交付报告里点名,不得读成回归。

## D. 注释/文档叙述(不在射程,但必须报名 —— 否则"扫到 0"会被读成"这一族不存在")

| 文件                                            | 锚点                                                                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/plugins/audit.ts`                 | 头注 `查询用 details->>'apiKeyId'(不改表即可回答…)` —— 描述的是**索引/列设计意图**,且 `plugins/**` 是本票禁改区 |
| `apps/api/src/routes/admin/relay-stats.ts`      | 头注 `costCents 从 metadata->>'costCents' 提取`                                                                 |
| `apps/api/src/services/budget-alert-service.ts` | 头注 `+ 通过 data->>'severity' 字段判定`                                                                        |
| `apps/api/src/services/order-service.ts`        | 头注 `先查 order.paid 事件是否已存在(按 payload->>'orderNo' 匹配)`                                              |
| `apps/api/src/routes/developer-relay.ts`        | 行注 `// BYOK 调用次数(metadata->>'byokMode'='true')`                                                           |

**为什么这一桶不能并进 A**:守门 131/134 记过同型教训 —— 判据面不剥注释就会把"解释自己"的散文判成违规;反过来,剥了注释也不该把注释里的真缺陷一起剥掉,所以这里逐条报名而不是静默跳过。

## E. 待迁移(有本票判据要求、但没有可用来收口的独立列)

| 缺口              | 表                           | 缺的那一列                                                                               | 本票为什么不加                                                                                              |
| ----------------- | ---------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| byok / relay 分档 | `llm_call_logs`              | `byok_mode boolean default false`(与既有 `api_key_id`/`status`/`call_type` 同族的判别位) | 加列属迁移,有严格规程(守门 49 的记账结构 + 185 的正文不可变),且 AGENTS 明令本票"不要为了过门新加列或写迁移" |
| 原文留存          | `audit_logs_chain`           | `raw_retained boolean notNull default true`(对齐 `llm_call_logs.raw_retained` 既有语义)  | 同上;A5 已在函数注释里点名"只能按 JSON 内容判"                                                              |
| 退款标记          | `llm_call_logs`              | `refunded boolean`(现只活在 `metadata.refunded`,由 `jsonb_set` 打)                       | 同上;A7 只登记                                                                                              |
| 引擎会话归属      | `threads`(ai-service,SQLite) | `user_id` / `conversation_id` 列                                                         | 越界(禁改区)+ 属 ai-service 存储层设计决策,归其持有人                                                       |

**这四格的共同点**:今天的正确性靠"只有某一族写入者会写那个键"这一**巧合**,而巧合不是约束。
迁移落地前,读面只能用**既有**独立列尽力收窄(A1/A2 用 `api_key_id IS NOT NULL`),并在本清单里点名,
而不是等某天数据流混入无关条目再回头找原因。

## F. 本票的问责出口(判据必须在有人跑它的那一刻才成立)

```bash
# 判别列进谓词 + 失败态留在读面(含变异对照 D4、尺子失效方向 D0)
cd apps/api && ./node_modules/.bin/vitest run \
  src/routes/__tests__/g790-json-filter-discriminator.test.ts \
  src/routes/__tests__/conversation-import.test.ts
```

- **变异自证(落地当轮实测)**:把 `conds.push(isNotNull(llmCallLogs.apiKeyId))` 那一行摘掉重跑
  ⇒ D1、D2 翻红(各 3 次 retry),D0/D3/D4/D5 保持绿 ⇒ 说明"干扰行被排除"这件事**真的**由判别列提供,
  而不是尺子恒假;还原后 8/8 绿。
- **真库那一格未覆盖(如实登记,不得读成已收口)**:本清单与测试判的是**谓词形状**与**读面映射**;
  PG 真库的分页/排序行为(票面验收里"真库分页行为需环境")本机可连但**本票未跑**,
  属 `vitest.real.config.ts` 档(`§5` 测试隔离铁律:mock 用例绝不写生产库)。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
