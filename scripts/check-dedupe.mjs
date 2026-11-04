#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 依赖版本碎片化检查脚本(守门 7,blocking)
 *
 * 用途:检测 pnpm-lock.yaml 是否存在可去重的依赖版本(同一包的多个不必要版本)。
 *       防止依赖版本碎片化再次发生(项目曾因 @types/react 18/19 混存导致类型错误)。
 *
 * 判据来源一字未改:仍然是 `pnpm dedupe --check`(不自己另算"同名多版本",那会把
 * 本仓刻意并存的构建期双版本判成假阳)。本层只加**量纲**:
 *   - 报告里的每一项(形如 `- <pkg>@<version>`,即 pnpm 要摘掉的那一枚)按 `pkg+version`
 *     与存量台账比对;台账命中且未到期 ⇒ 点名放行(不静默);
 *   - 台账外的新碎片 ⇒ 红(这才是本门真正的牙);
 *   - 台账条目已到期 ⇒ 红(§0.7「豁免会到期」,到期回队列重裁);
 *   - 台账条目在**本次报告里一条没命中** ⇒ 清单腐烂红(§0.7「验过才免」:消掉了就删条目);
 *   - pnpm 跑不出结论(取不到二进制/输出形态不认识)⇒ exit 2 未判定,既不记绿也不冒红(§0.3)。
 *
 * 立项现场(2026-11-01):存量 `pbkdf2@3.1.6` 与 `which-typed-array@1.1.22` 在 HEAD 锁里
 * 早已并存,`pnpm dedupe` 自身 rc=0 也消不掉 ⇒ 绝对判红对**任何**改 package.json /
 * pnpm-lock.yaml 的提交都恒红,唯一结局是逼人 --no-verify 连带废掉全部守门(AGENTS §12e)。
 *
 * 触发场景:pre-commit(stagedTriggers 命中 pnpm-lock.yaml 与各包 package.json)、CI、手动。
 * 用法:pnpm check:dedupe | node scripts/check-dedupe.mjs --staged | --self-test
 * 两面旗同给(既 --staged 又 --worktree)⇒ exit 2 用法错(横向口径:取材面只能一个)。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { gitRaw } from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const LOCKFILE = resolve(ROOT, 'pnpm-lock.yaml')
const LEDGER = resolve(HERE, 'data', 'dedupe-stock.json')

/** 台账四件套 + 到期日(与门 192/194 同口径;命名避开 *-exemptions.json 的判据面 glob)。 */
const LEDGER_KEYS = ['pkg', 'version', 'reason', 'reviewBy']

/**
 * 从 `pnpm dedupe --check` 的输出里取"要摘掉的碎片"清单。
 * pnpm 11 的收尾形态是若干行 `- <name>@<version>`(其后跟 "Run pnpm dedupe to apply…")。
 * 认不出来 ⇒ 返回 null(调用方按未判定 exit 2,绝不把"没解析到"当成"没有碎片")。
 */
export function parseFragments(text) {
  const s = String(text ?? '')
  if (!/dedupe/i.test(s)) {
    // 2026-11-04 实测(pnpm 11.18.0):`dedupe --check` 干净收尾时**一个 "dedupe" 字样都不打**,
    // 只剩若干 `Progress: resolved …, reused …, downloaded …, added 0` 与末尾 `done`。
    // 认得这一形态且无 ERR_PNPM_ ⇒ 确认"本次无碎片";其余不认识形态仍返回 null(未判定)。
    if (/Progress: resolved \d+[\s\S]*\bdone\b/i.test(s) && !/ERR_PNPM_/i.test(s)) return []
    return null
  }
  const found = []
  for (const raw of s.split(/\r?\n/)) {
    const m = /^-\s+(@?[^@\s]+(?:\/[^@\s]+)?)@([0-9][^\s]*)$/.exec(raw.trim())
    if (m) found.push({ pkg: m[1], version: m[2], raw: raw.trim() })
  }
  // 报告头认得(含 dedupe 字样)却一条没解析到,与"完全没报告"是两件事:
  // 前者是"真没有碎片"(返回 []),后者才是判不出(返回 null)。
  if (found.length === 0) return /Run pnpm dedupe to apply/i.test(s) ? null : []
  return found
}

