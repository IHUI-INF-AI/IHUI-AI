#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 旁路落地 / 跳门总量统计(`G-725`,**只读量算仪**,不是判据,不进提交链)。
 *
 * 要回答的那句话(AGENTS §12f):"有多少提交是在检查未跑的状态下入库的?"
 * 此前答不出 —— 台账 `.workbuddy/safe-commit-attestation.jsonl` 只有 `safe-commit.mjs` **决定跳门**时
 * 才写行,于是"过了全部门禁的正常提交"与"根本不跑钩子的旁路提交"在账面上同形(2026-09-29 现读:
 * 当日零点起 0 条,而同一窗口非合并提交 222 枚)。本器把四态拆开:
 *
 *   normal         —— 有**正证**说门禁跑过且没红:该提交的文件集合与钩子日志里某一轮 `staged 文件清单`
 *                     回显逐字等值,且那一轮的批量汇总 `失败: 0`。
 *   skipped        —— 台账里有一条跳门留痕(safe-commit 写的 kind ∈ {not-ours/unattributed/…}),其
 *                     `headBefore` 等于该提交的父 ⇒ 这枚提交是在检查未跑的状态下入库的。
 *   bypass-landing —— 台账里 kind=bypass-landing 且 `landedSha` 等于该提交(commit-tree + CAS 旁路落地,
 *                     由 `scripts/lib/commit-attestation.mjs` 写)。
 *   unknown        —— 三条正证一条都拿不到。**不得**并进 normal,也不得并进 skipped。
 *
 * 三条不可动摇的口径:
 *   1. **取不到就说"未判定"并点名原因,绝不用 0 冒充结论**:台账文件不存在(missing)≠ 今天没人绕门;
 *      钩子日志只读了尾部 ⇒ "normal 的下界",更早的轮次看不见就是看不见。
 *   2. **合并不算"检查未跑"**:并集合并的两侧已被计入,本器单列一枚数,不混进总量。
 *   3. **只读**:不写盘、不改任何 ref、不跑构建;派生一律带 timeout(守门 80)与 windowsHide(守门 52)。
 *
 * 用法:node scripts/plan-bypass-ledger-report.mjs [--days N|--since YYYY-MM-DD [--until YYYY-MM-DD]]
 *                                                  [--json] [--root DIR] [--self-test] [--limit N]
 * 退出码:0 = 报告已产出(有未判定也是 0 —— 它是量算仪,不阻断任何东西);1 = --self-test 有失败例;
 *         2 = 脚本自身异常(取数层抛出,不是业务结论)。
 */
import { closeSync, fstatSync, openSync, readSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { git } from './lib/bypass-git.mjs'
import { BYPASS_KIND, readLedgerRecords } from './lib/commit-attestation.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')

/** 钩子日志的尾部读取上限:真仓该文件现读约 5 MB;超了就只读尾部并如实报"前面没看见"。 */
const HOOK_TAIL_BYTES = 4 * 1024 * 1024
const DAY_MS = 86_400_000
const LOG_LIMIT_DEFAULT = 3000

const dayKey = (iso) => String(iso ?? '').slice(0, 10)

/**
 * 台账 → 三张索引。纯函数,构造面可直接断言。
 *   bypass:  landedSha → 记录
 *   skip:    headBefore(= 那枚提交的父) → 记录数组(同父多枚时按作者时刻取最近的一条)
 *   mine:    safe-commit 判"本任务自己的红"⇒ 拒绝跳门、不落地面 ⇒ 不得被读成 skipped
 */
export function indexLedger(records = []) {
  const bypass = new Map()
  const skip = new Map()
  let mine = 0
  let bypassNoSha = 0
  let skipNoParent = 0
  for (const r of records) {
    if (r.kind === BYPASS_KIND) {
      if (r.landedSha) bypass.set(r.landedSha, r)
      else bypassNoSha++ // kind 对得上却绑不到 sha ⇒ 形同没写,必须报数(否则静默丢一条旁路)
      continue
    }
    if (r.kind === 'mine') {
      mine++
      continue
    }
    if (r.headBefore) {
      const list = skip.get(r.headBefore) || []
      list.push(r)
      skip.set(r.headBefore, list)
    } else skipNoParent++
  }
  return { bypass, skip, mine, bypassNoSha, skipNoParent }
}

