-- Wave 16: announcement_reads table for read tracking
CREATE TABLE IF NOT EXISTS "announcement_reads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "announcement_id" uuid NOT NULL REFERENCES "announcements"("id") ON DELETE CASCADE,
  "read_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "announcement_reads_user_id_announcement_id_unique" UNIQUE("user_id","announcement_id")
);
