<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->
# agent 记忆压缩表类型重建被跳过：旧列类型与 TS integer 标注不一致(静默不一致)

- 日期：2026-11-08
- 归属：迁移安全策略的已知残余风险(不是判据问题)
- 迁移：`packages/database/drizzle/20261018160000_agent_state_tables_runtime_reality.sql`
- 读取面：`apps/api/src/routes/memory.ts`

## 触发条件

- 存量表 `agent_working_memory_compression` 有行（`row_count > 0`）；
- 且 `original_messages` / `compressed_to` 仍是旧类型（bigint/jsonb/text），迁移按 BUG-90 护栏跳过 `DROP COLUMN` + `ADD COLUMN`，原列保留。

## 影响面

- 列仍为旧类型，而 Drizzle schema 标注 `integer`（`packages/database/src/schema/agent-state.ts:293-294`）；
- `memory.ts` 的记忆状态统计条会用旧类型值拼文案；若驱动把值以字符串返回，参与数值运算会退化为字符串拼接（`"5"+3 → "53"`）或产生 `NaN`；
- 不影响写入与主链路，只影响记忆状态展示口径。

## 处置

- 迁移保留 `row_count` 护栏与 `RAISE NOTICE 'BUG-90: ... 跳过'`，不静默跳过；
- `memory.ts` 增加运行时归一：`toFiniteCount` / `formatWorkingCompression`（字符串数字按数值处理，非法/缺失降级为 0）；
- 夹具：`apps/api/src/routes/__tests__/memory-working-compression.test.ts`（3 用例，覆盖 `"5"+3=8`、展示文案一致、非法值降级）；
- 后续：数据侧去重/回填后，在维护窗口补做这三列的类型重建。
