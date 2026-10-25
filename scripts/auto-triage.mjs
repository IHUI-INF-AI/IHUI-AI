// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * auto-triage — 感知层自动分诊器(auto-evolve 四期系列 O65 · 第 1 期,2026-10-25 立)。
 *
 * 职责:把巡检发现转成「可派单的真工作」,不把噪音写进台账。分诊三档:
 *   可派单 → 走 live-doc-edit(唯一登记入口)登记 PROJECT_PLAN EOF;
 *   观察类 → 只进本器台账 jsonl(交给既有到人/自愈链,不重复登记);
 *   超配额/去重 → 台账留痕,静默等待窗口。
 *
 * 判据纪律:
 *  - 来源白名单:只吃配置里点名的源,每源一台账/一判据,不搞万能解析(防噪音淹没,§1);
 *  - 「台账只记真工作」:可派单的判据 = 有人能动手做的(§1 登记门槛);
 *  - 登记行带新鲜日期交代(三选一),同源 24h 去重 + 每日登记配额;
 *  - 取不到来源数据 ⇒ 该源落「未判定」不记绿(§0.3),绝不把读不到当成"无发现"。
 *
 * 来源(第一期实装 2 个,均为现成器物的机器可读面):
 *  - mail-failure:apps/api/scripts/notify-deploy-failure.ts 的投递台账(§5e-3)24h 窗内
 *    disposition==='failed' 计数 ≥2 ⇒ 派「邮件通道故障排查」票(5e-2:agent 自己查端口/进程);
 *  - index-unmerged:scripts/check-index-unmerged-age.mjs --json 的机器读数 ⇒ 烂尾滞留是
 *    观察类(它已有到人链,分诊器只记账不重复登记)。
 *
 * 用法:node scripts/auto-triage.mjs --once | --status | --self-test
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG_JSON = join(ROOT, 'scripts', 'data', 'auto-triage-config.json')
const TRIAGE_LEDGER = join(ROOT, '.ihui-agent', 'state', 'auto-triage-ledger.jsonl')
const MAIL_LEDGER = join(ROOT, '.ihui-agent', 'state', 'mail-send-ledger.jsonl')
const INDEX_AGE_SCRIPT = join(ROOT, 'scripts', 'check-index-unmerged-age.mjs')
const LIVE_DOC_EDIT = join(ROOT, 'scripts', 'live-doc-edit.mjs')
const TMP_DIR = join(ROOT, '.ihui-agent', 'tmp', 'auto-triage')

export class TriageShapeError extends Error {}

export function loadConfig(readFile = (p) => readFileSync(p, 'utf8')) {
  let g
  try {
    g = JSON.parse(readFile(CONFIG_JSON))
  } catch (e) {
    throw new TriageShapeError(`分诊配置读不到或非法 JSON(${CONFIG_JSON}):${e?.message ?? e}`)
  }
  if (typeof g.enabled !== 'boolean') throw new TriageShapeError('形状坏:enabled 必须是 boolean')
  if (!Number.isInteger(g.dailyRegistrationQuota) || g.dailyRegistrationQuota <= 0) {
    throw new TriageShapeError('形状坏:dailyRegistrationQuota 必须是正整数')
  }
  if (!Array.isArray(g.sources) || g.sources.length === 0) {
    throw new TriageShapeError('形状坏:sources 必须是非空数组(第一期只吃白名单源)')
  }
  const KNOWN = ['mail-failure', 'index-unmerged']
  for (const s of g.sources) {
    if (!KNOWN.includes(s)) throw new TriageShapeError(`形状坏:未知来源「${s}」(白名单闭集:${KNOWN.join('/')})`)
  }
  return g
}

/** 发现指纹:同源去重的键(与日期无关,靠台账 24h 窗判新旧) */
export function fingerprintOf(source, objectText) {
  return createHash('sha256').update(`${source}|${String(objectText)}`).digest('hex').slice(0, 12)
}

