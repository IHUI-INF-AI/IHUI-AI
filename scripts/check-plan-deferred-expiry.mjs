#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-plan-deferred-expiry.mjs —— 台账 `deferred@` 到期判据(2026-11-03 立;守门 292,blocking 档)。
 *
 * 一、标记格式
 *   登记行里写 `deferred@YYYY-MM-DD(到期复评)`。日期是**允许继续挂着的最后一天**,不是"开始复评的
 *   那天":当天仍算未超期,次日起才红。编号由 `lib/plan-task-index.mjs` 的 compositeKeyOf 解析(与
 *   台账同一份,不造第二套);owner 由侧车 `scripts/data/plan-fields.jsonl` 的 fieldsFor 解析(与
 *   守门 check-plan-fields 同一份)。本门不复制任何键名规则。
 *
 * 二、宽限语义
 *   `--grace <N>` 默认 0:deferred 日当天放行,次日起红;给 N 则把红线整体顺延 N 天。
 *   宽限是"允许补复评的时间",不是"再挂 N 天"——宽限用完后仍不复评,第 N+1 天照红。
 *
 * 三、为什么到期必须复评
 *   `deferred@` 是"暂缓决定",不是"永久豁免"。到期无人复评,这行会以"已完成"的姿态永久留在
 *   台账里,把真实缺口变成纸面承诺。人记不住日期,所以判据常驻:到期即红,只留两条真出路——
 *   ① 复评后改 `deferred@` 续期(写明为什么还要挂、何时再评)② 结清并摘行。不许只删标记。
 *
 * 四、三态(§0.3:拿不准不记绿)
 *   exit 0 —— 全部未到期(含 0 条 deferred 行;汇总行 `rows=N expired=M`);
 *   exit 1 —— 有到期未复评,逐条点名 `行号 | 编号 | deferred 日期 | owner`(含超期天数);
 *   exit 2 —— 无法判定:台账/侧车取不到、marker 日期非法、侧车有坏记录、参数非法。
 *
 * 取材面(守门 118):默认 HEAD blob、`--staged` 索引 blob、`--worktree` 磁盘。
 * `--file=<路径>` / `--fields-file=<路径>` 是**显式外部输入**(测试夹具/演练台账),才按盘读。
 *
 * 用法:
 *   node scripts/check-plan-deferred-expiry.mjs
 *   node scripts/check-plan-deferred-expiry.mjs --as-of 2027-04-01 --grace 7
 *   node scripts/check-plan-deferred-expiry.mjs --gate          # CI/门链档:到期即 1(与默认同判)
 *   node scripts/check-plan-deferred-expiry.mjs --json          # 机器可读(含 summary 字符串)
 *   node scripts/check-plan-deferred-expiry.mjs --staged        # 判索引 blob(提交门)
 *   node scripts/check-plan-deferred-expiry.mjs --worktree      # 判磁盘(人工排查逃生舱)
 *   node scripts/check-plan-deferred-expiry.mjs --file=... --fields-file=...  # 夹具/演练
 *   镜像:node --test scripts/tests/check-plan-deferred-expiry.test.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { makeRegistrar } from './lib/selftest-registrant.mjs'
import { fieldsFor, loadFields } from './lib/plan-fields.mjs'
import { compositeKeyOf } from './lib/plan-task-index.mjs'
import { readFieldsFace } from './plan-tasks.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const PLAN_REL = 'PROJECT_PLAN.md'
const FACE_LABEL = { head: 'HEAD blob', staged: '索引 blob', worktree: '工作树' }

class UsageError extends Error {}

export function isValidISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** 本机"今天"必须按 Asia/Shanghai 判:UTC 面会让 00:00-08:00 的提交提前/滞后一天触红。 */
export function todayInShanghai(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const pick = (t) => parts.find((p) => p.type === t)?.value
  return `${pick('year')}-${pick('month')}-${pick('day')}`
}

export function daysBetween(fromISO, toISO) {
  return Math.round(
    (Date.parse(`${toISO}T00:00:00Z`) - Date.parse(`${fromISO}T00:00:00Z`)) / 86_400_000,
  )
}

