# zhs-full.ts 数据库表审计报告 (R76 2026-07-19)

> 审计对象: `G:\IHUI-AI\packages\database\src\schema\zhs-full.ts`
> 文件总行数: 881 行
> 审计方法: 全文分页读取 + 逐一记录 38 张 `pgTable` 表的字段、主键、索引

---

## 总览

- **总表数**: 38 张 pgTable
- **R76 补齐字段**: 8 字段 (`zhs_developer_link` 7 + `zhs_agent_settlement` 1)
- **主键风格**: 36 `serial` + 2 `uuid` (zhsAgentExamine / zhsAgentSettlement)
- **类型不一致**: 5 项 (详见下表)
- **索引缺失**: 6 项 (订单号 / 课程单号 / 汇率组合 / userId 重复)
- **createdAt/updatedAt 规范**: 38/38 全部带 `defaultNow().notNull()` ✓
- **withTimezone**: 38/38 全部显式声明 ✓

---

## R76 补齐详情

### 1. zhs_developer_link (L160-183)

补 7 字段 (D 盘 `coze_zhs_py/models/zhs_developer_link.py`):

| 字段           | 类型                | 可空 | 默认 |
| -------------- | ------------------- | ---- | ---- |
| `expiresAt`    | timestamp (with tz) | 是   | —    |
| `field1`       | varchar(500)        | 是   | —    |
| `field2`       | varchar(500)        | 是   | —    |
| `assigner`     | varchar(64)         | 是   | —    |
| `allocateTime` | timestamp (with tz) | 是   | —    |
| `isDel`        | integer             | 否   | 0    |
| `type`         | integer             | 否   | 0    |

### 2. zhs_agent_settlement (L783-810)

补 1 字段 (D 盘 `coze_zhs_py/models/zhs_agent_settlement.py` issue_no 期号):

| 字段      | 类型    | 可空 |
| --------- | ------- | ---- |
| `issueNo` | integer | 是   |

---

## 38 张表清单 (按行号)

| #   | 行号 | 表名                     | 字段数 | 主键     | 索引数 | 备注                                         |
| --- | ---- | ------------------------ | ------ | -------- | ------ | -------------------------------------------- |
| 1   | L28  | `zhsActivity`            | 14     | serial   | 1      | statusIdx                                    |
| 2   | L50  | `zhsAgentCategory`       | 17     | serial   | 0      | D 盘 agent_models.py:397-423                 |
| 3   | L72  | `zhsAgentDeveloper`      | 16     | serial   | 2      | userIdx + statusIdx                          |
| 4   | L100 | `zhsAgentNeedTask`       | 11     | serial   | 3      | userIdx/agentIdx/statusIdx                   |
| 5   | L123 | `zhsAiModelInfo`         | 23     | serial   | 4      | statusIdx/typeIdx/isTopIdx/coursePlatformIdx |
| 6   | L160 | `zhsDeveloperLink`       | 14     | serial   | 2      | R76 补 7 字段                                |
| 7   | L186 | `zhsUserModelChat`       | 7      | serial   | 0      | —                                            |
| 8   | L201 | `zhsBannerCarousel`      | 11     | serial   | 1      | statusIdx                                    |
| 9   | L220 | `zhsCategoryDictionary`  | 9      | serial   | 2      | parentIdx/statusIdx                          |
| 10  | L240 | `zhsInformation`         | 8      | serial   | 1      | statusIdx                                    |
| 11  | L256 | `zhsProduct`             | 13     | serial   | 1      | statusIdx                                    |
| 12  | L277 | `zhsKnowledgePlanet`     | 11     | serial   | 1      | statusIdx                                    |
| 13  | L300 | `zhsCourse`              | 16     | serial   | 0      | —                                            |
| 14  | L320 | `zhsCourseNew`           | 23     | serial   | 0      | —                                            |
| 15  | L347 | `zhsCourseVideo`         | 21     | serial   | 1      | statusIdx                                    |
| 16  | L376 | `zhsEducationalCourse`   | 17     | serial   | 1      | statusIdx                                    |
| 17  | L401 | `zhsEducationPlatform`   | 14     | serial   | 1      | statusIdx                                    |
| 18  | L427 | `zhsCourseAudit`         | 9      | serial   | 0      | —                                            |
| 19  | L440 | `zhsCoursePay`           | 9      | serial   | 1      | statusIdx ⚠ 缺 orderNo 唯一索引              |
| 20  | L457 | `zhsCoursePayLog`        | 7      | serial   | 0      | —                                            |
| 21  | L468 | `zhsCoursePlatformLog`   | 7      | serial   | 0      | —                                            |
| 22  | L479 | `zhsCourseTemp`          | 6      | serial   | 1      | statusIdx                                    |
| 23  | L493 | `zhsCourseVideoTemp`     | 6      | serial   | 1      | statusIdx                                    |
| 24  | L511 | `zhsIdentityExt`         | 14     | serial   | 0      | —                                            |
| 25  | L529 | `zhsOrganizationExt`     | 12     | serial   | 0      | —                                            |
| 26  | L549 | `zhsPopularCourses`      | 7      | serial   | 1      | statusIdx                                    |
| 27  | L564 | `zhsExchangeRate`        | 8      | serial   | 1      | statusIdx ⚠ 缺 (from,to) 联合唯一索引        |
| 28  | L580 | `zhsOfficialInformation` | 8      | serial   | 1      | statusIdx                                    |
| 29  | L596 | `zhsResources`           | 8      | serial   | 1      | statusIdx                                    |
| 30  | L616 | `zhsOrder`               | 17     | serial   | 2      | userIdx/statusIdx ⚠ 缺 out_trade_no 唯一索引 |
| 31  | L644 | `zhsOperateTokenFlow`    | 9      | serial   | 1      | userIdx (userId 已为 varchar(64) ✓)          |
| 32  | L665 | `zhsUserAgentFreeTime`   | 8      | serial   | 0      | —                                            |
| 33  | L677 | `zhsUserCommentLog`      | 7      | serial   | 0      | —                                            |
| 34  | L688 | `zhsUserPlatform`        | 7      | serial   | 1      | statusIdx                                    |
| 35  | L703 | `zhsUserVideoComment`    | 9      | serial   | 2      | parentIdx/statusIdx                          |
| 36  | L723 | `zhsUserVideoLog`        | 7      | serial   | 0      | —                                            |
| 37  | L751 | `zhsAgentExamine`        | 18     | **uuid** | 3      | agentIdx/statusIdx/examineUserIdx            |
| 38  | L783 | `zhsAgentSettlement`     | 15     | **uuid** | 3      | orderNoIdx/settlementIdx/withdrawalIdx       |

