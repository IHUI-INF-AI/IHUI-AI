-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- D29 团队级知识引擎(G-35)建表 —— 记忆 / Repo Wiki / 知识卡的云端共享 + 成员修正 + 过程审计
--
-- 记账:journal idx **291**,tag `20260926120000_team_knowledge_engine`,when 1790395200000。
--   追加前实测 `node scripts/check-migration-bookkeeping.mjs` 的 B10 报「空闲」
--   (五路径全干净、drizzle/ 下无未跟踪 .sql)—— 本仓规则:追加 idx 的前置是 B10 报空闲,
--   在飞窗口里插一行就是与并发会话抢同一个 idx,抢中了就是 B4(idx 唯一连续)判红。
--   既有条目一字未动(diff 只 +7 行),`__drizzle_migrations` 记账面零改动。
--   刻意**不**跑 `pnpm --filter @ihui/database db:generate` 生成:meta/ 里只有 65 份快照
--   而 journal 有 291 条,drizzle-kit 会拿最后一份快照算差异 ⇒ 一次生成会把 65 号之后
--   所有人补的表整批重列。本仓近三枚迁移(github_app_tables / exam_sign_up_owner_uuid /
--   chat_history_projection)都是这个手写形态,本文件与之同形。
--
-- 表设计:
--   1) team_knowledge_spaces        空间(一个团队下多个并列空间),visibility 决定读凭据来源
--   2) team_knowledge_space_members 空间成员与角色 —— restricted 空间的唯一读凭据、editor/owner 的写凭据
--   3) team_knowledge_items         条目,正文 jsonb + plainText 检索面 + revision 当前版本号
--   4) team_knowledge_revisions     过程审计:who / when / action / before-after 摘要
--
-- 与旧表的关系:不改 team_memories / repo_wiki_docs / knowledge_cards 的任何列,
-- 跨成员共享靠本组新表,旧资产通过 items.source_ref 反向指回。
--
-- 本机验证边界:PG 端口 8810 实测未在跑(开发机,无服务在监听),所以本文件**未**在库上重放;
-- 结构一致性靠 schema ↔ SQL 同形 + B1-B5 离线判据 + 49 号门 `--db` 模式(需库)兜底,
-- 不得把"文件已入库"读成"迁移已验证"。

CREATE TABLE IF NOT EXISTS "team_knowledge_spaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "team_id" uuid NOT NULL,
  "name" varchar(128) NOT NULL,
  "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "visibility" varchar(20) DEFAULT 'team' NOT NULL,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT team_knowledge_spaces_visibility_check
    CHECK ("visibility" IN ('team','restricted')),
  CONSTRAINT team_knowledge_spaces_status_check
    CHECK ("status" IN ('active','archived')),
  CONSTRAINT team_knowledge_spaces_team_id_teams_id_fk
    FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE,
  CONSTRAINT team_knowledge_spaces_created_by_users_id_fk
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT team_knowledge_spaces_updated_by_users_id_fk
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "ix_team_knowledge_spaces_team"
  ON "team_knowledge_spaces" ("team_id");
CREATE INDEX IF NOT EXISTS "ix_team_knowledge_spaces_team_status"
  ON "team_knowledge_spaces" ("team_id", "status");

CREATE TABLE IF NOT EXISTS "team_knowledge_space_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "space_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" varchar(20) DEFAULT 'viewer' NOT NULL,
  "granted_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT team_knowledge_space_members_role_check
    CHECK ("role" IN ('owner','editor','viewer')),
  CONSTRAINT team_knowledge_space_members_space_id_team_knowledge_spaces_id_fk
    FOREIGN KEY ("space_id") REFERENCES "team_knowledge_spaces"("id") ON DELETE CASCADE,
  CONSTRAINT team_knowledge_space_members_user_id_users_id_fk
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT team_knowledge_space_members_granted_by_users_id_fk
    FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ux_team_knowledge_space_members_space_user"
  ON "team_knowledge_space_members" ("space_id", "user_id");
CREATE INDEX IF NOT EXISTS "ix_team_knowledge_space_members_user"
  ON "team_knowledge_space_members" ("user_id");

CREATE TABLE IF NOT EXISTS "team_knowledge_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "space_id" uuid NOT NULL,
  "kind" varchar(20) NOT NULL,
  "title" varchar(300) NOT NULL,
  "content" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "plain_text" text DEFAULT '' NOT NULL,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" varchar(20) DEFAULT 'draft' NOT NULL,
  "revision" integer DEFAULT 1 NOT NULL,
  "source_ref" jsonb,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT team_knowledge_items_kind_check
    CHECK ("kind" IN ('memory','wiki','card')),
  CONSTRAINT team_knowledge_items_status_check
    CHECK ("status" IN ('draft','published','archived')),
  CONSTRAINT team_knowledge_items_space_id_team_knowledge_spaces_id_fk
    FOREIGN KEY ("space_id") REFERENCES "team_knowledge_spaces"("id") ON DELETE CASCADE,
  CONSTRAINT team_knowledge_items_created_by_users_id_fk
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT team_knowledge_items_updated_by_users_id_fk
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "ix_team_knowledge_items_space"
  ON "team_knowledge_items" ("space_id");
CREATE INDEX IF NOT EXISTS "ix_team_knowledge_items_space_kind"
  ON "team_knowledge_items" ("space_id", "kind");
CREATE INDEX IF NOT EXISTS "ix_team_knowledge_items_space_status"
  ON "team_knowledge_items" ("space_id", "status");
CREATE INDEX IF NOT EXISTS "ix_team_knowledge_items_updated_at"
  ON "team_knowledge_items" ("updated_at");

-- space_id 在审计表里是**冗余列且刻意不设外键**:它的用途是"按空间拉审计流"不 join 条目表。
-- 设了外键就把这条冗余变成了强约束,而条目被硬删时(级联)审计行会一起消失 ——
-- 审计面的存续性不应依赖被审计对象的存续。
CREATE TABLE IF NOT EXISTS "team_knowledge_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "item_id" uuid NOT NULL,
  "space_id" uuid NOT NULL,
  "revision_no" integer NOT NULL,
  "action" varchar(20) NOT NULL,
  "actor_user_id" uuid,
  "actor_role" varchar(20),
  "before_summary" jsonb,
  "after_summary" jsonb,
  "change_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT team_knowledge_revisions_action_check
    CHECK ("action" IN ('create','revise','publish','archive')),
  CONSTRAINT team_knowledge_revisions_item_id_team_knowledge_items_id_fk
    FOREIGN KEY ("item_id") REFERENCES "team_knowledge_items"("id") ON DELETE CASCADE,
  CONSTRAINT team_knowledge_revisions_actor_user_id_users_id_fk
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ux_team_knowledge_revisions_item_revision"
  ON "team_knowledge_revisions" ("item_id", "revision_no");
CREATE INDEX IF NOT EXISTS "ix_team_knowledge_revisions_space_time"
  ON "team_knowledge_revisions" ("space_id", "created_at");
CREATE INDEX IF NOT EXISTS "ix_team_knowledge_revisions_actor"
  ON "team_knowledge_revisions" ("actor_user_id");
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
