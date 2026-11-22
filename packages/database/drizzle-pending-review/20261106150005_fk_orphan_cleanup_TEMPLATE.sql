-- ============================================================
-- BUG-29 FK 孤儿行清理模板（2026-11-20 生成）
-- 前置：先跑 20261106150004_fk_orphan_check.sql，对返回 orphan_count>0 的表用本模板处置。
-- ⚠ 数据处置有破坏性，**必须在生产克隆库验证 + 机主业务确认后**才在生产执行；本模板默认注释掉写操作。
-- 两种处置策略（按业务语义选一）：
--   A. 置空（仅当列允许 NULL 时可行）：孤儿行 .<col> 设为 NULL，保留业务行，FK 可建；
--   B. 删除孤儿行：删除引用了不存在 users 的悬挂行。
-- © 2026 IHUI AI (智汇AI) · 李春川 · https://aizhs.top
-- ============================================================
-- [agent_event_triggers.user_id]
-- 检测: SELECT count(*) FROM "agent_event_triggers" t LEFT JOIN "users" r ON t."user_id"=r."id" WHERE t."user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "agent_event_triggers" t SET "user_id"=NULL WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");
-- 处置B(删孤儿行): DELETE FROM "agent_event_triggers" t WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");

-- [agent_upload.user_id]
-- 检测: SELECT count(*) FROM "agent_upload" t LEFT JOIN "users" r ON t."user_id"=r."id" WHERE t."user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "agent_upload" t SET "user_id"=NULL WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");
-- 处置B(删孤儿行): DELETE FROM "agent_upload" t WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");

-- [agent_memory_decay_state.user_id]
-- 检测: SELECT count(*) FROM "agent_memory_decay_state" t LEFT JOIN "users" r ON t."user_id"=r."id" WHERE t."user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "agent_memory_decay_state" t SET "user_id"=NULL WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");
-- 处置B(删孤儿行): DELETE FROM "agent_memory_decay_state" t WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");

-- [agent_user_profile.user_id]
-- 检测: SELECT count(*) FROM "agent_user_profile" t LEFT JOIN "users" r ON t."user_id"=r."id" WHERE t."user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "agent_user_profile" t SET "user_id"=NULL WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");
-- 处置B(删孤儿行): DELETE FROM "agent_user_profile" t WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");

-- [agents.user_id]
-- 检测: SELECT count(*) FROM "agents" t LEFT JOIN "users" r ON t."user_id"=r."id" WHERE t."user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "agents" t SET "user_id"=NULL WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");
-- 处置B(删孤儿行): DELETE FROM "agents" t WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");

-- [agent_examines.user_id]
-- 检测: SELECT count(*) FROM "agent_examines" t LEFT JOIN "users" r ON t."user_id"=r."id" WHERE t."user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "agent_examines" t SET "user_id"=NULL WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");
-- 处置B(删孤儿行): DELETE FROM "agent_examines" t WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");

-- [analytics_events.user_id]
-- 检测: SELECT count(*) FROM "analytics_events" t LEFT JOIN "users" r ON t."user_id"=r."id" WHERE t."user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "analytics_events" t SET "user_id"=NULL WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");
-- 处置B(删孤儿行): DELETE FROM "analytics_events" t WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");

-- [clawdbot_permissions.user_id]
-- 检测: SELECT count(*) FROM "clawdbot_permissions" t LEFT JOIN "users" r ON t."user_id"=r."id" WHERE t."user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "clawdbot_permissions" t SET "user_id"=NULL WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");
-- 处置B(删孤儿行): DELETE FROM "clawdbot_permissions" t WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");

-- [clawdbot_sessions.user_id]
-- 检测: SELECT count(*) FROM "clawdbot_sessions" t LEFT JOIN "users" r ON t."user_id"=r."id" WHERE t."user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "clawdbot_sessions" t SET "user_id"=NULL WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");
-- 处置B(删孤儿行): DELETE FROM "clawdbot_sessions" t WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");

-- [user_coupons.referrer_user_id]
-- 检测: SELECT count(*) FROM "user_coupons" t LEFT JOIN "users" r ON t."referrer_user_id"=r."id" WHERE t."referrer_user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "user_coupons" t SET "referrer_user_id"=NULL WHERE t."referrer_user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."referrer_user_id");
-- 处置B(删孤儿行): DELETE FROM "user_coupons" t WHERE t."referrer_user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."referrer_user_id");

-- [exam_signups.user_id]
-- 检测: SELECT count(*) FROM "exam_signups" t LEFT JOIN "users" r ON t."user_id"=r."id" WHERE t."user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "exam_signups" t SET "user_id"=NULL WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");
-- 处置B(删孤儿行): DELETE FROM "exam_signups" t WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");

-- [exam_wrong_question.user_id]
-- 检测: SELECT count(*) FROM "exam_wrong_question" t LEFT JOIN "users" r ON t."user_id"=r."id" WHERE t."user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "exam_wrong_question" t SET "user_id"=NULL WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");
-- 处置B(删孤儿行): DELETE FROM "exam_wrong_question" t WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");

-- [knowledge_cards.user_id]
-- 检测: SELECT count(*) FROM "knowledge_cards" t LEFT JOIN "users" r ON t."user_id"=r."id" WHERE t."user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "knowledge_cards" t SET "user_id"=NULL WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");
-- 处置B(删孤儿行): DELETE FROM "knowledge_cards" t WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");

