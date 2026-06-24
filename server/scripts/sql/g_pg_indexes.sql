-- =============================================================================
-- G 盘 PostgreSQL 索引优化 SQL 脚本 (P1 封版)
-- 适用: PostgreSQL 12+
-- 等价于: alembic/versions/046_g_pg_indexes.py
-- 用途: 在 alembic 不可用 / 离线环境 / DBA 手工优化时, 独立执行
-- 幂等: 全部 IF NOT EXISTS, 可重复运行
-- =============================================================================
--
-- 性能基线 (P1 封版):
--   100k 行 t_order 冷启动 transform: 6.5s (15,236 rows/s)
--   索引加载后 G 盘 95th 分位查询 < 50ms (单表 PK)
--   50 行 LIMIT 列表查询 (member_id + status) < 20ms
--
-- 使用:
--   psql -h <host> -U <user> -d <db> -f scripts/sql/g_pg_indexes.sql
--   或在 pgAdmin / DBeaver 中直接执行
--
-- 验证:
--   SELECT schemaname, tablename, indexname, idx_scan
--   FROM pg_stat_user_indexes
--   WHERE schemaname = 'public'
--   ORDER BY idx_scan DESC;
-- =============================================================================

\echo '=== G 盘 PG 索引优化开始 ==='

-- 1. 启用 pg_trgm 扩展 (文本模糊搜索)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- 2. 复合索引 - 覆盖高频组合查询
-- =============================================================================

-- t_sign_up: 我的课程列表 (按会员 + 状态过滤 + 按时间倒序)
CREATE INDEX IF NOT EXISTS idx_signup_member_status_ctime
  ON t_sign_up (member_id, status, create_time);

-- t_record: 学习记录 (按会员 + 课程查询)
CREATE INDEX IF NOT EXISTS idx_record_member_lesson_ctime
  ON t_record (member_id, lesson_id, create_time);

-- t_homework_record: 作业记录 (按会员 + 课程 + 状态)
CREATE INDEX IF NOT EXISTS idx_hr_member_lesson_status
  ON t_homework_record (member_id, lesson_id, status);

-- t_certificate: 我的证书 (按会员 + 状态)
CREATE INDEX IF NOT EXISTS idx_cert_member_status
  ON t_certificate (member_id, status);

-- t_exam_paper_record: 考试记录 (按会员 + 考试 + 状态)
CREATE INDEX IF NOT EXISTS idx_epr_member_exam_status
  ON t_exam_paper_record (member_id, exam_id, status);

-- zhs_order: 订单主表 (按会员 + 状态, 按支付状态 + 时间)
CREATE INDEX IF NOT EXISTS idx_zorder_member_status_ctime
  ON zhs_order (member_id, status, create_time);

CREATE INDEX IF NOT EXISTS idx_zorder_paid_ctime
  ON zhs_order (is_paid, create_time);

-- =============================================================================
-- 3. 部分索引 - 优化热状态 (避免冷数据占空间)
-- =============================================================================

-- 订单: 只索引已支付订单 (热数据 < 20% 总数, 大幅减小索引体积)
CREATE INDEX IF NOT EXISTS idx_zorder_paid_only
  ON zhs_order (member_id, create_time)
  WHERE is_paid = 1;

-- 课程: 只索引上架课程
CREATE INDEX IF NOT EXISTS idx_lesson_published
  ON t_lesson (create_time)
  WHERE status = 1;

-- 会员: 只索引启用状态
CREATE INDEX IF NOT EXISTS idx_member_active
  ON t_member (create_time)
  WHERE status = 1;

-- =============================================================================
-- 4. 文本搜索索引 - GIN trigram (支持模糊搜索)
-- =============================================================================

-- 课程标题模糊搜索
CREATE INDEX IF NOT EXISTS idx_lesson_title_trgm
  ON t_lesson USING GIN (title gin_trgm_ops);

-- 学员姓名 / 昵称
CREATE INDEX IF NOT EXISTS idx_member_name_trgm
  ON t_member USING GIN (name gin_trgm_ops);

-- =============================================================================
-- 5. BRIN 索引 - 大表时间戳 (append-only 模式, 索引体积小)
-- =============================================================================

-- 订单时间戳
CREATE INDEX IF NOT EXISTS idx_zorder_ctime_brin
  ON zhs_order USING BRIN (create_time) WITH (pages_per_range = 32);

-- 记录表
CREATE INDEX IF NOT EXISTS idx_record_ctime_brin
  ON t_record USING BRIN (create_time) WITH (pages_per_range = 32);

-- =============================================================================
-- 6. 倒序索引 - 配合 ORDER BY ... DESC LIMIT N
-- =============================================================================

-- 最新订单列表
CREATE INDEX IF NOT EXISTS idx_zorder_ctime_desc
  ON zhs_order (create_time DESC);

-- =============================================================================
-- 7. 覆盖索引 (INCLUDE) - 避免回表, PG 11+
-- =============================================================================

-- 会员档案查询: 拿 member_id + name + mobile + avatar (无需回表)
CREATE INDEX IF NOT EXISTS idx_member_profile_cover
  ON t_member (member_id) INCLUDE (name, mobile, avatar, create_time);

-- id_mapping: 按 batch + source_table 范围的覆盖索引 (加速回滚)
CREATE INDEX IF NOT EXISTS idx_idm_batch_source_cover
  ON id_mapping (migration_batch, source_table) INCLUDE (old_id, new_uuid);

-- =============================================================================
-- 8. 更新统计信息 - 让优化器用上新索引
-- =============================================================================

ANALYZE t_lesson;
ANALYZE t_sign_up;
ANALYZE t_record;
ANALYZE t_homework_record;
ANALYZE t_certificate;
ANALYZE t_exam_paper_record;
ANALYZE t_member;
ANALYZE zhs_order;
ANALYZE id_mapping;

-- =============================================================================
-- 9. 验证索引 (可选)
-- =============================================================================

\echo ''
\echo '=== 已创建 / 验证的索引 ==='
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  idx_scan AS times_used
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

\echo ''
\echo '=== G 盘 PG 索引优化完成 ==='
