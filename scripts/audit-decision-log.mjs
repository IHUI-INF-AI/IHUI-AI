#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 只读审计报告,grep 行必须走 stdout/stderr */
/**
 * audit-decision-log — 决策台账四型审计(只读)。
 *
 * 与 `scripts/audit-decision-chain.mjs` 的分工(不得合并、不得互相覆盖,§0.6):
 *  - 那支判的是**三本既有台账能否按票/按提交串成一条链**(票面 → 门读数 → 落地 sha);
 *  - 本支判的是**决策台账 `.ihui-agent/state/decision-log.jsonl` 自身的四型缺口**:
 *    A 有 commit 无 decision / B 有 decision 无 commit / C why 过短 / D 同席时间倒序。
 *  两者语义不同、输入不同、判据不同,各留一份;同名会逼后来者二选一,故本支取名 `-log`。
 *
 * 形态纪律:
 *  - 只读:不写台账、不做任何 git 写操作、不改工作树;唯一写盘在 `--self-test` 的
 *    `mkScratch()` 夹具(工作区外,进程退出自动回收,§15b);
 *  - 三态:台账取不到 / git 取不到 / 窗口内提交超上限 ⇒ exit 2「未判定」,不折成 0 条记绿(§0.3);
 *  - 逐条点名:每一型都带行号/提交 sha/席位,不输出"有问题(共 N 条)"而没有 N 条是什么;
 *  - 默认窗口 = 最近 24 小时(首行打印实际窗口);要判更长历史必须显式 `--since`,不静默全量。
 *
 * 用法:
 *   node scripts/audit-decision-log.mjs [--since <ISO>] [--until <ISO>] [--seat <名>] [--json]
 *                                       [--root <dir>] [--ledger <file>] [--max-commits N] [--list-limit N]
 *   node scripts/audit-decision-log.mjs --self-test
 * 退出码:0 = 四型均为 0 且无坏行;1 = 判出问题(逐条已列);2 = 未判定(台账/git/输入)。
 */
import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  DECISION_LEDGER_REL,
  MIN_WHY_CHARS,
  appendDecision,
  countChars,
  isFullSha,
  ledgerPath,
  normalizeAt,
  readDecisions,
} from './lib/decision-log.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_MAX_COMMITS = 2000
const DEFAULT_LIST_LIMIT = 20
const MAX_TEXT = 200

export class InputError extends Error {}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

/** 单行截断(报告用,不做判据)。 */
export function clip(v, max = MAX_TEXT) {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim()
  return countChars(s) > max ? `${Array.from(s).slice(0, max).join('')}…` : s
}

/**
 * 派生 git 必须显式接管 stdio(§12g:不写会稳定 EBUSY)+ `windowsHide`(§5c 派生进程纪律)。
 * 带 input 时 stdin 必须是 pipe。
 */
export function gitRaw(args, { cwd, input } = {}) {
  const stdio = input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe']
  const r = spawnSync('git', args, {
    cwd,
    input,
    encoding: 'utf8',
    stdio,
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  })
  return {
    status: typeof r.status === 'number' ? r.status : 2,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    error: r.error || null,
  }
}

/** 解析带值旗标:`--flag value`;没给 ⇒ null;给了没值 ⇒ InputError(§flag-value 同一口径,不回落默认)。 */
export function parseFlag(argv, flag) {
  const i = argv.indexOf(flag)
  if (i < 0) return null
  const v = argv[i + 1]
  if (typeof v !== 'string' || v === '' || v.startsWith('-')) {
    throw new InputError(`${flag} 必须紧跟一个值(实得 ${v === undefined ? '(无)' : JSON.stringify(v)})`)
  }
  return v
}

/** 时间旗标:ISO 日期/时刻都收;解不出 ⇒ InputError(不猜)。 */
export function parseTimeArg(raw, flag) {
  const iso = normalizeAt(raw)
  if (!iso) throw new InputError(`${flag} 解不出时刻:「${raw}」`)
  return iso
}