/**
 * 逐行扫 marker。带 `deferred@` 却写不成合法日期的行**不能跳过**——跳过等于把格式坏账记成绿,
 * 所以单列 malformed 交调用方判 exit 2。
 */
export function scanDeferredRows(content) {
  const rows = []
  const malformed = []
  const lines = String(content ?? '').split(/\r?\n/)
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]
    if (!raw.includes('deferred@')) continue
    const tail = raw.slice(raw.indexOf('deferred@') + 'deferred@'.length)
    const m = /^(\d{4}-\d{2}-\d{2})(?:[（(]到期复评[）)])?/.exec(tail)
    if (!m || !isValidISODate(m[1])) {
      malformed.push({ line: i + 1, token: tail.slice(0, 40), raw: raw.trim().slice(0, 140) })
      continue
    }
    const ck = compositeKeyOf(raw)
    const id = ck
      ? ck.split('#')[0]
      : ((raw.match(/\b[A-Z]{1,3}-?\d{1,6}\b/) || [])[0] ?? '(无编号)')
    rows.push({ line: i + 1, id, deferred: m[1], raw })
  }
  return { rows, malformed }
}

/** 到期判据:overdue = as-of - deferred - grace;>0 才算到期未复评(等于当天放行)。 */
export function judgeDeferred(rows, { asOf, grace = 0, fields = null } = {}) {
  const expired = []
  for (const r of rows) {
    const rec = fields ? fieldsFor({ line: r.raw, map: fields.map }).rec : null
    const owner = rec?.owner ?? '(侧车无 owner)'
    const overdueDays = daysBetween(r.deferred, asOf) - grace
    if (overdueDays > 0) expired.push({ ...r, raw: undefined, owner, overdueDays })
  }
  return { rows: rows.length, expired }
}

export function parseArgs(argv) {
  const out = {
    asOf: null,
    graceRaw: null,
    json: false,
    gate: false,
    file: null,
    fieldsFile: null,
    staged: false,
    worktree: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    const take = (name) => {
      if (a.startsWith(`${name}=`)) return a.slice(name.length + 1)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) throw new UsageError(`${name} 缺值`)
      i += 1
      return next
    }
    if (a === '--json') out.json = true
    else if (a === '--gate') out.gate = true
    else if (a === '--staged') out.staged = true
    else if (a === '--worktree') out.worktree = true
    else if (a === '--as-of' || a.startsWith('--as-of=')) out.asOf = take('--as-of')
    else if (a === '--grace' || a.startsWith('--grace=')) out.graceRaw = take('--grace')
    else if (a === '--fields-file' || a.startsWith('--fields-file='))
      out.fieldsFile = take('--fields-file')
    else if (a === '--file' || a.startsWith('--file=')) out.file = take('--file')
    else throw new UsageError(`未知参数 ${a}(见头注用法)`)
  }
  if (out.asOf !== null && !isValidISODate(out.asOf))
    throw new UsageError(`--as-of 必须是合法 YYYY-MM-DD,收到 ${out.asOf}`)
  if (out.graceRaw !== null) {
    if (!/^\d+$/.test(out.graceRaw))
      throw new UsageError(`--grace 必须是非负整数天数,收到 ${out.graceRaw}`)
    out.grace = Number(out.graceRaw)
  } else {
    out.grace = 0
  }
  return out
}

function readPlanText({ root, file, face }) {
  if (file) {
    try {
      const text = readFileSync(resolve(file), 'utf8')
      if (!text.trim()) throw new Error('空文件')
      return text
    } catch (e) {
      throw new Undetermined(`--file 读不到 ${file}(${e?.code ?? e?.message ?? e})`)
    }
  }
  if (face === 'worktree') {
    const text = readWorktreeFile(root, PLAN_REL)
    if (text === null || text === undefined) throw new Undetermined(`工作树取不到 ${PLAN_REL}`)
    return text
  }
  const spec = face === 'staged' ? `:${PLAN_REL}` : `HEAD:${PLAN_REL}`
  const text = catBatch(root, [spec], { maxBuffer: 1 << 26 }).get(spec)
  if (text === null || text === undefined)
    throw new Undetermined(`${FACE_LABEL[face] ?? face} 取不到 ${PLAN_REL}`)
  return text
}

