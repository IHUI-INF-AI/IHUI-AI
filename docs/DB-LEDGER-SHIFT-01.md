<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# DB-LEDGER-SHIFT-01 迁移账本位移：lateGap 终身性与效果证明

> 状态：2026-11-07 生产归档 7 条 + 方案 A 重绑 137 条已完成。
> 本票只记录 **lateGap 的终身性** 与 **效果存在性证据**，不承诺「跑 migrate 能修好」。

## 1. 终身性（写死，不要再当作可修项）

- `lateGap` = journal 有条目、账本无对应行、且 `when <= maxApplied`。
- drizzle 的 `migrate` 只应用 `when > max(账本.created_at)` 的迁移；水位以下的空位
  **永远不会再被补账本行**。
- 因此：**lateGap 不可能靠跑 migrate 消掉**，只能靠「效果存在性」体检证明它确已应用。
  证明不了的，明着红。
- 禁止把 lateGap 塞回 `scripts/migration-hash-drift-exempt.json`：豁免只对 `hashDrift` 生效，
  塞回去等于把真实的信息缺口重新遮住。

## 2. 生产实测读数（2026-11-07，只读）

- 账本 361 行 + 归档 7 行 = 原 368；`count(*) = count(distinct created_at)` ⇒ `collisions=0`。
- 逐行自证：`green=343 / red=18 / masked-green=0`。
- 门：`applied=343 / hashDrift=18(豁免 18,未豁免 0) / pending=8 / lateGap=7`；
  `state=red`，只因 lateGap。
- 18 条红行：13 条真实改写、2 条无法归因（1555 / 1560）、3 条重绑不了（569 / 575 / 710）。

## 3. 7 条 lateGap 逐条（效果证据均来自生产只读查询）

> 补记（2026-11-07）：下表最后一条的「3 表 / 8 列 / 7 索引全缺」是**窗口前状态**，
> 已于 2026-11-07 由 `#2 = 20261107000000_repair_api_subscription_drift` 逐条同文重建，现均存在。
> 「跑过了」与「没跑但效果由别人重建」是两件事：前者应产生账本自证行；后者不产生账本行，
> 只能用覆盖注记表达（见 §3.1 与 `docs/DB-LATEGAP-SUPERSEDED-01.md`）。

| tag | 效果证据 | 判定 |
|---|---|---|
| `0108_r83_supplement_27_tables` | 文件内 23 张建表，21 张在；`t_homework` / `t_check_in_record` 由 `0143_drop_legacy_learn_tables`、`20260906173000_drop_dead_tables` 显式 DROP；抽检 11 列全在 | 已应用，无自证行 |
| `0110_skills_tombstone` | `skills.deleted_at` 在；`skills_deleted_at_idx` 在（该索引仅本文件创建） | 已应用，无自证行 |
| `0126_ai-world-sync` | `ai_world_sync_log` 在；4 列在；4 索引在 | 已应用，无自证行 |
| `0212_phase2_refund_invoice_fk` | 新 FK 2 个在、旧 FK 2 个不在；`edu_refunds.order_type = integer` | 已应用，无自证行 |
| `20260913000000_llm_call_logs_config_id_bigint` | `llm_call_logs.config_id` 已是 `bigint` | 已应用，无自证行 |
| `20260913160000_multimodal_billing` | `ai_pricing` 4 列、`llm_call_logs.call_type`、`llm_call_logs_call_type_idx` 全在 | 已应用，无自证行 |
| `20260916170000_api_subscription_windows_and_peak_pricing` | 3 表 / 8 列 / 7 索引全缺（**窗口前状态，已于 2026-11-07 由 #2 重建，现均存在**）；全 376 个迁移无 DROP 指向它们 | **从未执行**：效果由 `#2` 逐条同文重建 → 永不需要补行（§3.1） |

### 3.1 去向裁定（2026-11-07 收口，一票一条）

