#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-task-claims.mjs — 扫描 PROJECT_PLAN.md 任务认领状态
 *
 * 三态分类(AGENTS.md §1 任务认领机制配套):
 *   - 无人认领: `- [ ]` 开头(不含"进行中")
 *   - 进行中:   `- [ ]（进行中）` 开头(全角括号)
 *   - 已完成:   `- [x]` 开头
 *
 * 用法:
 *   node scripts/check-task-claims.mjs             # 人类可读汇总
 *   node scripts/check-task-claims.mjs --json      # JSON 输出
 *   node scripts/check-task-claims.mjs --unclaimed  # 只列无人认领
 *   node scripts/check-task-claims.mjs --in-progress # 只列进行中(含持有者/年龄列)
 *   node scripts/check-task-claims.mjs --twins     # 列已闭环孪生旧行与逐字重复组
 *   node scripts/check-task-claims.mjs --check-gate [--json]  # 租约判据 CL1/CL2/CL3,违规 exit 1
 *   node scripts/check-task-claims.mjs --self-test # 纯函数夹具自检,不碰真 PROJECT_PLAN
 *   node scripts/check-task-claims.mjs --plan <file>   # 只读注入:改判指定文件(取证/多租约场景用)
 *   node scripts/check-task-claims.mjs --ttl-hours <n> # 覆盖租约年龄阈值(默认 72h,亦可 IHUI_CLAIM_LEASE_TTL_HOURS)
 *
 * 2026-09-23 立, AGENTS.md §1 任务认领机制配套
 * 2026-09-25 扩租约三要素(MECHANISM-SPEC-3 §2 / A9):认领不再只是文本标记,
 *   `- [ ]（进行中@YYYY-MM-DD/持有者）` 是带到期时间的租约。三条判据:
 *   CL1 租约过期(年龄 > 阈值,默认 72h)→ 点名行号+持有者+年龄;
 *   CL2 有 @日期 而无 /持有者(半个租约比没有租约更危险)→ 红;
 *   CL3 同一行同时出现「进行中」与 [x](清账方向矛盾)→ 红。
 *   **向后兼容第一位**:旧的裸 `（进行中）` 一律只计数不判红 —— 落地当天把全仓既有
 *   标记判红 = 恒红门 = 逼人 `--no-verify` = 全部守门作废。到期**只判红只点名,
 *   绝不自动摘除标记**(摘别人的认领是越权,AGENTS §16)。全程只读,无任何 git 写操作。
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 相似度尺子**复用** lib 里的唯一实现(纯函数、零副作用)。
// 不 import `merge-live-doc.mjs`:它顶层就是 CLI 主流程且没有 §22d 的 isDirectRun 守卫,
// 一被 import 就跑参数校验并 `process.exit(2)` —— 本票第一版就这么把扫描器弄死了(实测)。
import {
  SIM_THRESHOLD,
  CONTAIN_MIN,
  jaccard,
  squash,
  tokenize,
} from './lib/live-doc-similarity.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const PLAN_PATH = resolve(ROOT, 'PROJECT_PLAN.md')

// ---------- 租约常量(2026-09-25, MECHANISM-SPEC-3 §2 / A9) ----------
const DEFAULT_TTL_HOURS = 72
const TTL_ENV = 'IHUI_CLAIM_LEASE_TTL_HOURS'
const HOUR_MS = 3600000
// ⚠ 全角括号陷阱(本仓记过的坑):「可选标记」若写成 `（进行中）?`，`?` 只作用于最后一个
//   全角字符 `）`，判据会静默退化成「必须含字面前缀 `（进行中`」——对租约行只吃掉
//   `（进行中`，`@日期/持有者）` 残留在正文里，text/bodyOf 全被污染。
//   可选形态**必须整组包住**：`(?:（进行中[^）]*）)?`。正反例由 --self-test S5 与
//   镜像测试 T11 钉死。
const CLAIM_MARKER_SRC = '（进行中[^）]*）' // 裸旧标记 或 租约形（进行中@YYYY-MM-DD/持有者）
const CLAIM_MARKER_RE = new RegExp(`^- \\[ \\]${CLAIM_MARKER_SRC}\\s*`) // 进行中分类(必须含标记)
const CLAIM_MARKER_OPTIONAL_RE = new RegExp(`^- \\[ \\](?:${CLAIM_MARKER_SRC})?\\s*`) // 可选形态
const CLAIM_MARKER_BODY_RE = new RegExp(`^(${CLAIM_MARKER_SRC})\\s*`) // bodyOf 用(已剥掉 `- [ ] `)
// 从行里截出标记本体
const CLAIM_MARK_EXTRACT_RE = new RegExp(`^- \\[ \\](${CLAIM_MARKER_SRC})`)
// 标记内部:（进行中[@YYYY-MM-DD][/持有者]）——两段都可选，组合决定形态
const LEASE_INNER_RE = /^（进行中(?:@(\d{4}-\d{2}-\d{2}))?(?:\/([^）/]+))?）$/

