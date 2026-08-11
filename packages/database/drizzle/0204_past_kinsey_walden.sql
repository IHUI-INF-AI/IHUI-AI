CREATE TABLE "service_inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"company" varchar(100),
	"email" varchar(255) NOT NULL,
	"phone" varchar(30),
	"service_type" varchar(20) NOT NULL,
	"budget" varchar(20) NOT NULL,
	"description" text NOT NULL,
	"timeline" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_class" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"grade" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_course_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"course_name" varchar(200) NOT NULL,
	"teacher" varchar(100),
	"weekday" integer NOT NULL,
	"start_time" varchar(10) NOT NULL,
	"end_time" varchar(10) NOT NULL,
	"classroom" varchar(100),
	"color" varchar(20),
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_meal_recipe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"meal_type" varchar(20) NOT NULL,
	"dish_name" varchar(200) NOT NULL,
	"ingredients" text,
	"nutrition" varchar(500),
	"image_url" varchar(500),
	"notes" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_meal_week_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"weekday" integer NOT NULL,
	"meal_type" varchar(20) NOT NULL,
	"dish_name" varchar(200) NOT NULL,
	"ingredients" text,
	"nutrition" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_plan_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"content" text NOT NULL,
	"objective" varchar(500),
	"due_date" date,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"student_id" uuid,
	"parent_item_id" uuid,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_study_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"plan_type" varchar(20) NOT NULL,
	"creator_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"parent_plan_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edu_term" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "edu_class" ADD CONSTRAINT "edu_class_term_id_edu_term_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."edu_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_course_schedule" ADD CONSTRAINT "edu_course_schedule_term_id_edu_term_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."edu_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_course_schedule" ADD CONSTRAINT "edu_course_schedule_class_id_edu_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."edu_class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_plan_item" ADD CONSTRAINT "edu_plan_item_plan_id_edu_study_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."edu_study_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_plan_item" ADD CONSTRAINT "edu_plan_item_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_study_plan" ADD CONSTRAINT "edu_study_plan_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_study_plan" ADD CONSTRAINT "edu_study_plan_class_id_edu_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."edu_class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edu_study_plan" ADD CONSTRAINT "edu_study_plan_term_id_edu_term_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."edu_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_inquiries_status_idx" ON "service_inquiries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "service_inquiries_email_idx" ON "service_inquiries" USING btree ("email");--> statement-breakpoint
CREATE INDEX "ix_edu_class_term" ON "edu_class" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX "ix_edu_schedule_term" ON "edu_course_schedule" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX "ix_edu_schedule_class" ON "edu_course_schedule" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "ix_edu_schedule_weekday" ON "edu_course_schedule" USING btree ("weekday");--> statement-breakpoint
CREATE INDEX "ix_edu_meal_date" ON "edu_meal_recipe" USING btree ("date");--> statement-breakpoint
CREATE INDEX "ix_edu_meal_type" ON "edu_meal_recipe" USING btree ("meal_type");--> statement-breakpoint
CREATE INDEX "ix_edu_meal_tpl_weekday" ON "edu_meal_week_template" USING btree ("weekday");--> statement-breakpoint
CREATE INDEX "ix_edu_meal_tpl_name" ON "edu_meal_week_template" USING btree ("name");--> statement-breakpoint
CREATE INDEX "ix_edu_plan_item_plan" ON "edu_plan_item" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "ix_edu_plan_item_student" ON "edu_plan_item" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "ix_edu_plan_item_parent" ON "edu_plan_item" USING btree ("parent_item_id");--> statement-breakpoint
CREATE INDEX "ix_edu_plan_class" ON "edu_study_plan" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "ix_edu_plan_term" ON "edu_study_plan" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX "ix_edu_plan_type" ON "edu_study_plan" USING btree ("plan_type");--> statement-breakpoint
CREATE INDEX "ix_edu_plan_parent" ON "edu_study_plan" USING btree ("parent_plan_id");--> statement-breakpoint
CREATE INDEX "ix_edu_term_current" ON "edu_term" USING btree ("is_current");