<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# DB-SCHEMA-GAP-01 生产缺订阅/峰谷计费 schema（事故级）

> 状态：2026-11-07 只读判定。**未写生产、未手工补任何一条迁移**，等执行窗口。

## 1. 判定

生产**正在跑的那份代码已经引用**缺失对象 ⇒ 按裁定属 **线上故障级**，不是发布阻塞项。

## 2. 代码侧证据（生产 bundle `D:\DevEnv\ihui-prod`）

- 运行进程：api `tsx src/index.ts`，PID 25204，启动 `2026-11-06 16:16:35 +08`。
- 生产 DSN：`localhost:8810 / ihui_dev`（与只读检查同一库）。
- 引用点：
  - `apps/api/src/routes/packages.ts` —— `select().from(plans)` 会选中 schema 全列；缺 8 列 ⇒ 42703，接口 500。
  - `apps/api/src/routes/developer.ts:327` —— 直接查 `api_subscriptions`，无本地 try/catch ⇒ 500。
  - `apps/api/src/services/relay-billing-service.ts:402` —— 每笔 relay 结账调用
    `checkSubscriptionWindowQuota`；其 `getActiveSubscription` 有 catch，缺表时 **静默放行**（fail-open，不 500）。
  - `apps/api/src/services/peak-pricing-service.ts` —— 读 `relay_peak_pricing_rules`；
    `resolvePeakMultiplier` 有 catch（fail-open），后台列表接口无 catch ⇒ 500。
- `subscription-window-service.ts` 最近提交 2026-10-29、mtime 2026-10-27，均早于进程启动
  ⇒ 运行进程确实加载了这些引用。
- 引入批次：`9425d91`（2026-09-16，「feat(relay): 对外售卖模型 API 产品化补强七件套」）；
  该批次的代码已包含在 2026-11-06 的生产进程里。

## 3. 数据库侧证据（只读）

- `pg_class` 全 schema：`api_subscriptions` / `api_subscription_window_usage` /
  `relay_peak_pricing_rules` **均不存在**。
- `information_schema.columns` 全 schema：`plans` 的 8 列 **均不存在**。
- 全 376 个迁移文件：**没有任何 DROP TABLE** 指向这 3 张表。

## 4. 根因：pending 队列死锁在 `20261106150000`

- `20260916170000`（原迁移）从未应用（lateGap），三表因此一直不存在。
- `20261106150000` 给 `api_subscriptions` 建 2 个 **未加守卫** 的索引
  （`ix_api_subscriptions_plan_id` / `ix_api_subscriptions_order_id`）。
- 创建该表的 `20261107000000` 排在它 **之后** ⇒ 按 journal 顺序 `20261106150000` 必失败，
  队列卡住，后面的补偿永远轮不到。
- 解析实测：`20261106150000` 共 161 条 `CREATE INDEX` / 28 条 FK；引用 115 张表，
  生产只缺 `api_subscriptions` 一张；FK 全部只引用 `users`。
- 结论：**不先处理这个顺序反转，跑多少次 migrate 都补不上 schema。**

## 5. 水位陷阱（可复用判据，不是一次性提醒）

- drizzle 以 `max(账本.created_at)` 为水位，只应用 `when > 水位` 的迁移。
- 手工插入 / 单独先应用某个 `when` 更高的迁移 ⇒ 水位被抬高，所有更小的 pending
  **永久被判为已应用**，再也不会执行。这是新的 fail-open。
- 因此：**禁止手工单补一条**。要补只有两条路：
  1. 先修 `20261106150000` 的守卫（并把那 2 个索引挪到建表之后），再按 journal 顺序跑全部 8 条；
  2. 暂不补，立票进发布检查单，发布时按顺序一起追平。

## 6. 8 条 pending 逐条（必须按顺序，不蒙跑）

