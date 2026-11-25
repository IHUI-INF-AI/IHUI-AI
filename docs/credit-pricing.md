<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 模型积分计价方案（2026-11-26 收口版）

> 本文只写**线上真实生效**的口径。历史文档里的“注册送 1000”“Pro 每月送 10,000 积分”“¥9.9 买 1000 积分”均未落地，已从本文移除；产品文案不应再引用。

## 一、先记住三条单位

| 单位 | 含义 | 用在哪 |
| --- | --- | --- |
| **积分** | 1 积分 = 1 分钱（¥0.01） | 用户侧扣费、流水、余额展示 |
| **分** | 人民币分，`user_margins.token_quantity` 的记账单位 | 钱包充值 / 提现 / 兑换 |
| **token** | LLM 的输入+输出 token | 仅 LLM 按 token 计费时使用 |

对 LLM 另有一条换算：**1 积分 = 1000 token × 1 倍模型倍率**。这句话只适用于 LLM，不适用于图片/视频/语音。

---

## 二、LLM 计费

### 2.1 公式

\[
\text{扣分} = \left\lceil \frac{\text{prompt\_tokens} + \text{completion\_tokens}}{1000} \times \text{points\_multiplier} \right\rceil
\]

- 实现：统一在 `apps/api/src/services/ai-points-billing.ts` 的 `computeLlmPoints` / `quoteLlmPoints` / `settleLlmPointsUsage`；`proxy-llm.ts`、AI 回调 worker、Crew 子 LLM、股票分析、生涯建议、Coze workflow 共用这一份换算。
- 结果 **向上取整**（`Math.ceil`），不是向下取整、不保留小数。
- `points_multiplier` 来自 `ai_model_config_models.points_multiplier`；未配置时按模型名关键词推断，最终兜底 1。
- 固定档位：`0 / 1 / 3 / 10 / 30`。
- `multiplier = 0` 的模型不扣分。
- 响应里没有 `usage`、或 token 总量为 0 时**跳过扣分**，不按 `max_tokens` 估算。
- 同步调用在返回前结算；异步回调在拿到真实 usage 后结算。预检只查余额，不预扣、不冻结。
- 已产生上游成本但余额不足时走**部分结算**：余额扣到 0，差额返回 `shortfall` 记入日志/任务 metadata，不把余额扣成负数。

### 2.2 余额预检

- LLM 调用前按 **prompt 侧估算积分** 做预检，不按 `max_tokens` 预估、不冻结；余额不足直接 402，不发起上游调用。
- 真正的扣减仍以响应里的真实 usage 为准；预检只是“够不够开工”，不是最终账单。
- 可用余额 = `user_points.points`（永久）+ 当日剩余的 `daily_points`。
- 每日赠送 `DAILY_GRANT_POINTS = 100`，按 Asia/Shanghai 业务日懒发放；跨日未用完的部分清零，不结转。
- 消费时优先扣当日赠送，再扣永久积分。

### 2.3 示例

- GPT-4o（×3），输入 800 + 输出 200 token → `ceil(1000/1000 × 3) = 3 积分`
- DeepSeek-Chat（×1），输入 5000 + 输出 1000 token → `ceil(6000/1000 × 1) = 6 积分`
- Ollama 本地模型（×0）→ 0 积分

### 2.4 已迁到积分账的 AI 入口

| 入口 | 结算 source | 平台成本 |
| --- | --- | --- |
| 普通 LLM 代理（含 LangChain Agent） | `llm_chat` | `ai_cost_records` |
| AI 回调 worker | `llm_chat` | `ai_cost_records` |
| Crew 子 LLM | `crew_llm` | `ai_cost_records` |
| 股票分析 | `stock_analysis` | `ai_cost_records` |
| 生涯建议 | `ai_career_advice` | `ai_cost_records` |
| Coze workflow | `coze_workflow_chat` | `ai_cost_records` |

以上入口全部只扣 `user_points`，不再调用 `token-balance-service` 扣钱包。钱包只保留充值、提现、Relay/API Key 这类现金场景。

---

## 三、媒体计费（图片 / 视频 / 语音 / 声纹 / 视频合成）

### 3.1 单一真源

媒体不再使用 `FLAT_POINTS`，也不再使用“3/12 积分 + 模型倍率”的第二套价。唯一线上价来自 `ai_pricing`：

