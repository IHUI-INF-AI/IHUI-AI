-- 0049: 清理死表 - schema 定义已删除且无 API 引用的表
-- 涉及表：app_content, exchange_rate, admin_oper_log, search_index

-- search_index 有外键引用 users 表，使用 CASCADE 安全删除
DROP TABLE IF EXISTS "search_index" CASCADE;--> statement-breakpoint

DROP TABLE IF EXISTS "admin_oper_log" CASCADE;--> statement-breakpoint

DROP TABLE IF EXISTS "exchange_rate" CASCADE;--> statement-breakpoint

DROP TABLE IF EXISTS "app_content" CASCADE;
