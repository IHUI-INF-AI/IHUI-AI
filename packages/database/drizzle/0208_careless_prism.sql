CREATE TABLE "edu_enrollment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"enroll_date" date NOT NULL,
	"total_fee" integer NOT NULL,
	"paid_amount" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'enrolled' NOT NULL,
	"remark" text,
	"operator_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_exam_score" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"subject" varchar(100) NOT NULL,
	"exam_name" varchar(200) NOT NULL,
	"score" integer NOT NULL,
	"total_score" integer DEFAULT 100 NOT NULL,
	"exam_date" date NOT NULL,
	"remark" text,
	"recorded_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_homework_submission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"homework_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"content" text,
	"attachment" varchar(500),
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"score" integer,
	"comment" text,
	"teacher_id" uuid,
	"graded_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'submitted' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_lead" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"phone" varchar(20),
	"student_name" varchar(100),
	"student_age" integer,
	"source" varchar(30) NOT NULL,
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"follower_id" uuid,
	"next_follow_date" date,
	"remark" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_parent_student_binding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"relationship" varchar(30) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_payment_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"fee_id" uuid,
	"amount" integer NOT NULL,
	"payment_date" date NOT NULL,
	"payment_method" varchar(30) NOT NULL,
	"status" varchar(20) DEFAULT 'paid' NOT NULL,
	"receipt_no" varchar(100),
	"remark" text,
	"operator_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_ranking_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"exam_name" varchar(200) NOT NULL,
	"subject" varchar(100),
	"student_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"rank" integer NOT NULL,
	"total_students" integer NOT NULL,
	"snapshot_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_refund_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"payment_id" uuid,
	"amount" integer NOT NULL,
	"refund_date" date NOT NULL,
	"refund_method" varchar(30),
	"reason" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"approver_id" uuid,
	"approve_remark" text,
	"approve_at" timestamp with time zone,
	"operator_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_schedule_change" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"subject" varchar(100) NOT NULL,
	"original_teacher" varchar(100),
	"new_teacher" varchar(100),
	"original_weekday" integer,
	"original_start_time" varchar(10),
	"original_end_time" varchar(10),
	"new_weekday" integer,
	"new_start_time" varchar(10),
	"new_end_time" varchar(10),
	"reason" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"applicant_id" uuid NOT NULL,
	"approver_id" uuid,
	"approve_remark" text,
	"approve_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_scheduling_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"subject" varchar(100) NOT NULL,
	"teacher_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"start_time" varchar(10) NOT NULL,
	"end_time" varchar(10) NOT NULL,
	"classroom" varchar(100),
	"weeks_per_term" integer DEFAULT 16,
	"priority" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_teacher_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" varchar(10) NOT NULL,
	"end_time" varchar(10) NOT NULL,
	"time_slot" varchar(20),
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_trial_booking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"student_name" varchar(100) NOT NULL,
	"student_age" integer,
	"parent_name" varchar(100),
	"parent_phone" varchar(20),
	"trial_date" date NOT NULL,
	"trial_time" varchar(50),
	"subject" varchar(100),
	"teacher_id" uuid,
	"classroom" varchar(100),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"remark" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_tuition_fee" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"fee_name" varchar(100) NOT NULL,
	"amount" integer NOT NULL,
	"billing_cycle" varchar(30) DEFAULT 'term' NOT NULL,
	"effective_date" date NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payment_method" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "target_id" varchar(64);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "target_title" varchar(200);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "original_price" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancel_time" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_time" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "remark" varchar(500);--> statement-breakpoint