- `billing_mode = 'per_image'` → `per_unit_price` 的单位是 **分/张**；
- `billing_mode = 'per_video'` → `per_unit_price` 的单位是 **分/次或分/秒**，由 `video_unit` 决定；
- 1 积分 = 1 分钱，因此 `per_unit_price` 直接按 1:1 转成积分，**不再乘 `points_multiplier`**（媒体零售价本身已含毛利，再乘一次等于重复加价）。

实现：`apps/api/src/services/media-billing.ts` 读取当前生效的 `ai_pricing` 行，交给纯模块 `media-billing-pricing.ts` 报价。

### 3.2 按次 vs 按秒

- `video_unit = 'call'`：一次视频生成无论传多少秒，都只算 1 次，扣 `per_unit_price`。
- `video_unit = 'second'`：`units` 必须传真实时长秒数，扣 `ceil(per_unit_price × 秒数)`。
- 图片 `units` = 张数；语音/声纹/视频合成按次，`units = 1`。
- 结果一律 `ceil` 到整数积分，不出现小数或负数。

### 3.3 兜底价

只有 `ai_pricing` 没有对应定价行、或 `billing_mode` 与媒体类别不匹配时，才回落到下表（积分/单位）：

| 类别 | 兜底价 |
| --- | --- |
| 图片 | 20 / 张 |
| 视频 | 20 / 次（按次兜底，不按秒） |
| 语音 | 2 / 次 |
| 声纹 | 2 / 次 |
| 视频合成 | 30 / 次 |

免费模型（`ollama/*`、`pollinations/*` 等）在没有显式媒体定价行时保持 0 积分。

### 3.4 MAGI-2

- 模型别名：`magi-2` / `magi-2-preview` / `magi-2-preview-latest`。
- 计费模式：`per_video`、`video_unit = 'second'`、`per_unit_price = 74.000000` 分/秒。
- 30 秒约 **2,220 积分**（¥22.20）。
- 定价依据：Sand.ai 官方 0.08 USD/秒，按汇率约 7.1 折算上游约 ¥17.04/30 秒，留约 30% 毛利。
- 迁移：`packages/database/drizzle/20261125150000_magi2_video_pricing.sql`。

> 公开 API 目前尚未新增 MAGI-2 专用视频路由；本定价行服务于已接入 `apps/ai-service` 的 `magi2_provider` 及其上游调用链路。

---

## 四、三本账的边界

系统里确实有三本账，但它们是**分工**，不是三套互不相干的价：

| 账本 | 表 / 字段 | 作用 | 不做什么 |
| --- | --- | --- | --- |
| **用户积分账** | `user_points.points` + `daily_points` | 用户实际可用的 AI 积分，扣费直接从这里减 | 不记录人民币充值 |
| **钱包账** | `user_margins.token_quantity` | 人民币余额（单位分），负责充值、提现、Relay 转账 | 不直接当 AI 积分扣 |
| **成本账** | LLM: `ai_cost_records`；媒体: `ai_pricing` 售价行 | 平台算上游成本、毛利、对账 | 不直接决定用户扣多少积分 |

过去的断点是：钱包和积分之间没有兑换桥，用户充了钱却用不了 AI；媒体同时存在多套价；用户扣分与 `ai_pricing` 成本不连；Crew/回调/股票/生涯/Coze 仍走钱包扣费。现在补齐为：

1. **单一媒体价**：用户扣分直接读 `ai_pricing`，成本账与用户账使用同一行价格。
2. **AI 只走积分**：所有 AI 入口统一走 `ai-points-billing`，不再从钱包扣 AI 用量。
3. **两本账分离**：用户积分与平台成本各记各的；LLM 成本进 `ai_cost_records`，不再要求“扣钱包数 = 成本数”。
4. **部分结算**：上游已产生成本、用户余额不足时扣到 0，差额留审计，不产生负余额。
5. **钱包 → 积分桥**：`POST /api/wallet/convert-to-points`，1 分 = 1 积分，事务内扣钱包、加积分、写双向流水。
6. **余额口径统一**：所有“够不够付”的判断都走 `getSpendableBalance`（永久 + 当日赠送），不再只看 `points`。

### 4.1 钱包兑换 API

- 路由：`apps/api/src/routes/wallet.ts` 的 `POST /convert-to-points`，需登录。
- 请求体：

```json
{ "amount": 100, "idempotencyKey": "..." }
```

