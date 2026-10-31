#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/**
 * rotate-local-dev-db-password.mjs — 本机 dev 库口令轮换器(票 O68,2026-11-01)。
 *
 * 立因:2026-10-31 主会话用 `grep -oE "^DATABASE_URL=..."` 探端口时,把 `apps/ai-service/.env`
 * 里 DATABASE_URL 的**口令前缀**带进了聊天记录(该 DSN = localhost:5432/ihui,仅本机开发库)。
 * 跨机零暴露面,但本仓红线是「部分前缀也不许进会话」,且 2026-10-26 同类事故的口径是主动轮换。
 *
 * 形态照 `rotate-exposed-upstream-credentials.mjs` 的既有三条:
 *   ① 登记面只存 sha256 前缀 + 出处,绝不存原文;
 *   ② 改前自动备份(逐文件逐字节),失败整批回滚;
 *   ③ **只换不验 = 没做** —— 换完必须证明「旧口令被 PG 拒收 ∧ 新口令在全消费面鉴权通过」。
 *
 * 执行窗口是机器挑的,不是人拍板的(§24 等条件桶禁令):本器**在 8801/8802/8803 任一活服务时
 * fail-closed 拒绝执行**(exit 2 未判定),因为轮换会让在跑进程的旧连接池失效;等服务自然空闲
 * 或经 deploy-lock/dev-lock 排到窗口后重跑即可。
 *
 * 用法:
 *   node scripts/rotate-local-dev-db-password.mjs                 # --plan(默认,只读)
 *   node scripts/rotate-local-dev-db-password.mjs --apply         # 执行(要求窗口空闲)
 *   node scripts/rotate-local-dev-db-password.mjs --verify        # 用当前文件值回连自证
 *   node scripts/rotate-local-dev-db-password.mjs --self-test
 *
 * 退出码:0 计划/执行/校验通过;1 执行失败(已回滚);2 未判定(窗口未到/取不到输入)。
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, rmSync } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const STATE_DIR = join(ROOT, '.ihui-agent', 'state')
const LEDGER = join(STATE_DIR, 'dev-db-credential-rotation.jsonl')
const SERVICE_PORTS = [8801, 8802, 8803]
const CONSUMERS = ['.env', 'apps/api/.env', 'apps/ai-service/.env', '.env.test', 'apps/api/.env.test']
const DB_EXEC_CWD = join(ROOT, 'apps', 'api') // 只有这里 node 能解析到 postgres 包

const sha12 = (v) => createHash('sha256').update(v).digest('hex').slice(0, 12)

/** 只做展示用脱敏:口令整段替换为 ***,其余保留。 */
export function maskDsn(dsn) {
  try {
    const u = new URL(dsn)
    if (u.password) u.password = '***'
    return u.toString()
  } catch {
    return '<unparsable>'
  }
}

export function parseDsn(dsn) {
  const u = new URL(dsn)
  return {
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    host: u.hostname,
    port: u.port || '5432',
    database: u.pathname.replace(/^\//, ''),
  }
}

export function isLocalDsn(dsn) {
  try {
    const p = parseDsn(dsn)
    return ['localhost', '127.0.0.1', '::1'].includes(p.host)
  } catch {
    return false
  }
}

/** 把 DSN 里的口令换成新值(保留 URL 编码与原结构)。 */
export function replaceDsnPassword(dsn, newPassword) {
  const u = new URL(dsn)
  u.password = newPassword
  return u.toString()
}

/** 读一个 .env 文件,返回 { dsn, lineIndex, key, value } —— 只认第一条 `DATABASE_URL=`。 */
export function readEnvDsn(text) {
  const lines = String(text).split(/\r?\n/)
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^(\s*(?:export\s+)?)(DATABASE_URL)\s*=\s*(.*)$/.exec(lines[i])
    if (!m) continue
    let v = m[3].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    return { key: m[2], value: v, lineIndex: i, prefix: m[1] }
  }
  return null
}