/**
 * 解析一条「进行中」行的租约三要素。
 * @param {string} trimmed 已 trimStart 的整行
 * @returns {{format:'legacy'|'lease'|'unknown', date:string|null, holder:string|null}}
 */
function parseClaim(trimmed) {
  const m = CLAIM_MARK_EXTRACT_RE.exec(trimmed)
  if (!m) return { format: 'none', date: null, holder: null }
  const inner = LEASE_INNER_RE.exec(m[1])
  if (!inner) return { format: 'unknown', date: null, holder: null }
  const [, date, holder] = inner
  if (!date && !holder) return { format: 'legacy', date: null, holder: null }
  if (date && !isValidIsoDate(date))
    return { format: 'unknown', date: null, holder: holder ?? null }
  return { format: 'lease', date: date ?? null, holder: holder ?? null }
}

/** `2026-02-31` 能被 Date.parse 吞成 3 月 2 日 —— 回读同一日历日才算真日期。 */
function isValidIsoDate(iso) {
  const ms = Date.parse(`${iso}T00:00:00Z`)
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === iso
}

/**
 * CL1/CL2 判据。输入 scanTasks 产出的 inProgress 行(带 format/date/holder)。
 * 旧格式(legacy)与形态不可辨(unknown)**一律只计数不判红** —— 向后兼容第一位。
 * @param {Array<{line:number,text:string,full:string,format:string,date?:string|null,holder?:string|null}>} rows
 * @param {{nowMs:number,ttlHours:number}} opts
 */
function analyzeLeases(rows, { nowMs, ttlHours }) {
  const stale = [] // CL1
  const missingHolder = [] // CL2
  let legacy = 0
  let unknown = 0
  let holderNoDate = 0
  for (const r of rows) {
    if (r.format === 'legacy') {
      legacy++
      continue
    }
    if (r.format !== 'lease') {
      unknown++
      continue
    }
    if (r.date && !r.holder) {
      missingHolder.push({ line: r.line, date: r.date, text: r.text })
      continue
    }
    if (r.date && r.holder) {
      const ageHours = (nowMs - Date.parse(`${r.date}T00:00:00Z`)) / HOUR_MS
      r.ageHours = Math.floor(ageHours)
      if (ageHours > ttlHours)
        stale.push({
          line: r.line,
          holder: r.holder,
          date: r.date,
          ageHours: r.ageHours,
          text: r.text,
        })
    } else if (r.holder) {
      holderNoDate++ // 有持有者无日期:年龄无法判定,只报数不判红(判据不猜)
    }
  }
  return { stale, missingHolder, counts: { legacy, unknown, holderNoDate } }
}

/**
 * CL3:同一行同时出现「进行中」与 [x] —— 协议自相矛盾,等价于「释放失败」的现场。
 * 独立于三态分类扫(这类行会被行首规则归进 completed,三态里看不见它)。
 *
 * ⚠ 存量取向(2026-09-25 立项实测):真仓 PROJECT_PLAN 已有 4 行同时含两 token ——
 * 两行是协议叙述文本(`` `- [ ]（进行中）` → `- [x] ✅(日期)` `` 这类带引号的例子),
 * 两行是旧裸标记留下的"翻勾未摘牌"。它们**全是裸 `（进行中）`**。若照字面判红,
 * 本门落地当天即恒红 = 逼人 `--no-verify` = 全部守门作废(本仓最高反面教训)。
 * 所以红判只认**租约形态标记**(`@日期` 或 `/持有者`,即协议新写法)与 [x] 并存;
 * 裸标记的矛盾行只计数(`legacyContradictions`)报数不判红,清账归各行持有者。
 */
