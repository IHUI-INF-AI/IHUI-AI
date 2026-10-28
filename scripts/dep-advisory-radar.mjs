#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 本工具是巡检记账器,机器行必须走 stdout */
/**
 * dep-advisory-radar — 依赖安全通告 → 可派单改进票(O65 第 3 期「进化回流」,2026-10-25 立)。
 *
 * 为什么单独一件:O65 第 0 期的派单白名单早已预留「依赖升级 / 安全通告」两族
 * (scripts/data/auto-evolve-gates.json ticketWhitelist),但直到今天没有任何器物去**看**这两族 ——
 * 票族存在而源头空转。本器把 `pnpm audit` 的机读结论变成带指纹的候选票,去重后按日配额收敛。
 *
 * 判据纪律:
 *  - 只认**可修**通告(patched_versions 非空且不是 "<0.0.0"):无补丁的条目派票等于派死票;
 *  - 同模块多条通告合成一枚候选(取最高 severity),按 critical→high→moderate→low 排序;
 *  - 候选票按日配额(默认 3)截断 —— 一次把 257 条全派出去 = 用噪音淹没台账(§1);
 *  - 指纹 `module|github_advisory_id` 24h 去重,台账 append-only(`.ihui-agent/state/dep-advisory-ledger.jsonl`);
 *  - 取不到读数(pnpm 不存在 / 网络不通 / JSON 坏)⇒ **未判定 exit 2**,绝不写成"零漏洞"(§0.3);
 *  - 登记(写台账)默认关闭,`--register` 才走 live-doc-edit;本器不代跑 pnpm install/update ——
 *    依赖树升级会动 2000+ 包,属机主窗口内的人工动作(human-gates: 非 autonomous 面)。
 *
 * 用法:
 *   node scripts/dep-advisory-radar.mjs [--json] [--max-tickets 3] [--registry <url>]
 *        [--audit-json <path>] [--ledger <path>] [--dry-run] [--register] [--self-test]
 */
import { appendFileSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
// 登记行守卫(与 auto-triage 共用):hex 串在台账行里会被守门 117 当短 sha 拒落。
import { sanitizeHexRuns } from './lib/triage-doc-line.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_LEDGER = join(ROOT, '.ihui-agent', 'state', 'dep-advisory-ledger.jsonl')
const DEFAULT_REGISTRY = 'https://registry.npmjs.org'
const LIVE_DOC_EDIT = join(ROOT, 'scripts', 'live-doc-edit.mjs')
const TMP_DIR = join(ROOT, '.ihui-agent', 'tmp', 'dep-advisory')
const SCHEMA_VERSION = 1
const DEFAULT_MAX_TICKETS = 3
const WINDOW_HOURS = 24
export const MAX_SUMMARY_LINES = 8

const SEVERITY_RANK = Object.freeze({ critical: 4, high: 3, moderate: 2, low: 1, info: 0 })

export class RadarShapeError extends Error {}

const asText = (v) => (typeof v === 'string' ? v.trim() : v === null || v === undefined ? '' : String(v).trim())

/** "可修"判据:没有补丁范围或补丁起点是 <0.0.0 ⇒ 不派死票。 */
export function isFixable(patchedVersions) {
  const p = asText(patchedVersions)
  if (!p) return false
  return !/^<\s*0\.0\.0$/.test(p)
}

/** pnpm audit 输出 → 归一。形状坏 throw(调用方判未判定)。 */
export function parseAudit(text) {
  let doc
  try {
    doc = JSON.parse(String(text ?? ''))
  } catch (e) {
    throw new RadarShapeError(`audit JSON 解析失败:${e?.message ?? e}`)
  }
  if (!doc || typeof doc !== 'object') throw new RadarShapeError('audit JSON 顶层不是对象')
  const advisories = doc.advisories
  if (!advisories || typeof advisories !== 'object' || Array.isArray(advisories)) {
    throw new RadarShapeError('audit JSON 缺 advisories 对象(可能不是 pnpm audit 输出)')
  }
  const rows = []
  for (const [id, a] of Object.entries(advisories)) {
    if (!a || typeof a !== 'object') continue
    const module = asText(a.module_name)
    if (!module) continue
    rows.push({
      id: asText(a.id ?? id),
      module,
      severity: asText(a.severity).toLowerCase() || 'info',
      cwe: asText(a.cwe),
      title: asText(a.title),
      vulnerable: asText(a.vulnerable_versions),
      patched: asText(a.patched_versions),
      url: asText(a.url),
      usedBy: Array.isArray(a.findings)
        ? a.findings.map((f) => asText(f?.version)).filter(Boolean).slice(0, 3)
        : [],
    })
  }
  const vulns = doc.metadata?.vulnerabilities
  const counts = vulns && typeof vulns === 'object'
    ? Object.fromEntries(Object.entries(SEVERITY_RANK).map(([k]) => [k, Number(vulns[k]) || 0]))
    : null
  return { rows, counts }
}

/** 通告行 → 按模块合成的候选票(取最高 severity;仅可修)。 */
export function buildCandidates(rows) {
  const byModule = new Map()
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!isFixable(r.patched)) continue
    const cur = byModule.get(r.module)
    const rank = SEVERITY_RANK[r.severity] ?? 0
    if (!cur) {
      byModule.set(r.module, { module: r.module, severity: r.severity, rank, advisories: [r], patched: r.patched })
      continue
    }
    cur.advisories.push(r)
    if (rank > cur.rank) {
      cur.severity = r.severity
      cur.rank = rank
      cur.patched = r.patched
    }
  }
  const out = [...byModule.values()]
  out.sort((a, b) => b.rank - a.rank || b.advisories.length - a.advisories.length || a.module.localeCompare(b.module))
  return out.map((c) => ({
    module: c.module,
    severity: c.severity,
    count: c.advisories.length,
    patched: c.patched,
    advisories: c.advisories.map((a) => ({ id: a.id, cwe: a.cwe, title: a.title, url: a.url, vulnerable: a.vulnerable })),
    fingerprint: fingerprintOf(c.module, c.advisories.map((a) => a.id).sort().join(',')),
  }))
}

