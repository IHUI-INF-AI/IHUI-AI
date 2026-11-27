-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
--
-- 总管智能体 · 统一智能体注册表(2026-11-27 立,F1 数据地基)
--
-- 一次新建 5 张表,彼此以创建顺序满足外键依赖:
--   agent_definitions → agent_definition_versions → agent_runs → agent_run_events
--   agent_management_approvals(definition_id 刻意不设 FK,purge 后仍保留审批证据)
--
-- 关键取舍(与 01-深化设计规格书 §3 对齐):
--   1. 作用域三选一用 CHECK 收口,不用三张表;is_builtin 只能是 system 档。
--   2. 软删必须 deleted_at + purge_after 同时存在,非 deleted 必须同时为空。
--   3. 名称唯一性按作用域拆三条部分唯一索引:个人(owner,name)、团队(team,name)排除软删;
--      系统(name)按 scope='system' 收口,系统名是保留名,软删后也不给复用。
--   4. team_id → teams(id) ON DELETE RESTRICT(不是 agent_teams):团队解散前必须先处置定义,
--      否则 SET NULL 会把 scope='team' 的行打成违反 CHECK 的孤儿。
--   5. market_agent_id → agents(agent_id) ON DELETE SET NULL:商品下架只解链,不删定义。
--   6. 运行账本 definition_id 可空 SET NULL:purge 定义后历史统计仍留;版本/名称走快照列。
--   7. 事件 (run_id,seq) 唯一:重复上报幂等;payload ≤16KB 截断在服务层,DB 只存 JSONB。
--   8. 审批 definition_id 不设 FK;precheck_token_hash / impact_hash 只存 SHA-256。
--
-- 回滚:packages/database/scripts/rollback-agent-registry.mjs
--   顺序 approvals → events → runs → versions → definitions。
--