**生产实读更正**：§3 表最后一行的「3 表 / 8 列 / 7 索引全缺」是**窗口前**状态。本窗口的
`#2 = 20261107000000_repair_api_subscription_drift` 已把 `20260916170000` 的全部对象**逐条同文重建**
（同 8 条 `plans` 列、同 3 张表、同名 7 个索引，`CREATE/ALTER ... IF NOT EXISTS` 一条对应一条），
现全部存在。今日 DB 实读：3 表 + 8 列 + 7 索引全 `t`。

| tag | 现状（今日生产只读） | 去向 | 依据 |
|---|---|---|---|
| `0108_r83_supplement_27_tables` | 23 张表中 21 张在；`t_homework`/`t_check_in_record` 已被 `0143`、`20260906173000` 显式 DROP | **补账本行**（`when=1709331200000`） | 21 张现役表是该迁移的唯一建表来源，仍是现行 schema 的祖先；被后迁移删掉的那 2 张不需要任何补偿（删是正确的终态） |
| `0110_skills_tombstone` | `skills.deleted_at` 在；`skills_deleted_at_idx` 在 | **补账本行**（`when=1709504000000`） | 该索引全仓仅本文件创建（`0108` 也 `ADD COLUMN IF NOT EXISTS deleted_at`，幂等重叠不是替代）；效果仍存活 |
| `0126_ai-world-sync` | `ai_world_sync_log` 在；4 列 / 4 索引在 | **补账本行**（`when=1710540800000`） | 全仓唯一创建点（且不是 `IF NOT EXISTS` 形式），无后迁移重建；效果仍存活 |
| `0212_phase2_refund_invoice_fk` | 新 FK `_orders_id_fk` 2 个在、旧自动命名 `_fkey` 2 个不在；`edu_refunds.order_type = integer DEFAULT 0` | **补账本行**（`when=1712096000000`），并注明「删旧 FK 当时落空」 | 净效果（`order_type` 类型/默认）仍存活；旧 FK 是 `20261107001000`（#3）才真正删掉的 —— 账本行不得洗掉这一事实 |
| `20260913000000_llm_call_logs_config_id_bigint` | `llm_call_logs.config_id` 已是 `bigint` | **补账本行**（`when=1721859200000`） | 效果仍存活且无后迁移重做类型变更；正文含 `DROP DEFAULT`+`USING`，是唯一来源 |
| `20260913160000_multimodal_billing` | `ai_pricing` 4 列、`llm_call_logs.call_type` 及其索引全在 | **补账本行**（`when=1722118400000`） | 效果仍存活且唯一；未见后迁移重建 |
| `20260916170000_api_subscription_windows_and_peak_pricing` | 3 表 / 8 列 / 7 索引全在（由 #2 重建） | **永不需要补行** | 该迁移**从未实际执行**（窗口前其对象全缺，全仓无 DROP 指向它们）；`#2` 的语句与本文件逐条同文，已把全部效果重建并入账。补一条「已执行」的账本行等于断言一件没发生过的事 |

**补 6 行（2026-11-07 已执行）**：生产账本 `370 → 376`（`id=1658…1663`），`applied 352→358`、
`lateGap 7→1`（只剩 `20260916170000`，已由覆盖注记标为 superseded、不进 `applied`）、
`hashDrift` 仍 18、`maxApplied` 不变（6 个 `when` 均低于水位 `1793952420000`）。
执行前备份：`D:/DevEnv/backups/ledger_pre_backfill6_20261107141611.csv` +
`.replay.sql`（370 条 INSERT + setval）。

**剩下那 1 条怎么办**：工具侧原先只能靠「账本有行」把 lateGap 清零；本票**不允许**用一条假行换
绿灯。(a) 接受它长期显示为 1 条已解释 lateGap；(b) 给工具加 `lateGapSuperseded` 注记
（带覆盖迁移 tag + 生效日期），把「被后续迁移逐条同文覆盖」作为合法出口。
**(b) 已落地（2026-11-07，见 `docs/DB-LATEGAP-SUPERSEDED-01.md`）**：该条仍计入 `lateGap=1`，
另立 `lateGapSuperseded` 桶并带 `coveredBy` / `effectiveAt`，结构上不进 `applied`。

