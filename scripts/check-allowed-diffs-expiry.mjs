#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-allowed-diffs-expiry.mjs — 允许差异到期回收器(只读,不写任何文件)。
 *
 * 立因(2026-11-03):`scripts/data/cross-end-allowed-diffs.json` 的 91 条登记只在
 * `check-cross-end-ui-parity` / `check-web-rn-style-tiers` 被跑到时才顺带核查到期,
 * 没有一条独立入口回答「这本账现在有多少条已过期 / 多少条 90 天内到期 / 有没有缺 owner
 * 或缺 expires 的裸条目」。到期只在跑门时点名 = 没人跑门就没人看见;而白名单腐化的形态
 * 恰恰是"没人再看它"。
 *
 * 三态(按 `expires` 字段,今天为 UTC 当日):
 *   · active   —— 距到期 > 90 天;
 *   · expiring —— 0 ≤ 距到期 ≤ 90 天(含当日到期);
 *   · expired  —— 到期日 < 今天;**缺 expires / expires 非法 / 缺 owner 一律计 expired**
 *                (裸条目不是"永久有效",不许默默放过)。
 *
 * 退出码:
 *   0 = 无 expired,且(--gate 时不再因 expiring 判红 / 非 gate 时无 expiring);
 *   1 = 有 expired,或非 --gate 档有 expiring(默认档把临期也算态,催人续期或收敛);
 *   2 = 无法判定(文件读不到 / JSON 坏 / entries 不是数组),既不冒红也不记绿(§0.3)。
 *   `--gate` 只影响 expiring:临期逐条告警但退出码保持 0,除非同时有 expired。
 *
 * 用法:
 *   node scripts/check-allowed-diffs-expiry.mjs                 # 人读报告(临期也判 1)
 *   node scripts/check-allowed-diffs-expiry.mjs --gate          # CI 档:expiring 只告警
 *   node scripts/check-allowed-diffs-expiry.mjs --json          # 机器可读
 *   node scripts/check-allowed-diffs-expiry.mjs --file=<路径>    # 换账本(测试/演练/外部输入)
 *   node scripts/check-allowed-diffs-expiry.mjs --staged         # 判索引 blob(提交门)
 *   node scripts/check-allowed-diffs-expiry.mjs --worktree       # 判磁盘(人工排查逃生舱)
 *   node scripts/check-allowed-diffs-expiry.mjs --today=<YYYY-MM-DD>  # 固定"今天"(测试注入)
 *   node scripts/check-allowed-diffs-expiry.mjs --self-test     # 纯内存判据自检
 *
 * 取材面(守门 118 统一层):默认判 HEAD blob、`--staged` 判索引 blob、`--worktree` 判磁盘。
 * 盘上随后改对不算修好 —— 提交进去的仍是索引那一份;`--file=<路径>` 是显式外部输入,才按盘读。
 */
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

import { Undetermined, catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
export const DEFAULT_LEDGER_REL = 'scripts/data/cross-end-allowed-diffs.json'
export const EXPIRING_WINDOW_DAYS = 90

/**
 * 按判定面取账本正文。仓库内账本必须经 face-reader:
 * 默认 HEAD blob、`--staged` 索引 blob、`--worktree` 磁盘;取不到抛 Undetermined ⇒ exit 2,不记绿。
 * `--file=<路径>` 是显式外部输入(测试夹具/演练账本),才按盘读 —— 不冒充仓库内容,也不参与面选择。
 */
export function readLedger(root, { file = null, face = 'head' } = {}) {
  if (file) {
    const abs = resolve(file)
    const text = readWorktreeFile(dirname(abs), basename(abs))
    if (text === null) throw new Undetermined(`外部账本取不到:${file}`)
    return text
  }
  if (face === 'worktree') {
    const text = readWorktreeFile(root, DEFAULT_LEDGER_REL)
    if (text === null) throw new Undetermined(`工作树账本取不到:${DEFAULT_LEDGER_REL}`)
    return text
  }
  const ref = face === 'head' ? 'HEAD' : ''
  const spec = `${ref}:${DEFAULT_LEDGER_REL}`
  let map
  try {
    map = catBatch(root, [spec], { maxBuffer: 64 << 20, timeout: 120000 })
  } catch (e) {
    throw new Undetermined(`${face} 面账本取不到:${e?.message ?? e}`)
  }
  const text = map.get(spec)
  if (text === null || text === undefined)
    throw new Undetermined(`${face} 面账本不存在:${DEFAULT_LEDGER_REL}`)
  return text
}

/** UTC 当日 ISO(与门 128 的到期判据同一口径;不用本地时区,避免跨时区机器读数漂移)。 */
export function todayISO(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10)
}