function readSidecar({ root, file, face }) {
  if (file) {
    try {
      return loadFields(root, readFileSync(resolve(file), 'utf8'))
    } catch (e) {
      return {
        ...loadFields(root, null),
        why: `--fields-file 读不到 ${file}(${e?.code ?? e?.message ?? e})`,
      }
    }
  }
  return readFieldsFace(root, face)
}

/** 自检期间吞掉判据本体的正常输出,只留断言需要的读数。 */
function captureConsole(fn) {
  const orig = console.log
  const lines = []
  console.log = (...a) => lines.push(a.join(' '))
  try {
    return { code: fn(), text: lines.join('\n') }
  } finally {
    console.log = orig
  }
}

/**
 * `--self-test`:全部落在 mkScratch 夹具里,读 `--file` / `--fields-file` 显式输入,
 * 不读仓库活面、不联网、不写生产路径。正例证明"未到期 ⇒ 绿",反例证明"到期 ⇒ 红"
 * 与"格式坏 ⇒ 未判定(exit 2)"。判据本体一行未改,只是从同一 `main()` 入口真跑。
 */
export function runSelfTest() {
  const { t, report } = makeRegistrar()
  const dir = mkScratch('plan-deferred-selftest-')
  try {
    const plan = (name, body) => {
      const p = join(dir, name)
      writeFileSync(p, body.endsWith('\n') ? body : body + '\n', 'utf8')
      return p
    }
    const fieldsPath = join(dir, 'plan-fields.jsonl')
    writeFileSync(fieldsPath, '', 'utf8')

    const okPath = plan('ok.md', '- [ ] G-999 暂缓实施 deferred@2099-01-01(到期复评)')
    const expiredPath = plan('expired.md', '- [ ] G-999 暂缓实施 deferred@2025-01-01(到期复评)')
    const gracePath = plan('grace.md', '- [ ] G-999 暂缓实施 deferred@2027-01-01(到期复评)')
    const malformedPath = plan('malformed.md', '- [ ] G-999 暂缓实施 deferred@2025-13-45')

    const run = (file, extra = []) =>
      captureConsole(() =>
        main(['--file', file, '--fields-file', fieldsPath, ...extra], { root: dir }),
      )

    const ok = run(okPath, ['--as-of', '2027-01-01'])
    const expired = run(expiredPath, ['--as-of', '2027-01-01'])
    const inGrace = run(gracePath, ['--as-of', '2027-01-02', '--grace', '3'])
    const malformed = run(malformedPath, ['--as-of', '2027-01-01'])
    const missing = run(join(dir, 'not-exist.md'))

    t(
      '①正例:未到期的 deferred@ ⇒ exit 0,汇总 rows=1 expired=0',
      () => ok.code === 0 && /rows=1 expired=0/.test(ok.text),
      ok.text.slice(0, 160),
    )
    t(
      '②反例:已到期未复评 ⇒ exit 1 且逐条点名超期天数',
      () => expired.code === 1 && /超期 \d+ 天/.test(expired.text),
      expired.text.slice(0, 160),
    )
    t(
      '③正例:--grace 3 覆盖 2027-01-01 后的次天 ⇒ 仍 exit 0',
      () => inGrace.code === 0 && /expired=0/.test(inGrace.text),
      inGrace.text.slice(0, 160),
    )
    t(
      '④反例:日期写不成合法 YYYY-MM-DD ⇒ exit 2 未判定(不记绿)',
      () => malformed.code === 2 && /无法判定/.test(malformed.text),
      malformed.text.slice(0, 160),
    )
    t(
      '⑤反例:输入文件取不到 ⇒ exit 2 未判定',
      () => missing.code === 2 && /无法判定/.test(missing.text),
      missing.text.slice(0, 160),
    )

    const { fail, cases } = report()
    for (const c of cases)
      console.log(`${c.pass ? '✅' : '❌'} ${c.name}${c.pass ? '' : ` —— 实得:${c.got}`}`)
    console.log(
      fail
        ? `self-test: 未通过(${fail}/${cases.length} 组失败)`
        : `self-test: 全绿(${cases.length} 组)`,
    )
    return fail ? 1 : 0
  } finally {
    rmScratch(dir)
  }
}

