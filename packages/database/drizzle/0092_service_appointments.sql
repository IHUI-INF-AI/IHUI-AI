CREATE TABLE "service_appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"service_type" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"appointment_time" timestamp with time zone NOT NULL,
	"duration" integer DEFAULT 60 NOT NULL,
	"location" varchar(500),
	"contact_name" varchar(100),
	"contact_phone" varchar(20),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"remark" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "service_appointments_user_idx" ON "service_appointments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "service_appointments_status_idx" ON "service_appointments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "service_appointments_time_idx" ON "service_appointments" USING btree ("appointment_time");--> statement-breakpoint
ALTER TABLE "service_appointments" ADD CONSTRAINT "service_appointments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
