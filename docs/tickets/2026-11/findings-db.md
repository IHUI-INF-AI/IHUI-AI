<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

> 【过期快照警告 · 执行前必读】本报告基线 `895027a9d6` 远早于当前 `origin/main`（`e2b004b74940af915320eefa22c8c12093009e7e`）。
> 文中行号与「当场可修」结论大概率已失效，曾被误当作当前真相并误导后续 agent（已因此浪费一轮验证）。
> 凡 `PROJECT_PLAN.md` 引用本报告的任一条目，动手前**必须先对照当前代码复核**（强制纪律见 `RECONCILE-findings-staleness.md` 第四节）。
> 已确认在当前代码修复的条目，见文内 `【已修复@当前代码】` 标注。

# 数据库与迁移面缺陷普查报告

- 仓库：`D:\IHUI-AI`
- 基线：`origin/main` @ `895027a9d644ce0688bb0d533281cf097db69578`（已 `git fetch origin`）
- 说明：本地 HEAD 领先 origin/main 25 个未推提交且工作树脏，**本报告所有结论均取自 origin/main 的 blob**（`git show origin/main:<path>` / `git grep origin/main`）。
- 纪律：全程只读。未改仓库、未提交、未 push、未写盘（仅本报告落盘）、未连接任何数据库（含生产库）。
- 去重基准：`PROJECT_PLAN.md`、`scripts/data/plan-fields.jsonl`（后者无 DB/迁移相关键）。

## 汇总

**新增 46 条**：P1 × 3、P2 × 32、P3 × 11。

| 扫描面 | 编号 | 新增 |
|---|---|---|
| 迁移链与执行机制 | DB-01、04–12、36 | 11 |
| 台账与对账 | DB-13–15 | 3（DB-01/12 已计入迁移面，不重复计数） |
| schema 与约束一致性 | DB-16–19、37 | 5 |
| 查询面与事务 | DB-02–03、20–25 | 8 |
| 连接池与读写分离 | DB-26–31、41–42 | 8 |
| 数据安全 | DB-32–35、38–40 | 7 |
| 批处理/JSONB/旧表 | DB-43–46 | 4 |

已登记、不重复计数：RLS 覆盖缺口（O13b，`PROJECT_PLAN.md:2298,2739`）、0364 排序双轨（`PROJECT_PLAN.md:31633`）、手工应用不进账本（`PROJECT_PLAN.md:4173`，DB-01 是其不同机制的延伸）、B11 设计自述（`.github/workflows/ci.yml:195`）、10 处声明索引无 DDL（`PROJECT_PLAN.md:31685`）、`rag_chunks`/`ownership_backfill_state` 运行期建表。

---

## A. 迁移链与执行机制

### DB-01 手工执行器写「伪账本」：`manual_` 假 hash + `Date.now()` 抬高高水位
- **严重度**：P1
- **位置**：`packages/database/scripts/apply-migration.mjs:25,109-111,114-116`；消费方 `scripts/check-db-migration-gaps.mjs:62-81`、`scripts/check-migrations-landed.mjs:107,195-197`、`deploy/win/ihui-deploy.ps1:3017-3021`
- **触发路径**：按迁移文件头注执行 `node scripts/apply-migration.mjs <tag>.sql`（仓内 23 个迁移如此指引），或手工应用后再执行部署环。
- **根因**：写入 `hash = manual_${tag}_${Date.now()}`、`created_at = Date.now()`，而非 drizzle 的 sha256 与 `journal.when`；账本 INSERT 失败只打印“写入跳过”而不退出。
- **证据**：`check-migrations-landed.mjs:107` 要求 hash 匹配 `/^[0-9a-fA-F]{16,}$/`，`manual_*` 必失败并返回 `undetermined/exit 2`；而 `check-db-migration-gaps.mjs` 的 `maxApplied` 取账本最大 `created_at`，`Date.now()` 把高水位抬到“今天”，所有更早 `when` 的未应用条目被判 `lateGap`（drizzle 永不补）。
- **影响面**：手工应用一次即可让部署落地审计整份 `undetermined`、让 gaps 静默漏掉真实待应用迁移；`--repair` 重放非幂等语句会二次报错。
- **建议**：改为 `sha256(文件全文)` + `created_at = journal.when`，SQL 与账本同事务；删除 `manual_` 前缀；迁移头注同步清理。
- **当场可修**：是（脚本级）。
- **去重**：`PROJECT_PLAN:4173` 已登记“手工应用不进账本”；本条是“写入非法 hash 并抬高 maxApplied”的反向机制，**计新增**。

### DB-04 手工执行器仍只识别 `$$`，会切碎 `$fn$/$con$/$ot_conv$`
- **严重度**：P2
- **位置**：`packages/database/scripts/apply-migration.mjs:34-78`（`next2 === '$$'`）；真实命名标签迁移如 `packages/database/drizzle/0127_dazzling_master_mold.sql:211`、`20260906174000_audit_partition_ensure_fn.sql`、`20260921160000_scoped_app_role_owner_rls.sql`
- **触发路径**：用 `apply-migration.mjs` 应用任何含命名 dollar-quote 的迁移。
- **根因**：分割器只把 `$$` 当开关，`$fn$`/`$con$` 不触发，函数体内部 `;` 被当作语句边界。
- **证据**：对 0127 复刻同函数切分得到 `statements=88, dollarBalanced=false, fragmentsWithConTag=8`，首段为 `DO $con$ BEGIN ALTER TABLE ...` 无闭合；PostgreSQL 报 dollar-quote 未闭合。
- **影响面**：手写迁移执行即失败；因无事务（DB-05），失败前的 DDL 已自动提交，留下半套结构。
- **建议**：抽一份共享 `split-sql.mjs`（命名标签 + 块注释）并补单测；两个执行器共用。
- **当场可修**：是。
- **去重**：未登记。

### DB-05 手工执行器逐语句自动提交，且按字符串子串吞错
- **严重度**：P2
- **位置**：`packages/database/scripts/apply-all-migrations.mjs:161-168`；`packages/database/scripts/apply-migration.mjs:88-96`
- **触发路径**：任一迁移中第 N 条语句失败（锁超时、语法、权限、重复键）。
- **根因**：循环 `await sql.unsafe(stmt)` 无 `BEGIN/COMMIT`；错误判据是消息含 `already exists`，或含 `does not exist` 且语句文本含 `DROP`（注释文字也会命中）。
- **证据**：两文件全文无 `BEGIN/COMMIT`；`20261106140000_chat_ledger.sql:6` 的文件头注“三表均为纯新增:无 DROP…”会并入首条语句，若首条语句报 `... does not exist` 即满足跳过条件。
- **影响面**：必需对象未创建却被记为已应用；运行期报 `42P01/42703`，账本却显示绿。
- **建议**：按文件包事务；跳过改为按 SQLSTATE（42P07/42710/42701/42P01）白名单并打印对象名；含 `CONCURRENTLY` 的文件拒绝走该执行器。
- **当场可修**：是。
- **去重**：未登记。

### DB-06 `apply-all` 不识别块注释，真实迁移被切碎；自检容差掩盖
- **严重度**：P2
- **位置**：`packages/database/scripts/apply-all-migrations.mjs:63-145,155`；触发文件 `packages/database/drizzle/20261002033500_im_messages_platform_msg_unique.sql:10`
- **触发路径**：对 dev/test 执行 `node packages/database/scripts/apply-all-migrations.mjs`。
- **根因**：分割器只处理单引号、`--`、dollar-quote，不处理 `/* */`；块注释内 ASCII `;` 被当语句结束；自检允许 `statements = semicolons + 1`，刚好吃下这次误切。
- **证据**：复刻切分得到 `semicolons=4, statements=5, passesSelfCheck=true`，前两段分别是未闭合块注释与以中文正文开头的片段。
- **影响面**：该文件之前已提交 300+ 文件，随后失败；无账本、无事务，dev/test 库停在半套状态。
- **建议**：分割器加入块注释状态；自检要求 `semicolons === statements`。
- **当场可修**：是。
- **去重**：未登记（`PROJECT_PLAN:31633` 只登记排序 vs when）。

