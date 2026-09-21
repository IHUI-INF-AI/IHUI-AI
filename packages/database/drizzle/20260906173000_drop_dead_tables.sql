-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 2026-09-06 死表治理下沉:将 2026-08-31 dev DB 层直接执行的死表 DROP 正式落入 migration 链
-- 目的:消除全新库( fresh / 生产)重建死表的问题(此前 fresh 673 表含 97 张 dev 已治理掉的死表)
-- 名单来源:migration CREATE 全集(671) - dist schema 运行时真实 pgTable 符号(532) = 137 张死表
--          再剔除 40 张当前代码文本引用命中的表(保守保护:ai-service raw SQL 真用 2 张 /
--          verify 守门脚本引用 8 张 / 测试引用 / schema 注释幽灵引用),终名单 97 张
-- 安全性:全部 DROP TABLE IF EXISTS + CASCADE,dev 库该批表已于 2026-08-31 治理 DROP,本文件对 dev 为无操作

DROP TABLE IF EXISTS "admin_oper_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "agent_buy_scheduled_tasks" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "app_content" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ask_question_categories" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "audit_chain_entries" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "auth_identities" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "behavior_comment" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "behavior_follow" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "behavior_like" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "behavior_report" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "behavior_sensitive" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "behavior_share" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "circle_circle_member" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_agreement" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_answer" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_article" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_ask_category" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_authority" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_carousel" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_category" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_circle" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_circle_category" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_circle_dynamic" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_comment" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_exam_category" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_exam_chapter" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_exam_chapter_section" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_exam_paper" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_exam_paper_question" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_exam_paper_rule" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_exam_question" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_exam_record" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_favorite" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_index_category" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_index_config" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_learn_category" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_learn_map" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_lesson_homework" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_like" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_news" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_question" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_resource" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_resource_category" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_resource_product" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_role" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_role_authority" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_trade" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_visit_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "edu_watch_record" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "exam_category_relation" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "exam_exam_category_relation" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "exam_exam_chapter" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "exam_exam_chapter_section" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "exam_paper_category" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "exam_paper_category_relation" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "exam_paper_paper_category_relation" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "exam_question_and_category_relation" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "exam_question_category" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "exam_question_category_relation" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "exchange_rate" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "file_tag_relations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "file_tags" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "learn_category_relation" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "learn_lesson_category_relation" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "live_category_relation" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "live_channel_category" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "live_channel_category_relation" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "live_channel_lecturer" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "live_tencent_cloud_live_stream" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "member_group_member_relations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "message_announcement" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "message_announcement_read_record" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "message_read_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "notification_subscription" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "point_exchange" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "point_goods" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "private_letter_messages" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "private_letter_sessions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "resource_category_relation" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "resource_resource_category_relation" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "resource_tag_relations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "search_hot_keywords" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "search_index" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "t_check_in_record" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "t_homework" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "t_tencent_cloud_live_stream" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "zhs_agent_settlement" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "zhs_course_new" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "zhs_educational_course" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "zhs_identity_ext" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "zhs_information" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "zhs_knowledge_planet" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "zhs_official_information" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "zhs_organization_ext" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "zhs_popular_courses" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "zhs_resources" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "zhs_user_agent_free_time" CASCADE;--> statement-breakpoint
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