function findContradictions(content) {
  const out = []
  let legacyContradictions = 0
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trimStart()
    if (!t.includes('（进行中')) continue
    if (!/\[[xX]\]/.test(t)) continue
    const markers = t.match(/（进行中[^）]*）/g) ?? []
    const hasLeaseForm = markers.some((mk) => mk !== '（进行中）')
    if (hasLeaseForm) out.push({ line: i + 1, text: t.slice(0, 120) })
    else legacyContradictions++
  }
  return { contradictions: out, legacyContradictions }
}

function resolveTtlHours(flagValue, envValue) {
  if (flagValue !== null && flagValue !== undefined)
    return { ttlHours: flagValue, source: '--ttl-hours' }
  if (envValue !== undefined && envValue !== '') {
    const n = Number(envValue)
    if (Number.isFinite(n) && n > 0) return { ttlHours: n, source: TTL_ENV }
    return {
      ttlHours: DEFAULT_TTL_HOURS,
      source: `${TTL_ENV} 值非正数(${envValue})⇒回落默认`,
      warn: true,
    }
  }
  return { ttlHours: DEFAULT_TTL_HOURS, source: '默认' }
}

/**
 * 汇总租约判据结果。violations 非空即 gate 判红。绝不改动任何文件(只判红只点名)。
 */
function checkLeaseGate(content, { nowMs, ttlHours }) {
  const { inProgress } = scanTasks(content)
  const { stale, missingHolder, counts } = analyzeLeases(inProgress, { nowMs, ttlHours })
  const { contradictions, legacyContradictions } = findContradictions(content)
  const violations = [
    ...stale.map((v) => ({ kind: 'CL1', ...v })),
    ...missingHolder.map((v) => ({ kind: 'CL2', ...v })),
    ...contradictions.map((v) => ({ kind: 'CL3', ...v })),
  ]
  return {
    violations,
    summary: {
      inProgress: inProgress.length,
      stale: stale.length,
      missingHolder: missingHolder.length,
      contradictions: contradictions.length,
      legacyContradictions,
      ...counts,
    },
    ttlHours,
  }
}

// ---------- CLI 参数白名单 ----------
// 未知开关不得静默落进默认分支(本仓在 sync-lost-commit-tags.mjs 踩过 `--push` 掉进
// `--check` 还 exit 0)——白名单外一律 exit 2。
const BOOLEAN_FLAGS = new Set([
  '--json',
  '--unclaimed',
  '--in-progress',
  '--twins',
  '--check-gate',
  '--self-test',
  '--staged',
])
const VALUE_FLAGS = new Set(['--plan', '--ttl-hours'])

/**
 * @param {string[]} argv
 * @returns {{ok:true, flags:Set<string>, plan:string|null, ttlHours:number|null}|{ok:false,error:string}}
 */
function parseArgs(argv) {
  const flags = new Set()
  let plan = null
  let ttlHours = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) return { ok: false, error: `不支持位置参数: ${a}` }
    if (VALUE_FLAGS.has(a)) {
      const v = argv[++i]
      if (v === undefined || v.startsWith('--')) return { ok: false, error: `${a} 需要一个值` }
      if (a === '--plan') plan = v
      else {
        const n = Number(v)
        if (!Number.isFinite(n) || n <= 0)
          return { ok: false, error: `--ttl-hours 需要正数,实得 ${v}` }
        ttlHours = n
      }
      continue
    }
    if (!BOOLEAN_FLAGS.has(a)) return { ok: false, error: `未知开关: ${a}` }
    flags.add(a)
  }
  return { ok: true, flags, plan, ttlHours }
}

const USAGE = [
  '用法: node scripts/check-task-claims.mjs [--json|--unclaimed|--in-progress|--twins|--check-gate|--self-test]',
  '      [--plan <file>] [--ttl-hours <n>] [--staged]',
  `      租约年龄阈值亦可经 ${TTL_ENV} 覆盖(默认 ${DEFAULT_TTL_HOURS}h)。全程只读。`,
].join('\n')

/**
 * 扫描 PROJECT_PLAN.md 内容,按三态分类任务行。
 *
 * 每行同时留 `text`(展示用的 120 字截断)与 `full`(**整行**)。相似度一律用 `full`:
 * 只比前 120 字会把"同名不同尾"的两件事判成孪生(台账里 D64/D90 这类条目在 120 字之后才分叉),
 * 而本工具的孪生标记会把那条从"可认领"里**摘掉** —— 误判的代价是藏掉一件真活。
 * 要复现这个陷阱:把 `bodyOf` 里的 `row.full || row.text` 改成 `row.text`,孪生数当场涨一批
 * (本票第一版就是这样,靠"逐对眼检"才发现多出来的是不同任务)。
 * @param {string} content - PROJECT_PLAN.md 文件内容
 * @returns {{ unclaimed: Array<{line:number,text:string,full:string}>, inProgress: Array<{}>, completed: Array<{}> }}
 */
