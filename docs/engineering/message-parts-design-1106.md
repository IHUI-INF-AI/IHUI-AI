<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 消息数据模型:有类型的 message parts · 设计稿

> 票面:消息数据模型 part 化(2026-11-07)。
> 状态:**设计稿,未实现**。本文件只描述目标模型、兼容与回滚、迁移步骤与代价;**不改 schema、不改代码**。
> 分支 / 基点:`docs/message-parts-design-1106` ← `origin/main`。
> 范围:`chat_messages` **单条消息的展示内容**。会话级 metadata、SSE 流式契约、chat-sync 传输契约不在本票范围内(见 §8)。

---

## 0. 结论(TL;DR)

1. 目标模型 = `chat_messages.parts jsonb` 存一份**有序、有判别联集**的 part 文档;`content / reasoning / metadata` 三列继续保留并继续双写,作为旧端契约与 legacy 投影。
2. 首批 13 种 part:`text / reasoning / image / video / file / quote / tool_call / tool_result / terminal / plan / citation / injection / subagent`。
3. 兼容性核心:parts 是 `(role, content, reasoning, metadata)` 的**纯函数派生**;文档头 `basis` 是这三者的指纹,读时指纹不符立即改走派生。存量行**不依赖任何回填**也能正确读出。
4. v1 的 parts **不携带任何 legacy 三列无法表达的新信息**,因此回滚 = 忽略或删除派生列,零数据丢失(§5.4 给出论证)。
5. 存储选型:新增 1 个可空 `jsonb` 列;**不建表、不加索引**。`ADD COLUMN`(可空、无默认)在主库 PG 11+ 上是 O(1) 元数据变更,不重写表。
6. 本票明确不动:SSE、chat-sync、ai-service、四端旧客户端、LLM 上下文拼装、归档格式(§8 逐条)。

---

## 1. 现状审计(硬数字)

### 1.1 表结构

