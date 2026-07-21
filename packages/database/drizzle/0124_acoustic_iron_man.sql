CREATE TABLE "user_chat_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"category" varchar(32) DEFAULT 'custom' NOT NULL,
	"scenario" varchar(32) DEFAULT 'custom' NOT NULL,
	"prompt" text NOT NULL,
	"icon" varchar(64),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_chat_skills" ADD CONSTRAINT "user_chat_skills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_chat_skills_user_idx" ON "user_chat_skills" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_chat_skills_user_enabled_idx" ON "user_chat_skills" USING btree ("user_id","enabled");
