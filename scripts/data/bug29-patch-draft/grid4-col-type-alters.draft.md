<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# BUG-29 格4 补齐草案:同表两份 DDL 列类型不同(15 处,其中破坏性 8)

# 生成:2026-11-18 · 程序化导出

#

# ⚠️ ALTER 方向未定(以 schema 为准 vs 以现网实际结构为准)⇒ 每项列两分支候选,现场查

# information_schema.columns 后择一落地。破坏性冲突(主键类型不兼容)改错会丢数据,须先备份。

## users.phone

- 现读 `varchar(11)` ← 0000_naive_barracuda.sql
- 现读 `varchar(20)` ← 0043_neat_the_spike.sql
- **TODO 现场查** `SELECT data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name='users' AND column_name='phone';`
- **TODO 现场查行数** `SELECT count(*) FROM "users";`(定是否需 CONCURRENTLY/建新列回填)
- 分支 A(以 schema 为准):`ALTER TABLE "users" ALTER COLUMN "phone" TYPE <schema_type>;`
- 分支 B(以现网为准):修 schema packages/database/src/schema/*.ts 对齐现网,再 generate 迁移

## video_generation_tasks.id ⚠️ 破坏性(主键/类型不兼容)

- 现读 `serial` ← 0038_missing_tables.sql, 0043_neat_the_spike.sql
- 现读 `integer` ← 0112_r80_new_tables.sql
- **TODO 现场查** `SELECT data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name='video_generation_tasks' AND column_name='id';`
- **TODO 现场查行数** `SELECT count(*) FROM "video_generation_tasks";`(定是否需 CONCURRENTLY/建新列回填)
- 分支 A(以 schema 为准):`ALTER TABLE "video_generation_tasks" ALTER COLUMN "id" TYPE <schema_type>;`
- 分支 B(以现网为准):修 schema packages/database/src/schema/*.ts 对齐现网,再 generate 迁移

## video_generation_tasks.task_id ⚠️ 破坏性(主键/类型不兼容)

- 现读 `varchar(36)` ← 0038_missing_tables.sql, 0043_neat_the_spike.sql
- 现读 `uuid` ← 0112_r80_new_tables.sql
- **TODO 现场查** `SELECT data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name='video_generation_tasks' AND column_name='task_id';`
- **TODO 现场查行数** `SELECT count(*) FROM "video_generation_tasks";`(定是否需 CONCURRENTLY/建新列回填)
- 分支 A(以 schema 为准):`ALTER TABLE "video_generation_tasks" ALTER COLUMN "task_id" TYPE <schema_type>;`
- 分支 B(以现网为准):修 schema packages/database/src/schema/*.ts 对齐现网,再 generate 迁移

## video_generation_tasks.result

- 现读 `text` ← 0038_missing_tables.sql, 0043_neat_the_spike.sql
- 现读 `jsonb` ← 0112_r80_new_tables.sql
- **TODO 现场查** `SELECT data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name='video_generation_tasks' AND column_name='result';`
- **TODO 现场查行数** `SELECT count(*) FROM "video_generation_tasks";`(定是否需 CONCURRENTLY/建新列回填)
- 分支 A(以 schema 为准):`ALTER TABLE "video_generation_tasks" ALTER COLUMN "result" TYPE <schema_type>;`
- 分支 B(以现网为准):修 schema packages/database/src/schema/*.ts 对齐现网,再 generate 迁移

## gen_table_column.table_id ⚠️ 破坏性(主键/类型不兼容)

- 现读 `bigint` ← 0038_missing_tables.sql, 0043_neat_the_spike.sql
- 现读 `integer` ← 20260831000000_feature_gap_tables.sql
- **TODO 现场查** `SELECT data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name='gen_table_column' AND column_name='table_id';`
- **TODO 现场查行数** `SELECT count(*) FROM "gen_table_column";`(定是否需 CONCURRENTLY/建新列回填)
- 分支 A(以 schema 为准):`ALTER TABLE "gen_table_column" ALTER COLUMN "table_id" TYPE <schema_type>;`
- 分支 B(以现网为准):修 schema packages/database/src/schema/*.ts 对齐现网,再 generate 迁移

## gen_table_column.column_comment

- 现读 `varchar(1000)` ← 0038_missing_tables.sql, 0043_neat_the_spike.sql
- 现读 `varchar(500)` ← 20260831000000_feature_gap_tables.sql
- **TODO 现场查** `SELECT data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name='gen_table_column' AND column_name='column_comment';`
- **TODO 现场查行数** `SELECT count(*) FROM "gen_table_column";`(定是否需 CONCURRENTLY/建新列回填)
- 分支 A(以 schema 为准):`ALTER TABLE "gen_table_column" ALTER COLUMN "column_comment" TYPE <schema_type>;`
- 分支 B(以现网为准):修 schema packages/database/src/schema/*.ts 对齐现网,再 generate 迁移

## gen_table_column.is_pk

- 现读 `varchar(1)` ← 0038_missing_tables.sql, 0043_neat_the_spike.sql
- 现读 `boolean` ← 20260831000000_feature_gap_tables.sql
- **TODO 现场查** `SELECT data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name='gen_table_column' AND column_name='is_pk';`
- **TODO 现场查行数** `SELECT count(*) FROM "gen_table_column";`(定是否需 CONCURRENTLY/建新列回填)
- 分支 A(以 schema 为准):`ALTER TABLE "gen_table_column" ALTER COLUMN "is_pk" TYPE <schema_type>;`
- 分支 B(以现网为准):修 schema packages/database/src/schema/*.ts 对齐现网,再 generate 迁移

## tbox_bean.id ⚠️ 破坏性(主键/类型不兼容)

- 现读 `bigserial` ← 0038_missing_tables.sql, 0043_neat_the_spike.sql
- 现读 `serial` ← 20260831000000_feature_gap_tables.sql
- **TODO 现场查** `SELECT data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name='tbox_bean' AND column_name='id';`
- **TODO 现场查行数** `SELECT count(*) FROM "tbox_bean";`(定是否需 CONCURRENTLY/建新列回填)
- 分支 A(以 schema 为准):`ALTER TABLE "tbox_bean" ALTER COLUMN "id" TYPE <schema_type>;`
- 分支 B(以现网为准):修 schema packages/database/src/schema/*.ts 对齐现网,再 generate 迁移

## tbox_bean.bean_data

- 现读 `text` ← 0038_missing_tables.sql, 0043_neat_the_spike.sql
- 现读 `jsonb` ← 20260831000000_feature_gap_tables.sql
- **TODO 现场查** `SELECT data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name='tbox_bean' AND column_name='bean_data';`
- **TODO 现场查行数** `SELECT count(*) FROM "tbox_bean";`(定是否需 CONCURRENTLY/建新列回填)
- 分支 A(以 schema 为准):`ALTER TABLE "tbox_bean" ALTER COLUMN "bean_data" TYPE <schema_type>;`
- 分支 B(以现网为准):修 schema packages/database/src/schema/*.ts 对齐现网,再 generate 迁移

## ab_test_results.bucket

- 现读 `varchar(32)` ← 0043_neat_the_spike.sql
- 现读 `varchar(64)` ← 20260831000000_feature_gap_tables.sql
- **TODO 现场查** `SELECT data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name='ab_test_results' AND column_name='bucket';`
- **TODO 现场查行数** `SELECT count(*) FROM "ab_test_results";`(定是否需 CONCURRENTLY/建新列回填)
- 分支 A(以 schema 为准):`ALTER TABLE "ab_test_results" ALTER COLUMN "bucket" TYPE <schema_type>;`
- 分支 B(以现网为准):修 schema packages/database/src/schema/*.ts 对齐现网,再 generate 迁移

## ab_test_variants.name

- 现读 `varchar(100)` ← 0043_neat_the_spike.sql
- 现读 `varchar(255)` ← 20260831000000_feature_gap_tables.sql
- **TODO 现场查** `SELECT data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name='ab_test_variants' AND column_name='name';`
- **TODO 现场查行数** `SELECT count(*) FROM "ab_test_variants";`(定是否需 CONCURRENTLY/建新列回填)
- 分支 A(以 schema 为准):`ALTER TABLE "ab_test_variants" ALTER COLUMN "name" TYPE <schema_type>;`
- 分支 B(以现网为准):修 schema packages/database/src/schema/*.ts 对齐现网,再 generate 迁移

## live_gift.id ⚠️ 破坏性(主键/类型不兼容)

- 现读 `serial` ← 0044_silky_banshee.sql
- 现读 `uuid` ← 20260831000000_feature_gap_tables.sql
- **TODO 现场查** `SELECT data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name='live_gift' AND column_name='id';`
- **TODO 现场查行数** `SELECT count(*) FROM "live_gift";`(定是否需 CONCURRENTLY/建新列回填)
- 分支 A(以 schema 为准):`ALTER TABLE "live_gift" ALTER COLUMN "id" TYPE <schema_type>;`
- 分支 B(以现网为准):修 schema packages/database/src/schema/*.ts 对齐现网,再 generate 迁移

## live_gift.channel_id ⚠️ 破坏性(主键/类型不兼容)

- 现读 `integer` ← 0044_silky_banshee.sql
- 现读 `uuid` ← 20260831000000_feature_gap_tables.sql
- **TODO 现场查** `SELECT data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name='live_gift' AND column_name='channel_id';`
- **TODO 现场查行数** `SELECT count(*) FROM "live_gift";`(定是否需 CONCURRENTLY/建新列回填)
- 分支 A(以 schema 为准):`ALTER TABLE "live_gift" ALTER COLUMN "channel_id" TYPE <schema_type>;`
- 分支 B(以现网为准):修 schema packages/database/src/schema/*.ts 对齐现网,再 generate 迁移

## live_gift.user_id ⚠️ 破坏性(主键/类型不兼容)

- 现读 `varchar(64)` ← 0044_silky_banshee.sql
- 现读 `uuid` ← 20260831000000_feature_gap_tables.sql
- **TODO 现场查** `SELECT data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name='live_gift' AND column_name='user_id';`
- **TODO 现场查行数** `SELECT count(*) FROM "live_gift";`(定是否需 CONCURRENTLY/建新列回填)
- 分支 A(以 schema 为准):`ALTER TABLE "live_gift" ALTER COLUMN "user_id" TYPE <schema_type>;`
- 分支 B(以现网为准):修 schema packages/database/src/schema/*.ts 对齐现网,再 generate 迁移

## live_gift.total_price ⚠️ 破坏性(主键/类型不兼容)

- 现读 `integer` ← 0044_silky_banshee.sql
- 现读 `numeric(20,4)` ← 20260831000000_feature_gap_tables.sql
- **TODO 现场查** `SELECT data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name='live_gift' AND column_name='total_price';`
- **TODO 现场查行数** `SELECT count(*) FROM "live_gift";`(定是否需 CONCURRENTLY/建新列回填)
- 分支 A(以 schema 为准):`ALTER TABLE "live_gift" ALTER COLUMN "total_price" TYPE <schema_type>;`
- 分支 B(以现网为准):修 schema packages/database/src/schema/*.ts 对齐现网,再 generate 迁移

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
