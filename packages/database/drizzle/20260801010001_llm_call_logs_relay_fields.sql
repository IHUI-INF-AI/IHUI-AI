-- P0 中转站造血能力对标批次第一批(2026-08-01):llm_call_logs 补 8 字段+索引
-- 背景:5 项上层功能(渠道统计/高级筛选/Dashboard/Webhook/返佣)依赖这些字段,
--   原表只有 userId/model/status 索引,无法按 API Key/provider/IP/HTTP 状态聚合。
-- 幂等:ALTER 前检查字段是否存在(IF NOT EXISTS),CREATE INDEX IF NOT EXISTS。
-- 向后兼容:8 字段全部可空(老数据 NULL),不破坏现有写入。

-- =============================================================================
-- llm_call_logs 加 8 个审计/统计字段
-- =============================================================================
ALTER TABLE llm_call_logs ADD COLUMN IF NOT EXISTS api_key_id uuid;
ALTER TABLE llm_call_logs ADD COLUMN IF NOT EXISTS provider_code varchar(32);
ALTER TABLE llm_call_logs ADD COLUMN IF NOT EXISTS config_id uuid;
ALTER TABLE llm_call_logs ADD COLUMN IF NOT EXISTS key_pool_id uuid;
ALTER TABLE llm_call_logs ADD COLUMN IF NOT EXISTS client_ip varchar(45);
ALTER TABLE llm_call_logs ADD COLUMN IF NOT EXISTS cost_cents integer;
ALTER TABLE llm_call_logs ADD COLUMN IF NOT EXISTS http_status integer;
ALTER TABLE llm_call_logs ADD COLUMN IF NOT EXISTS ttft_ms integer;

COMMENT ON COLUMN llm_call_logs.api_key_id IS '调用所用 API Key id(关联 developer_api_keys.id)';
COMMENT ON COLUMN llm_call_logs.provider_code IS '上游 provider 代码(如 openai/anthropic/stepfun)';
COMMENT ON COLUMN llm_call_logs.config_id IS '所用模型配置 id(关联 ai_model_config.id)';
COMMENT ON COLUMN llm_call_logs.key_pool_id IS '所用 key 池条目 id(关联 ai_relay_key_pool.id)';
COMMENT ON COLUMN llm_call_logs.client_ip IS '调用方 IP(支持 IPv4/IPv6)';
COMMENT ON COLUMN llm_call_logs.cost_cents IS '本次调用总成本(分,= input + output + cacheRead + cacheCreation)';
COMMENT ON COLUMN llm_call_logs.http_status IS '上游 HTTP 状态码(如 200/429/500)';
COMMENT ON COLUMN llm_call_logs.ttft_ms IS 'Time To First Token 毫秒数(首 token 耗时,流式才有)';

-- =============================================================================
-- 索引(支持渠道统计/高级筛选/Dashboard 按 apiKey/provider/clientIp/httpStatus 聚合)
-- 注意:llm_call_logs_created_at_idx 已在早期迁移创建,此处不重复
-- =============================================================================
CREATE INDEX IF NOT EXISTS llm_call_logs_api_key_idx ON llm_call_logs(api_key_id);
CREATE INDEX IF NOT EXISTS llm_call_logs_provider_idx ON llm_call_logs(provider_code);
CREATE INDEX IF NOT EXISTS llm_call_logs_client_ip_idx ON llm_call_logs(client_ip);
CREATE INDEX IF NOT EXISTS llm_call_logs_http_status_idx ON llm_call_logs(http_status);
