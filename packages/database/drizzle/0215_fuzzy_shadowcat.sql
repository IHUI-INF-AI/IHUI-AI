-- 占位迁移(2026-09-06 修复):原文件 0215_fuzzy_shadowcat.sql 从未提交入库(并行会话
-- generate 竞态,只入 journal 未入 SQL 文件),内容不可恢复。
-- 本文件为空操作占位,仅使 readMigrationFiles 通过、migrate 链路可用。
-- ⚠️ 全新环境将跳过原 0215 的 DDL,存在 schema 漂移风险,待 drift 审计补齐。
SELECT 1 WHERE false;