export function fingerprintOf(module, ids) {
  return createHash('sha256').update(`${module}|${ids}`).digest('hex').slice(0, 12)
}

/** 台账(坏行跳过)。 */
export function readLedger(readFile = (p) => readFileSync(p, 'utf8'), path = DEFAULT_LEDGER) {
  try {
    return readFile(path)
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

/** 24h 窗内同模块已报过/派过 ⇒ 不重复。 */
export function reportedRecently(ledger, module, { now = Date.now() } = {}) {
  const windowMs = WINDOW_HOURS * 3600_000
  return (Array.isArray(ledger) ? ledger : []).some((e) => {
    if (e?.module !== module) return false
    if (e?.action !== 'ticketed' && e?.action !== 'reported') return false
    const ts = Date.parse(asText(e?.ts))
    return Number.isFinite(ts) && now - ts <= windowMs
  })
}

/** 候选 → 本轮要报的票(去重 + 日配额截断)。 */
export function selectTickets(candidates, ledger, { now = Date.now(), maxTickets = DEFAULT_MAX_TICKETS } = {}) {
  const picked = []
  let fresh = 0
  for (const c of Array.isArray(candidates) ? candidates : []) {
    if (reportedRecently(ledger, c.module, { now })) continue
    fresh += 1
    if (picked.length >= maxTickets) continue
    picked.push(c)
  }
  return { picked, fresh, suppressed: Math.max(0, fresh - picked.length) }
}

export function formatTicketLine(t) {
  return `DEP-ADVISORY ${JSON.stringify({
    v: SCHEMA_VERSION,
    kind: 'ticket',
    module: t.module,
    severity: t.severity,
    count: t.count,
    patched: t.patched,
    fingerprint: t.fingerprint,
    advisories: t.advisories.map((a) => a.id),
  })}`
}

/** ≤8 行摘要:一条候选一行,超限截断(明细在机器行)。 */
export function formatSummary(picked, counts, { suppressed = 0 } = {}) {
  const head = counts
    ? `依赖安全通告:critical ${counts.critical} / high ${counts.high} / moderate ${counts.moderate} / low ${counts.low}`
    : '依赖安全通告(无 metadata 计数)'
  const lines = [head]
  for (const t of picked) {
    lines.push(`- ${t.module}(${t.severity}×${t.count}) 升至 ${t.patched}`)
  }
  if (suppressed > 0) lines.push(`- 另有 ${suppressed} 枚新候选受日配额限制,下一轮再报`)
  lines.push('处置:升级须机主窗口(动 2000+ 依赖树,非 autonomous 面);本器只派票不代跑 install。')
  return lines.slice(0, MAX_SUMMARY_LINES).join('\n')
}

/** 采集:优先用离线读数(--audit-json),否则现场跑 pnpm audit。 */
export function collectAudit({ auditJsonPath = '', registry = DEFAULT_REGISTRY, timeoutMs = 180_000, spawn = (...a) => spawnSync(...a) } = {}) {
  if (auditJsonPath) {
    try {
      return { status: 'ok', text: readFileSync(auditJsonPath, 'utf8'), source: auditJsonPath }
    } catch (e) {
      return { status: 'undetermined', why: `离线读数读不到(${auditJsonPath}):${e?.message ?? e}` }
    }
  }
  const args = ['audit', '--json']
  if (registry) args.push(`--registry=${registry}`)
  const r = spawn('pnpm', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    windowsHide: true,
    timeout: timeoutMs,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  const out = String(r.stdout ?? '')
  // pnpm audit: 0=无漏洞, 1=有漏洞(JSON 仍完整); 其它=真失败。
  if (r.error) return { status: 'undetermined', why: `pnpm audit 起不来:${r.error?.message ?? r.error}` }
  if (r.status !== 0 && r.status !== 1) {
    const err = String(r.stderr ?? '').split(/\r?\n/).filter(Boolean).slice(-2).join(' ')
    return { status: 'undetermined', why: `pnpm audit rc=${r.status}:${err.slice(0, 200)}` }
  }
  return { status: 'ok', text: out, source: `pnpm audit(${registry || '配置 registry'})` }
}

/** 登记一枚候选票:走 live-doc-edit(唯一登记入口;它自带取号/CAS/幂等)。 */
export function registerTicket(t, { counts, spawn = (...a) => spawnSync(...a) } = {}) {
  mkdirSync(TMP_DIR, { recursive: true })
  const blockFile = join(TMP_DIR, `dep-${t.fingerprint}.md`)
  const day = new Date().toISOString().slice(0, 10)
  const top = t.advisories[0]
  const evidence = counts
    ? `pnpm audit critical=${counts.critical}/high=${counts.high}/moderate=${counts.moderate}/low=${counts.low}`
    : 'pnpm audit(无计数)'
  // 取号一律走 live-doc-edit 的 `{{NEXT_ID:G}}` 令牌(每次 CAS 按当下 HEAD 现算),本器不自己拼号。
  const line = sanitizeHexRuns(`- [ ] {{NEXT_ID:G}} [dep-advisory] ${t.module} 依赖安全通告(${t.severity}×${t.count}${top?.cwe ? `,${top.cwe}` : ''})可升至 ${t.patched}(登记@${day}/dep-advisory-radar;证据:${evidence})`)
  writeFileSync(blockFile, `${line}\n`, 'utf8')
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
      LIVE_MSG: `docs(plan): dep-advisory-radar 自动登记依赖安全票(${t.module};O65 第 3 期)`,
    },
  })
  try {
    unlinkSync(blockFile)
  } catch {
    /* 用完即删 */
  }
  const okOut = /回读|已在位/.test(String(r.stdout ?? ''))
  if (r.status !== 0 && !okOut) return { ok: false, why: `live-doc-edit rc=${r.status}:${String(r.stderr ?? r.stdout ?? '').slice(-160)}` }
  return { ok: true, line }
}