/** 来源一:邮件投递台账 24h 窗 failed 计数(§5e-3 schema 2;读不到 = 未判定) */
export function readMailFailures(readFile = (p) => readFileSync(p, 'utf8'), now = Date.now()) {
  let rows
  try {
    rows = readFile(MAIL_LEDGER).split(/\r?\n/).filter(Boolean)
  } catch {
    return { status: 'undetermined', why: '投递台账读不到(通道尚未发过信)' }
  }
  let failed24h = 0
  let lastWhy = ''
  for (const line of rows) {
    try {
      const r = JSON.parse(line)
      if (r.disposition !== 'failed') continue
      const ts = Date.parse(r.at)
      if (!Number.isFinite(ts) || now - ts > 24 * 3600_000) continue
      failed24h++
      if (r.why) lastWhy = String(r.why).slice(0, 120)
    } catch {
      /* 坏行跳过,不算发现也不算未判定 */
    }
  }
  return { status: 'ok', failed24h, lastWhy }
}

/** 来源二:index 烂尾哨兵 --json(子进程现跑;取不到 = 未判定) */
export function readIndexUnmerged(spawn = (...a) => spawnSync(...a)) {
  const r = spawn(process.execPath, [INDEX_AGE_SCRIPT, '--json'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    windowsHide: true,
    timeout: 60_000,
    encoding: 'utf8',
  })
  if (r.error || r.status !== 0) return { status: 'undetermined', why: `哨兵跑不出(rc=${r.status ?? '?'})` }
  try {
    const j = JSON.parse(String(r.stdout ?? '').trim().split(/\r?\n/).pop())
    // 判据:有未合并条目且龄龄到阈(哨兵自己判 staleMin,分诊器只消费它的机读结论)
    if (j.overall === 'undetermined') return { status: 'undetermined', why: String(j.detail ?? '') }
    const stale = Number(j.count) > 0 && Number(j.ageMin) >= Number(j.staleMin)
    return { status: 'ok', stale, count: Number(j.count) || 0, ageMin: j.ageMin ?? null }
  } catch (e) {
    return { status: 'undetermined', why: `读数解析失败:${e?.message ?? e}` }
  }
}

/** 读本器台账(坏行跳过) */
export function readTriageLedger(readFile = (p) => readFileSync(p, 'utf8')) {
  try {
    return readFile(TRIAGE_LEDGER)
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l)
        } catch {
          return null
        }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

function appendLedger(entry) {
  const lines = readTriageLedger()
  lines.push({ ts: new Date().toISOString(), ...entry })
  writeFileSync(TRIAGE_LEDGER, lines.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8')
}

/** 今日已登记数(本器台账现读,配额判据) */
export function registeredToday(ledger, now = new Date()) {
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return ledger.filter((e) => e.action === 'registered' && String(e.ts ?? '').startsWith(key)).length
}

/** 24h 窗同指纹去重 */
export function recentlyRegistered(ledger, fp, now = Date.now()) {
  return ledger.some((e) => e.action === 'registered' && e.fingerprint === fp && now - Date.parse(e.ts) < 24 * 3600_000)
}

/**
 * 登记:构造块文件走 live-doc-edit 子进程(唯一登记入口;它自带取号面/CAS/幂等判据)。
 * 登记行带新鲜日期交代(三选一之一),标题带指纹防同题查重误伤(守门 203)。
 */
export function registerToPlan({ source, fingerprint, title, evidence }, spawn = (...a) => spawnSync(...a)) {
  mkdirSync(TMP_DIR, { recursive: true })
  const blockFile = join(TMP_DIR, `reg-${fingerprint}.md`)
  const day = new Date().toISOString().slice(0, 10)
  const block = [
    `- [ ] [auto-triage] ${title}(登记@${day}/auto-triage;来源:${source} 哨兵;指纹 ${fingerprint};证据:${evidence})`,
  ].join('\n')
  writeFileSync(blockFile, block, 'utf8')
  const r = spawn(process.execPath, [LIVE_DOC_EDIT], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    windowsHide: true,
    timeout: 120_000,
    encoding: 'utf8',
    env: {
      ...process.env,
      LIVE_DOC: 'PROJECT_PLAN.md',
      LIVE_BLOCK_FILE: blockFile,
      LIVE_MSG: `docs(plan): auto-triage 自动登记(${source};指纹 ${fingerprint};第 1 期感知层产线动作,O65)`,
    },
  })
  try {
    unlinkSync(blockFile)
  } catch {
    /* 用完即删 */
  }
  const okOut = /回读|已在位/.test(String(r.stdout ?? ''))
  if (r.status !== 0 && !okOut) {
    return { ok: false, why: `live-doc-edit rc=${r.status}:${String(r.stderr ?? r.stdout ?? '').slice(-160)}` }
  }
  return { ok: true }
}