| # | tag | 做什么 | 幂等 | 破坏性 | 顺序依赖 |
|---|---|---|---|---|---|
| 1 | `20261106150000_fix_missing_indexes_fks` | 161 索引 + 28 外键 | 索引 `IF NOT EXISTS`；FK 用 `EXCEPTION WHEN others THEN NULL` 静默跳过 | 非破坏 | **硬阻塞**：2 个 `api_subscriptions` 索引未守卫，而该表由 #2 创建（顺序在后）⇒ 必须先改守卫 |
| 2 | `20261107000000_repair_api_subscription_drift` | 建 3 表 + `plans` 8 列 + 7 索引 | 全 `IF NOT EXISTS` | 非破坏 | 无；需补上 #1 的 2 个 `plan_id/order_id` 索引 |
| 3 | `20261107001000_drop_stale_refund_order_fk` | 删 2 个旧自动命名 FK | `to_regclass` + 新旧 FK 双存在守卫 | 仅删错误 FK | 依赖 0212 已应用（已满足） |
| 4 | `20261107002000_chat_share_token_expires_at` | 加 `chat_conversations.share_token_expires_at` | `IF NOT EXISTS` | 非破坏 | 无 |
| 5 | `20261107003000_crash_reports_user_fk` | 清孤儿 `user_id` 后加 FK | 有守卫 | 会 UPDATE 孤儿为 NULL | 依赖 `users` |
| 6 | `20261107004000_edu_attendance_rule_partial_unique` | 旧唯一约束换 partial unique | 先查未删行重复，有重复即 `RAISE` | DROP 旧约束（随即建新索引） | 无 |
| 7 | `20261107005000_t4_not_null` | 13 列 `SET NOT NULL` | 每列先查 NULL，非 0 即 `RAISE` | 非破坏 | 无 |
| 8 | `20261107006000_rewrite_default_cleanup` | 7 列 `DROP DEFAULT` | 列不存在跳过 | 仅改默认值 | 无 |

每条执行后：门取数 + 效果存在性（3 表 / 8 列 / 2 索引 / 各对象）。

## 7. 当前状态

- 生产未写入；8 条继续 `pending`；未手工补任何一条。
- 待窗口：先批准修 #1 守卫 + #2 补 2 索引，再按顺序逐条执行并逐步取数。

## 8. `20261106150000` 守卫化与补偿迁移（2026-11-07）

准入依据：生产与所有服务态环境计数 0；两份本地副本的哈希台账与「#1 没炸」解释见 `DB-LEDGER-SHIFT-01.md` §5。

### 8.1 #1 正文改动（守卫 + 可见审计；两处确定性删除）

- 2 个 `api_subscriptions` 索引：`to_regclass('public.api_subscriptions')` 守卫。表缺失 → `status=skipped reason=missing_table sqlstate=42P01`；已在 → `exists`；新建 → `built`。
- 27 条 FK：四分支——本表或引用表缺失 → `skipped reason=missing_table`；同名约束**且 `conrelid='public.<table>'::regclass` 且 `contype='f'`** → `exists`；其余 → `ADD CONSTRAINT` + `built`。
- **全部 `EXCEPTION WHEN others` 已删除**（索引段 2 处、FK 段 28 处）。三种合法态均由分支覆盖，其余真实失败一律 abort，不再把建失败降级成 NOTICE。
- 删除 `fk_resource_downloads_user_id_users`（integer 列对 uuid 引用，不可建；见 `DB-TYPE-DRIFT-01.md`）。
- 删除 `CREATE INDEX IF NOT EXISTS "idx_ab_tests_status" ON "agent_ab_tests"`（同名索引归 `ab_tests`，`agent_ab_tests.status` 已有等价 `agent_ab_tests_status_idx`，逐字证明见 §8.5）。
- 终版正文：`895389c930dd06e4c427f31a0da8e19df46b38aade77c20116cb8992ddfc7175`，**45532 字节**。中间守卫版 `b44eae86…0e25` / 41354 字节作废。
- 机械计数：`DO $$` 32 个；`ADD CONSTRAINT "fk_` 27；`contype='f'` 27；`EXCEPTION WHEN others` 0；IDX `skipped reason` 2；FK `skipped reason` 27。

### 8.2 新增补偿迁移（排在建表之后）

- `20261107007000_add_api_subscription_plan_order_indexes`（journal idx 377 / when 1793952420000，sha256 `7ee6bb49…6c71`，3602 字节；无 EXCEPTION）。
- 位置严格在 `20261107000000_repair_api_subscription_drift` 之后；`IF NOT EXISTS` + 同款审计通知。
- 终态：无论空库从 0 跑，还是已应用前半段续跑，`pg_indexes` 中 `ix_api_subscriptions_plan_id` / `ix_api_subscriptions_order_id` 都存在且定义一致。

### 8.3 实跑读数（临时实例 55432，2026-11-07，终版正文）

审计六数口径：`IDX {built, exists, skipped}` + `FK {built, exists, skipped}`，由 `parse-audit.mjs` 按 item 集合逐条比对，不是肉眼看总数。