### DB-07 `apply-all` 不写账本、硬编码 localhost DSN、包含非幂等 DML
- **严重度**：P2
- **位置**：`packages/database/scripts/apply-all-migrations.mjs:15-16,24-26,145-190`；非幂等样例 `drizzle/0007_levels_seed.sql:6`、`0030_chat_favorites_unique.sql:10`、`0036_oauth_third_party.sql:132`、`0213_phase5_backfill_orders_sync.sql:12`
- **触发路径**：按脚本注释在 dev/test 重复执行。
- **根因**：无“已应用”概念，只靠错误文本跳过；不写 `drizzle.__drizzle_migrations`；目标写死 `postgresql://postgres:postgres@localhost:5432/ihui` 与 `/ihui_test`；按文件名排序而非 `journal.when`。
- **证据**：全文件 grep 无账本查询/写入；seed/backfill 的 INSERT 与去重 DELETE 无幂等保护。
- **影响面**：重复插入/误删；库态与账本分叉，直接构成 DB-13“空账本判 ok”；与 drizzle 的应用顺序不同。
- **建议**：下线该脚本，统一 `drizzle-kit migrate`；目标改为显式 env 且拒绝非 localhost。
- **当场可修**：是。
- **去重**：部分同 `PROJECT_PLAN:31633`（排序双轨）；“不记账/全量重放/非幂等 DML”**计新增**。

### DB-08 全新库路径未接 fresh-db 守卫，首启会断在 idx 325
- **严重度**：P2
- **位置**：`packages/database/scripts/pre-migrate-fresh-db-guard.mjs:22-24`；`deploy/docker/Dockerfile.migrate:52`；`docker-compose.yml:380-401`；`packages/database/package.json:22`
- **触发路径**：`docker compose up` 首启（空 pgdata volume）→ `migrate` 服务执行 `pnpm run db:migrate`。
- **根因**：守卫只在 CI 的两遍重放流程中被调用；镜像 CMD 与 `db:migrate` 均未前置。
- **证据**：守卫头注自述“从零库第一遍在 idx 325 失败回滚属预期”；`git grep "pre-migrate-fresh-db-guard" deploy docker-compose.yml` 无命中。
- **影响面**：任何全新自托管/新租户空库无法初始化；存量生产库不受影响。
- **建议**：entrypoint 幂等：先守卫再 `drizzle-kit migrate`；或提供 `db:migrate:fresh` 并统一使用。
- **当场可修**：是。
- **去重**：未登记。

### DB-09 371 条 journal 仅 67 个快照，最新 0371 无快照，`db:generate` 会重放 0371
- **严重度**：P2
- **位置**：`packages/database/drizzle/meta/_journal.json`（idx 371）；`packages/database/drizzle/meta/`（最高 `0370_snapshot.json`）；`packages/database/drizzle/20261107150000_shared_to_ops_flag.sql:12,15`；`packages/database/src/schema/ai-relay.ts:147`；`scripts/check-hand-migration-snapshot.mjs:56-57`；`.github/workflows/ci.yml:198`
- **触发路径**：开发者执行 `db:generate`，drizzle-kit 以最新快照 0370 作 diff 基线。
- **根因**：0371 只有 SQL；0370 快照不含 `shared_to_ops` 列/索引，而 TS schema 已声明；快照门是 warn-only 且未入 CI。
- **证据**：实测 `journalEntries=371 snapshots=67 missingSnapshotFor371=true highestSnapshot=0370`；`0370_snapshot.json` 中无 `shared_to_ops`。
- **影响面**：下一次 generate 会把 0371 的 ADD COLUMN/索引再次生成为新迁移，已应用库执行时报重复列/索引。
- **建议**：补齐 0371 快照并重基线；把 `check-hand-migration-snapshot` 非 warn-only 接入 `drizzle/**` CI。
- **当场可修**：是。
- **去重**：未登记。

### DB-10 `migration-tests.yml` 监听不存在的目录，且用 `push --force` 代替迁移链
- **严重度**：P2
- **位置**：`.github/workflows/migration-tests.yml:14,19,31,59`
- **触发路径**：修改迁移或迁移脚本时。
- **根因**：`paths` 指向 `packages/database/migrations/**`（该目录文件数 0）；步骤为 `drizzle-kit push --force`，不是 `migrate`；基础镜像 `postgres:18` 不含 pgvector。
- **证据**：`git ls-tree` 统计该目录 0 文件；真正的迁移链测试在 `db-from-zero-migrate.yml`（监听 `drizzle/**`）。
- **影响面**：该 workflow 永不触发（或触发也绕过迁移链），提供“已有迁移测试”的假保证。
- **建议**：路径改为 `packages/database/drizzle/**` 与 `scripts/**`；步骤改为空库 migrate + 守卫 + 第二遍；镜像换 `pgvector/pgvector:pg18`；或删除避免误导。
- **当场可修**：是。
- **去重**：未登记。

### DB-11 大表普通 `CREATE INDEX` 包在迁移事务内，叠加 180s 部署预算
- **严重度**：P2（条件性：目标库尚未建过该索引）
- **位置**：`packages/database/drizzle/20261106150000_fix_missing_indexes_fks.sql:23`；`deploy/win/ihui-deploy.ps1:2801-2808`；`packages/database/scripts/manual-sql/20261003103000_chat_messages_created_at_idx_CONCURRENTLY.sql:9,47,55`
- **触发路径**：目标库未应用 idx 369 时执行 `db:migrate`。
- **根因**：drizzle 把整份迁移包进事务，因此迁移里只能写普通 `CREATE INDEX`；`chat_messages(created_at)` 为高写入表，建索引期间阻塞写入；部署硬预算 180 秒，超时 `taskkill /T`。
- **证据**：SQL 第 23 行 `CREATE INDEX IF NOT EXISTS`；`Get-MigrateBudgetSec` 默认 `return 180`；manual-sql 头注明写“必须 psql 手工跑”。
- **影响面**：索引确实缺失时，部署当轮聊天写入被锁数分钟；超时回滚后每 30 分钟重试，形成周期性锁表。
- **建议**：大表索引一律走 manual-sql `CONCURRENTLY` 并在 migrate 前完成；迁移里只留 `IF NOT EXISTS` 兜底。
- **当场可修**：部分（脚本/流程可改；是否已建索引需查库）。
- **去重**：未登记。

### DB-12 `--repair` 是高危写入通道：无 dry-run、无 schema 备份、应用与记账分事务
- **严重度**：P2
- **位置**：`scripts/check-db-migration-gaps.mjs:191-194,223,260,263-276,281-305`；告警正文 `scripts/git-guardian.mjs:9498`
- **触发路径**：守护告警直接给出 `node scripts/check-db-migration-gaps.mjs --repair --yes`，运维照做即对库执行 DDL。
- **根因**：`--journal` 可指向任意 JSON；`tag` 未做 basename 白名单；修复前只写账本 TSV，不备份 schema；每条文件 `psql -1 -f` 与随后 `psql -1 -c insert` 是两次独立事务。
- **证据**：全文件 grep `dry-run` 零命中；快照内容仅账本行；失败文案为“需人工补账本”。
- **影响面**：不可逆 DDL；崩溃窗口留下“表已建、账本无行”，重跑重复应用；与 `db:migrate` 并发无互斥。
- **建议**：默认 dry-run；`tag` 与 `realpath` 强校验；修复前 `pg_dump --schema-only`；SQL+记账同事务；接入 `pg_advisory_lock`。
- **当场可修**：是。
- **去重**：未登记。

