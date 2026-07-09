-- Wave 19: Edu point module (channels/rules/relations/records)
CREATE TABLE IF NOT EXISTS "edu_point_channels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "code" varchar(50),
  "description" text,
  "sort" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "edu_points" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "code" varchar(50),
  "channel_id" uuid REFERENCES "edu_point_channels"("id") ON DELETE SET NULL,
  "point" integer DEFAULT 0 NOT NULL,
  "description" text,
  "sort" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "edu_points_channel_idx" ON "edu_points"("channel_id");

CREATE TABLE IF NOT EXISTS "edu_point_channel_relations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "point_id" uuid NOT NULL REFERENCES "edu_points"("id") ON DELETE CASCADE,
  "channel_id" uuid NOT NULL REFERENCES "edu_point_channels"("id") ON DELETE CASCADE,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "edu_point_channel_relation_unique" UNIQUE("point_id","channel_id")
);
CREATE INDEX IF NOT EXISTS "edu_point_channel_relations_point_idx" ON "edu_point_channel_relations"("point_id");
CREATE INDEX IF NOT EXISTS "edu_point_channel_relations_channel_idx" ON "edu_point_channel_relations"("channel_id");

CREATE TABLE IF NOT EXISTS "edu_point_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "member_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "point" integer NOT NULL,
  "balance" integer NOT NULL,
  "type" varchar(32) NOT NULL,
  "description" varchar(255),
  "ref_id" varchar(64),
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "edu_point_records_member_idx" ON "edu_point_records"("member_id");
