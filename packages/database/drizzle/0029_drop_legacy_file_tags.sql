-- Wave 16 Phase 15: 删除旧 file_tags / file_tag_relations 表 (#15)
-- 路由层已统一使用 social.ts 的 tags / tag_relations 表(支持多资源类型),
-- 旧的文件专属 file_tags / file_tag_relations 表无任何代码引用,属于沉默的双重定义。
-- 本迁移安全删除旧表,统一到新 tag 系统。

DROP TABLE IF EXISTS "file_tag_relations";
DROP TABLE IF EXISTS "file_tags";
