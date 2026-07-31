-- AI 模型同步日志表(2026-07-31 立,P0 ModelSyncService 持久化)
-- 用途:持久化 ModelSyncService 每次同步的执行结果,供 admin 端点
--       `GET /api/llm/models/sync/history` 查询历史。
--       替代原内存 SyncStatus dataclass(重启丢失历史)。
-- 字段:
--   provider_code    - 同步的 provider 标识(openai / anthropic / deepseek 等)
--   sync_started_at  - 同步开始时间
--   sync_finished_at - 同步结束时间
--   success          - 同步是否成功
--   total_models     - 同步到的模型总数
--   new_models       - 本次新增模型数
--   removed_models   - 本次移除模型数
--   error            - 失败原因(成功时为空字符串)
--   latency_ms       - 同步耗时(毫秒)
--   sync_type        - 同步类型:full=全量 / single=单 provider / dry_run=试运行

CREATE TABLE IF NOT EXISTS ai_model_sync_log (
  id BIGSERIAL PRIMARY KEY,
  provider_code TEXT NOT NULL,
  sync_started_at TIMESTAMPTZ NOT NULL,
  sync_finished_at TIMESTAMPTZ NOT NULL,
  success BOOLEAN NOT NULL,
  total_models INTEGER NOT NULL DEFAULT 0,
  new_models INTEGER NOT NULL DEFAULT 0,
  removed_models INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  latency_ms INTEGER NOT NULL DEFAULT 0,
  sync_type TEXT NOT NULL DEFAULT 'full'
);

CREATE INDEX IF NOT EXISTS idx_ai_model_sync_log_started_at ON ai_model_sync_log(sync_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_model_sync_log_provider ON ai_model_sync_log(provider_code, sync_started_at DESC);