export function parseIntArg(raw, flag, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!/^\d+$/.test(String(raw ?? ''))) throw new InputError(`${flag} 必须是非负整数:「${raw}」`)
  const n = Number(raw)
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new InputError(`${flag} 超出范围 [${min}, ${max}]:${raw}`)
  return n
}

/**
 * 提交面:窗口内提交。超过 `maxCommits` ⇒ `truncated:true`(调用方判未判定,不得把截断面当全量,§0.3)。
 */
export function listCommits({ root, sinceIso, untilIso, maxCommits = DEFAULT_MAX_COMMITS }) {
  const args = ['log', '--format=%H%x09%cI%x09%s', `--since=${sinceIso}`, `--until=${untilIso}`, '-n', String(maxCommits + 1), '--no-color']
  const r = gitRaw(args, { cwd: root })
  if (r.status !== 0) {
    return { ok: false, why: `git log 失败(rc=${r.status}):${clip(r.stderr || r.error?.message || '无输出', 300)}`, commits: [], truncated: false }
  }
  const rows = r.stdout.split(/\r?\n/).filter((l) => l.trim())
  const truncated = rows.length > maxCommits
  const commits = rows.slice(0, maxCommits).map((line) => {
    const [sha, at, ...rest] = line.split('\t')
    return { sha: (sha || '').trim().toLowerCase(), at: (at || '').trim(), subject: rest.join('\t') }
  }).filter((c) => isFullSha(c.sha))
  return { ok: true, why: '', commits, truncated, rawCount: rows.length }
}

/** 批量判提交存在性(一次 `cat-file --batch-check`,不逐条 spawn)。取不到 ⇒ `ok:false`。 */
export function probeCommits(root, shas) {
  const uniq = Array.from(new Set(shas.filter((s) => isFullSha(s))))
  const exists = new Map()
  if (uniq.length === 0) return { ok: true, exists, why: '' }
  const r = gitRaw(['cat-file', '--batch-check=%(objectname) %(objecttype)'], { cwd: root, input: `${uniq.join('\n')}\n` })
  if (r.status !== 0) return { ok: false, exists, why: `git cat-file 失败(rc=${r.status}):${clip(r.stderr || r.error?.message || '无输出', 300)}` }
  for (const line of r.stdout.split(/\r?\n/)) {
    if (!line.trim()) continue
    const [sha, type] = line.trim().split(/\s+/)
    exists.set((sha || '').toLowerCase(), type === 'commit')
  }
  return { ok: true, exists, why: '' }
}

/** A 型:窗口内有提交、但当批决策里没有任何一条绑到它(全量决策集,不受 --seat 影响)。 */
export function findCommitWithoutDecision(commits, allRecords) {
  const bound = new Set()
  for (const { validation } of allRecords) {
    if (!validation.ok || !validation.entry.commit) continue
    bound.add(validation.entry.commit)
  }
  return commits
    .filter((c) => !bound.has(c.sha))
    .map((c) => ({ sha: c.sha, at: c.at, subject: clip(c.subject, 120) }))
}

/**
 * B 型:决策声明了提交但仓里没有(`dangling`),或干脆没绑提交(`unbound`)。
 * `exists` = `Map<sha, boolean>`,由 `probeCommits()` 一次批量问出;取不到时调用方已判未判定,不会走到这里。
 */
export function findDecisionWithoutCommit(records, exists = new Map()) {
  const out = []
  for (const { line, validation } of records) {
    if (!validation.ok) continue
    const e = validation.entry
    if (!e.commit) {
      out.push({ line, seat: e.seat, ticket: e.ticket || '', action: e.action, kind: 'unbound', sha: '', why: '决策未绑 commit:事后无法追到改了哪枚提交' })
      continue
    }
    if (exists.get(e.commit) === false) {
      out.push({ line, seat: e.seat, ticket: e.ticket || '', action: e.action, kind: 'dangling', sha: e.commit, why: '声明的提交在仓内不存在' })
    }
  }
  return out
}

