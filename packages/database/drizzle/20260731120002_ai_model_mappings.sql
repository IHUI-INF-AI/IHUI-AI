-- 模型映射表(2026-07-31 立,P0-4 降本神器)
-- 全局/用户/Key 三级映射:source_model → target_model
-- 优先级:Key 级 > 用户级 > 全局,同级别按 priority desc + created_at asc
CREATE TABLE IF NOT EXISTS ai_model_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES developer_api_keys(id) ON DELETE CASCADE,
  source_model VARCHAR(128) NOT NULL,
  target_model VARCHAR(128) NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- 同一作用域内 source_model 唯一(全局/用户/Key 各自唯一)
-- 注意:PostgreSQL 中 NULL != NULL,unique 约束允许多个 (NULL, NULL, same_source) 行(全局映射可多条不同 priority)
CREATE UNIQUE INDEX IF NOT EXISTS ai_model_mappings_scope_unique ON ai_model_mappings(user_id, api_key_id, source_model);
CREATE INDEX IF NOT EXISTS ai_model_mappings_source_idx ON ai_model_mappings(source_model);
CREATE INDEX IF NOT EXISTS ai_model_mappings_user_idx ON ai_model_mappings(user_id);
CREATE INDEX IF NOT EXISTS ai_model_mappings_api_key_idx ON ai_model_mappings(api_key_id);