ALTER TABLE "edu_enrollment" ADD CONSTRAINT "edu_enrollment_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_enrollment" ADD CONSTRAINT "edu_enrollment_class_id_edu_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."edu_class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_enrollment" ADD CONSTRAINT "edu_enrollment_term_id_edu_term_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."edu_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_enrollment" ADD CONSTRAINT "edu_enrollment_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_exam_score" ADD CONSTRAINT "edu_exam_score_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_exam_score" ADD CONSTRAINT "edu_exam_score_class_id_edu_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."edu_class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_exam_score" ADD CONSTRAINT "edu_exam_score_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_homework_submission" ADD CONSTRAINT "edu_homework_submission_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_homework_submission" ADD CONSTRAINT "edu_homework_submission_class_id_edu_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."edu_class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_homework_submission" ADD CONSTRAINT "edu_homework_submission_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_lead" ADD CONSTRAINT "edu_lead_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_parent_student_binding" ADD CONSTRAINT "edu_parent_student_binding_parent_id_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_parent_student_binding" ADD CONSTRAINT "edu_parent_student_binding_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_payment_record" ADD CONSTRAINT "edu_payment_record_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_payment_record" ADD CONSTRAINT "edu_payment_record_class_id_edu_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."edu_class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_payment_record" ADD CONSTRAINT "edu_payment_record_fee_id_edu_tuition_fee_id_fk" FOREIGN KEY ("fee_id") REFERENCES "public"."edu_tuition_fee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_payment_record" ADD CONSTRAINT "edu_payment_record_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_ranking_snapshot" ADD CONSTRAINT "edu_ranking_snapshot_class_id_edu_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."edu_class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_ranking_snapshot" ADD CONSTRAINT "edu_ranking_snapshot_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_refund_record" ADD CONSTRAINT "edu_refund_record_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_refund_record" ADD CONSTRAINT "edu_refund_record_class_id_edu_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."edu_class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_refund_record" ADD CONSTRAINT "edu_refund_record_payment_id_edu_payment_record_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."edu_payment_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_refund_record" ADD CONSTRAINT "edu_refund_record_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_refund_record" ADD CONSTRAINT "edu_refund_record_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_schedule_change" ADD CONSTRAINT "edu_schedule_change_schedule_id_edu_course_schedule_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."edu_course_schedule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_schedule_change" ADD CONSTRAINT "edu_schedule_change_class_id_edu_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."edu_class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_schedule_change" ADD CONSTRAINT "edu_schedule_change_applicant_id_users_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_schedule_change" ADD CONSTRAINT "edu_schedule_change_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_scheduling_rule" ADD CONSTRAINT "edu_scheduling_rule_term_id_edu_term_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."edu_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_scheduling_rule" ADD CONSTRAINT "edu_scheduling_rule_class_id_edu_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."edu_class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_scheduling_rule" ADD CONSTRAINT "edu_scheduling_rule_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_teacher_schedule" ADD CONSTRAINT "edu_teacher_schedule_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_teacher_schedule" ADD CONSTRAINT "edu_teacher_schedule_term_id_edu_term_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."edu_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_trial_booking" ADD CONSTRAINT "edu_trial_booking_lead_id_edu_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."edu_lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_trial_booking" ADD CONSTRAINT "edu_trial_booking_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_tuition_fee" ADD CONSTRAINT "edu_tuition_fee_class_id_edu_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."edu_class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_tuition_fee" ADD CONSTRAINT "edu_tuition_fee_term_id_edu_term_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."edu_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_edu_enroll_student" ON "edu_enrollment" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "ix_edu_enroll_class" ON "edu_enrollment" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "ix_edu_enroll_term" ON "edu_enrollment" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX "ix_edu_enroll_status" ON "edu_enrollment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_edu_score_student" ON "edu_exam_score" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "ix_edu_score_class" ON "edu_exam_score" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "ix_edu_score_subject" ON "edu_exam_score" USING btree ("subject");--> statement-breakpoint
CREATE INDEX "ix_edu_score_date" ON "edu_exam_score" USING btree ("exam_date");--> statement-breakpoint
CREATE INDEX "ix_edu_hw_sub_homework" ON "edu_homework_submission" USING btree ("homework_id");--> statement-breakpoint
CREATE INDEX "ix_edu_hw_sub_student" ON "edu_homework_submission" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "ix_edu_hw_sub_class" ON "edu_homework_submission" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "ix_edu_hw_sub_status" ON "edu_homework_submission" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_edu_lead_status" ON "edu_lead" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_edu_lead_follower" ON "edu_lead" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "ix_edu_lead_phone" ON "edu_lead" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "ix_edu_parent_binding_parent" ON "edu_parent_student_binding" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "ix_edu_parent_binding_student" ON "edu_parent_student_binding" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "ix_edu_parent_binding_status" ON "edu_parent_student_binding" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_edu_pay_student" ON "edu_payment_record" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "ix_edu_pay_class" ON "edu_payment_record" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "ix_edu_pay_fee" ON "edu_payment_record" USING btree ("fee_id");--> statement-breakpoint
CREATE INDEX "ix_edu_pay_date" ON "edu_payment_record" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "ix_edu_rank_class_exam" ON "edu_ranking_snapshot" USING btree ("class_id","exam_name");--> statement-breakpoint
CREATE INDEX "ix_edu_rank_student" ON "edu_ranking_snapshot" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "ix_edu_rank_date" ON "edu_ranking_snapshot" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "ix_edu_refund_student" ON "edu_refund_record" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "ix_edu_refund_class" ON "edu_refund_record" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "ix_edu_refund_payment" ON "edu_refund_record" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "ix_edu_refund_status" ON "edu_refund_record" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_edu_sched_change_schedule" ON "edu_schedule_change" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "ix_edu_sched_change_class" ON "edu_schedule_change" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "ix_edu_sched_change_status" ON "edu_schedule_change" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_edu_sched_change_applicant" ON "edu_schedule_change" USING btree ("applicant_id");--> statement-breakpoint
CREATE INDEX "ix_edu_sched_rule_term" ON "edu_scheduling_rule" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX "ix_edu_sched_rule_class" ON "edu_scheduling_rule" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "ix_edu_sched_rule_teacher" ON "edu_scheduling_rule" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "ix_edu_sched_rule_weekday" ON "edu_scheduling_rule" USING btree ("weekday");--> statement-breakpoint
CREATE INDEX "ix_edu_teacher_sched_teacher" ON "edu_teacher_schedule" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "ix_edu_teacher_sched_term" ON "edu_teacher_schedule" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX "ix_edu_teacher_sched_day" ON "edu_teacher_schedule" USING btree ("day_of_week");--> statement-breakpoint
CREATE INDEX "ix_edu_trial_lead" ON "edu_trial_booking" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "ix_edu_trial_date" ON "edu_trial_booking" USING btree ("trial_date");--> statement-breakpoint
CREATE INDEX "ix_edu_trial_status" ON "edu_trial_booking" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_edu_fee_class" ON "edu_tuition_fee" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "ix_edu_fee_term" ON "edu_tuition_fee" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX "ix_edu_fee_active" ON "edu_tuition_fee" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_type_idx" ON "orders" USING btree ("order_type");