function scanTasks(content) {
  const lines = content.split('\n')
  const unclaimed = []
  const inProgress = []
  const completed = []

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart()
    // 每条规则各推一类:顺序即优先级(进行中必须先于"无人认领"判,否则会被后一条通吃)。
    // 进行中规则用 CLAIM_MARKER_RE(含标记体,兼容旧裸 `（进行中）` 与新租约 `（进行中@日期/持有者）`),
    // 它同时把整段标记从 text 里剥掉 —— 若按 `（进行中）?` 那种写法,租约行会残留 `@日期/持有者）`。
    const kinds = [
      [/^- \[[xX]\]\s*/, completed],
      [CLAIM_MARKER_RE, inProgress],
      [/^- \[ \]\s*/, unclaimed],
    ]
    for (const [re, arr] of kinds) {
      if (!re.test(trimmed)) continue
      const row = { line: i + 1, text: trimmed.replace(re, '').slice(0, 120), full: trimmed }
      if (arr === inProgress) Object.assign(row, parseClaim(trimmed))
      arr.push(row)
      break
    }
  }

  return { unclaimed, inProgress, completed }
}

/**
 * 剥掉行首的认领标记与"已完成"注解,得到可比的**正文骨架**。
 * 必须先剥:翻勾的仓库写法是「改前缀 + 追加证据」(`- [ ] X` → `- [x] ✅(日期) X,取证…`),
 * 不剥前缀时两条同文的行开头就分叉,相似度被凭空拉低 ⇒ 孪生漏判。
 */
function bodyOf(row) {
  return (row.full || row.text)
    .replace(/^- \[[ xX]\]\s*/, '')
    .replace(CLAIM_MARKER_BODY_RE, '') // 旧裸标记与租约标记都整段剥掉(见 S5 全角括号正反例)
    .replace(/^✅\s*(（[^）]*）|\([^)]*\))?\s*/, '')
    .trim()
}

/**
 * 揪出"内容已经有一条 `[x]` 近亲"的未勾行。
 *
 * 为什么必须有(2026-09-25 实测):三态分类只看行首,而 §1 的翻勾写法会在同文件留下
 * **改写前的旧副本**(并集合并也会),于是 `- [ ]` 与 `- [x] ✅…同文…` 并存 ——
 * 派活的人(以及照清单行事的 agent)把已闭环的项当成"无人认领"接着做。本会话就被
 * 「另有 7 个脚本的 --self-test 仍走 os.tmpdir()」那一对带偏过一次。
 *
 * 尺子一律复用 `scripts/lib/live-doc-similarity.mjs` 的导出(字符二元组 Jaccard + `SIM_THRESHOLD`
 * + 容器下界 `CONTAIN_MIN`),**不在这里再抄一份** —— 两处算同一个相似度,迟早分叉成
 * "一边判孪生、一边判真丢失"。
 * 第二条通道是**包含**:未勾行骨架被 `[x]` 行逐字包住(对方只是追加了取证),
 * 这种形态 Jaccard 会随追加长度单调掉到阈值以下,只靠阈值就会漏。
 * 下界 CONTAIN_MIN 个非空白字符:再短的裸标记行在满屏清单里必然互含,会把无关项判成孪生。
 */
function findClosedTwins(rows, completed) {
  const doneBodies = completed.map((c) => ({
    line: c.line,
    body: bodyOf(c),
    sq: squash(bodyOf(c)),
  }))
  const twins = []
  for (const r of rows) {
    const body = bodyOf(r)
    if (squash(body).length < CONTAIN_MIN) continue
    const tb = tokenize(body)
    let best = null
    for (const d of doneBodies) {
      const score = jaccard(tb, tokenize(d.body))
      const contained = d.sq.includes(squash(body))
      if (score < SIM_THRESHOLD && !contained) continue
      const eff = Math.max(score, contained ? 1 : 0)
      if (!best || eff > best.score) {
        best = {
          line: d.line,
          score,
          via: score >= SIM_THRESHOLD ? (contained ? 'both' : 'jaccard') : 'contain',
        }
      }
    }
    if (best)
      twins.push({
        line: r.line,
        text: r.text.slice(0, 120),
        twinLine: best.line,
        score: best.score,
        via: best.via,
      })
  }
  return twins
}