| 场景 | 起始账本 | 结束账本 | IDX b/e/s | FK b/e/s | 结果 |
|---|---|---|---|---|---|
| 全新空库 `ihui_fresh_1107` | 0 行 | 377 行 / max 1793952420000 | 2 / 2 / 0 | 27 / 0 / 0 | `AUDIT=PASS`，exit 0 |
| 克隆 `ihui_upcompat_1107`（TEMPLATE `ihui_fz_f5363d16m`） | 375 行 / max 1793952300000 | 377 行 / max 1793952420000 | 0 / 2 / 0 | 0 / 0 / 0 | `AUDIT=PASS`，exit 0 |
| 守卫探针 `ihui_guard_probe_1107`（空库、无表） | - | - | 0 / 0 / 2 | 0 / 0 / 0 | `AUDIT=PASS`，2 条 `skipped reason=missing_table sqlstate=42P01`，exit 0 |

- 空库路径：drizzle 按 `when` 排序，`20260916170000`（when=1722377600000）先于 #1 执行并建表，故 #1 走 `built`（2），新迁移走 `exists`（2）。
- 生产路径：`20260916170000` 为 lateGap（when 低于水位、账本 0 行），表缺失 ⇒ #1 预期 `IDX skipped reason=missing_table 42P01`（2），#2 建表，新迁移 `built`（2）；窗口第 3/4 步实测留证。
- 克隆路径的 `06150000` 账本行仍是改前 hash `3d779ec2`（drizzle 只按 `when` 判定、不校验 hash），本轮未改写该行。
- 终态断言（`final-assert.sql`，128 项，按 `-v env=prod|fresh` 定价）：
  - fresh：**128/128**；克隆 `ihui_upcompat_1107`：126/128，2 项为**克隆历史**（克隆起点已应用改前 #1，`idx_ab_tests_status` 留在 `agent_ab_tests` 上、索引数 5；生产从未应用改前 #1，新 #1 已删除该行，终态索引数 4）；
  - 生产窗口前基线：**60/128**，68 项失败**全部**是本窗口目标项（0916 11 + COLS8 8 + D1 1 + FK27 27 + IDX2 2 + IDX9 9 + TABLES3 3 + index-check 7），窗口结束预期 **128/128**。
- 断言期望的两处修正（此前「6 项环境差异」是期望写错，不是库状态错）：
  - `0108`：`t_check_in_record` / `t_homework` 由 `0143_drop_legacy_learn_tables` 恒 DROP（期望 absent）；`t_tencent_cloud_live_stream` / `zhs_agent_settlement` 由 `20260906173000_drop_dead_tables` DROP，而该迁移在生产是 lateGap（未应用）⇒ 生产在、fresh 不在，故按 `env` 参数分别定价；
  - `0212`：两条旧 FK `edu_refunds_order_id_edu_orders_id_fk` / `edu_invoice_applications_order_id_edu_orders_id_fk` 由 0212 自身第 9/43 行 DROP（期望 absent），新 FK 两条期望 present。
- 执行器：测试组用 `drizzle-kit migrate`，其日志已证明会打印服务端 NOTICE（`BUG-29` 行以对象形式输出）；生产按步执行用 `psql -v ON_ERROR_STOP=1`，NOTICE 落 stderr 文件后由同一解析器断言。

### 8.4 `ihui_dbg_prod341` 来源与风险

- owner=`ihui`，oid=1231035，数据目录创建 `2026-11-06 21:17:35`，最后写入 `22:31:55`，`xact_commit=1651`，0 客户端连接。
- 临时脚本、`.ihui-agent` 日志、仓库 `scripts/` 均无该库名痕迹；来源无法确证。
- 风险清单：**来源不明库、内容为旧正文 `11a555f5`（27238 字节）、0 连接、非发布目标**。按本地一次性副本处置，不重置、不改写、不追认。

### 8.5 D1/D2/D3 裁定与证据

**D1**：6 条 `analytics_events` 孤儿按 id 精确删除；证据、表结构顺序与可回放 INSERT 见 `DB-SCHEMA-GAP-01-D1-analytics-orphans.sql`。三个数：SELECT=6 / DELETE 影响=6 / 删后同条件=0；执行位置为备份之后、#1 之前，独立事务。否决置 NULL（把「已删除用户的行为」改写成「匿名用户的行为」）与 `NOT VALID`（造出「约束存在但 6 行违反它」的半真状态）。

