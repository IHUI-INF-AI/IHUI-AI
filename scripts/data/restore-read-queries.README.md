<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# `restore-read-queries.json` — 还原演练的应用读查询夹具

一份机器可读的**真实应用读查询**清单。用途只有一个:把夜间 `pg_dump` 还原到 scratch 库之后,拿这些语句去问一句
「应用自己的查询在这份数据上跑不跑得通」——因为「备份能还原出来(720 张表、行数对得上)」与
「还原出来的库能被应用查」是两个不同的命题,前者成立时后者可以整片失败。

## 查询从哪来

全部 60 条来自 **HEAD `4406c5602b`** 的真实调用点,逐条在 `source` 里记了 `file:line`。没有一条是凭空写的:

- `apps/api/src/db/*.ts`、`apps/api/src/routes/**`、`apps/api/src/services/**` —— Drizzle 查询。
  Drizzle 动态拼 SQL,所以夹具给的是**它 `.toSQL()` 会发出的那条语句**:表限定符摊平、
  驼峰结果别名改写成下划线(为了让整份文件不含双引号标识符)、无参 `db.select()` 按 ORM 的实际行为
  **展开全部列**(而不是省成几个,否则就丢掉了「某列没还原」这个最该被抓到的信号)。
- `apps/ai-service/app/routers/publish.py` —— 那几张 `publish_*` 表由 ai-service 用 asyncpg 裸 SQL 读,
  `apps/api` 只做 HTTP 转发,所以这几条的 `source` 是 Python 行号。

需要 id 的地方一律用 `(SELECT ... ORDER BY ... LIMIT 1)` 这类 limit 子查询给出,不写死魔法 id:
演练库是全量拷贝,数据在,但**一条查询不能依赖某一行存在才算有效测试**(空库上必须照样跑通)。

## 跑法

```bash
# 逐条执行,只判定「报不报错 + 列数对不对」
node -e '…read JSON, for each q: psql -c q.sql…'   # 消费方自行实现
```

