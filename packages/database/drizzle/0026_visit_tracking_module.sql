-- Wave 26: VisitTracking 模块 (访问记录表)
CREATE TABLE IF NOT EXISTS "visit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "ip" varchar(64),
  "city" varchar(100),
  "url" varchar(512),
  "referer" varchar(512),
  "user_agent" varchar(512),
  "session_id" varchar(128),
  "visit_date" varchar(10),
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "visit_logs_date_idx" ON "visit_logs"("visit_date");
CREATE INDEX IF NOT EXISTS "visit_logs_ip_city_idx" ON "visit_logs"("ip","city");