/**
 * 剥 ANSI 色码。钩子日志是**带色**落盘的(汇总行原文即 `  <ESC>[31m失败: 1<ESC>[0m`),不剥色 ⇒
 * 行首锚点永不成立 ⇒ 一轮都找不到 ⇒ normal 恒 0,而账面读起来像"今天没有一个提交过门"。
 * 这是"把没判写成判过了"那一型,不是格式偏好。
 */
const ANSI_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

export function stripAnsi(s) {
  return String(s ?? '').replace(ANSI_RE, '')
}

/** 钩子日志 → 轮次数组:每轮 = 一次 `staged 文件清单` 回显 + 其后**第一个**批量汇总的失败数。 */
export function parseHookRounds(text) {
  const lines = stripAnsi(text).split(/\r?\n/)
  const rounds = []
  let pending = null
  let collecting = false
  for (const raw of lines) {
    const l = raw.trim()
    // 回显行真形态是 `ℹ️  staged 文件清单(6 个):`(带前缀与全角冒号前的空格),不锚行首。
    const echo = l.match(/staged 文件清单\((\d+) 个\)[:：]\s*$/)
    if (echo) {
      pending = { files: [], declared: Number(echo[1]), failed: null }
      collecting = true
      continue
    }
    if (pending && collecting) {
      const f = l.match(/^-\s+(\S.*)$/)
      if (f) {
        pending.files.push(f[1].trim())
        continue
      }
      if (l !== '') collecting = false // 清单块结束:后面的 `- xxx` 属于别的块,不得混进来
    }
    const sum = l.match(/^失败:\s*(\d+)/)
    if (sum && pending) {
      pending.failed = Number(sum[1])
      rounds.push(pending)
      pending = null
      collecting = false
    }
  }
  return rounds
}

/** 该提交能否被某一轮"门跑过且没红"正证到?命中即消费该轮(一轮只给一枚提交作保)。 */
export function matchNormalRound(commit, rounds) {
  const mine = [...commit.files].sort().join('\n')
  for (const r of rounds) {
    if (r.consumed || r.failed !== 0) continue
    if ([...r.files].sort().join('\n') === mine && mine !== '') {
      r.consumed = true
      return r
    }
  }
  return null
}

/**
 * 逐枚提交定四态。纯函数:输入 = 提交数组 + 台账索引 + 钩子轮次 + 三个"取不到"开关。
 * 返回按日聚合的行与逐枚明细,**任何一维取不到都记进 unknown 并带上原因**(不并桶)。
 */
export function classifyAll({
  commits = [],
  index = { bypass: new Map(), skip: new Map(), mine: 0, other: 0 },
  rounds = [],
  ledgerReadable = true,
  ledgerState = 'read',
  roundsAvailable = true,
} = {}) {
  const detail = []
  const byDay = new Map()
  for (const c of commits) {
    let state
    let why = ''
    if (index.bypass.has(c.sha)) {
      state = 'bypass-landing'
    } else {
      const cand = (index.skip.get(c.parent) || []).filter(
        (r) => c.ms === null || r.ms === null || Math.abs(r.ms - c.ms) <= 6 * 3600_000,
      )
      if (cand.length === 1) state = 'skipped'
      else if (cand.length > 1) {
        // 同父多条跳门留痕(空提交/重试)⇒ 时间序最近的一条才算这枚
        cand.sort((a, b) => Math.abs(a.ms - c.ms) - Math.abs(b.ms - c.ms))
        state = 'skipped'
        why = `同父 ${index.skip.get(c.parent).length} 条留痕,按时刻取最近一条`
      } else if (matchNormalRound(c, rounds)) state = 'normal'
      else {
        state = 'unknown'
        why = !ledgerReadable
          ? `台账取不到(${ledgerState})`
          : !roundsAvailable
            ? '钩子轮次取不到 ⇒ normal 无从正证'
            : '无旁路留痕、无跳门留痕、无逐字等值的零失败钩子轮'
      }
    }
    const day = c.day
    if (!byDay.has(day))
      byDay.set(day, { day, normal: 0, skipped: 0, bypassLanding: 0, unknown: 0, total: 0 })
    const row = byDay.get(day)
    row.total++
    if (state === 'normal') row.normal++
    else if (state === 'skipped') row.skipped++
    else if (state === 'bypass-landing') row.bypassLanding++
    else row.unknown++
    detail.push({ sha: c.sha.slice(0, 11), day, state, why })
  }
  return { rows: [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : -1)), detail }
}