/** C 型:台账里 why 少于 MIN_WHY_CHARS 的记录(写入侧本应拒收,此处抓历史脏数据/外部写入)。 */
export function findWhyTooShort(invalidRecords) {
  const out = []
  for (const { line, raw, validation } of invalidRecords) {
    const whyErr = validation.errors.find((e) => e.field === 'why' && /少于/.test(e.why))
    if (!whyErr) continue
    out.push({
      line,
      seat: typeof raw.seat === 'string' ? raw.seat : '',
      action: typeof raw.action === 'string' ? raw.action : '',
      chars: typeof raw.why === 'string' ? countChars(raw.why.trim()) : 0,
      why: clip(raw.why, 80),
    })
  }
  return out
}

/** D 型:同一席位的决策序列按**文件物理顺序**读,`at` 必须非递减;倒退即点名(跨席位交错不算)。 */
export function findTimeOutOfOrder(records) {
  const last = new Map()
  const out = []
  for (const { line, validation } of records) {
    if (!validation.ok) continue
    const e = validation.entry
    const prev = last.get(e.seat)
    if (!prev) {
      last.set(e.seat, { line, at: e.at })
      continue
    }
    const back = Date.parse(prev.at) - Date.parse(e.at)
    if (back > 0) {
      out.push({ seat: e.seat, line, at: e.at, prevLine: prev.line, prevAt: prev.at, backwardsMs: back })
    }
    last.set(e.seat, { line, at: e.at })
  }
  return out
}

/** 坏行(JSON 解不出 / 非对象)与"结构坏但非 why 过短"的条目,一律单独点名,不得吞掉。 */
export function findStructurallyBad(rd) {
  const out = []
  for (const b of rd.badLines) out.push({ line: b.line, kind: 'bad-json', why: b.why, raw: b.raw })
  for (const { line, raw, validation } of rd.invalidRecords) {
    const onlyWhyShort = validation.errors.length === 1 && validation.errors[0].field === 'why' && /少于/.test(validation.errors[0].why)
    if (onlyWhyShort) continue
    out.push({
      line,
      kind: 'invalid-entry',
      why: validation.errors.map((e) => `${e.field}: ${e.why}`).join('; '),
      raw: clip(JSON.stringify(raw), 160),
    })
  }
  return out
}

/**
 * 汇总报告。`--seat` 只缩小 B/C/D 的判定集;A 型用**全量**决策集 ——
 * "某枚提交有没有任何决策"与"查哪个席位"无关,按席位缩 A 会把别人的决策当成没有。
 */
