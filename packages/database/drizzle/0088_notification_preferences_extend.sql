-- 0088: notification_preferences 扩展 5 字段(quietHours + 频率限制)
-- quiet_hours_enabled: 是否启用静默时段
-- quiet_hours_start/end: 静默时段起止时间(HH:mm 格式)
-- max_per_hour/day: 每小时/每日通知频率上限
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "quiet_hours_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "quiet_hours_start" varchar(8);
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "quiet_hours_end" varchar(8);
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "max_per_hour" integer DEFAULT 20 NOT NULL;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "max_per_day" integer DEFAULT 100 NOT NULL;
