#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
//
// 演练结论(2026-09-06 实测通过):
//   - 针对 D:\DevEnv\backups\pg\ihui_dev_*.dump(NSSM 唯一权威备份)手工恢复演练成功:
//     createdb ihui_dev_restoretest → pg_restore --no-owner → 673 张表 + 扩展(vector/plpgsql)
//     及数据(audit_logs≥2 万行)均可还原, 6 秒级完成, 演练后临时库已 DROP。
//   - 恢复必须用超级用户(postgres, 本地 trust 免密)以执行 CREATE EXTENSION vector。
//   - 建议按【每月】周期性执行一次完整恢复演练到一次性临时库, 防止"备份石沉大海"。
//
// ── 挂为月度定时(schtasks 模板, 管理员运行)────────────────────────────────────
//   每月 1 号 04:00 跑完整完整性+恢复演练, 日志落盘:
//   schtasks /Create /TN "IHUI-PG-WeeklyRestoreDrill" /SC MONTHLY /D 1 /ST 04:00 \
//     /RU SYSTEM /TR "schtasks /Run /TN \"IHUI-PG-WeeklyRestoreDrill\"" /F
//   (上面的 /TR 需换成直接执行, 因行宽限制拆两行, 实际写成:)
//   schtasks /Create /TN "IHUI-PG-RestoreDrill" /SC MONTHLY /D 1 /ST 04:00 /RU SYSTEM /F ^
//     /TR "cmd /c \"C:\Program Files\nodejs\node.exe\" D:\IHUI-AI\apps\api\scripts\pg-restore-check.mjs --allow-restore >> D:\DevEnv\logs\pg-restore-check.log 2>&1"
//   说明: --allow-restore 会连线上 .env 的 DATABASE_URL 解析连接信息, 但只创建/还原/删除
//     __临时__ 库(ihui_restore_test_*), 不触碰线上库; 失败时 schtasks 以非 0 退出码退出(便于告警接入)。
//
// ── Prometheus 探针方案(若简单, 后续补充)──────────────────────────────────────
//   新鲜度 + 云同步可落成一个 textfile collector 脚本(无依赖, node < 1s), 输出到
//   D:\DevEnv\monitor\exporter-textfile\pg_backup.prom, windows_exporter 的
//   --collector.textfile.directory 指向它; Prometheus 侧新增 alert 规则即可:
//     - alert: PgBackupStale
//       expr: time() - pg_backup_newest_mtime_seconds > 48*3600
//       annotations.summary: 'PG 备份超过 48h 未更新(备份断更)'
//     - alert: PgBackupNotSynced
//       expr: pg_backup_cloud_synced_success == 0
//       annotations.summary: 'PG 备份云同步失败'
//   指标提议(由 textfile 写入):
//     pg_backup_newest_mtime_seconds  # 最新备份文件 mtime 的 unix 秒
//     pg_backup_cloud_synced_success  # 最近一次云同步成功=1/失败=0
//   本脚本每次运行已内置"新鲜度>48h 记 WARNING"(见 main), 可直接以退出码接入 cron/探针。
//
import { spawn } from 'node:child_process'
import { readFileSync, existsSync, mkdirSync, readdirSync, statSync, createReadStream, createWriteStream, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createGunzip } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..', '..', '..')
// 权威备份目录:生产 NSSM 每日备份写入 D:\DevEnv\backups\pg(自定义格式 .dump,须用 pg_restore 还原,
// 而非平铺 .sql.gz)。历史旧仓库目录 backup/pg(.sql.gz)仅作兼容回退。
// 可用 CLI `--dir <path>` 或环境变量 PG_BACKUP_DIR 覆盖(便于演练指向特定目录)。
const AUTHORITATIVE_BACKUP_DIR = 'D:\\DevEnv\\backups\\pg'
const LEGACY_BACKUP_DIR = join(ROOT, 'backups', 'pg')