CREATE TABLE IF NOT EXISTS "agent_definitions" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_user_id"     uuid REFERENCES "users" ("id") ON DELETE CASCADE,
  "team_id"           uuid REFERENCES "teams" ("id") ON DELETE RESTRICT,
  "scope"             varchar(16) NOT NULL,
  "name"              varchar(64) NOT NULL,
  "display_name"      varchar(100) NOT NULL,
  "description"       text DEFAULT '' NOT NULL,
  "role"              varchar(32) DEFAULT 'custom' NOT NULL,
  "system_prompt"     text DEFAULT '' NOT NULL,
  "prompt_version"    integer DEFAULT 1 NOT NULL,
  "model"             varchar(100),
  "temperature"       numeric(3, 2) DEFAULT 0.70 NOT NULL,
  "max_tokens"        integer,
  "tools"             jsonb DEFAULT '[]'::jsonb NOT NULL,
  "skills"            jsonb DEFAULT '[]'::jsonb NOT NULL,
  "permissions"       jsonb DEFAULT '{}'::jsonb NOT NULL,
  "memory_policy"     jsonb DEFAULT '{}'::jsonb NOT NULL,
  "budget"            jsonb DEFAULT '{}'::jsonb NOT NULL,
  "concurrency_limit" integer DEFAULT 2 NOT NULL,
  "status"            varchar(16) DEFAULT 'active' NOT NULL,
  "is_builtin"        boolean DEFAULT false NOT NULL,
  "is_dispatchable"   boolean DEFAULT true NOT NULL,
  "market_agent_id"   uuid REFERENCES "agents" ("agent_id") ON DELETE SET NULL,
  "metadata"          jsonb DEFAULT '{}'::jsonb NOT NULL,
  "version"           integer DEFAULT 1 NOT NULL,
  "created_by"        uuid REFERENCES "users" ("id") ON DELETE SET NULL,
  "updated_by"        uuid REFERENCES "users" ("id") ON DELETE SET NULL,
  "created_at"        timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"        timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at"        timestamp with time zone,
  "purge_after"       timestamp with time zone,
  CONSTRAINT "ck_agent_def_scope" CHECK (
    ("scope" = 'system'   AND "owner_user_id" IS NULL AND "team_id" IS NULL)
    OR ("scope" = 'personal' AND "owner_user_id" IS NOT NULL AND "team_id" IS NULL)
    OR ("scope" = 'team'     AND "owner_user_id" IS NOT NULL AND "team_id" IS NOT NULL)
  ),
  CONSTRAINT "ck_agent_def_scope_value" CHECK ("scope" in ('system', 'personal', 'team')),
  CONSTRAINT "ck_agent_def_name" CHECK ("name" ~ '^[a-z0-9][a-z0-9_-]{0,31}$'),
  CONSTRAINT "ck_agent_def_builtin" CHECK (NOT "is_builtin" OR "scope" = 'system'),
  CONSTRAINT "ck_agent_def_deleted" CHECK (
    ("status" = 'deleted' AND "deleted_at" IS NOT NULL AND "purge_after" IS NOT NULL)
    OR ("status" <> 'deleted' AND "deleted_at" IS NULL AND "purge_after" IS NULL)
  ),
  CONSTRAINT "ck_agent_def_status_value" CHECK ("status" in ('active', 'disabled', 'deleted')),
  CONSTRAINT "ck_agent_def_temperature" CHECK ("temperature" between 0 and 2),
  CONSTRAINT "ck_agent_def_max_tokens" CHECK ("max_tokens" between 1 and 200000),
  CONSTRAINT "ck_agent_def_concurrency" CHECK ("concurrency_limit" between 1 and 8),
  CONSTRAINT "ck_agent_def_version" CHECK ("version" > 0),
  CONSTRAINT "ck_agent_def_prompt_version" CHECK ("prompt_version" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_agent_def_personal_name"
  ON "agent_definitions" ("owner_user_id", "name")
  WHERE "scope" = 'personal' AND "status" <> 'deleted';

CREATE UNIQUE INDEX IF NOT EXISTS "uq_agent_def_team_name"
  ON "agent_definitions" ("team_id", "name")
  WHERE "scope" = 'team' AND "status" <> 'deleted';

CREATE UNIQUE INDEX IF NOT EXISTS "uq_agent_def_system_name"
  ON "agent_definitions" ("name")
  WHERE "scope" = 'system';

CREATE INDEX IF NOT EXISTS "ix_agent_def_owner_status"
  ON "agent_definitions" ("owner_user_id", "status", "updated_at" DESC);

CREATE INDEX IF NOT EXISTS "ix_agent_def_team_status"
  ON "agent_definitions" ("team_id", "status", "updated_at" DESC);

CREATE INDEX IF NOT EXISTS "ix_agent_def_scope_status"
  ON "agent_definitions" ("scope", "status");

CREATE INDEX IF NOT EXISTS "ix_agent_def_market"
  ON "agent_definitions" ("market_agent_id")
  WHERE "market_agent_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "agent_definition_versions" (
  "id"             bigserial PRIMARY KEY,
  "definition_id"  uuid NOT NULL REFERENCES "agent_definitions" ("id") ON DELETE CASCADE,
  "version"        integer NOT NULL,
  "change_kind"    varchar(16) NOT NULL,
  "snapshot"       jsonb NOT NULL,
  "change_summary" varchar(300) DEFAULT '' NOT NULL,
  "actor_user_id"  uuid REFERENCES "users" ("id") ON DELETE SET NULL,
  "created_at"     timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "agent_definition_versions_definition_version_uq" UNIQUE ("definition_id", "version"),
  CONSTRAINT "ck_agent_def_version_positive" CHECK ("version" > 0),
  CONSTRAINT "ck_agent_def_version_kind" CHECK (
    "change_kind" in ('create', 'update', 'clone', 'rollback', 'delete', 'restore', 'purge')
  )
);

