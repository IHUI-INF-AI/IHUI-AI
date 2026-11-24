<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# BUG-29 索引与约束缺失族 — 全量量化对账（已复核更正）

> 生成：2026-11-18 · 方法：程序化扫描 `packages/database/src/schema/*.ts`(253) + `packages/database/drizzle/*.sql`(438) + `meta/_journal.json`
> **生产部署模式已核实 = `db:migrate`（drizzle-kit migrate，见 `deploy/docker/Dockerfile.migrate`、`deploy/win/ihui-deploy.ps1`）；push 非生产路径。**
> 本报告为只读诊断；未改 schema/迁移/journal。补丁须走专票 + 生产 `db:migrate` 先行验证。

## 总览（首扫 → 复核更正）

| 格                  | 票面   | 首扫   | **复核定论**                         | 说明                                                                                          |
| ------------------- | ------ | ------ | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| 外键列无索引        | 123    | 131    | **131**                              | 确认（增长 8）                                                                                |
| userId 无 FK        | 24     | 151    | **151**（notNull 14 / nullable 137） | 票面口径复测；与登记 24 分歧大，见下                                                          |
| schema 索引无 DDL   | 10     | ~~40~~ | **0（无缺陷）**                      | 首扫严格 regex 误报；宽松 regex + 去注释后仅 1 条且在 schema 里是注释掉的 GIN 索引 ⇒ 不算声明 |
| 同表 DDL 列类型不同 | "两份" | 15     | **15 真实冲突（8 破坏性）**          | 过滤 squash 噪音后定位                                                                        |
| orders 索引迁移重复 | 2      | —      | **已修**                             | 收缩 31000，journal 不动                                                                      |

> **格 2 口径分歧（须专票确认）**：票面登记 24 处，本次用票面口径（`userId: uuid('user_id')` 声明且该列定义无 `.references()`）全量复测得 **151 处**——票面点名的 8 个 schema 里就能数到 10 条，故 24 疑为登记时刻的部分表集估计，**须以本复测 151 为现值**。其中仅 14 处是 `notNull`（删用户即产生永久孤儿行，风险最高），137 处为 nullable（孤儿风险较低，加 FK 前须先清历史脏值）。

> **重要更正**：格 3 首扫报的 40 条是我用严格 regex（只吃带引号 `CREATE INDEX "x"`）漏掉了不带引号写法所致的**误报**。用宽松 regex 复核并对 schema 侧去注释后，schema 声明的 1154 枚索引在迁移里全部有对应 CREATE，**格 3 实际无缺陷**。此更正已写进 JSON 与本报告，避免后续按误报开无谓专票。

## 格 1：外键列无索引（131）— 确认

FK 声明总数 498，无索引覆盖 131。高发：`edu-ai-management.ts` 10 / `billing.ts` 6 / `community.ts` 6 / `workflow.ts` 6 / `commission.ts`·`exam.ts`·`hr-attendance-monthly.ts`·`team-knowledge.ts` 各 5。
补丁：一个迁移批量 `CREATE INDEX IF NOT EXISTS "<t>_<c>_idx" ON "<t>" ("<c>")`；超千万行改 `CONCURRENTLY`。

## 格 2：userId 列无 FK（151，notNull 14 / nullable 137）— 口径分歧待专票确认

口径：`userId: uuid('user_id')` 声明且该列定义无 `.references()`。

- 票面登记 **24**，本次全量复测 **151**（分歧见总览注）
- **notNull 14 处风险最高**：删用户即产生永久孤儿行（票面点名 `user-automations` / `agent-event-triggers` / `agent-rule` / `analytics-events` / `clawdbot` / `exam-extended` / `user-memory` / `webhook-subscriptions` 等均命中）
- 高发 schema：`customer-service.ts` 5 / `order.ts` 5 / `chat.ts`·`memory.ts`·`oauth.ts` 各 4

补丁：加 FK 前须先清历史脏值（nullable 那 137 处可能有指向已删用户的悬空 id）。建 `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE ...`，删级联策略逐表定（不能一刀切 cascade）。**须专票 + 生产库先查悬空值再定**。

## 格 3：schema 索引无 DDL — 0（更正为无缺陷）

宽松 regex（带/不带引号都吃）复核：declared **1154** / created **1647** / no_ddl **0**。唯一候选 `search_contents_search_text_gin` 在 `search-contents.ts:69` 是**注释掉的** GIN 索引，不是有效声明。

## 格 4：同表 DDL 列类型不同 — 15（8 破坏性）

229 表被 CREATE 多次，绝大多数是 drizzle squash 遗产（0000 genesis + 0043 baseline，`IF NOT EXISTS` noop，无害）。过滤后 15 真实冲突。

### 破坏性冲突（主键类型根本不兼容，8 项）⚠️

| 表.列                          | A ↔ B                   | 迁移                 |
| ------------------------------ | ----------------------- | -------------------- |
| video_generation_tasks.id      | serial ↔ integer        | 0038/0043 ↔ 0112     |
| video_generation_tasks.task_id | varchar(36) ↔ uuid      | 同上                 |
| video_generation_tasks.result  | text ↔ jsonb            | 同上                 |
| gen_table_column.table_id      | bigint ↔ integer        | 0038/0043 ↔ 20260831 |
| tbox_bean.id                   | bigserial ↔ serial      | 同上                 |
| tbox_bean.bean_data            | text ↔ jsonb            | 同上                 |
| live_gift.id                   | serial ↔ uuid           | 0044 ↔ 20260831      |
| live_gift.channel_id           | integer ↔ uuid          | 同上                 |
| live_gift.user_id              | varchar(64) ↔ uuid      | 同上                 |
| live_gift.total_price          | integer ↔ numeric(20,4) | 同上                 |

现网结构取决于"哪枚最后跑"，schema 漂移不可控——优先级最高，须先查 `information_schema.columns` 实际类型定 ALTER 方向。

### 非破坏性（varchar 长度/精度，7 项）

users.phone(11↔20) / gen_table_column.column_comment(1000↔500) / ab_test_results.bucket(32↔64) / ab_test_variants.name(100↔255) 等。

## 已修的一手补丁

`20261114031000_orders_paid_created_at_idx.sql` 收缩：移除与 schema `billing.ts:115` + 91400 重复的 `orders_status_paid_at_idx`，只保留独有的 `orders_status_created_at_idx`。journal 不动 ⇒ 已 applied 库按 hash 记账零影响。

## 下一步（须专票 + 机主拍板）

1. 格 4 八项破坏性冲突优先：查现网 `information_schema.columns` 实际类型 → 定 ALTER 方向 → 写迁移 → 生产 `db:migrate` 验证。
2. 格 1 的 131 个 FK 索引可一个迁移批量补（按行数定 CONCURRENTLY）。
3. 格 2 的 151 处 userId 无 FK：先查各表悬空 user_id（nullable 那 137 处最可能有脏值）→ 逐表定 ON DELETE 策略 → 加 FK 迁移；notNull 那 14 处风险最高优先。
4. 所有迁移先生产 `db:migrate` 验证再上线（0364 硬约束）。

机器可读数据：`scripts/data/bug29-index-audit.json`
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
