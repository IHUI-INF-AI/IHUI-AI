CREATE TABLE "edu_lesson_topic_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "edu_lesson_topic_categories_status_idx" ON "edu_lesson_topic_categories" USING btree ("status");--> statement-breakpoint
CREATE INDEX "edu_lesson_topic_categories_sort_idx" ON "edu_lesson_topic_categories" USING btree ("sort");