/** 严格 YYYY-MM-DD + 真实日历日(2027-02-30 这类非法日期不得被字符串比较放行)。 */
export function isValidISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** 两个合法 ISO 日之间的整天数(to - from);非法入参返回 null。 */
export function daysBetween(fromISO, toISO) {
  if (!isValidISODate(fromISO) || !isValidISODate(toISO)) return null
  const ms = Date.parse(`${toISO}T00:00:00Z`) - Date.parse(`${fromISO}T00:00:00Z`)
  return Math.round(ms / 86400000)
}

/**
 * 单条裁决。返回值至少含 status / daysLeft / problems:
 * problems 非空且涉及 expires/owner 时一律 expired —— 缺字段不是"免检",是已到期。
 */
export function classifyEntry(entry, today = todayISO()) {
  const problems = []
  const ownerMissing = typeof entry?.owner !== 'string' || !entry.owner.trim()
  const expiresMissing = typeof entry?.expires !== 'string' || !entry.expires.trim()
  if (ownerMissing) problems.push('owner 缺失')
  if (expiresMissing) problems.push('expires 缺失')
  else if (!isValidISODate(entry.expires)) problems.push(`expires 非法(${entry.expires})`)
  let daysLeft = null
  if (!expiresMissing && isValidISODate(entry.expires)) daysLeft = daysBetween(today, entry.expires)
  if (ownerMissing || expiresMissing || daysLeft === null) {
    return { status: 'expired', daysLeft, problems }
  }
  if (entry.expires < today) return { status: 'expired', daysLeft, problems }
  if (daysLeft <= EXPIRING_WINDOW_DAYS) return { status: 'expiring', daysLeft, problems }
  return { status: 'active', daysLeft, problems }
}

/**
 * 条目在原文里的起始行(1-based)。按 component 字面量顺序查找,而不是重新实现 JSON 解析:
 * 判据只消费账本内容,行号只为人能点回去看;找不到(缺 component / 压缩成单行极端形态)给 null,
 * 报告里如实写 "?"。
 */
export function locateEntryLines(raw, entries) {
  const out = []
  let cursor = 0
  for (const e of entries) {
    const component = e?.component
    if (typeof component !== 'string' || !component) {
      out.push(null)
      continue
    }
    const needle = `"component": ${JSON.stringify(component)}`
    const idx = raw.indexOf(needle, cursor)
    if (idx < 0) {
      out.push(null)
      continue
    }
    cursor = idx + needle.length
    out.push(raw.slice(0, idx).split('\n').length)
  }
  return out
}

/** 全账裁决:records 保持输入顺序(报告逐条点名要用原序)。 */
export function analyzeLedger(raw, ledger, today = todayISO()) {
  const entries = ledger?.entries
  if (!Array.isArray(entries))
    throw new Error('账本缺少 entries 数组(无法判定,不得按 0 条记绿)')
  const lines = locateEntryLines(raw, entries)
  const records = entries.map((entry, index) => {
    const c = classifyEntry(entry, today)
    return {
      index,
      line: lines[index],
      component: typeof entry?.component === 'string' ? entry.component : '(缺 component)',
      key: typeof entry?.key === 'string' ? entry.key : '(缺 key)',
      owner: typeof entry?.owner === 'string' ? entry.owner : null,
      expires: typeof entry?.expires === 'string' ? entry.expires : null,
      reason: typeof entry?.reason === 'string' ? entry.reason : null,
      ...c,
    }
  })
  return { today, records, counts: countRecords(records) }
}