async function runOnce({ dryRun = false } = {}) {
  let cfg
  try {
    cfg = loadConfig()
  } catch (e) {
    console.error(`❌ 未判定:${e.message}`)
    process.exitCode = 2
    return
  }
  if (!cfg.enabled && !dryRun) {
    console.log('⏸ 分诊未启用(auto-triage-config.json enabled=false)。')
    return
  }
  const ledger = readTriageLedger()
  const quotaUsed = registeredToday(ledger)
  console.log(`分诊轮:今日已登记 ${quotaUsed}/${cfg.dailyRegistrationQuota},台账 ${ledger.length} 行`)
  const findings = []
  // 来源一:邮件投递连败
  if (cfg.sources.includes('mail-failure')) {
    const m = readMailFailures()
    if (m.status === 'undetermined') {
      console.log(`  ℹ mail-failure:未判定(${m.why})`)
    } else if (m.failed24h >= 6) {
      console.log(`  ⚠ mail-failure:24h failed=${m.failed24h} ≥6 ⇒ 观察类(升级量级,交既有到人链,不重复登记)`)
      findings.push({ source: 'mail-failure', disposition: 'observe', fp: fingerprintOf('mail-failure', 'burst'), title: '', evidence: `24h failed=${m.failed24h}` })
    } else if (m.failed24h >= 2) {
      console.log(`  → mail-failure:24h failed=${m.failed24h} ∈[2,6) ⇒ 可派单(邮件通道排查)`)
      findings.push({ source: 'mail-failure', disposition: 'register', fp: fingerprintOf('mail-failure', 'channel'), title: '邮件投递通道故障排查(24h 内连续失败 ≥2 封,查 SMTP 出口/进程/配额)', evidence: `failed=${m.failed24h}${m.lastWhy ? ` why=${m.lastWhy}` : ''}` })
    } else {
      console.log(`  ✅ mail-failure:24h failed=${m.failed24h} ⇒ 无发现`)
    }
  }
  // 来源二:index 烂尾
  if (cfg.sources.includes('index-unmerged')) {
    const i = readIndexUnmerged()
    if (i.status === 'undetermined') {
      console.log(`  ℹ index-unmerged:未判定(${i.why})`)
    } else if (i.stale) {
      console.log(`  ⚠ index-unmerged:count=${i.count} age=${i.ageMin}min ⇒ 观察类(既有到人链)`)
      findings.push({ source: 'index-unmerged', disposition: 'observe', fp: fingerprintOf('index-unmerged', 'stale'), title: '', evidence: `count=${i.count} age=${i.ageMin}` })
    } else {
      console.log(`  ✅ index-unmerged:无滞留 ⇒ 无发现`)
    }
  }
  for (const f of findings) {
    if (f.disposition !== 'register') {
      appendLedger({ mode: dryRun ? 'dryrun' : 'once', action: 'observed', source: f.source, fingerprint: f.fp, why: f.evidence })
      continue
    }
    if (recentlyRegistered(ledger, f.fp)) {
      console.log(`  ⏭ ${f.source} 24h 内已登记同指纹 ⇒ 跳过`)
      continue
    }
    if (quotaUsed >= cfg.dailyRegistrationQuota) {
      console.log(`  ⏸ 每日登记配额已满 ⇒ ${f.source} 留台账待明日`)
      appendLedger({ mode: dryRun ? 'dryrun' : 'once', action: 'quota-deferred', source: f.source, fingerprint: f.fp, why: f.evidence })
      continue
    }
    if (dryRun) {
      console.log(`  ✅ dry-run:将登记「${f.title}」`)
      continue
    }
    const reg = registerToPlan({ source: f.source, fingerprint: f.fp, title: f.title, evidence: f.evidence })
    if (!reg.ok) {
      console.error(`  ❌ 登记未判定:${reg.why}`)
      appendLedger({ mode: 'once', action: 'register-failed', source: f.source, fingerprint: f.fp, why: reg.why })
      process.exitCode = 2
      continue
    }
    quotaUsed++
    appendLedger({ mode: 'once', action: 'registered', source: f.source, fingerprint: f.fp, why: f.evidence })
    console.log(`  ✅ 已登记:${f.title}`)
  }
}