/** 尾部读(不整档进内存):返回 {text, truncated, bytes}。 */
function readTail(path, maxBytes) {
  let fd
  try {
    fd = openSync(path, 'r')
  } catch (e) {
    return { ok: false, state: e?.code === 'ENOENT' ? 'missing' : 'unreadable', why: String(e?.message ?? e).slice(0, 120) }
  }
  try {
    const st = fstatSync(fd)
    const len = Math.min(st.size, maxBytes)
    const buf = Buffer.alloc(len)
    readSync(fd, buf, 0, len, st.size - len)
    return {
      ok: true,
      text: buf.toString('utf8'),
      truncated: st.size > len,
      skippedBytes: Math.max(0, st.size - len),
      size: st.size,
    }
  } finally {
    closeSync(fd)
  }
}

/** 一次 git log 拿到「提交 + 父 + 作者时刻 + 改名清单」(-z 不用,按 @ 头行分段)。 */
export function collectCommits({
  root,
  limit = LOG_LIMIT_DEFAULT,
  sinceDay = '0000-00-00',
  untilDay = '9999-99-99',
} = {}) {
  let out
  try {
    out = git(
      ['log', '-n', String(limit), '--no-merges', '--no-renames', '--format=@%H%x09%P%x09%aI', '--name-only'],
      { root, timeout: 60_000 },
    )
  } catch (e) {
    return { ok: false, why: `git log 取不到:${String(e?.message ?? e).slice(0, 160)}`, commits: [] }
  }
  const commits = []
  let cur = null
  for (const line of String(out).split(/\r?\n/)) {
    if (line.startsWith('@')) {
      if (cur) commits.push(cur)
      const [sha, parent, iso] = line.slice(1).split('\t')
      const ms = Date.parse(iso)
      cur = { sha, parent: (parent || '').split(' ')[0], iso, ms: Number.isFinite(ms) ? ms : null, day: dayKey(iso), files: [] }
      continue
    }
    const t = line.trim()
    if (cur && t !== '') cur.files.push(t)
  }
  if (cur) commits.push(cur)
  const inWin = commits.filter((c) => c.day >= sinceDay && c.day <= untilDay)
  return { ok: true, why: null, commits: inWin, truncated: commits.length >= limit, total: commits.length }
}

/** 合并提交枚数(单列,不参与四态)。 */
export function countMerges({
  root,
  limit = LOG_LIMIT_DEFAULT,
  sinceDay = '0000-00-00',
  untilDay = '9999-99-99',
} = {}) {
  try {
    const out = git(['log', '-n', String(limit), '--merges', '--format=%H%x09%aI'], { root, timeout: 60_000 })
    const rows = String(out)
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => {
        const [, iso] = l.split('\t')
        const ms = Date.parse(iso)
        return { iso, ms: Number.isFinite(ms) ? ms : null, day: dayKey(iso) }
      })
      .filter((r) => r.day >= sinceDay && r.day <= untilDay)
    const byDay = new Map()
    for (const r of rows) byDay.set(r.day, (byDay.get(r.day) || 0) + 1)
    return { ok: true, count: rows.length, byDay }
  } catch (e) {
    return { ok: false, count: 0, byDay: new Map(), why: String(e?.message ?? e).slice(0, 120) }
  }
}

