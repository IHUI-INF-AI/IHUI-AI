-- Wave 16: file_versions table for version history
CREATE TABLE IF NOT EXISTS "file_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "file_id" uuid NOT NULL REFERENCES "files"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "size" integer NOT NULL,
  "path" varchar(512) NOT NULL,
  "uploaded_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "change_log" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "file_versions_file_id_version_unique" UNIQUE("file_id","version")
);
CREATE INDEX IF NOT EXISTS "file_versions_file_id_idx" ON "file_versions"("file_id");