### DB-36 manual-sql 的 CONCURRENTLY 脚本头注路径错误
- **严重度**：P3
- **位置**：`packages/database/scripts/manual-sql/20261003103000_chat_messages_created_at_idx_CONCURRENTLY.sql:55`
- **触发路径**：运维按头注执行 `psql ... -f packages/database/drizzle/20261003103000_...sql`。
- **根因**：文件实际在 `scripts/manual-sql/`，头注仍写 `drizzle/`；`apply-all` 只扫描 `drizzle/`。
- **证据**：`git ls-tree` 显示 4 个 manual-sql 文件均在新目录；第 55 行路径为旧目录。
- **影响面**：psql 报 “No such file”，并发索引未建立，随后落到 DB-11 的普通建索引路径。
- **建议**：修正头注路径；把 manual-sql 纳入发布检查清单。
- **当场可修**：是。
- **去重**：未登记。

---

## B. 台账与对账

### DB-13 空账本 / 空 journal 被判 `ok`
- **严重度**：P2
- **位置**：`scripts/check-db-migration-gaps.mjs:62-73,80-81,258`（自检 S6）
- **触发路径**：用 `apply-all-migrations` 建好的库（表在、账本空）；或 `--journal` 指向 `entries` 缺失/为空的 JSON。
- **根因**：`maxApplied` 非法时回退 0，所有条目落入 pending/lateGap 分类；退出码只由 `lateGap` 决定；journal 形状不校验。
- **证据**：`if (!Number.isFinite(maxApplied)) maxApplied = 0`；`journal?.entries` 非数组默认 `[]`；S6 明确“空 journal ⇒ 四桶全空(不静默造红)”。
- **影响面**：结构已建但账本丢失的库被判 `state=ok`，守护打 ✅；随后 `db:migrate` 从头重放 371 条。
- **建议**：账本 0 行 ⇒ 未判定(exit 2)；输出增加 `rows/emptyLedger` 桶。
- **当场可修**：是。
- **去重**：未登记。

### DB-14 账本以 `when` 作唯一身份：同 when 不同 tag 被判已应用；`hashDrift` 不阻塞
- **严重度**：P2
- **位置**：`scripts/check-db-migration-gaps.mjs:76-81,244-258`；`scripts/check-migrations-landed.mjs:124`；`scripts/check-migration-bookkeeping.mjs:209,2260,2295,2528`；`.github/workflows/ci.yml:198`
- **触发路径**：并发合并/重编号把某条 `when` 改成账本已存在的值；或已应用 `.sql` 被后续改动。
- **根因**：账本无 tag 列，消费方以 `created_at` 当 tag 身份；`whens.has(when)` 命中即短路，不校验 hash 归属；`hashDrift` 不进退出码，`--strict` 全仓无调用。
- **证据**：三处短路代码；`docs/migration-journal-renumber-adjudication-2026-11-06.md:23` 明写高水位口径；CI 离线档不读库。
- **影响面**：新 tag 从未执行可被记 `hashDrift` 永不红；已应用内容漂移在自动化链上永久静默。
- **建议**：账本增 `tag` 列，判据要求 `when+tag+hash` 归属一致；`hashDrift` 纳入告警/退出码；部署前置跑 `--db --strict`。
- **当场可修**：部分（判据可先改为“归属不明 ⇒ 未判定”；加列需迁移）。
- **去重**：设计层面部分同 `PROJECT_PLAN:31633` 与 `ci.yml:195` 自述；“短路判据 + 问责档无入口”**计新增**。

### DB-15 账本表无业务唯一键，`ON CONFLICT DO NOTHING` 恒为空操作
- **严重度**：P2
- **位置**：`docs/migration-journal-renumber-adjudication-2026-11-06.md:20`（DDL 仅 `id SERIAL, hash text NOT NULL, created_at bigint`，无 UNIQUE）；`packages/database/scripts/apply-migration.mjs:109-111`；`scripts/check-db-migration-gaps.mjs:227,290-299`
- **触发路径**：重复运行手工执行器；repair 在“应用成功、记账失败”后重跑；deploy 与 repair 并发。
- **根因**：幂等键应为 `created_at(when)` 或 `hash`，但表上无 UNIQUE；插入从不显式给 id，`ON CONFLICT` 永不触发；`Date.now()` 每次不同。
- **证据**：仓内无 `CREATE TABLE ... __drizzle_migrations`；gaps 输出只有四桶与 maxApplied，无 `rows/dupWhens/dupHash`。
- **影响面**：重复行/孤儿行无自动入口；`byCreatedAt` 对重复 when 取末行，结论随行序抖动。
- **建议**：清洗后加 `UNIQUE(created_at)`/`UNIQUE(hash)`；显式 `ON CONFLICT (created_at) DO NOTHING`；gaps 增加行数桶。
- **当场可修**：是（需一次账本清洗迁移）。
- **去重**：未登记。

---

## C. schema 与约束一致性

> 本面首轮子代理给出的“422 列时区丢失、邮箱唯一索引缺失、多处 FK 缺失、软删唯一冲突”经逐项复核**均不成立**，已剔除：实测 0 个 SQL 文件使用 `timestamp without time zone`（226 个用 tz）；`user_emails_email_key` / `play_testers_email_idx` 唯一索引实际存在（仅命名不同）；`api_key_shares` / `ai_model_mappings` 实际有 FK；两个教育唯一约束实际已带 `WHERE deleted_at IS NULL`。

### DB-16 `relay_conversations` 多条 NOT NULL 在迁移链中丢失（首定义胜出）
- **严重度**：P2
- **位置**：`packages/database/src/schema/relay-conversations.ts:46-49`；`packages/database/drizzle/20260801010070_add_relay_conversations_table.sql:19`；`packages/database/drizzle/20260801020000_add_missing_20_tables.sql:270`
- **触发路径**：任何绕过 ORM 的写入（报表回填、运维脚本、其他服务直连）写入 NULL。
- **根因**：010070 先建表且 `total_cost_cents INTEGER DEFAULT 0`（可空）；020000 再次 `CREATE TABLE IF NOT EXISTS` 意图 `INTEGER NOT NULL DEFAULT 0`，但因表已存在整段 no-op。TS 侧 `messageCount/totalTokens/totalCostCents` 均 `.notNull()`。
- **证据**：两处 DDL 行号如左；`CREATE TABLE IF NOT EXISTS` 首定义胜出。
- **影响面**：TS 读取端做非空断言/数值运算时可能抛错；计费汇总失真。
- **建议**：新迁移 `ALTER COLUMN ... SET NOT NULL` + 老数据 `DEFAULT 0` 回填；或按产品语义放宽 TS。
- **当场可修**：否（需先回填）。
- **去重**：未登记。

### DB-17 `ab_tests` 宽度/默认值/非空四处漂移
- **严重度**：P2
- **位置**：`packages/database/src/schema/ab-tests.ts:28,30,31,32`；`packages/database/drizzle/0043_neat_the_spike.sql:3099,3101-3103,3107`
- **触发路径**：名称/状态超长插入报 `22001`；AB 实验默认流量与 TS 预期不一致。
- **根因**：TS `name varchar(255)` / SQL `varchar(200)`；TS `status varchar(64)` / SQL `varchar(32)`；TS `traffic_percent default 0` / SQL `DEFAULT 100`；TS `target_metric` 可空 128 / SQL `NOT NULL varchar(100)`；`config` TS 可空 / SQL `NOT NULL`。
- **证据**：左右行号逐项对应。
- **影响面**：AB 实验创建/更新校验通过但 DB 拒绝或截断；流量分配默认值两套。
- **建议**：`ALTER COLUMN ... TYPE/ SET DEFAULT / DROP NOT NULL` 对齐；加宽无风险，收窄先查数据。
- **当场可修**：是。
- **去重**：未登记。