## 4. 归档与回滚

- 7 条原行在 `drizzle.__drizzle_migrations_orphan_archive_20261107`
  （`id / hash / created_at / archived_at / reason / evidence`），不物理删除。
- 回滚：`db-ledger-orphan-archive-rollback-20261107.sql`；A 回滚：`db-ledger-rebind-rollback.sql`。
- 归档 + A 分两个事务提交，任一步与 dry-run 不一致即可独立回退。

## 5. 本地一次性副本与正文哈希台账（2026-11-07 裁定）

准入判据改为：**生产与所有服务态环境 `20261106150000` 应用计数 = 0**。本地一次性副本不计入「环境」。

| 库 | 位置 | 06150000 行 | 记录的 hash | 对应正文 | 处置 |
|---|---|---|---|---|---|
| `ihui_dev` | 8810 | **1（id=1648，窗口内异动；详见 §5.2）**（max=1793948400000） | `3d779ec2…3781`（改前正文，非终版） | 生产；DDL 已按终版执行，账本待补 9 行 |
| `ihui_dbg_prod341` | 8810 | 1（id=368） | `11a555f5…7eb7c5` | 历史旧版 | 一次性副本，0 连接，非发布目标 |
| `ihui_fz_f5363d16m` | 55432 | 1（id=369） | `3d779ec2…403781` | 改前当前版 | 复现靶场，0 连接，非发布目标 |
| `ihui_e2e` / `ihui_ci_test` / `ihui_probe_err` | 8810 | 0 | - | 未应用 | 保持原样不动 |

四份正文（含一次中间版）：

| 版本 | sha256 | 字节 | 来源 |
|---|---|---|---|
| 历史旧版 | `11a555f5e7b0c9345d50a51d326d1b0fdfc3a07c440adc54e67a9817dc7eb7c5` | 27238 | git blob `229455405a1e…`（首次提交 `8362ac24fa79`）；`ihui_dbg_prod341` 账本记此 hash |
| 改前当前版 | `3d779ec2b204322e240932e0343fbce35e50c4012f6127b867f8e40802403781` | 30380 | git blob `408a3b0ca43f…`（首次提交 `a2f30f94c159`）；`ihui_fz_f5363d16m` 账本记此 hash |
| 改后守卫版 v1（作废） | `b44eae860af19d30c60cd61ba2b97679729c8fc680a23a6bfb2028b84a6b0e25` | 41354 | 2026-11-07 第一次守卫化，被 D1/D2/D3 裁定取代，未进任何库 |
| **改后守卫版 v2（终版）** | `895389c930dd06e4c427f31a0da8e19df46b38aade77c20116cb8992ddfc7175` | **45532** | 本轮工作树；**生产窗口已按此正文执行**（DDL 效果 158/158 索引、27 FK）；`EXCEPTION WHEN others` 全删、27 FK 四分支、D2/D3 删除 |
| 新增补偿迁移 `20261107007000_add_api_subscription_plan_order_indexes` | `7ee6bb4915ee16cb90a7b1c13cfc8054c5497a1ccddfcae9943fe52a47dc6c71` | 3602 | journal idx 377 / when 1793952420000；无 EXCEPTION |

**这 2 个副本永不作发布目标；账本漂移是已知偏差，不追认、不改写。**

### 5.1 「#1 没炸」反常的解释

- `ihui_fz_f5363d16m` 账本 id 1..375 连续，且包含 `20260916170000`（id=260，hash 与其当前正文一致）⇒ 它是**从 0 跑完整条 journal 链**的库。
- 该迁移在 fz 里先建好 `api_subscriptions`，所以 id 369 的 `20261106150000` 两个索引能建成。
- 生产账本中 `20260916170000` **0 行**（lateGap：when 低于水位，migrate 永不应用），因此生产在 #1 时缺表。
- 结论：不是手工预建、不是 journal 顺序不同；是这条 lateGap 迁移在 fz 生效、在生产不生效。fz 起点与生产不同，故续跑兼容另用克隆靶场验证（见 DB-SCHEMA-GAP-01 §8.3）。