**D2**：`resource_downloads.resource_id`/`user_id` 为 `integer`，schema 声明 `uuid`；实测 uuid 写入报 `column ... is of type integer but expression is of type uuid`，写入路径必然 500，读路径不存在。该 FK 已从 #1 移除，FK 建成数写死 **27**；修复方案、回滚与排期见 `DB-TYPE-DRIFT-01.md`（本窗口后同日执行）。

**D3**：`idx_ab_tests_status` 同名索引归 `ab_tests` 所有；`agent_ab_tests.status` 的等价索引逐字如下（仅名字不同）：
- 生产：`CREATE INDEX agent_ab_tests_status_idx ON public.agent_ab_tests USING btree (status)`
- 空库：`CREATE INDEX idx_ab_tests_status ON public.agent_ab_tests USING btree (status)`

均为非唯一、btree、单列 `status`、无谓词、无 INCLUDE。已从 #1 删除该行；删后 `agent_ab_tests` 索引数写死为 **4**（pkey + 2 个既有 + `agent_ab_tests_status_idx`），并由断言表 `D3_DELETE` 两项核对（`idx_ab_tests_status_on_agent_ab_tests=absent` / `index_count=4`）。同名跨表扫描为**全量 159 条**：从 #1 解析每条 `CREATE INDEX IF NOT EXISTS`，用 `to_regclass(name)` 与 `pg_indexes(name, target_table)` 逐条比对，异常恰好 1 条（本行）。

**28 条 FK 与 `0916` 覆盖表**：七列逐条 FK 表、`0916` vs `#2` 的 64 项对象表见 `DB-SCHEMA-GAP-01-evidence-tables.md`。比对口径为类型、可空性、默认值、索引列顺序、唯一性、方法、谓词、FK 动作；结果 64/64 等同，无缺口，**不新增补偿迁移**。

### 8.6 生产窗口执行记录（2026-11-07）

时间线（UTC）：备份 03:33:13 → D1 03:33:54 → 预检 → #1 → #2 → #3~#8 → #9 → final-assert 03:39 → 冒烟 03:41 → DB-TYPE-DRIFT-01 03:42:45 → final-assert 03:45:12。

| 步骤 | 审计计数 |
|---|---|
| 备份 | 账本 361 行/30074B；归档 7/4929B；plans 3/1286B；crash_reports 85/12018B；schema dump 1270259B |
| D1 | SELECT=6 / DELETE 6 / post_by_id=0 / post_by_condition=0（独立事务） |
| 预检 | 27 FK 异常 0；13 列 NULL 0；#6 重复 0；#5 孤儿 0；3 表 ABSENT；8 列缺失 0；140 目标表归属 0 异常；vector 0.8.6 |
| #1 | FK built 27 / IDX 158 全存在 / 守卫 IDX skipped 2（missing_table）/ ERROR 0 |
| #2 | COLS 8/8、TABLES 3/3、IDX 7/7；plans 3 行保留、新列 NULL 0 |
| #3 | 旧退款 FK 0 / 新 FK 2 |
| #4 | chat_conversations.share_token_expires_at 1/1 |
| #5 | crash_reports FK 1/1 |
| #6 | 旧唯一约束 0/1、部分唯一索引 1/1 |
| #7 | 13 列 NOT NULL 13/13 |
| #8 | 7 个默认值已清 7/7 |
| #9 | IDX built 2 |
| final-assert | 128/128 PASS，fail 0（`D2_ABSENT` 按 env 定价：prod=PRESENT） |
| 冒烟 | `/api/plans`、`/api/developer/relay/subscriptions`、`/api/admin/relay/peak-pricing/rules`、`/api/admin/relay/peak-pricing/preview` 全 200，无 42703/42P01 |
| 配额 | `api_subscriptions` 存在、服务用 8 列齐全、原查询 0 行且不再抛 42P01 ⇒ fail-open 分支不可达 |
| DB-TYPE-DRIFT-01 | rows 0 / udt uuid,uuid / FK 1 / 探针 `INSERT 0 1` 后 ROLLBACK / public FK 563→595 |

**账本异动（必须复核）**：窗口内 `drizzle.__drizzle_migrations` 从 361 行变为 362 行，新增 `id=1648`（`created_at=1793948400000`，即 `20261106150000`），记录 hash 为**改前正文** `3d779ec2…3781`（30380 字节），而非终版 `895389c9…7175`（45532 字节）；该行不在 03:33 备份 CSV 中。判断为上一窗口挂起的后台命令在窗口内补账本；已停止两个挂起命令（`b53af74a…`、`19b3528a…`）。**未手改账本**。DDL 终态已由 final-assert 128/128 与 verify-1 158/158 证明为终版效果；该行属未豁免 hashDrift，需按 `docs/DB-LEDGER-SHIFT-01.md` 的裁定单独处置。

