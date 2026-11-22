-- ============================================================
-- BUG-29 补齐迁移 · 包 1/3：schema 声明但迁移链缺失的索引（普通索引 CONCURRENTLY + 唯一索引 DO 兜底）
-- ⚠ 不能在事务内执行（含 CONCURRENTLY）；须 psql 自动提交逐条跑：
--   psql "$DATABASE_URL" -f packages/database/drizzle-pending-review/20261106150001_fix_missing_indexes.sql
-- 唯一索引用 DO 块 + EXCEPTION 兜底防存量重复行中断；千万级大表建议 DBA 改手动 CREATE UNIQUE INDEX CONCURRENTLY。
-- ============================================================
-- ⛔ 隔离待审(2026-11-06) · 未 renumber 回 meta/_journal.json，不参与环境迁移。
-- 三包执行顺序: 包1 → 包2 → 包3；须先在生产库状态克隆跑到 rc=0。
-- 本批由 BUG-29 三前置改写生成；不改数据、不删对象。
-- ---------- ① 补齐 schema 声明但迁移链缺失的索引 ----------
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_ab_tests_status" ON "agent_ab_tests" (status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "agent_meta_lessons_user_type_idx" ON "agent_meta_lessons" (user_id, lesson_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_agent_meta_lessons_type_title" ON "agent_meta_lessons" (lesson_type, title);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "agent_multimodal_memory_user_idx" ON "agent_multimodal_memory" (user_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='agent_multimodal_memory_hash_uniq') THEN
    BEGIN
      CREATE UNIQUE INDEX "agent_multimodal_memory_hash_uniq" ON "agent_multimodal_memory" (content_hash);
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'BUG-29: 唯一索引 agent_multimodal_memory_hash_uniq 因存量重复行未创建,待 DBA 清理后补建';
    END;
  END IF;
END $$;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "agent_working_memory_compression_user_idx" ON "agent_working_memory_compression" (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ix_chat_messages_created_at" ON "chat_messages" (created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ix_conversation_message_archives_created_at" ON "conversation_message_archives" (created_at);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='withdrawal_flows_partner_trade_no_uq') THEN
    BEGIN
      CREATE UNIQUE INDEX "withdrawal_flows_partner_trade_no_uq" ON "withdrawal_flows" (partner_trade_no) WHERE partner_trade_no IS NOT NULL;
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'BUG-29: 唯一索引 withdrawal_flows_partner_trade_no_uq 因存量重复行未创建,待 DBA 清理后补建';
    END;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='ux_agent_memory_edges') THEN
    BEGIN
      CREATE UNIQUE INDEX "ux_agent_memory_edges" ON "agent_memory_edges" (user_id, source_id, target_id, relation);
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'BUG-29: 唯一索引 ux_agent_memory_edges 因存量重复行未创建,待 DBA 清理后补建';
    END;
  END IF;
END $$;
