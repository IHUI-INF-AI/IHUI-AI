-- chatConversations 添加 shareToken 字段:支持公开分享对话
-- 用户点击分享时生成唯一 token,未分享过的对话 shareToken 为 NULL
ALTER TABLE "chat_conversations" ADD COLUMN IF NOT EXISTS "share_token" varchar(32) UNIQUE;
