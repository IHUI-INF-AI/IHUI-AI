-- Migration 20260724180000: registry_items 表新增 payload_hash 列 + 索引
-- 创建时间: 2026-07-24
-- 描述: 资源上游自动同步中心深度完善 — 新增 payload_hash 列存储单条条目 payload 的 SHA-256,
--       供 worker 做单条变更检测(避免整批 hash 无法定位具体变更条目)。
--       列 nullable(已有数据回填 NULL,worker 下次同步时写入),索引加速 hash 查询。
--
-- 幂等安全:使用 IF NOT EXISTS,列/索引已存在则为 no-op。

-- 1. 新增 payload_hash 列(varchar(64),nullable)
ALTER TABLE "registry_items"
  ADD COLUMN IF NOT EXISTS "payload_hash" varchar(64);

-- 2. 新增 payload_hash 索引(加速变更检测查询)
CREATE INDEX IF NOT EXISTS "registry_items_payload_hash_idx"
  ON "registry_items" ("payload_hash");
