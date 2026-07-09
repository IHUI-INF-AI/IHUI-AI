-- Wave 16 Phase 16: 为 chat_favorites 添加 (user_id, conversation_id) 唯一约束
-- 原 schema 注释声明唯一但未实际创建约束,导致 favoriteConversation 的 check-then-act 竞态。
-- 添加约束后可使用 ON CONFLICT DO NOTHING 实现幂等收藏。

-- 先清理可能的重复数据(保留最早创建的)
DELETE FROM "chat_favorites" a USING "chat_favorites" b
WHERE a.id > b.id AND a.user_id = b.user_id AND a.conversation_id = b.conversation_id;

ALTER TABLE "chat_favorites" ADD CONSTRAINT "chat_favorites_user_id_conversation_id_unique"
  UNIQUE ("user_id", "conversation_id");
