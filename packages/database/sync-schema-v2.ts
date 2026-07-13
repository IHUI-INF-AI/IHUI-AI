import postgres from 'postgres'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const connectionString = 'postgresql://postgres:postgres@localhost:5432/ihui'
const sql = postgres(connectionString, { max: 1, timeout: 120000, onnotice: () => {} })

const configPath = join(__dirname, 'drizzle.config.ts')
let migrationsFolder = join(__dirname, 'drizzle')
try {
  if (existsSync(configPath)) {
    const config = readFileSync(configPath, 'utf8')
    const match = config.match(/out:\s*[```'"`]([^```'"`]+)[```'"`]/)
    if (match) migrationsFolder = join(__dirname, match[1])
  }
} catch {}

console.log(`Migrations folder: ${migrationsFolder}`)
if (!existsSync(migrationsFolder)) {
  console.error('Not found')
  await sql.end()
  process.exit(1)
}

const files = readdirSync(migrationsFolder)
  .filter((f) => f.endsWith('.sql'))
  .sort()
console.log(`Found ${files.length} migration files`)

function splitStatements(content: string): string[] {
  // 移除单行注释
  const lines = content.split(/\r?\n/).filter((l) => !l.trim().startsWith('--'))
  const text = lines.join('\n')
  // 优先按 statement-breakpoint 分割
  let stmts: string[]
  if (text.includes('--> statement-breakpoint')) {
    stmts = text.split('--> statement-breakpoint')
  } else {
    stmts = text.split(';')
  }
  return stmts.map((s) => s.trim().replace(/;$/, '').trim()).filter((s) => s.length > 0)
}

let totalStatements = 0
let successStatements = 0
let skippedStatements = 0
const errors: string[] = []

for (const file of files) {
  const filePath = join(migrationsFolder, file)
  const content = readFileSync(filePath, 'utf8')
  const statements = splitStatements(content)

  let fileSuccess = 0
  let fileSkipped = 0

  for (const stmt of statements) {
    totalStatements++
    try {
      await sql.unsafe(stmt)
      successStatements++
      fileSuccess++
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (
        msg.includes('already exists') ||
        msg.includes('已经存在') ||
        msg.includes('不存在') ||
        msg.includes('does not exist') ||
        msg.includes('duplicate_table') ||
        msg.includes('42710') ||
        msg.includes('42P07') ||
        msg.includes('42701') ||
        msg.includes('multiple primary keys') ||
        msg.includes('23505')
      ) {
        skippedStatements++
        fileSkipped++
      } else {
        errors.push(`[${file}] ${msg.slice(0, 200)}`)
        skippedStatements++
        fileSkipped++
      }
    }
  }
  console.log(`  ${file}: OK=${fileSuccess} SKIP=${fileSkipped}`)
}

console.log(
  `\nTotal: ${totalStatements} | Success: ${successStatements} | Skipped: ${skippedStatements} | Errors: ${errors.length}`,
)
if (errors.length > 0) {
  console.log('\nFirst 20 errors:')
  for (const e of errors.slice(0, 20)) console.log(`  ${e}`)
}

const tables =
  await sql`SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema = 'public'`
console.log(`\nFinal table count: ${tables[0].count}`)

await sql.end()
process.exit(0)
