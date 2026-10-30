#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// PG 数据库每日备份脚本
// ⚠ 备份拥有者状态(2026-09-06 收口为单一拥有者;2026-10-27 现读更新承载体):
//   - 唯一权威备份 = IHUI-PG-BACKUP 调度链 → <DevEnvRoot>\backups\pg\*.dump(每日03:00,7天轮转)+ 网盘同步副本。
//     承载体历史:原为 NSSM 服务;2026-10-27 本机实测 nssm.exe/同名服务/同名计划任务全部不在位
//     (换机后调度面失联),已复注册为 Windows 计划任务 \IHUI-PG-BACKUP(见 deploy/win/ihui-pg-backup-scheduler.ps1 头注)。
//     DevEnvRoot 现值按当次实测取(IHUI_DEVENV_ROOT 覆盖,否则仓根所在盘派生),不在本文写死盘符。
//   - 本脚本(输出 <仓库根>/backups/pg/*.sql.gz)原由 BullMQ 'pg-backup-daily'(每日02:30)调度,
//     因调度静默失败/文件不累积、与权威链重复,已于 2026-09-06 从 scheduler.ts 下线,不再纳入备份监控。
//     → 本脚本现仅供【临时/手动】导出验证,不作为生产备份链。
// 用法:
//   1) 手动:    node apps/api/scripts/pg-backup.mjs
//   (每日自动调度已移除)
//
// 输出: <仓库>/backups/pg/<db>-YYYYMMDD-HHmmss.sql.gz (gzip 压缩)
// 保留: 最近 30 份, 老的自动删除
// 自校: 落盘后完整解压校验 gzip 完整性 + 含建表语句 + 非空, 失败即终止轮转并 exit 1
import { spawn } from 'node:child_process'
import {
  readFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  createReadStream,
  createWriteStream,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { createGzip, createGunzip } from 'node:zlib'
import { fileURLToPath } from 'node:url'
// pg_dump/psql 定位的唯一实现(全仓一份,与 check-migration-* 两门同源;§0.6 单一真相源,禁止在此抄第二份候选表)
import { locatePsqlClient, psqlLocateMissText } from '../../../scripts/lib/psql-client-locate.mjs' // arch-exempt: 本脚本是临时/手动导出验证(非生产备份链,见头注);psql 定位是全仓唯一实现(§0.6 单一真相源,本行注释明令禁止抄第二份候选表),与 scripts 侧 check-migration-* 两门同源——挪包牵动 8 个调用方与策略表公开出口,收益为零,按行内豁免走

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
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)
const url = env.DATABASE_URL
if (!url) {
  console.error('[pg-backup] ❌ .env 中无 DATABASE_URL')
  process.exit(1)
}
const m = url.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/)
if (!m) {
  console.error('[pg-backup] ❌ DATABASE_URL 格式不正确:', url)
  process.exit(1)
}
const [, user, pass, host, port, db] = m

// 2) 找 pg_dump(2026-10-27 改探测式,G-70 备份链重建③)
// 旧写法是一张写死盘符的候选表 + 落空后静默回落裸 'pg_dump':换机后 D:\DevEnv\runtimes\pgsql
// 已不存在、候选表停在 17 而本机 PG 是 18.6,回落值要到 spawn ENOENT 才炸(§0.3「没判」冒充「判过」)。
// 现与全仓唯一实现 scripts/lib/psql-client-locate.mjs 同源的候选序取 psql,pg_dump 走同目录兄弟路径;
// 候选全落空 ⇒ 显式点名已试清单并 exit 1,不做任何静默回落。
const located = locatePsqlClient()
if (!located.psql) {
  console.error(`[pg-backup] ❌ 定位失败:${psqlLocateMissText(located.tried)}`)
  process.exit(1)
}
const pgDumpExe = located.psql === 'psql' ? 'pg_dump' : join(dirname(located.psql), 'pg_dump.exe')
if (located.psql !== 'psql' && !existsSync(pgDumpExe)) {
  // psql 在位而同目录没有 pg_dump.exe:原因必须点名到具体目录,不回落裸 PATH(两回事不混判)
  console.error(`[pg-backup] ❌ psql 在位(${located.psql})但同目录缺 pg_dump.exe:${pgDumpExe}`)
  process.exit(1)
}
console.log(`[pg-backup] 🔧 pg_dump = ${pgDumpExe}(psql 同源解析,候选清单见 psql-client-locate)`)

