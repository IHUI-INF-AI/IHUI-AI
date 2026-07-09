-- Wave 22: Statistics 模块 (统计快照表)
CREATE TABLE IF NOT EXISTS "statistics_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type" varchar(50) NOT NULL,
  "data" jsonb NOT NULL,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "statistics_snapshots_type_idx" ON "statistics_snapshots"("type");
CREATE INDEX IF NOT EXISTS "statistics_snapshots_created_idx" ON "statistics_snapshots"("created_at");