export function main(argv = process.argv.slice(2), { root = ROOT } = {}) {
  if (argv.includes('--self-test')) return runSelfTest()
  let opt
  try {
    opt = parseArgs(argv)
  } catch (e) {
    if (!(e instanceof UsageError)) throw e
    console.log(`❓ 无法判定(exit 2):${e.message}`)
    return 2
  }
  const asOf = opt.asOf ?? todayInShanghai()
  const sel = selectFace({ staged: opt.staged, worktree: opt.worktree, def: 'head' })
  if (sel.error) {
    console.log(`❓ 无法判定(exit 2):${sel.error}`)
    return 2
  }
  const face = sel.face
  let planText
  try {
    planText = readPlanText({ root, file: opt.file, face })
  } catch (e) {
    if (!(e instanceof Undetermined)) throw e
    if (opt.json) console.log(JSON.stringify({ state: 'undetermined', why: e.message, exit: 2 }))
    else console.log(`❓ 无法判定(exit 2):${e.message}`)
    return 2
  }
  const { rows, malformed } = scanDeferredRows(planText)
  if (malformed.length > 0) {
    const why = `${malformed.length} 行 deferred@ 日期写不成合法 YYYY-MM-DD`
    if (opt.json) {
      console.log(JSON.stringify({ state: 'undetermined', why, malformed, exit: 2 }))
    } else {
      console.log(`❓ 无法判定(exit 2):${why}(格式:deferred@YYYY-MM-DD(到期复评))`)
      for (const m of malformed) console.log(`   · L${m.line} | ${m.token} | ${m.raw}`)
    }
    return 2
  }
  const fields = readSidecar({ root, file: opt.fieldsFile, face })
  if (fields.undetermined || fields.malformed > 0) {
    const why = fields.undetermined
      ? `侧车取不到/不可判:${fields.why ?? '未知原因'}`
      : `侧车有 ${fields.malformed} 条坏记录(键名/值域坏),不能拿它点名 owner`
    if (opt.json) console.log(JSON.stringify({ state: 'undetermined', why, exit: 2 }))
    else console.log(`❓ 无法判定(exit 2):${why}`)
    return 2
  }
  const verdict = judgeDeferred(rows, { asOf, grace: opt.grace, fields })
  const exit = verdict.expired.length > 0 ? 1 : 0
  const summary = `rows=${verdict.rows} expired=${verdict.expired.length}`
  if (opt.json) {
    console.log(
      JSON.stringify({
        state: exit === 0 ? 'ok' : 'expired',
        face,
        asOf,
        graceDays: opt.grace,
        summary,
        rows: verdict.rows,
        expired: verdict.expired.length,
        expiredRows: verdict.expired,
        exit,
      }),
    )
    return exit
  }
  console.log(
    `📆 台账 deferred@ 到期判据 —— ${PLAN_REL}(面=${FACE_LABEL[face] ?? face}, as-of=${asOf}, grace=${opt.grace} 天)`,
  )
  console.log(`   ${summary}`)
  if (verdict.expired.length === 0) {
    const earliest = [...rows].sort((a, b) =>
      a.deferred < b.deferred ? -1 : a.deferred > b.deferred ? 1 : 0,
    )[0]
    if (earliest)
      console.log(
        `   ✅ 最近一次到期 ${earliest.deferred}(${earliest.id},还剩 ${daysBetween(asOf, earliest.deferred)} 天)`,
      )
    return 0
  }
  console.log(`🔴 到期未复评 ${verdict.expired.length} 条:`)
  for (const r of verdict.expired)
    console.log(`   · L${r.line} | ${r.id} | ${r.deferred} | ${r.owner} | 超期 ${r.overdueDays} 天`)
  console.log(
    '   💡 出路:复评后改 deferred@ 续期(写明为什么还要挂、何时再评),或结清并摘行;不许只删标记。',
  )
  return 1
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = main()
}

export const __test__ = {
  isValidISODate,
  todayInShanghai,
  daysBetween,
  scanDeferredRows,
  judgeDeferred,
  parseArgs,
  main,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
