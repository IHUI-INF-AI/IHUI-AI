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
 *   node scripts/rotate-local-dev-db-password.mjs --register --fp <sha256前缀> --source "<出处>" [--expires YYYY-MM-DD]
 *       # 登记面 .ihui-agent/state/dev-db-rotation-pending.json 的**全仓唯一写方**(2026-11-01 补口)。
 *       # 只收指纹与出处,拒收任何明文凭据形态;原子写(tmp+rename)、同 fp 幂等、输出恒脱敏。
 *   node scripts/rotate-local-dev-db-password.mjs --verify-registered
 *       # 只读复算"登记的暴露值是否仍住在消费面"(欠账还在不在);不连库、不改任何文件。
 *   node scripts/rotate-local-dev-db-password.mjs --self-test
 *
 * 退出码:0 计划/执行/校验/登记通过;1 执行失败(已回滚)或 --verify-registered 判"欠账还在";
 *        2 未判定(窗口未到/取不到输入/登记输入不合法)。
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, rmSync, renameSync } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const STATE_DIR = join(ROOT, '.ihui-agent', 'state')
const LEDGER = join(STATE_DIR, 'dev-db-credential-rotation.jsonl')
const PENDING_FILE = join(STATE_DIR, 'dev-db-rotation-pending.json')
const SERVICE_PORTS = [8801, 8802, 8803]
const CONSUMERS = ['.env', 'apps/api/.env', 'apps/ai-service/.env', '.env.test', 'apps/api/.env.test']
const DB_EXEC_CWD = join(ROOT, 'apps', 'api') // 只有这里 node 能解析到 postgres 包

const sha12 = (v) => createHash('sha256').update(v).digest('hex').slice(0, 12)

// ===== 登记面唯一写口(2026-11-01 补票 O68 缺口) =====
// 现场缺口:dev-db-rotation-pending.json 此前只有"本器 --apply 成功时的 rmSync 删方"与
// guardian 巡检腿的读方,**没有任何创建出口** ⇒ 盘上那枚是人工手写的,下次凭据暴露无正式
// 登记通道,这条自动线会静默变死线。本节即全仓唯一写方;字段命名/指纹尺/幂等风格对齐同类器
// rotate-exposed-upstream-credentials.mjs 的 --register(fp=8–64 位小写 hex 摘要、source=出处、
// registeredAt=ISO 时刻;该器无 provider/kind 概念,故不搬其对象形 source,其余不自立第二套 schema)。

/** 指纹尺与同类器 parseLedger 同式(该器未导出正则,本行为全仓该尺在本面的唯一定义处,镜像测试钉形态) */
const FP_RE = /^[0-9a-f]{8,64}$/
const SOURCE_MIN_LEN = 10 // 同类器 --retire --reason「≥10 字定向说明」同档(§0.10:登记必须有交代)

/**
 * "想传明文凭据"的形态识别:命中任一即拒。判据**宁严勿松**——本仓 2026-10-31 刚出过
 * 凭据进会话的事故,失效方向恒为"多要一次定向说明",绝不"多放一条疑似凭据落盘"(§0.10)。
 * 返回点名理由(绝不回显值本身),合法返回 null。
 */
export function looksLikeRawSecret(v) {
  const s = String(v ?? '')
  if (s.includes('://')) return '含 URL/连接串形态(://)'
  if (s.includes('@')) return '含 @ (疑似带凭据 userinfo 的 DSN/邮箱形)'
  if (/\S{2,}=\S{4,}/.test(s)) return '含 key=value 连接串形态(无空格的赋值段)'
  if (/^[A-Za-z0-9+/_=-]{16,}={0,2}$/.test(s)) return '疑似口令/token 字面值(≥16 位无空格 base64/hex 形)'
  return null
}

/** 校验登记三参数,返回错误数组(空数组=合法)。错误信息只报形态与长度,绝不回显值。 */
export function validateRegister({ fp = '', source = '', expires = '' } = {}) {
  const errors = []
  const f = String(fp).trim().toLowerCase()
  if (f === '') errors.push('缺 --fp(sha256 摘要前缀,8–64 位十六进制;本器只收摘要、不收明文口令)')
  else if (!FP_RE.test(f)) {
    const shape = /[^0-9a-f]/.test(f) ? '含非 hex 字符或疑似明文凭据' : `长度 ${f.length} 不在 8–64 档`
    errors.push(`--fp 形态不合法(${shape};不回显值本身)`)
  }
  const s = String(source).trim()
  if (s === '') errors.push(`缺 --source(出处说明,≥${SOURCE_MIN_LEN} 字)`)
  else if (s.length < SOURCE_MIN_LEN) errors.push(`--source 过短(${s.length} < ${SOURCE_MIN_LEN} 字)`)
  else {
    const bad = looksLikeRawSecret(s)
    if (bad) errors.push(`--source 拒收:形似凭据而非出处说明(${bad})`)
  }
  const e = String(expires).trim()
  if (e !== '' && (!/^\d{4}-\d{2}-\d{2}$/.test(e) || Number.isNaN(Date.parse(e))))
    errors.push('--expires 必须是 YYYY-MM-DD 的合法日期')
  return errors
}

