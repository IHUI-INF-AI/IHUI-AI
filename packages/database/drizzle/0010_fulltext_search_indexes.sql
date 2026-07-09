-- Wave 16: 全文搜索 GIN 索引
-- 在 users/projects/files 表的关键字段上创建 tsvector + GIN 索引

-- users: nickname + email 全文搜索
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;
CREATE INDEX IF NOT EXISTS "users_search_vector_idx" ON "users" USING GIN ("search_vector");
CREATE TRIGGER search_vector_users_trigger BEFORE INSERT OR UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION
  tsvector_update_trigger("search_vector", 'pg_catalog.simple', "nickname", "email");

-- projects: name + description 全文搜索
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;
CREATE INDEX IF NOT EXISTS "projects_search_vector_idx" ON "projects" USING GIN ("search_vector");
CREATE TRIGGER search_vector_projects_trigger BEFORE INSERT OR UPDATE ON "projects"
  FOR EACH ROW EXECUTE FUNCTION
  tsvector_update_trigger("search_vector", 'pg_catalog.simple', "name", "description");

-- files: name 全文搜索
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;
CREATE INDEX IF NOT EXISTS "files_search_vector_idx" ON "files" USING GIN ("search_vector");
CREATE TRIGGER search_vector_files_trigger BEFORE INSERT OR UPDATE ON "files"
  FOR EACH ROW EXECUTE FUNCTION
  tsvector_update_trigger("search_vector", 'pg_catalog.simple', "name");