export function rewriteEnvDsn(text, newDsn) {
  const found = readEnvDsn(text)
  if (!found) return null
  const lines = String(text).split(/\r?\n/)
  const quote = /^"|^'/.test(lines[found.lineIndex].split('=')[1].trim()) ? '"' : ''
  lines[found.lineIndex] = `${found.prefix}${found.key}=${quote}${newDsn}${quote}`
  return lines.join('\n')
}

export function collectConsumers(root = ROOT, exists = existsSync) {
  return CONSUMERS.map((rel) => join(root, rel)).filter((abs) => exists(abs))
}

export function liveServicePorts(ports = SERVICE_PORTS) {
  let out = ''
  try {
    out = execFileSync('netstat', ['-ano'], { encoding: 'utf8', windowsHide: true, timeout: 20000 })
  } catch {
    return { ok: false, live: [] }
  }
  const live = []
  for (const port of ports) {
    const re = new RegExp(`[:.]${port}\\s+\\S+\\s+LISTENING`, 'i')
    if (re.test(out)) live.push(port)
  }
  return { ok: true, live }
}

/** 在 apps/api 的模块解析面里跑一段 ESM(只有那里能 import 到 postgres)。 */
function runDbCode(code, env) {
  return execFileSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: DB_EXEC_CWD,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  })
}

const PING_CODE = `
import postgres from 'postgres'
const sql = postgres(process.env.ROTATE_DSN, { max: 1, connect_timeout: 10, idle_timeout: 2, prepare: false })
try { await sql\`select 1 as ok\`; console.log('PING_OK') } catch (e) { console.log('PING_FAIL ' + (e?.code || e?.message || 'unknown')); }
finally { await sql.end({ timeout: 1 }).catch(() => {}) }
`

const ALTER_CODE = `
import postgres from 'postgres'
const sql = postgres(process.env.ROTATE_DSN, { max: 1, connect_timeout: 10, idle_timeout: 2, prepare: false })
const user = process.env.ROTATE_USER
const pass = process.env.ROTATE_NEW_PASSWORD
const ident = '"' + String(user).replace(/"/g, '""') + '"'
const literal = "'" + String(pass).replace(/'/g, "''") + "'"
try { await sql.unsafe('ALTER ROLE ' + ident + ' WITH PASSWORD ' + literal); console.log('ALTER_OK') }
catch (e) { console.log('ALTER_FAIL ' + (e?.code || e?.message || 'unknown')) }
finally { await sql.end({ timeout: 1 }).catch(() => {}) }
`

function ping(dsn) {
  try {
    return runDbCode(PING_CODE, { ROTATE_DSN: dsn }).trim()
  } catch (e) {
    return `PING_ERR ${String(e?.stderr || e?.message || e).slice(0, 200)}`
  }
}

function plan() {
  const consumers = collectConsumers()
  if (consumers.length === 0) {
    console.log('❌ 未判定:找不到任何含 DATABASE_URL 的 .env 消费面')
    return 2
  }
  const rows = []
  for (const abs of consumers) {
    const found = readEnvDsn(readFileSync(abs, 'utf8'))
    const rel = abs.replace(ROOT + '\\', '').replace(ROOT + '/', '')
    if (!found) {
      rows.push({ rel, dsn: null })
      continue
    }
    rows.push({ rel, dsn: found.value, local: isLocalDsn(found.value), fp: isLocalDsn(found.value) ? sha12(parseDsn(found.value).password) : '-' })
  }
  const usable = rows.filter((r) => r.dsn && r.local)
  console.log(`消费面 ${rows.length} 个:${rows.map((r) => (r.dsn ? `${r.rel}(local=${r.local})` : `${r.rel}(无 DATABASE_URL)`)).join(' / ')}`)
  for (const r of usable) console.log(`  · ${r.rel}: ${maskDsn(r.dsn)}  fp=${r.fp}`)
  if (usable.length === 0) {
    console.log('❌ 未判定:没有任何 localhost 的 DATABASE_URL 可轮换')
    return 2
  }
  const pingOut = ping(usable[0].dsn)
  console.log(`PG 连接自证:${pingOut}`)
  const svc = liveServicePorts()
  console.log(
    svc.ok
      ? `窗口探测:${svc.live.length === 0 ? '空闲(可 --apply)' : `活服务在跑 ${svc.live.join(',')} ⇒ --apply 会 fail-closed(exit 2)`}`
      : '窗口探测:netstat 取不到 ⇒ 未判定',
  )
  return 0
}

