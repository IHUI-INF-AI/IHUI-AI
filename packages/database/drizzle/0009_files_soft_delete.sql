-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

-- Wave 16: files soft delete (recycle bin)
ALTER TABLE "files" ADD COLUMN "deleted_at" timestamptz;
ALTER TABLE "files" ADD COLUMN "deleted_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "files_deleted_at_idx" ON "files"("deleted_at");
