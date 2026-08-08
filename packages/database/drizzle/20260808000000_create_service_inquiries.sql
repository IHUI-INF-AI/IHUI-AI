CREATE TABLE IF NOT EXISTS "service_inquiries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(50) NOT NULL,
  "company" varchar(100),
  "email" varchar(255) NOT NULL,
  "phone" varchar(30),
  "service_type" varchar(20) NOT NULL,
  "budget" varchar(20) NOT NULL,
  "description" text NOT NULL,
  "timeline" varchar(20) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "service_inquiries_status_idx" ON "service_inquiries" ("status");
CREATE INDEX IF NOT EXISTS "service_inquiries_email_idx" ON "service_inquiries" ("email");