-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 20260929160000: G-817 可空排序列 —— "新 NULL 产不出来"的存储层兜底(迁移族第三件)。
--
-- 为什么这样做(票面判据):回填型迁移只负责**存量**(只写 IS NULL 行),
--   "以后新写入的行也不再产生 NULL"必须由存储层兜底 —— 两者缺一即半件:
--   只有回填,则每一条绕过出口函数的直插路径(patrol-scheduler 告警注入、
--   conversation-import 落库,见 apps/api/src/services/turn-ordinal.ts:10-13 的
--   自我证伪)都会继续产 NULL,老会话分片端点静默丢行的病会复发;
--   只有触发器,则存量 NULL 无人补。上游 0015 的落地形态即三件一体:
--   增量回填只写 IS NULL + 从各 scope coalesce(max(sequence),-1)+1 起 +
--   AFTER INSERT 触发器(when new.sequence is null)。
--
-- 我方对应列(现读 schema 而非抄上游命名):上游是 message/part 两枚 sequence,
--   我方回填族只有一枚可空序号列 —— chat_messages.turn_ordinal
--   (packages/database/src/schema/chat.ts:79)。同族表(conversation_message_archives /
--   task_messages / conversation_imports)均无第二枚可空序号列,故本迁移一枚触发器,
--   不越界给别的列伪造兜底。scope = conversation_id(同会话内为一组轮次;backfill
--   迁移 20260926140000 的 PARTITION BY conversation_id 同口径)。
--
-- 刻意不做(票面明说):**不加** unique(conversation_id, turn_ordinal) ——
--   同会话内 turn 重复是设计而非缺陷(一轮 user+assistant 共用同一轮号),
--   上游 unique(run_id, sequence) 的形态不能照抄。
--
-- 幂等/可重放:函数 CREATE OR REPLACE、触发器 DROP IF EXISTS + CREATE,重放等值;
--   触发器只在 INSERT 时对 turn_ordinal IS NULL 的新行取号,**不 UPDATE 任何既有行**
--   (存量归 20260926140000_backfill_turn_ordinal.sql 管,本迁移不越界重排)。
--   取号:同 scope COALESCE(MAX(turn_ordinal), -1) + 1(空会话首行 = 1,与出口函数
--   Math.max(maxTurn,1) 语义一致)。AFTER INSERT + UPDATE 本行:与上游触发器同型;
--   同会话内并发插入可能同号,而同会话重复本就是设计内形态(见上),无唯一约束可撞。

CREATE OR REPLACE FUNCTION "fn_message_turn_ordinal_autofill"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "chat_messages"
     SET "turn_ordinal" = (
       SELECT COALESCE(MAX("turn_ordinal"), -1) + 1
       FROM "chat_messages"
       WHERE "conversation_id" = NEW."conversation_id"
     )
   WHERE "id" = NEW."id";
  RETURN NULL;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "message_turn_ordinal_autofill" ON "chat_messages";
--> statement-breakpoint
CREATE TRIGGER "message_turn_ordinal_autofill"
  AFTER INSERT ON "chat_messages"
  FOR EACH ROW
  WHEN (NEW."turn_ordinal" IS NULL)
  EXECUTE FUNCTION "fn_message_turn_ordinal_autofill"();
