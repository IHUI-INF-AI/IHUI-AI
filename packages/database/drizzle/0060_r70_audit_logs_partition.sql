-- Migration 0060: R70 audit_logs 按月分区归档机制
-- 来源: PROJECT_PLAN R70 — audit_logs 表分区归档(唯一 P2 技术债)
-- 创建时间: 2026-07-14
-- 描述: 将 audit_logs 表重建为 PostgreSQL 声明式分区表(RANGE created_at 按月分区)
--       长期运行后可通过 DETACH PARTITION + 归档/删除旧分区控制表大小
--
-- 策略(安全重建,事务内执行):
--   1. 重命名原表 audit_logs → audit_logs_old(仅当原表为普通表时)
--   2. 创建分区父表 audit_logs(字段与原表一致, PK 改为 (id, created_at) 复合主键)
--      注意: PostgreSQL 分区表唯一约束必须包含分区键, 故 id 单列 PK → (id, created_at)
--      Drizzle ORM 运行时按列名查询, 不依赖 DB 层 PK 定义, 兼容此变更
--   3. 添加外键约束 user_id → users(id) ON DELETE CASCADE
--   4. 创建初始分区(过去 12 个月 + 当前月 + 未来 3 个月, 共 16 个)
--   5. 创建默认分区(DEFAULT)兜底
--   6. 从 audit_logs_old 迁移数据到分区表(INSERT INTO ... SELECT)
--   7. 在父表创建索引(自动传播到所有子分区)
--   8. 删除旧表 audit_logs_old
--
-- 幂等性: 所有步骤使用 IF NOT EXISTS / 守卫检查, 可安全重复执行

BEGIN;

-- ===== Step 1: 重命名原表(仅当 audit_logs 为普通表且 audit_logs_old 不存在时) =====
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'audit_logs' AND c.relkind = 'r' AND n.nspname = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'audit_logs_old' AND n.nspname = 'public'
  ) THEN
    ALTER TABLE "audit_logs" RENAME TO "audit_logs_old";
    -- 丢弃旧表 FK 约束(避免与新表 FK 名称冲突, 旧表即将删除)
    ALTER TABLE "audit_logs_old" DROP CONSTRAINT IF EXISTS "audit_logs_user_id_users_id_fk";
    RAISE NOTICE 'R70: 重命名 audit_logs -> audit_logs_old';
  ELSE
    RAISE NOTICE 'R70: 跳过重命名(audit_logs 已分区或 audit_logs_old 已存在)';
  END IF;
END $$;

-- ===== Step 2: 创建分区父表 =====
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "action" varchar(32) NOT NULL,
  "resource_type" varchar(64),
  "resource_id" varchar(64),
  "details" jsonb,
  "ip" varchar(64),
  "user_agent" varchar(512),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id", "created_at")
) PARTITION BY RANGE ("created_at");

-- ===== Step 3: 添加外键约束(分区表 FK, PG 12+ 支持) =====
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'audit_logs_user_id_users_id_fk' AND n.nspname = 'public'
  ) THEN
    ALTER TABLE "audit_logs"
      ADD CONSTRAINT "audit_logs_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    RAISE NOTICE 'R70: 添加外键约束 audit_logs_user_id_users_id_fk';
  ELSE
    RAISE NOTICE 'R70: 外键约束已存在, 跳过';
  END IF;
END $$;

-- ===== Step 4: 创建初始月分区(过去 12 个月 + 当前月 + 未来 3 个月 = 16 个) =====
DO $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_name text;
  i int;
  v_base date := date_trunc('month', CURRENT_DATE)::date;
BEGIN
  FOR i IN -12..3 LOOP
    v_start := (v_base + (i || ' months')::interval)::timestamptz;
    v_end   := (v_base + ((i + 1) || ' months')::interval)::timestamptz;
    v_name  := 'audit_logs_' || to_char(v_start AT TIME ZONE 'UTC', 'YYYYmm');
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF "audit_logs" FOR VALUES FROM (%L) TO (%L)',
      v_name, v_start, v_end
    );
  END LOOP;
  RAISE NOTICE 'R70: 创建 16 个月分区(audit_logs_YYYYmm)';
END $$;

-- ===== Step 5: 创建默认分区(兜底, 捕获范围外时间戳) =====
CREATE TABLE IF NOT EXISTS "audit_logs_default" PARTITION OF "audit_logs" DEFAULT;

-- ===== Step 6: 从旧表迁移数据(仅当 audit_logs_old 存在时) =====
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'audit_logs_old' AND c.relkind = 'r' AND n.nspname = 'public'
  ) THEN
    INSERT INTO "audit_logs" ("id", "user_id", "action", "resource_type", "resource_id", "details", "ip", "user_agent", "created_at")
    SELECT "id", "user_id", "action", "resource_type", "resource_id", "details", "ip", "user_agent", "created_at"
    FROM "audit_logs_old"
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'R70: 数据迁移完成 audit_logs_old -> audit_logs(分区表)';
  ELSE
    RAISE NOTICE 'R70: 无需数据迁移(audit_logs_old 不存在)';
  END IF;
END $$;

-- ===== Step 7: 在父表创建索引(自动传播到所有子分区, 含未来新建分区) =====
CREATE INDEX IF NOT EXISTS "idx_audit_logs_user_id" ON "audit_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_action" ON "audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_resource" ON "audit_logs" ("resource_type", "resource_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_created_at" ON "audit_logs" ("created_at" DESC);

-- ===== Step 8: 删除旧表 =====
DROP TABLE IF EXISTS "audit_logs_old";

COMMIT;
