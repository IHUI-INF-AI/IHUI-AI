<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# DB-PREEXEC-EDIT-07007000：`20261107007000` 执行前被改写（草稿 vs 执行版）

- 立票日期：2026-11-07
- 结论：**账本记执行版 `3602 B / 7ee6bb49…6c71`；`3734 B / 419e0e95…4e572c` 只作证据，永不作为账本 hash 来源。**
- **写死：3734 那份带 `EXCEPTION WHEN others THEN`（fail-open）的版本从未在生产执行过；生产执行的只有 3602（无 EXCEPTION，真实失败直接 abort）。任何人不得据此把 `EXCEPTION` 加回生产迁移。**
- 复原件：`D:/DevEnv/backups/drizzle_07007000_preexec_reconstructed_20261107040500.sql`（按 `patch-0700-v2.mjs` 逆算，非执行时盘面文件）。

## 1. 时间线（UTC / +08）

| 时刻 | 事件 | 正文 |
|---|---|---|
| `02:43:29Z` / 10:43:29 | 文件创建（草稿） | 3734 B / `419e0e958380…4e572c` |
| `03:20:48Z` / 11:20:48 | 本窗口 `patch-0700-v2.mjs` 改写 | 3602 B / `7ee6bb49…6c71` |
| `03:33:13Z` / 11:33:13 | 生产窗口备份 | — |
| `03:37:56Z` / 11:37:56 | #9 执行（`apply-9.log` `now=03:37:56.264Z`，同路径，`psql exit=0`，两条 `status=built`） | 3602 B / `7ee6bb49…6c71` |
| 执行后至今 | **零次写入**（mtime 仍 `03:20:48Z`，早于执行时刻） | 3602 B / `7ee6bb49…6c71` |

一句话：**改文件的是本窗口自己的 `patch-0700-v2.mjs`（11:20:48，执行前 17 分钟）；执行（11:37:56）之后没有任何人改过它。**

## 2. 规范化比对（去注释行、去空行、连续空白折单空格）

命令：`node C:\Users\Administrator\AppData\Local\Temp\ihui-db-mine\normalize-diff-0700.mjs`

输出：

```
current_bytes=3602 normalized_len=1191 sha=badd52ef359af96071ac173905ae8b6b1483f7305b4b999e9ebdb1fac2336ac4
draft_bytes=3734 normalized_len=1420 sha=781c6b244ff3070389f1752ad4aaf9cf72edae406f77c1b5e8dfe502582194d9
normalized_equal=false
first_diff_at=121
```

**不相等**。差异全部落在三类，逐条如下（`raw line diff` 摘要）：

1. **两个 `EXCEPTION WHEN others THEN` 块**（各 2 行）被删除：
   `RAISE NOTICE 'BUG-29 IDX AUDIT item=% status=skipped sqlstate=%', '<name>', SQLSTATE;`
   ⇒ 这是**行为差异**：草稿会吞掉其它错误并报 skipped，执行版对真实错误直接 abort。
2. **两处通知文案**：执行版 `status=skipped reason=missing_table sqlstate=42P01`，草稿为 `status=skipped sqlstate=42P01`（仅日志文案）。
3. **两处注释**：审计注释补充 `reason=missing_table`，并新增一行「无 EXCEPTION」说明。

**DDL 对象差异 = 0**：两个 `CREATE INDEX IF NOT EXISTS "ix_api_subscriptions_plan_id" / "ix_api_subscriptions_order_id" ON "api_subscriptions" ("plan_id"/"order_id")` 在 表名、索引名、列名、`IF NOT EXISTS` 上逐字相同；`to_regclass` 判据也相同。

## 3. 判定

- 规范化不相等 ⇒ 按约定**不开「直接记当前 hash」的口子**：本票即该口子的替代——账本记**执行版**，并在此留档两版差异。
- 执行版可从盘面复原（它**就是**当前盘面文件），因此不需要「已应用正文不可复原」的 drift 处理；需要留档的是「执行前被改」这件事，即本票。
- 账本 hash 取 `7ee6bb4915ee16cb90a7b1c13cfc8054c5497a1ccddfcae9943fe52a47dc6c71`（3602 B），与 `ledger-backfill-9.sql` 一致。
- 复原件 `419e0e95…` 仅用于说明草稿内容与差异来源，**不进入 `drizzle.__drizzle_migrations`**。

## 4. 验证与关闭

- 复核命令：
  `Get-FileHash -Algorithm SHA256 D:\IHUI-AI\.worktrees\wt-db-defect-mining-1107\packages\database\drizzle\20261107007000_add_api_subscription_plan_order_indexes.sql`
  期望 `7EE6BB49…C71` / `3602`。
- 账本侧：补行后 `node scripts/check-db-migration-gaps.mjs --json` 应 `pending=0`、该 tag 落入 `applied`（不再出现在 `hashDrift`）。
- 关闭条件：补行执行完成 + 上述两项复核通过；本票只做记录，不改任何旧行 hash。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
