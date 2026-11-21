-- ============================================================
-- BUG-29 FK 包前置检测：孤儿行检测（在生产【状态克隆】上先跑，只读、零风险）
-- 目的：包3 的 28 条 ADD CONSTRAINT 会校验引用完整性；若有孤儿行（本表.<col> 指向已删除 users 行），
--       对应 ADD CONSTRAINT 会在校验期失败（被 DO 块 EXCEPTION 兜住跳过，不会中断其它 FK，但该条 FK 不会建立）。
-- 用法：psql "$DATABASE_URL_CLONE" -f packages/database/drizzle-pending-review/20261106150004_fk_orphan_check.sql
-- 判读：任何一行返回 count > 0 即为存在孤儿行，需先清理（见报告）再跑包3，否则该条 FK 静默不建。
-- © 2026 IHUI AI (智汇AI) · 李春川 · https://aizhs.top
-- ============================================================
\echo '=== FK 孤儿行检测（期望全部 count=0）==='
SELECT 'fk_agent_event_triggers_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "agent_event_triggers" t LEFT JOIN "users" r ON t."user_id" = r."id"
  WHERE t."user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_agent_upload_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "agent_upload" t LEFT JOIN "users" r ON t."user_id" = r."id"
  WHERE t."user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_agent_memory_decay_state_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "agent_memory_decay_state" t LEFT JOIN "users" r ON t."user_id" = r."id"
  WHERE t."user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_agent_user_profile_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "agent_user_profile" t LEFT JOIN "users" r ON t."user_id" = r."id"
  WHERE t."user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_agents_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "agents" t LEFT JOIN "users" r ON t."user_id" = r."id"
  WHERE t."user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_agent_examines_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "agent_examines" t LEFT JOIN "users" r ON t."user_id" = r."id"
  WHERE t."user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_analytics_events_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "analytics_events" t LEFT JOIN "users" r ON t."user_id" = r."id"
  WHERE t."user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_clawdbot_permissions_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "clawdbot_permissions" t LEFT JOIN "users" r ON t."user_id" = r."id"
  WHERE t."user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_clawdbot_sessions_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "clawdbot_sessions" t LEFT JOIN "users" r ON t."user_id" = r."id"
  WHERE t."user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_user_coupons_referrer_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "user_coupons" t LEFT JOIN "users" r ON t."referrer_user_id" = r."id"
  WHERE t."referrer_user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_exam_signups_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "exam_signups" t LEFT JOIN "users" r ON t."user_id" = r."id"
  WHERE t."user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_exam_wrong_question_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "exam_wrong_question" t LEFT JOIN "users" r ON t."user_id" = r."id"
  WHERE t."user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_knowledge_cards_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "knowledge_cards" t LEFT JOIN "users" r ON t."user_id" = r."id"
  WHERE t."user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_learn_community_post_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "learn_community_post" t LEFT JOIN "users" r ON t."user_id" = r."id"
  WHERE t."user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_lesson_rate_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "lesson_rate" t LEFT JOIN "users" r ON t."user_id" = r."id"
  WHERE t."user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_langgraph_thread_owners_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "langgraph_thread_owners" t LEFT JOIN "users" r ON t."user_id" = r."id"
  WHERE t."user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_remote_devices_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "remote_devices" t LEFT JOIN "users" r ON t."user_id" = r."id"
  WHERE t."user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_repo_wiki_docs_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "repo_wiki_docs" t LEFT JOIN "users" r ON t."user_id" = r."id"
  WHERE t."user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_resources_owner_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "resources" t LEFT JOIN "users" r ON t."owner_user_id" = r."id"
  WHERE t."owner_user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_resource_downloads_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "resource_downloads" t LEFT JOIN "users" r ON t."user_id" = r."id"
  WHERE t."user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_tbox_device_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "tbox_device" t LEFT JOIN "users" r ON t."user_id" = r."id"
  WHERE t."user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_team_memories_source_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "team_memories" t LEFT JOIN "users" r ON t."source_user_id" = r."id"
  WHERE t."source_user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_tool_favorites_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "tool_favorites" t LEFT JOIN "users" r ON t."user_id" = r."id"
  WHERE t."user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_user_automations_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "user_automations" t LEFT JOIN "users" r ON t."user_id" = r."id"
  WHERE t."user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_user_billing_group_members_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "user_billing_group_members" t LEFT JOIN "users" r ON t."user_id" = r."id"
  WHERE t."user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_user_memories_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "user_memories" t LEFT JOIN "users" r ON t."user_id" = r."id"
  WHERE t."user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_webhook_subscriptions_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "webhook_subscriptions" t LEFT JOIN "users" r ON t."user_id" = r."id"
  WHERE t."user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;
SELECT 'fk_zhs_agent_examine_examine_user_id_users' AS constraint_name, count(*) AS orphan_count
  FROM "zhs_agent_examine" t LEFT JOIN "users" r ON t."examine_user_id" = r."id"
  WHERE t."examine_user_id" IS NOT NULL AND r."id" IS NULL
  HAVING count(*) > 0;

\echo '=== 检测完成：以上无输出(全部 count=0)即无孤儿行，可安全执行包3 ==='