/** 台账形态判死:顶层 {entries:[…]},每条键齐备、reviewBy 是 YYYY-MM-DD。 */
export function validateLedger(parsed) {
  const errors = []
  if (!parsed || !Array.isArray(parsed.entries)) {
    return { entries: [], errors: [`台账顶层必须是 {entries:[…]}(实得 ${parsed ? typeof parsed : '无'})`] }
  }
  parsed.entries.forEach((e, i) => {
    const at = `entries[${i}]`
    if (!e || typeof e !== 'object') {
      errors.push(`${at}:不是对象`)
      return
    }
    for (const k of LEDGER_KEYS) {
      if (typeof e[k] !== 'string' || e[k].trim() === '') errors.push(`${at}:缺 ${k}(或为空)`)
    }
    if (typeof e.reviewBy === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(e.reviewBy.trim()))
      errors.push(`${at}:reviewBy 必须是 YYYY-MM-DD(实得 "${e.reviewBy}")`)
    if (typeof e.reason === 'string' && [...e.reason.trim()].length < 10)
      errors.push(`${at}:reason 过短(需 ≥10 码点的定向说明)`)
  })
  return { entries: parsed.entries.filter((e) => e && typeof e === 'object'), errors }
}

/**
 * 把"pnpm 是否正常跑完 + 解析结果"折成一个不骗人的输入给 decide()。
 * 关键一格:pnpm **非零退出**却解析不到任何碎片 ⇒ 不能读成"没有碎片"(=通过)。
 * 失效方向必须是"多要一次定向说明"(未判定),绝不能是"多放一次跳门"(AGENTS §0.10)。
 * 真实反例(2026-11-01 镜像测试抓到):scratch 里放一份无效 lockfile,pnpm 报错退出 1,
 * 输出里没有碎片行 ⇒ 只看解析结果会误判成绿。
 */
export function classifyRun({ ranOk, status, parsed }) {
  if (!ranOk) return null
  if (parsed === null) return null
  if (parsed.length === 0 && status !== 0) return null
  return parsed
}

/**
 * 判决(纯函数,取证夹具直接跑它,不在测试里复制第二份判据 —— §22c/门 191)。
 * @param fragments 本次报告解析出的碎片(null ⇒ 未判定)
 * @param entries   台账条目
 * @param today     'YYYY-MM-DD'
 * @param ranOk     pnpm 是否正常跑出可解析输出
 */
export function decide({ fragments, entries, today, ranOk }) {
  if (!ranOk || fragments === null)
    return { code: 2, lines: ['未判定:pnpm dedupe --check 的输出取不到或形态不认识 ⇒ 既不记绿也不冒红(§0.3)'] }
  const bad = []
  const passed = []
  const matched = new Set()
  fragments.forEach((f) => {
    const hit = entries.find((e) => e.pkg === f.pkg && e.version === f.version)
    if (!hit) {
      bad.push(`新碎片 ${f.pkg}@${f.version} —— 台账外,必须 pnpm dedupe 后随本枚提交锁文件,或按 §0.7 登记存量(带 reason + reviewBy)`)
      return
    }
    if (hit.reviewBy < today) {
      bad.push(`台账条目已到期 ${f.pkg}@${f.version}(reviewBy=${hit.reviewBy} < ${today})⇒ §0.7 到期回队列重裁`)
      return
    }
    matched.add(`${hit.pkg}@${hit.version}`)
    passed.push(`存量点名放行 ${f.pkg}@${f.version}(ticket=${hit.ticket ?? '-'},复核日 ${hit.reviewBy}):${hit.reason}`)
  })
  // 清单腐烂(§0.7「验过才免」的另一半):登记的碎片本次一条都没出现 ⇒ 已消掉,条目该删。
  const rotten = entries.filter((e) => !matched.has(`${e.pkg}@${e.version}`))
  rotten.forEach((e) => {
    if (e.reviewBy < today)
      bad.push(`台账腐烂且已到期 ${e.pkg}@${e.version}:本次报告没有这枚碎片(已消掉)而条目仍挂着 ⇒ 删条目`)
    else bad.push(`台账腐烂 ${e.pkg}@${e.version}:本次报告里没有这枚碎片 ⇒ 存量已消除,删掉该条(留着就是"看着有豁免其实空转")`)
  })
  const lines = []
  if (passed.length) lines.push(...passed)
  if (bad.length) lines.push(...bad.map((x) => `❌ ${x}`))
  if (!bad.length && fragments.length === 0) lines.push('✅ 无碎片化依赖版本。')
  return { code: bad.length ? 1 : 0, lines }
}

