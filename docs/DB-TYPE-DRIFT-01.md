<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# DB-TYPE-DRIFT-01：`resource_downloads` 两列类型与 schema 不符

- 状态：已执行（2026-11-07T03:42:45Z，生产 `ihui_dev`，独立事务；读数见 §7）
- 发现：2026-11-07，`20261106150000` 的 28 条 FK 前置预检
- 影响表：`resource_downloads`（生产 0 行）
- 关联：`DB-SCHEMA-GAP-01`（该 FK 已从 #1 移除，本票负责修复与补回）

## 1. 漂移事实

| 列 | schema 声明（`packages/database/src/schema`） | 生产实测 | 空库实测 |
|---|---|---|---|
| `resource_id` | `uuid` | `integer` | `integer` |
| `user_id` | `uuid` | `integer` | `integer` |

- 生产 `resource_downloads` 行数 = 0；空库（从 0 跑完整 journal）同样为 0。
- 因此 #1 里 `fk_resource_downloads_user_id_users` 指向 `users.id`（uuid）在类型上不可能成立；这正是它过去被 `EXCEPTION WHEN others` 静默吞掉的真实原因。

## 2. 写入路径是否真的失败（实测）

测试库 `ihui_fresh_1107`（55432），真实执行两次 INSERT：

```
INSERT INTO resource_downloads (resource_id, user_id, ip, user_agent, created_at)
VALUES (1, '<uuid>'::uuid, '127.0.0.1', 'probe', now());

ERROR: column "user_id" is of type integer but expression is of type uuid
HINT:  You will need to rewrite or cast the expression.
```

```
INSERT INTO resource_downloads (resource_id, user_id, ip, user_agent, created_at)
VALUES ('<uuid>'::uuid, 1, '127.0.0.1', 'probe', now());

ERROR: column "resource_id" is of type integer but expression is of type uuid
HINT:  You will need to rewrite or cast the expression.
```

两次均未写入，表仍为 0 行。

写入路径：`apps/api/src/db/resource-queries.ts:656-663` 的 `createDownloadRecord` 直接以 schema 的 uuid 值插入；调用点为资源下载 POST 路由。**当前该接口一旦被调用即 500。**

读路径：全仓 `resource_downloads` / `resourceDownloads` 仅此一处写入，**没有任何 SELECT**；因此不存在「读表因列类型/列缺失而 500」的路径。

## 3. 改类型方案（0 行 ⇒ 瞬时）

```sql
BEGIN;
ALTER TABLE "resource_downloads"
  ALTER COLUMN "resource_id" TYPE uuid USING "resource_id"::text::uuid,
  ALTER COLUMN "user_id"    TYPE uuid USING "user_id"::text::uuid;
COMMIT;
```

- 0 行，无重写、无数据损失；`USING` 在空表上是形式上的短路。
- 完成后在同一条迁移里以守卫方式补回 `fk_resource_downloads_user_id_users`（`users.id`，`ON DELETE NO ACTION ON UPDATE NO ACTION`），把 FK 总数恢复到 28。

## 4. 回滚语句

```sql
BEGIN;
ALTER TABLE "resource_downloads"
  ALTER COLUMN "resource_id" TYPE integer USING "resource_id"::text::integer,
  ALTER COLUMN "user_id"    TYPE integer USING "user_id"::text::integer;
COMMIT;
```

- **仅在表仍为 0 行时无损**；一旦有 uuid 数据写入，回滚需从窗口前备份恢复（备份含全表 0 行，天然安全）。

## 5. 排期

- **本窗口结束后同一天（2026-11-07）立即执行**，不并入本窗口的 8 条 pending。
- 执行前先报一声；执行顺序：备份 → 两条 `ALTER TYPE` → 补 FK → 断言（两列 udt=uuid、FK 存在、插入探针成功）。
- 若届时窗口被推迟，则改为第三条补偿迁移单独报批，不静默延期。

## 6. 与 #1 的关系

- #1 的 FK 建成数按真实内容写死为 **27**（28 − 本票 1）。
- 本票完成后，库里 FK 数为 28；断言表届时新增本票的 1 条，不改写 #1 的 27。

## 7. 执行记录（2026-11-07）

- 定点备份：`D:/DevEnv/backups/resource_downloads_20261107034230.csv`（0 行，48 字节，sha256 `cfe2cbc1…e62bc`）；`resource_downloads_ddl_20261107034230.sql`（64 行，2273 字节，sha256 `b1c71599…1e0d`）。
- 执行（psql exit=0，独立事务）：
  - `rows_before=0`
  - `ALTER TABLE` ×2 成功；`udt_resource_id=uuid`、`udt_user_id=uuid`
  - `fk_present=1`（`fk_resource_downloads_user_id_users` → `users`）
  - `rows_after_alter=0`
- 写入探针（事务内，随后 `ROLLBACK`）：`INSERT 0 1` → `probe_inserted_rows=1` → `rows_after_rollback=0`。原 42703/type 报错不再出现。
- 生产 public FK 总数：563（窗口前）→ **595**；构成：+27（#1）/+5（#2 三新表）/−2（#3 旧退款 FK）/+1（#5 crash_reports）/+1（本票）。
- 读路径：全仓无 `resource_downloads` 的 `SELECT`，不存在因列类型/缺失导致 500 的读路径（见 §2）。
- `final-assert.sql` 保持 128 项不改写（跨 fresh/upcompat/prod 三者可比）；本票的 4 项读数在上方独立记录。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
