ALTER TABLE "srs_servers" ALTER COLUMN "http_port" SET DEFAULT 8802;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD COLUMN "share_token" varchar(32);--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "reasoning" text;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_share_token_unique" UNIQUE("share_token");