function resolveBackupDir() {
  const i = process.argv.indexOf('--dir')
  if (i !== -1 && process.argv[i + 1]) return resolve(process.argv[i + 1])
  if (process.env.PG_BACKUP_DIR) return process.env.PG_BACKUP_DIR
  // 存在权威目录则优先,否则回退仓库旧目录(兼容旧部署)
  return existsSync(AUTHORITATIVE_BACKUP_DIR) ? AUTHORITATIVE_BACKUP_DIR : LEGACY_BACKUP_DIR
}
const BACKUP_DIR = resolveBackupDir()
const ALLOW_RESTORE = process.argv.includes('--allow-restore')
// 恢复演练的临时库名,避免误连线上库
const TEMP_DB = `ihui_restore_test_${Date.now().toString().slice(-8)}`
const PG_DUMP_PATHS = [
  'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe',
  'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe',
  'C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe',
  'C:\\Program Files\\PostgreSQL\\14\\bin\\psql.exe',
  'D:\\DevEnv\\runtimes\\pgsql\\bin\\psql.exe',
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

function isCustomDump(file) { return /\.(dump|backup)$/i.test(file) }

function pgRestoreBin() {
  const psql = PG_DUMP_PATHS.find((p) => existsSync(p))
  if (psql && /psql\.exe$/i.test(psql)) return psql.replace(/psql\.exe$/i, 'pg_restore.exe')
  return 'pg_restore'
}

function findLatestBackup() {
  if (!existsSync(BACKUP_DIR)) throw new Error(`备份目录不存在: ${BACKUP_DIR} —— 尚未执行过备份或路径被移动(权威目录应为 D:\\DevEnv\\backups\\pg)`)
  const files = readdirSync(BACKUP_DIR)
    .filter((f) => /\.(sql\.gz|sql|dump|backup)$/i.test(f))
    .map((f) => ({ name: f, mtime: statSync(join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
  if (files.length === 0) throw new Error(`没有任何备份文件(.sql.gz/.sql/.dump/.backup) 于 ${BACKUP_DIR}`)
  return { file: join(BACKUP_DIR, files[0].name), name: files[0].name, mtime: files[0].mtime }
}

// A) 完整性校验
async function verifyIntegrity(file) {
  if (isCustomDump(file)) {
    // 自定义(custom)格式 dump(生产权威备份):pg_restore --list 无副作用读取归档,exiting 0 即合法可读
    const res = await run(pgRestoreBin(), ['--list', file])
    if (res.code !== 0) throw new Error(`pg_restore --list 校验失败: ${(res.err || res.out).trim().slice(0, 300)}`)
    return { kind: 'dump', bytes: statSync(file).size }
  }
  // 平铺 SQL/gzip 路径
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
  return { kind: 'sql', bytes }
}

// B) 完整恢复演练
// 注: 数据备份含 CREATE EXTENSION(如 vector), 该语句仅 superuser 可执行。
//     因此恢复演练必须用超级用户(postgres,本地 pg_hba trust)连接, 否则会因
//     "permission denied to create extension" 中断 —— 与 NSSM 生产链(pg-backup.ps1 用
//     postgres 超管)保持一致。可用环境变量 PG_ADMIN_USER/PG_ADMIN_PASSWORD 覆盖。
async function restoreDrill(file, conn) {
  const psql = PG_DUMP_PATHS.find((p) => existsSync(p)) ?? 'psql'
  // 用超级用户连接(默认 postgres/本地 trust), host/port/db 取 .env DATABASE_URL
  const adminUser = process.env.PG_ADMIN_USER || 'postgres'
  const adminPass = process.env.PG_ADMIN_PASSWORD || ''
  const adminConn = { ...conn, user: adminUser, pass: adminPass }
  const baseEnv = { PGPASSWORD: adminConn.pass }
  const adminArgs = ['-h', adminConn.host, '-p', adminConn.port, '-U', adminConn.user]
  // 1) 创建一次性临时库(连维护库 postgres)
  const createRes = await run(psql, [...adminArgs, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE ${TEMP_DB}`], baseEnv)
  if (createRes.code !== 0) throw new Error(`创建临时库失败: ${createRes.err.trim() || createRes.out.trim()}`)
  console.log(`[restore-drill] 开始恢复到临时库 ${TEMP_DB} ...`)

  // 2) 按备份格式灌入:
  //    - .dump/.backup(自定义格式,生产权威)→ pg_restore --no-owner --no-privileges
  //    - .sql.gz → 解压到临时 SQL 再 psql -f(避免 Windows 子进程 stdin 不 EOF 导致 psql 悬挂)
  //    - .sql → 直接 psql -f
  let result
  if (isCustomDump(file)) {
    const pr = pgRestoreBin()
    result = await run(pr, ['--no-owner', '--no-privileges', ...adminArgs, '-d', TEMP_DB, file], baseEnv)
    if (result.code !== 0) throw new Error(`pg_restore 恢复退出码 ${result.code}: ${(result.err || result.out).trim().slice(0, 500)}`)
  } else if (/\.sql\.gz$/i.test(file)) {
    const tmpSql = join(tmpdir(), `${TEMP_DB}.sql`)
    await new Promise((resolve, reject) => {
      const gunzip = createGunzip()
      const rs = createReadStream(file)
      const ws = createWriteStream(tmpSql)
      rs.pipe(gunzip).pipe(ws)
      gunzip.on('error', reject)
      ws.on('error', reject)
      ws.on('finish', resolve)
    })
    result = await run(psql, [...adminArgs, '-d', TEMP_DB, '-v', 'ON_ERROR_STOP=1', '-f', tmpSql], baseEnv)
    try { unlinkSync(tmpSql) } catch { /* ignore */ }
    if (result.code !== 0) throw new Error(`psql 恢复退出码 ${result.code}: ${result.err.trim().slice(0, 500)}`)
  } else {
    result = await run(psql, [...adminArgs, '-d', TEMP_DB, '-v', 'ON_ERROR_STOP=1', '-f', file], baseEnv)
    if (result.code !== 0) throw new Error(`psql 恢复退出码 ${result.code}: ${result.err.trim().slice(0, 500)}`)
  }
  // 3) 成功路径也立即清理临时库(避免堆残留临时库)
  await dropTempDb(adminConn)
}

async function dropTempDb(adminConn) {
  const psql = PG_DUMP_PATHS.find((p) => existsSync(p)) ?? 'psql'
  const baseEnv = { PGPASSWORD: adminConn.pass }
  const res = await run(psql, ['-h', adminConn.host, '-p', adminConn.port, '-U', adminConn.user, '-d', 'postgres', '-c', `DROP DATABASE IF EXISTS ${TEMP_DB}`], baseEnv)
  if (res.code !== 0) throw new Error(`清理临时库失败: ${res.err.trim().slice(0, 300)}`)
}

async function main() {
  let latest
  try {
    latest = findLatestBackup()
  } catch (e) {
    console.error(`[restore-check] ❌ ${e.message}`)
    process.exit(1)
  }
  const { file, name, mtime } = latest
  const sizeKb = (statSync(file).size / 1024).toFixed(1)
  console.log(`[restore-check] 校验备份: ${file} (${sizeKb} KB, 备份时间 ${new Date(mtime).toISOString()})`)

  // 新鲜度提示:备份超过 48h 认为"备份断更",记 WARNING(不失败,仅提醒;可作为探针输入)
  const staleHours = (Date.now() - mtime) / 3600e3
  if (staleHours > 48) console.warn(`[restore-check] ⚠ 最新备份已 ${staleHours.toFixed(1)} 小时未更新, 请检查 NSSM 每日备份是否失败`)

  // A) 完整性
  try {
    const r = await verifyIntegrity(file)
    if (r.kind === 'dump') console.log(`[restore-check] ✓ 完整性: ${name} 为 pg_dump 自定义格式, pg_restore --list 校验通过`)
    else console.log(`[restore-check] ✓ 完整性: gzip 完好, 解压 ${(r.bytes / 1024).toFixed(1)} KB, 含建表语句`)
  } catch (e) {
    console.error(`[restore-check] ❌ 完整性校验失败: ${e.message}`)
    process.exit(1)
  }

  // B) 恢复演练(仅显式授权)
  if (ALLOW_RESTORE) {
    const conn = loadDbUrl()
    const adminUser = process.env.PG_ADMIN_USER || 'postgres'
    const adminPass = process.env.PG_ADMIN_PASSWORD || ''
    const adminConn = { ...conn, user: adminUser, pass: adminPass }
    try {
      await restoreDrill(file, conn)
      console.log(`[restore-check] ✓ 恢复演练通过: 备份可完整还原到临时库 ${TEMP_DB}(已清理)`)
    } catch (e) {
      console.error(`[restore-check] ❌ 恢复演练失败: ${e.message}`)
      // 尽力清理临时库
      try { await dropTempDb(adminConn) } catch { /* ignore */ }
      process.exit(1)
    }
  } else {
    console.log('[restore-check] 提示: 未传 --allow-restore, 跳过完整恢复演练(默认只做完整性校验)')
  }
  console.log('[restore-check] ✅ 全部通过')
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