CREATE TABLE IF NOT EXISTS "agent_runs" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "definition_id"      uuid REFERENCES "agent_definitions" ("id") ON DELETE SET NULL,
  "definition_name"    varchar(100) NOT NULL,
  "definition_version" integer NOT NULL,
  "owner_user_id"      uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "team_id"            uuid REFERENCES "teams" ("id") ON DELETE SET NULL,
  "parent_run_id"      uuid REFERENCES "agent_runs" ("id") ON DELETE SET NULL,
  "dispatch_id"        varchar(64),
  "session_id"         varchar(64),
  "mode"               varchar(24) NOT NULL,
  "goal"               text NOT NULL,
  "status"             varchar(16) DEFAULT 'queued' NOT NULL,
  "started_at"         timestamp with time zone,
  "ended_at"           timestamp with time zone,
  "last_heartbeat_at"  timestamp with time zone,
  "input_tokens"       integer DEFAULT 0 NOT NULL,
  "output_tokens"      integer DEFAULT 0 NOT NULL,
  "cost_points"        numeric(12, 4) DEFAULT 0 NOT NULL,
  "error_code"         varchar(64),
  "error_message"      text,
  "artifact_count"     integer DEFAULT 0 NOT NULL,
  "trace_id"           varchar(64) NOT NULL,
  "metadata"           jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at"         timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"         timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ck_agent_run_mode" CHECK (
    "mode" in ('single', 'parallel', 'pipeline', 'debate', 'vote', 'critique', 'decomposed', 'team', 'recursive')
  ),
  CONSTRAINT "ck_agent_run_status" CHECK (
    "status" in ('queued', 'running', 'paused', 'succeeded', 'failed', 'canceled', 'timeout', 'blocked')
  ),
  CONSTRAINT "ck_agent_run_definition_version" CHECK ("definition_version" > 0),
  CONSTRAINT "ck_agent_run_tokens" CHECK (
    "input_tokens" >= 0 AND "output_tokens" >= 0 AND "artifact_count" >= 0
  )
);

CREATE INDEX IF NOT EXISTS "ix_agent_runs_def_created"
  ON "agent_runs" ("definition_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "ix_agent_runs_owner_created"
  ON "agent_runs" ("owner_user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "ix_agent_runs_active"
  ON "agent_runs" ("status", "last_heartbeat_at")
  WHERE "status" in ('queued', 'running', 'paused', 'blocked');

CREATE INDEX IF NOT EXISTS "ix_agent_runs_trace"
  ON "agent_runs" ("trace_id");

CREATE INDEX IF NOT EXISTS "ix_agent_runs_dispatch"
  ON "agent_runs" ("dispatch_id")
  WHERE "dispatch_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "ix_agent_runs_session"
  ON "agent_runs" ("session_id")
  WHERE "session_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "agent_run_events" (
  "id"         bigserial PRIMARY KEY,
  "run_id"     uuid NOT NULL REFERENCES "agent_runs" ("id") ON DELETE CASCADE,
  "seq"        integer NOT NULL,
  "type"       varchar(32) NOT NULL,
  "payload"    jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "agent_run_events_run_seq_uq" UNIQUE ("run_id", "seq"),
  CONSTRAINT "ck_agent_run_event_seq" CHECK ("seq" > 0),
  CONSTRAINT "ck_agent_run_event_type" CHECK (
    "type" in ('status', 'step', 'tool', 'error', 'artifact', 'steer', 'checkpoint', 'approval', 'note')
  )
);

CREATE TABLE IF NOT EXISTS "agent_management_approvals" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "definition_id"       uuid,
  "definition_name"     varchar(100) NOT NULL,
  "definition_version"  integer NOT NULL,
  "action"              varchar(16) NOT NULL,
  "actor_user_id"       uuid REFERENCES "users" ("id") ON DELETE SET NULL,
  "status"              varchar(16) DEFAULT 'pending' NOT NULL,
  "precheck_token_hash" char(64) NOT NULL,
  "impact_hash"         char(64) NOT NULL,
  "impact_snapshot"     jsonb NOT NULL,
  "reason"              text,
  "request_id"          varchar(64),
  "trace_id"            varchar(64),
  "ip"                  varchar(64),
  "user_agent"          varchar(512),
  "requested_at"        timestamp with time zone DEFAULT now() NOT NULL,
  "decided_at"          timestamp with time zone,
  "consumed_at"         timestamp with time zone,
  "expires_at"          timestamp with time zone NOT NULL,
  "error_message"       text,
  CONSTRAINT "ck_agent_approval_action" CHECK ("action" in ('delete', 'purge', 'rollback')),
  CONSTRAINT "ck_agent_approval_status" CHECK (
    "status" in ('pending', 'approved', 'rejected', 'expired', 'consumed', 'failed')
  ),
  CONSTRAINT "ck_agent_approval_definition_version" CHECK ("definition_version" > 0)
);

CREATE INDEX IF NOT EXISTS "ix_agent_approvals_def_requested"
  ON "agent_management_approvals" ("definition_id", "requested_at" DESC);

CREATE INDEX IF NOT EXISTS "ix_agent_approvals_actor_status"
  ON "agent_management_approvals" ("actor_user_id", "status");

CREATE INDEX IF NOT EXISTS "ix_agent_approvals_status_expires"
  ON "agent_management_approvals" ("status", "expires_at");