### 5.2 生产窗口账本异动与补行（2026-11-07，只读证据已交，仍待放行）

**事实**：窗口内 `drizzle.__drizzle_migrations` 361 → 362，仅新增 `id=1648`（`created_at=1793948400000` = `20261106150000` 的 when），hash 为改前正文 `3d779ec2…3781`（30380B），且不在 03:33 备份 CSV 中。窗口内 #2–#9 的 DDL 全部真实执行，但账本 0 行，水位仍停在 #1。

**#9 正文身份（已定案：记 3602 / `7ee6bb49…6c71`）**：

| 时刻（+08） | 事件 | 正文 |
|---|---|---|
| 10:43:29 | 创建（草稿） | 3734 B / `419e0e958380…4e572c` |
| 11:20:48 | `patch-0700-v2.mjs` 改写 | 3602 B / `7ee6bb49…6c71` |
| 11:33:13 | 生产备份（03:33 基线） | — |
| 11:37:56 | #9 执行（`apply-9.log` `now=03:37:56.264Z`，同路径，exit=0） | 3602 B / `7ee6bb49…6c71` |
| 之后 | 未再改动（mtime 仍 `03:20:48Z`） | 3602 B / `7ee6bb49…6c71` |

改文件的是本窗口 `patch-0700-v2.mjs`（11:20:48，执行前 17 分钟），执行后零次写入（mtime 仍 `03:20:48Z`）；执行版 = 3602 / `7ee6bb49…6c71`。规范化比对 **`normalized_equal=false`**：差异 = 2 个 `EXCEPTION WHEN others THEN` 块（行为差异）+ 2 处通知文案 + 2 处注释，**DDL 对象零差异**；按约定另开票 `docs/DB-PREEXEC-EDIT-07007000.md`，账本记执行版，草稿复原件（3734 B / `419E0E958380…4E572C`）只作证据。四版表不保留 3734 读数。

**hashDrift 三份读数（`node scripts/check-db-migration-gaps.mjs --json`，只读）**：

| 库 | rows | applied | pending | lateGap | hashDrift | 其中未豁免 | maxApplied |
|---|---|---|---|---|---|---|---|
| `ihui_dev`（生产基线，362） | 362 | 343 | 8 | 7 | 19 | 1（`20261106150000`，因 1648 记旧 hash） | 1793948400000 |
| `ihui_replica_1107`（补行后，370） | 370 | 352 | 0 | 7 | 18 | 0 | 1793952420000 |

**补行不新增漂移**：`introduced_by_backfill = []`；`resolved_by_backfill = [20261106150000_fix_missing_indexes_fks]`（19 → 18）。其余 18 条均为补行前既有债（逐条见 `docs/DB-HASH-DRIFT-18.md`）。此前“其余 361 行全部 hash 与当前正文匹配”的表述有误：实际为 343 applied + 18 既有 drift + 1 条 #1 drift。

**执行前后六读数并列（执行前为实测，执行后为验收线）**：

| 时点 | rows | applied | pending | lateGap | hashDrift | maxApplied |
|---|---|---|---|---|---|---|
| 执行前（`ihui_dev`） | 362 | 343 | 8 | 7 | 19 | 1793948400000 |
| 执行后（验收） | 370 | 352 | 0 | 7 | 18 | 1793952420000 |

**处置（C 裁定，尚未写生产）**：按精确 `id=1648` 删除该行，再为 9 条已应用迁移各补一条 `INSERT`（只增不改旧 hash）：

