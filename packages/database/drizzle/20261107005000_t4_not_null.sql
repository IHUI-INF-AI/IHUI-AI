-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 补偿迁移(2026-11-07): 把 schema 已声明 NOT NULL、实库仍可空的 13 列收紧为 NOT NULL
-- 证据: information_schema 实读 13 列 is_nullable=YES;dev 逐列 NULL 计数全为 0(relay_* 0 行,users 21 行 status NULL=0)。
-- 每列先探测 NULL:非 0 则明确报错,绝不静默 SET NOT NULL 失败。
DO $$
DECLARE n bigint;
BEGIN
  IF to_regclass('public.relay_conversations') IS NOT NULL THEN
    SELECT count(*) INTO n FROM "public"."relay_conversations" WHERE "message_count" IS NULL;
    IF n > 0 THEN
      RAISE EXCEPTION 'relay_conversations.message_count: % 行 NULL,需先回填再 SET NOT NULL', n;
    END IF;
    ALTER TABLE "public"."relay_conversations" ALTER COLUMN "message_count" SET NOT NULL;
  END IF;
END $$;--> statement-breakpoint
DO $$
DECLARE n bigint;
BEGIN
  IF to_regclass('public.relay_conversations') IS NOT NULL THEN
    SELECT count(*) INTO n FROM "public"."relay_conversations" WHERE "total_tokens" IS NULL;
    IF n > 0 THEN
      RAISE EXCEPTION 'relay_conversations.total_tokens: % 行 NULL,需先回填再 SET NOT NULL', n;
    END IF;
    ALTER TABLE "public"."relay_conversations" ALTER COLUMN "total_tokens" SET NOT NULL;
  END IF;
END $$;--> statement-breakpoint
DO $$
DECLARE n bigint;
BEGIN
  IF to_regclass('public.relay_conversations') IS NOT NULL THEN
    SELECT count(*) INTO n FROM "public"."relay_conversations" WHERE "total_cost_cents" IS NULL;
    IF n > 0 THEN
      RAISE EXCEPTION 'relay_conversations.total_cost_cents: % 行 NULL,需先回填再 SET NOT NULL', n;
    END IF;
    ALTER TABLE "public"."relay_conversations" ALTER COLUMN "total_cost_cents" SET NOT NULL;
  END IF;
END $$;--> statement-breakpoint
DO $$
DECLARE n bigint;
BEGIN
  IF to_regclass('public.relay_conversations') IS NOT NULL THEN
    SELECT count(*) INTO n FROM "public"."relay_conversations" WHERE "last_message_at" IS NULL;
    IF n > 0 THEN
      RAISE EXCEPTION 'relay_conversations.last_message_at: % 行 NULL,需先回填再 SET NOT NULL', n;
    END IF;
    ALTER TABLE "public"."relay_conversations" ALTER COLUMN "last_message_at" SET NOT NULL;
  END IF;
END $$;--> statement-breakpoint
DO $$
DECLARE n bigint;
BEGIN
  IF to_regclass('public.relay_conversations') IS NOT NULL THEN
    SELECT count(*) INTO n FROM "public"."relay_conversations" WHERE "created_at" IS NULL;
    IF n > 0 THEN
      RAISE EXCEPTION 'relay_conversations.created_at: % 行 NULL,需先回填再 SET NOT NULL', n;
    END IF;
    ALTER TABLE "public"."relay_conversations" ALTER COLUMN "created_at" SET NOT NULL;
  END IF;
END $$;--> statement-breakpoint
DO $$
DECLARE n bigint;
BEGIN
  IF to_regclass('public.relay_conversations') IS NOT NULL THEN
    SELECT count(*) INTO n FROM "public"."relay_conversations" WHERE "updated_at" IS NULL;
    IF n > 0 THEN
      RAISE EXCEPTION 'relay_conversations.updated_at: % 行 NULL,需先回填再 SET NOT NULL', n;
    END IF;
    ALTER TABLE "public"."relay_conversations" ALTER COLUMN "updated_at" SET NOT NULL;
  END IF;