function appendLedger(path, entry) {
  mkdirSync(dirname(resolve(path)), { recursive: true })
  appendFileSync(path, `${JSON.stringify({ v: SCHEMA_VERSION, ts: new Date().toISOString(), ...entry })}\n`, 'utf8')
}

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (!a.startsWith('--')) {
      out._.push(a)
      continue
    }
    const key = a.slice(2)
    const eq = key.indexOf('=')
    if (eq >= 0) {
      out[key.slice(0, eq)] = key.slice(eq + 1)
      continue
    }
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      out[key] = true
      continue
    }
    out[key] = next
    i += 1
  }
  return out
}

function selfTest() {
  const checks = []
  const t = (name, fn) => {
    try {
      fn()
      checks.push({ name, ok: true })
    } catch (e) {
      checks.push({ name, ok: false, why: e?.message ?? String(e) })
    }
  }
  const adv = (o) => ({ findings: [{ version: '1.0.0', paths: ['a>b>c'] }], id: 1, title: 'T', module_name: 'm', vulnerable_versions: '<1.1.0', patched_versions: '>=1.1.0', severity: 'high', cwe: 'CWE-1', url: 'u', ...o })
  const doc = JSON.stringify({ advisories: { 1: adv({}), 2: adv({ id: 2, module_name: 'n', severity: 'critical' }) }, metadata: { vulnerabilities: { info: 0, low: 1, moderate: 2, high: 3, critical: 4 } } })
  // 候选面只吃归一后的行(parseAudit 的输出),自检也走同一入口,避免两套形状。
  const rowsOf = (arr) => parseAudit(JSON.stringify({ advisories: Object.fromEntries(arr.map((a, i) => [String(i), a])) })).rows

  t('可修判据:<0.0.0 / 空补丁不派死票', () => {
    if (isFixable('') || isFixable('<0.0.0')) throw new Error('不可修被放行')
    if (!isFixable('>=4.8.1')) throw new Error('可修被判死票')
  })
  t('解析 + 计数 + 形状坏 throw', () => {
    const r = parseAudit(doc)
    if (r.rows.length !== 2 || r.counts.critical !== 4) throw new Error(JSON.stringify(r.counts))
    for (const bad of ['not-json', '{}', '{"advisories":[]}']) {
      let hit = false
      try {
        parseAudit(bad)
      } catch (e) {
        hit = e instanceof RadarShapeError
      }
      if (!hit) throw new Error(`未拒绝:${bad}`)
    }
  })
  t('同模块合并取最高 severity,排序 critical 优先', () => {
    const c = buildCandidates(parseAudit(doc).rows)
    if (c[0].module !== 'n' || c[0].severity !== 'critical') throw new Error(JSON.stringify(c.map((x) => x.module)))
    const merged = buildCandidates(rowsOf([adv({}), adv({ id: 3, severity: 'critical' })]))
    if (merged.length !== 1 || merged[0].severity !== 'critical' || merged[0].count !== 2) throw new Error(JSON.stringify(merged))
  })
  t('指纹稳定:同模块同通告集不分叉', () => {
    const a = buildCandidates(rowsOf([adv({}), adv({ id: 3 })]))[0].fingerprint
    const b = buildCandidates(rowsOf([adv({ id: 3 }), adv({})]))[0].fingerprint
    if (a !== b) throw new Error(`指纹分叉 ${a} vs ${b}`)
  })
  t('24h 去重 + 配额截断计数', () => {
    const cands = buildCandidates(rowsOf([adv({}), adv({ module_name: 'x' }), adv({ module_name: 'y' })]))
    const picked = selectTickets(cands, [], { maxTickets: 2 })
    if (picked.picked.length !== 2 || picked.suppressed !== 1) throw new Error(JSON.stringify(picked))
    const ledger = [{ action: 'reported', module: cands[0].module, ts: new Date().toISOString() }]
    const again = selectTickets(cands, ledger, { maxTickets: 3 })
    if (again.picked.some((x) => x.module === cands[0].module)) throw new Error('24h 内重复报')
  })
  t('机器行单行可 grep;摘要 ≤8 行', () => {
    const c = buildCandidates(rowsOf([adv({})]))
    const line = formatTicketLine(c[0])
    if (!line.startsWith('DEP-ADVISORY ') || line.includes('\n')) throw new Error('机器行形状错')
    const obj = JSON.parse(line.slice('DEP-ADVISORY '.length))
    if (obj.module !== 'm' || obj.count !== 1) throw new Error('机器行字段丢')
    const s = formatSummary(c, { critical: 1, high: 2, moderate: 3, low: 4 }, { suppressed: 5 })
    if (s.split('\n').length > MAX_SUMMARY_LINES) throw new Error('摘要超行')
  })

  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : ` — ${c.why}`}`)
  const bad = checks.filter((c) => !c.ok)
  console.log(`# self-test ${checks.length - bad.length}/${checks.length}`)
  return bad.length === 0 ? 0 : 1
}

