-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-- BUG-29 索引补齐迁移: FK 列无索引（第 1 格，32 条）
-- 仅追加缺失索引，不改既有列类型

CREATE INDEX IF NOT EXISTS idx_agent_user_profile_user_id ON "agent_user_profile" ("user_id");
CREATE INDEX IF NOT EXISTS idx_codebase_chunks_owner_uuid ON "codebase_chunks" ("owner_uuid");
CREATE INDEX IF NOT EXISTS idx_commission_flows_invited_user_id ON "commission_flows" ("invited_user_id");
CREATE INDEX IF NOT EXISTS idx_user_coupons_referrer_user_id ON "user_coupons" ("referrer_user_id");
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON "devices" ("user_id");
CREATE INDEX IF NOT EXISTS idx_device_pair_codes_user_id ON "device_pair_codes" ("user_id");
CREATE INDEX IF NOT EXISTS idx_device_tasks_target_device_id ON "device_tasks" ("target_device_id");
CREATE INDEX IF NOT EXISTS idx_edu_attendance_rule_class_id ON "edu_attendance_rule" ("class_id");
CREATE INDEX IF NOT EXISTS idx_hr_department_parent_id ON "hr_department" ("parent_id");
CREATE INDEX IF NOT EXISTS idx_hr_employee_department_id ON "hr_employee" ("department_id");
CREATE INDEX IF NOT EXISTS idx_hr_attendance_rule_department_id ON "hr_attendance_rule" ("department_id");
CREATE INDEX IF NOT EXISTS idx_hr_attendance_record_employee_id ON "hr_attendance_record" ("employee_id");
CREATE INDEX IF NOT EXISTS idx_hr_attendance_record_department_id ON "hr_attendance_record" ("department_id");
CREATE INDEX IF NOT EXISTS idx_hr_leave_request_employee_id ON "hr_leave_request" ("employee_id");
CREATE INDEX IF NOT EXISTS idx_hr_leave_request_department_id ON "hr_leave_request" ("department_id");
CREATE INDEX IF NOT EXISTS idx_hr_employee_link_request_employee_id ON "hr_employee_link_request" ("employee_id");
CREATE INDEX IF NOT EXISTS idx_hr_employee_link_request_user_id ON "hr_employee_link_request" ("user_id");
CREATE INDEX IF NOT EXISTS idx_hr_employee_link_request_invited_by ON "hr_employee_link_request" ("invited_by");
CREATE INDEX IF NOT EXISTS idx_knowledge_cards_user_id ON "knowledge_cards" ("user_id");
CREATE INDEX IF NOT EXISTS idx_oauth_apps_owner_uuid ON "oauth_apps" ("owner_uuid");
CREATE INDEX IF NOT EXISTS idx_langgraph_thread_owners_user_id ON "langgraph_thread_owners" ("user_id");
CREATE INDEX IF NOT EXISTS idx_repo_wiki_docs_user_id ON "repo_wiki_docs" ("user_id");
CREATE INDEX IF NOT EXISTS idx_resources_owner_user_id ON "resources" ("owner_user_id");
CREATE INDEX IF NOT EXISTS idx_team_knowledge_spaces_team_id ON "team_knowledge_spaces" ("team_id");
CREATE INDEX IF NOT EXISTS idx_team_knowledge_space_members_space_id ON "team_knowledge_space_members" ("space_id");
CREATE INDEX IF NOT EXISTS idx_team_knowledge_space_members_user_id ON "team_knowledge_space_members" ("user_id");
CREATE INDEX IF NOT EXISTS idx_team_knowledge_items_space_id ON "team_knowledge_items" ("space_id");
CREATE INDEX IF NOT EXISTS idx_team_knowledge_revisions_item_id ON "team_knowledge_revisions" ("item_id");
CREATE INDEX IF NOT EXISTS idx_team_knowledge_revisions_actor_user_id ON "team_knowledge_revisions" ("actor_user_id");
CREATE INDEX IF NOT EXISTS idx_team_memories_source_user_id ON "team_memories" ("source_user_id");
CREATE INDEX IF NOT EXISTS idx_tool_favorites_user_id ON "tool_favorites" ("user_id");
CREATE INDEX IF NOT EXISTS idx_user_billing_group_members_user_id ON "user_billing_group_members" ("user_id");
