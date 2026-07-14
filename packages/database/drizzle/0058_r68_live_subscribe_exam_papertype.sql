-- R68 补齐: live_subscribe.channel_id 由 integer 改为 uuid + 新增 (user_id, channel_id) 唯一约束
--           exam_papers 表新增 paper_type 列
-- 对应 schema:
--   packages/database/src/schema/live-extended.ts (liveSubscribe)
--   packages/database/src/schema/exam.ts (examPapers)

-- 1. live_subscribe: channel_id integer → uuid
ALTER TABLE "live_subscribe" ALTER COLUMN "channel_id" TYPE uuid USING "channel_id"::uuid;

-- 2. live_subscribe: 新增 (user_id, channel_id) 唯一约束
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'live_subscribe_user_channel_uniq') THEN
    ALTER TABLE "live_subscribe" ADD CONSTRAINT "live_subscribe_user_channel_uniq" UNIQUE ("user_id", "channel_id");
  END IF;
END $$;

-- 3. exam_papers: 新增 paper_type 列
ALTER TABLE "exam_papers" ADD COLUMN IF NOT EXISTS "paper_type" varchar(50) NOT NULL DEFAULT 'normal';