// 3) 准备输出
if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true })
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-')
const outFile = join(BACKUP_DIR, `${db}-${stamp}.sql.gz`)

console.log(`[pg-backup] 📦 ${db}@${host}:${port} → ${outFile}`)

// 4) pg_dump | gzip
const pgDump = spawn(
  pgDumpExe,
  [
    '-h',
    host,
    '-p',
    port,
    '-U',
    user,
    '-d',
    db,
    '--no-owner',
    '--no-privileges',
    '--clean',
    '--if-exists',
  ],
  {
    env: { ...process.env, PGPASSWORD: pass },
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  },
)

const gzip = createGzip()
const out = createWriteStream(outFile)
pgDump.stdout.pipe(gzip).pipe(out)

let pgErr = ''
pgDump.stderr.on('data', (d) => (pgErr += d))
pgDump.on('error', (e) => {
  console.error('[pg-backup] ❌ pg_dump 启动失败:', e.message)
  process.exit(1)
})

await new Promise((resolve, reject) => {
  let finished = 0
  const check = () => {
    if (finished === 2) resolve()
  }
  pgDump.on('close', (code) => {
    if (code !== 0) {
      console.error(`[pg-backup] ❌ pg_dump 退出码 ${code}\n${pgErr}`)
      return reject(new Error(`pg_dump exit ${code}`))
    }
    console.log('[pg-backup] ✓ pg_dump 完成')
    finished++
    check()
  })
  out.on('finish', () => {
    console.log('[pg-backup] ✓ gzip 压缩完成')
    finished++
    check()
  })
  out.on('error', reject)
})

// 5) 自我完整性校验：完整解压一遍，验证 gzip 未被截断/损坏，并确认解压后非空含建表语句。
//    pg_dump 干净退出(exit 0)通常够；但管道 SIGPIPE 或磁盘写满等仍可能产出损坏文件。
//    此步让每次备份在轮转前自证"可被完整解压"，损坏则给出明确错误提示并终止轮转。
try {
  let decompressedBytes = 0
  let sawCreateTable = false
  await new Promise((resolve, reject) => {
    const gunzip = createGunzip()
    const rs = createReadStream(outFile)
    rs.on('error', reject)
    rs.pipe(gunzip)
    gunzip.on('data', (chunk) => {
      decompressedBytes += chunk.length
      if (!sawCreateTable && chunk.toString('utf8').includes('CREATE TABLE')) sawCreateTable = true
    })
    gunzip.on('error', reject)
    gunzip.on('end', resolve)
  })
  if (decompressedBytes <= 0) throw new Error('解压后为空(0 字节)')
  if (!sawCreateTable) throw new Error('解压内容不含 CREATE TABLE,疑似非完整 SQL dump')
  console.log(
    `[pg-backup] 🔍 完整性校验通过: 解压 ${(decompressedBytes / 1024).toFixed(1)} KB, 含建表语句`,
  )
} catch (e) {
  console.error(
    `[pg-backup] ❌ 完整性校验失败: ${e.message} —— 本次备份不可信,终止轮转避免误删可用备份`,
  )
  process.exit(1)
}

// 6) 轮转: 只保留最近 KEEP 份
const files = readdirSync(BACKUP_DIR)
  .filter((f) => f.endsWith('.sql.gz'))
  .map((f) => ({ f, m: statSync(join(BACKUP_DIR, f)).mtimeMs }))
  .sort((a, b) => b.m - a.m)
const toDelete = files.slice(KEEP)
for (const x of toDelete) {
  try {
    unlinkSync(join(BACKUP_DIR, x.f))
    console.log(`[pg-backup] 🗑  ${x.f}`)
  } catch (e) {
    console.warn(`[pg-backup] ⚠  ${e.message}`)
  }
}

const size = (statSync(outFile).size / 1024).toFixed(1)
console.log(`[pg-backup] ✅ 完成: ${outFile} (${size} KB)`)
console.log(`[pg-backup] 📊 当前共 ${Math.min(files.length, KEEP)} 份, 保留最近 ${KEEP} 份`)
// ⁠​‌​​‌​​‌
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