export function buildReport({ root = ROOT, ledger = null, sinceIso, untilIso, seat = null, maxCommits = DEFAULT_MAX_COMMITS, listLimit = DEFAULT_LIST_LIMIT }) {
  const baseFilter = { since: sinceIso, until: untilIso }
  const rdAll = readDecisions(baseFilter, { root, ledger })
  if (!rdAll.ok) {
    return { ok: false, status: 'undetermined', why: rdAll.why, ledgerState: rdAll.state, path: rdAll.path, window: { since: sinceIso, until: untilIso } }
  }
  const rd = seat ? readDecisions({ ...baseFilter, seat }, { root, ledger }) : rdAll
  if (!rd.ok) {
    return { ok: false, status: 'undetermined', why: rd.why, ledgerState: rd.state, path: rd.path, window: { since: sinceIso, until: untilIso } }
  }

  const cl = listCommits({ root, sinceIso, untilIso, maxCommits })
  if (!cl.ok) {
    return { ok: false, status: 'undetermined', why: cl.why, ledgerState: 'ok', path: rd.path, window: { since: sinceIso, until: untilIso } }
  }
  if (cl.truncated) {
    return {
      ok: false,
      status: 'undetermined',
      why: `窗口内提交 ${cl.rawCount} 条 > 上限 ${maxCommits}(截断面不能当全量判,§0.3):收窄 --since/--until 或显式调大 --max-commits`,
      ledgerState: 'ok',
      path: rd.path,
      window: { since: sinceIso, until: untilIso },
    }
  }

  const commitShas = rdAll.records.filter((r) => r.validation.ok && r.validation.entry.commit).map((r) => r.validation.entry.commit)
  const probe = probeCommits(root, commitShas)
  if (!probe.ok) {
    return { ok: false, status: 'undetermined', why: probe.why, ledgerState: 'ok', path: rd.path, window: { since: sinceIso, until: untilIso } }
  }

  // `--seat` 下 C 型也按原始 seat 字段缩小(否则报的是别席的短理由);JSON 坏行没有席位信息,
  // 始终全量点名 —— 宁可多报一条无主的坏行,也不把"解不出的行"藏在席位过滤后面。
  const scopedInvalid = seat ? rd.invalidRecords.filter((r) => r.raw && r.raw.seat === seat) : rd.invalidRecords

  const findings = {
    commitWithoutDecision: findCommitWithoutDecision(cl.commits, rdAll.records),
    decisionWithoutCommit: findDecisionWithoutCommit(rd.records, probe.exists),
    whyTooShort: findWhyTooShort(scopedInvalid),
    timeOutOfOrder: findTimeOutOfOrder(rd.records),
    structurallyBad: findStructurallyBad({ badLines: rd.badLines, invalidRecords: scopedInvalid }),
  }
  const totals = {
    commitWithoutDecision: findings.commitWithoutDecision.length,
    decisionWithoutCommit: findings.decisionWithoutCommit.length,
    whyTooShort: findings.whyTooShort.length,
    timeOutOfOrder: findings.timeOutOfOrder.length,
    structurallyBad: findings.structurallyBad.length,
  }
  const issues = Object.values(totals).reduce((a, b) => a + b, 0)
  return {
    ok: true,
    status: issues === 0 ? 'ok' : 'issues',
    why: '',
    path: rd.path,
    ledgerState: rd.state,
    window: { since: sinceIso, until: untilIso },
    seat,
    counts: {
      commits: cl.commits.length,
      decisions: rdAll.records.length,
      scoped: rd.records.length,
      invalid: rd.invalidRecords.length,
      badLines: rd.badLines.length,
      filteredOut: seat ? rdAll.records.length - rd.records.length : 0,
    },
    totals,
    issues,
    findings,
    listLimit,
  }
}

/** 人读渲染:四型各一节,每节先报总数再逐条点名(截断只影响列表长度,不影响总数)。 */
export function renderHuman(report) {
  const L = []
  if (!report.ok) {
    L.push(`DECISION-LOG-AUDIT state=undetermined`)
    L.push(`  原因:${report.why}`)
    if (report.path) L.push(`  台账:${report.path}`)
    return L.join('\n')
  }
  const { window: w, counts: c, totals: t } = report
  L.push(
    `DECISION-LOG-AUDIT state=${report.status} window=${w.since}..${w.until} seat=${report.seat || '(all)'} commits=${c.commits} decisions=${c.decisions} scoped=${c.scoped}`,
  )
  L.push(`  台账:${report.path}`)
  const list = (arr, render) => {
    for (const x of arr.slice(0, report.listLimit)) L.push(`    ${render(x)}`)
    if (arr.length > report.listLimit) L.push(`    … 另有 ${arr.length - report.listLimit} 条未列(--list-limit 可调)`)
  }
  L.push(`A 有 commit 无 decision:${t.commitWithoutDecision} 条`)
  list(report.findings.commitWithoutDecision, (x) => `- ${x.sha} (${x.at}) ${x.subject}`)
  L.push(`B 有 decision 无 commit:${t.decisionWithoutCommit} 条`)
  list(report.findings.decisionWithoutCommit, (x) => `- L${x.line} seat=${x.seat || '(空)'} kind=${x.kind}${x.sha ? ` sha=${x.sha}` : ''} ${x.why}`)
  L.push(`C why 过短(<${MIN_WHY_CHARS} 字):${t.whyTooShort} 条`)
  list(report.findings.whyTooShort, (x) => `- L${x.line} seat=${x.seat || '(空)'} chars=${x.chars} why=${x.why || '(空)'}`)
  L.push(`D 同席时间倒序:${t.timeOutOfOrder} 条`)
  list(report.findings.timeOutOfOrder, (x) => `- L${x.line} seat=${x.seat} at=${x.at} < L${x.prevLine} ${x.prevAt}(倒退 ${x.backwardsMs}ms)`)
  L.push(`坏行/结构坏条目:${t.structurallyBad} 条`)
  list(report.findings.structurallyBad, (x) => `- L${x.line} ${x.kind} ${x.why}`)
  L.push(`结论:${report.status === 'ok' ? '四型均为 0' : `判出 ${report.issues} 条(逐条已列)`}`)
  return L.join('\n')
}

