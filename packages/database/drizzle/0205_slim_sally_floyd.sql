CREATE TABLE "edu_attendance_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"date" date NOT NULL,
	"check_in_time" timestamp with time zone,
	"check_out_time" timestamp with time zone,
	"status" varchar(20) DEFAULT 'present' NOT NULL,
	"check_in_method" varchar(20) DEFAULT 'manual' NOT NULL,
	"check_out_method" varchar(20) DEFAULT 'manual',
	"operated_by" uuid,
	"remark" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_leave_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"leave_type" varchar(30) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"total_days" integer NOT NULL,
	"reason" text NOT NULL,
	"attachment" varchar(500),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"approver_id" uuid,
	"approve_remark" text,
	"approve_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "edu_attendance_record" ADD CONSTRAINT "edu_attendance_record_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_attendance_record" ADD CONSTRAINT "edu_attendance_record_class_id_edu_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."edu_class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_attendance_record" ADD CONSTRAINT "edu_attendance_record_operated_by_users_id_fk" FOREIGN KEY ("operated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_leave_request" ADD CONSTRAINT "edu_leave_request_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_leave_request" ADD CONSTRAINT "edu_leave_request_class_id_edu_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."edu_class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_leave_request" ADD CONSTRAINT "edu_leave_request_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_edu_att_student_date" ON "edu_attendance_record" USING btree ("student_id","date");--> statement-breakpoint
CREATE INDEX "ix_edu_att_class_date" ON "edu_attendance_record" USING btree ("class_id","date");--> statement-breakpoint
CREATE INDEX "ix_edu_att_status" ON "edu_attendance_record" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_edu_leave_student" ON "edu_leave_request" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "ix_edu_leave_class" ON "edu_leave_request" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "ix_edu_leave_status" ON "edu_leave_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_edu_leave_dates" ON "edu_leave_request" USING btree ("start_date","end_date");