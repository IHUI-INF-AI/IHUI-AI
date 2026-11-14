-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- © 2026 IHUI AI · BUG-29 幂等补齐迁移（离线静态分析生成，全部带 IF NOT EXISTS / DO 守卫）
-- 生成器: scripts/audit-missing-indexes.mjs ；本文件仅补齐，不删除任何既有对象、不改数据。

-- ---------- ① 补齐 schema 声明但迁移链缺失的索引 ----------
CREATE INDEX IF NOT EXISTS "idx_ab_tests_status" ON "agent_ab_tests" (status);
CREATE INDEX IF NOT EXISTS "agent_meta_lessons_user_type_idx" ON "agent_meta_lessons" (user_id, lesson_type);
CREATE INDEX IF NOT EXISTS "idx_agent_meta_lessons_type_title" ON "agent_meta_lessons" (lesson_type, title);
CREATE INDEX IF NOT EXISTS "agent_multimodal_memory_user_idx" ON "agent_multimodal_memory" (user_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='agent_multimodal_memory_hash_uniq') THEN
    BEGIN
      CREATE UNIQUE INDEX "agent_multimodal_memory_hash_uniq" ON "agent_multimodal_memory" (content_hash);
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'BUG-29: 唯一索引 agent_multimodal_memory_hash_uniq 因存量重复行未创建,待 DBA 清理后补建';
    END;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "agent_working_memory_compression_user_idx" ON "agent_working_memory_compression" (user_id);
CREATE INDEX IF NOT EXISTS "ix_chat_messages_created_at" ON "chat_messages" (created_at);
CREATE INDEX IF NOT EXISTS "ix_conversation_message_archives_created_at" ON "conversation_message_archives" (created_at);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='withdrawal_flows_partner_trade_no_uq') THEN
    BEGIN
      CREATE UNIQUE INDEX "withdrawal_flows_partner_trade_no_uq" ON "withdrawal_flows" (partner_trade_no) WHERE partner_trade_no IS NOT NULL;
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'BUG-29: 唯一索引 withdrawal_flows_partner_trade_no_uq 因存量重复行未创建,待 DBA 清理后补建';
    END;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='ux_agent_memory_edges') THEN
    BEGIN
      CREATE UNIQUE INDEX "ux_agent_memory_edges" ON "agent_memory_edges" (user_id, source_id, target_id, relation);
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'BUG-29: 唯一索引 ux_agent_memory_edges 因存量重复行未创建,待 DBA 清理后补建';
    END;
  END IF;
END $$;