END $$;--> statement-breakpoint
DO $$
DECLARE n bigint;
BEGIN
  IF to_regclass('public.relay_messages') IS NOT NULL THEN
    SELECT count(*) INTO n FROM "public"."relay_messages" WHERE "prompt_tokens" IS NULL;
    IF n > 0 THEN
      RAISE EXCEPTION 'relay_messages.prompt_tokens: % 行 NULL,需先回填再 SET NOT NULL', n;
    END IF;
    ALTER TABLE "public"."relay_messages" ALTER COLUMN "prompt_tokens" SET NOT NULL;
  END IF;
END $$;--> statement-breakpoint
DO $$
DECLARE n bigint;
BEGIN
  IF to_regclass('public.relay_messages') IS NOT NULL THEN
    SELECT count(*) INTO n FROM "public"."relay_messages" WHERE "completion_tokens" IS NULL;
    IF n > 0 THEN
      RAISE EXCEPTION 'relay_messages.completion_tokens: % 行 NULL,需先回填再 SET NOT NULL', n;
    END IF;
    ALTER TABLE "public"."relay_messages" ALTER COLUMN "completion_tokens" SET NOT NULL;
  END IF;
END $$;--> statement-breakpoint
DO $$
DECLARE n bigint;
BEGIN
  IF to_regclass('public.relay_messages') IS NOT NULL THEN
    SELECT count(*) INTO n FROM "public"."relay_messages" WHERE "total_tokens" IS NULL;
    IF n > 0 THEN
      RAISE EXCEPTION 'relay_messages.total_tokens: % 行 NULL,需先回填再 SET NOT NULL', n;
    END IF;
    ALTER TABLE "public"."relay_messages" ALTER COLUMN "total_tokens" SET NOT NULL;
  END IF;
END $$;--> statement-breakpoint
DO $$
DECLARE n bigint;
BEGIN
  IF to_regclass('public.relay_messages') IS NOT NULL THEN
    SELECT count(*) INTO n FROM "public"."relay_messages" WHERE "cost_cents" IS NULL;
    IF n > 0 THEN
      RAISE EXCEPTION 'relay_messages.cost_cents: % 行 NULL,需先回填再 SET NOT NULL', n;
    END IF;
    ALTER TABLE "public"."relay_messages" ALTER COLUMN "cost_cents" SET NOT NULL;
  END IF;
END $$;--> statement-breakpoint
DO $$
DECLARE n bigint;
BEGIN
  IF to_regclass('public.relay_messages') IS NOT NULL THEN
    SELECT count(*) INTO n FROM "public"."relay_messages" WHERE "status" IS NULL;
    IF n > 0 THEN
      RAISE EXCEPTION 'relay_messages.status: % 行 NULL,需先回填再 SET NOT NULL', n;
    END IF;
    ALTER TABLE "public"."relay_messages" ALTER COLUMN "status" SET NOT NULL;
  END IF;
END $$;--> statement-breakpoint
DO $$
DECLARE n bigint;
BEGIN
  IF to_regclass('public.relay_messages') IS NOT NULL THEN
    SELECT count(*) INTO n FROM "public"."relay_messages" WHERE "created_at" IS NULL;
    IF n > 0 THEN
      RAISE EXCEPTION 'relay_messages.created_at: % 行 NULL,需先回填再 SET NOT NULL', n;
    END IF;
    ALTER TABLE "public"."relay_messages" ALTER COLUMN "created_at" SET NOT NULL;
  END IF;
END $$;--> statement-breakpoint
DO $$
DECLARE n bigint;
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    SELECT count(*) INTO n FROM "public"."users" WHERE "status" IS NULL;
    IF n > 0 THEN
      RAISE EXCEPTION 'users.status: % 行 NULL,需先回填再 SET NOT NULL', n;
    END IF;
    ALTER TABLE "public"."users" ALTER COLUMN "status" SET NOT NULL;
  END IF;
END $$;--> statement-breakpoint
