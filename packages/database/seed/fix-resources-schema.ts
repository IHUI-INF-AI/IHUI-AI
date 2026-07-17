import postgres from 'postgres'

const url = 'postgres://postgres:postgres@localhost:5432/ihui'
const sql = postgres(url, { max: 1 })

console.log('Adding missing columns to resources table...')

await sql`ALTER TABLE "resources" ADD COLUMN IF NOT EXISTS "type" varchar(50)`
console.log('  ✓ type')

await sql`ALTER TABLE "resources" ADD COLUMN IF NOT EXISTS "product_id" uuid`
console.log('  ✓ product_id')

await sql`ALTER TABLE "resources" ADD COLUMN IF NOT EXISTS "tag_id_list" jsonb`
console.log('  ✓ tag_id_list')

await sql`ALTER TABLE "resources" ADD COLUMN IF NOT EXISTS "image" varchar(500)`
console.log('  ✓ image')

await sql`ALTER TABLE "resources" ADD COLUMN IF NOT EXISTS "introduction" text`
console.log('  ✓ introduction')

await sql`ALTER TABLE "resources" ADD COLUMN IF NOT EXISTS "cid_list" jsonb`
console.log('  ✓ cid_list')

// Add indexes if missing
await sql`CREATE INDEX IF NOT EXISTS "resources_product_idx" ON "resources" ("product_id")`
console.log('  ✓ index resources_product_idx')

console.log('\nDone. Verifying...')
const cols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'resources'
  ORDER BY ordinal_position
`
console.log(`resources now has ${cols.length} columns`)

await sql.end()