function main(argv) {
  const args = parseArgs(argv)
  if (args['self-test']) return selfTest()
  const maxTickets = args['max-tickets'] === undefined ? DEFAULT_MAX_TICKETS : Number(args['max-tickets'])
  if (!Number.isInteger(maxTickets) || maxTickets <= 0) {
    console.error(`❌ max-tickets 必须是正整数:「${args['max-tickets']}」`)
    return 2
  }
  const ledgerPath = asText(args.ledger) || DEFAULT_LEDGER
  const got = collectAudit({
    auditJsonPath: asText(args['audit-json']),
    registry: args.registry === undefined ? DEFAULT_REGISTRY : asText(args.registry),
  })
  if (got.status !== 'ok') {
    const payload = { v: SCHEMA_VERSION, overall: 'undetermined', why: got.why }
    if (args.json) console.log(JSON.stringify(payload))
    else console.log(`❓ 依赖通告:未判定 —— ${got.why}`)
    return 2
  }
  let parsed
  try {
    parsed = parseAudit(got.text)
  } catch (e) {
    const payload = { v: SCHEMA_VERSION, overall: 'undetermined', why: e.message, source: got.source }
    if (args.json) console.log(JSON.stringify(payload))
    else console.log(`❓ 依赖通告:未判定 —— ${e.message}`)
    return 2
  }
  const candidates = buildCandidates(parsed.rows)
  const { picked, suppressed } = selectTickets(candidates, readLedger(undefined, ledgerPath), { maxTickets })

  const registered = []
  if (!args['dry-run']) {
    for (const t of picked) {
      if (args.register) {
        const r = registerTicket(t, { counts: parsed.counts })
        if (!r.ok) console.error(`⚠ 登记失败(${t.module}):${r.why}`)
        else registered.push(t.module)
      }
      appendLedger(ledgerPath, { action: args.register ? 'ticketed' : 'reported', module: t.module, severity: t.severity, fingerprint: t.fingerprint })
    }
  }

  if (args.json) {
    console.log(JSON.stringify({
      v: SCHEMA_VERSION,
      overall: picked.length ? 'tickets' : 'clean',
      source: got.source,
      counts: parsed.counts,
      advisories: parsed.rows.length,
      candidates: candidates.length,
      tickets: picked.map((t) => ({ module: t.module, severity: t.severity, count: t.count, patched: t.patched, fingerprint: t.fingerprint })),
      suppressed,
      registered,
    }))
  } else {
    for (const t of picked) console.log(formatTicketLine(t))
    console.log(formatSummary(picked, parsed.counts, { suppressed }))
    if (registered.length) console.log(`已登记 ${registered.length} 枚:${registered.join(', ')}`)
    if (!picked.length) console.log('✅ 窗内无新增可修候选(或无漏洞)')
    if (args['dry-run']) console.log('(dry-run:未写台账)')
  }
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exit(main(process.argv.slice(2)))
}

export const __test__ = {
  isFixable,
  parseAudit,
  buildCandidates,
  fingerprintOf,
  readLedger,
  reportedRecently,
  selectTickets,
  formatTicketLine,
  formatSummary,
  collectAudit,
  registerTicket,
  DEFAULT_LEDGER,
  DEFAULT_MAX_TICKETS,
  MAX_SUMMARY_LINES,
  WINDOW_HOURS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