- 每条 `sql` 是**单条只读语句**:无分号分隔的多语句、无 DDL/DML、无 `\` 元命令、无 `:param` 占位符。
- 整份文件**不含一个双引号标识符**(已机器复核),所以 `psql -c "<sql>"` 这种外壳双引号包裹对全部 60 条都成立。
  代价是少数列名不能裸写:本文件为此放弃了 `plans.interval`(PG 关键字形状的列名,见下方判读陷阱第 4 条),
  并把 `billing.team-member-correlated-sums` 里应用侧写成 `"users"."id"` 的表限定改成等价的裸 `users.id`。
- **PASS** = 语句执行不报 PostgreSQL 错 **且** 结果列数等于 `expect` 里的数。行数 0 **是 PASS**,
  除非 `expect` 另做要求(聚合查询要求「恰好 1 行」;RLS 那几条要求把「0 行」当线索而不是当通过)。
- **FAIL** = 任何错误。报 `42703 column does not exist` / `42883 operator does not exist` 时,
  先分清是「扩展没装」还是「列没还原」——这两件事在 `expect` 里都写明了怎么辨。

## 覆盖了什么

按 `id` 前缀分组的条数(现值以文件为准,别照抄别的文档):

`users` 3 · `sessions` 1 · `auth` 2 · `chat` 6 · `agents` 4 · `models` 2 · `vector` 2 · `credits` 6 ·
`wallet` 1 · `orders` 4 · `billing` 2 · `im` 3 · `messages` 2 · `notifications` 3 · `files` 3 ·
`workspace` 1 · `rbac` 2 · `publish` 3 · `logs` 2 · `analytics` 2 · `sys` 1 · `identity` 2 · `rls` 3
—— 共 60 条,触及 47 张表。

5 个「还原敏感」维各有真实调用点支撑:

| 维度                                               | 条目                                                                                                                                                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 扩展运算符(pgvector `<=>`)                         | `vector.codebase-ann-cosine-order`、`vector.knowledge-chunk-ann-cosine-order`                                                                                                                |
| 全文检索 / 排序规则(`@@ plainto_tsquery`、`ILIKE`) | `users.fulltext-tsvector-search`、`files.fulltext-tsvector-search`、`agents.keyword-ilike-count`                                                                                             |
| 跨表外键连接                                       | `rbac.three-hop-permission-chain`(三跳)、`models.relay-catalog-inner-join-bigint`、`credits.leaderboard-balance-join-users`(LEFT)、`files.tag-filter-cast-through-varchar-fk`(`::uuid` 落型) |
| identity / 序列生成的列                            | `identity.generated-column-page`、`identity.generated-column-by-int-pk`                                                                                                                      |
| `date_trunc` / 时区聚合                            | `wallet.daily-flow-date-trunc-filter`、`credits.daily-spend-timezone-bucket`、`logs.llm-daily-bucket-named-timezone`(命名时区 `Asia/Shanghai`)                                               |

另外三组不在清单要求里、但实测存在且最容易被还原打掉,所以一并守:
**JSONB `->>` + `percentile_cont ... WITHIN GROUP`**(`logs.llm-period-aggregate-jsonb-percentile`)、
**`= ANY(...::uuid[])` 数组谓词**(`notifications.preferences-batch-any-uuid-array`)、
**`FORCE ROW LEVEL SECURITY`**(`rls.*` 三条)。

## 已知的判读陷阱(读结果前先看这段)

1. **`search_vector` 只由手写迁移 0010 建立,不在任何 Drizzle 表定义、也不在 `drizzle/meta` 的任何快照里。**
   而调用点(`search-queries.ts`)把这条查询包在 `try/catch` 里、失败就降级成全 `ILIKE`——
   所以它在应用侧永远是静默的,只有这个夹具会喊。**一次按 schema-push 建的还原会让这三条同时变红,
   而按迁移重放的还原不会**,这正是把它单列出来的理由。
2. **RLS 那三条报 0 行不一定是「没数据」。** `team_knowledge_spaces` / `zhs_knowledge_doc` /
   `zhs_knowledge_chunk` 带 `ENABLE + FORCE ROW LEVEL SECURITY`,策略谓词读
   `current_setting('app.user_id', true)` 并调 `public.team_knowledge_space_visible(...)`。
   演练跑在超级用户下 ⇒ 绕过 RLS(全可见);跑在非属主角色下而 `app.user_id` 未设 ⇒ 静默 0 行。
   两种情形都不算「备份坏了」,但**函数缺失会报 42883**,那才是真丢了东西。
3. **凭据列被刻意包含**(bytea 的 `two_factor_secret`、加密 `id_card`、`access_token`、`credentials_json`),
   因为真实调用点就是全列读。runner 因此**只准报列数与错误,不准打印行值**。
4. `plans.interval` 是 PostgreSQL 关键字形状的列名,应用只通过 Drizzle 的带引号标识符访问它;
   本文件禁用双引号,所以它**不在覆盖范围内**,这是一条如实登记的空白而非遗漏。

## 怎么重新生成 / 扩条

1. 选一个真实调用点(优先 `apps/api/src/db/*-queries.ts`),记下 `file:line`。
2. 想知道 Drizzle 到底发什么:在该调用点上跑 `console.log(query.toSQL())`,或按 `packages/database/src/schema/`
   的列定义手工展开——**不要凭表名猜列名**。
3. 交叉校验列名(本文件入库前就是这么查的):把 `packages/database/src/schema/*.ts` 里每个
   `pgTable('<name>', { ... })` 的块解析成 表→列 集合,再逐条扫 SQL 里的 `alias.column` 引用,
   不在集合内即改。`search_vector` 是唯一一条必须放行的(见上)。
4. 写回 JSON 时**同步 `meta.count` 与 `meta.head`**(`git rev-parse --short HEAD`),并保持
   「无分号 / 无双引号 / 无占位符 / 单条只读」四条。
5. 新增条目要求**形状真的不同**:同一张表换个 WHERE 再抄一条不构成任何证明。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