/**
 * 入口(纯参数 → 退出码)。`--self-test` 例外:它自己造夹具。
 * 返回 Promise<number>:0 / 1 / 2。
 */
export async function runCli(argv, { root = ROOT, ledger = null, now = null } = {}) {
  if (argv.includes('--self-test')) return selfTest(argv)
  let sinceIso
  let untilIso
  let seat = null
  let maxCommits = DEFAULT_MAX_COMMITS
  let listLimit = DEFAULT_LIST_LIMIT
  let json = false
  try {
    const nowIso = now || new Date().toISOString()
    const sinceRaw = parseFlag(argv, '--since')
    const untilRaw = parseFlag(argv, '--until')
    const seatRaw = parseFlag(argv, '--seat')
    const rootRaw = parseFlag(argv, '--root')
    const ledgerRaw = parseFlag(argv, '--ledger')
    const maxRaw = parseFlag(argv, '--max-commits')
    const limitRaw = parseFlag(argv, '--list-limit')
    sinceIso = sinceRaw ? parseTimeArg(sinceRaw, '--since') : new Date(Date.parse(nowIso) - DAY_MS).toISOString()
    untilIso = untilRaw ? parseTimeArg(untilRaw, '--until') : nowIso
    if (Date.parse(sinceIso) > Date.parse(untilIso)) throw new InputError(`--since(${sinceIso})晚于 --until(${untilIso})`)
    if (seatRaw !== null) {
      seat = seatRaw.trim()
      if (!seat) throw new InputError('--seat 不能是空串')
    }
    if (maxRaw !== null) maxCommits = parseIntArg(maxRaw, '--max-commits', { min: 1 })
    if (limitRaw !== null) listLimit = parseIntArg(limitRaw, '--list-limit', { min: 1 })
    if (rootRaw !== null) root = resolve(rootRaw)
    if (ledgerRaw !== null) ledger = resolve(ledgerRaw)
    json = argv.includes('--json')
  } catch (e) {
    console.error(`DECISION-LOG-INPUT ${e?.message ?? e}`)
    return 2
  }

  let report
  try {
    report = buildReport({ root, ledger, sinceIso, untilIso, seat, maxCommits, listLimit })
  } catch (e) {
    console.error(`DECISION-LOG-ERROR 取数层异常:${e?.stack ?? e}`)
    return 2
  }
  if (json) console.log(JSON.stringify(report, null, 2))
  else console.log(renderHuman(report))
  if (!report.ok) {
    if (!json) console.error(`DECISION-LOG-UNDETERMINED ${report.why}`)
    return 2
  }
  return report.status === 'ok' ? 0 : 1
}

