-- 扩展 zhs_ai_model_info 表,补齐旧架构 zhs_ai_model_info_unify 的 16 字段
-- 旧架构字段: id/code/type/name/model_code/img/quest_type/variables/manufacturer/open_desc/model_desc/grass_roots/is_gratis/is_new/is_top/is_hot/sort
-- 当前已有: id/name/source/icon/description/status/sort/created_at/updated_at
-- 新增字段: code/type/model_code/manufacturer/quest_type/variables/open_desc/model_desc/grass_roots/is_gratis/is_new/is_top/is_hot/course_platform
ALTER TABLE "zhs_ai_model_info" ADD COLUMN "code" varchar(64);--> statement-breakpoint
ALTER TABLE "zhs_ai_model_info" ADD COLUMN "type" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "zhs_ai_model_info" ADD COLUMN "model_code" varchar(100);--> statement-breakpoint
ALTER TABLE "zhs_ai_model_info" ADD COLUMN "manufacturer" varchar(100);--> statement-breakpoint
ALTER TABLE "zhs_ai_model_info" ADD COLUMN "quest_type" varchar(50);--> statement-breakpoint
ALTER TABLE "zhs_ai_model_info" ADD COLUMN "variables" text;--> statement-breakpoint
ALTER TABLE "zhs_ai_model_info" ADD COLUMN "open_desc" text;--> statement-breakpoint
ALTER TABLE "zhs_ai_model_info" ADD COLUMN "model_desc" text;--> statement-breakpoint
ALTER TABLE "zhs_ai_model_info" ADD COLUMN "grass_roots" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "zhs_ai_model_info" ADD COLUMN "is_gratis" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "zhs_ai_model_info" ADD COLUMN "is_new" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "zhs_ai_model_info" ADD COLUMN "is_top" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "zhs_ai_model_info" ADD COLUMN "is_hot" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "zhs_ai_model_info" ADD COLUMN "course_platform" varchar(50);--> statement-breakpoint
CREATE INDEX "zhs_ai_model_info_type_idx" ON "zhs_ai_model_info" USING btree ("type");--> statement-breakpoint
CREATE INDEX "zhs_ai_model_info_is_top_idx" ON "zhs_ai_model_info" USING btree ("is_top");--> statement-breakpoint
CREATE INDEX "zhs_ai_model_info_course_platform_idx" ON "zhs_ai_model_info" USING btree ("course_platform");
