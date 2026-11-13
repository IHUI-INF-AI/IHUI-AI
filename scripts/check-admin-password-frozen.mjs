#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 器物:结论行恒 ASCII,人读信息另起 */
/**
 * check-admin-password-frozen.mjs —— admin 密码冻结闸(2026-11-13 立)
 *
 * 立因:机主明令"以后也不可以再改这个密码了"。口头约束无法阻止换机、重建、或另一个
 * 会话顺手轮换,故把判据做成可执行器物 —— 本脚本读 ADMIN-PASSWORD-LOCK.json 的冻结
 * 指纹,与三处实际值逐一比对。任何一处漂移即 exit 1,指名到底是哪里被动过。
 *
 * 为什么必须三处一起看:2026-10 实测过一次"env 块陈旧而文件新"(deploy 环健康门禁
 * 拿着旧口令烧锁定预算,全程无声)。只比 db 或只比文件都会漏掉那一型。
 *
 * 安全:只输出长度 + sha256 前 12 位,绝不打印明文。
 *
 * 用法:
 *   node scripts/check-admin-password-frozen.mjs            人工/CI 巡检
 *   node scripts/check-admin-password-frozen.mjs --json     机器可读
 *   node scripts/check-admin-password-frozen.mjs --self-test 判据自检(不读真凭据)
 *
 * 退出码:0 = 三处与冻结指纹一致;1 = drift(某处被改);2 = unjudged(取不到输入)
 */
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const DEFAULT_LOCK = 'D:\\DevEnv\\secrets\\ADMIN-PASSWORD-LOCK.json'
const DEFAULT_PWD_FILE = 'D:\\DevEnv\\secrets\\admin-password.txt'
const DEFAULT_ENV_FILE = 'D:\\DevEnv\\ihui-prod\\apps\\api\\.env'
const ENV_SERVICE = 'IHUI-DEPLOYLOOP'
const ENV_KEY = 'IHUI_ADMIN_PASSWORD'

const sha12 = (s) => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 12)

/** 从 nssm 服务的 AppEnvironmentExtra 取一个键(Windows;取不到返回 null = 未判定)。 */
function readServiceEnv(name) {
  if (process.platform !== 'win32') return null
  const ps = [
    `$v=(Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\${ENV_SERVICE}\\Parameters' -ErrorAction SilentlyContinue).AppEnvironmentExtra;`,
    `if($v -is [array]){$v -join [char]10}else{$v}`,
  ].join('')
  try {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], {
      encoding: 'utf8',
      windowsHide: true,
    })
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*$`))
      if (m) return m[1]
    }
    return ''
  } catch {
    return null
  }
}

/** 从 apps/api/.env 读一个键(取不到返回 null)。 */
function readEnvFileKey(file, key) {
  if (!existsSync(file)) return null
  try {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+)$`))
      if (m) return m[1].trim().replace(/^["']|["']$/g, '')
    }
    return ''
  } catch {
    return null
  }
}

export function judge({ lock, pwdFileValue, serviceEnvValue, dbHashSha12 }) {
  // 两种指纹必须分开比:明文 → sha256(前12);库内 argon2id 哈希 → 它自己的 sha256(前12)。
  // 混用会在"完全一致"时误报 drift —— 实测 2026-11-13 首次跑就踩了这一格。
  const wantPlain = lock.passwordSha256_12
  const wantHash = lock.dbHashSha256_12
  const checks = [
    { name: 'file', want: wantPlain, got: pwdFileValue === null || pwdFileValue === undefined ? null : sha12(pwdFileValue) },
    { name: 'service-env', want: wantPlain, got: serviceEnvValue === null || serviceEnvValue === undefined ? null : sha12(serviceEnvValue) },
    { name: 'db-hash', want: wantHash, got: dbHashSha12 ?? null },
  ]
  const unjudged = checks.filter((c) => c.got === null).map((c) => c.name)
  const drifted = checks
    .filter((c) => c.got !== null && (c.want === null || c.want === undefined || c.got !== c.want))
    .map((c) => c.name)
  const base = { want: wantPlain, wantHash, checks, unjudged, drifted }
  if (unjudged.length) {
    return { ...base, state: 'unjudged', reason: `取不到:${unjudged.join(',')}` }
  }
  if (drifted.length) {
    return { ...base, state: 'drift', reason: `被改动:${drifted.join(',')}` }
  }
  return { ...base, state: 'ok', reason: 'in-sync' }
}

function machineLine(o) {
  return `ADMIN-PWD-FROZEN state=${o.state} want=${o.want} drifted=${o.drifted.join('|') || 'none'} reason=${o.reason}`
}