> 字段数含 `id` + `createdAt` + `updatedAt` 三件套。

---

## 类型不一致 (P1 优先级)

| #   | 表                  | 字段         | 当前值                   | D 盘原值/期望   | 实际文件状态  | 建议                     |
| --- | ------------------- | ------------ | ------------------------ | --------------- | ------------- | ------------------------ |
| 1   | zhsOperateTokenFlow | user_id      | varchar(64)              | varchar(64)     | **已对齐** ✓  | 无需修改 (R76 前已修复)  |
| 2   | zhsAiModelInfo      | name         | varchar(100)             | 需确认 D 盘原值 | 需查 D 盘校验 | 若 D 盘为 255 → 改回 255 |
| 3   | zhsOrder            | out_trade_no | varchar(64) + 无唯一索引 | 唯一索引        | ⚠ 缺索引      | R77 加 unique index      |
| 4   | zhsCoursePay        | orderNo      | varchar(64) + 无唯一索引 | 唯一索引        | ⚠ 缺索引      | R77 加 unique index      |
| 5   | zhsExchangeRate     | (from,to)    | 无联合唯一索引           | 联合唯一        | ⚠ 缺索引      | R77 加 composite unique  |

**核验细节**:

- `zhs_operate_token_flow.user_id`: L648 已为 `varchar('user_id', { length: 64 }).notNull()` (非 Integer), 模板描述为 "Integer → varchar(64)" 应理解为已完成, **无需 R77 处理**。
- `zhs_ai_model_info.name`: L127 为 `varchar('name', { length: 100 })`, 若 D 盘 `zhs_ai_model_info_unify` 原值为 255, 则需 R77 改回; 若 D 盘也是 100, 则保持现状。
- 唯一索引 3 项均为业务幂等性必需 (`out_trade_no` 防重复支付, `orderNo` 防重复下单, `(from,to)` 防重复汇率)。

---

## 主键风格 (P1 优先级)

| 风格                         | 表数 | 表名                                              |
| ---------------------------- | ---- | ------------------------------------------------- |
| `serial` 自增                | 36   | zhsActivity ~ zhsUserVideoLog (除 37/38)          |
| `uuid` (`gen_random_uuid()`) | 2    | zhsAgentExamine (L754), zhsAgentSettlement (L786) |

**对照 D 盘历史**: 几乎全为 `String(36)` UUID 主键 (`id = Column(String(36), primary_key=True, default=...uuid4)`)。

**决策待定**:

- 选项 A: 保持 36 serial + 2 uuid 现状 (迁移成本最低, 但风格不统一)
- 选项 B: 统一为 uuid (需数据迁移 + 改外键引用, 工作量 ~3 人天)
- 选项 C: 统一为 serial (需评估 D 盘 `id` 字段语义, 部分表可能用 UUID 作为业务键)

