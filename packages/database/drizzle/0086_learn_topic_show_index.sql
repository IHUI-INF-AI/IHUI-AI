-- Custom migration: add is_show_index to learn_topic
ALTER TABLE "learn_topic" ADD COLUMN IF NOT EXISTS "is_show_index" boolean DEFAULT true NOT NULL;
