/**
 * 临时 migration 脚本:把 0126_ai-world-sync.sql 应用到当前数据库。
 * 处理 NOT NULL 列兼容:先加可空列,UPDATE 填默认值,再 SET NOT NULL。
 */
import 'dotenv/config'
import { db } from '../src/db/index.js'
import { sql } from 'drizzle-orm'

async function exec(stmt: string) {
  try {
    await db.execute(sql.raw(stmt))
    console.log('OK:', stmt.slice(0, 80))
  } catch (e) {
    const msg = (e as Error).message
    if (msg.includes('already exists') || msg.includes('does not exist')) {
      console.log('SKIP:', msg.slice(0, 80))
    } else {
      console.error('FAIL:', stmt.slice(0, 80), '→', msg.slice(0, 120))
      throw e
    }
  }
}

async function main() {
  // 1. sync_log 表
  await exec(`CREATE TABLE IF NOT EXISTS "ai_world_sync_log" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "source" varchar(200) NOT NULL,
    "kind" varchar(32) NOT NULL,
    "status" varchar(32) NOT NULL,
    "started_at" timestamp with time zone NOT NULL,
    "finished_at" timestamp with time zone,
    "item_count" integer DEFAULT 0 NOT NULL,
    "error" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`)

  // 2. categories 字段扩展(可空 → 填值 → NOT NULL)
  await exec(`ALTER TABLE "ai_world_categories" ADD COLUMN IF NOT EXISTS "slug" varchar(100)`)
  await exec(`UPDATE "ai_world_categories" SET "slug" = "id"::text WHERE "slug" IS NULL`)
  await exec(`ALTER TABLE "ai_world_categories" ALTER COLUMN "slug" SET NOT NULL`)
  await exec(`ALTER TABLE "ai_world_categories" ADD COLUMN IF NOT EXISTS "description" varchar(500)`)
  await exec(`ALTER TABLE "ai_world_categories" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL`)
  await exec(`ALTER TABLE "ai_world_categories" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL`)
  await exec(`ALTER TABLE "ai_world_categories" ALTER COLUMN "icon" SET DATA TYPE varchar(100)`)

  // 3. items 字段扩展
  await exec(`ALTER TABLE "ai_world_items" ALTER COLUMN "title" SET DATA TYPE varchar(500)`)
  await exec(`ALTER TABLE "ai_world_items" ALTER COLUMN "cover_image" SET DATA TYPE varchar(1000)`)
  await exec(`ALTER TABLE "ai_world_items" ADD COLUMN IF NOT EXISTS "kind" varchar(32)`)
  await exec(`UPDATE "ai_world_items" SET "kind" = 'news' WHERE "kind" IS NULL`)
  await exec(`ALTER TABLE "ai_world_items" ALTER COLUMN "kind" SET NOT NULL`)
  await exec(`ALTER TABLE "ai_world_items" ADD COLUMN IF NOT EXISTS "slug" varchar(200)`)
  await exec(`ALTER TABLE "ai_world_items" ADD COLUMN IF NOT EXISTS "summary" varchar(1000)`)
  await exec(`ALTER TABLE "ai_world_items" ADD COLUMN IF NOT EXISTS "url" varchar(1000)`)
  await exec(`ALTER TABLE "ai_world_items" ADD COLUMN IF NOT EXISTS "source" varchar(200)`)
  await exec(`UPDATE "ai_world_items" SET "source" = 'user' WHERE "source" IS NULL`)
  await exec(`ALTER TABLE "ai_world_items" ALTER COLUMN "source" SET NOT NULL`)
  await exec(`ALTER TABLE "ai_world_items" ADD COLUMN IF NOT EXISTS "source_url" varchar(1000)`)
  await exec(`ALTER TABLE "ai_world_items" ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone`)
  await exec(`ALTER TABLE "ai_world_items" ADD COLUMN IF NOT EXISTS "fetched_at" timestamp with time zone DEFAULT now() NOT NULL`)
  await exec(`ALTER TABLE "ai_world_items" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL`)
  await exec(`ALTER TABLE "ai_world_items" ADD COLUMN IF NOT EXISTS "like_count" integer DEFAULT 0 NOT NULL`)

  // 4. 索引
  await exec(`CREATE INDEX IF NOT EXISTS "ix_ai_world_sync_log_source" ON "ai_world_sync_log" USING btree ("source")`)
  await exec(`CREATE INDEX IF NOT EXISTS "ix_ai_world_sync_log_started_at" ON "ai_world_sync_log" USING btree ("started_at")`)
  await exec(`CREATE INDEX IF NOT EXISTS "ix_ai_world_items_kind" ON "ai_world_items" USING btree ("kind")`)
  await exec(`CREATE INDEX IF NOT EXISTS "ix_ai_world_items_source" ON "ai_world_items" USING btree ("source")`)

  // 5. 唯一约束
  await exec(`ALTER TABLE "ai_world_categories" DROP CONSTRAINT IF EXISTS "ai_world_categories_slug_unique"`)
  await exec(`ALTER TABLE "ai_world_categories" ADD CONSTRAINT "ai_world_categories_slug_unique" UNIQUE("slug")`)
  await exec(`ALTER TABLE "ai_world_items" DROP CONSTRAINT IF EXISTS "uq_ai_world_items_kind_source_url"`)
  await exec(`ALTER TABLE "ai_world_items" ADD CONSTRAINT "uq_ai_world_items_kind_source_url" UNIQUE("kind","source_url")`)

  console.log('migration done')
  process.exit(0)
}

main().catch((e) => {
  console.error('migration failed:', e)
  process.exit(1)
})
