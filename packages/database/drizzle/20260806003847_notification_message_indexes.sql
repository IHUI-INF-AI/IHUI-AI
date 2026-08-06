-- P1 大表查询索引补全(2026-08-06)
-- notifications / messages 原表无 userId/senderId/receiverId 索引,
-- 按用户查询通知列表与消息会话时对大表全表扫描,补复合索引覆盖"按人查询 + 时间排序"高频路径。
CREATE INDEX IF NOT EXISTS "notifications_user_created_idx"
  ON "notifications" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "messages_receiver_created_idx"
  ON "messages" ("receiver_id", "created_at");
CREATE INDEX IF NOT EXISTS "messages_sender_created_idx"
  ON "messages" ("sender_id", "created_at");