### DB-18 225 张表存在重复 `CREATE TABLE IF NOT EXISTS`，后定义意图被静默丢弃
- **严重度**：P2
- **位置**：全量 371 个迁移；典型 `packages/database/drizzle/0043_neat_the_spike.sql` 与早期迁移；示例 `audit_logs` ×4、`gen_table` ×3、`simple_bot_configs` ×3、`video_generation_tasks` ×3、`gen_table_column` ×3、`tbox_bean` ×3
- **触发路径**：任何被重复定义且两版定义不一致的表。
- **根因**：`CREATE TABLE IF NOT EXISTS` 对已存在表整段 no-op；后续版本新增的列约束/默认值/NOT NULL 不会生效，且不会报错。
- **证据**：实测 `uniqueTables=762, dupTables=225`；DB-16 是已证实的实际漂移实例。
- **影响面**：迁移链最终结构与“后写迁移”的意图不一致；from-zero 与增量链可能产出不同库态。
- **建议**：CI 增加“同表多定义 + 定义差异”门禁；对确认的差异补 `ALTER` 迁移；禁止新增重复建表。
- **当场可修**：部分（需逐表 diff 与回填）。
- **去重**：未登记。

### DB-19 `api_key_group_members` 先 UNIQUE 后普通 INDEX 同名，后者被 `IF NOT EXISTS` 静默忽略
- **严重度**：P2
- **位置**：`packages/database/drizzle/20260801010009_api_key_groups.sql:36`；`packages/database/drizzle/20260801020000_add_missing_20_tables.sql:112`；`packages/database/src/schema/api-key-groups.ts:79`
- **触发路径**：同一 API Key 绑定第二个分组 → `23505 duplicate key`。
- **根因**：01009 建 `CREATE UNIQUE INDEX api_key_group_members_api_key_unique`；020000 建 `CREATE INDEX IF NOT EXISTS "api_key_group_members_api_key_unique"`（同名），因已存在而 no-op；TS schema 声明的是普通 `index()`，与 DB 的唯一语义相反。
- **证据**：两处 DDL 行号如左；snapshot 中该索引持续存在。
- **影响面**：API Key 分组功能被唯一约束锁死；schema 生成器认为它是普通索引，未来 `db:generate` 可能产生错误 diff。
- **建议**：按产品语义二选一——TS 改 `uniqueIndex()`；或新迁移 `DROP INDEX` 后重建普通索引。
- **当场可修**：是（依赖产品决策）。
- **去重**：未登记。

### DB-37 两处未命名 UNIQUE 约束，索引名与 TS 约定不符
- **严重度**：P3
- **位置**：`packages/database/drizzle/20260801010050_add_channel_quota_fields.sql:48`（`UNIQUE(key_pool_id, usage_date)`）；`packages/database/drizzle/20260801010060_add_api_key_tpm_tags.sql:23`（`UNIQUE(api_key_id, usage_minute)`）
- **触发路径**：后续迁移按约定名 `DROP INDEX/CONSTRAINT` 失败；from-zero 校验报索引缺失。
- **根因**：内联 `UNIQUE(...)` 由 PG 自动命名，与 Drizzle 约定名不一致。
- **证据**：两处 DDL 行号如左；TS 期望名为 `ai_relay_channel_daily_usage_key_pool_id_usage_date_unique`、`api_key_minute_usage_api_key_id_usage_minute_unique`。
- **影响面**：迁移可演进性与 CI 校验。
- **建议**：`ADD CONSTRAINT <约定名> UNIQUE (...)` 并删除自动名约束。
- **当场可修**：是。
- **去重**：未登记。

---

## D. 查询面与事务

### DB-02 自动续费回调在外层 `FOR UPDATE` 事务内调用「独立事务」创建/完成订单
- **严重度**：P1
- **位置**：`apps/api/src/routes/payment-recurring.ts:650-703`（`:653` `FOR UPDATE`、`:680` placeOrder、`:691` completeOrder、`:699` 更新契约）；`apps/api/src/services/order-service.ts:65,111`；`apps/api/src/db/payment-queries.ts:52`
- **触发路径**：微信 `recurring.charge.success` → 校验/解密 → 外层事务锁契约 → `placeOrder()` 内 `createOrderRow` 再开一个 `db.transaction` → `completeOrder()` 发放权益 → 最后才更新契约状态。
- **根因**：订单创建与发币落在独立事务中并先提交；外层若在 `:699` 前失败回滚，幂等标记（`lastChargeStatus/outTradeNo`）消失，而订单已 paid、权益已发放。
- **证据**：`createOrderRow` 在 `payment-queries.ts:52` 使用独立 `db.transaction`；`consumeNotifyNonce` 在事务外已消费 nonce（`:470`），同一 nonce 重试直接 `replayed`，契约不会被修好。
- **影响面**：连续包月用户重复入账/权益超发；或已收款但契约卡死，下一期重复扣款。
- **建议**：让下单/完成订单接受外层 `tx`；用 `outTradeNo` 唯一约束作真正幂等键；契约状态机与订单落库拆成可重入两阶段。
- **当场可修**：可（签名改造 + 幂等键）。
- **去重**：未登记。

### DB-03 余额读-改-写无行锁/非原子自增：USDT 充值与 API 订阅并发丢账
- **严重度**：P1
- **位置**：`apps/api/src/services/payment-usdt-service.ts:988-1003`；`apps/api/src/services/api-subscription-service.ts:401-419`；`packages/database/src/schema/wallet.ts:21`
- **触发路径**：两笔不同订单并发到账同一用户。
- **根因**：先 `SELECT user_margins` 取快照，再 `UPDATE SET token_quantity = <应用层计算值>`；无 `FOR UPDATE`、无 `SET x = x + $1 ... RETURNING`。`token_flows(related_order_no, op_type)` 唯一索引只能防同一订单重放，防不住不同订单并发。
- **证据**：`user_margins` 以 `user_id` 为 PK；两处均为“读快照→写回”。API 订阅的 `activeKey` 还在事务外读取。
- **影响面**：两笔充值只到账一笔；流水 `balance_after` 与真实余额不一致，财务对账失真。
- **建议**：改为原子自增并 `RETURNING`；无行时 `INSERT ... ON CONFLICT (user_id) DO UPDATE`；或事务内 `FOR UPDATE`。
- **当场可修**：可。
- **去重**：未登记。

### DB-20 家长账单接口 N+1：每条报名 5 次查询且列表无上限
- **严重度**：P2
- **位置**：`apps/api/src/routes/edu-ai-management.ts:3227-3229`；`apps/api/src/services/edu-ledger.ts:357-430`
- **触发路径**：`GET /parent/children/:childId/bills` → 查该生全部有效报名（无 `limit`）→ 对每条 `loadEnrollmentLedger`。
- **根因**：`loadEnrollmentLedger` 单次执行报名行(:358)、兄弟计数(:377)、支付(:416)、退费(:430)、账期(:445) 共 5 条 SQL；N 条报名 = 5N 次往返。
- **证据**：`:3227` `Promise.all(enrollments.map(...))`；`:357` 函数内五次 `await db`。
- **影响面**：家长账单页延迟与连接占用随报名数线性放大。
- **建议**：一次 `IN (enrollmentIds)` 取支付/退费/账期，一次 `GROUP BY student_id,class_id` 取兄弟计数；路由加上限。
- **当场可修**：可。
- **去重**：未登记。