/** 解析 --register 的 argv(取值一律吃下一枚,同类器 parseArgs 同风格)。 */
export function parseRegisterArgs(argv = []) {
  const o = { fp: '', source: '', expires: '', error: null }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    const next = () => argv[++i] ?? ''
    if (a === '--register') continue // 路由档名本身,不取值
    else if (a === '--fp') o.fp = next()
    else if (a === '--source') o.source = next()
    else if (a === '--expires') o.expires = next()
    else o.error = `未知参数: ${a}`
  }
  return o
}

/**
 * 读登记面并归一成 { state: absent|ok|unreadable, entries, why }。
 * 兼容本出口设立前人工手写的单对象形({reason, registeredAt} ⇒ 归一条无 fp、source 取 reason 的条目,
 * 重归一不丢历史交代)。读取方向与 guardian 巡检腿同判序:在位而解析不出条目 ⇒ unreadable(未判定),
 * 绝不猜成"无条目"(§0.3)。
 */
export function readPendingState(file = PENDING_FILE) {
  if (!existsSync(file)) return { state: 'absent', entries: [] }
  let parsed
  try {
    const raw = String(readFileSync(file, 'utf8')).trim()
    if (raw === '') return { state: 'unreadable', entries: [], why: '登记面为空文件' }
    parsed = JSON.parse(raw)
  } catch (e) {
    return { state: 'unreadable', entries: [], why: `登记面读不动(${String(e?.message ?? e).slice(0, 80)})` }
  }
  const list = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' ? [parsed] : null
  if (!list) return { state: 'unreadable', entries: [], why: '登记面解析不出条目' }
  const entries = []
  for (const row of list) {
    if (!row || typeof row !== 'object') continue
    const fp = String(row.fp ?? '').trim().toLowerCase()
    const source = String(row.source ?? row.reason ?? '').trim()
    if (fp === '' && source === '') continue
    entries.push({
      fp,
      source,
      registeredAt: row.registeredAt ?? null,
      expires: typeof row.expires === 'string' && row.expires !== '' ? row.expires : null,
    })
  }
  if (entries.length === 0) return { state: 'unreadable', entries: [], why: '登记面在位但条目集为 0' }
  return { state: 'ok', entries }
}

/** 指纹尺等值:两侧各取较短者长度(≥8)前缀相等即命中(登记侧 fp 允许比 sha12 长或短)。 */
export function fpMatch(a, b) {
  const x = String(a ?? '').toLowerCase()
  const y = String(b ?? '').toLowerCase()
  const n = Math.min(x.length, y.length)
  return n >= 8 && x.slice(0, n) === y.slice(0, n)
}

/**
 * 登记面唯一写方。退出码:0 登记成功或幂等重复;2 输入不合法/登记面坏(显式报错,绝不静默写)。
 * 落盘 = 同目录 tmp + renameSync(原子;本机实测 Windows 同卷 rename 覆盖旧文件成功),
 * 写失败先把原文件原样留着并点名;权限/位置沿用 .ihui-agent/state/ 现盘那枚。
 * 同 fp 幂等:重复登记不产生第二条(镜像测试成对钉"不同 fp 会加一条"的正向对照)。
 */
export function register({
  fp = '',
  source = '',
  expires = '',
  pendingFile = PENDING_FILE,
  now = new Date(),
  logger = (m) => console.log(m),
} = {}) {
  const errors = validateRegister({ fp, source, expires })
  if (errors.length > 0) {
    for (const msg of errors) logger(`❌ --register 拒收:${msg}`)
    return 2
  }
  const normFp = String(fp).trim().toLowerCase()
  const cur = readPendingState(pendingFile)
  if (cur.state === 'unreadable') {
    logger(`❌ --register 未判定:${cur.why} ⇒ 拒绝在坏登记面上追加或覆盖(不静默洗面)`)
    return 2
  }
  if (cur.entries.some((e) => e.fp === normFp)) {
    logger(`ℹ️ fp=${normFp} 已在登记面 ⇒ 幂等,不写第二条`)
    return 0
  }
  const entry = {
    fp: normFp,
    key: 'DATABASE_URL', // 本器账面对只有一个受管键,显式写死供人读档不猜
    source: String(source).trim().slice(0, 200),
    registeredAt: now.toISOString(),
  }
  if (String(expires).trim() !== '') entry.expires = String(expires).trim()
  const body = JSON.stringify([...cur.entries, entry])
  const tmp = `${pendingFile}.${process.pid}.tmp`
  try {
    mkdirSync(dirname(pendingFile), { recursive: true })
    writeFileSync(tmp, body, 'utf8')
    renameSync(tmp, pendingFile)
  } catch (e) {
    try {
      rmSync(tmp, { force: true })
    } catch {
      /* tmp 清理尽力而为 */
    }
    logger(`❌ --register 写入失败:${String(e?.message ?? e).slice(0, 120)} ⇒ 登记面未动`)
    return 2
  }
  logger(`✅ 已登记:key=${entry.key} fp=${entry.fp} 出处="${entry.source}"(盘面只住指纹与出处,不含任何值;条目=${cur.entries.length + 1})`)
  return 0
}

