CREATE TABLE IF NOT EXISTS "business_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"title" varchar(100),
	"company" varchar(200),
	"phone" varchar(20),
	"email" varchar(200),
	"avatar" varchar(500),
	"intro" text,
	"qr_code" varchar(500),
	"is_public" boolean DEFAULT true NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "business_card_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "business_cards_user_idx" ON "business_cards" ("user_id");
--> statement-breakpoint
ALTER TABLE "business_cards" ADD CONSTRAINT "business_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "business_card_favorites" ADD CONSTRAINT "business_card_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "business_card_favorites" ADD CONSTRAINT "business_card_favorites_card_id_business_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."business_cards"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bcf_user_card_unique" ON "business_card_favorites" ("user_id","card_id");