/**
 * 同一件事被写了好几遍的**未勾**行(与上面的"已闭环孪生"是两种形态):三条一模一样的
 * `- [ ]（进行中）` 会被数成三件活。这里只按**正文骨架逐字相同**归组,不做模糊匹配 ——
 * 误判成本是把两件活并成一件,所以宁可只认逐字相同。
 */
function findDuplicateGroups(rows) {
  const byKey = new Map()
  for (const r of rows) {
    const key = squash(bodyOf(r))
    if (key.length < CONTAIN_MIN) continue
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(r.line)
  }
  return [...byKey.entries()].filter(([, ls]) => ls.length > 1).map(([, ls]) => ls)
}

function claimDisplaySuffix(row) {
  if (row.format === 'lease' && row.holder) {
    const age = typeof row.ageHours === 'number' ? ` · ${row.ageHours}h` : ''
    return `  【持有者 ${row.holder} @ ${row.date ?? '无日期'}${age}】`
  }
  if (row.format === 'lease' && row.date) return `  【⚠ 有日期无持有者 @ ${row.date}】`
  if (row.format === 'legacy') return '  【旧格式·无租约】'
  return '  【标记形态不可辨】'
}

function runCheckGate(flags, content, { nowMs, ttlHours, ttlSource }) {
  const gate = checkLeaseGate(content, { nowMs, ttlHours })
  if (flags.has('--json')) {
    console.log(
      JSON.stringify(
        {
          checkGate: true,
          exit: gate.violations.length > 0 ? 1 : 0,
          ttlHours,
          leases: gate.summary,
          violations: gate.violations,
        },
        null,
        2,
      ),
    )
  } else {
    console.log(`任务认领租约对账(阈值 ${ttlHours}h,来源:${ttlSource})`)
    if (gate.violations.length === 0) {
      console.log(
        `  ✅ 0 红。进行中 ${gate.summary.inProgress} 条全部为旧格式无日期标记(只计数不判红)或有效租约。`,
      )
    } else {
      for (const v of gate.violations) {
        if (v.kind === 'CL1')
          console.log(
            `  ❌ CL1 租约过期  L${v.line}  持有者 ${v.holder}  认领于 ${v.date}  年龄 ${v.ageHours}h > ${ttlHours}h  ${v.text}`,
          )
        if (v.kind === 'CL2')
          console.log(`  ❌ CL2 半个租约(有日期无持有者)  L${v.line}  @${v.date}  ${v.text}`)
        if (v.kind === 'CL3')
          console.log(`  ❌ CL3 同行同时出现「进行中」与 [x](清账方向矛盾)  L${v.line}  ${v.text}`)
      }
      console.log(
        '  出路三选一(本门**绝不自动摘除别人的认领**,AGENTS §16):持有者续租改日期 / 完成后翻勾并删标记 / 显式让渡改写持有者。',
      )
    }
    console.log(
      `  报数(不判红):旧格式 ${gate.summary.legacy} · 形态不可辨 ${gate.summary.unknown} · 有持有者无日期 ${gate.summary.holderNoDate} · 裸标记×[x] 矛盾行 ${gate.summary.legacyContradictions}(存量翻勾未摘牌,归各行持有者清账)`,
    )
  }
  process.exitCode = gate.violations.length > 0 ? 1 : 0
}

/**
 * 纯函数夹具自检(绝不含真 PROJECT_PLAN —— 它是多会话共写的活文档,自测行写进去
 * 就可能被别人提交带走或造成误读)。返回失败例数,0 = 全绿。
 */