-- [learn_community_post.user_id]
-- 检测: SELECT count(*) FROM "learn_community_post" t LEFT JOIN "users" r ON t."user_id"=r."id" WHERE t."user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "learn_community_post" t SET "user_id"=NULL WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");
-- 处置B(删孤儿行): DELETE FROM "learn_community_post" t WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");

-- [lesson_rate.user_id]
-- 检测: SELECT count(*) FROM "lesson_rate" t LEFT JOIN "users" r ON t."user_id"=r."id" WHERE t."user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "lesson_rate" t SET "user_id"=NULL WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");
-- 处置B(删孤儿行): DELETE FROM "lesson_rate" t WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");

-- [langgraph_thread_owners.user_id]
-- 检测: SELECT count(*) FROM "langgraph_thread_owners" t LEFT JOIN "users" r ON t."user_id"=r."id" WHERE t."user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "langgraph_thread_owners" t SET "user_id"=NULL WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");
-- 处置B(删孤儿行): DELETE FROM "langgraph_thread_owners" t WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");

-- [remote_devices.user_id]
-- 检测: SELECT count(*) FROM "remote_devices" t LEFT JOIN "users" r ON t."user_id"=r."id" WHERE t."user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "remote_devices" t SET "user_id"=NULL WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");
-- 处置B(删孤儿行): DELETE FROM "remote_devices" t WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");

-- [repo_wiki_docs.user_id]
-- 检测: SELECT count(*) FROM "repo_wiki_docs" t LEFT JOIN "users" r ON t."user_id"=r."id" WHERE t."user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "repo_wiki_docs" t SET "user_id"=NULL WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");
-- 处置B(删孤儿行): DELETE FROM "repo_wiki_docs" t WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");

-- [resources.owner_user_id]
-- 检测: SELECT count(*) FROM "resources" t LEFT JOIN "users" r ON t."owner_user_id"=r."id" WHERE t."owner_user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "resources" t SET "owner_user_id"=NULL WHERE t."owner_user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."owner_user_id");
-- 处置B(删孤儿行): DELETE FROM "resources" t WHERE t."owner_user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."owner_user_id");

-- [resource_downloads.user_id]
-- 检测: SELECT count(*) FROM "resource_downloads" t LEFT JOIN "users" r ON t."user_id"=r."id" WHERE t."user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "resource_downloads" t SET "user_id"=NULL WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");
-- 处置B(删孤儿行): DELETE FROM "resource_downloads" t WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");

-- [tbox_device.user_id]
-- 检测: SELECT count(*) FROM "tbox_device" t LEFT JOIN "users" r ON t."user_id"=r."id" WHERE t."user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "tbox_device" t SET "user_id"=NULL WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");
-- 处置B(删孤儿行): DELETE FROM "tbox_device" t WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");

-- [team_memories.source_user_id]
-- 检测: SELECT count(*) FROM "team_memories" t LEFT JOIN "users" r ON t."source_user_id"=r."id" WHERE t."source_user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "team_memories" t SET "source_user_id"=NULL WHERE t."source_user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."source_user_id");
-- 处置B(删孤儿行): DELETE FROM "team_memories" t WHERE t."source_user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."source_user_id");

-- [tool_favorites.user_id]
-- 检测: SELECT count(*) FROM "tool_favorites" t LEFT JOIN "users" r ON t."user_id"=r."id" WHERE t."user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "tool_favorites" t SET "user_id"=NULL WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");
-- 处置B(删孤儿行): DELETE FROM "tool_favorites" t WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");

-- [user_automations.user_id]
-- 检测: SELECT count(*) FROM "user_automations" t LEFT JOIN "users" r ON t."user_id"=r."id" WHERE t."user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "user_automations" t SET "user_id"=NULL WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");
-- 处置B(删孤儿行): DELETE FROM "user_automations" t WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");

-- [user_billing_group_members.user_id]
-- 检测: SELECT count(*) FROM "user_billing_group_members" t LEFT JOIN "users" r ON t."user_id"=r."id" WHERE t."user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "user_billing_group_members" t SET "user_id"=NULL WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");
-- 处置B(删孤儿行): DELETE FROM "user_billing_group_members" t WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");

-- [user_memories.user_id]
-- 检测: SELECT count(*) FROM "user_memories" t LEFT JOIN "users" r ON t."user_id"=r."id" WHERE t."user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "user_memories" t SET "user_id"=NULL WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");
-- 处置B(删孤儿行): DELETE FROM "user_memories" t WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");

-- [webhook_subscriptions.user_id]
-- 检测: SELECT count(*) FROM "webhook_subscriptions" t LEFT JOIN "users" r ON t."user_id"=r."id" WHERE t."user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "webhook_subscriptions" t SET "user_id"=NULL WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");
-- 处置B(删孤儿行): DELETE FROM "webhook_subscriptions" t WHERE t."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."user_id");

-- [zhs_agent_examine.examine_user_id]
-- 检测: SELECT count(*) FROM "zhs_agent_examine" t LEFT JOIN "users" r ON t."examine_user_id"=r."id" WHERE t."examine_user_id" IS NOT NULL AND r."id" IS NULL;
-- 处置A(置空,列须nullable): UPDATE "zhs_agent_examine" t SET "examine_user_id"=NULL WHERE t."examine_user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."examine_user_id");
-- 处置B(删孤儿行): DELETE FROM "zhs_agent_examine" t WHERE t."examine_user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "users" r WHERE r."id"=t."examine_user_id");

