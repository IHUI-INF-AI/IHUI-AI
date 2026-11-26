<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 模型积分计价方案（2026-11-26 全收费·成本加成版）

> 本文只写**线上真实生效**的口径。产品原则：**不提供免费模型，所有 AI/媒体调用都必须收费；未定价的模型一律不卖（fail-closed）**。

## 一、三条单位

| 单位 | 含义 | 用在哪 |
| --- | --- | --- |
| **积分** | 1 积分 = 1 分钱（¥0.01） | 用户侧扣费、流水、余额展示 |
| **分** | 人民币分 | 钱包充值/提现/兑换、平台成本账 |
| **token** | LLM 输入 + 输出 token | LLM 按 token 计费 |

积分与人民币固定 1:1，不存在“倍率乘总 token”的旧换算。

---

## 二、LLM 计费

### 2.1 公式

\[
\text{扣分} = \left\lceil \frac{\text{prompt\_tokens}}{1000} \times \text{input\_points\_per\_1k} + \frac{\text{completion\_tokens}}{1000} \times \text{output\_points\_per\_1k} \right\rceil
\]

- 输入、输出**分开计价**，输出贵不会被输入价稀释。
- 费率来自**采购成本**，不是 `ai_pricing.input_token_price`（那是对客零售价）：

\[
\text{input\_points\_per\_1k} = \max(0.1,\ \text{cost\_input\_price\_per\_1k} \times 3)
\]
\[
\text{output\_points\_per\_1k} = \max(0.1,\ \text{cost\_output\_price\_per\_1k} \times 3)
\]

- 成本取 `ai_model_config_models.cost_input_price_per_1k` / `cost_output_price_per_1k`；同一 model_id 多渠道时取**最高成本**，避免低价渠道把用户价压穿。
- `3×` 是最低毛利线；`0.1 积分/千 token`（¥1/百万 token）是收费地板，成本为 0 的模型也不能免费。
- 成本列为 `NULL`（未知）的模型：**预检直接 503，不卖**，直到管理员补齐成本价。
- 有 token 至少扣 1 积分；零 token 才返回 0。
- `points_multiplier` 已退出计费链路，仅作为历史字段保留；迁移已把所有 `<=0` 的倍率清零/回填。

实现：`apps/api/src/services/llm-points-pricing.ts` 负责成本→费率，`ai-points-billing.ts` 负责换算、冻结、结算；`proxy-llm.ts`、AI 回调 worker、Crew 子 LLM、股票分析、生涯建议、Coze workflow 共用同一份。

### 2.2 预检与冻结

- 调用前按 **prompt 估算 + 客户端声明的 max_tokens** 冻结，而不是只查 prompt 余额。
- `max_tokens` 兼容 `max_tokens` / `max_completion_tokens` / `maxTokens` / `max_output_tokens`；未传默认 4096，硬上限 131072。
- 冻结写入 `user_points.reserved_points` 与 `point_holds`；可用余额 = `points + 当日 daily_points - reserved_points`。
- 冻结 TTL 15 分钟，到期由 `releaseExpiredPointHolds` 懒释放；释放与冻结都在 `user_points` 行锁内完成，避免并发误释放。
- 预检结果：
  - 无成本价 → `503 MODEL_PRICING_MISSING`，不发起上游；
  - 定价异常 → `503 MODEL_PRICING_INVALID`；
  - 余额不足 → `402 INSUFFICIENT_POINTS`，带 `required / balance / maxCompletionTokens / 费率`；
  - 同一 `referenceId` 已结算 → `409 DUPLICATE_REQUEST`；正在跑 → `409 REQUEST_IN_PROGRESS`。
- `referenceId` 由服务端生成（`request.id` 或业务 UUID）；客户端伪造 `request-id` 头不能重放免费调用。

### 2.3 结算

- 上游成功后按**真实 usage** 结算：先释放 hold 的 `reserved`，再按实际积分扣当日赠送、再扣永久积分；多冻结部分自动退回。
- 余额不足时部分结算：扣到 0，`shortfall` 返回日志/任务 metadata，不产生负余额。
- 上游成功但没有 usage：
  - 同步代理按 `total_tokens`；没有总量则按字符数估算；
  - 异步回调按 `prompt_tokens + completion_tokens`，再不行至少按 1 token 结算，不再“无 usage 就跳过”。
- 上游失败/超时：释放 hold，不扣分。

### 2.4 已迁到积分账的入口

| 入口 | 结算 source | 平台成本 |
| --- | --- | --- |
| 普通 LLM 代理（含 LangChain Agent） | `llm_chat` | `ai_cost_records` |
| AI 回调 worker | `llm_chat` | `ai_cost_records` |
| Crew 子 LLM | `crew_llm` | `ai_cost_records` |
| 股票分析 | `stock_analysis` | `ai_cost_records` |
| 生涯建议 | `ai_career_advice` | `ai_cost_records` |
| Coze workflow | `coze_workflow_chat` | `ai_cost_records` |

