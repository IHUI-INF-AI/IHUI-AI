-- BUG-29 入链准备 包 2/3:补齐 schema 声明但迁移链缺失的唯一索引(保留 DO+EXCEPTION 守卫)
-- 拆自 20261106150000_fix_missing_indexes_fks.sql(隔离待审件),按三前置改写:
--   ① 按包分批 —— 本件单跑,失败不连坐其它两件;
--   ② 唯一索引用 DO+EXCEPTION 而非 CONCURRENTLY:存量重复行会抛 unique_violation 被捕获成 NOTICE,待 DBA 清理后补建(语义与普通索引不同)
--   ③ 执行通道 —— 本件**不进 drizzle journal**。CONCURRENTLY 不能在事务块内跑,
--     而 drizzle-kit migrate 在事务内跑迁移 ⇒ 本件只能由 DBA 用 psql 在事务外逐件执行:
--       psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <本件>
--     每件跑到 rc=0 才继续下一件;三件全绿后由机主决定是否 renumber 回 journal。
-- 幂等:全部 IF NOT EXISTS / DO+EXCEPTION 守卫,可重复执行。
-- 共 3 条对象。本件只补齐,不删除任何既有对象、不改数据。
-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='agent_multimodal_memory_hash_uniq') THEN
    BEGIN
      CREATE UNIQUE INDEX "agent_multimodal_memory_hash_uniq" ON "agent_multimodal_memory" (content_hash);
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'BUG-29: 唯一索引 agent_multimodal_memory_hash_uniq 因存量重复行未创建,待 DBA 清理后补建';
    END;
  END IF;
END $$;

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

-- 包2 实际生成唯一索引语句数: 3