### DB-21 `chat_messages` 缺 `(conversation_id, created_at, id)` 复合索引
- **严重度**：P2
- **位置**：`packages/database/src/schema/chat.ts:133-143`；`apps/api/src/db/chat-queries.ts:567-581,671-700`
- **触发路径**：`GET /chat/conversations/:id/messages`（page 或 keyset 模式）→ `WHERE conversation_id ORDER BY created_at,id`。
- **根因**：现有索引只有 `(conversation_id)`、`(conversation_id,turn_ordinal)`、`(conversation_id,pinned_at)`、`(created_at)`，无法消除 `created_at,id` 排序；offset 分支每次额外 `COUNT(*)` 全会话。
- **证据**：schema 第 133/135/140/143 行；迁移链中无该组合索引。
- **影响面**：长会话每次翻页 O(n) 扫描+排序，count 再 O(n)。
- **建议**：`CREATE INDEX CONCURRENTLY (conversation_id, created_at, id)`；前端改纯 keyset。
- **当场可修**：可。
- **去重**：未登记（`PROJECT_PLAN:31685` 是另一批声明索引无 DDL）。

### DB-22 `analytics_events` 仅 `user_id` 索引，管理分析全表扫描/排序
- **严重度**：P2
- **位置**：`packages/database/src/schema/analytics-events.ts:15-23`；`apps/api/src/routes/analytics.ts:278-323,376-410,452-495`
- **触发路径**：`GET /analytics/summary`、`/hot-pages`、`/events/list`（`requireAdmin`）按 `created_at` 区间/`event` 过滤并 `ORDER BY created_at DESC LIMIT/OFFSET`。
- **根因**：持续追加的埋点大表只有 `user_id` 单列索引；日期范围、event、排序均无可用索引；`events/list` 的 page 无上界。
- **证据**：schema 仅 `analytics_events_user_idx`；列表用 `.select()` 返回整行（含 ip/userAgent）。
- **影响面**：后台每次打开分析页全表 scan+排序；深 offset 可扫全表。
- **建议**：补 `(created_at)`、`(event, created_at)` 索引；分页改 keyset；聚合落预聚合表。
- **当场可修**：可。
- **去重**：未登记。

### DB-23 订单列表按随机 UUID 主键排序，时间序错乱且索引不可用
- **严重度**：P2
- **位置**：`apps/api/src/db/order-queries.ts:192-204`（`:196` `orderBy(desc(eduOrders.id))`）；`packages/database/src/schema/order.ts:25,52-54`
- **触发路径**：`GET /orders/me`、`GET /admin/orders` → `findOrders`。
- **根因**：`eduOrders.id` 是 UUID v4 随机值，`ORDER BY id DESC` 既非创建时间序，也无法利用 `user_id` 索引后的有序性；表已有 `created_at` 未使用。
- **证据**：`:192` `.select()` 整行、`:196` 排序、`:200` 额外 `count(*)`；无 `(user_id, created_at)`/`(created_at)` 索引。
- **影响面**：用户看到“最近订单”随机排列；并发下单时 offset 分页重复/漏行。
- **建议**：改 `ORDER BY created_at DESC, id DESC`；补 `(user_id, created_at)`、`(created_at)` 索引。
- **当场可修**：可。
- **去重**：未登记。

### DB-24 课程详情/章节接口 N+1（每章一条小节查询）
- **严重度**：P2
- **位置**：`apps/api/src/routes/edu-frontend-routes.ts:244-251,260-267`；`apps/api/src/db/learn-queries.ts:432-438`；同类 `apps/api/src/routes/course-mobile-routes.ts:35`、`apps/api/src/routes/learn.ts:691`、`apps/api/src/routes/exam.ts:1376`
- **触发路径**：`GET /edu/courses/:id`、`/edu/courses/:id/sections`、公开课程详情 → `chapters.map(async c => findLessonSections(c.id))`。
- **根因**：每个 chapter 一条独立 SQL，既非批量 `IN` 也非 join；`/sections` 还以 `sections.length` 做应用层计数。
- **证据**：`:245`、`:261` 两处 `Promise.all(chapters.map(...))`；`findLessonSections` 为单 chapter 查询。
- **影响面**：50 章的课程一次详情页发 50 条查询；公开端点可被匿名反复打。
- **建议**：`WHERE chapter_id IN (...)` 一次取回后按 chapter 分桶；或 join。
- **当场可修**：可。
- **去重**：未登记。

### DB-25 `/statistics/overview` 任意登录用户可触发 8 条全表 `count(*)`
- **严重度**：P2
- **位置**：`apps/api/src/routes/statistics.ts:84-87,167-180`；`apps/api/src/db/statistics-queries.ts:141-163`
- **触发路径**：任意登录态 `GET /api/statistics/overview`。
- **根因**：插件级 `preHandler` 仅 `checkAuth`，角色不限；`getOverviewStatistics` 对 `users/lessons/exam_papers/lesson_sign_ups/exam_records/circle_posts/announcements/help_articles` 各做 `count(*)::int`，仅 `circle_posts` 带 status 过滤；无缓存、无预聚合。
- **证据**：`:85-86` 只校验登录；`:151-163` 八个全表 count。
- **影响面**：普通用户可反复触发全表计数；`exam_records`、`lesson_sign_ups` 膨胀后 DB CPU/IO 放大。
- **建议**：读 `statistics_snapshots` 或加 60s 缓存；计数改估算或定时物化。
- **当场可修**：可。
- **去重**：未登记。

### DB-43 LiteLLM 价格同步：单事务内逐模型 SELECT + UPDATE/INSERT
- **严重度**：P3
- **位置**：`apps/api/src/services/litellm-price-sync.ts:184-214`
- **触发路径**：定时/手动 `syncLiteLLMPricing`，数百模型。
- **根因**：`db.transaction` 内 `for` 循环逐条 `tx.select` 再 `tx.update`/`tx.insert`，无预取 map、无批量 upsert。
- **证据**：`:185-212` 循环体两次往返。
- **影响面**：长事务占连接并持 `ai_pricing` 行锁，与计费读写争锁。
- **建议**：事务外一次 `SELECT ... WHERE model_id IN (...)`；事务内 `INSERT ... ON CONFLICT DO UPDATE` 批量。
- **当场可修**：是。
- **去重**：未登记。

### DB-44 Agent 历史消息整段 JSONB 拉回应用层再分页
- **严重度**：P3
- **位置**：`apps/api/src/routes/mobile-chat-routes.ts:321-340`；`apps/api/src/db/agent-chat-queries.ts:69-78,190`；`packages/database/src/schema/agent-runtime.ts:32`
- **触发路径**：`GET /agents/:id/messages` → `readLatestSession` 取回整行（含 `messages jsonb`）→ 内存切片。
- **根因**：消息存于单个 JSONB 数组，DB 层没有按页取；v1 分支全量返回，无 limit。
- **证据**：`dbRead.select().from(agentRuntimeSessions)` 无 columns；`pageAgentMessages` 是纯 JS 切片。
- **影响面**：长会话每次翻页传输整段 JSONB；v1 响应可无限大。
- **建议**：消息独立表按 `(session_id, ordinal)` 分页；短期用 SQL 侧 `jsonb_array_length` + `->` 切片并给 v1 加上限。
- **当场可修**：部分（短期加 limit）。
- **去重**：未登记。

