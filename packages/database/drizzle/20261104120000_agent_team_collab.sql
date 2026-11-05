-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 多 Agent 协作域(2026-11-04):团队实体 / 成员 / 持久收件箱。
-- 表名统一 agent_ 前缀,与既有人类工作区 teams/team_members 隔离(见 schema/agent-teams.ts 注释)。
-- 三条硬约束全部落在存储层:
--   1) 成员同一时刻只属于一个 active team → 部分唯一索引 (member_kind, member_id) WHERE left_at IS NULL;
--   2) 收件箱重试幂等 → 唯一索引 (team_id, idempotency_key);
--   3) 值域封闭 → CHECK 约束(core 三张表的 kind/role/status)。

CREATE TABLE "agent_teams" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL,
  "name" varchar(128) NOT NULL,
  "status" varchar(16) DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "dissolved_at" timestamp with time zone,
  CONSTRAINT "agent_teams_status_check" CHECK ("status" in ('active', 'dissolved'))
);

ALTER TABLE "agent_teams"
  ADD CONSTRAINT "agent_teams_owner_id_users_id_fk"
  FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "agent_teams_owner_idx" ON "agent_teams" USING btree ("owner_id");

CREATE TABLE "agent_team_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "team_id" uuid NOT NULL,
  "member_kind" varchar(16) NOT NULL,
  "member_id" varchar(128) NOT NULL,
  "role" varchar(16) DEFAULT 'member' NOT NULL,
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
  "left_at" timestamp with time zone,
  CONSTRAINT "agent_team_members_kind_check" CHECK ("member_kind" in ('agent', 'human')),
  CONSTRAINT "agent_team_members_role_check" CHECK ("role" in ('lead', 'member'))
);

ALTER TABLE "agent_team_members"
  ADD CONSTRAINT "agent_team_members_team_id_agent_teams_id_fk"
  FOREIGN KEY ("team_id") REFERENCES "public"."agent_teams"("id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "agent_team_members_team_member_uq"
  ON "agent_team_members" USING btree ("team_id", "member_kind", "member_id");
-- 成员单活跃归属的硬约束:数据库层直接拒绝第二行,应用层事务只负责给同族操作排序。
CREATE UNIQUE INDEX "agent_team_members_active_uq"
  ON "agent_team_members" USING btree ("member_kind", "member_id")
  WHERE "left_at" IS NULL;
CREATE INDEX "agent_team_members_team_idx" ON "agent_team_members" USING btree ("team_id");

CREATE TABLE "agent_team_inbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "team_id" uuid NOT NULL,
  "from_member_kind" varchar(16) NOT NULL,
  "from_member_id" varchar(128) NOT NULL,
  "to_member_kind" varchar(16) NOT NULL,
  "to_member_id" varchar(128) NOT NULL,
  "kind" varchar(16) DEFAULT 'message' NOT NULL,
  "idempotency_key" varchar(128) NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "agent_team_inbox_kind_check" CHECK ("kind" in ('message', 'handoff', 'system'))
);

ALTER TABLE "agent_team_inbox"
  ADD CONSTRAINT "agent_team_inbox_team_id_agent_teams_id_fk"
  FOREIGN KEY ("team_id") REFERENCES "public"."agent_teams"("id") ON DELETE cascade ON UPDATE no action;

-- 幂等锚点:同一发送重试只会命中这一条唯一键,不会落第二行。
CREATE UNIQUE INDEX "agent_team_inbox_team_idem_uq"
  ON "agent_team_inbox" USING btree ("team_id", "idempotency_key");
CREATE INDEX "agent_team_inbox_to_idx"
  ON "agent_team_inbox" USING btree ("team_id", "to_member_kind", "to_member_id", "created_at");
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