/**
 * --verify-registered(只读):复算"这条欠账还在不在"。登记面各 fp 对**当前消费面**
 * DATABASE_URL 口令的 sha256 前缀逐一比对;值只在内存里摘要,输出面只报键名与指纹。
 * 为什么不在 check-env-drift.mjs 上加档:那把尺判的是"备份 vs 现值被清空",结构上没有
 * fp 维,要塞"暴露值仍在用"就得改它的在册判据(别席件,§0.6 不许为消红动别人的尺)⇒
 * 本档从本器物自己的消费面清单派生,判据与 --plan 同一把尺(readEnvDsn/isLocalDsn/sha12)。
 * 退出码:0 无欠账/文件面全部不命中;1 某消费面现值仍等于已登记暴露值;2 未判定。
 */
export function verifyRegistered({
  pendingFile = PENDING_FILE,
  root = ROOT,
  logger = (m) => console.log(m),
} = {}) {
  const cur = readPendingState(pendingFile)
  if (cur.state === 'absent') {
    logger('✅ 无欠账(登记面不在位)⇒ 没有待轮换条目')
    return 0
  }
  if (cur.state === 'unreadable') {
    logger(`❌ 未判定:${cur.why}`)
    return 2
  }
  const consumers = collectConsumers(root)
  if (consumers.length === 0) {
    logger('❌ 未判定:取不到消费面(没有任何含 DATABASE_URL 的 .env)')
    return 2
  }
  const verifiable = cur.entries.filter((e) => FP_RE.test(e.fp))
  for (const e of cur.entries.filter((x) => !FP_RE.test(x.fp)))
    logger(`⚠️ 条目无合法 fp(旧手写形,出处="${e.source}")⇒ 该条无法复算,按未结清点名,不记结清`)
  if (verifiable.length === 0) {
    logger('❌ 未判定:登记面没有可复算的 fp 条目')
    return 2
  }
  const fileFps = []
  for (const abs of consumers) {
    let found = null
    try {
      found = readEnvDsn(readFileSync(abs, 'utf8'))
    } catch {
      continue
    }
    if (!found || !isLocalDsn(found.value)) continue
    const rel = abs.replace(`${root}\\`, '').replace(`${root}/`, '')
    const fpNow = sha12(parseDsn(found.value).password)
    fileFps.push({ rel, fpNow })
    for (const e of verifiable)
      if (fpMatch(e.fp, fpNow))
        logger(`❌ 欠账还在:${rel} 的 DATABASE_URL 现值 fp=${fpNow} 命中登记 fp=${e.fp} ⇒ 暴露值仍住在文件面(未轮换或换回旧值)`)
  }
  if (fileFps.length === 0) {
    logger('❌ 未判定:消费面在但都取不出本机 DATABASE_URL')
    return 2
  }
  const anyHit = fileFps.some((f) => verifiable.some((e) => fpMatch(e.fp, f.fpNow)))
  if (anyHit) return 1
  logger(
    `✅ 文件面复算:${verifiable.length} 条登记 fp 与 ${fileFps.length} 个消费面现值全部不同 ⇒ 文件已换;结清仍以器物 --apply 成功留痕为准(账本自动删标记)`,
  )
  return 0
}

function cliRegister(argv) {
  const o = parseRegisterArgs(argv.filter((a) => a !== '--register'))
  if (o.error) {
    console.log(`❌ ${o.error}(用法:--register --fp <sha256前缀> --source "<出处>" [--expires YYYY-MM-DD])`)
    return 2
  }
  return register(o)
}

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
    rmSync(PENDING_FILE, { force: true })
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
  const rc = argv.includes('--self-test')
    ? selfTest()
    : argv.includes('--register')
      ? cliRegister(argv)
      : argv.includes('--verify-registered')
        ? verifyRegistered()
        : argv.includes('--apply')
          ? apply()
          : argv.includes('--verify')
            ? verify()
            : plan()
  process.exit(rc)
}

export const __test__ = {
  maskDsn,
  parseDsn,
  isLocalDsn,
  replaceDsnPassword,
  readEnvDsn,
  rewriteEnvDsn,
  looksLikeRawSecret,
  validateRegister,
  parseRegisterArgs,
  readPendingState,
  fpMatch,
  register,
  verifyRegistered,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
