-- 修复讲师表缺失字段
-- 请在 MySQL 数据库 cloud_learning_content 中执行以下 SQL

-- 方式1：直接添加字段（如果报错说字段已存在则忽略）
ALTER TABLE t_lecturer ADD COLUMN job_title VARCHAR(255) DEFAULT NULL COMMENT '头衔';
ALTER TABLE t_lecturer ADD COLUMN mobile VARCHAR(50) DEFAULT NULL COMMENT '联系电话';
ALTER TABLE t_lecturer ADD COLUMN description TEXT DEFAULT NULL COMMENT '介绍';
ALTER TABLE t_lecturer ADD COLUMN image VARCHAR(500) DEFAULT NULL COMMENT '头像';
ALTER TABLE t_lecturer ADD COLUMN user_id BIGINT DEFAULT NULL COMMENT '用户ID';

-- 如果上述语句报错说字段已存在，可以忽略该错误继续执行其他语句

-- 查看表结构确认
DESCRIBE t_lecturer;
