CREATE TABLE "llm_call_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"model" varchar(100) NOT NULL,
	"prompt" text NOT NULL,
	"response" text,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'success' NOT NULL,
	"error_message" text,
	"conversation_id" varchar(100),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "llm_call_logs" ADD CONSTRAINT "llm_call_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "llm_call_logs_user_idx" ON "llm_call_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "llm_call_logs_model_idx" ON "llm_call_logs" USING btree ("model");--> statement-breakpoint
CREATE INDEX "llm_call_logs_status_idx" ON "llm_call_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "llm_call_logs_created_at_idx" ON "llm_call_logs" USING btree ("created_at");