-- P1 schema batch1: point_redeem_items + image_gen_favorites + notes + knowledge_base_categories
-- 注:0091-0094 已创建 business_cards/service_appointments/user_addresses/themes 等表,本 migration 仅新增 4 张 P1 表。

CREATE TABLE IF NOT EXISTS "point_redeem_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"image" varchar(500),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "point_redeem_items_sort_idx" ON "point_redeem_items" USING btree ("sort_order");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "image_gen_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"image_url" varchar(1000) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "igf_user_url_unique" UNIQUE("user_id","image_url")
);
--> statement-breakpoint
ALTER TABLE "image_gen_favorites" ADD CONSTRAINT "image_gen_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_gen_favorites_user_idx" ON "image_gen_favorites" USING btree ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lesson_id" varchar(100),
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notes_user_idx" ON "notes" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notes_lesson_idx" ON "notes" USING btree ("lesson_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_base_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kbc_name_unique" UNIQUE("name")
);
