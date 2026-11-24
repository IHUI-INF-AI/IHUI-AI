-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 2026-09-06 死表治理第二批:37 张已被 TS schema 删除定义且无运行时引用的死表
-- 名单来源:migration 链 CREATE/DROP 抵扣终集(573,含无引号表名) - dist schema 运行时
--          真实 pgTable 符号(532+2 本次补定义) - 白名单(audit_logs_default/migration 假阳性)
-- 分类:8 张 h3 批次表(apply/verify-migration-h3 一次性脚本已删除) / 3 张测试注释引用 /
--       26 张 schema 幽灵注释引用(定义文件只剩注释)
-- 前置:ai_relay_channel_daily_usage / api_key_minute_usage 已补 TS schema 定义(relay-usage.ts,
--       apps/api raw SQL 真用,不 DROP)
-- 安全性:全部 DROP TABLE IF EXISTS + CASCADE;幂等可重复执行

DROP TABLE IF EXISTS "agent_category_links" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ai_gc_task" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "department_relations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_member_company_relations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_member_level_relations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_member_post_relations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_member_tag_relations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_order_items" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_resource_product_relations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "learn_order" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "learn_record_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "learn_sign_up" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "learn_topic_category" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "learn_topic_category_relation" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "learn_topic_topic_category_relation" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "message_notice" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "payment_callbacks" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "payment_configs" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "resource_resource" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "resource_resource_download" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "resource_resource_search_record" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "resource_search_logs" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "search_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "simple_bot_configs" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "t_clazz" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "t_course_recommend" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "t_course_recommend_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "t_knowledge_point" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "t_member_company" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "t_order_payment" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "t_school" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "transfer_infos" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "user_jobs" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "user_sk_info" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "visit_page" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "visit_source" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "visit_stats" CASCADE;--> statement-breakpoint
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