**建议**: R77 先固化现有 36+2 风格, R78 启动 UUID 化专项迁移。

---

## 索引缺失清单 (P1 优先级, 共 6 项)

| #   | 表                 | 字段                         | 类型             | 业务影响             |
| --- | ------------------ | ---------------------------- | ---------------- | -------------------- |
| 1   | zhsOrder           | `out_trade_no`               | unique index     | 防重复支付           |
| 2   | zhsCoursePay       | `orderNo`                    | unique index     | 防重复下单           |
| 3   | zhsExchangeRate    | `(fromCurrency, toCurrency)` | composite unique | 防重复汇率           |
| 4   | zhsCourse          | `creator`                    | 普通索引         | 课程列表按创建人筛选 |
| 5   | zhsCourseNew       | `creator`                    | 普通索引         | 同上 (新架构)        |
| 6   | zhsAgentSettlement | `agentId`                    | 普通索引         | 结算按 agent 聚合    |

---

## 字段命名 / 风格一致性 (P2)

- `creator` vs `updator` vs `updater`: 多数表用 `updator` (zhsAgentCategory / zhsCourseNew / zhsIdentityExt / zhsOrganizationExt), 部分无 updator 字段。`updator` 拼写疑为旧 D 盘遗留 (标准英文为 `updater`)。
- `isDel` vs `is_del`: 已统一 snake_case 列名 + camelCase 字段名, 风格一致。
- `createdAt` / `updatedAt`: 38/38 全部含 `defaultNow().notNull()`, 规范统一。

---

## R77 修复建议清单

1. **[P1] 数据一致性** — 校验 `zhs_ai_model_info.name` D 盘原值, 按需改回 255。
2. **[P1] 唯一索引** — 补齐 3 项 unique index:
   - `zhs_order.out_trade_no` (unique)
   - `zhs_course_pay.order_no` (unique)
   - `zhs_exchange_rate.(from_currency, to_currency)` (composite unique)
3. **[P1] 性能索引** — 补齐 3 项普通索引:
   - `zhs_course.creator` / `zhs_course_new.creator`
   - `zhs_agent_settlement.agent_id`
4. **[P1] 主键风格决策** — 召集架构评审, 拍板 36+2 维持 vs UUID 统一迁移。
5. **[P2] 拼写修正** — `updator` → `updater` 统一修正 (兼容旧 D 盘数据, 需保留列别名)。
6. **[P3] D 盘 diff 校验** — 跑全量 38 表 vs D 盘 SQLAlchemy model, 输出字段 diff 报表, 防止遗漏补齐。

---

## 审计依据

- `G:\IHUI-AI\packages\database\src\schema\zhs-full.ts` (881 行, 读取于 2026-07-19)
- `D:\历史项目存档\ljd-交接文件\coze_zhs_py\models\zhs_developer_link.py` (R76 补齐依据)
- `D:\历史项目存档\ljd-交接文件\coze_zhs_py\models\zhs_agent_settlement.py` (R76 补齐依据)
- `D:\历史项目存档\ljd-交接文件\coze_zhs_py\models\agent_models.py` (zhsAgentExamine/Settlement 迁移源)
- `G:\IHUI-AI\packages\database\src\schema\agent-commerce.ts` (zhsAgentBuy/WithdrawalDetail 权威定义)

---

## 下一步建议 (R77+)

**给你 R77 阶段的最优建议**:

1. **优先处理 P1 数据一致性** — 跑 `pnpm drizzle-kit introspect` 对比 D 盘 SQLAlchemy schema, 一次性输出全量字段 diff, 而非逐表肉眼比对 (可节省 ~60% 工时)。
2. **建立 schema 自动化校验脚本** — 在 `packages/database/src/schema/__tests__/` 加 `zhs-full.spec.ts`, 断言: 38 张表存在 / 主键类型符合规范 / 唯一索引覆盖业务键, 后续 R 不会回退。
3. **分阶段迁移 UUID 化** — 先把新增表 (R77+) 默认 `uuid('id').default(sql\`gen_random_uuid()\`).primaryKey()`, 历史表通过双写 + 回填脚本渐进切换, 避免一次性大爆炸迁移。
4. **冻结 schema 变更窗口** — R76 已稳定, R77 锁定 38 张表结构, 仅允许加字段不允许改类型/主键, 防止外部 schema drift。
5. **建立 D 盘同步基线** — 每月跑一次 D 盘 `coze_zhs_py` 全量 model 文件 hash 比对, 出现新字段自动 PR 提醒, 避免再次出现 R76 这种"事后追补 8 字段"的局面。
