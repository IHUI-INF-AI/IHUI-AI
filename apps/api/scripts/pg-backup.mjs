#!/usr/bin/env node
// PG 数据库每日备份脚本
// 用法:
//   1) 手动:    node apps/api/scripts/pg-backup.mjs
//   2) 每日 02:00 自动: 由 apps/api/src/plugins/scheduler.ts 的 'data-archive-daily' 任务触发
//
// 输出: g:\IHUI-AI\backups\pg\ihui-YYYYMMDD-HHmmss.sql.gz (gzip 压缩)
// 保留: 最近 30 份, 老的自动删除
import { spawn } from 'node:child_process'
import { readFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, createWriteStream } from 'node:fs'
import { join } from 'node:path'
import { createGzip } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
// 脚本位于 apps/api/scripts/, 上 3 级到仓库根
const ROOT = join(__dirname, '..', '..', '..')
const BACKUP_DIR = join(ROOT, 'backups', 'pg')
const KEEP = 30

// 1) 解析 DATABASE_URL (从 apps/api/.env)
const envPath = join(ROOT, 'apps', 'api', '.env')
if (!existsSync(envPath)) {
  console.error(`[pg-backup] ❌ 找不到 ${envPath}`)
  process.exit(1)
}
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const url = env.DATABASE_URL
if (!url) { console.error('[pg-backup] ❌ .env 中无 DATABASE_URL'); process.exit(1) }
const m = url.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/)
if (!m) { console.error('[pg-backup] ❌ DATABASE_URL 格式不正确:', url); process.exit(1) }
const [, user, pass, host, port, db] = m

// 2) 找 pg_dump
const PG_PATHS = [
  'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe',
  'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe',
  'C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe',
  'C:\\Program Files\\PostgreSQL\\14\\bin\\pg_dump.exe',
  'pg_dump',
]
const pgDumpExe = PG_PATHS.find(p => existsSync(p)) ?? 'pg_dump'
if (!existsSync(pgDumpExe) && pgDumpExe === 'pg_dump') {
  console.error('[pg-backup] ❌ 找不到 pg_dump, 请安装 PostgreSQL 客户端或加入 PATH')
  process.exit(1)
}

// 3) 准备输出
if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true })
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-')
const outFile = join(BACKUP_DIR, `${db}-${stamp}.sql.gz`)

console.log(`[pg-backup] 📦 ${db}@${host}:${port} → ${outFile}`)

// 4) pg_dump | gzip
const pgDump = spawn(pgDumpExe, [
  '-h', host, '-p', port, '-U', user, '-d', db,
  '--no-owner', '--no-privileges', '--clean', '--if-exists',
], { env: { ...process.env, PGPASSWORD: pass } })

const gzip = createGzip()
const out = createWriteStream(outFile)
pgDump.stdout.pipe(gzip).pipe(out)

let pgErr = ''
pgDump.stderr.on('data', d => pgErr += d)
pgDump.on('error', e => { console.error('[pg-backup] ❌ pg_dump 启动失败:', e.message); process.exit(1) })

await new Promise((resolve, reject) => {
  let finished = 0
  const check = () => { if (finished === 2) resolve() }
  pgDump.on('close', code => {
    if (code !== 0) { console.error(`[pg-backup] ❌ pg_dump 退出码 ${code}\n${pgErr}`); return reject(new Error(`pg_dump exit ${code}`)) }
    console.log('[pg-backup] ✓ pg_dump 完成'); finished++; check()
  })
  out.on('finish', () => { console.log('[pg-backup] ✓ gzip 压缩完成'); finished++; check() })
  out.on('error', reject)
})

// 5) 轮转: 只保留最近 KEEP 份
const files = readdirSync(BACKUP_DIR)
  .filter(f => f.endsWith('.sql.gz'))
  .map(f => ({ f, m: statSync(join(BACKUP_DIR, f)).mtimeMs }))
  .sort((a, b) => b.m - a.m)
const toDelete = files.slice(KEEP)
for (const x of toDelete) {
  try { unlinkSync(join(BACKUP_DIR, x.f)); console.log(`[pg-backup] 🗑  ${x.f}`) }
  catch (e) { console.warn(`[pg-backup] ⚠  ${e.message}`) }
}

const size = (statSync(outFile).size / 1024).toFixed(1)
console.log(`[pg-backup] ✅ 完成: ${outFile} (${size} KB)`)
console.log(`[pg-backup] 📊 当前共 ${Math.min(files.length, KEEP)} 份, 保留最近 ${KEEP} 份`)
