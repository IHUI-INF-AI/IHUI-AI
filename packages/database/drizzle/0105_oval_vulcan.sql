CREATE TABLE "zhs_knowledge_chunk" (
	"id" serial PRIMARY KEY NOT NULL,
	"doc_id" integer NOT NULL,
	"collection_name" varchar(100) DEFAULT 'default' NOT NULL,
	"owner_uuid" varchar(64) NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" text,
	"score" numeric DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_knowledge_doc" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_uuid" varchar(64) NOT NULL,
	"collection_name" varchar(100) DEFAULT 'default' NOT NULL,
	"title" varchar(255) NOT NULL,
	"source_type" varchar(20) DEFAULT 'text' NOT NULL,
	"source_path" varchar(500),
	"content_hash" varchar(64),
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"metadata_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_crew_artifact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" varchar(50) DEFAULT 'text' NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_crew_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"from_role" varchar(50) NOT NULL,
	"to_role" varchar(50) NOT NULL,
	"content" text NOT NULL,
	"message_type" varchar(30) DEFAULT 'text' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zhs_crew_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"title" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"input_message" text NOT NULL,
	"output_message" text,
	"config" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "zhs_crew_task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"task_index" integer NOT NULL,
	"agent_role" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"expected_output" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"output_data" text,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "zhs_crew_artifact" ADD CONSTRAINT "zhs_crew_artifact_session_id_zhs_crew_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."zhs_crew_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zhs_crew_message" ADD CONSTRAINT "zhs_crew_message_session_id_zhs_crew_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."zhs_crew_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zhs_crew_task" ADD CONSTRAINT "zhs_crew_task_session_id_zhs_crew_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."zhs_crew_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_knowledge_chunk_doc_id" ON "zhs_knowledge_chunk" USING btree ("doc_id");--> statement-breakpoint
CREATE INDEX "ix_knowledge_chunk_collection" ON "zhs_knowledge_chunk" USING btree ("collection_name");--> statement-breakpoint
CREATE INDEX "ix_knowledge_doc_owner" ON "zhs_knowledge_doc" USING btree ("owner_uuid");--> statement-breakpoint
CREATE INDEX "ix_knowledge_doc_collection" ON "zhs_knowledge_doc" USING btree ("collection_name");--> statement-breakpoint
CREATE INDEX "ix_crew_artifact_session" ON "zhs_crew_artifact" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "ix_crew_message_session" ON "zhs_crew_message" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "ix_crew_session_user" ON "zhs_crew_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_crew_session_status" ON "zhs_crew_session" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_crew_task_session" ON "zhs_crew_task" USING btree ("session_id");