### DB-45 `/relay/channels` 列表 N+1：每个 key_pool 2 条用量查询
- **严重度**：P3
- **位置**：`apps/api/src/routes/admin/channel-quota.ts:44-75`；`apps/api/src/services/channel-quota-service.ts:536,571`
- **触发路径**：`GET /relay/channels`（`requireAdmin`）→ 全量 `ai_relay_key_pool`（无 limit）→ 每行并行查当日/当月用量。
- **根因**：用量本可按 `key_pool_id` 一次 `GROUP BY` 聚合，现为 2N 条独立查询。
- **证据**：`:64/:70` 每行 `getDailyUsage/getMonthlyUsage`。
- **影响面**：100 个渠道池 = 200 条查询。
- **建议**：一条 `GROUP BY key_pool_id, usage_date` 聚合后内存拼装。
- **当场可修**：可。
- **去重**：未登记。

### DB-46 旧表通用查询 `SELECT *` + 无界深 offset
- **严重度**：P3
- **位置**：`apps/api/src/routes/agent-extended.ts:68-83,112-115`；调用点 `:456,1505`
- **触发路径**：`GET /developer`、`/agent-uploads` 等 → `rawList`/`rawById`。
- **根因**：未迁入 Drizzle schema 的旧表直接 `SELECT *`；`page` 只有下界，`(page-1)*pageSize` 可无限大；默认按 `"id" DESC`。
- **证据**：`sql\`SELECT * FROM ${sql.raw(...)} ... LIMIT ... OFFSET ...\``，无列投影。
- **影响面**：表加列即自动出参（含内部列）；深 offset 全表扫；类型层无法发现字段漂移。
- **建议**：每张旧表显式列白名单；page 设上界并改 keyset。
- **当场可修**：可（先加列白名单）。
- **去重**：未登记。

---

## E. 连接池与读写分离

### DB-26 `dbRead` 无读己之写（RYW）屏障，组件是死代码
- **严重度**：P2
- **位置**：`apps/api/src/utils/ryw-consistency.ts:19-71`；`apps/api/src/db/index.ts:64-71`；`packages/database/src/read-replica.ts:187-200`
- **触发路径**：任意“写主库 → 立即读副本”的请求（创建后跳详情、列表刷新）。
- **根因**：`RywConsistency` 仅被自身测试导入；`dbRead` 是无条件副本代理，不记录本请求刚写过，也不设写后读屏障。
- **证据**：`git grep ryw-consistency` 仅命中定义文件与 `apps/api/tests/ryw-consistency.test.ts`。
- **影响面**：副本延迟 1s 内即出现“刚创建查不到 / 列表少一条 / 状态未变”。
- **建议**：接入 RYW（写标记 requestId+时间窗），或对“创建后读回”的 handler 显式走主库。
- **当场可修**：是。
- **去重**：未登记。

### DB-27 副本延迟用 `SELECT 1` 往返耗时冒充，`MAX_LAG_SEC` 失效
- **严重度**：P2
- **位置**：`apps/api/src/db/index.ts:269-283`；`packages/database/src/read-replica.ts:66,213-227`
- **触发路径**：副本真实复制延迟 30s，网络 RTT 正常 2ms。
- **根因**：`lagSec = (Date.now()-start)/1000` 测的是网络往返，不是 WAL 回放位点差；全仓无 `pg_last_wal_replay_lsn`/`pg_stat_replication` 查询。
- **证据**：`:274` 是唯一 lag 赋值来源；阈值判断依赖该值。
- **影响面**：延迟阈值成摆设，`dbRead` 长期吃陈旧数据。
- **建议**：改查 `pg_last_xact_replay_timestamp()` 或 LSN 差；探测失败保持上次读数。
- **当场可修**：是。
- **去重**：未登记（`PROJECT_PLAN:31694` 是“lagSec 被 ok 抹 0”的另一根因）。

### DB-28 副本初始 `healthy=true` + 连续 3 次/15s 才摘除，故障窗口约 45s
- **严重度**：P2
- **位置**：`packages/database/src/read-replica.ts:64,167-174,219-224`；`apps/api/src/db/index.ts:265,283-287`
- **触发路径**：进程启动/副本 TCP 不可达。
- **根因**：健康初值 true；首轮探测 `void probe()` 不阻塞建连；`FAIL_THRESHOLD=3`、15s 间隔，达阈值才摘除。
- **证据**：`:170 healthy:true`；`:283` 非 await 探测。
- **影响面**：发布/切副本/网络抖动的 30–45s 内，读接口成片 5xx。
- **建议**：初值 `healthy=false`，首轮探测成功后再置真；探测加超时。
- **当场可修**：是。
- **去重**：未登记。

### DB-29 四个池均无 `statement_timeout`/`connect_timeout`/`max_lifetime`
- **严重度**：P2
- **位置**：`packages/database/src/client.ts:12`；`packages/database/src/read-replica.ts:138-142`；`apps/api/src/db/index.ts:112-121`；`packages/database/src/tenant-router.ts:33`；`apps/api/src/plugins/slow-sql-killer.ts:26-43`
- **触发路径**：报表/导出/大表聚合/向量检索慢查询 → 单条占 1 连接且永不超时。
- **根因**：连接层无超时护栏；`docs/PERFORMANCE.md:144-147` 自己推荐 `connection_timeout 5s / max_lifetime 30min`，代码未落地；`slow-sql-killer` 只记录日志不 kill。
- **证据**：全仓 grep `statement_timeout|connect_timeout|max_lifetime` 仅命中文档；slow-sql-killer 无 `pg_terminate_backend`。
- **影响面**：40 条慢查询即可锁死主池，其余请求全排队；多实例触发 DB `max_connections` 拒绝。
- **建议**：四池统一加 `connect_timeout/idle_timeout/max_lifetime/statement_timeout`；slow-sql-killer 补 kill 或明确降级为告警。
- **当场可修**：是。
- **去重**：未登记。

### DB-30 关闭钩子只关 scoped 池，主池/副本池无 `.end()`
- **严重度**：P2
- **位置**：`apps/api/src/db/index.ts:295-301`；`packages/database/src/read-replica.ts:234-253`；`packages/database/src/client.ts:9-14`；`apps/api/src/index.ts:441-457`
- **触发路径**：SIGTERM → shutdown → `server.close()` → `process.exit` 硬退；或测试/嵌入场景只关 server。
- **根因**：池句柄未随 factory 返回；shutdown 生命周期漏掉 `writerClient`/`replicaClients`；源码内唯一池 `.end()` 是 scoped。
- **证据**：`read-replica.ts:234-253` 返回对象无 close；`client.ts` 无 end 导出。
- **影响面**：优雅停机拿不到“在途事务完成”窗口；热重载/测试连接堆积至 DB 上限。
- **建议**：`createReadWriteDb` 返回 `close()`；onClose `await` 关主池+副本池。
- **当场可修**：是。
- **去重**：未登记。

### DB-31 池上限代码 40 与文档 10 严重漂移，且不可配置
- **严重度**：P2
- **位置**：`packages/database/src/client.ts:10-12`；`packages/database/src/read-replica.ts:135-139`；`docs/PERFORMANCE.md:144`
- **触发路径**：双实例/蓝绿部署。
- **根因**：`max` 从 10 提到 40 未同步文档与容量规划；`createReadWriteDb` 唯一调用点未传 `max`。
- **证据**：代码 `max: 40`；文档写“max 10，2 实例=20 匹配 DB max_connections”。
- **影响面**：`writer 40 + replica 40 + scoped 8` × 实例数，扩容/回滚时静默超 DB 上限。
- **建议**：`max` 读 `DB_POOL_MAX` 并把“max × 实例数”纳入容量校验；同步文档。
- **当场可修**：否（需确认生产 `max_connections` 与实例数）。
- **去重**：未登记。