/** 机器本地日(与 git `%aI` 的**作者本地日**同一量纲;混用 UTC 会让"今天"漏掉当天早晨的提交)。 */
function localDay(ms) {
  const d = new Date(ms)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * 窗口 = **作者本地日**的闭区间(YYYY-MM-DD 字符串,字典序即时间序)。
 * 刻意不用 ms 区间:%aI 带作者时区偏移,按 UTC 零点切会把当天 00:00–08:00(+08)整段切掉
 * —— 实测 `--since 2026-09-29` 用 ms 判据得 0 枚,而同一窗口按日字符串判有数百枚。
 */
function resolveWindow(argv) {
  const get = (name) => {
    const i = argv.indexOf(name)
    return i >= 0 ? argv[i + 1] : null
  }
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
  const since = get('--since')
  const until = get('--until')
  const today = localDay(Date.now())
  if (since) {
    if (!DAY_RE.test(since)) return { error: `--since 不是 YYYY-MM-DD:${since}` }
    if (until && !DAY_RE.test(until)) return { error: `--until 不是 YYYY-MM-DD:${until}` }
    const untilDay = until || today
    if (untilDay < since) return { error: `--until(${untilDay}) 早于 --since(${since})` }
    return { sinceDay: since, untilDay, label: `${since}..${until ? until : '今'}` }
  }
  const days = Number(get('--days') ?? 1)
  if (!Number.isFinite(days) || days <= 0) return { error: `--days 必须是正整数,实得 ${get('--days')}` }
  return { sinceDay: localDay(Date.now() - (days - 1) * DAY_MS), untilDay: today, label: `近 ${days} 天(按本地日,含今天)` }
}

async function run({ argv }) {
  const root = argv.includes('--root') ? resolve(argv[argv.indexOf('--root') + 1]) : REPO_ROOT
  const asJson = argv.includes('--json')
  const win = resolveWindow(argv)
  if (win.error) {
    console.error(`❌ ${win.error}`)
    return 2
  }
  const limit = argv.includes('--limit') ? Number(argv[argv.indexOf('--limit') + 1]) : LOG_LIMIT_DEFAULT

  const ledger = readLedgerRecords(root)
  const index = indexLedger(ledger.records)

  const hookPath = resolve(root, '.workbuddy', 'hook-logs', 'pre-commit.log')
  const hook = readTail(hookPath, HOOK_TAIL_BYTES)
  const rounds = hook.ok ? parseHookRounds(hook.text) : []

  const got = collectCommits({ root, limit, sinceDay: win.sinceDay, untilDay: win.untilDay })
  const merges = countMerges({ root, limit, sinceDay: win.sinceDay, untilDay: win.untilDay })

  if (!got.ok) {
    console.error(`❌ 提交清单取不到 ⇒ **未判定**,不产出任何四态结论:${got.why}`)
    console.error('   (本器绝不在没有提交面时说"0 条" —— 那正是本票要消灭的误读)')
    return 0
  }

  const { rows, detail } = classifyAll({
    commits: got.commits,
    index,
    rounds,
    ledgerReadable: ledger.ok,
    ledgerState: ledger.state,
    roundsAvailable: hook.ok,
  })
  const total = rows.reduce((a, r) => a + r.total, 0)
  const sums = {
    normal: rows.reduce((a, r) => a + r.normal, 0),
    skipped: rows.reduce((a, r) => a + r.skipped, 0),
    bypassLanding: rows.reduce((a, r) => a + r.bypassLanding, 0),
    unknown: rows.reduce((a, r) => a + r.unknown, 0),
  }

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          root,
          window: win.label,
          sinceDay: win.sinceDay,
          untilDay: win.untilDay,
          dayFrame: 'author-local-day',
          ledger: {
            ok: ledger.ok,
            state: ledger.state,
            path: ledger.path,
            records: ledger.records.length,
            badLines: ledger.badLines.length,
            why: ledger.why,
          },
          hook: {
            ok: hook.ok,
            state: hook.state ?? 'read',
            rounds: rounds.length,
            truncated: hook.truncated === true,
            skippedBytes: hook.skippedBytes ?? null,
            why: hook.why ?? null,
          },
          commits: { counted: total, truncated: got.truncated === true, limit: got.truncated ? limit : null },
          merges: { counted: merges.count, ok: merges.ok, why: merges.why ?? null },
          ledgerUnbound: {
            bypassNoSha: index.bypassNoSha,
            skipNoParent: index.skipNoParent,
            refusedMine: index.mine,
          },
          sums,
          rows,
          detail,
        },
        null,
        2,
      ),
    )
  } else {
    console.log(`📊 旁路/跳门总量 —— ${win.label}(root=${root})`)
    console.log(
      `  非合并提交 ${total} 枚 / 合并 ${merges.count} 枚(合并不参与四态;两数相加 = 窗口内全部落地)`,
    )
    console.log('  日期          normal  skipped  bypass  unknown')
    for (const r of rows)
      console.log(
        `  ${r.day}   ${String(r.normal).padStart(5)}  ${String(r.skipped).padStart(7)}  ${String(r.bypassLanding).padStart(6)}  ${String(r.unknown).padStart(7)}`,
      )
    console.log(
      `  合计           ${sums.normal}         ${sums.skipped}        ${sums.bypassLanding}        ${sums.unknown}`,
    )
    console.log(`  台账:${ledger.ok ? `可读(${ledger.path})记录 ${ledger.records.length} 条 / 坏行 ${ledger.badLines.length}` : `**未判定**(${ledger.state}:${ledger.why})`}`)
    console.log(`  钩子轮次:${hook.ok ? `尾部读到 ${rounds.length} 轮${hook.truncated ? '(已截断 ⇒ normal 只是下界)' : ''}` : `**未判定**(${hook.state}:${hook.why})`}`)
    if (hook.ok && hook.truncated)
      console.log(`⚠️ 钩子日志 ${hook.size} B,只读了尾部 ${hook.size - hook.skippedBytes} B(前面 ${hook.skippedBytes} B 没看见)⇒ normal 是**下界**,不是全量`)
    if (index.bypassNoSha > 0)
      console.log(`  ⚠️ 旁路留痕里 ${index.bypassNoSha} 条没有 landedSha ⇒ 绑不到提交,只报数不判绿`)
    if (index.skipNoParent > 0)
      console.log(`  ⚠️ 跳门留痕里 ${index.skipNoParent} 条没有 headBefore ⇒ 绑不到提交,只报数`)
    if (index.mine > 0) console.log(`  ℹ 台账里 ${index.mine} 条 kind=mine 是"拒绝跳门、未落地",不计入任何一态`)
    if (sums.unknown > 0) {
      console.log(`  ⚠️ unknown=${sums.unknown}:这些枚"没有任何一条正证"。**不得**读成 normal,也不得读成 skipped。`)
      for (const d of detail.filter((x) => x.state === 'unknown').slice(0, 12))
        console.log(`     · ${d.sha} ${d.day} —— ${d.why}`)
      if (detail.filter((x) => x.state === 'unknown').length > 12) console.log('     …(其余逐条见 --json 的 detail)')
    }
    if (ledger.badLines.length > 0)
      console.log(`  ❌ 台账有 ${ledger.badLines.length} 行解不出(行号 ${ledger.badLines.slice(0, 5).map((b) => b.n).join(',')}),这些行**没有**被算成"没发生"`)
    console.log(
      `  口径:normal 的唯一正证 = 钩子日志里文件集合逐字等值且"失败: 0"的一轮;skipped 的唯一正证 = 台账某条跳门留痕的 headBefore == 该提交的父;bypass 的唯一正证 = 台账 landedSha == 该提交。`,
    )
    console.log(
      `  未判定维度:${[
        ledger.ok ? null : '台账取不到',
        hook.ok ? null : '钩子轮次取不到',
        got.truncated ? `提交清单被 --limit ${limit} 截断` : null,
        merges.ok ? null : '合并计数取不到',
      ]
        .filter(Boolean)
        .join(' / ') || '无'}`,
    )
  }
  return 0
}