function selfTest(realNow = Date.now()) {
  // 固定"当前时刻"喂判据,不依赖 realNow —— 夹具的相对年龄必须可复现。
  const NOW = Date.UTC(2026, 8, 25, 12, 0, 0) // 2026-09-25T12:00Z
  void realNow
  let failures = 0
  const results = []
  const check = (name, fn) => {
    try {
      fn()
      results.push(`✅ ${name}`)
    } catch (e) {
      failures++
      results.push(`❌ ${name}: ${e?.message ?? e}`)
    }
  }
  const eq = (a, b, msg) => {
    if (a !== b) throw new Error(`${msg ?? ''} 期望 ${JSON.stringify(b)} 实得 ${JSON.stringify(a)}`)
  }
  const gate = (doc, ttlHours = DEFAULT_TTL_HOURS) => checkLeaseGate(doc, { nowMs: NOW, ttlHours })

  // S1 旧格式不误伤(正) / 有效新租约也不红(反 pair)
  check('S1 旧裸标记与新鲜租约都 0 红', () => {
    const g = gate('- [ ]（进行中）老任务\n- [ ]（进行中@2026-09-25/qa）新任务\n')
    eq(g.violations.length, 0)
    eq(g.summary.legacy, 1, '旧格式应计 1')
  })
  // S2 新格式过期必红(正) / 同文但日期新鲜必绿(反) —— CL1
  check('S2 CL1 过期租约点名行号+持有者,新鲜的不红', () => {
    const g = gate('- [ ]（进行中@2020-01-01/tester）自测行\n')
    eq(g.violations.length, 1)
    eq(g.violations[0].kind, 'CL1')
    eq(g.violations[0].holder, 'tester')
    eq(g.violations[0].line, 1)
    eq(gate('- [ ]（进行中@2026-09-25/tester）x\n').violations.length, 0, '新鲜租约不该红')
  })
  // S3 缺持有者必红(正) / 持有者齐备必绿(反) —— CL2
  check('S3 CL2 有日期无持有者必红,补齐即绿', () => {
    const g = gate('- [ ]（进行中@2026-09-24）\n')
    eq(g.violations.length, 1)
    eq(g.violations[0].kind, 'CL2')
    eq(gate('- [ ]（进行中@2026-09-24/qa）\n').violations.length, 0)
  })
  // S4 三态矛盾必红(正) / 正常翻勾与存量裸标记矛盾只报数(反) —— CL3
  check('S4 CL3 租约标记+[x] 必红;裸标记矛盾行与正常翻勾不红', () => {
    eq(gate('- [x]（进行中@2026-09-25/qa）翻勾未摘牌\n').violations[0].kind, 'CL3')
    eq(gate('- [ ]（进行中@2026-09-25/qa）正文混进 [x] 的矛盾行\n').violations[0].kind, 'CL3')
    eq(gate('- [x] ✅(2026-09-25) 正常闭环\n').violations.length, 0)
    // 存量兼容:裸 `（进行中）` 与 [x] 并存只计数(真仓实测有 2 行这种历史形态,判红即恒红门)
    const g = gate('- [x] ✅(2026-09-25)（进行中）旧双态行\n')
    eq(g.violations.length, 0, '裸标记矛盾行不得判红')
    eq(g.summary.legacyContradictions, 1, '裸标记矛盾行必须如实报数')
  })
  // S5 全角括号可选性正反例(本仓记过的坑:`（进行中）?` 的 `?` 只管最后一个全角字符)
  check('S5 可选标记整组包住:`（进行中）?` 陷阱有牙证明', () => {
    const bare = '- [ ] 没有标记的任务'
    const lease = '- [ ]（进行中@2026-09-25/qa）带租约的任务'
    // 正例:可选形态对裸行与租约行都成立(剥完剩正文)
    eq(bare.replace(CLAIM_MARKER_OPTIONAL_RE, ''), '没有标记的任务', '可选形态漏掉裸行')
    eq(lease.replace(CLAIM_MARKER_OPTIONAL_RE, ''), '带租约的任务', '可选形态漏掉租约行')
    // 反例(陷阱实证):naive `（进行中）?` 判据在租约行上退化成"必须含字面前缀",
    // 只吃到 `（进行中` 就停,`@日期/持有者）` 残留 —— 若分类器/剥皮器这么写,text 与 bodyOf 全被污染。
    const naive = /^- \[ \]（进行中）?\s*/
    if (lease.replace(naive, '') === '带租约的任务')
      throw new Error('naive 形态竟然正确 ⇒ 本对照失去意义,夹具需重做')
    // 我们的真实判据不受其害:
    eq(lease.replace(CLAIM_MARKER_RE, ''), '带租约的任务')
    eq(bodyOf({ full: lease }), '带租约的任务', 'bodyOf 没剥净租约标记')
    eq(bodyOf({ full: '- [x]（进行中）foo' }), 'foo', 'bodyOf 对矛盾行也没剥净')
  })
  // S6/S7 不可辨形态与假日历日:只报数不判红(判据不猜)
  check('S6 不可辨标记/假日历日计 unknown 不红', () => {
    const g = gate('- [ ]（进行中@乱码）怪行\n- [ ]（进行中@2026-02-31/qa）假日历日\n')
    eq(g.violations.length, 0)
    eq(g.summary.unknown, 2)
  })
  check('S7 有持有者无日期:只报数(年龄不可判即不猜)', () => {
    const g = gate('- [ ]（进行中/qa）只有名字的半成品\n')
    eq(g.violations.length, 0)
    eq(g.summary.holderNoDate, 1)
  })
  // S8 阈值可调:同一枚 3 天前的租约,ttl=1 红 / ttl=720 绿
  check('S8 CL1 阈值生效(ttl 收紧即红、放宽即绿)', () => {
    const doc = '- [ ]（进行中@2026-09-22/qa）三天前认领\n'
    eq(gate(doc, 1).violations.length, 1, 'ttl=1h 应红')
    eq(gate(doc, 720).violations.length, 0, 'ttl=720h 应绿')
  })
  // S9 未来日期不算过期(年龄为负)
  check('S9 未来日期不红', () => {
    eq(gate('- [ ]（进行中@2030-01-01/qa）\n').violations.length, 0)
  })
  // S10 CLI 白名单:未知开关/缺值/位置参数一律判死
  check('S10 parseArgs 白名单不静默落默认分支', () => {
    eq(parseArgs(['--push']).ok, false, '未知开关竟被放过')
    eq(parseArgs(['--plan']).ok, false, '--plan 缺值竟被放过')
    eq(parseArgs(['--ttl-hours', '0']).ok, false)
    eq(parseArgs(['--staged', '--check-gate', '--plan', 'x.md']).ok, true)
    eq(resolveTtlHours(null, '24').ttlHours, 24)
    eq(resolveTtlHours(null, 'abc').ttlHours, DEFAULT_TTL_HOURS)
    eq(resolveTtlHours(null, 'abc').warn, true, '坏 env 必须带警告,不得静默回落')
  })
  // S11 三态向后兼容:旧输出字段一个不少
  check('S11 scanTasks 三态字段向后兼容', () => {
    const s = scanTasks(
      '- [ ] 甲\n- [ ]（进行中）乙\n- [x] ✅(2026-01-01) 丙\n- [ ]（进行中@2026-09-25/qa）丁\n',
    )
    eq(s.unclaimed.length, 1)
    eq(s.completed.length, 1)
    eq(s.inProgress.length, 2)
    eq(s.inProgress[0].format, 'legacy')
    eq(s.inProgress[1].format, 'lease')
    eq(s.inProgress[1].holder, 'qa')
    eq(s.inProgress[1].text, '丁', '租约标记没被剥进 text')
  })
  for (const r of results) console.log(r)
  console.log(`--self-test: ${results.length - failures}/${results.length} 通过`)
  return failures
}