- `chat_messages` 现有 **13 列**(`id / conversation_id / role / content / tokens / metadata / created_at / reasoning / turn_ordinal / parent_message_id / sibling_index / pinned_at / bookmarked_at`),定义见 [chat.ts:102-130](../../packages/database/src/schema/chat.ts#L102-L130)。
- **4 个索引**:`ix_chat_messages_conversation`、`idx_chat_messages_by_turn`、`ix_chat_messages_created_at`、`ix_chat_messages_conv_pinned`([chat.ts:131-144](../../packages/database/src/schema/chat.ts#L131-L144))。`metadata` 上**没有 GIN/BTREE**,当前只做整键读写。
- `content` 为 `text NOT NULL`,写入侧有 64KB 上限;`reasoning` 为可空 `text`;`metadata` 为 `jsonb default '{}'`。
- 仓库现有 **369** 条 SQL 迁移(与 `drizzle/meta/_journal.json` 条目数一致),最新一条为 `20261106150000_fix_missing_indexes_fks.sql`。本票若实施,将是第 **370** 条,建议命名 `20261107120000_message_parts.sql`。

### 1.2 写入面(共 9 条路径)

| # | 路径 | 位置 | 写入列 |
|---|---|---|---|
| 1 | `createMessage`(用户消息 / 助手占位 / 常规) | [chat-queries.ts:1255](../../apps/api/src/db/chat-queries.ts#L1255),insert @1278 | content, metadata, reasoning, tokens |
| 2 | `updateMessage`(AI 回调落库) | [chat-queries.ts:1330](../../apps/api/src/db/chat-queries.ts#L1330),set @1351 | content, reasoning, tokens, metadata(**整体替换**) |
| 3 | `editAiMessageAsVersion`(再生版本行) | [chat-queries.ts:1433](../../apps/api/src/db/chat-queries.ts#L1433),insert @1467 | content + 继承 reasoning/metadata |
| 4 | `editMessageAndTruncateAfter`(编辑并截断) | [chat-queries.ts:1606](../../apps/api/src/db/chat-queries.ts#L1606),set @1620 | **只写 content** |
| 5 | 会话分叉复制 | [chat-queries.ts:1874](../../apps/api/src/db/chat-queries.ts#L1874) | 复制全部业务列(不含本次新增 parts) |
| 6 | `replaceMessages`(压缩重写:先删后插) | [chat-queries.ts:1929](../../apps/api/src/db/chat-queries.ts#L1929),insert @1947 | content, reasoning, tokens, metadata |
| 7 | 会话导入(原始 insert) | [conversation-import.ts:237](../../apps/api/src/routes/conversation-import.ts#L237) | 只写 role/content/reasoning/tokens |
| 8 | 消息转存(原始 insert) | [message.ts:582](../../apps/api/src/routes/message.ts#L582) | 只写 role/content |
| 9 | 巡检助手(原始 insert) | [patrol-scheduler.ts:211](../../apps/api/src/services/patrol-scheduler.ts#L211) | 只写 role/content |

> 结论:写入面**不是单点**。任何"只在 `createMessage` 里算 parts"的方案都会漏 3 条原始 insert(其中 2 条本就没有 metadata)。因此读时派生是兼容性主路径,写入补齐是性能优化(§5.1、§7)。

### 1.3 读取面

- `serializeMessage` 是唯一消息序列化点([chat.ts:401](../../apps/api/src/routes/chat.ts#L401));`metadataFace: 'full' | 'summary'` 见 [chat.ts:430](../../apps/api/src/routes/chat.ts#L430)。
- 会话历史列表分页显式走 `summary`([chat.ts:1158](../../apps/api/src/routes/chat.ts#L1158));全量 metadata 由 D35 懒取端点提供([chat.ts:1234-1241](../../apps/api/src/routes/chat.ts#L1234-L1241))。
- chat-sync 的 resync 快照**只返回 `content / reasoning / rev`**,不带 metadata([chat.ts:1169-1176](../../apps/api/src/routes/chat.ts#L1169-L1176),契约见 [chat-sync-contract.md](./chat-sync-contract.md))。
- 消费端 4 个:web(`history-message.ts`)、RN(`chat-render-model.ts`)、小程序(`server-chat-replay.ts`)、扩展(`element-pack-replay.ts`),全部**直接读 metadata 键**。

### 1.4 消息级 metadata 键清单(22 个)

写入构造点:[ai-callback.ts:371-416](../../apps/api/src/routes/ai-callback.ts#L371-L416);`elementPack` 由 Worker 消费暂存表后合并([ai-callback-worker.ts:92-135](../../apps/api/src/workers/ai-callback-worker.ts#L92-L135))。

> presence 规则(投影必须逐字保持):`model / usage / stub` **恒写**;7 个结构化通道(`toolCalls / terminalTasks / planSteps / citations / injections / memoryUpdates / steerApplied`)**空数组不写键**;`queueItems` **恒写(含空数组)**;`interrupted` 仅在真中断时写,`interrupt_reason` 缺省不写。Worker 侧是**浅合并** `{...prevMeta, ...metadata}`。

`model`、`usage`、`stub`、`toolCalls`、`terminalTasks`、`planSteps`、`citations`、`injections`、`compaction`、`retryNotice`、`usageDetail`、`fallback`、`memoryUpdates`、`steerApplied`、`queueItems`、`interrupted`、`interrupt_reason`、`permissionMode`、`elementPack`、`editedFromMessageId`、`questionId`、`isAnswer` = **22 个**。

### 1.5 现有体积护栏(设计据此做代价模型,不改动)

| 护栏 | 位置 | 值 |
|---|---|---|
| 用户消息正文 | API 入参校验([chat.ts:303](../../apps/api/src/routes/chat.ts#L303)) | 64KB/条 |
| metadata 单值 | `capMetadataObject`([ai-callback.ts:366-371](../../apps/api/src/routes/ai-callback.ts#L366-L371)) | 64KB/值,超限降级为 `{truncated:true, originalBytes}` |
| 工具入参 | `_TOOL_ARGS_PERSIST_LIMIT`([llm.py:7981](../../apps/ai-service/app/routers/llm.py#L7981)) | 2000 字符/次 |
| 工具结果 | `_TOOL_RESULT_PERSIST_LIMIT`([llm.py:7982](../../apps/ai-service/app/routers/llm.py#L7982)) | 8000 字符/次 |
| 排队快照 | `capQueueItems` | 8 条 × 2000 字符 |

### 1.6 三个现存缺陷(本设计必须解掉,但不借机重构)

1. **附件只能从正文反解**:用户上传的图片/视频/文件在发送侧被拍平成正文(D129),渲染端用正则再拆([user-message-parts.ts](../../packages/shared/src/chat/user-message-parts.ts))。结构化信息丢失,渲染依赖字符串形态。
2. **内容与事实混住**:`toolCalls / terminalTasks / planSteps / citations / injections / elementPack` 是**排版内容**,`model / usage / usageDetail / permissionMode` 是**消息级事实**,却同住一个 jsonb。
3. **编辑路径会制造陈旧派生**:`editMessageAndTruncateAfter` 只写 `content`([chat-queries.ts:1620-1623](../../apps/api/src/db/chat-queries.ts#L1620-L1623))。任何"按 metadata 缓存渲染视图"的实现,在这一步之后都会与正文不一致。

---

## 2. 设计原则(硬不变量)

- **I1 单一派生**:`parts = derive(role, content, reasoning, metadata)`,纯函数,无 IO、无时钟、无随机、无服务端配置依赖。
- **I2 旧面逐字不动**:任何写入不得改变 `content / reasoning / metadata` 的既有值与既有 presence 规则;旧端只读这三列。
- **I3 失效只多不少**:parts 缺失、指纹不符、通道类型异常时,**降级为 legacy 渲染**,绝不丢内容(仓内既有原则,见 [presentation-units.ts:19-22](../../apps/web/src/components/chat/message-list/presentation-units.ts#L19-L22))。
- **I4 窗口坐标系不动**:parts 只在"一条消息块内部"生效,不改"一条消息 = 一个滚动窗口行"([presentation-units.ts:9-17](../../apps/web/src/components/chat/message-list/presentation-units.ts#L9-L17))。禁止把 part 当成新的窗口行。
- **I5 投影完整**:任何 part 字段都必须落在 legacy 三列里可还原(§4 投影列);v1 禁止出现 part-only 信息(这是回滚零丢失的前提)。

---

## 3. 目标 parts 模型

### 3.1 文档结构

```ts
interface MessagePartsDoc {
  v: 1
  /** legacy 三元组指纹:sha256-16(fixedConcat(content, reasoning, stableJson(metadata))) */
  basis: string
  /** 语义有序;空数组时整列写 NULL,省存储 */
  parts: Part[]
}
```

- 物理列:`chat_messages.parts jsonb NULL`。**不建独立表、不建索引**。
- 派生结果为空 → 写 `NULL`(等价于空数组);读时 `NULL` 一律走派生。
- `basis` 的目的:parts 是缓存。任何绕过 9 条写点、或回滚期由旧代码写 `content` 的情况,读取侧凭指纹**立即发现并改走派生**,不会读到陈旧 part(§5.3 错序矩阵)。

### 3.2 信封(消息级事实,不进 parts)

判据:**不参与消息内排版顺序**。满足任一条即信封:消息级指标/归属坐标、提示行与徽章、侧栏快照、版本/编辑来源。

| 信封键 | 为什么不是 part | v1 物理位置 |
|---|---|---|
| `model` / `usage` / `stub` | 消息级事实,无位置语义 | metadata(原样) |
| `usageDetail` | 计费明细,徽章渲染 | metadata |
| `compaction` | 压缩分隔提示,归属"本轮"而非消息内某位置 | metadata |
| `retryNotice` | 重试提示行 | metadata |
| `fallback` | 降级提示行 | metadata |
| `memoryUpdates` | 记忆写入提示条 | metadata |
| `steerApplied` | 中途引导提示条 | metadata |
| `queueItems` | 侧栏排队快照(且有空数组=清空的特殊 presence) | metadata |
| `interrupted` / `interrupt_reason` | 消息级中断标注 | metadata |
| `permissionMode` | 权限档盖章 | metadata |
| `editedFromMessageId` | 版本来源坐标 | metadata |
| `questionId` / `isAnswer` | 问答归属坐标(用户消息) | metadata |

> 选择:信封键**不搬家、不复制**。新端继续从 metadata 读(类型已存在),避免同值双存与迁移面扩大。若未来要独立成列,是另一个票。

### 3.3 Part 判别联集(v1:13 种)

所有 part 都是 `{ type: '...' } & 逆变性字段`。**字段名沿用既有协议名**(如 `toolName / status / args`),不做无收益改名,降低投影风险。

#### 3.3.1 文本与思考

| kind | 字段 | 必填 | 来源 |
|---|---|---|---|
| `text` | `text: string` | 是 | `content`(逐字) |
| `reasoning` | `text: string` | 是 | `reasoning`(逐字) |

- 空字符串不产 part;整条消息可只有工具/计划而无 text。
- `text` 不拆段、不做任何归一化(v1 保证 `projectContent(parts) === content` 字符串逐字相等)。

#### 3.3.2 用户附件(派生自正文,D129 同口径)

| kind | 字段 | 必填 | 说明 |
|---|---|---|---|
| `image` | `url: string`、`alt: string`、`raw: string`、`range: [number, number]` | 是 | `raw` 是正文中的原始子串,`range` 为 **UTF-16 码元** `[start, end)`(与 JS `String#slice` 同语义;v1 生产/消费端全是 JS/TS) |
| `video` | `url: string`、`raw: string`、`range: [number, number]` | 是 | 同上 |
| `file` | `name: string`、`url?: string`、`raw: string`、`range: [number, number]` | 是 | `name` 取自 D129 的文件引用形态 |
| `quote` | `label: string`、`lines: string[]`、`raw: string`、`range: [number, number]` | 是 | 引用回复块 |

- **v1 只对 `role='user'` 产生这四类 part**,识别口径与 `splitUserMessageParts` 一致(仅新增 `raw/range` 两个字段,不改其对外行为与调用方)。
- `text` part 仍承载**完整原文**,上述 part 是"带区间的类型化索引"。这样 assistant 正文的 markdown 渲染、用户正文的既有渲染都**零变化**;新端要单独渲染附件时,按 `range` 从 text 中剔除即可。分段化正文(把 text 拆成多段)是 v2 的纯派生升级,**不需要改 schema**。
- 代码块(`codeBlocks`)与独立文件 chip **不产 part**:markdown 渲染器已处理,且无"独立定位渲染"需求;若未来要代码块工具栏,再单列一个 kind(先补映射行)。

#### 3.3.3 工具与终端

| kind | 字段 | 必填 | 说明 |
|---|---|---|---|
| `tool_call` | `id: string`、`toolName: string`、`status: 'running'\|'success'\|'error'\|'cancelled'`、`ordinal: number` | 是 | 其余 legacy 键(`args / iteration / repeated / serverSource / serverId / serverName / startedAt / endedAt / durationMs`)**原样展开在 part 上**,未登记的未来键也因此自动保留,不设任何"袋子"字段 |
| `tool_result` | `callId: string`、`output: unknown`、`isError?: true` | 是(callId/output) | `output` 是 legacy `result` 的逐字值(任意 JSON,不截断、不重排);`durationMs` 留在 call part,避免"无 result 但有耗时"的行丢字段 |

- 1 个 legacy `toolCalls[i]` → 1 个 `tool_call` + 0/1 个 `tool_result`(仅当 legacy 存在 `result` 键)。
- `isError` 只在真错误时出现(与写入端 presence 一致;`status` 逐字保留,不重算)。
- `terminal` 为独立 kind,不是 `tool_call` 的特例:legacy 是**独立通道**、独立渲染区。
- 终端 kind 字段:`id / command / status / output? / truncated? / totalChars? / exitCode? / startedAt / endedAt? / durationMs?`,其余键原样展开。

#### 3.3.4 计划 / 引用 / 注入 / 子代理

| kind | 字段 | 必填 | 说明 |
|---|---|---|---|
| `plan` | `steps: PlanStep[]` | 是 | 整个 `planSteps` 快照 → **1 个 part**(顺序即数组顺序) |
| `citation` | `source: string`、`label: string`、`url?: string`,其余键原样 | 是 | 每个 citation 一项 → 1 个 part |
| `injection` | 其余键原样(至少含 `kind`) | 是(`kind`) | 每个 injection 一项 → 1 个 part |
| `subagent` | `frames: ElementPackFrame[]` | 是 | `elementPack.frames` **整数组逐字**放进 1 个 part(不按子代理折叠,保序无损) |

#### 3.3.5 数组顺序(语义顺序)

```text
plan(0) → reasoning(1) → text / image / video / file / quote(2,按 range) →
tool_call / tool_result(3,按 legacy 数组序) → terminal(4) → injection(5) →
citation(6) → subagent(7)
```

这是"文档顺序 = 语义顺序"。渲染接入阶段(M5 之后)必须与 [MessageItem.tsx] 现有堆叠逐段对齐,**不得借机重排**;顺序差异按实现 bug 处理。

---

## 4. metadata 落位对照表(22 行,逐键,无兜底)

> 术语:**part** = 写入 `parts` 数组;**信封** = 仅留 metadata,不进 parts;**投影** = 从 parts 还原 legacy 值的确定性规则(v2 权威翻转时使用;v1 只用于校验)。

| # | 现有键 | v1 落位 | legacy 投影规则 | 备注 |
|---|---|---|---|---|
| 1 | `model` | 信封 | 原样保留 | 标量恒写 |
| 2 | `usage` | 信封 | 原样保留 | 标量恒写 |
| 3 | `stub` | 信封 | 原样保留 | 标量恒写 |
| 4 | `toolCalls` | part: N×`tool_call` + (有 result 时)`tool_result` | 按 `ordinal` 升序合并 `{...call minus type/ordinal}` 与 `{result: output, isError?}`;presence 逐字 | 拆分无损:未登记键随 call part 展开保留 |
| 5 | `terminalTasks` | part: N×`terminal` | 按数组序删 `type` | 原样展开 |
| 6 | `planSteps` | part: 1×`plan` | `part.steps` | 空数组不产 part(与写入口径一致) |
| 7 | `citations` | part: N×`citation` | 按数组序删 `type` | 数量与裁剪沿用上游,不新增裁剪 |
| 8 | `injections` | part: N×`injection` | 按数组序删 `type` | 原样展开 |
| 9 | `compaction` | 信封 | 原样保留 | 压缩提示,非消息内位置 |
| 10 | `retryNotice` | 信封 | 原样保留 | 提示行 |
| 11 | `usageDetail` | 信封 | 原样保留 | 计费明细 |
| 12 | `fallback` | 信封 | 原样保留 | 提示行 |
| 13 | `memoryUpdates` | 信封 | 原样保留 | 提示条 |
| 14 | `steerApplied` | 信封 | 原样保留 | 提示条 |
| 15 | `queueItems` | 信封 | 原样保留 | 侧栏快照;**恒写(含 `[]`)** 的语义绝不能动 |
| 16 | `interrupted` | 信封 | 原样保留 | 仅真中断写 |
| 17 | `interrupt_reason` | 信封 | 原样保留 | 缺省不写键 |
| 18 | `permissionMode` | 信封 | 原样保留 | 盖章 |
| 19 | `elementPack` | part: 0/1×`subagent` | `{frames: part.frames}` | 帧数组逐字,保序 |
| 20 | `editedFromMessageId` | 信封 | 原样保留 | 版本来源 |
| 21 | `questionId` | 信封 | 原样保留 | 问答归属 |
| 22 | `isAnswer` | 信封 | 原样保留 | 问答归属 |

### 4.1 非 metadata 来源(3 行,一并登记)

| 来源 | 落位 | 投影规则 |
|---|---|---|
| `content` | 1×`text`(逐字) | `parts` 中 `text` 的 `text` 字段;无 text part ⇒ `''` |
| `reasoning` | 1×`reasoning`(逐字) | `parts` 中 `reasoning` 的 `text`;无 ⇒ `null` |
| `role='user'` 的正文附件 | `image / video / file / quote`(带 `raw` + `range`) | 不参与投影(text part 已含原文) |

### 4.2 未登记键策略(不是兜底,是边界)

- v1 **不消费**未登记键:它们原样留在 `metadata`(v1 不删 metadata、不搬家),**不复制进 parts**,也**没有** `misc / extra / other / meta` 这类 part 或字段。
- 运行时遇到未登记键 → 只增计数器 `chat_parts_unmapped_metadata_key`(低基数:固定枚举 + hash),不改变渲染。
- 晋升规则:先在本表补 1 行 + 补 1 条 round-trip 用例,才允许进 parts。**禁止先写代码后补表**。
- 反向要求:表中每一行的"投影"必须被属性测试覆盖;没有用例的映射视为未完成。

---

## 5. 兼容性方案(重点)

### 5.1 存量行 → parts(读时转换)

读路径统一做三步(位置在 `serializeMessage` 与懒取端点):

```
stored = row.parts
if (stored && stored.v === 1 && stored.basis === basisOf(row)) → 用 stored
else → parts = derive(row); 标记 source='derived'
```

- **确定性**:同输入永远同输出;`derive` 内部不含时间、随机、locale、feature flag。
- **指纹**(`basis`)固定拼接:`content + '\u0000' + (reasoning ?? '') + '\u0000' + stableJson(metadata)` → sha256 取前 16 字节 hex。`stableJson` 递归键排序、`undefined` 不写、`null` 保留。
- **容错**:`metadata` 非对象、通道非数组、单项非对象 ⇒ 跳过该通道,其余照常派生;**任何情况不得抛错**(I3)。
- **空值**:`content=''` 且无其它通道 ⇒ `parts=[]`,与 NULL 等价。
- **未知 role**:不产 text/reasoning 之外的任何通道(按内容原样),不报错。
- 读路径**不回写**(无读副作用);陈旧/缺失由回填与写点负责。

### 5.2 新行 → 旧端(写时降级)

- 写入顺序:**先算 legacy 值,再派生 parts,同一条 INSERT/UPDATE 落库**。legacy 三列的值与 presence 规则由 §4 投影列逐字保持(即"parts 只是附带列")。
- HTTP / WS 响应新增 `parts` 字段,旧端 JSON 解析**忽略未知字段**;`content / reasoning / metadata` 的值与今天**逐字节相同**。
- **chat-sync 不新增任何字段**:resync 快照仍只带 `content / reasoning / rev`,不升 payload kind、不改协议版本。需要 parts 的端走历史列表/懒取端点(§5.5)。
- SSE 流式契约不动:parts 在**落库时**生成,流式期间仍按既有 SSE 事件渲染(见 §8)。

### 5.3 滚动发布 / 错序矩阵

| API 版本 | 写入方 | 读取方 | 结果 | 依据 |
|---|---|---|---|---|
| 旧 | 旧 | 旧 | 旧代码不感知 parts 列(不读不写),行为不变 | 迁移列可空 |
| 新 | 新 | 旧 | 旧端只见三列,逐字不变 | 新增字段被忽略 |
| 新 | 旧(滚动中残留的旧节点) | 新 | `parts=NULL` ⇒ 读时派生 | §5.1 |
| 旧 API 覆盖新 API(回滚中途) | 旧 | 新 | 旧代码编辑只改 `content` ⇒ `basis` 不符 ⇒ 派生,不会读到陈旧 part | 指纹校验 |
| 任意 | 任意 | 任意 | 原始 insert 的 3 条路径(无 metadata)⇒ 派生 | §1.2 |

**关键前提**:`parts` 列必须在任何新代码上线**之前**先建好;否则新代码的 INSERT 会因未知列报错。因此发布序固定为 `M1 → M2`(§7)。

### 5.4 回滚策略(五级,逐级可停)

| 级别 | 动作 | 数据风险 | 恢复方式 |
|---|---|---|---|
| R1 客户端 | 关 `parts` 渲染开关,只读 legacy | 零 | 重开开关 |
| R2 服务端 | `CHAT_MESSAGE_PARTS=off`:不写、不回传 parts | 零(列与值留原地) | 重开开关 |
| R3 数据 | `UPDATE chat_messages SET parts = NULL WHERE ...` | 零(parts 是派生缓存) | 重跑回填 |
| R4 结构 | `ALTER TABLE chat_messages DROP COLUMN parts` | 零(legacy 完好) | 重建列 + 回填 |
| R5 长期 | 永不删 legacy 三列/键;停用 legacy 需另立项目(四端全迁 + 契约 v2 + 观察窗) | — | — |

**为什么"退回去不丢数据"**(逐条论证):

1. v1 的每一个 part 字段都能在 §4 表中追溯到 legacy(内容/列/键),不存在只存在于 parts 的信息(I5)。
2. v1 的任何代码路径**不从 parts 写 legacy**;回滚只需停止读取/派生写入。
3. 读取侧在 `parts` 缺失、版本不符、指纹不符、解析异常时全部降级到 legacy(I3)。
4. 因此删除 parts 列的语义 = 删除一份可随时重算的缓存。

**什么情况下会丢(因此被明确禁止)**:若 v2 引入"legacy 无法表达"的字段(如附件二进制引用、part 级时间线)而未同时给出完整投影,则 R3/R4 会丢。故 v2 的准入门禁是:先让 `project(derive(x)) ≡ x` 与 `project(parts)` 全覆盖的属性测试转绿,再允许权威翻转。

### 5.5 读取交付面(新增,不是改造)

- `serializeMessage` 增 `partsFace: 'full' | 'summary' = 'full'`,与既有 `metadataFace` 同形:
  - `summary` 只保留 `{type, ...小字段}`;`tool_result.output`、`terminal.output`、`subagent.frames` 换成 `{summary:true, bytes}` 占位,**text/reasoning/plan/citation/injection 不摘要**(否则新端无法渲染)。
  - 列表分页在既有 `'summary'` 调用点([chat.ts:1158](../../apps/api/src/routes/chat.ts#L1158))一并传 `partsFace:'summary'`;其余调用点保持 `full`。
- 新增懒取端点 `GET /conversations/:id/messages/:messageId/parts`,形态与 D35 metadata 端点同构(同鉴权/同归属校验),返回 `{parts, v, source:'stored'|'derived'}`。
- 响应增 `partsSummary: {count, kinds, hasSummarized}` 供端侧决定是否懒取(与既有 `hasSummarizedMetadata` 同思路)。
- 旧端不请求这两个新面 ⇒ 零回归。

---

## 6. 存储与索引代价

### 6.1 三方案对比

| 维度 | A. 单 jsonb 列(**选定**) | B. 独立 `chat_message_parts` 表 | C. 双写过渡(列 + legacy → 停写 legacy) |
|---|---|---|---|
| 新增存储 | 1 列;消息载荷重复一份(TOAST 压缩后约 0.5–1× 原载荷字节,**估算,以实测为准**) | 每个 part 1 行 + 排序/外键;**中位 2–3 行/消息,p95 20–40 行(估算)** | 同 A,另加迁移期"两处真相" |
| 索引 | **+0**(不建 GIN/BTREE) | `(message_id, ordinal)` B-tree,约 24–40B/行 + 页开销 | 同 A |
| 读放大 | 0 次额外查询;列表页 1 次读 | 历史 30 条 ⇒ +90–1200 行,需二次查询/批量 join | 0 |
| 写放大 | 与今天相同的 1 次行写(parts 随行写) | part 逐条 insert/update;9 条写点全部改写 | 同 A |
| 迁移步数 | 1 列 + 回填 | 1 表 + FK + 顺序列 + 9 写点 + 回填 + 删除/重写路径 | 2 阶段(先双写,再停 legacy) |
| 回滚 | 置 NULL / DROP 列(无损) | DROP 表(无损,但影响 4 端查询) | 需回切 legacy 读写,风险最高 |
| 查询能力 | 只能整条读(**本票不需要按 part 检索**) | 可按 kind/toolName 检索 | 同 A |
| 实现面 | 1 派生 + 1 投影 + 1 序列化面 | 另有 part 级 CRUD、顺序、级联、压缩重写 | 两套写路径长期并存 |
| 失效模式 | 陈旧缓存(由 `basis` 挡住) | 漏插/乱序/孤儿行 | 双写不一致 |

**选 A 的理由**:本票的需求是"有类型的读模型",不是"按 part 检索";B 的查询能力用不上,却把 9 条写路径与 `replaceMessages` 的删除重建全部放大。等真实出现"按工具名/引用跨消息检索"时,再从 A 投影出 B(有 `parts` 作为源,建表成本可控)。

### 6.2 空间代价模型(可核算,不拍脑袋)

单条消息的 parts 字节近似:

```
parts_bytes ≈ JSON 开销(~40B/part)
            + len(content) + len(reasoning)                       // text/reasoning 重复
            + Σ(len(args) ≤ 2000 + len(result) ≤ 8000)             // tool_call/tool_result 重复
            + len(planSteps) + len(citations) + len(injections)
            + len(elementPack.frames)
            + Σ(len(raw))                                          // 用户附件索引(短)
```

- **上界**:由于 legacy 单值 64KB、args/result 已截断,parts 不会超过"legacy 载荷 + 约 20% 键名开销 + 40B/part";实际不是无界增长。
- **TOAST 事实**:PostgreSQL 对 > ~2KB 的列值做行外存储并压缩。因此主堆行只多 **8B 指针**,`parts` 的重复载荷主要落在 TOAST 关系(压缩后典型为原载荷的 0.5–1×)。
- **索引代价 = 0**:无新索引 ⇒ 写路径没有额外索引维护,空间与写吞吐都不因索引变差。
- **DDL 代价**:`ADD COLUMN parts jsonb`(可空、无默认)在 PG 11+ 是仅改 catalog 的 O(1) 操作,不重写表、不重建索引;`DROP COLUMN` 同理,但有短时 `ACCESS EXCLUSIVE` 锁窗口,须低峰执行。
- **回填代价**:O(N) 次单行 UPDATE;每行重写堆行 + 可能的 TOAST。按 500 行/批、批间休眠可中断;总耗时以实测为准。

**上线前必须实测的三个数**(未测出不得拍板生产):

```sql
-- ① 现有体量(基线)
SELECT pg_size_pretty(pg_total_relation_size('chat_messages')) AS total,
       pg_size_pretty(pg_relation_size('chat_messages'))       AS heap,
       pg_size_pretty(pg_indexes_size('chat_messages'))        AS idx;

-- ② 派生结果分布(影子表或 dry-run 脚本产出 CSV 后用 percentile_disc 统计)
--    目标:得到 p50/p95/p99 的 jsonb 字节数与"消息载荷增长比"
SELECT percentile_disc(0.95) WITHIN GROUP (ORDER BY parts_bytes) AS p95,
       percentile_disc(0.99) WITHIN GROUP (ORDER BY parts_bytes) AS p99
FROM   chat_parts_dryrun;
```

**切换阈值(建议,需机主拍板)**:p99 `parts` ≤ 256KB 且平均行载荷增长 ≤ 60% ⇒ 维持 A;任一超限 ⇒ 改为 B(独立表),或对 `tool_result.output` 采用"正文落对象存储、parts 存引用"的变体(该变体会引入 part-only 信息,回滚等级降为 R1/R2,需重新论证)。

### 6.3 读写性能预算

- 写:派生 CPU 与载荷线性;与今天同一次行写,无额外 IO。
- 读:每条消息多一次 `stableJson + sha256`。按一页 30 条 × 10KB ≈ 300KB 哈希,预算 **< 1ms**;超出则在列表页只校验 `parts` 非空的行,并在回填完成后取消读时派生。
- 列表 payload:summary 面只增 `{type}` 与小字段;`tool_result/terminal/subagent` 用占位,避免把已截断的 8KB 结果再传一遍。

### 6.4 若选 B / C 的迁移步骤(备案,本票不采用)

- **B. 独立表**(`chat_message_parts(id, message_id, ordinal, kind, payload jsonb)`):
  1. 建表 + `(message_id, ordinal)` 唯一约束 + 外键 `ON DELETE CASCADE`;
  2. 9 条写点改为"删旧 part 行 + 批量插入";
  3. `replaceMessages` 的"先删后插"必须级联 part;分叉必须复制 part 行;
  4. 历史读取改为批量 `WHERE message_id IN (...)` 二次查询(避免 N+1);
  5. 回填按消息分页插入;`--force` 需先删后插,幂等靠唯一约束;
  6. 回滚 = 停读 + DROP 表(派生,无损)。**代价**:写点从 1 次行写变 N 次行写,压缩/分叉/导入三条路径全部重写。
- **C. 双写过渡(先列 + legacy,后停 legacy)**:
  1. 先按 A 落地;
  2. 让 parts 成为权威:写点改为"先产 parts,再投影 legacy";
  3. 观察期内双向校验(读 legacy 与投影逐字一致);
  4. 四端全部切到 parts 后,才允许停写 legacy;停写前必须完成契约 v2 与回滚演练。
  **代价**:两套真相长期并存,`parts → legacy` 投影错一处就是线上事故;因此本票只做到"legacy 权威、parts 派生",把 C 留到 v2。

---

## 7. 迁移步骤(可重放、幂等)

| 步骤 | 内容 | 可逆性 |
|---|---|---|
| M0 | 只读审计:22 键出现频次、通道类型分布、异常行(metadata 非对象)、体量分布 | 无写入 |
| M1 | `20261107120000_message_parts.sql`:`ALTER TABLE chat_messages ADD COLUMN parts jsonb` | `DROP COLUMN` |
| M2 | 代码:shared 派生/投影/指纹 + 9 条写点补齐 + 读取面 + 懒取端点(**四端旧客户端仍只读 legacy;新字段只出不用**) | 关开关 |
| M3 | 回填(可中断、可重跑) | 置 NULL |
| M4 | 校验:计数、抽样 round-trip、旧端 fixture | 只读 |
| M5 | 灰度:服务端 `CHAT_MESSAGE_PARTS=on`,客户端 opt-in 读 | 关开关 |
| M6 | 默认:指标达标(§9)后客户端默认开 | 关开关 |

### 7.1 迁移 SQL(第 370 条)

```sql
-- 可空、无默认:PG 11+ 仅改 catalog,不重写表
ALTER TABLE chat_messages ADD COLUMN parts jsonb;

-- 不做索引;不建表;不动既有 13 列与 4 个索引
COMMENT ON COLUMN chat_messages.parts IS
  '消息 parts 派生缓存(v1);content/reasoning/metadata 仍是权威列,parts 可由三者重算';
```

### 7.2 回填(幂等 + 可重放)

```text
cursor = (fromCreatedAt, fromId)          // 仅内存游标;--from 可指定起点
循环:
  SELECT id, role, content, reasoning, metadata FROM chat_messages
   WHERE (created_at, id) > cursor
     AND parts IS NULL
   ORDER BY created_at, id
   LIMIT 500;

  若空集 → 结束;
  对每行:
      parts = derive(row);                        // 纯函数
      若 parts.length === 0 → 跳过(保持 NULL,不影响终止)
      否则 UPDATE chat_messages SET parts = $json
            WHERE id = $id AND parts IS NULL;     // 条件写:不覆盖并发新写
  cursor = (本批最后一行的 created_at, id);        // 游标必须前进,与是否写成功无关
```

- **终止性**:游标按 `(created_at, id)` 单调前进,即使某行派生为空、UPDATE 未发生,也会越过它;不会出现"空派生行被反复选中"的死循环。
- **幂等**:`derive` 纯函数 ⇒ 同输入同输出;`WHERE parts IS NULL` ⇒ 重跑不覆盖。
- **可重放**:中途崩溃只需按同一 `--from` 重启;从头再跑一遍也只会命中仍为 NULL 的行,副作用为 0。
- **修复模式**:`--force` 只重算 `parts`(仍不碰 legacy),用于修陈旧缓存(正常由 `basis` 挡住,不需要跑)。
- **并发安全**:条件写 `AND parts IS NULL` 与写入侧的整行 UPDATE 互不覆盖;分叉/压缩产生的行由各自写点即时派生。

### 7.3 校验口径(全部为可执行判据)

1. 校验脚本输出"应派生但为 NULL"的行数 = **0**。判据由脚本调用 `derive` 计算(纯 SQL 的 `metadata <> '{}'` 只是近似:未登记键会让近似值偏大,不能作为最终口径)。
2. 抽样(建议 1%,含全通道样本):`project(derive(row))` 与 legacy 三元组**深等价**;`text` 投影与 `content` **字符串逐字相等**。
3. 旧端契约 fixture:对同一行,M2 前后 `content / reasoning / metadata` 的键集合、presence、值完全一致。
4. 22 键矩阵:每键 × 有值/空/类型异常 × role 两态,全部有断言(I3 不抛错)。
5. 指纹校验的反向例:改 `content` 一个字符后,缓存 parts 必须被判失效。

---

## 8. 明确不改清单(防扩散)

1. **不改** `chat_messages` 既有 13 列语义、列顺序无关,也不改任何删除/压缩/分叉/版本族/标记逻辑。
2. **不改** SSE 事件契约:文本 delta、`plan_updated`、`tool-call-*`、reasoning 流全部照旧;流式渲染不从 parts 读。
3. **不改** chat-sync 契约:不新增 payload kind、不改 `rev/patch/snapshot`、不升协议版本;快照仍只带 `content/reasoning`。
4. **不改** ai-service:回调 body 不新增 `parts`;v1 全部派生在 API 侧。
5. **不改** 四端旧客户端(M2–M4 期间零改动):web / RN / 小程序 / 扩展继续只读三列。
6. **不删/不迁** 任何 metadata 键,也不改 4 个消费端的读键逻辑。
7. **不改** LLM 上下文拼装:仍用 `content` + `metadata`(parts 不是 LLM 输入形状)。
8. **不改** 分享/导出/归档:`conversation_message_archives.messages` 的 `{role,content,reasoning,tokens,metadata,createdAt}` 格式原样。
9. **不改** 会话级 metadata:`pendingQuestion / answeredQuestionId / workspacePath / collabLock / fork 记账`。
10. **不改** `chat_element_packs` 暂存表与消费时机(仍由 Worker 合并 `elementPack`)。
11. **不改** D129 发送侧拍平,也不改 `splitUserMessageParts` 的对外行为(仅新增带区间的派生)。
12. **不建** 独立表、**不加** GIN/BTREE 索引、**不做** 全文检索、**不做** part 级查询 API。
13. **不改** 既有体积护栏(64KB 正文 / 64KB 单值 / args 2000 / result 8000 / queue 8×2000)。
14. **不改** `use-message-list-derivations.ts` 的计划伪派生启发式(plan part 只认 `metadata.planSteps`)。
15. **不改** 窗口化/滚动坐标系与 `presentation-units` 的分组不变量。

---

## 9. 验收与测试计划

| 类别 | 判据 |
|---|---|
| 属性测试 | 对 22 键矩阵 × role × 空/超限/类型异常/未登记键,`derive` 不抛错且确定性 |
| 投影测试 | `project(derive(x))` 深等价于 legacy;`text` 与 `content` 逐字相等;presence 逐字(含 `queueItems: []`、`interrupt_reason` 缺省) |
| 旧端回归 | 同一行 M2 前后三列字节级一致(fixture 断言) |
| 指纹反向例 | 改 `content` / 删 metadata 键 ⇒ 缓存判失效并回落到派生 |
| 滚动错序 | 按 §5.3 矩阵跑 5 种组合(可用版本开关模拟) |
| 回滚演练 | staging:全通道 100 行 → 关开关 → 置 NULL → 重跑回填 → 两次快照比对一致 |
| 性能 | 列表页 30 条 p95 增量 ≤ +5ms(以实测为口径);`parts` summary payload 增量 ≤ metadata summary 的 2× |
| 体量 | §6.2 的三个实测数达标后才允许 M6 |

---

## 10. 已拍板项(机主 2026-11-07 确认,进入实现的前置条件)

1. **接受"v1 parts 不携带新信息"**。回滚零丢失的根基成立;part-only 信息(如附件二进制引用)不在本票内,后续若要引入须另立票并重新论证回滚等级。
2. **`partsFace` 默认 `full`**,列表页显式 `summary`(见 §5.1 调用点约定)。
3. **用户附件仍按"区间索引"落地**(见 §3 `image/video/file/quote` 的 `raw + range`);结构化附件字段(新端直接 POST parts)另立票。
4. **体量阈值维持 p99 ≤ 256KB / 平均行载荷增长 ≤ 60%**,但**必须实测达标后才允许拍生产**;超限则转 B 方案或对象存储变体。
5. **切换时序**:M5 之后观察窗口 **≥ 14 天**且 `basis` 失配计数为 **0**,才允许 M6 默认开启。

---

## 附录 A:类型草案(只表达形状,不代表已实现)

```ts
type PartType =
  | 'text' | 'reasoning' | 'image' | 'video' | 'file' | 'quote'
  | 'tool_call' | 'tool_result' | 'terminal' | 'plan'
  | 'citation' | 'injection' | 'subagent'

interface TextPart   { type: 'text'; text: string }
interface ReasoningPart { type: 'reasoning'; text: string }
interface Range { start: number; end: number } // UTF-16 code units, [start, end)

interface ImagePart { type: 'image'; url: string; alt: string; raw: string; range: Range }
interface VideoPart { type: 'video'; url: string; raw: string; range: Range }
interface FilePart  { type: 'file'; name: string; url?: string; raw: string; range: Range }
interface QuotePart { type: 'quote'; label: string; lines: string[]; raw: string; range: Range }

interface ToolCallPart {
  type: 'tool_call'
  id: string
  toolName: string
  status: 'running' | 'success' | 'error' | 'cancelled'
  ordinal: number
  args?: unknown
  iteration?: number
  repeated?: boolean
  serverSource?: 'builtin' | 'plugin' | 'mcp'
  serverId?: string
  serverName?: string
  startedAt?: string
  endedAt?: string
  durationMs?: number
  // 未登记的未来键原样展开(不做袋子字段)
}

interface ToolResultPart {
  type: 'tool_result'
  callId: string
  output: unknown
  isError?: true
}

interface TerminalPart {
  type: 'terminal'
  id: string
  command: string
  status: string
  output?: string
  truncated?: boolean
  totalChars?: number
  exitCode?: number
  startedAt: string
  endedAt?: string
  durationMs?: number
}

interface PlanPart { type: 'plan'; steps: PlanStep[] }
interface CitationPart { type: 'citation'; source: string; label: string; url?: string }
interface InjectionPart { type: 'injection'; kind: string; [k: string]: unknown }
interface SubagentPart { type: 'subagent'; frames: ElementPackFrame[] }

type Part =
  | TextPart | ReasoningPart | ImagePart | VideoPart | FilePart | QuotePart
  | ToolCallPart | ToolResultPart | TerminalPart | PlanPart
  | CitationPart | InjectionPart | SubagentPart
```

> 说明:`InjectionPart`/`TerminalPart` 等保留 `[k: string]: unknown` 是为了**原样承载 legacy 透传键**(写入端 zod 是 `looseObject`),不是全局兜底袋;范围严格限定在该 part 的 legacy 载荷内。

## 附录 B:派生与投影伪代码(判据形状)

```text
derive(row):
  out = []
  meta = isObject(row.metadata) ? row.metadata : {}
  if isNonEmptyArray(meta.planSteps):      out += { type:'plan', steps: meta.planSteps }
  if isNonEmptyString(row.reasoning):      out += { type:'reasoning', text: row.reasoning }
  if isNonEmptyString(row.content):
      if row.role == 'user': out += parseUserContent(row.content)   // text + image/video/file/quote
      else:                  out += { type:'text', text: row.content }
  if isNonEmptyArray(meta.toolCalls):
      for (i, tc) in meta.toolCalls:
          out += { type:'tool_call', ...omit(tc, ['result','isError']), ordinal: i }
          if has(tc,'result'): out += { type:'tool_result', callId: tc.id,
                                        output: tc.result,
                                        ...(tc.isError ? {isError:true} : {}) }
  for t in meta.terminalTasks ?? []:       out += { type:'terminal', ...t }
  for inj in meta.injections ?? []:        out += { type:'injection', ...inj }
  for c in meta.citations ?? []:           out += { type:'citation', ...c }
  if meta.elementPack?.frames?.length:     out += { type:'subagent', frames: meta.elementPack.frames }
  return sortBySemanticWeight(out)

projectLegacy(parts):
  content   = firstTextPart?.text ?? ''
  reasoning = firstReasoningPart?.text ?? null
  metadata  = 信封键原样 + {
      ...(planPart   ? {planSteps: planPart.steps} : {}),
      ...(toolParts  ? {toolCalls: mergeByOrdinal(toolParts)} : {}),   // presence 逐字
      ...(terminalParts.length ? {terminalTasks: stripType(terminalParts)} : {}),
      ...(citationParts.length ? {citations: stripType(citationParts)} : {}),
      ...(injectionParts.length ? {injections: stripType(injectionParts)} : {}),
      ...(subagentPart ? {elementPack: {frames: subagentPart.frames}} : {}),
  }
```

**唯一验收口径**:对上表 22 键与 3 个列来源,`projectLegacy(derive(row))` 与 `row` 的 legacy 面**深等价**;`content` **逐字相等**。该断言不过,不得开启任何读端 parts。
