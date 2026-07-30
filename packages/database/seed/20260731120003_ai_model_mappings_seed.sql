-- 模型映射示例数据(2026-07-31 立,P0-4 降本神器)
-- 3 条全局映射(admin 配置,所有用户生效),用于"偷偷换后端降本"场景
-- user_id = NULL + api_key_id = NULL = 全局映射
-- 幂等插入:重复执行不会报错(ON CONFLICT DO NOTHING)
INSERT INTO ai_model_mappings (user_id, api_key_id, source_model, target_model, priority, enabled)
VALUES
  (NULL, NULL, 'gpt-4o', 'deepseek-chat', 10, true),
  (NULL, NULL, 'gpt-4o-mini', 'step-3.7-flash', 10, true),
  (NULL, NULL, 'claude-3-5-sonnet', 'glm-4-flash', 10, true)
ON CONFLICT DO NOTHING;