| 补行 | tag | when | 字节 | sha256 |
|---|---|---|---|---|
| 1 | `20261106150000_fix_missing_indexes_fks` | 1793948400000 | 45532 | `895389c930dd06e4c427f31a0da8e19df46b38aade77c20116cb8992ddfc7175` |
| 2 | `20261107000000_repair_api_subscription_drift` | 1793952000000 | 8030 | `1f0f322a2618aa564742d76643b4e5784804778f8a4fa14e7f655538ec4b36b6` |
| 3 | `20261107001000_drop_stale_refund_order_fk` | 1793952060000 | 4893 | `e5fbefac341c426f58f95e448f592edb3f8dcc1ef4e76f6d358b8717c12778e5` |
| 4 | `20261107002000_chat_share_token_expires_at` | 1793952120000 | 2170 | `63539906897dd2ec8b382be4ed967cd9f0081d08ab7224c6bbefb1f5120c0370` |
| 5 | `20261107003000_crash_reports_user_fk` | 1793952180000 | 2700 | `76a8ff27620f2d22a2d21dd8d098ebf0736511c917fad9a27a2f5af08f721252` |
| 6 | `20261107004000_edu_attendance_rule_partial_unique` | 1793952240000 | 3037 | `6ba098c0b47be6d2005067a673bea507fd2ab72ef9cf19a159ed956cd5088edb` |
| 7 | `20261107005000_t4_not_null` | 1793952300000 | 7662 | `9d269500caddfff5259618d3e0f74f4ce7019daaf86e1fc0f0c2d12fb7fe7d43` |
| 8 | `20261107006000_rewrite_default_cleanup` | 1793952360000 | 2858 | `4a08eecbb361a1ee4872da0d05bbc31b8cf5ef63ecbff39badf1826e63e89caf` |
| 9 | `20261107007000_add_api_subscription_plan_order_indexes` | 1793952420000 | 3602 | `7ee6bb4915ee16cb90a7b1c13cfc8054c5497a1ccddfcae9943fe52a47dc6c71` |

**副本验证（`ihui_replica_1107`，SQL 终版，`psql -v ON_ERROR_STOP=1 --single-transaction -f`）**：

- 回滚注入：副本复位到 362 行 → 跑 `ledger-backfill-9-failtest.sql`（末尾 `SELECT 1/0`）→ `exit=3`、`ERROR: division by zero`；事后 `362/362`、max=`1793948400000`、`1648=1`、`created_at >= 1793948400000` 仅 1 行 ⇒ 全量回滚，无半截插入。
- 正式补行：`exit=0`；NOTICE 依次 `pre_assert rows=362 row_1648=1`、`delete_row_count=1`、`insert_row_count=9`、`assert rows=370 distinct=370 max=1793952420000 below1648=361 above1648=9`；`INSERT 0 9`。副本 id 为 1658–1666（回滚测试已推进序列，序列不随事务回滚）；生产首次执行预计 1649–1657，断言不绑死 id。
- gap：`pending=0 / lateGap=7 / hashDrift=18 / maxApplied=1793952420000`。
- `drizzle-kit migrate`：`exit=0`，仅 `schema/table already exists` NOTICE，未应用任何迁移；账本保持 370 行。**生产不跑 `drizzle-kit migrate`**：副本已证明不再重放，生产只跑补行 SQL；下一个部署窗口的第一次 migrate 必须空应用，前置检查见 `docs/DEPLOYMENT_RUNBOOK.md` §3（`pending != 0` 即停）。
- 执行前快照：`ledger_pre_exec_20261107041447.csv` 与 `ledger_pre_backfill_20261107035555.csv` **逐字节相同**（sha256 `7B1CFBB8B2BE55E69DCCDBCBFD21019D80740E3F3D5F1F3B306817E79D55CD06`，362 行 / max 1793948400000 / 1648=1）。

**备份清单**：`ledger_pre_backfill_20261107035555.csv`（362 行全表）、`ledger_362_mapped_20261107035555.csv`、`ledger_row_1648_replay_20261107035555.sql`、`ledger_pre_exec_20261107041447.csv`、`drizzle_07007000_preexec_reconstructed_20261107040500.sql`。

**已执行（2026-11-07）**：9 行补行已于前序窗口写入生产（`id=1649…1657`，终态 370/370/max=1793952420000）；
6 行补行见 §3.1（`id=1658…1663`，终态 376/376/max 不变）。gap 检查：`pending=0、lateGap=1（superseded 1、unresolved 0）、hashDrift=18`。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