- `amount`：整数，100–1,000,000（最低 ¥1）。
- `idempotencyKey`：可选，1–32 字符；不传时用 `request.id`。
- 兑换率：1 分 = 1 积分，只允许 wallet → points，不允许反向。
- 事务与幂等：
  - `SELECT ... FOR UPDATE` 锁 `user_margins` 行；
  - 扣 `token_quantity` 时带 `>= amount` 条件；
  - 加 `user_points.points`，不碰 `total_earned` / `experience`；
  - 写 `point_transactions(type='transfer', source='wallet_exchange')`；
  - 写 `token_flows(op_type=7, quantity=-amount)`；
  - 部分唯一索引 `ux_point_transactions_wallet_exchange_user_ref` 保证同一幂等键只兑换一次。
- 前端入口：`apps/web/app/(main)/wallet/page.tsx` 的“钱包余额兑换 AI 积分”卡片。

### 4.2 永久积分从哪来

- 订单消费返还：`floor(order.amount / 100)`（1 元 = 1 积分）。
- 签到、任务、邀请、活动奖励。
- 管理员手动调整。
- 钱包兑换（本版新增，`type='transfer'`，不计入“消费”统计）。

> `vip_subscriptions.granted_points` 在 schema 中不存在；会员权益只发 AI 预算/配额，不直接发积分。注册流程也不送 1000 积分。

### 4.3 成本账现状

- LLM 的 `costCents` 由 `resolveAiCost` 按 `ai_pricing` 解析，写入 `ai_cost_records`；`requestType` 区分 `llm_chat`（普通代理 / LangChain Agent / 流式回调）、`crew`、`crew_session`、`stock_analysis`、`career-advice`、`coze_workflow_chat`。
- 用户积分由 `computeLlmPoints` 按模型倍率另算；同一个请求的“平台成本”和“用户扣分”不再要求相等。
- 媒体当前只有用户售价 `ai_pricing.per_unit_price`，没有独立的上游成本列，因此媒体成本暂未写入 `ai_cost_records`；上线媒体毛利报表前需补成本字段，不能直接把售价当成本。

---

## 五、失败与并发

| 场景 | 行为 |
| --- | --- |
| LLM 上游 5xx / 超时 / 4xx | 不扣分 |
| LLM 成功但无 `usage` | 跳过扣分（不估算） |
| 媒体上游失败 | 不扣分；成功后按报价扣 |
| 媒体余额不足 | 调用前返回 402，带 `required / units / applied_units / unit_points / price_source` |
| AI 预检余额不足 | 同步入口返回 402/明确错误，不发起上游调用 |
| 上游已产生成本但余额不足 | 部分结算：扣到 0，返回 `shortfall` 并记账审计，不产生负余额 |
| 异步回调重复投递 | 同一 `user_id + source + reference_id` 已结算则直接返回 `alreadySettled`，不重复扣 |
| 扣分事务失败 | 已生成响应不回滚；记录日志，由对账/人工处理 |
| 同 `referenceId` 重复扣分 | 媒体扣分按 `referenceId` 幂等，不重复扣 |
| 钱包兑换并发同 key | 行锁 + 部分唯一索引，只成功一次 |
| 钱包兑换余额不足 | 抛 `INSUFFICIENT_WALLET_BALANCE`，不产生半截账 |

---

## 六、管理端与排查

- 模型倍率：`/admin/ai-models` → “积分消耗倍数”下拉，固定 5 档。
- 积分流水：`/admin/points/records`，可按 `reason` 筛选。
- LLM 调用日志：`/admin/llm/call-logs`。
- 媒体定价：`ai_pricing` 表；新模型上线必须先补定价行，否则会走兜底价。
- 钱包流水：`token_flows.op_type` 的 7 表示“兑换 AI 积分”，前端统一由 `packages/shared/src/utils/wallet-flow-meta.ts` 解释。

---

## 七、变更日志

| 日期 | 变更 |
| --- | --- |
| 2026-07-31 | 初版立稿（LLM 倍率计费） |
| 2026-11-25 | 媒体计价收口到 `ai_pricing` 单一真源；新增按秒计费与 MAGI-2 定价；新增钱包→积分兑换桥；修正 LLM 取整、每日赠送、无 usage 跳过等口径；移除未落地的注册送/会员送/9.9 买积分描述 |
| 2026-11-26 | 剩余 AI 入口（普通 LLM 代理 / LangChain Agent / Crew / AI 回调 / 股票 / 生涯建议 / Coze）全部迁到 AI 积分；新增 `settlePointsUsage` 部分结算与幂等；平台成本与用户积分正式分账；媒体显式 0 价生效；Goal 水位改读积分 |
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
