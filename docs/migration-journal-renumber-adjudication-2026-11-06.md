<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 迁移 journal 重排的源码级裁决 @2026-11-06(RP-48 的结论落点;剩余射程交 RP-52)

本档只记录**已复算过的事实与由此得出的唯一合法形态**,未执行任何写库/写台账动作。
取证由席 I 完成、本席按同一命令复核;用前请重跑,机器事实不写死(AGENTS 根注)。

## 一、记账机制(读到函数级,不是推断)

- `pnpm db:migrate` → `drizzle-kit migrate`;drizzle-kit@0.31.10 的 CLI 实为
  `await import("drizzle-orm/postgres-js/migrator")`(其 `bin.cjs` 现读 14 处该 import)。
- 真判据在 drizzle-orm@0.45.2:
  - `migrator.js` 的 `readMigrationFiles(config)`:按 `journal.entries` **数组顺序**遍历,**不排序**;
    `hash = sha256(整份 .sql 全文)`,`folderMillis = journalEntry.when`。
  - `pg-core/dialect.js` 的 `PgDialect.migrate()`:建表
    `drizzle.__drizzle_migrations(id SERIAL, hash text NOT NULL, created_at bigint)`;
    循环**外**只读一行 `order by created_at desc limit 1` 得 `lastDbMigration`;
    循环内判据 `if (!lastDbMigration || Number(lastDbMigration.created_at) < migration.folderMillis)`。
- ⇒ **去重键 = `when` 的高水位(严格大于)**,既不是 hash 也不是 idx;`idx` 完全不参与记账。
  仓内同口径独立表述见 `scripts/check-migration-bookkeeping.mjs` 头注 B3/B4 与
  `scripts/check-db-migration-gaps.mjs` 头注「立因」。

## 二、三方现读

- BASE journal 365 条,与 OURS/THEIRS 前缀逐字节同集。
- OURS 新增 `idx=366 tag=20261105120000_tenant_rls_policies_batch1_install when=1793888061055`。
- THEIRS 新增 `idx=366 tag=20261104120000_agent_team_collab when=1793764800000` 与
  `idx=367 tag=20261106120000_tool_ledger_execution_facts when=1793937600000`。
- 三枚 `.sql` 在三面互不存在(交叉核验)。合并后应为 **368 条**。

## 三、由此得出的唯一合法形态,与为什么另两条不成立

| 出路 | 判语 | 依据 |
|---|---|---|
| (a) 按 `when` 时序重排:366=agent_team_collab / 367=tenant_rls / 368=tool_ledger | **成立** | 不改 `.sql` 正文 ⇒ 不触发守门 185(IM1 比首次入库 blob、IM2 比索引 vs HEAD,均按路径+blob 索引,不看 journal 字段);重排后 `when` 严格递增 ⇒ 过守门 49 B3;idx 连续无重复 ⇒ 过 B4 |
| (b) 保持对侧序号、把本侧那枚挪到末尾 | **不成立** | 会产生 `1793937600000(367) → 1793888061055(368)` 递减 ⇒ 守门 49 **B3 blocking 红**;且按高水位机制该条目永久漏执行 |
| (c) 认为存在结构性无解 | **不成立** | 无 tag↔idx 前缀耦合门(grep `check-migration-*.mjs` 无此类判据) |

## 四、本机库只读实测(未写库)

- 端口归属现读:`netstat` ⇒ 8810 由 `D:\DevEnv\runtimes\pgsql\bin\postgres.exe -D D:\DevEnv\data\pgdata` 持有。
- `drizzle.__drizzle_migrations`:368 行 / 368 distinct hash / 368 distinct created_at,
  `max(created_at) = 1793944800000`。
- 两枚外来 tag **在账**(hash 与从对象库逐字节取回的 `.sql` 的 sha256 相等):
  `20261104120000_agent_team_collab`(blob `1927ea802b13264e4ba0ce8ba91235af5e572650`)、
  `20261106120000_tool_ledger_execution_facts`(blob `20d8c2289f16bc9e5cd19d3170a9b180e952ab96`)。
- `20261105120000_tenant_rls_policies_batch1_install` **不在账** ⇒ 落在 1793764800000~1793937600000
  空档内 ⇒ 按 §一 的高水位判据 `drizzle-kit migrate` **永不补跑,且 exit 0**(静默漏执行)。
- 现读 `node scripts/check-db-migration-gaps.mjs`:`lateGap=1(tenant_rls) pending=1(share_token) hashDrift=18`。
- 另有一条账本带外行 `created_at=1793944800000` = `20261106140000_chat_ledger.sql`
  (blob `f79fdecdcb65449175bec27a2ea89f83c93fac6e`,不在 HEAD 也不在工作树)
  ⇒ **不要为它补 journal 条目**(守门 49 B1 要求 tag↔.sql 双向配对,补了立刻红),先放回 `.sql`。

## 五、RP-52 的前置(不修则必红)

1. 两枚外来 `.sql` 逐字节放回 `packages/database/drizzle/`(含零宽水印;禁 reflow/重注入,§5c)。
2. tenant_rls 的 lateGap 是**合并前就存在的独立缺陷**,出口
   `node scripts/check-db-migration-gaps.mjs --repair --yes`(写 sha256 正规记账);
   **禁止** `packages/database/scripts/apply-migration.mjs` —— 它写 `hash = manual_${tag}_${Date.now()}`,
   正是守门 49 B9 点名的污染形态。
3. 改完复跑:`node scripts/check-db-migration-gaps.mjs` 与守门 49,并贴末行读数。

## 六、本席未做的事(如实)

- 未重排 journal、未放回 `.sql`、未 `--repair`、未写库 —— 全部只读。
- 未改 RP-48 的归属桶:声明式出口 `plan-fields-reclassify.mjs` 复算要求复合主键在**写面**存在,
  而共享工作树的 PROJECT_PLAN.md 副本此刻停在别席的暂存态(索引 `352f68cc9 ≠ 父提交态`,
  live-doc-edit 报「归属他人 ⇒ 不动」)。改这条要先让那一格收口,不是本席能替它定的。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