function selfTest() {
  let failed = 0
  const ok = (name, cond) => {
    if (cond) console.log(`  ✅ ${name}`)
    else {
      console.error(`  ❌ ${name}`)
      failed++
    }
  }
  console.log('self-test:')
  ok('T1a 形状锁:合法配置过', (() => { try { return loadConfig(() => JSON.stringify({ enabled: false, dailyRegistrationQuota: 3, sources: ['mail-failure'] })).enabled === false } catch { return false } })())
  ok('T1b 形状锁:未知来源拒', (() => { try { loadConfig(() => JSON.stringify({ enabled: true, dailyRegistrationQuota: 3, sources: ['everything'] })); return false } catch (e) { return e instanceof TriageShapeError } })())
  ok('T1c 形状锁:配额 0 拒', (() => { try { loadConfig(() => JSON.stringify({ enabled: true, dailyRegistrationQuota: 0, sources: ['mail-failure'] })); return false } catch { return true } })())
  ok('T2a mail 台账缺 ⇒ 未判定(不记绿)', readMailFailures(() => { throw new Error('x') }).status === 'undetermined')
  const now = Date.now()
  const rows = [
    JSON.stringify({ at: new Date(now - 3600_000).toISOString(), disposition: 'failed', why: 'conn refused' }),
    JSON.stringify({ at: new Date(now - 7200_000).toISOString(), disposition: 'failed', why: 'timeout' }),
    JSON.stringify({ at: new Date(now - 25 * 3600_000).toISOString(), disposition: 'failed' }),
    JSON.stringify({ at: new Date(now - 3600_000).toISOString(), disposition: 'delivered' }),
  ]
  const mail = readMailFailures(() => rows.join('\n'), now)
  ok('T2b 24h 窗计数(旧窗/成功不计)', mail.status === 'ok' && mail.failed24h === 2)
  ok('T2c 阈值分档:2 ⇒ register', mail.failed24h >= 2 && mail.failed24h < 6)
  ok('T3 指纹稳定且区分源', fingerprintOf('a', 'x') === fingerprintOf('a', 'x') && fingerprintOf('a', 'x') !== fingerprintOf('b', 'x'))
  const ledger = [
    { action: 'registered', ts: new Date(now - 3600_000).toISOString(), fingerprint: 'fp1' },
    { action: 'registered', ts: new Date(now - 25 * 3600_000).toISOString(), fingerprint: 'fp2' },
  ]
  ok('T4a 24h 去重:新鲜命中', recentlyRegistered(ledger, 'fp1', now) === true)
  ok('T4b 24h 去重:过期不拦', recentlyRegistered(ledger, 'fp2', now) === false)
  const todayRows = [
    { action: 'registered', ts: new Date().toISOString() },
    { action: 'registered', ts: new Date(now - 25 * 3600_000).toISOString() },
    { action: 'quota-deferred', ts: new Date().toISOString() },
  ]
  ok('T5 配额只数 registered(当日)', registeredToday(todayRows, new Date()) === 1)
  if (failed > 0) {
    console.error(`self-test: ${failed} 例红`)
    process.exitCode = 1
  } else {
    console.log('self-test: 全绿')
  }
}

function printStatus() {
  let cfg
  try {
    cfg = loadConfig()
  } catch (e) {
    console.error(`❌ 未判定:${e.message}`)
    process.exitCode = 2
    return
  }
  const ledger = readTriageLedger()
  console.log(`分诊配置:enabled=${cfg.enabled} 来源(${cfg.sources.length})=${cfg.sources.join('/')} 每日登记配额 ${cfg.dailyRegistrationQuota} 今日已用 ${registeredToday(ledger)}`)
  console.log(`台账最近 5 条:`)
  for (const e of ledger.slice(-5)) console.log(`  ${e.ts} ${e.mode}/${e.action}${e.source ? ` src=${e.source}` : ''}${e.why ? ` :: ${e.why}` : ''}`)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const args = process.argv.slice(2)
  main(args).catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

async function main(args) {
  if (args.includes('--self-test')) return selfTest()
  if (args.includes('--status')) return printStatus()
  return runOnce({ dryRun: args.includes('--dry-run') })
}

export const __test__ = {
  loadConfig,
  TriageShapeError,
  fingerprintOf,
  readMailFailures,
  readIndexUnmerged,
  readTriageLedger,
  registeredToday,
  recentlyRegistered,
  registerToPlan,
  CONFIG_JSON,
  TRIAGE_LEDGER,
  MAIL_LEDGER,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
