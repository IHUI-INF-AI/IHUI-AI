-- Wave 16: files soft delete (recycle bin)
ALTER TABLE "files" ADD COLUMN "deleted_at" timestamptz;
ALTER TABLE "files" ADD COLUMN "deleted_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "files_deleted_at_idx" ON "files"("deleted_at");