### DB-41 租户池最坏 32×10=320 连接，退出无批量关闭
- **严重度**：P3（需配置 `TENANT_*_DATABASE_URL` 才激活）
- **位置**：`packages/database/src/tenant-router.ts:13-16,33,44-46`；`apps/api/src/index.ts:396-457`
- **触发路径**：多租户启用后 32 个活跃租户。
- **根因**：容量按“每租 10”独立规划，未与全局 `max_connections`/主池合并核算；无 `closeAllTenantPools`。
- **证据**：LRU 32 / 每租 `max=10`；shutdown 相清单无租户池关闭项。
- **影响面**：单进程 400 连接；重启瞬间旧连接靠 TCP 超时回收。
- **建议**：`TENANT_POOL_MAX` 纳入全局预算；导出 `closeAllTenantPools()` 挂 shutdown。
- **当场可修**：是。
- **去重**：未登记（`PROJECT_PLAN:31468` DBG-3 是另一根因）。

### DB-42 `dbReader`/`readerClient` 固定第一个副本，旁路故障转移
- **严重度**：P3（当前生产经 `dbRead` 代理规避，属潜伏）
- **位置**：`packages/database/src/read-replica.ts:176-181,237-242`
- **触发路径**：任何直接解构 `dbReader`/`readerClient` 的消费者。
- **根因**：为兼容保留“默认 reader=第一个副本”的静态绑定，与 `getReader()` 并列导出且未禁用。
- **证据**：`:178-181` `firstReplicaId` 固定；注释仅写“如需故障转移请用 getReader()”。
- **影响面**：包外消费者静默失去故障转移；未来重构换回即复刻读雪崩。
- **建议**：改为 getter/Proxy，或标记 `@deprecated` 并移除导出。
- **当场可修**：是。
- **去重**：未登记。

---

## F. 数据安全

### DB-32 `verify-schema.mjs` 明文数据库口令
- **严重度**：P2
- **位置**：`packages/database/verify-schema.mjs:7`
- **触发路径**：任何拿到仓库者直连 `postgresql://ihui:ihui_dev_...@127.0.0.1:5432/ihui`。
- **根因**：连接串写死凭据，未走 `process.env.DATABASE_URL`。
- **证据**：`git grep -F "ihui_dev_d6412937d5e397bc"` 唯一命中该行。
- **影响面**：凭据泄露；口令轮换后脚本仍用旧密。
- **建议**：改 env，缺失即退出；轮换并核查该串是否曾有效。
- **当场可修**：是。
- **去重**：未登记。

### DB-33 `test_verify_code_bypass` 迁移种子 `is_active=true`，与自身头注矛盾
- **严重度**：P2（条件性：生产 `SMS_TEST_BYPASS=true` 时可利用）
- **位置**：`packages/database/drizzle/20260801040000_admin_test_verify_code_bypass.sql:14,23-24,31-38`；`apps/api/src/utils/code-store.ts:225-265`
- **触发路径**：登录验码 → `isFixedCodeBypassArmed()` 查表 → 命中 `admin@ihui.local` / `13000000000` + 固定码 `123456`。
- **根因**：迁移头注写“生产库此表应保持 is_active=false”，实际 seed 与 `ON CONFLICT ... is_active=true` 相反。
- **证据**：`fixed_code DEFAULT '123456'`、`is_active DEFAULT true`；代码侧双门为 `isDevelopmentRuntime && SMS_TEST_BYPASS`。
- **影响面**：环境门一旦成立即管理员/占位账号可跳过真实短信。
- **建议**：种子改 `is_active=false`；生产启动断言无 active 行；后门要求独立 secret。
- **当场可修**：是（数据 UPDATE / 新迁移）。
- **去重**：未登记。

### DB-34 备份产物明文 `.sql.gz`/`.dump`，无静态加密，且可上传对象存储
- **严重度**：P2
- **位置**：`deploy/scripts/backup-db.sh:127-137,157-160`；`apps/api/scripts/pg-backup.mjs:8-21,42-43`
- **触发路径**：每日 `pg_dump --format=plain | gzip -9` 落盘，配置 `OSS_BUCKET` 后上传。
- **根因**：无 gpg/age 加密、无 SSE-KMS；备份角色按设计需 `BYPASSRLS` 才能导出全表。
- **证据**：脚本只有 gzip 与完整性校验，无加密步骤。
- **影响面**：备份盘/网盘/桶泄露 = 全库明文，含 DB-35 全部敏感列。
- **建议**：`pg_dump | gzip | age -r <pubkey>` 后再落盘/上传；桶私有 + SSE-KMS + 最小权限。
- **当场可修**：是。
- **去重**：未登记（`PROJECT_PLAN:2739` 只登记备份角色权限）。

### DB-35 多类敏感字段明文落库（PII 与第三方凭据）
- **严重度**：P2
- **位置**：
  - PII：`packages/database/src/schema/users.ts:49-50`（phone/email）、`learn-extended.ts:108-112`（bank/tax）、`order.ts:142-144`、`user-auth-info.ts:17-25`（id_card 注释承认“新写入密文、存量明文兼容”）
  - 凭据：`ai-user-model-chat.ts:26`（apiKey）、`education-platform.ts:14-15`（apiSecret）、`im-adapters.ts:41`、`oauth.ts:36`（clientSecret）、`relation-tables.ts:443`
- **触发路径**：注册/实名/开票/下单/保存集成配置直接 `INSERT` 原值；读取接口只用 `maskKey` 做展示脱敏。
- **根因**：只有 `ai_relay_*` 使用 `*_enc`，其余无统一加密约定；`id_card` 无存量回填。
- **证据**：列定义与注释如左；响应层 mask 不改变 DB 明文。
- **影响面**：一次 dump/只读账号泄露即可拿到身份证、银行卡、税号、手机号、上游计费 Key、IM/OAuth secret。
- **建议**：统一 `encryptField/decryptField`；存量分批回填；手机号补 `phone_hash` 检索列。
- **当场可修**：否（需迁移+回填）。
- **去重**：未登记。

### DB-38 `0067`/`0071` 幂等重放会把管理员口令重置回公开的 `admin123`
- **严重度**：P3
- **位置**：`packages/database/drizzle/0071_restore_admin_immutability.sql:72-102`；`packages/database/drizzle/0067_system_admin.sql:37`
- **触发路径**：迁移/运维手工重放 `0071` → 无条件 `UPDATE users SET password_hash = <admin123 哈希> WHERE username='admin'`；收口迁移 `20261022234000_invalidate_public_admin_password.sql` 已应用不会重跑。
- **根因**：种子迁移承担“修正密码”的数据变更；收口依赖一次性迁移。
- **证据**：`:76` 硬编码 bcrypt 哈希；`:94-96` 无条件更新；`:101` RAISE NOTICE。
- **影响面**：任何拿到公开镜像的人知道口令；重放即管理员接管。
- **建议**：删除数据重置段；种子改不可登录占位哈希；强制改密改为启动检查。
- **当场可修**：是（新迁移 + 运维规程）。
- **去重**：未登记。

### DB-39 `_bypass_rls` 策略对 PUBLIC 开放，GUC 任意会话可自行置真
- **严重度**：P3
- **位置**：`packages/database/drizzle/0214_cleanup_legacy_tenant_rls.sql:56-68`；`packages/database/drizzle/20260927100000_tenant_rls_policies_batch1.sql:205-209`；`packages/database/src/rls.ts:75-96`
- **触发路径**：任意持应用角色的连接执行 `SET app.bypass_rls='true'`。
- **根因**：策略无 `TO` 限定（默认 PUBLIC），自定义 GUC 无权限门槛；旁路只靠应用层 reason 白名单。
- **证据**：`CREATE POLICY ... FOR ALL USING (current_setting('app.bypass_rls', true) = 'true')`，无 `TO`。
- **影响面**：RLS 一旦启用，任何能执行 SQL 的角色/注入点可一键关闭这 6+8 张表隔离。
- **建议**：限定 `TO ihui_app`；改用角色 membership；禁止 PUBLIC。
- **当场可修**：是（新迁移 DROP/CREATE POLICY）。
- **去重**：未登记。