const SELF_TEST_FIXTURES = [
  {
    name: 'T1 台账齐备 + 无新碎片 ⇒ 0',
    in: { fragments: [{ pkg: 'pbkdf2', version: '3.1.6' }], entries: [{ pkg: 'pbkdf2', version: '3.1.6', reason: '上游闭包锁死', ticket: 'G-1', reviewBy: '2099-01-01' }], today: '2026-11-01', ranOk: true },
    want: 0,
  },
  {
    name: 'T2 反向牙:同样的碎片但台账为空 ⇒ 1(摘掉"差值/台账"这一维必翻红)',
    in: { fragments: [{ pkg: 'pbkdf2', version: '3.1.6' }], entries: [], today: '2026-11-01', ranOk: true },
    want: 1,
  },
  {
    name: 'T3 台账外的新碎片 ⇒ 1',
    in: { fragments: [{ pkg: 'pbkdf2', version: '3.1.6' }, { pkg: 'left-pad', version: '1.0.0' }], entries: [{ pkg: 'pbkdf2', version: '3.1.6', reason: '上游闭包锁死', ticket: 'G-1', reviewBy: '2099-01-01' }], today: '2026-11-01', ranOk: true },
    want: 1,
  },
  {
    name: 'T4 台账条目已到期 ⇒ 1',
    in: { fragments: [{ pkg: 'pbkdf2', version: '3.1.6' }], entries: [{ pkg: 'pbkdf2', version: '3.1.6', reason: '上游闭包锁死', ticket: 'G-1', reviewBy: '2026-01-01' }], today: '2026-11-01', ranOk: true },
    want: 1,
  },
  {
    name: 'T5 登记了而报告没命中(清单腐烂)⇒ 1',
    in: { fragments: [], entries: [{ pkg: 'pbkdf2', version: '3.1.6', reason: '上游闭包锁死', ticket: 'G-1', reviewBy: '2099-01-01' }], today: '2026-11-01', ranOk: true },
    want: 1,
  },
  {
    name: 'T6 输出取不到 ⇒ 2(未判定不折成绿也不折成红)',
    in: { fragments: null, entries: [], today: '2026-11-01', ranOk: true },
    want: 2,
  },
  {
    name: 'T7 pnpm 没跑成 ⇒ 2',
    in: { fragments: [], entries: [], today: '2026-11-01', ranOk: false },
    want: 2,
  },
  {
    name: 'T8 台账缺字段 ⇒ validateLedger 报错(形态错不静默)',
    inLedger: { entries: [{ pkg: 'x' }] },
    wantErrors: true,
  },
]

