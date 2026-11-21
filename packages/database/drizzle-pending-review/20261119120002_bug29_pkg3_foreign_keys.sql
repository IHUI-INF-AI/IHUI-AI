-- BUG-29 入链准备 包 3/3:为无 FK 的 userId 列补外键(DO 块守卫 + EXCEPTION 防脏数据中断)
-- 拆自 20261106150000_fix_missing_indexes_fks.sql(隔离待审件),按三前置改写:
--   ① 按包分批 —— 本件单跑,失败不连坐其它两件;
--   ② FK 用 DO+EXCEPTION(IF NOT EXISTS 守卫 + 脏数据不中断),与索引包分件使 FK 失败不连坐索引
--   ③ 执行通道 —— 本件**不进 drizzle journal**。CONCURRENTLY 不能在事务块内跑,
--     而 drizzle-kit migrate 在事务内跑迁移 ⇒ 本件只能由 DBA 用 psql 在事务外逐件执行:
--       psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <本件>
--     每件跑到 rc=0 才继续下一件;三件全绿后由机主决定是否 renumber 回 journal。
-- 幂等:全部 IF NOT EXISTS / DO+EXCEPTION 守卫,可重复执行。
-- 共 28 条对象。本件只补齐,不删除任何既有对象、不改数据。
-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_agent_event_triggers_user_id_users') THEN
    ALTER TABLE "agent_event_triggers" ADD CONSTRAINT "fk_agent_event_triggers_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_agent_upload_user_id_users') THEN
    ALTER TABLE "agent_upload" ADD CONSTRAINT "fk_agent_upload_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_agent_memory_decay_state_user_id_users') THEN
    ALTER TABLE "agent_memory_decay_state" ADD CONSTRAINT "fk_agent_memory_decay_state_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_agent_user_profile_user_id_users') THEN
    ALTER TABLE "agent_user_profile" ADD CONSTRAINT "fk_agent_user_profile_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_agents_user_id_users') THEN
    ALTER TABLE "agents" ADD CONSTRAINT "fk_agents_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_agent_examines_user_id_users') THEN
    ALTER TABLE "agent_examines" ADD CONSTRAINT "fk_agent_examines_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_analytics_events_user_id_users') THEN
    ALTER TABLE "analytics_events" ADD CONSTRAINT "fk_analytics_events_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_clawdbot_permissions_user_id_users') THEN
    ALTER TABLE "clawdbot_permissions" ADD CONSTRAINT "fk_clawdbot_permissions_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_clawdbot_sessions_user_id_users') THEN
    ALTER TABLE "clawdbot_sessions" ADD CONSTRAINT "fk_clawdbot_sessions_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_user_coupons_referrer_user_id_users') THEN
    ALTER TABLE "user_coupons" ADD CONSTRAINT "fk_user_coupons_referrer_user_id_users" FOREIGN KEY ("referrer_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_exam_signups_user_id_users') THEN
    ALTER TABLE "exam_signups" ADD CONSTRAINT "fk_exam_signups_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_exam_wrong_question_user_id_users') THEN
    ALTER TABLE "exam_wrong_question" ADD CONSTRAINT "fk_exam_wrong_question_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_knowledge_cards_user_id_users') THEN
    ALTER TABLE "knowledge_cards" ADD CONSTRAINT "fk_knowledge_cards_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_learn_community_post_user_id_users') THEN
    ALTER TABLE "learn_community_post" ADD CONSTRAINT "fk_learn_community_post_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_lesson_rate_user_id_users') THEN
    ALTER TABLE "lesson_rate" ADD CONSTRAINT "fk_lesson_rate_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_langgraph_thread_owners_user_id_users') THEN
    ALTER TABLE "langgraph_thread_owners" ADD CONSTRAINT "fk_langgraph_thread_owners_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_remote_devices_user_id_users') THEN
    ALTER TABLE "remote_devices" ADD CONSTRAINT "fk_remote_devices_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_repo_wiki_docs_user_id_users') THEN
    ALTER TABLE "repo_wiki_docs" ADD CONSTRAINT "fk_repo_wiki_docs_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_resources_owner_user_id_users') THEN
    ALTER TABLE "resources" ADD CONSTRAINT "fk_resources_owner_user_id_users" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_resource_downloads_user_id_users') THEN
    ALTER TABLE "resource_downloads" ADD CONSTRAINT "fk_resource_downloads_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_tbox_device_user_id_users') THEN
    ALTER TABLE "tbox_device" ADD CONSTRAINT "fk_tbox_device_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_team_memories_source_user_id_users') THEN
    ALTER TABLE "team_memories" ADD CONSTRAINT "fk_team_memories_source_user_id_users" FOREIGN KEY ("source_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_tool_favorites_user_id_users') THEN
    ALTER TABLE "tool_favorites" ADD CONSTRAINT "fk_tool_favorites_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_user_automations_user_id_users') THEN
    ALTER TABLE "user_automations" ADD CONSTRAINT "fk_user_automations_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_user_billing_group_members_user_id_users') THEN
    ALTER TABLE "user_billing_group_members" ADD CONSTRAINT "fk_user_billing_group_members_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_user_memories_user_id_users') THEN
    ALTER TABLE "user_memories" ADD CONSTRAINT "fk_user_memories_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_webhook_subscriptions_user_id_users') THEN
    ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "fk_webhook_subscriptions_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_zhs_agent_examine_examine_user_id_users') THEN
    ALTER TABLE "zhs_agent_examine" ADD CONSTRAINT "fk_zhs_agent_examine_examine_user_id_users" FOREIGN KEY ("examine_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

-- 包3 实际生成 FK 语句数: 28