-- ---------- ② 为无索引的外键列补单列传索引（列名均来自 schema 源，幂等安全） ----------
CREATE INDEX IF NOT EXISTS "ix_agent_tasks_rule_id" ON "agent_tasks" ("rule_id");
CREATE INDEX IF NOT EXISTS "ix_agent_tasks_created_by" ON "agent_tasks" ("created_by");
CREATE INDEX IF NOT EXISTS "ix_agent_tasks_updated_by" ON "agent_tasks" ("updated_by");
CREATE INDEX IF NOT EXISTS "ix_agreements_published_by" ON "agreements" ("published_by");
CREATE INDEX IF NOT EXISTS "ix_ai_capabilities_author_id" ON "ai_capabilities" ("author_id");
CREATE INDEX IF NOT EXISTS "ix_ai_feed_snapshot_item_id" ON "ai_feed_snapshot" ("item_id");
CREATE INDEX IF NOT EXISTS "ix_ai_feed_trend_signal_item_id" ON "ai_feed_trend_signal" ("item_id");
CREATE INDEX IF NOT EXISTS "ix_ai_relay_discovery_reviewed_by" ON "ai_relay_discovery" ("reviewed_by");
CREATE INDEX IF NOT EXISTS "ix_api_key_shares_shared_with_user_id" ON "api_key_shares" ("shared_with_user_id");
CREATE INDEX IF NOT EXISTS "ix_api_key_shares_created_by" ON "api_key_shares" ("created_by");
CREATE INDEX IF NOT EXISTS "ix_orders_plan_id" ON "orders" ("plan_id");
CREATE INDEX IF NOT EXISTS "ix_orders_created_by" ON "orders" ("created_by");
CREATE INDEX IF NOT EXISTS "ix_orders_updated_by" ON "orders" ("updated_by");
CREATE INDEX IF NOT EXISTS "ix_payments_order_id" ON "payments" ("order_id");
CREATE INDEX IF NOT EXISTS "ix_api_subscriptions_plan_id" ON "api_subscriptions" ("plan_id");
CREATE INDEX IF NOT EXISTS "ix_api_subscriptions_order_id" ON "api_subscriptions" ("order_id");
CREATE INDEX IF NOT EXISTS "ix_canary_audit_logs_config_id" ON "canary_audit_logs" ("config_id");
CREATE INDEX IF NOT EXISTS "ix_chat_conversation_collaborators_invited_by" ON "chat_conversation_collaborators" ("invited_by");
CREATE INDEX IF NOT EXISTS "ix_chat_message_comments_user_id" ON "chat_message_comments" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_chat_context_ledgers_user_id" ON "chat_context_ledgers" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_chat_budget_stops_user_id" ON "chat_budget_stops" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_chat_voice_notes_conversation_id" ON "chat_voice_notes" ("conversation_id");
CREATE INDEX IF NOT EXISTS "ix_chat_message_sync_revs_message_id" ON "chat_message_sync_revs" ("message_id");
CREATE INDEX IF NOT EXISTS "ix_circle_post_comments_reply_user_id" ON "circle_post_comments" ("reply_user_id");
CREATE INDEX IF NOT EXISTS "ix_comments_user_id" ON "comments" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_comment_likes_comment_id" ON "comment_likes" ("comment_id");
CREATE INDEX IF NOT EXISTS "ix_comment_likes_user_id" ON "comment_likes" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_feedbacks_user_id" ON "feedbacks" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_commission_flows_order_id" ON "commission_flows" ("order_id");
CREATE INDEX IF NOT EXISTS "ix_commission_flows_created_by" ON "commission_flows" ("created_by");
CREATE INDEX IF NOT EXISTS "ix_commission_flows_updated_by" ON "commission_flows" ("updated_by");
CREATE INDEX IF NOT EXISTS "ix_withdrawal_flows_created_by" ON "withdrawal_flows" ("created_by");
CREATE INDEX IF NOT EXISTS "ix_withdrawal_flows_updated_by" ON "withdrawal_flows" ("updated_by");
CREATE INDEX IF NOT EXISTS "ix_circles_created_by" ON "circles" ("created_by");
CREATE INDEX IF NOT EXISTS "ix_announcements_created_by" ON "announcements" ("created_by");
CREATE INDEX IF NOT EXISTS "ix_docs_author_id" ON "docs" ("author_id");
CREATE INDEX IF NOT EXISTS "ix_announcement_reads_user_id" ON "announcement_reads" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_announcement_reads_announcement_id" ON "announcement_reads" ("announcement_id");
CREATE INDEX IF NOT EXISTS "ix_crash_reports_user_id" ON "crash_reports" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_customer_service_comments_user_id" ON "customer_service_comments" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_customer_service_agents_user_id" ON "customer_service_agents" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_customer_service_sessions_transferred_to" ON "customer_service_sessions" ("transferred_to");
CREATE INDEX IF NOT EXISTS "ix_customer_service_ratings_user_id" ON "customer_service_ratings" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_customer_service_ratings_agent_id" ON "customer_service_ratings" ("agent_id");
CREATE INDEX IF NOT EXISTS "ix_desktop_prefs_user_id" ON "desktop_prefs" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_developer_subscriptions_pricing_id" ON "developer_subscriptions" ("pricing_id");
CREATE INDEX IF NOT EXISTS "ix_device_tasks_created_by" ON "device_tasks" ("created_by");
CREATE INDEX IF NOT EXISTS "ix_edu_study_plan_creator_id" ON "edu_study_plan" ("creator_id");
CREATE INDEX IF NOT EXISTS "ix_edu_attendance_record_operated_by" ON "edu_attendance_record" ("operated_by");
CREATE INDEX IF NOT EXISTS "ix_edu_leave_request_approver_id" ON "edu_leave_request" ("approver_id");
CREATE INDEX IF NOT EXISTS "ix_edu_exam_score_recorded_by" ON "edu_exam_score" ("recorded_by");
CREATE INDEX IF NOT EXISTS "ix_edu_schedule_change_approver_id" ON "edu_schedule_change" ("approver_id");
CREATE INDEX IF NOT EXISTS "ix_edu_homework_submission_teacher_id" ON "edu_homework_submission" ("teacher_id");
CREATE INDEX IF NOT EXISTS "ix_edu_trial_booking_teacher_id" ON "edu_trial_booking" ("teacher_id");
CREATE INDEX IF NOT EXISTS "ix_edu_enrollment_operator_id" ON "edu_enrollment" ("operator_id");
CREATE INDEX IF NOT EXISTS "ix_edu_payment_record_enrollment_id" ON "edu_payment_record" ("enrollment_id");
CREATE INDEX IF NOT EXISTS "ix_edu_payment_record_operator_id" ON "edu_payment_record" ("operator_id");
CREATE INDEX IF NOT EXISTS "ix_edu_refund_record_enrollment_id" ON "edu_refund_record" ("enrollment_id");
CREATE INDEX IF NOT EXISTS "ix_edu_refund_record_approver_id" ON "edu_refund_record" ("approver_id");
CREATE INDEX IF NOT EXISTS "ix_edu_refund_record_operator_id" ON "edu_refund_record" ("operator_id");
CREATE INDEX IF NOT EXISTS "ix_edu_fee_reminder_class_id" ON "edu_fee_reminder" ("class_id");
CREATE INDEX IF NOT EXISTS "ix_edu_fee_reminder_operator_id" ON "edu_fee_reminder" ("operator_id");
CREATE INDEX IF NOT EXISTS "ix_edu_fee_schedule_class_id" ON "edu_fee_schedule" ("class_id");
CREATE INDEX IF NOT EXISTS "ix_edu_fee_schedule_term_id" ON "edu_fee_schedule" ("term_id");
CREATE INDEX IF NOT EXISTS "ix_edu_fee_schedule_fee_id" ON "edu_fee_schedule" ("fee_id");
CREATE INDEX IF NOT EXISTS "ix_edu_canteen_supplier_created_by" ON "edu_canteen_supplier" ("created_by");
CREATE INDEX IF NOT EXISTS "ix_edu_canteen_procurement_confirmed_by" ON "edu_canteen_procurement" ("confirmed_by");
CREATE INDEX IF NOT EXISTS "ix_edu_canteen_procurement_created_by" ON "edu_canteen_procurement" ("created_by");
CREATE INDEX IF NOT EXISTS "ix_edu_notes_user_id" ON "edu_notes" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_edu_offline_records_user_id" ON "edu_offline_records" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_edu_uploaded_certs_user_id" ON "edu_uploaded_certs" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_edu_uploaded_certs_reviewed_by" ON "edu_uploaded_certs" ("reviewed_by");
CREATE INDEX IF NOT EXISTS "ix_edu_uploaded_papers_user_id" ON "edu_uploaded_papers" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_edu_uploaded_papers_reviewed_by" ON "edu_uploaded_papers" ("reviewed_by");
CREATE INDEX IF NOT EXISTS "ix_exam_papers_category_id" ON "exam_papers" ("category_id");
CREATE INDEX IF NOT EXISTS "ix_exam_papers_created_by" ON "exam_papers" ("created_by");
CREATE INDEX IF NOT EXISTS "ix_file_shares_file_id" ON "file_shares" ("file_id");
CREATE INDEX IF NOT EXISTS "ix_file_shares_shared_by" ON "file_shares" ("shared_by");
CREATE INDEX IF NOT EXISTS "ix_file_shares_shared_with" ON "file_shares" ("shared_with");
CREATE INDEX IF NOT EXISTS "ix_file_versions_uploaded_by" ON "file_versions" ("uploaded_by");
CREATE INDEX IF NOT EXISTS "ix_files_project_id" ON "files" ("project_id");
CREATE INDEX IF NOT EXISTS "ix_files_uploaded_by" ON "files" ("uploaded_by");
CREATE INDEX IF NOT EXISTS "ix_files_deleted_by" ON "files" ("deleted_by");
CREATE INDEX IF NOT EXISTS "ix_sign_in_records_user_id" ON "sign_in_records" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_hr_employee_user_id" ON "hr_employee" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_hr_attendance_record_operated_by" ON "hr_attendance_record" ("operated_by");
CREATE INDEX IF NOT EXISTS "ix_hr_leave_request_approver_id" ON "hr_leave_request" ("approver_id");
CREATE INDEX IF NOT EXISTS "ix_hr_punch_fix_approver_id" ON "hr_punch_fix" ("approver_id");
CREATE INDEX IF NOT EXISTS "ix_lesson_records_chapter_id" ON "lesson_records" ("chapter_id");
CREATE INDEX IF NOT EXISTS "ix_lessons_lecturer_id" ON "lessons" ("lecturer_id");
CREATE INDEX IF NOT EXISTS "ix_lesson_sign_ups_lesson_id" ON "lesson_sign_ups" ("lesson_id");
CREATE INDEX IF NOT EXISTS "ix_edu_members_company_id" ON "edu_members" ("company_id");
CREATE INDEX IF NOT EXISTS "ix_edu_members_department_id" ON "edu_members" ("department_id");
CREATE INDEX IF NOT EXISTS "ix_edu_messages_sender_id" ON "edu_messages" ("sender_id");
CREATE INDEX IF NOT EXISTS "ix_news_articles_author_id" ON "news_articles" ("author_id");
CREATE INDEX IF NOT EXISTS "ix_notification_preferences_user_id" ON "notification_preferences" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_edu_invoice_applications_title_id" ON "edu_invoice_applications" ("title_id");
CREATE INDEX IF NOT EXISTS "ix_oss_drivers_updated_by" ON "oss_drivers" ("updated_by");
CREATE INDEX IF NOT EXISTS "ix_langgraph_writes_checkpoint_id" ON "langgraph_writes" ("checkpoint_id");
CREATE INDEX IF NOT EXISTS "ix_ai_generated_question_created_by" ON "ai_generated_question" ("created_by");
CREATE INDEX IF NOT EXISTS "ix_plugin_events_user_id" ON "plugin_events" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_projects_user_id" ON "projects" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_project_members_project_id" ON "project_members" ("project_id");
CREATE INDEX IF NOT EXISTS "ix_project_members_user_id" ON "project_members" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_invitation_codes_inviter_id" ON "invitation_codes" ("inviter_id");
CREATE INDEX IF NOT EXISTS "ix_invitation_codes_invitee_id" ON "invitation_codes" ("invitee_id");
CREATE INDEX IF NOT EXISTS "ix_activity_participants_activity_id" ON "activity_participants" ("activity_id");
CREATE INDEX IF NOT EXISTS "ix_activity_participants_user_id" ON "activity_participants" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_role_permissions_role_id" ON "role_permissions" ("role_id");
CREATE INDEX IF NOT EXISTS "ix_role_permissions_permission_id" ON "role_permissions" ("permission_id");
CREATE INDEX IF NOT EXISTS "ix_user_roles_user_id" ON "user_roles" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_user_roles_role_id" ON "user_roles" ("role_id");
CREATE INDEX IF NOT EXISTS "ix_redemption_codes_created_by" ON "redemption_codes" ("created_by");
CREATE INDEX IF NOT EXISTS "ix_redemption_codes_used_by" ON "redemption_codes" ("used_by");
CREATE INDEX IF NOT EXISTS "ix_refund_audit_records_order_id" ON "refund_audit_records" ("order_id");
CREATE INDEX IF NOT EXISTS "ix_relay_commission_records_source_call_log_id" ON "relay_commission_records" ("source_call_log_id");
CREATE INDEX IF NOT EXISTS "ix_edu_settings_updated_by" ON "edu_settings" ("updated_by");
CREATE INDEX IF NOT EXISTS "ix_skills_author_id" ON "skills" ("author_id");
CREATE INDEX IF NOT EXISTS "ix_user_follows_follower_id" ON "user_follows" ("follower_id");
CREATE INDEX IF NOT EXISTS "ix_user_follows_following_id" ON "user_follows" ("following_id");
CREATE INDEX IF NOT EXISTS "ix_user_favorites_user_id" ON "user_favorites" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_subscriptions_user_id" ON "subscriptions" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_tags_created_by" ON "tags" ("created_by");
CREATE INDEX IF NOT EXISTS "ix_tag_relations_tag_id" ON "tag_relations" ("tag_id");
CREATE INDEX IF NOT EXISTS "ix_tag_relations_created_by" ON "tag_relations" ("created_by");
CREATE INDEX IF NOT EXISTS "ix_srs_streams_user_id" ON "srs_streams" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_stock_analyses_user_id" ON "stock_analyses" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_system_configs_updated_by" ON "system_configs" ("updated_by");
CREATE INDEX IF NOT EXISTS "ix_api_logs_user_id" ON "api_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_task_messages_created_by" ON "task_messages" ("created_by");
CREATE INDEX IF NOT EXISTS "ix_team_knowledge_spaces_created_by" ON "team_knowledge_spaces" ("created_by");
CREATE INDEX IF NOT EXISTS "ix_team_knowledge_spaces_updated_by" ON "team_knowledge_spaces" ("updated_by");
CREATE INDEX IF NOT EXISTS "ix_team_knowledge_space_members_granted_by" ON "team_knowledge_space_members" ("granted_by");
CREATE INDEX IF NOT EXISTS "ix_team_knowledge_items_created_by" ON "team_knowledge_items" ("created_by");
CREATE INDEX IF NOT EXISTS "ix_team_knowledge_items_updated_by" ON "team_knowledge_items" ("updated_by");
CREATE INDEX IF NOT EXISTS "ix_teams_owner_id" ON "teams" ("owner_id");
CREATE INDEX IF NOT EXISTS "ix_team_members_team_id" ON "team_members" ("team_id");
CREATE INDEX IF NOT EXISTS "ix_team_members_user_id" ON "team_members" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_team_invitations_team_id" ON "team_invitations" ("team_id");
CREATE INDEX IF NOT EXISTS "ix_team_invitations_inviter_id" ON "team_invitations" ("inviter_id");
CREATE INDEX IF NOT EXISTS "ix_team_invitations_invitee_id" ON "team_invitations" ("invitee_id");
CREATE INDEX IF NOT EXISTS "ix_tenants_owner_id" ON "tenants" ("owner_id");
CREATE INDEX IF NOT EXISTS "ix_tenant_members_tenant_id" ON "tenant_members" ("tenant_id");
CREATE INDEX IF NOT EXISTS "ix_tour_content_author_id" ON "tour_content" ("author_id");
CREATE INDEX IF NOT EXISTS "ix_user_auth_info_user_uuid" ON "user_auth_info" ("user_uuid");
CREATE INDEX IF NOT EXISTS "ix_user_vips_vip_level_id" ON "user_vips" ("vip_level_id");
CREATE INDEX IF NOT EXISTS "ix_visit_logs_user_id" ON "visit_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_user_margins_user_id" ON "user_margins" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_wechat_pay_contracts_plan_id" ON "wechat_pay_contracts" ("plan_id");
CREATE INDEX IF NOT EXISTS "ix_wechat_pay_contracts_product_id" ON "wechat_pay_contracts" ("product_id");
CREATE INDEX IF NOT EXISTS "ix_workflows_created_by" ON "workflows" ("created_by");
CREATE INDEX IF NOT EXISTS "ix_workflow_instances_workflow_id" ON "workflow_instances" ("workflow_id");
CREATE INDEX IF NOT EXISTS "ix_workflow_instances_project_id" ON "workflow_instances" ("project_id");
CREATE INDEX IF NOT EXISTS "ix_workflow_tasks_instance_id" ON "workflow_tasks" ("instance_id");
CREATE INDEX IF NOT EXISTS "ix_workflow_logs_instance_id" ON "workflow_logs" ("instance_id");
CREATE INDEX IF NOT EXISTS "ix_workflow_logs_task_id" ON "workflow_logs" ("task_id");
-- ② 实际生成索引语句数: 156

-- ---------- ③ 为无 FK 的 userId 列补外键（DO 块守卫 + EXCEPTION 防脏数据中断） ----------
-- 注意: onDelete 统一用 NO ACTION（最保守，不级联删）。若业务要求 cascade/set null，请 DBA 复核后改。
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
-- ③ 实际生成 FK 语句数: 28

-- ④ 同表两份 DDL 列类型不同: 本迁移不处理（需库级 pg_catalog 核对，见汇报遗留风险）。
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