以上入口只扣 `user_points`，不再调用 `token-balance-service` 扣钱包。钱包只保留充值、提现、Relay/API Key 等现金场景。

---

## 三、媒体计费（图片 / 视频 / 语音 / 声纹 / 视频合成）

### 3.1 单一真源，无兜底价

唯一线上价来自 `ai_pricing`：

- `per_image` → `per_unit_price` 为 **分/张**；
- `per_video` → `per_unit_price` 为 **分/次或分/秒**，由 `video_unit` 决定；
- `per_call` → 覆盖语音、声纹、视频合成；
- `cost_unit_price` 是平台上游成本（分/单位），只用于成本账，不参与用户扣分；
- 1 积分 = 1 分钱，`per_unit_price` 1:1 转积分，不再乘模型倍率。

**没有兜底价**：无匹配定价行、`billing_mode` 不匹配、单价 `<=0` 一律返回 `null`，预检 `503 MEDIA_PRICING_MISSING`，不发起上游。旧文档里的 20/20/2/2/30 兜底价和“免费模型 0 积分”已全部删除。

单价缺失但 `cost_unit_price > 0` 时，按 `成本 × 3` 生成零售价；成本也未知则不可卖。

实现：`media-billing.ts` 读当前生效行，`media-billing-pricing.ts` 纯函数报价。

### 3.2 按次 vs 按秒

- `video_unit='call'`：一次生成只算 1 次，扣 `per_unit_price`。
- `video_unit='second'`：`units` 必须是真实秒数，扣 `ceil(per_unit_price × 秒数)`。
- 图片 `units` = 张数；语音/声纹/视频合成按次，`units=1`。
- 结果一律 `ceil` 到整数积分，不出现小数或负数。
- 已知边界：部分上游不收客户端 `duration`、按默认时长生成；这些链路已在调用点固定计费秒数（如 Agnes v2.5 固定 5 秒），不能信客户端传 1 秒。

### 3.3 预检、冻结与结算

- 预检按本次报价冻结，TTL **60 分钟**（视频排队+生成可能超过 15 分钟）。
- 预检余额不足 402；无价 503；同 `request.id` 重复提交 409。
- 产物成功后按 `taskId`（或业务引用）幂等结算；`holdReferenceId` 默认 `request.id`，与预扣对齐。
- 产物已交付但定价行在结算时失效：按**预扣额**结算，不允许 0 元放走；只有连预扣都没有时才留成本告警。
- 同一 `user_id + source + reference_id` 只允许一条 `spend` 流水；重复回调返回 `alreadySettled`，不重复扣。
- 平台成本：`cost_unit_price` 已配置时写 `ai_cost_records`（`requestType=media_*`），状态 `priced`/`zero_cost`；未配置则标 `unknown`、不伪造 0 成本。

### 3.4 当前已补价的内置媒体链路

迁移 `20261126070000_points_hold_and_media_price_guard.sql` 为 14 个固定动作补了显式零售价（分/单位）：

| 模型 | 模式 | 零售价 |
| --- | --- | --- |
| `cosyvoice-v2` / `paraformer-v2` / `speaker-recognition` / `voice-clone` | per_call | 2 / 次 |
| `video-compose` / `hunyuan3d` | per_call | 30 / 次 |
| `gpt-4o-mini-tts` / `whisper-1` | per_call | 5 / 次 |
| `image-edit` / `jimeng4` / `jimeng_t2i_v40` / `jimeng_t2i_v31` / `watermark-image` | per_image | 20 / 张 |
| `watermark-video` | per_video（call） | 100 / 次 |

这些行的 `cost_unit_price` 暂为 `NULL`：成本账会标 `unknown`，不会伪装成 0。其余动态媒体模型（Kling、Runway、Luma、Vidu、PixVerse、Flux、Recraft、Bria、Stability 等）**必须在 `ai_pricing` 有对应行才能卖**；没有就 503，这是有意的“未定价不卖”，不是故障。

### 3.5 MAGI-2

- 别名：`magi-2` / `magi-2-preview` / `magi-2-preview-latest`。
- `per_video`、`video_unit='second'`、`per_unit_price=74 分/秒`；30 秒约 2,220 积分（¥22.20）。
- 成本 50 分/秒（Sand.ai 1080P 0.5 元/秒），毛利约 32.4%。
- 迁移：`20261125150000_magi2_video_pricing.sql`。

---

## 四、三本账边界

| 账本 | 表/字段 | 作用 | 不做什么 |
| --- | --- | --- | --- |
| 用户积分账 | `user_points.points` + `daily_points` + `reserved_points` | 用户可用/冻结积分 | 不记录人民币充值 |
| 钱包账 | `user_margins.token_quantity` | 人民币余额（分），充值/提现/Relay | 不直接当 AI 积分扣 |
| 成本账 | `ai_cost_records` + `ai_pricing.cost_unit_price` | 平台上游成本、毛利、对账 | 不决定用户扣多少积分 |

