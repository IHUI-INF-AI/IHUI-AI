-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 20260926140000: D35 长会话分页投影与增量回放 —— 第二段·服务端存量回填
-- 回填 chat_messages.turn_ordinal(20260924100000 立了列但未回填)。
--
-- 为什么必须回填:turn 分片查询把 turn_ordinal IS NULL 的行整体排除
--   (apps/api/src/db/chat-queries.ts findHistoryTurnPage 的 turnNotNull),
--   而本迁移之前的**所有存量消息**该列都是 NULL。症状是"老会话在新端点上翻不到
--   任何历史",全程不报错、消息级分页照旧正常 —— 即只有新链路静默失效。
--
-- 规则(与 apps/api/src/services/turn-ordinal.ts 同语义,只是换成 SQL 形态):
--   一轮 = 一条 user 消息 + 其后的 assistant/system;user 开启新轮,其余沿用当前轮;
--   会话内尚无 user 时全部归 turn 1(对应 Math.max(maxTurn, 1),不留 NULL)。
--   等价表达:turn_ordinal = 「本行及之前(按 created_at, id 全序)的 user 行数」,下限 1。
--   两边由 apps/api/tests/turn-ordinal-backfill.test.ts 逐条对账(不同形态、同判据)。
--
-- 幂等/可重放:
--   1) UPDATE 只写 turn_ordinal IS NULL 的行 → 第二次执行匹配 0 行,已回填的行一字节不动;
--   2) 计数窗口遍历会话的**全部**行(含已有序号的行),所以"部分回填过"的会话
--      也不会重新从 1 起算而与既有值撞号;
--   3) 排序是 PARTITION BY conversation_id ORDER BY created_at, id,而 id 是主键
--      ⇒ 每个会话内为全序,重放与并发执行都得到同一个值(确定性)。
--
-- 范围纪律:只回填 turn_ordinal。chat_conversations.history_projection_state 保持 NULL
--   (= 尚未投影过),增量回放断点由该功能自己的段落写,本迁移不越界伪造。

WITH "turn_counts" AS (
  SELECT
    "id",
    GREATEST(
      1,
      COUNT(*) FILTER (WHERE "role" = 'user') OVER (
        PARTITION BY "conversation_id"
        ORDER BY "created_at", "id"
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      )
    )::integer AS "computed_turn_ordinal"
  FROM "chat_messages"
)
UPDATE "chat_messages" AS "cm"
SET "turn_ordinal" = "tc"."computed_turn_ordinal"
FROM "turn_counts" AS "tc"
WHERE "tc"."id" = "cm"."id"
  AND "cm"."turn_ordinal" IS NULL;
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