function apply() {
  const svc = liveServicePorts()
  if (!svc.ok) {
    console.log('❌ 未判定:netstat 取不到,无法判定执行窗口(不猜)')
    return 2
  }
  if (svc.live.length > 0) {
    console.log(
      `⏳ 窗口未到:${svc.live.join(',')} 有活服务在听。轮换会让在跑进程的旧连接池失效 ⇒ fail-closed,不执行。\n` +
        '   出路:等服务自然空闲,或经 deploy-lock/dev-lock 排到窗口后重跑 --apply。',
    )
    return 2
  }
  const consumers = collectConsumers()
  const targets = []
  for (const abs of consumers) {
    const text = readFileSync(abs, 'utf8')
    const found = readEnvDsn(text)
    if (!found) continue
    if (!isLocalDsn(found.value)) {
      console.log(`❌ 拒绝:${abs} 的 DATABASE_URL 不是本机(仅轮换 localhost),未执行`)
      return 2
    }
    targets.push({ abs, text, found })
  }
  if (targets.length === 0) {
    console.log('❌ 未判定:没有可轮换的 localhost DSN')
    return 2
  }
  const oldDsn = targets[0].found.value
  const parsed = parseDsn(oldDsn)
  const newPassword = randomBytes(24).toString('base64url')
  const newDsn = replaceDsnPassword(oldDsn, newPassword)

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = join(STATE_DIR, `dev-db-rotation-${stamp}`)
  mkdirSync(backupDir, { recursive: true })
  const backups = targets.map((t) => {
    const name = t.abs.replace(ROOT + '\\', '').replace(ROOT + '/', '').replace(/[\\/]/g, '__')
    const dest = join(backupDir, name)
    copyFileSync(t.abs, dest)
    return dest
  })
  console.log(`📦 已备份 ${backups.length} 个文件 → ${backupDir}`)

  const rollback = (why) => {
    for (const t of targets) writeFileSync(t.abs, t.text, 'utf8')
    console.log(`↩️ 已回滚 ${targets.length} 个文件(${why})`)
  }

  const alterOut = (() => {
    try {
      return runDbCode(ALTER_CODE, { ROTATE_DSN: oldDsn, ROTATE_USER: parsed.user, ROTATE_NEW_PASSWORD: newPassword }).trim()
    } catch (e) {
      return `ALTER_ERR ${String(e?.stderr || e?.message || e).slice(0, 200)}`
    }
  })()
  console.log(`ALTER ROLE:${alterOut}`)
  if (!alterOut.includes('ALTER_OK')) {
    rollback('ALTER 失败,未改任何文件')
    return 1
  }

  for (const t of targets) {
    const rewritten = rewriteEnvDsn(t.text, newDsn)
    if (!rewritten) {
      rollback('重写失败')
      return 1
    }
    writeFileSync(t.abs, rewritten, 'utf8')
  }
  console.log(`✏️ 已更新 ${targets.length} 个消费面文件`)

  // 只换不验 = 没做:旧值必须被拒收,新值必须通过
  const oldPing = ping(oldDsn)
  const newPing = ping(newDsn)
  console.log(`验证 旧口令:${oldPing}`)
  console.log(`验证 新口令:${newPing}`)
  const oldRejected = oldPing.includes('PING_FAIL') || oldPing.includes('28P01')
  const newAccepted = newPing.includes('PING_OK')
  if (!oldRejected || !newAccepted) {
    rollback(`验证不过(旧拒=${oldRejected} 新通=${newAccepted})`)
    return 1
  }

  mkdirSync(STATE_DIR, { recursive: true })
  appendFileSync(
    LEDGER,
    JSON.stringify({
      ts: new Date().toISOString(),
      kind: 'local-dev-db-password',
      db: `${parsed.host}:${parsed.port}/${parsed.database}`,
      user: parsed.user,
      oldFp: sha12(parsed.password),
      newFp: sha12(newPassword),
      consumers: targets.map((t) => t.abs.replace(ROOT + '\\', '').replace(ROOT + '/', '')),
      backupDir,
      verify: { oldRejected, newAccepted },
      reason: 'O68:口令前缀曾进会话(§5c/2026-10-26 同族口径主动轮换)',
    }) + '\n',
    'utf8',
  )
  try {
    rmSync(join(STATE_DIR, 'dev-db-rotation-pending.json'), { force: true })
  } catch {
    /* 标记删不掉时保留,下一轮 plan 会看到 noop */
  }
  console.log(`✅ 轮换完成:旧值拒收=${oldRejected} 新值通过=${newAccepted};留痕 → ${LEDGER}`)
  console.log('⚠️ 在跑服务需重启才会读到新 DSN(本器只在窗口空闲时执行,故通常是下一次启动生效)。')
  return 0
}

