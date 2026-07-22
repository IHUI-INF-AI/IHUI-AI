-- 2026-07-22 废弃 D 盘遗留旧表:t_homework + t_check_in_record
-- 调研结论:全仓库零引用(learnHomework/learnHomeworkRecord 是活跃新表,功能更完整)
-- t_homework 字段与 learn_homework 不等价(主键 bigserial vs uuid,content text vs jsonb)
-- t_check_in_record 是孤儿表(无新表替代,无业务代码使用)
-- 执行前需确认生产 DB 无数据:SELECT count(*) FROM t_homework; SELECT count(*) FROM t_check_in_record;

DROP TABLE IF EXISTS "t_homework" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "t_check_in_record" CASCADE;
