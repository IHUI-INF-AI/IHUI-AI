-- chatConversations 添加 pinned / pinned_at 字段(2026-08-30):
-- 会话置顶功能:pinned=true 时置顶到会话列表最前(按 pinned_at 倒序),取消置顶置回 false/null。
-- 幂等:IF NOT EXISTS 保证重复执行不报错,不破坏既有数据。
ALTER TABLE "chat_conversations" ADD COLUMN IF NOT EXISTS "pinned" boolean DEFAULT false NOT NULL;
ALTER TABLE "chat_conversations" ADD COLUMN IF NOT EXISTS "pinned_at" timestamptz;
