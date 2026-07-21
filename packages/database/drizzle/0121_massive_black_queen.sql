ALTER TABLE "search_contents" ADD COLUMN "es_indexed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "search_contents" ADD COLUMN "es_index_status" varchar(20) DEFAULT 'pending';