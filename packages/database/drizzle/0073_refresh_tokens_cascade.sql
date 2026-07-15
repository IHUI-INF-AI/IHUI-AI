-- ============================================================================
-- 0073: refresh_tokens 外键添加 CASCADE
--
-- 背景:
--   refresh_tokens.user_id → users.id 的外键当前是 NO ACTION(默认),
--   当用户被删除时,refresh_tokens 中的记录会阻止 DELETE。
--   业务上,用户被删除时其 refresh tokens 必须级联删除(否则孤儿 token
--   占用存储 + 安全风险)。
--
-- 修复:
--   重建外键约束为 ON DELETE CASCADE。
--   幂等可重复执行(先 DROP 再 ADD)。
-- ============================================================================

ALTER TABLE "refresh_tokens"
  DROP CONSTRAINT IF EXISTS "refresh_tokens_user_id_users_id_fk";

ALTER TABLE "refresh_tokens"
  ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk"
  FOREIGN KEY ("user_id")
  REFERENCES "users"("id")
  ON DELETE CASCADE
  ON UPDATE NO ACTION;
