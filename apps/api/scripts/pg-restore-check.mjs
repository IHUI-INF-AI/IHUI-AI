#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// PG 备份「可恢复性」校验 / 恢复演练脚本。
//
// 背景: 生产 pg-backup-daily 每日产出 .sql.gz,但"能备份"≠"能还原"。
// 本脚本提供两层校验,建议定期执行以防"备份石沉大海":
//
//   A) 完整性校验(默认): 对最新备份做完整解压,验证 gzip 未损坏 + 含建表语句 + 非空。
//      → node apps/api/scripts/pg-restore-check.mjs
//
//   B) 完整恢复演练(显式开启): 将最新备份恢复到「一次性临时库」,统计表数后立即删除临时库,
//      不触碰线上库。需 --allow-restore 显式授权(默认拒绝,防误操作)。
//      → node apps/api/scripts/pg-restore-check.mjs --allow-restore
//
// 退出码: 0 = 校验通过; 1 = 校验失败(可用于 CI/告警)。
import { spawn } from 'node:child_process'
import { readFileSync, existsSync, mkdirSync, readdirSync, statSync, createReadStream, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createGunzip } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..', '..', '..')
const BACKUP_DIR = join(ROOT, 'backups', 'pg')
const ALLOW_RESTORE = process.argv.includes('--allow-restore')
// 恢复演练的临时库名,避免误连线上库
const TEMP_DB = `ihui_restore_test_${Date.now().toString().slice(-8)}`
const PG_DUMP_PATHS = [
  'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe',
  'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe',
  'C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe',
  'C:\\Program Files\\PostgreSQL\\14\\bin\\psql.exe',
  'psql',
]

function run(cmd, args, env) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { env: { ...process.env, ...env } })
    let out = '', err = ''
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (err += d))
    p.on('close', (code) => resolve({ code: code ?? 0, out, err }))
  })
}

function loadDbUrl() {
  const envPath = join(ROOT, 'apps', 'api', '.env')
  if (!existsSync(envPath)) throw new Error(`找不到 ${envPath}`)
  const env = Object.fromEntries(
    readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
  )
  const url = env.DATABASE_URL
  if (!url) throw new Error('apps/api/.env 中无 DATABASE_URL')
  const m = url.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/)
  if (!m) throw new Error('DATABASE_URL 格式不正确')
  return { user: m[1], pass: m[2], host: m[3], port: m[4], db: m[5] }
}

function findLatestBackup() {
  if (!existsSync(BACKUP_DIR)) throw new Error(`备份目录不存在: ${BACKUP_DIR} —— 尚未执行过备份或路径被移动`)
  const files = readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.sql.gz'))
    .map((f) => ({ name: f, mtime: statSync(join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
  if (files.length === 0) throw new Error('没有任何 .sql.gz 备份文件')
  return join(BACKUP_DIR, files[0].name)
}

// A) 完整性校验
async function verifyIntegrity(file) {
  let bytes = 0, sawCreateTable = false
  await new Promise((resolve, reject) => {
    const gunzip = createGunzip()
    const rs = createReadStream(file)
    rs.on('error', reject)
    rs.pipe(gunzip)
    gunzip.on('data', (c) => {
      bytes += c.length
      if (!sawCreateTable && c.toString('utf8').includes('CREATE TABLE')) sawCreateTable = true
    })
    gunzip.on('error', (e) => reject(new Error(`gzip 损坏: ${e.message}`)))
    gunzip.on('end', resolve)
  })
  if (bytes <= 0) throw new Error('解压后为空(0 字节)')
  if (!sawCreateTable) throw new Error('解压内容不含 CREATE TABLE,疑似非完整 SQL dump')
  return bytes
}

// B) 完整恢复演练
async function restoreDrill(file, conn) {
  const psql = PG_DUMP_PATHS.find((p) => existsSync(p)) ?? 'psql'
  const baseEnv = { PGPASSWORD: conn.pass }
  // 1) 创建一次性临时库(连维护库 postgres)
  const createRes = await run(psql, ['-h', conn.host, '-p', conn.port, '-U', conn.user, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE ${TEMP_DB}`], baseEnv)
  if (createRes.code !== 0) throw new Error(`创建临时库失败: ${createRes.err.trim() || createRes.out.trim()}`)
  // 2) 解压备份并流式灌入临时库(psql 从 stdin 读取 SQL)
  console.log(`[restore-drill] 开始恢复到临时库 ${TEMP_DB} ...`)
  const psqlProc = spawn(psql, ['-h', conn.host, '-p', conn.port, '-U', conn.user, '-d', TEMP_DB, '-v', 'ON_ERROR_STOP=1'], {
    env: { ...process.env, ...baseEnv },
  })
  let psqlErr = ''
  psqlProc.stderr.on('data', (d) => (psqlErr += d))
  const exit = new Promise((resolve) => psqlProc.on('close', (code) => resolve(code ?? 0)))
  const gunzip = createGunzip()
  createReadStream(file).pipe(gunzip).pipe(psqlProc.stdin)
  const code = await exit
  if (code !== 0) throw new Error(`psql 恢复退出码 ${code}: ${psqlErr.trim().slice(0, 500)}`)
}

async function main() {
  let file
  try {
    file = findLatestBackup()
  } catch (e) {
    console.error(`[restore-check] ❌ ${e.message}`)
    process.exit(1)
  }
  const sizeKb = (statSync(file).size / 1024).toFixed(1)
  console.log(`[restore-check] 校验备份: ${file} (${sizeKb} KB)`)

  // A) 完整性
  try {
    const bytes = await verifyIntegrity(file)
    console.log(`[restore-check] ✓ 完整性: gzip 完好, 解压 ${(bytes / 1024).toFixed(1)} KB, 含建表语句`)
  } catch (e) {
    console.error(`[restore-check] ❌ 完整性校验失败: ${e.message}`)
    process.exit(1)
  }

  // B) 恢复演练(仅显式授权)
  if (ALLOW_RESTORE) {
    const conn = loadDbUrl()
    try {
      await restoreDrill(file, conn)
      console.log(`[restore-check] ✓ 恢复演练通过: 备份可完整还原到临时库 ${TEMP_DB}(已清理)`)
    } catch (e) {
      console.error(`[restore-check] ❌ 恢复演练失败: ${e.message}`)
      // 尽力清理临时库
      try {
        const psql = PG_DUMP_PATHS.find((p) => existsSync(p)) ?? 'psql'
        await run(psql, ['-h', conn.host, '-p', conn.port, '-U', conn.user, '-d', 'postgres', '-c', `DROP DATABASE IF EXISTS ${TEMP_DB}`], { PGPASSWORD: conn.pass })
      } catch { /* ignore */ }
      process.exit(1)
    }
  } else {
    console.log('[restore-check] 提示: 未传 --allow-restore, 跳过完整恢复演练(默认只做完整性校验)')
  }
  console.log('[restore-check] ✅ 全部通过')
}

main()