export function countRecords(records) {
  const counts = {
    total: records.length,
    active: 0,
    expiring: 0,
    expired: 0,
    missingOwner: 0,
    missingExpires: 0,
    invalidExpires: 0,
  }
  for (const r of records) {
    counts[r.status] += 1
    if (r.problems.includes('owner 缺失')) counts.missingOwner += 1
    if (r.problems.includes('expires 缺失')) counts.missingExpires += 1
    else if (r.problems.some((p) => p.startsWith('expires 非法'))) counts.invalidExpires += 1
  }
  return counts
}

/** 退出码唯一出口:expired 必红;expiring 只在非 --gate 档算态。 */
export function exitCodeFor(counts, { gate = false } = {}) {
  if (counts.expired > 0) return 1
  if (!gate && counts.expiring > 0) return 1
  return 0
}

function formatRecord(r, ledgerRel) {
  const at = `${ledgerRel}:${r.line ?? '?'}`
  const owner = r.owner ?? '(缺失)'
  const expires = r.expires ?? '(缺失)'
  const why = r.problems.length ? ` | ${r.problems.join(' / ')}` : ''
  return `${at} ${r.component} × ${r.key} owner=${owner} expires=${expires}${why} :: ${r.reason ?? '(缺 reason)'}`
}

function printHuman({ ledgerRel, face, report, gate, code }) {
  const { counts } = report
  console.log(`📅 允许差异到期回收器 —— ${ledgerRel}(${face},today=${report.today})`)
  console.log(
    `   总数=${counts.total} active=${counts.active} expiring=${counts.expiring} expired=${counts.expired}` +
      ` | 缺 owner=${counts.missingOwner} 缺 expires=${counts.missingExpires} expires 非法=${counts.invalidExpires}`,
  )
  const expired = report.records.filter((r) => r.status === 'expired')
  if (expired.length) {
    console.log(`🔴 已到期 ${expired.length} 条(逐条点名):`)
    for (const r of expired) console.log(`   · ${formatRecord(r, ledgerRel)}`)
  }
  const expiring = report.records.filter((r) => r.status === 'expiring')
  if (expiring.length) {
    console.log(
      `⚠️ 90 天内到期 ${expiring.length} 条${gate ? '(--gate:只告警,不改退出码)' : '(默认档:临期也判 1)'}:`,
    )
    for (const r of expiring) console.log(`   · ${formatRecord(r, ledgerRel)} daysLeft=${r.daysLeft}`)
  }
  console.log(
    `${code === 0 ? '✅' : code === 1 ? '🔴' : '❓'} 结论 expired=${counts.expired} expiring=${counts.expiring} exit=${code}`,
  )
}

