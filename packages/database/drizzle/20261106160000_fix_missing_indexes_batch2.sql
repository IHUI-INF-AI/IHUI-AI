-- © 2026 IHUI AI · BUG-29 幂等补齐迁移(第二批:对账脚本现读仍缺失的 5 枚 schema 声明索引)
-- 生成器: scripts/audit-missing-indexes.mjs 对账后追补;本文件仅补齐,不删除任何既有对象、不改数据。
-- 全部带 IF NOT EXISTS 守卫,幂等安全。

CREATE INDEX IF NOT EXISTS "analytics_events_created_at_idx" ON "analytics_events" ("created_at");
CREATE INDEX IF NOT EXISTS "analytics_events_event_created_at_idx" ON "analytics_events" ("event", "created_at");
CREATE INDEX IF NOT EXISTS "edu_orders_created_at_idx" ON "edu_orders" ("created_at");
CREATE INDEX IF NOT EXISTS "edu_orders_user_created_at_idx" ON "edu_orders" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "ix_chat_messages_conv_created" ON "chat_messages" ("conversation_id", "created_at", "id");
