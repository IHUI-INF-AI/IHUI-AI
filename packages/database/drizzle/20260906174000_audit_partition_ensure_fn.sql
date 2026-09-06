-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

-- 2026-09-06 audit_logs 月分区滚动续建函数
-- 背景:0060 已在建库时一次性预建 16 个月分区(过去12+当前+未来3),但无滚动续建机制,
--      超出预建范围的写入会落入 default 兜底分区(功能不丢,仅分区裁剪优化失效)。
-- 本文件提供幂等的按需续建函数,供运维/应用层月度调用:
--   SELECT public.ensure_audit_log_partitions(3);   -- 补齐当前月+未来3个月
--   SELECT public.ensure_audit_log_partitions(0, -6); -- 补建过去6个月(历史缺口)

CREATE OR REPLACE FUNCTION public.ensure_audit_log_partitions(
  months_ahead integer DEFAULT 3,
  months_back integer DEFAULT 0
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_start timestamptz;
  v_end   timestamptz;
  v_name  text;
  i       int;
  v_created int := 0;
  v_base  date := date_trunc('month', CURRENT_DATE)::date;
BEGIN
  -- 仅当父表为分区表时执行
  IF NOT EXISTS (
    SELECT 1 FROM pg_partitioned_table pt
    JOIN pg_class c ON c.oid = pt.partrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'audit_logs' AND n.nspname = 'public'
  ) THEN
    RAISE NOTICE 'ensure_audit_log_partitions: audit_logs 非分区表, 跳过';
    RETURN 0;
  END IF;

  FOR i IN (-1 * months_back)..months_ahead LOOP
    v_start := (v_base + (i || ' months')::interval)::timestamptz;
    v_end   := (v_base + ((i + 1) || ' months')::interval)::timestamptz;
    v_name  := 'audit_logs_' || to_char(v_start AT TIME ZONE 'UTC', 'YYYYmm');
    -- 已存在同名分区则跳过(按需建历史缺口月时防止 DEFAULT 已兜住数据导致冲突)
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = v_name AND n.nspname = 'public'
    ) THEN
      CONTINUE;
    END IF;
    -- 该时间范围内若 default 分区已有数据, 挂新分区会违反唯一约束, 由调用方先迁数据
    BEGIN
      EXECUTE format(
        'CREATE TABLE %I PARTITION OF "audit_logs" FOR VALUES FROM (%L) TO (%L)',
        v_name, v_start, v_end
      );
      v_created := v_created + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'ensure_audit_log_partitions: 分区 % 创建失败(%), 跳过', v_name, SQLERRM;
    END;
  END LOOP;

  RETURN v_created;
END $fn$;
--> statement-breakpoint

-- 部署即补齐当前窗口(当前月+未来3个月), 幂等可重复执行
SELECT public.ensure_audit_log_partitions(3);