async function selfTestRun() {
  const { test } = await import('node:test')
  const assert = (await import('node:assert/strict')).default
  await test('E1 三态:active / expiring(≤90) / expired', () => {
    assert.equal(classifyEntry({ owner: 'o', expires: '2028-01-01' }, '2026-11-03').status, 'active')
    assert.equal(classifyEntry({ owner: 'o', expires: '2027-01-01' }, '2026-11-03').status, 'expiring')
    assert.equal(classifyEntry({ owner: 'o', expires: '2026-11-03' }, '2026-11-03').status, 'expiring')
    assert.equal(classifyEntry({ owner: 'o', expires: '2026-11-02' }, '2026-11-03').status, 'expired')
  })
  await test('E2 缺 owner / 缺 expires / 非法 expires 一律 expired,不默默放过', () => {
    assert.equal(classifyEntry({ expires: '2028-01-01' }, '2026-11-03').status, 'expired')
    assert.equal(classifyEntry({ owner: 'o' }, '2026-11-03').status, 'expired')
    assert.equal(classifyEntry({ owner: 'o', expires: '2027-02-30' }, '2026-11-03').status, 'expired')
  })
  await test('E3 --gate 只豁免 expiring,不豁免 expired', () => {
    assert.equal(exitCodeFor({ expired: 0, expiring: 2 }, { gate: false }), 1)
    assert.equal(exitCodeFor({ expired: 0, expiring: 2 }, { gate: true }), 0)
    assert.equal(exitCodeFor({ expired: 1, expiring: 0 }, { gate: true }), 1)
  })
  console.log('✅ self-test 3 例全绿')
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) {
    await selfTestRun()
    return
  }
  if (args.includes('--help')) {
    console.log('用法见 scripts/check-allowed-diffs-expiry.mjs 头注')
    return
  }
  const gate = args.includes('--gate')
  const json = args.includes('--json')
  const fileArg = args.find((a) => a.startsWith('--file='))
  const todayArg = args.find((a) => a.startsWith('--today='))
  const file = fileArg ? fileArg.slice('--file='.length) : null
  const ledgerRel = file ?? DEFAULT_LEDGER_REL
  const sel = selectFace({
    staged: args.includes('--staged'),
    worktree: args.includes('--worktree'),
    def: 'head',
  })
  if (sel.error) {
    console.error(`❌ 用法错:${sel.error}`)
    process.exit(2)
  }
  const face = sel.face
  const today = todayArg ? todayArg.slice('--today='.length) : todayISO()
  if (!isValidISODate(today)) {
    console.error(`❌ 用法错:--today 必须是真实 YYYY-MM-DD,收到 ${today}`)
    process.exit(2)
  }
  let raw
  try {
    raw = readLedger(ROOT, { file, face })
    if (!raw.trim()) throw new Undetermined('账本为空')
  } catch (e) {
    const out = {
      state: 'unjudged',
      ledger: ledgerRel,
      face: file ? 'file' : face,
      error: `读不到账本:${e?.message ?? e}`,
      exit: 2,
    }
    if (json) console.log(JSON.stringify(out, null, 2))
    else console.error(`❓ 无法判定 —— ${out.error}`)
    process.exit(2)
  }
  let ledger
  try {
    ledger = JSON.parse(raw)
  } catch (e) {
    const out = { state: 'unjudged', ledger: ledgerRel, error: `账本 JSON 解析失败:${e?.message ?? e}`, exit: 2 }
    if (json) console.log(JSON.stringify(out, null, 2))
    else console.error(`❓ 无法判定 —— ${out.error}`)
    process.exit(2)
  }
  let report
  try {
    report = analyzeLedger(raw, ledger, today)
  } catch (e) {
    const out = { state: 'unjudged', ledger: ledgerRel, error: e?.message ?? String(e), exit: 2 }
    if (json) console.log(JSON.stringify(out, null, 2))
    else console.error(`❓ 无法判定 —— ${out.error}`)
    process.exit(2)
  }
  const code = exitCodeFor(report.counts, { gate })
  if (json) {
    console.log(
      JSON.stringify(
        {
          ledger: ledgerRel,
          face: file ? 'file' : face,
          today: report.today,
          gate,
          counts: report.counts,
          expired: report.records.filter((r) => r.status === 'expired'),
          expiring: report.records.filter((r) => r.status === 'expiring'),
          exit: code,
        },
        null,
        2,
      ),
    )
  } else {
    printHuman({ ledgerRel, face: file ? 'file' : face, report, gate, code })
  }
  process.exit(code)
}

export const __test__ = {
  DEFAULT_LEDGER_REL,
  EXPIRING_WINDOW_DAYS,
  readLedger,
  todayISO,
  isValidISODate,
  daysBetween,
  classifyEntry,
  locateEntryLines,
  analyzeLedger,
  countRecords,
  exitCodeFor,
  selfTestRun,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}