async function readDbHashSha12() {
  const envFile = process.env.IHUI_API_ENV_FILE || DEFAULT_ENV_FILE
  const dbUrl = readEnvFileKey(envFile, 'DATABASE_URL')
  if (!dbUrl) return null
  // 驱动解析:仓库根不一定装 postgres(packages/database 用的是 drizzle 自有链路)。
  // 先试 import,失败再从生产 api 目录的动态导入兜底 —— 那条路径实测有驱动。
  const candidates = [
    () => import('postgres'),
    () => import(pathToFileURL(join(dirname(envFile), 'node_modules', 'postgres', 'src', 'index.js')).href),
  ]
  for (const load of candidates) {
    try {
      const mod = await load()
      const postgres = mod.default ?? mod
      const sql = postgres(dbUrl, { max: 1 })
      const rows = await sql`SELECT password_hash FROM users WHERE username='admin'`
      await sql.end()
      if (!rows.length) return null
      return createHash('sha256').update(rows[0].password_hash).digest('hex').slice(0, 12)
    } catch {
      /* 换下一个候选;全失败则由调用方按未判定处理 */
    }
  }
  return null
}

export function selfTest() {
  // 场景 A:lock 期望 X,实物全是 Y ⇒ 三处都应判 drift
  const lockA = { passwordSha256_12: 'aaaaaaaaaaaa', dbHashSha256_12: 'bbbbbbbbbbbb' }
  const a = judge({ lock: lockA, pwdFileValue: 'x', serviceEnvValue: 'x', dbHashSha12: sha12('x') })
  // 场景 B:完全一致(明文用明文指纹,库哈希用哈希指纹)⇒ ok
  const plain = 'z'
  const lockB = { passwordSha256_12: sha12(plain), dbHashSha256_12: sha12('HASHZ') }
  const b = judge({ lock: lockB, pwdFileValue: plain, serviceEnvValue: plain, dbHashSha12: sha12('HASHZ') })
  // 场景 C:取不到 file ⇒ unjudged,且不冒红
  const c = judge({ lock: lockB, pwdFileValue: null, serviceEnvValue: plain, dbHashSha12: sha12('HASHZ') })
  // 场景 D:只有库哈希被换(有人改了密码)而两处明文没动 ⇒ 精确点名 db-hash
  const d = judge({ lock: lockB, pwdFileValue: plain, serviceEnvValue: plain, dbHashSha12: sha12('OTHER') })
  // 场景 E:只有 env 被换 ⇒ 精确点名 service-env
  const e = judge({ lock: lockB, pwdFileValue: plain, serviceEnvValue: 'stale', dbHashSha12: sha12('HASHZ') })
  const pass =
    a.state === 'drift' && a.drifted.length === 3 &&
    b.state === 'ok' &&
    c.state === 'unjudged' && c.unjudged.includes('file') &&
    d.state === 'drift' && d.drifted.length === 1 && d.drifted[0] === 'db-hash' &&
    e.state === 'drift' && e.drifted.length === 1 && e.drifted[0] === 'service-env'
  console.log(`SELFTEST pass=${pass} (A=${a.state}/${a.drifted.length} B=${b.state} C=${c.state} D=${d.drifted.join('|')} E=${e.drifted.join('|')})`)
  return pass
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(selfTest() ? 0 : 1)
  const asJson = argv.includes('--json')

  const lockFile = process.env.IHUI_ADMIN_LOCK_FILE || DEFAULT_LOCK
  if (!existsSync(lockFile)) {
    console.log('ADMIN-PWD-FROZEN state=unjudged reason=lock-file-missing')
    process.exit(2)
  }
  let lock
  try {
    lock = JSON.parse(readFileSync(lockFile, 'utf8'))
  } catch {
    console.log('ADMIN-PWD-FROZEN state=unjudged reason=lock-file-unreadable')
    process.exit(2)
  }
  if (!lock?.passwordSha256_12) {
    console.log('ADMIN-PWD-FROZEN state=unjudged reason=lock-file-no-fingerprint')
    process.exit(2)
  }

  const pwdFile = process.env.IHUI_ADMIN_PWD_FILE || DEFAULT_PWD_FILE
  const pwdFileValue = existsSync(pwdFile)
    ? readFileSync(pwdFile, 'utf8').replace(/[\r\n]+$/, '')
    : null
  const serviceEnvValue = readServiceEnv(ENV_KEY)
  const dbHashSha12 = await readDbHashSha12()

  const out = judge({ lock, pwdFileValue, serviceEnvValue, dbHashSha12 })
  if (asJson) {
    console.log(JSON.stringify({ ...out, lockFile, pwdFile }, null, 2))
  } else {
    for (const c of out.checks) {
      const mark =
        c.got === null ? '?' : c.want !== null && c.want !== undefined && c.got === c.want ? '✅' : '❌'
      console.log(`  ${mark} ${c.name.padEnd(12)} ${c.got ?? '(未判定)'}`)
    }
    console.log(machineLine(out))
  }
  process.exit(out.state === 'ok' ? 0 : out.state === 'drift' ? 1 : 2)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.log(`ADMIN-PWD-FROZEN state=unjudged reason=crash:${String(e && e.message).slice(0, 80)}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
