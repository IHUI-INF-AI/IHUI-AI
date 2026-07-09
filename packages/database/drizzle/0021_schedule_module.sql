-- Wave 21: Schedule 模块 (定时任务 + 执行日志)
CREATE TABLE IF NOT EXISTS "schedule_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(200) NOT NULL,
  "description" text,
  "cron_expression" varchar(100) NOT NULL,
  "target_service" varchar(100),
  "target_method" varchar(100),
  "parameters" text,
  "priority" integer DEFAULT 5 NOT NULL,
  "max_retry_count" integer DEFAULT 3 NOT NULL,
  "timeout" integer DEFAULT 3600 NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "last_run_time" timestamptz,
  "last_run_status" varchar(20),
  "last_run_message" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "schedule_tasks_enabled_idx" ON "schedule_tasks"("enabled");
CREATE INDEX IF NOT EXISTS "schedule_tasks_priority_idx" ON "schedule_tasks"("priority");

CREATE TABLE IF NOT EXISTS "schedule_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL REFERENCES "schedule_tasks"("id") ON DELETE CASCADE,
  "task_name" varchar(200) NOT NULL,
  "status" varchar(20) NOT NULL,
  "start_time" timestamptz,
  "end_time" timestamptz,
  "duration" integer DEFAULT 0 NOT NULL,
  "message" text,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "schedule_logs_task_idx" ON "schedule_logs"("task_id");
CREATE INDEX IF NOT EXISTS "schedule_logs_status_idx" ON "schedule_logs"("status");
