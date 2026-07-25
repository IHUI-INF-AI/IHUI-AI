-- chatConversations 加 lastReadAt 字段:持久化用户已读时间戳
-- 替代 message.ts POST /messages/:id/read 路由的 202 占位实现,改为真实持久化
-- 字段可空:历史会话无已读记录;新会话首次标记已读时写入 NOW()
-- 与 last_message_at 同类型(timestamp with time zone),保持一致
ALTER TABLE "chat_conversations" ADD COLUMN IF NOT EXISTS "last_read_at" timestamp with time zone;
