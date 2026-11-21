-- ============================================================
-- 包3「诊断版」（2026-11-20 生成）· 与 20261106150003 唯一区别：EXCEPTION 不再静默 NULL，
--   而是 RAISE WARNING 打印每条被跳过的 FK 约束名 + SQLERRM 原因，**不会中断执行**。
-- 用途：在克隆库跑包3 后若部分 FK 未建，先跑本件定位是哪条、什么原因（通常=孤儿数据）。
--   psql "$DATABASE_URL_CLONE" -f packages/database/drizzle-pending-review/20261106150003_fix_missing_fks.diag.sql
-- 判读：看 WARNING 行；若无 WARNING 则全部 28 条 FK 已建成功。
-- ⚠ 本件为诊断用途，正式执行仍用 20261106150003（静默版）；不要把本件入 journal。
-- ============================================================
-- ============================================================
-- BUG-29 补齐迁移 · 包 3/3：为无 FK 的 userId 列补外键（DO 块守卫 + EXCEPTION 防脏数据中断）
-- ALTER ADD CONSTRAINT 不能 CONCURRENTLY，只能串行；建议 psql 执行：
--   psql "$DATABASE_URL" -f packages/database/drizzle-pending-review/20261106150003_fix_missing_fks.sql
-- 已知 fk_resource_downloads_user_id_users：schema 中 user_id 实为 uuid(resource.ts:153)，与 users.id(uuid) 类型兼容、可正常创建，非不兼容兜底项。
--   残余风险仅数据面：若存在孤儿 user_id(指向已删 users 行)会在校验期失败，由本条 DO 块 EXCEPTION 兜住，不影响其它 27 条 FK。
-- onDelete 统一 NO ACTION（最保守），业务需 cascade/set null 请 DBA 复核。
-- ============================================================
-- ⛔ 隔离待审(2026-11-06) · 未 renumber 回 meta/_journal.json，不参与环境迁移。
-- 三包执行顺序: 包1 → 包2 → 包3；须先在生产库状态克隆跑到 rc=0。
-- 本批由 BUG-29 三前置改写生成；不改数据、不删对象。
-- ---------- ③ 为无 FK 的 userId 列补外键（DO 块守卫 + EXCEPTION 防脏数据中断） ----------
-- 注意: onDelete 统一用 NO ACTION（最保守，不级联删）。若业务要求 cascade/set null，请 DBA 复核后改。
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_agent_event_triggers_user_id_users') THEN
    ALTER TABLE "agent_event_triggers" ADD CONSTRAINT "fk_agent_event_triggers_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_agent_event_triggers_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_agent_upload_user_id_users') THEN
    ALTER TABLE "agent_upload" ADD CONSTRAINT "fk_agent_upload_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_agent_upload_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_agent_memory_decay_state_user_id_users') THEN
    ALTER TABLE "agent_memory_decay_state" ADD CONSTRAINT "fk_agent_memory_decay_state_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_agent_memory_decay_state_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_agent_user_profile_user_id_users') THEN
    ALTER TABLE "agent_user_profile" ADD CONSTRAINT "fk_agent_user_profile_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_agent_user_profile_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_agents_user_id_users') THEN
    ALTER TABLE "agents" ADD CONSTRAINT "fk_agents_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_agents_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_agent_examines_user_id_users') THEN
    ALTER TABLE "agent_examines" ADD CONSTRAINT "fk_agent_examines_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_agent_examines_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_analytics_events_user_id_users') THEN
    ALTER TABLE "analytics_events" ADD CONSTRAINT "fk_analytics_events_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_analytics_events_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_clawdbot_permissions_user_id_users') THEN
    ALTER TABLE "clawdbot_permissions" ADD CONSTRAINT "fk_clawdbot_permissions_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_clawdbot_permissions_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_clawdbot_sessions_user_id_users') THEN
    ALTER TABLE "clawdbot_sessions" ADD CONSTRAINT "fk_clawdbot_sessions_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_clawdbot_sessions_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_user_coupons_referrer_user_id_users') THEN
    ALTER TABLE "user_coupons" ADD CONSTRAINT "fk_user_coupons_referrer_user_id_users" FOREIGN KEY ("referrer_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_user_coupons_referrer_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_exam_signups_user_id_users') THEN
    ALTER TABLE "exam_signups" ADD CONSTRAINT "fk_exam_signups_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_exam_signups_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_exam_wrong_question_user_id_users') THEN
    ALTER TABLE "exam_wrong_question" ADD CONSTRAINT "fk_exam_wrong_question_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_exam_wrong_question_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_knowledge_cards_user_id_users') THEN
    ALTER TABLE "knowledge_cards" ADD CONSTRAINT "fk_knowledge_cards_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_knowledge_cards_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_learn_community_post_user_id_users') THEN
    ALTER TABLE "learn_community_post" ADD CONSTRAINT "fk_learn_community_post_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_learn_community_post_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_lesson_rate_user_id_users') THEN
    ALTER TABLE "lesson_rate" ADD CONSTRAINT "fk_lesson_rate_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_lesson_rate_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_langgraph_thread_owners_user_id_users') THEN
    ALTER TABLE "langgraph_thread_owners" ADD CONSTRAINT "fk_langgraph_thread_owners_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_langgraph_thread_owners_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_remote_devices_user_id_users') THEN
    ALTER TABLE "remote_devices" ADD CONSTRAINT "fk_remote_devices_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_remote_devices_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_repo_wiki_docs_user_id_users') THEN
    ALTER TABLE "repo_wiki_docs" ADD CONSTRAINT "fk_repo_wiki_docs_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_repo_wiki_docs_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_resources_owner_user_id_users') THEN
    ALTER TABLE "resources" ADD CONSTRAINT "fk_resources_owner_user_id_users" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_resources_owner_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_resource_downloads_user_id_users') THEN
    ALTER TABLE "resource_downloads" ADD CONSTRAINT "fk_resource_downloads_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_resource_downloads_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_tbox_device_user_id_users') THEN
    ALTER TABLE "tbox_device" ADD CONSTRAINT "fk_tbox_device_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_tbox_device_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_team_memories_source_user_id_users') THEN
    ALTER TABLE "team_memories" ADD CONSTRAINT "fk_team_memories_source_user_id_users" FOREIGN KEY ("source_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_team_memories_source_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_tool_favorites_user_id_users') THEN
    ALTER TABLE "tool_favorites" ADD CONSTRAINT "fk_tool_favorites_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_tool_favorites_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_user_automations_user_id_users') THEN
    ALTER TABLE "user_automations" ADD CONSTRAINT "fk_user_automations_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_user_automations_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_user_billing_group_members_user_id_users') THEN
    ALTER TABLE "user_billing_group_members" ADD CONSTRAINT "fk_user_billing_group_members_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_user_billing_group_members_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_user_memories_user_id_users') THEN
    ALTER TABLE "user_memories" ADD CONSTRAINT "fk_user_memories_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_user_memories_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_webhook_subscriptions_user_id_users') THEN
    ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "fk_webhook_subscriptions_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_webhook_subscriptions_user_id_users', SQLERRM; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_zhs_agent_examine_examine_user_id_users') THEN
    ALTER TABLE "zhs_agent_examine" ADD CONSTRAINT "fk_zhs_agent_examine_examine_user_id_users" FOREIGN KEY ("examine_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN RAISE WARNING 'BUG-29 诊断: FK % 被跳过(多为孤儿数据/类型问题): %', 'fk_zhs_agent_examine_examine_user_id_users', SQLERRM; END $$;
-- ③ 实际生成 FK 语句数: 28