function verify() {
  const consumers = collectConsumers()
  let ok = 0
  for (const abs of consumers) {
    const found = readEnvDsn(readFileSync(abs, 'utf8'))
    if (!found) continue
    const out = ping(found.value)
    const rel = abs.replace(ROOT + '\\', '').replace(ROOT + '/', '')
    console.log(`  · ${rel}: ${out}`)
    if (out.includes('PING_OK')) ok += 1
  }
  console.log(ok > 0 ? `✅ ${ok} 个消费面鉴权通过` : '❌ 没有任何消费面通过鉴权')
  return ok > 0 ? 0 : 1
}

function selfTest() {
  let pass = 0
  let fail = 0
  const ok = (n, c) => {
    if (c) {
      pass += 1
      console.log(`  ✅ ${n}`)
    } else {
      fail += 1
      console.error(`  ❌ ${n}`)
    }
  }
  const dsn = 'postgres://ihui_user:p%40ss%20word@localhost:5432/ihui'
  ok('parseDsn 解出 user/password(URL 解码)', parseDsn(dsn).password === 'p@ss word' && parseDsn(dsn).user === 'ihui_user')
  ok('maskDsn 不含原文', !maskDsn(dsn).includes('p%40ss') && maskDsn(dsn).includes('***'))
  ok('isLocalDsn 只认本机', isLocalDsn(dsn) && !isLocalDsn('postgres://u:p@db.example.com:5432/x'))
  const nw = replaceDsnPassword(dsn, 'a-b_c123')
  ok('replaceDsnPassword 保留结构且换口令', parseDsn(nw).password === 'a-b_c123' && parseDsn(nw).database === 'ihui')
  const env = 'A=1\nDATABASE_URL=postgres://u:p@localhost:5432/ihui\nB=2\n'
  const found = readEnvDsn(env)
  ok('readEnvDsn 取第一条并去引号', found && found.value === 'postgres://u:p@localhost:5432/ihui')
  const rewritten = rewriteEnvDsn(env, 'postgres://u:n@localhost:5432/ihui')
  ok('rewriteEnvDsn 只改该行', rewritten.includes('A=1') && rewritten.includes('B=2') && rewritten.includes('u:n@'))
  ok('rewriteEnvDsn 无该行 ⇒ null', rewriteEnvDsn('X=1', 'y') === null)
  console.log(`\n自检:pass ${pass} / fail ${fail}`)
  return fail === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const argv = process.argv.slice(2)
  const rc = argv.includes('--self-test') ? selfTest() : argv.includes('--apply') ? apply() : argv.includes('--verify') ? verify() : plan()
  process.exit(rc)
}

export const __test__ = { maskDsn, parseDsn, isLocalDsn, replaceDsnPassword, readEnvDsn, rewriteEnvDsn }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
