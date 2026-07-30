-- prompt cache 折扣计费(2026-07-31 立)
-- 1) llm_call_logs 加 2 字段:
--    - cache_read_tokens: prompt cache 命中读取的 token 数(按 10% 价计费,OpenAI/Claude 标准)
--    - cache_creation_tokens: prompt cache 创建写入的 token 数(按 125% 价计费)
-- 背景:原实现按全价计费,导致用户多付 10 倍(cache hit 部分应按 10% 计费)。
-- 幂等:ALTER 前检查字段是否存在(IF NOT EXISTS)。

-- =============================================================================
-- llm_call_logs 加 cache_read_tokens / cache_creation_tokens 字段
-- =============================================================================
ALTER TABLE llm_call_logs ADD COLUMN IF NOT EXISTS cache_read_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE llm_call_logs ADD COLUMN IF NOT EXISTS cache_creation_tokens INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN llm_call_logs.cache_read_tokens IS 'prompt cache 命中读取的 token 数(按 input price × 0.1 计费)';
COMMENT ON COLUMN llm_call_logs.cache_creation_tokens IS 'prompt cache 创建写入的 token 数(按 input price × 1.25 计费)';