关键约束：

1. **用户积分与平台成本分离**：LLM 用户价按成本×3 生成，成本账按真实成本记，两边不再要求相等。
2. **成本可信度显式化**：`ai_cost_records.cost_status` = `priced` / `unknown` / `zero_cost`；无价不再静默写 0 当真实成本。
3. **部分结算**：上游已发生、余额不足时扣到 0，差额审计，不产生负余额。
4. **钱包→积分桥**：`POST /api/wallet/convert-to-points`，1 分 = 1 积分，事务内扣钱包、加积分、写双向流水。
5. **余额口径统一**：所有“够不够付”都走 `getSpendableBalance`（永久 + 当日赠送 - 冻结）。

### 4.1 钱包兑换 API

- 路由：`apps/api/src/routes/wallet.ts` 的 `POST /convert-to-points`，需登录。
- 请求体 `{ "amount": 100, "idempotencyKey": "..." }`；`amount` 整数 100–1,000,000。
- 兑换率 1 分 = 1 积分，只允许 wallet → points。
- 事务：锁 `user_margins` 行 → 扣 `token_quantity`（带 `>= amount`）→ 加 `user_points.points`（不碰 `total_earned`/`experience`）→ 写 `point_transactions(type='transfer')` → 写 `token_flows(op_type=7)`。
- 部分唯一索引 `ux_point_transactions_wallet_exchange_user_ref` 保证同一幂等键只兑换一次。

### 4.2 永久积分来源

- 订单消费返还：`floor(order.amount / 100)`（1 元 = 1 积分）。
- 签到、任务、邀请、活动奖励。
- 管理员手动调整。
- 钱包兑换（`type='transfer'`，不计入“消费”统计）。

注册不送 1000 积分；`vip_subscriptions.granted_points` 不存在，会员只发 AI 预算/配额。

---

## 五、失败与并发

| 场景 | 行为 |
| --- | --- |
| LLM 无成本定价 | 503 `MODEL_PRICING_MISSING`，不发起上游 |
| LLM 余额不足 | 402 `INSUFFICIENT_POINTS`，不发起上游 |
| 同 `referenceId` 已结算/在跑 | 409 `DUPLICATE_REQUEST` / `REQUEST_IN_PROGRESS`，不放上游 |
| LLM 上游 5xx/超时/4xx | 释放 hold，不扣分 |
| LLM 成功但无 usage | 按 total/字符估算；异步回调至少 1 token，不再跳过 |
| 上游已产生成本但余额不足 | 部分结算，扣到 0，`shortfall` 审计 |
| 媒体无定价行 | 503 `MEDIA_PRICING_MISSING`，不发起上游 |
| 媒体余额不足 | 402，带 `required / units / applied_units / unit_points` |
| 媒体成功后余额被并发花掉 | 部分结算，不产生负余额 |
| 媒体重复回调 | `ai_media` + `referenceId` 幂等，返回 `alreadySettled` |
| 媒体定价行结算时失效 | 按预扣额结算；无预扣才留成本告警 |
| 媒体成本价未配置 | `cost_status=unknown`，不伪造 0 |
| 扣分事务失败 | 已交付产物不回收；释放 hold + 日志，由对账处理 |
| 钱包兑换并发同 key | 行锁 + 部分唯一索引，只成功一次 |
| 钱包兑换余额不足 | `INSUFFICIENT_WALLET_BALANCE`，不产生半截账 |

---

## 六、管理端与排查

- 模型倍率字段已不参与计费；新模型上线只需补 `cost_input_price_per_1k` / `cost_output_price_per_1k`。
- 积分流水：`/admin/points/records`。
- LLM 调用日志：`/admin/llm/call-logs`。
- 媒体定价：`ai_pricing` 表；新模型必须先补 `billing_mode + per_unit_price (+ cost_unit_price)`，否则 503。
- 成本可信度：查 `ai_cost_records.cost_status`，`unknown` 的行需要补成本价，不能直接算毛利。
- 钱包流水：`token_flows.op_type=7` 表示“兑换 AI 积分”。

---

## 七、变更日志

| 日期 | 变更 |
| --- | --- |
| 2026-07-31 | 初版立稿（LLM 倍率计费） |
| 2026-11-25 | 媒体计价收口到 `ai_pricing`；新增按秒计费与 MAGI-2 定价；新增钱包→积分兑换桥 |
| 2026-11-26 | 全收费改造：LLM 改输入/输出分离的成本×3 计价，取消 0 倍率与免费档；预检按 prompt+max_tokens 冻结，新增 `point_holds` / `reserved_points`；无 usage 不再跳过；媒体删除全部兜底价，未定价 503；新增 `ai_cost_records.cost_status`；补 14 个内置媒体/语音零售价 |
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
