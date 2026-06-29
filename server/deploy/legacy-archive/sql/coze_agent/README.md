# coze_agent SQL 归档

## 来源
- 源路径：`H:\历史项目存档\ljd-交接文件\coze_zhs_py\sql\`
- 归档时间：2026-06-28（Round 33）
- 归档原因：历史项目 coze_zhs_py 的 agent 业务表原始 MySQL DDL，封存追溯用

## 文件清单（15 个）
### 根目录（11 个建表/seed 脚本）
- `zhs_agent_buy.sql` - 代理购买表 DDL
- `zhs_agent_category.sql` - 代理分类表 DDL
- `zhs_agent_developer.sql` - 开发者表 DDL
- `zhs_agent_examine.sql` - 审核表 DDL
- `zhs_agent_settlement.sql` - 结算表 DDL
- `zhs_agent_withdrawal_detail.sql` - 提现明细表 DDL
- `zhs_developer_link.sql` - 开发者关联表 DDL
- `agent_buy_scheduled_tasks.sql` - 购买定时任务表 DDL
- `agent_heat_stats.sql` - 热度统计表 DDL
- `insert_settlement_test_data.sql` - 结算测试数据 seed
- `insert_test_withdrawal_data.sql` - 提现测试数据 seed

### migrations/ 子目录（4 个迁移脚本）
- `add_category_fields_to_agents.sql` - agents 表新增 category 字段
- `add_issue_no_to_settlement.sql` - settlement 表新增 issue_no 字段
- `add_order_no_to_zhs_agent_developer.sql` - zhs_agent_developer 表新增 order_no 字段
- `ensure_settlement_table_exists.sql` - 确保 settlement 表存在

## 与新项目的关系
新项目 `g:\IHUI-AI\server` 通过 alembic 001_init.sql 重建了这些表结构（zhs_agent_buy 等），
本归档仅作历史 MySQL DDL 追溯用，新项目代码不引用这些 SQL 文件。