function main(argv = process.argv.slice(2), nowMs = Date.now()) {
  const parsed = parseArgs(argv)
  if (!parsed.ok) {
    console.error(`❌ ${parsed.error}\n${USAGE}`)
    process.exit(2)
  }
  if (parsed.flags.has('--self-test')) {
    process.exitCode = selfTest(nowMs) === 0 ? 0 : 1
    return
  }
  const planPath = parsed.plan ? resolve(process.cwd(), parsed.plan) : PLAN_PATH
  let content
  try {
    content = readFileSync(planPath, 'utf-8')
  } catch (e) {
    console.error(
      `❌ 无法读取计划文档 ${planPath}: ${e.message}(输入取不到 = 无法判定,不冒红也不记绿)`,
    )
    process.exit(2)
  }
  const ttl = resolveTtlHours(parsed.ttlHours, process.env[TTL_ENV])
  if (ttl.warn) console.warn(`⚠ ${ttl.source}`)
  const { unclaimed, inProgress, completed } = scanTasks(content)
  const { counts: leaseCounts } = analyzeLeases(inProgress, { nowMs, ttlHours: ttl.ttlHours })

  if (parsed.flags.has('--check-gate')) {
    runCheckGate(parsed.flags, content, { nowMs, ttlHours: ttl.ttlHours, ttlSource: ttl.source })
    return
  }

  const twins = findClosedTwins([...unclaimed, ...inProgress], completed)
  const twinLines = new Set(twins.map((t) => t.line))
  const claimable = unclaimed.filter((t) => !twinLines.has(t.line))
  const dupGroups = findDuplicateGroups([...unclaimed, ...inProgress])
  const dupExtra = dupGroups.reduce((n, g) => n + g.length - 1, 0)

  if (parsed.flags.has('--twins')) {
    console.log(`已闭环 [x] 行的未勾孪生旧行 (${twins.length} 条) —— 接了就是白干:`)
    for (const t of twins) {
      console.log(
        `  L${t.line} ↔ 已勾 L${t.twinLine}  (${t.via}${t.via === 'jaccard' || t.via === 'both' ? ` ${t.score.toFixed(2)}` : ''}) ${t.text}`,
      )
    }
    console.log(
      `\n逐字重复的未勾行组 (${dupGroups.length} 组,多出 ${dupExtra} 条) —— 会把一件事数成多件:`,
    )
    for (const g of dupGroups) console.log(`  ${g.map((l) => `L${l}`).join(' = ')}`)
    return
  }

  if (parsed.flags.has('--json')) {
    console.log(
      JSON.stringify(
        {
          unclaimed,
          inProgress,
          completed,
          closedTwins: twins,
          duplicateGroups: dupGroups,
          totals: {
            unclaimed: unclaimed.length,
            inProgress: inProgress.length,
            completed: completed.length,
            closedTwins: twins.length,
            duplicateExtra: dupExtra,
            claimable: claimable.length,
          },
          leases: { ttlHours: ttl.ttlHours, ...leaseCounts },
        },
        null,
        2,
      ),
    )
    return
  }

  if (parsed.flags.has('--unclaimed')) {
    console.log(
      `无人认领任务 (${claimable.length};另有 ${unclaimed.length - claimable.length} 条是已闭环行的孪生旧行,见 --twins):`,
    )
    for (const t of claimable) console.log(`  L${t.line}: ${t.text}`)
    return
  }

  if (parsed.flags.has('--in-progress')) {
    console.log(`进行中任务 (${inProgress.length}):`)
    for (const t of inProgress) console.log(`  L${t.line}: ${t.text}${claimDisplaySuffix(t)}`)
    return
  }

  // 默认: 汇总
  console.log('='.repeat(60))
  console.log('  PROJECT_PLAN.md 任务认领状态')
  console.log('='.repeat(60))
  console.log()
  console.log(
    `  无人认领:  ${unclaimed.length}(其中 ${unclaimed.length - claimable.length} 条是已闭环 [x] 行的孪生旧行 ⇒ **可认领 ${claimable.length}**;逐字重复组 ${dupGroups.length})`,
  )
  console.log(
    `  进行中:    ${inProgress.length}(旧格式无租约 ${leaseCounts.legacy} / 形态不可辨 ${leaseCounts.unknown} / 有持有者无日期 ${leaseCounts.holderNoDate};租约到期判红见 --check-gate)`,
  )
  console.log(`  已完成:    ${completed.length}`)
  console.log(`  合计:      ${unclaimed.length + inProgress.length + completed.length}`)
  if (twins.length || dupGroups.length) {
    console.log('  ⚠️ 按行首分类会把"翻勾后留下的旧副本"当成一件活 —— 派单前先跑 --twins 看一眼,')
    console.log(
      '     否则已闭环的项会被重复认领(2026-09-25 实测:未认领 115 条里 22 条有已勾近亲)。',
    )
  }
  console.log()

  if (inProgress.length > 0) {
    console.log('─ 进行中 ─')
    for (const t of inProgress) console.log(`  L${t.line}: ${t.text}`)
    console.log()
  }

  if (unclaimed.length > 0 && unclaimed.length <= 30) {
    console.log('─ 无人认领 ─')
    for (const t of unclaimed) console.log(`  L${t.line}: ${t.text}`)
    console.log()
  } else if (unclaimed.length > 30) {
    console.log(`─ 无人认领 (${unclaimed.length} 项,前 15) ─`)
    for (const t of unclaimed.slice(0, 15)) console.log(`  L${t.line}: ${t.text}`)
    console.log(`  ... 还有 ${unclaimed.length - 15} 项`)
    console.log()
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
}

export const __test__ = {
  scanTasks,
  findClosedTwins,
  findDuplicateGroups,
  bodyOf,
  parseClaim,
  analyzeLeases,
  findContradictions,
  checkLeaseGate,
  parseArgs,
  resolveTtlHours,
  isValidIsoDate,
  selfTest,
  CLAIM_MARKER_RE,
  CLAIM_MARKER_OPTIONAL_RE,
  DEFAULT_TTL_HOURS,
  TTL_ENV,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