function selfTest() {
  let ok = 0
  const fail = []
  for (const t of SELF_TEST_FIXTURES) {
    try {
      if (t.inLedger) {
        const r = validateLedger(t.inLedger)
        if (r.errors.length > 0) ok++
        else fail.push(`${t.name}:期望报错但 errors=0`)
        continue
      }
      const r = decide(t.in)
      if (r.code === t.want) ok++
      else fail.push(`${t.name}:期望 exit ${t.want} 实得 ${r.code}`)
    } catch (e) {
      fail.push(`${t.name}:抛 ${e?.message ?? e}`)
    }
  }
  const p = parseFragments('foo@1.0.0\n└── bar 1 → 2\n\n- pbkdf2@3.1.6\n- which-typed-array@1.1.22\n\nRun pnpm dedupe to apply the changes above.')
  if (p && p.length === 2 && p[0].pkg === 'pbkdf2') ok++
  else fail.push(`T9 解析 pnpm 报告:实得 ${JSON.stringify(p)}`)
  const q = parseFragments('Progress: resolved 100\nnothing to dedupe\n')
  if (Array.isArray(q) && q.length === 0) ok++
  else fail.push(`T10 无碎片的报告应解析成 []:实得 ${JSON.stringify(q)}`)
  const r = parseFragments('Run pnpm dedupe to apply the changes above.')
  if (r === null) ok++
  else fail.push(`T11 说了"有变更要应用"却解析不到条目 ⇒ 必须未判定,实得 ${JSON.stringify(r)}`)
  const cleanReal = parseFragments([
    '✓ Lockfile passes supply-chain policies (verified 1m ago)',
    'Progress: resolved 4445, reused 4049, downloaded 0, added 0, done',
    '[WARN] Issues with peer dependencies found. Run "pnpm peers check" to list them.',
  ].join('\n'))
  if (Array.isArray(cleanReal) && cleanReal.length === 0) ok++
  else fail.push(`T12 pnpm 11 干净收尾(无 dedupe 字样)应解析成 []:实得 ${JSON.stringify(cleanReal)}`)
  console.log(`[check:dedupe --self-test] ${ok}/${SELF_TEST_FIXTURES.length + 4} 通过`)
  for (const f of fail) console.log(`  ❌ ${f}`)
  process.exit(fail.length ? 1 : 0)
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  if (argv.includes('--staged') && argv.includes('--worktree')) {
    console.error('[check:dedupe] ❌ 用法错:--staged 与 --worktree 两面旗同给 ⇒ 取材面只能一个(横向口径)')
    process.exit(2)
  }
  const isStaged = argv.includes('--staged')

  // pre-commit 模式:仅当 pnpm-lock.yaml 在暂存区时才检查
  if (isStaged) {
    let staged = ''
    try {
      // 2026-10-26 G-54:git 派生收口到 face-reader(绝对路径二进制 + safe.directory + stdio/windowsHide 统一)。
      staged = gitRaw(['diff', '--cached', '--name-only'], ROOT)
    } catch {
      // 非 git 环境或无暂存文件,跳过
      return process.exit(0)
    }
    if (!staged.split('\n').some((f) => f.trim() === 'pnpm-lock.yaml')) {
      console.log('[check:dedupe] pnpm-lock.yaml 未变更,跳过碎片化检查。')
      return process.exit(0)
    }
  }

  if (!existsSync(LOCKFILE)) {
    console.log('[check:dedupe] 未找到 pnpm-lock.yaml,跳过检查。')
    return process.exit(0)
  }

  let entries = []
  if (existsSync(LEDGER)) {
    let parsed
    try {
      parsed = JSON.parse(readFileSync(LEDGER, 'utf8'))
    } catch (e) {
      console.error(`[check:dedupe] ❌ 台账读不到或不是合法 JSON:${LEDGER}(${e?.message ?? e})⇒ 未判定,不把"没台账"折成"没有存量"再把全部碎片判红`)
      return process.exit(2)
    }
    const v = validateLedger(parsed)
    if (v.errors.length) {
      for (const x of v.errors) console.error(`[check:dedupe] ❌ 台账形态错:${x}`)
      return process.exit(2)
    }
    entries = v.entries.map((e) => ({ ...e, pkg: e.pkg.trim(), version: e.version.trim(), reviewBy: e.reviewBy.trim() }))
  }

  console.log('[check:dedupe] 检查依赖版本碎片化(pnpm dedupe --check;存量按台账点名放行)…')

  // 2026-11-01:从 stdio:'inherit' 改成显式 pipe —— 本门要解析报告(判"新增 vs 存量")。
  // 两流分别收集并各自原样转发(先拼再截会把真原因挤到窗口外,留下的反而误导)。
  const result = spawnSync('pnpm dedupe --check', {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    windowsHide: true, // 防 Windows 弹可见 cmd 窗口
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })

  const ranOk = !result.error && typeof result.status === 'number' && result.status !== 2
  const out = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  const fragments = classifyRun({ ranOk, status: result.status, parsed: parseFragments(out) })
  const today = new Date().toISOString().slice(0, 10)
  const verdict = decide({ fragments, entries, today, ranOk })

  for (const l of verdict.lines) console.log(`[check:dedupe] ${l}`)
  if (verdict.code === 2) {
    console.error('[check:dedupe] ⚠️ 未判定(不是通过)。pnpm 输出如下:')
    process.stdout.write(out)
    return process.exit(2)
  }
  if (verdict.code === 1) {
    console.error('[check:dedupe] ❌ 失败:存在台账外的新增碎片 / 豁免到期 / 台账腐烂。pnpm 原报告如下:')
    process.stdout.write(out)
    console.error('[check:dedupe] 出路:`pnpm dedupe` 后随本枚一起提交 pnpm-lock.yaml;确实消不掉的存量才登记台账(带 reason + reviewBy,会到期)。')
    return process.exit(1)
  }
  console.log('[check:dedupe] ✅ 通过:无新增碎片化(存量已逐条点名且未到期)。')
  return process.exit(0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = { parseFragments, validateLedger, decide, classifyRun, SELF_TEST_FIXTURES, LEDGER_KEYS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