### 8.7 纪律：DDL 与账本必须同一事务

**本轮为什么退化成裸 SQL**：上一窗口遗留的两个后台命令在窗口内仍然存活（其中一个在窗口中途补写了 `id=1648`，用的是改前正文哈希 `3d779ec2…3781`），而窗口主体又是用 `psql -f <单文件>` 逐条执行。`psql -f` 只执行 DDL，不会写 `drizzle.__drizzle_migrations`；因此 #2–#9 的 DDL 全部生效，账本却 0 行，水位卡在 #1。后果是下一个人跑 `drizzle-kit migrate` 会重放已存在的 `CREATE TABLE` 并炸断迁移链。

**#9 正文身份与执行前改写（已开票 `DB-PREEXEC-EDIT-07007000`）**：`20261107007000` 在窗口内有两个版本，先后为

| 时刻（+08） | 事件 | 正文 |
|---|---|---|
| 10:43:29 | 文件创建（草稿） | 3734 B / `419e0e958380…4e572c` |
| 11:20:48 | `patch-0700-v2.mjs` 改写（去 EXCEPTION、补 `reason=missing_table`） | 3602 B / `7ee6bb49…6c71` |
| 11:33:13 | 生产窗口备份（`03:33` 基线） | — |
| 11:37:56 | #9 实际执行（`apply-9.log` `now=03:37:56.264Z`，同路径，`psql exit=0`） | 3602 B / `7ee6bb49…6c71` |

执行后文件 mtime 未再变化（仍为 `03:20:48Z`），且改文件的是本窗口自己的 `patch-0700-v2.mjs`（`11:20:48`，执行前 17 分钟），故**执行版 = 3602 / `7ee6bb49…6c71`**。此前据报的 3734 / `419e0e95…` 是 patch 之前的草稿，**不进入账本**。

规范化比对（去注释行、去空行、连续空白折单空格）结果 **`normalized_equal=false`**：差异为 2 个 `EXCEPTION WHEN others THEN` 块（行为差异：草稿吞错，执行版直接 abort）、2 处通知文案 `reason=missing_table`、2 处注释；**DDL 对象（表名/索引名/列名/`IF NOT EXISTS`）零差异**。按约定另开票 `docs/DB-PREEXEC-EDIT-07007000.md`，账本记执行版，草稿复原件只作证据（`D:/DevEnv/backups/drizzle_07007000_preexec_reconstructed_20261107040500.sql`，3734 B / `419E0E95…4E572C`）。

**下一轮硬规则**：

1. 一条迁移 = 一个事务：`BEGIN; <迁移正文>; INSERT INTO drizzle.__drizzle_migrations(hash, created_at) VALUES (...); COMMIT;`。DDL 与账本行同生共死，不允许先裸跑 DDL 再补账。
2. 生产窗口开始前先确认没有遗留的 migrate/repair 进程（`pg_stat_activity` + 进程表），否则同一水位会被两方同时推进。
3. 优先用仓库既有工具 `node scripts/check-db-migration-gaps.mjs --repair --yes`（先快照账本，再逐条单事务应用 + 补账本行），不要手写裸 SQL 绕过它。
4. 补账本只许 `INSERT` 新行，不许 `UPDATE` 任何既有 hash；确需删除错行时按精确 `id` 单独事务执行并先导出可回放 INSERT。
5. 记账 hash 必须取「执行时刻」的盘面正文：执行前记录文件 mtime + `sha256` 并留执行日志；执行后若正文再被改，另开 drift 票，禁止用新 hash 覆盖已应用行的旧 hash。
6. 部署窗口的 `db:migrate` 之前先跑 gap 检查，`pending != 0` 就停；下一个窗口的第一次 migrate 必须是**空应用**（见 `docs/DEPLOYMENT_RUNBOOK.md` §3 前置）。
7. `pending != 0` 不是「等下一次 migrate 自己补」，而是**先停部署**。禁止「先 migrate 看看能不能自己修好」——本轮所有账本/水位错位正是从这一步开始的；`pending` 归零前不许部署，也不许把 `pending` 洗成 `applied`。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