/** 夹具内初始化 git:提交面必须能被真 `git log` 读到,而不是拿假对象骗自己。 */
function gitOrThrow(args, cwd) {
  const r = gitRaw(args, { cwd })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} 失败(rc=${r.status}):${clip(r.stderr, 300)}`)
  return r
}

function commitFile(cwd, file, content, msg, iso) {
  mkdirSync(dirname(resolve(cwd, file)), { recursive: true })
  writeFileSync(resolve(cwd, file), content, 'utf8')
  gitOrThrow(['add', file], cwd)
  const r = spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', msg], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: { ...process.env, GIT_AUTHOR_DATE: iso, GIT_COMMITTER_DATE: iso },
  })
  if (r.status !== 0) throw new Error(`git commit 失败(rc=${r.status}):${clip(r.stderr, 300)}`)
  return gitOrThrow(['rev-parse', 'HEAD'], cwd).stdout.trim()
}

export async function selfTest() {
  const checks = []
  const t = async (name, fn) => {
    try {
      await fn()
      checks.push({ name, ok: true })
    } catch (e) {
      checks.push({ name, ok: false, why: e?.message ?? String(e) })
    }
  }
  const SINCE = '2026-10-19T00:00:00.000Z'
  const UNTIL = '2026-10-23T00:00:00.000Z'
  let box = null
  try {
    box = mkScratch('decision-log-selftest-')
    gitOrThrow(['init', '-q', '-b', 'main'], box)
    const c1 = commitFile(box, 'a.txt', '1\n', 'first', '2026-10-20T00:00:00+00:00')
    const c2 = commitFile(box, 'b.txt', '2\n', 'second', '2026-10-21T00:00:00+00:00')
    const c3 = commitFile(box, 'c.txt', '3\n', 'third', '2026-10-22T00:00:00+00:00')
    const ledger = resolve(box, 'decision-log.jsonl')
    const writeRows = (rows) => writeFileSync(ledger, rows.map((r) => `${JSON.stringify(r)}\n`).join(''), 'utf8')
    const base = (over = {}) => ({
      at: '2026-10-20T01:00:00.000Z',
      seat: 'r5',
      action: 'land-plan-branch',
      why: '同题两号且正文已漂开,机器折半必有损,故选人工裁决档',
      evidence: ['node scripts/check-plan-task-duplicates.mjs 末行 0 冲突'],
      ...over,
    })
    const report = (over = {}) => buildReport({ root: box, ledger, sinceIso: SINCE, untilIso: UNTIL, ...over })
    const good = () => [base({ commit: c1 }), base({ at: '2026-10-21T01:00:00.000Z', commit: c2 }), base({ at: '2026-10-22T01:00:00.000Z', commit: c3 })]

    await t('① 夹具 git 面可用(3 枚提交都落在窗口内)', () => {
      const cl = listCommits({ root: box, sinceIso: SINCE, untilIso: UNTIL })
      if (!cl.ok) throw new Error(cl.why)
      if (cl.commits.length !== 3) throw new Error(`应 3 枚提交,实得 ${cl.commits.length}`)
      const shas = new Set(cl.commits.map((x) => x.sha))
      for (const sha of [c1, c2, c3]) if (!shas.has(sha)) throw new Error(`缺提交 ${sha}`)
    })

    await t('② 全绿档:每条提交都有决策 ⇒ 四型均 0(防恒红)', () => {
      writeRows(good())
      const r = report()
      if (!r.ok) throw new Error(r.why)
      if (r.status !== 'ok' || r.issues !== 0) throw new Error(`应 ok/0,实得 ${r.status}/${r.issues}:${JSON.stringify(r.totals)}`)
    })

    await t('③ A 型:有 commit 无 decision 逐条点名', () => {
      writeRows([base({ commit: c1 }), base({ at: '2026-10-22T01:00:00.000Z', commit: c3 })])
      const r = report()
      if (r.totals.commitWithoutDecision !== 1) throw new Error(`应 1 条,实得 ${r.totals.commitWithoutDecision}`)
      if (r.findings.commitWithoutDecision[0].sha !== c2) throw new Error('点名的不是未覆盖的那枚提交')
    })

    await t('④ B 型 dangling:决策声明的提交仓内不存在', () => {
      writeRows([
        base({ commit: c1 }),
        base({ at: '2026-10-21T01:00:00.000Z', commit: c2 }),
        base({ at: '2026-10-22T01:00:00.000Z', commit: c3 }),
        base({ at: '2026-10-22T02:00:00.000Z', commit: 'a'.repeat(40) }),
      ])
      const r = report()
      if (r.totals.decisionWithoutCommit !== 1) throw new Error(`应 1 条,实得 ${r.totals.decisionWithoutCommit}`)
      if (r.findings.decisionWithoutCommit[0].kind !== 'dangling') throw new Error('kind 应 dangling')
      if (r.totals.commitWithoutDecision !== 0) throw new Error('A 型被 B 型污染')
    })

    await t('⑤ B 型 unbound:决策没绑 commit', () => {
      const e2 = base({ at: '2026-10-21T01:00:00.000Z' })
      delete e2.commit
      writeRows([base({ commit: c1 }), e2, base({ at: '2026-10-22T01:00:00.000Z', commit: c3 })])
      const r = report()
      if (r.totals.decisionWithoutCommit !== 1) throw new Error(`应 1 条,实得 ${r.totals.decisionWithoutCommit}`)
      if (r.findings.decisionWithoutCommit[0].kind !== 'unbound') throw new Error('kind 应 unbound')
    })

    await t('⑥ C 型:why 少于 10 字点名,且不混进结构坏行', () => {
      writeRows([base({ commit: c1, why: '改一下' }), base({ at: '2026-10-21T01:00:00.000Z', commit: c2 }), base({ at: '2026-10-22T01:00:00.000Z', commit: c3 })])
      const r = report()
      if (r.totals.whyTooShort !== 1) throw new Error(`应 1 条,实得 ${r.totals.whyTooShort}`)
      if (r.findings.whyTooShort[0].chars !== 3) throw new Error(`chars 应 3,实得 ${r.findings.whyTooShort[0].chars}`)
      if (r.totals.structurallyBad !== 0) throw new Error('why 过短被误并进结构坏行')
    })

    await t('⑦ D 型:同席时间倒序点名;跨席交错不算', () => {
      writeRows([
        base({ at: '2026-10-20T01:00:00.000Z', commit: c1 }),
        base({ at: '2026-10-22T01:00:00.000Z', commit: c2 }),
        base({ at: '2026-10-21T01:00:00.000Z', commit: c3 }),
      ])
      const bad = report()
      if (bad.totals.timeOutOfOrder !== 1) throw new Error(`应 1 条,实得 ${bad.totals.timeOutOfOrder}`)
      if (!(bad.findings.timeOutOfOrder[0].backwardsMs > 0)) throw new Error('backwardsMs 必须为正')

      writeRows([
        base({ at: '2026-10-20T01:00:00.000Z', seat: 'r5', commit: c1 }),
        base({ at: '2026-10-19T01:00:00.000Z', seat: 'r6', commit: c2 }),
        base({ at: '2026-10-21T01:00:00.000Z', seat: 'r5', commit: c3 }),
      ])
      const ok = report()
      if (ok.totals.timeOutOfOrder !== 0) throw new Error('跨席位交错被误判成倒序')
    })

    await t('⑧ 坏行点名且不吞好行', () => {
      writeRows(good())
      appendFileSync(ledger, '{bad\n', 'utf8')
      const r = report()
      if (!r.ok) throw new Error(r.why)
      if (r.counts.decisions !== 3) throw new Error(`好行应 3 条,实得 ${r.counts.decisions}`)
      if (r.counts.badLines !== 1) throw new Error(`坏行应 1 条,实得 ${r.counts.badLines}`)
      if (r.totals.structurallyBad !== 1) throw new Error('坏行未点名')
    })

    await t('⑨ 窗口过滤:since 之后只剩 1 枚提交且其决策仍在', () => {
      writeRows(good())
      const r = report({ sinceIso: '2026-10-21T12:00:00.000Z' })
      if (r.counts.commits !== 1) throw new Error(`窗口内应 1 枚提交,实得 ${r.counts.commits}`)
      if (r.totals.commitWithoutDecision !== 0) throw new Error('窗口内唯一提交应已有决策')
    })

    await t('⑩ 台账取不到 ⇒ exit 2 未判定(不冒绿)', async () => {
      const rc = await runCli(['--root', box, '--ledger', resolve(box, 'nope.jsonl'), '--json'], { root: box })
      if (rc !== 2) throw new Error(`应 rc=2,实得 ${rc}`)
    })

    await t('⑪ --seat 只筛 B/C/D,不筛 A(别人的决策不能被当成没有)', () => {
      writeRows(good())
      const r = report({ seat: 'r9' })
      if (r.counts.scoped !== 0) throw new Error(`r9 应 0 条,实得 ${r.counts.scoped}`)
      if (r.totals.commitWithoutDecision !== 0) throw new Error('A 型被 seat 过滤缩小 ⇒ 假红')
    })

    await t('⑫ 提交数超上限 ⇒ 未判定(截断面不当全量)', async () => {
      writeRows(good())
      const r = report({ maxCommits: 1 })
      if (r.ok || r.status !== 'undetermined') throw new Error(`应未判定,实得 ${r.status}`)
      const rc = await runCli(['--root', box, '--ledger', ledger, '--since', SINCE, '--until', UNTIL, '--max-commits', '1', '--json'], { root: box })
      if (rc !== 2) throw new Error(`应 rc=2,实得 ${rc}`)
    })

    await t('⑬ 参数坏值 ⇒ exit 2(不回落默认)', async () => {
      if ((await runCli(['--root', box, '--since'], { root: box })) !== 2) throw new Error('--since 无值未拒')
      if ((await runCli(['--root', box, '--since', '不是时间'], { root: box })) !== 2) throw new Error('坏日期未拒')
      if ((await runCli(['--root', box, '--since', UNTIL, '--until', SINCE], { root: box })) !== 2) throw new Error('since>until 未拒')
    })

    await t('⑭ 写入路径:合法条目落盘可读回,坏条目一条不落', () => {
      writeFileSync(ledger, '', 'utf8')
      const ok = appendDecision(base({ commit: c1 }), { ledger })
      if (!ok.ok) throw new Error(`合法条目被拒:${ok.why}`)
      const rd = readDecisions({}, { ledger })
      if (!rd.ok || rd.total !== 1) throw new Error(`读回应 1 条,实得 ${rd.total}`)
      const before = readFileSync(ledger, 'utf8')
      const bad = appendDecision(base({ commit: c1, why: '短' }), { ledger })
      if (bad.ok) throw new Error('坏条目被放行')
      const after = readFileSync(ledger, 'utf8')
      if (before !== after) throw new Error('坏条目改动了台账字节')
    })
  } catch (e) {
    checks.push({ name: '夹具准备', ok: false, why: e?.message ?? String(e) })
  } finally {
    if (box) rmScratch(box)
  }
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : ` — ${c.why}`}`)
  const bad = checks.filter((c) => !c.ok)
  console.log(`# self-test ${checks.length - bad.length}/${checks.length}`)
  return bad.length === 0 ? 0 : 1
}

// §22d 双形态入口:被测试 import 时不得触发主流程。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  runCli(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code
    },
    (e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    },
  )
}

export const __test__ = {
  DEFAULT_MAX_COMMITS,
  DEFAULT_LIST_LIMIT,
  DAY_MS,
  InputError,
  clip,
  gitRaw,
  parseFlag,
  parseTimeArg,
  parseIntArg,
  listCommits,
  probeCommits,
  findCommitWithoutDecision,
  findDecisionWithoutCommit,
  findWhyTooShort,
  findTimeOutOfOrder,
  findStructurallyBad,
  buildReport,
  renderHuman,
  runCli,
  selfTest,
  ledgerRel: DECISION_LEDGER_REL,
  ledgerPath,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