/** 自检:构造面 + 两条反假绿锁(硬要求④)。零写盘、零 git 派生。 */
function selfTest() {
  const C = (sha, parent, ms, files) => ({
    sha,
    parent,
    iso: new Date(ms).toISOString(),
    ms,
    day: dayKey(new Date(ms).toISOString()),
    files,
  })
  const T = 1_759_000_000_000
  const rec = (o) => ({
    ms: T,
    ts: new Date(T).toISOString(),
    kind: '',
    gatesRun: false,
    ranFullBatch: false,
    declaredFiles: [],
    headBefore: '',
    landedSha: '',
    source: '',
    ...o,
  })
  const fails = []
  const ok = (name, cond, extra = '') => {
    if (!cond) fails.push(`${name} ${extra}`)
    console.log(`${cond ? '✅' : '❌'} ${name}${cond ? '' : ` —— ${extra}`}`)
  }

  // 锁①:旁路落地一行都不落 ⇒ 必须报 unknown 而不是"一切正常"
  {
    const commits = [C('a'.repeat(40), 'p1', T, ['x.ts']), C('b'.repeat(40), 'p2', T, ['y.ts'])]
    const r = classifyAll({ commits, index: indexLedger([]), rounds: [], ledgerReadable: true })
    ok('①空台账 ⇒ unknown=2 且 total=2', r.rows[0].unknown === 2 && r.rows[0].total === 2, JSON.stringify(r.rows))
    ok('①空台账 ⇒ bypass/normal/skipped 全 0', r.rows[0].bypassLanding === 0 && r.rows[0].normal === 0 && r.rows[0].skipped === 0)
    ok('①unknown 带原因', (r.detail.find((d) => d.sha === 'a'.repeat(11))?.why ?? '').includes('无旁路留痕'), JSON.stringify(r.detail))
  }
  // 锁①b:台账取不到(missing)时,结论必须写"未判定"而不是 0
  {
    const commits = [C('a'.repeat(40), 'p1', T, ['x.ts'])]
    const r = classifyAll({ commits, index: indexLedger([]), rounds: [], ledgerReadable: false, ledgerState: 'missing' })
    ok('①b台账 missing ⇒ unknown=1 且原因点名"台账取不到"', r.rows[0].unknown === 1 && r.detail[0].why.includes('台账取不到'), r.detail[0].why)
  }
  // 锁②:bypass-landing 必须真被计进总量(不是被丢进 unknown)
  {
    const sha = 'c'.repeat(40)
    const commits = [C(sha, 'p1', T, ['x.ts']), C('d'.repeat(40), 'p2', T, ['y.ts'])]
    const idx = indexLedger([rec({ kind: BYPASS_KIND, landedSha: sha, declaredFiles: ['x.ts'], gatesRun: false })])
    const r = classifyAll({ commits, index: idx, rounds: [], ledgerReadable: true })
    ok('②旁路计进总量(bypass=1,unknown=1)', r.rows[0].bypassLanding === 1 && r.rows[0].unknown === 1 && r.rows[0].total === 2, JSON.stringify(r.rows))
  }
  // skipped:headBefore == 父 ⇒ 归 skipped,不归 unknown/normal
  {
    const commits = [C('e'.repeat(40), 'f'.repeat(40), T, ['x.ts'])]
    const idx = indexLedger([rec({ kind: 'not-ours', headBefore: 'f'.repeat(40), ranFullBatch: false })])
    const r = classifyAll({ commits, index: idx, rounds: [], ledgerReadable: true })
    ok('跳门留痕按父绑定 ⇒ skipped=1', r.rows[0].skipped === 1, JSON.stringify(r.rows))
  }
  // mine 不算跳门(拒绝跳门 ⇒ 那枚提交根本没落地)
  {
    const commits = [C('e'.repeat(40), 'f'.repeat(40), T, ['x.ts'])]
    const idx = indexLedger([rec({ kind: 'mine', headBefore: 'f'.repeat(40) })])
    const r = classifyAll({ commits, index: idx, rounds: [], ledgerReadable: true })
    ok('kind=mine 不得被算成 skipped', r.rows[0].skipped === 0 && idx.mine === 1)
  }
  // normal:唯一正证 = 逐字等值 + 失败 0 的钩子轮
  {
    const commits = [C('g'.repeat(40), 'h'.repeat(40), T, ['a.ts', 'b.ts'])]
    const rounds = parseHookRounds(
      ['ℹ️  staged 文件清单(2 个):', '  - a.ts', '  - b.ts', '🛡️ 守门脚本批量检查汇总', '  失败: 0'].join('\n'),
    )
    const r = classifyAll({ commits, index: indexLedger([]), rounds, ledgerReadable: true })
    ok('有零失败等值轮 ⇒ normal=1', r.rows[0].normal === 1, JSON.stringify(r.rows))
    const r2 = classifyAll({ commits, index: indexLedger([]), rounds: parseHookRounds(
      ['ℹ️  staged 文件清单(2 个):', '  - a.ts', '  - b.ts', '🛡️ 守门脚本批量检查汇总', '  失败: 2'].join('\n')), ledgerReadable: true })
    ok('同轮但失败:2 ⇒ 不得算 normal(反例)', r2.rows[0].normal === 0 && r2.rows[0].unknown === 1, JSON.stringify(r2.rows))
  }
  // landedSha 缺失的旁路留痕 ⇒ 报数,不静默
  {
    const idx = indexLedger([rec({ kind: BYPASS_KIND, landedSha: '' })])
    ok('旁路留痕无 landedSha ⇒ 计入 bypassNoSha(不静默丢弃)', idx.bypassNoSha === 1 && idx.bypass.size === 0)
  }
  // ANSI 剥色有牙:带色原文必须仍能量出一轮(不剥色 ⇒ 恒 0 轮 ⇒ normal 恒 0 = 把没判写成判过了)
  {
    const E = String.fromCharCode(27)
    const colored = [
      '  ℹ️  staged 文件清单(2 个):',
      '  - a.ts',
      '  - b.ts',
      `  ${E}[31m失败: 0${E}[0m`,
    ].join('\n')
    const rs = parseHookRounds(colored)
    ok('ANSI 色码不得把轮次消成 0 轮', rs.length === 1 && rs[0].failed === 0, JSON.stringify(rs))
    ok('stripAnsi 去掉控制序列', stripAnsi(`${E}[31mX${E}[0m`) === 'X')
  }
  // 坏行:parse 不吞
  {
    const bad = parseHookRounds('staged 文件清单(1 个):\n  - a.ts\n(没有汇总就结束)')
    ok('钩子轮没等到汇总 ⇒ 不产出该轮(不猜失败数)', bad.length === 0)
  }
  console.log(`\n自检:${fails.length === 0 ? '全部通过' : `${fails.length} 条失败`}(组数按当次实跑,不钉数字)`)
  return fails.length === 0 ? 0 : 1
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      '用法:node scripts/plan-bypass-ledger-report.mjs [--days N|--since YYYY-MM-DD [--until YYYY-MM-DD]] [--json] [--root DIR] [--limit N] [--self-test]',
    )
    return 0
  }
  if (argv.includes('--self-test')) return selfTest()
  return await run({ argv })
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = { indexLedger, parseHookRounds, classifyAll, matchNormalRound, collectCommits, countMerges, dayKey }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
