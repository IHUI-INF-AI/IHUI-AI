CREATE TABLE "lesson_record_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"action" varchar(20) DEFAULT 'heartbeat' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"duration" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"chapter_id" uuid,
	"section_id" uuid,
	"watch_duration" integer DEFAULT 0 NOT NULL,
	"total_duration" integer DEFAULT 0 NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"last_position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_records_user_lesson_section_unique" UNIQUE("user_id","lesson_id","section_id")
);
--> statement-breakpoint
ALTER TABLE "lesson_record_logs" ADD CONSTRAINT "lesson_record_logs_record_id_lesson_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."lesson_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_record_logs" ADD CONSTRAINT "lesson_record_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_records" ADD CONSTRAINT "lesson_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_records" ADD CONSTRAINT "lesson_records_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_records" ADD CONSTRAINT "lesson_records_chapter_id_lesson_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."lesson_chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_records" ADD CONSTRAINT "lesson_records_section_id_lesson_chapter_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."lesson_chapter_sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_record_logs_record_idx" ON "lesson_record_logs" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "lesson_record_logs_user_idx" ON "lesson_record_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lesson_records_user_lesson_idx" ON "lesson_records" USING btree ("user_id","lesson_id");--> statement-breakpoint
CREATE INDEX "lesson_records_section_idx" ON "lesson_records" USING btree ("section_id");