### DB-40 `withTenant` 在事务外执行 `SET LOCAL`，租户 schema 隔离是空操作
- **严重度**：P3（当前全仓无调用点）
- **位置**：`apps/api/src/plugins/tenant-db-isolation.ts:54-66`
- **触发路径**：未来任何 `request.withTenant()` 调用。
- **根因**：无事务时 `SET LOCAL` 只告警不生效，`search_path` 仍为默认；`x-tenant-id` 经 `replace(/[^a-z0-9_]/g,'_')` 归一，`a-b` 与 `a_b` 会撞同一 schema。
- **证据**：`:59` `SET LOCAL search_path` 无事务包裹；`withTenant` 全仓无调用。
- **影响面**：一旦启用即跨租户读写/串库。
- **建议**：删除或改为事务内 `SET LOCAL` + 严格租户 ID 校验。
- **当场可修**：是。
- **去重**：未登记（`rls-context.ts` 仅把它作为历史教训引用）。

---

## 已登记（不计入新增）

1. **RLS 覆盖缺口 / 应用角色 BYPASSRLS**：`PROJECT_PLAN.md:2298-2299,2739`（O13b）。迁移头注自述“721 张表仅 6 张 relrowsecurity=true、`ihui` rolbypassrls=t”。本次复核确认仍成立，但属已登记，不重复计数。
2. **0364 `journal.when` 与文件名排序双轨**：`PROJECT_PLAN.md:31633`。DB-07 只补充“不记账/非幂等 DML”，排序问题本身不重复计数。
3. **手工应用不进账本**：`PROJECT_PLAN.md:4173`。DB-01 是其“伪 hash + 抬高 maxApplied”的新机制。
4. **B11 内容漂移默认不红**：`.github/workflows/ci.yml:195` 自述 + B11 头注。DB-14 补充“问责档全仓无调用 + 同 when 短路”。
5. **10 处声明索引无 DDL**：`PROJECT_PLAN.md:31685`。DB-21/22 是新的高频查询索引缺口，不与该清单重复。
6. **`rag_chunks` / `ownership_backfill_state` 运行期建表**：`scripts/check-migration-from-zero.mjs:88-99` 已列为豁免。

## 已剔除的误报（复核记录）

- **“422 列 timestamptz 退化为 timestamp”**：不成立。实测 371 个 SQL 文件中 0 个含 `timestamp without time zone`，226 个含 `timestamptz|timestamp with time zone`；抽查 `srs_servers`、`publish_tasks` 均为 `timestamp with time zone`。
- **“`user_emails` / `play_testers` 唯一索引缺失”**：不成立。实际存在 `user_emails_email_key`、`play_testers_email_idx`，仅为命名与 TS 约定不同，功能等价。
- **“`api_key_shares` / `ai_model_mappings` 缺 FK”**：不成立。两表 DDL 均含 `REFERENCES`。
- **“软删除与唯一索引冲突”**：不成立。`uq_edu_payment_receipt_no`、`uq_edu_att_student_class_date` 实际已带 `WHERE deleted_at IS NULL`。

## 覆盖清单（实测数字）

| 维度 | 结果 |
|---|---|
| 迁移 SQL 文件 | 371 |
| `_journal.json` 条目 | 371（idx 连续、when 单调、tag 与 SQL 文件名一一对应） |
| `meta` 快照 | 67（最高 `0370`，缺 `0371`） |
| 唯一表名 | 762 |
| 重复 `CREATE TABLE` 定义的表 | **225**（`audit_logs`×4，`gen_table`/`simple_bot_configs`/`video_generation_tasks`/`gen_table_column`/`tbox_bean` ×3 等） |
| 使用 `timestamp without time zone` 的 SQL 文件 | **0** |
| 使用 `timestamptz|timestamp with time zone` 的 SQL 文件 | 226 |
| 含 `DROP TABLE` 的迁移文件 | 12 |
| 含 `DROP COLUMN` 的迁移文件 | 9 |
| 含 `SECURITY DEFINER` 的迁移文件 | 2（均带 `SET search_path`） |
| 迁移执行器 | `apply-all-migrations.mjs`、`apply-migration.mjs`、`pre-migrate-fresh-db-guard.mjs`、`drizzle-kit migrate` 全覆盖 |
| 账本/对账 | `check-db-migration-gaps.mjs`、`check-migration-bookkeeping.mjs`、`check-migrations-landed.mjs`、guardian 30 分钟巡检、deploy 计数分支 |
| 查询面 | `apps/api/src/db/**` 与 `routes/**` 的 N+1、全表 count、`SELECT *`、offset 深翻、UUID 排序、复合索引缺口 |
| 连接面 | 4 类池（writer/replica/scoped/tenant）创建点、`.end()` 调用、超时参数、读写分离代理、健康探测、shutdown 相 |
| 安全面 | SQL 注入点（`sql.raw/unsafe`）、PII/凭据列、备份/导出、RLS 策略、GRANT、种子后门、DSN argv |

## 复扫结论

- 首轮六面（迁移机制 / schema 差异 / 台账 / 查询 / 连接 / 安全）产出全部候选；
- 二次定向复扫（重复建表、索引名冲突、未命名约束、DDL 破坏性）新增 DB-18/19/37；
- 对首轮误报逐条实测复核（timestamptz、邮箱唯一、FK、软删唯一）后全部剔除；
- 再次交叉核对同面未产生新的可证实项，**本轮判定收敛（新增 0）**。剩余仅为下方「未判定」项，需库内实测或产品决策，不属于静态可证缺陷。

## 未判定（需外部条件，不计数）

1. 生产 `drizzle.__drizzle_migrations` 的实际行数、重复行、`UNIQUE` 现状、带外行 `created_at=1793944800000` 是否仍存在。
2. 生产 DB `max_connections` 与实际实例数；`DATABASE_READ_REPLICA_URL` / `DATABASE_APP_URL` / `TENANT_*_DATABASE_URL` 是否配置。
3. `chat_messages(created_at)` 索引是否已被 manual-sql 手工建立（决定 DB-11 是否实际触发锁表）。
4. 生产 `SMS_TEST_BYPASS` 是否为 true（决定 DB-33 是否可直接利用）。
5. 备份桶/网盘 ACL 与 SSE-KMS 实际状态。
6. `id_card` 等敏感列存量明文行数、历史 `admin123` 哈希是否已全部轮换。
7. drizzle-kit 0.31.10 在“最新快照落后 journal”时的具体报错/回退分支（未读 node_modules）。
8. 225 张重复建表逐表定义差异的全量清单（本报告仅证实 `relay_conversations` 一处实际漂移）。

## 仍可深挖方向

1. 生产只读 `SELECT` 比对账本 hash/created_at 与 journal 371 条，量化 lateGap 与假 hash 行。
2. 空库重放 371 条 + `pg_dump --schema-only`，与 `0370_snapshot.json` 做对象级三方 diff。
3. 对 DB-16/DB-18 的 225 张重复表做逐表首/后定义 diff，输出可执行的 `ALTER` 清单。
4. 对 DB-20/21/22/23/24/25 用 `EXPLAIN (ANALYZE, BUFFERS)` 实测，确认索引缺口与实际耗时。
5. 全量扫描支付/钱包所有 `UPDATE ... SET x = <快照表达式>`，确认 DB-03 之外是否还有同类。
6. 审计备份上传链路（ossutil/网盘）的凭据来源与桶策略。
7. 复核 `0068` 用户策略的列级 `WITH CHECK`，评估未来 RLS 生效后的自提权面。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
