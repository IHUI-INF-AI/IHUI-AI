// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 63(check-sse-parser-parity.mjs)的 §22c 镜像测试。
//
// 立因(实测,非推测):`tool-delta` 帧在 2026-09-27 被两枚并行提交前后脚写进 HEAD ——
//   679932a663 先把它登记成「仅 web 消费」(那时属实),
//   3f3e71a990 随后把共享解析层的守卫 + 小程序端的 dispatch 与渲染位全接上了,
//   但**没有删那条登记、也没有上调基线** ⇒ 台账从此替一个已不存在的缺口背书。
// 这正是该门 stale 臂要防的形态(它报的是「登记了却其实已接」),而它当时是**零测试**的:
// 三条臂(stale / unaccounted / ratchet)一条都没被端到端证明过会翻红。
// 「一条门只管自己立项那一型」在本仓记过多次,而本门连自己立项那一型都没被证明有牙。
//
// 因此本文件的判据对象全部落在**能被机器复现的三件事**上:
//   ① 构造面端到端成对:每一条臂都要有「坏⇒必红」与「好⇒必绿」两臂 —— 只留前者就等于
//      给「门瞎了」背书(§22c 最后一条)。**不重抄判据实现**:把门脚本本体拷进临时仓跑。
//   ② 真实字节:tool-delta 的守卫行**逐字取自 HEAD 的 sse-parse.ts**,并做一条变异对照
//      (删掉守卫行、只留类型联合与产出语句 ⇒ 必须不再算覆盖),证明门不是被注释/声明喂绿的。
//   ③ 装车证明:runner 里确有这道门(blocking + skipEnv + **台账文件在 stagedTriggers 里**)
//      —— 台账不在触发面上,这次修复就永远进不了提交链(守门 81「判据存在而永不调用=没有」同型)。
//
// 已知边界(如实登记,不假装覆盖):
//   · 本门按**判定面**取四份输入(默认 HEAD blob / `--staged` 索引 blob / `--worktree` 仅人工),
//     2026-09-27 G-303 收口前它按磁盘取且**不认** runner 追加的 `--staged`。三面各答各的、
//     "该面取不到 ⇒ exit 2 且不回落"、"两面旗同给判死"、"坏台账算没有输入"由下面 F1–F8
//     (远端侧 530d6e4ba3)端到端证明;F9–F11 是本地侧 dceba62c69 的独有臂并入:
//     F9 补**面→cat-file 规格**那一层纯函数(含"未知面必须抛"与"这一跳真被 readFaceInputs 调用"
//     的装车锁),F10 让三条判据臂各自在不同面上红,F11 把"取不到"造在**只有索引缺台账**这一格
//     (HEAD 与磁盘都还在 —— 那才是回落最容易偷偷发生的位置,F3 的 commit:false 证不出"不回落")。
//     夹具因此必须是**真 git 仓并连提交**:只写盘不 commit 时每条夹具用例会红在"HEAD 取不到",
//     那是夹具失效不是门坏了。
//   · 本门只看**两个** TS 解析器(api-client / sse-parse)。Python 侧契约与 SSE 派发另有
//     check-sse-dispatch-parity / check-agent-event-parity 两道同族门,不在本文件射程。

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { __test__ as gate } from '../check-sse-parser-parity.mjs'
import { Undetermined } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPTS_DIR = join(REPO, 'scripts')
const GATE_REL = 'check-sse-parser-parity.mjs'
const GATE_SCRIPT = join(SCRIPTS_DIR, GATE_REL)
const GIT_BIN = resolveGitBin() || 'git'

const P_CONTRACT = 'packages/shared/src/sse/contract.ts'
const P_CLIENT = 'packages/api-client/src/client.ts'
const P_PARSE = 'packages/shared/src/utils/sse-parse.ts'
const P_LEDGER = 'scripts/data/sse-parser-coverage.json'

/** 读被审面上的 blob —— 装车型断言一律判 HEAD,不判滞后的共享工作树 */
function showHead(path) {
  return execFileSync(GIT_BIN, ['-c', 'safe.directory=*', '-C', REPO, 'show', `HEAD:${path}`], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120_000,
    windowsHide: true,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

// ───────────────────────── ① 构造面:把门本体拷进临时仓跑 ─────────────────────────

const EVENTS = ['alpha_frame', 'beta_frame', 'gamma_frame']
const GOOD_WHY = '端上没有承载该帧的 UI,只解析会让用户看到却无法操作,比不显示更糟。'

/** 契约面:门只认 `export const SSE_EVENTS` 块里的字符串值 */
function contractSource(events) {
  const body = events.map((e, i) => `  K${i}: '${e}',`).join('\n')
  return `export const SSE_EVENTS = {\n${body}\n}\n`
}

/** 解析面:给一组帧名,产出一份「每条都有 case 守卫」的伪解析器 */
function parserSource(events) {
  const cases = events.map((e) => `    case '${e}':\n      return handle('${e}')`).join('\n')
  return `export function parseSse(t) {\n  switch (t) {\n${cases}\n    default:\n      return null\n  }\n}\n`
}

/** 临时仓里的 git:绝对路径 + safe.directory + windowsHide(与本仓所有 git 调用同形)。 */
function gitAt(dir, args) {
  return execFileSync(GIT_BIN, ['-c', 'safe.directory=*', '-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}

/**
 * 在临时目录里造一棵**真的 git 仓**、「看起来像本仓」的最小树,并把**真实的那份门脚本**
 * (连同它的相对 import 闭包)拷进去。
 *
 * 两件必须同时成立的事:
 *   ① 门把 ROOT 由自身位置推导(scripts/check-*.mjs ⇒ 上一级),所以拷一份就等于换了被审面;
 *      判据仍是同一份实现 —— 本文件不重写任何一条臂(§22c「两份真相必漂移」)。
 *   ② 收口后默认档判 **HEAD blob**,所以夹具**必须**是 git 仓并把四份输入提交进去 ——
 *      否则跑出来的是 exit 2「无法判定」,而"夹具跑不通"绝不等于"判据通过"
 *      (scratch-module-closure 头注记过同型:夹具失效会被读成判据绿)。
 * 闭包清单由 scratch-module-closure **推导**,不手抄。
 *
 * @param commit 是否 add + commit(默认 true;false ⇒ 文件只在工作树,HEAD 面取不到)
 * @param ledger 对象会被 stringify;给字符串则原样写入(用来造"台账不是合法 JSON"那一格)
 */
function buildFixture({ contract, client, parse, ledger, commit = true }) {
  const dir = mkScratch('sse-parser-parity-')
  gitAt(dir, ['init', '-q'])
  gitAt(dir, ['config', 'user.email', 'gate@fixture.local'])
  gitAt(dir, ['config', 'user.name', 'gate-fixture'])
  gitAt(dir, ['config', 'commit.gpgsign', 'false'])
  // 夹具里三面互异是判据本体:autocrlf 会把"索引 blob vs 工作树 blob"的差异糊成换行符差异。
  gitAt(dir, ['config', 'core.autocrlf', 'false'])
  copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir, 'scripts'), [
    'lib/face-reader.mjs',
    'lib/gitdir.mjs',
  ])
  put(dir, P_CONTRACT, contract)
  put(dir, P_CLIENT, client)
  put(dir, P_PARSE, parse)
  put(dir, P_LEDGER, typeof ledger === 'string' ? ledger : `${JSON.stringify(ledger, null, 2)}\n`)
  if (commit) {
    gitAt(dir, ['add', '-A'])
    gitAt(dir, ['commit', '-q', '-m', 'fixture'])
  }
  return { dir, script: join(dir, 'scripts', GATE_REL) }
}

/**
 * 从 stdout 里取**开头那个 JSON 对象**(按大括号配对，其后的内容整段丢掉)。
 *
 * 为什么不能直接 JSON.parse(stdout):实测本门在**判据为绿**时把人类可读的 ✅ 结论行也打到
 * 了 stdout(`--json` 不是独占档)，于是"通过"那一侧反而不可 parse —— 这一条是写 ①-B 时抓到的。
 * 那是该门自身的缺陷，但**不属于判据失明**，本票不改这道 blocking 门的输出形状(缺陷与其一行修法
 * 写进交付报告，交主协调者裁决);这里只做兼容读取，不把畸形输出固化成规格。
 */
function leadingJson(text) {
  const start = String(text).indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inStr = null
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]
    if (inStr) {
      if (ch === '\\') i += 1
      else if (ch === inStr) inStr = null
      continue
    }
    if (ch === '"') inStr = ch
    else if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

/**
 * 跑那一门:返回 { code, json, out, err };紧急跳过旗标强制清空,否则测试会对着跳过通道假绿。
 * `cwd` 显式钉在夹具上(合并自 dceba62c69):门把 ROOT 由自身位置推导,理论上与 cwd 无关,
 * 但不钉住的话,一旦哪天有人改成按调用方站位定根,夹具就会悄悄去读真仓 —— 那正是守门 70 的型。
 */
function runFixture({ dir, script }, args = ['--json']) {
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
    env: { ...process.env, HUSKY_SKIP_SSE_PARSER_PARITY: '' },
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const json = leadingJson(r.stdout)
  assert.ok(
    json,
    `门在夹具上没有产出可读 JSON 结论 ⇒ 这条测试本身失效了:\n${r.stdout}\n${r.stderr}`,
  )
  return { code: r.status, json, out: r.stdout, err: r.stderr ?? '' }
}

const eventsOf = (violations) => violations.map((v) => v.event).join(',')

test('①-A stale 臂有牙:sse-parse 已解析却仍挂在 webOnly ⇒ 必红并点名该帧', () => {
  const f = buildFixture({
    contract: contractSource(EVENTS),
    client: parserSource(EVENTS),
    parse: parserSource(EVENTS), // 三帧全接了
    ledger: { parseCoverageBaseline: 3, webOnly: [{ event: 'gamma_frame', why: GOOD_WHY }] },
  })
  const r = runFixture(f)
  rmScratch(f.dir)
  assert.equal(r.code, 1, `应判红,实际:\n${r.out}${r.err}`)
  assert.ok(r.json, 'JSON 档必须可 parse,否则报告在骗人')
  assert.ok(
    eventsOf(r.json.violations).includes('gamma_frame'),
    `红须点名 gamma_frame,实际:${JSON.stringify(r.json.violations)}`,
  )
  assert.ok(
    r.json.violations.some((v) => v.reason.includes('其实已被 sse-parse 解析')),
    '必须给出「该删登记」的出口,而不是只说错',
  )
})

test('①-B 成对反臂:同一份已接上的解析器 + 已删登记 ⇒ 必绿(证明 A 不是恒红)', () => {
  const f = buildFixture({
    contract: contractSource(EVENTS),
    client: parserSource(EVENTS),
    parse: parserSource(EVENTS),
    ledger: { parseCoverageBaseline: 3, webOnly: [] },
  })
  const r = runFixture(f)
  rmScratch(f.dir)
  assert.equal(r.code, 0, `删掉登记后就该绿,实际:\n${r.err}`)
  assert.equal(r.json.violations.length, 0)
})

test('①-C unaccounted 臂有牙:api-client 已解析、sse-parse 漏接、且没交代归属 ⇒ 必红', () => {
  const f = buildFixture({
    contract: contractSource(EVENTS),
    client: parserSource(EVENTS),
    parse: parserSource(['alpha_frame', 'beta_frame']), // 漏接 gamma
    ledger: { parseCoverageBaseline: 2, webOnly: [] },
  })
  const r = runFixture(f)
  rmScratch(f.dir)
  assert.equal(r.code, 1, `漏接未交代应判红,实际:\n${r.out}${r.err}`)
  assert.ok(eventsOf(r.json.violations).includes('gamma_frame'))
  assert.ok(r.json.violations.some((v) => v.reason.includes('未在 webOnly 登记')))
})

test('①-D 成对反臂:同样漏接但按规矩登记 + 写清理由 ⇒ 必绿(否则本门是恒红门)', () => {
  const f = buildFixture({
    contract: contractSource(EVENTS),
    client: parserSource(EVENTS),
    parse: parserSource(['alpha_frame', 'beta_frame']),
    ledger: { parseCoverageBaseline: 2, webOnly: [{ event: 'gamma_frame', why: GOOD_WHY }] },
  })
  const r = runFixture(f)
  rmScratch(f.dir)
  assert.equal(r.code, 0, `如实交代就该放行,实际:\n${r.err}`)
  assert.deepEqual(r.json.violations, [], '登记齐备且理由充分时不得产出任何违规')
})

test('①-E ratchet 臂:覆盖数低于基线(有帧的解析被删)⇒ 必红', () => {
  const f = buildFixture({
    contract: contractSource(EVENTS),
    client: parserSource(EVENTS),
    parse: parserSource(['alpha_frame', 'beta_frame']),
    ledger: { parseCoverageBaseline: 9, webOnly: [{ event: 'gamma_frame', why: GOOD_WHY }] },
  })
  const r = runFixture(f)
  rmScratch(f.dir)
  assert.equal(r.code, 1)
  assert.ok(
    r.json.violations.some((v) => v.event === '(parse-coverage)' && v.reason.includes('基线')),
    `应报倒退,实际:${JSON.stringify(r.json.violations)}`,
  )
})

test('①-F 登记必须带理由:why 空/过短 ⇒ 必红(空理由等于没交代)', () => {
  const f = buildFixture({
    contract: contractSource(EVENTS),
    client: parserSource(EVENTS),
    parse: parserSource(['alpha_frame', 'beta_frame']),
    ledger: { parseCoverageBaseline: 2, webOnly: [{ event: 'gamma_frame', why: '略' }] },
  })
  const r = runFixture(f)
  rmScratch(f.dir)
  assert.equal(r.code, 1)
  assert.ok(r.json.violations.some((v) => v.reason.includes('为什么只有 web 消费')))
})

test('①-G 契约抽不到 = 判据失效,不许当"全绿"(本仓铁律:取不到≠通过)', () => {
  const f = buildFixture({
    contract: '// 这份契约文件里根本没有 SSE_EVENTS\nexport const NOTHING = 1\n',
    client: parserSource(EVENTS),
    parse: parserSource(EVENTS),
    ledger: { parseCoverageBaseline: 0, webOnly: [] },
  })
  const r = runFixture(f)
  rmScratch(f.dir)
  assert.equal(r.code, 1, '契约名一条都抽不到时必须判死,不能静默绿')
  assert.ok(r.json.violations.some((v) => v.reason.includes('判据失效')))
})

// ───────────────────────── ② 真实字节 + 变异对照 ─────────────────────────

test('② 真仓 HEAD 现读为绿,且"绿"不是一句空话(非空枚举)', () => {
  const res = gate.runChecks()
  // 反"扫到 0 就算过":抽不到内容时 violations 会有一条判据失效红,但枚举位也必须非空,
  // 否则说明三份输入里有一面已经看不见 ⇒ 本臂的 0 违规不代表"核对过了"。
  assert.ok(res.contractEvents.length >= 30, `契约帧数异常偏少:${res.contractEvents.length}`)
  assert.ok(res.clientHandled.length > 0, 'api-client 侧一条都没抽到 ⇒ 判据对该面失明')
  assert.ok(res.parseHandled.length > 0, 'sse-parse 侧一条都没抽到 ⇒ 判据对该面失明')
  assert.equal(
    res.violations.length,
    0,
    `真仓当前必须无违规,实际:${JSON.stringify(res.violations)}`,
  )
})

test('② tool-delta 的守卫行逐字取自 HEAD 的 sse-parse.ts ⇒ 门真的认它', () => {
  const headParse = showHead(P_PARSE)
  const evs = gate.extractContractEvents(showHead(P_CONTRACT))
  assert.ok(evs.includes('tool-delta'), '契约里必须仍有 tool-delta(该帧没被摘走)')
  assert.ok(
    gate.extractHandledEvents(headParse, evs).includes('tool-delta'),
    'HEAD 的 sse-parse 必须仍被认成已解析 tool-delta —— 台账那条登记就是因此过期的',
  )
})

test('② 变异对照:抹掉那一行守卫 ⇒ 不得再算已接(门不是被类型声明/产出语句喂绿的)', () => {
  const headParse = showHead(P_PARSE)
  const evs = gate.extractContractEvents(showHead(P_CONTRACT))
  const GUARD = "if (json?.type === 'tool-delta') {"
  const hits = headParse.split(GUARD).length - 1
  // 命中数必须恰好为 1:多于一处时"抹掉守卫"这件事本身就说不清,测试也就没有牙了。
  assert.equal(hits, 1, `守卫行在 HEAD 的 sse-parse.ts 里出现 ${hits} 次,期望 1 次`)
  const mutated = headParse.replace(GUARD, "if (json?.type === 'tool-delta_removed_marker') {")
  assert.ok(
    !gate.extractHandledEvents(mutated, evs).includes('tool-delta'),
    '删掉守卫后仍算"已解析" ⇒ 该判据形同虚设(只剩产出语句/类型联合不该计分)',
  )
})

test('② 台账不得再挂一条"其实已接"的登记(本票回归本体)', () => {
  const res = gate.runChecks()
  // 台账与两份解析器**同面**取(判 HEAD 就三处都判 HEAD)—— 混面读会产出与真实提交相反的结论,
  // 而账面自洽:这正是 G-303 收口这一型在测试侧的同款错误。
  const declared = new Set((JSON.parse(showHead(P_LEDGER)).webOnly ?? []).map((x) => x.event))
  const stillParsed = [...declared].filter((e) => res.parseHandled.includes(e))
  assert.deepEqual(stillParsed, [], `这些帧已被 sse-parse 解析却仍挂着 webOnly 登记:${stillParsed}`)
  // 另一半:每一个"只在一侧解析"的帧都必须有登记 —— 缺一即小程序静默丢帧。
  const unaccounted = res.clientHandled.filter(
    (e) => !res.parseHandled.includes(e) && !declared.has(e),
  )
  assert.deepEqual(
    unaccounted,
    [],
    `api-client 已解析、sse-parse 未解析且未交代归属:${unaccounted}`,
  )
})

// ───────────────────────── ③ 装车证明(判 HEAD 面) ─────────────────────────

/** 按大括号配对取出本门那一条注册项(取"名字前后各 N 字符"会跨进邻门 ⇒ 别人的 blocking 算到我头上) */
function extractRunnerEntry(runnerSrc, scriptName) {
  const anchor = runnerSrc.indexOf(`script: '${scriptName}'`)
  if (anchor === -1) return null
  const start = runnerSrc.lastIndexOf('\n  {', anchor)
  if (start === -1) return null
  let depth = 0
  for (let i = start + 1; i < runnerSrc.length; i += 1) {
    const ch = runnerSrc[i]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return runnerSrc.slice(start, i + 1)
    }
  }
  return null
}

test('③ 装车证明:runner(HEAD)里确有本门,且**台账文件在 stagedTriggers 里**', () => {
  const runner = showHead('scripts/guardian-runner.mjs')
  const entry = extractRunnerEntry(runner, 'check-sse-parser-parity.mjs')
  assert.ok(entry, '门在 HEAD 的 guardian-runner 里找不到注册块 ⇒ 判据存在而无人调度')
  assert.match(entry, /mode:\s*'blocking'/, '本门必须是 blocking,否则判对了也拦不住提交')
  assert.match(entry, /skipEnv:\s*'HUSKY_SKIP_SSE_PARSER_PARITY'/, '声明的应急通道必须真在条目里')
  assert.ok(
    entry.includes(P_LEDGER),
    `台账不在 stagedTriggers 里 ⇒ 改台账不会唤起本门,这次修复永远进不了提交链`,
  )
  for (const p of [P_CONTRACT, P_CLIENT, P_PARSE]) {
    assert.ok(entry.includes(p), `输入面 ${p} 必须也在 stagedTriggers 里`)
  }
})

// ══════════════════ F ─ 取材面(G-303 收口)══════════════════
//
// 这一组证明的**不是**"比什么"(那由 ① 的三条臂管),而是"在哪一份内容上比"。
// 三面互异必须在**临时 git 仓**里造 —— 真仓的 HEAD/索引/磁盘三者此刻恰好相同,
// 拿它当夹具等于什么都没判(§22c:镜像测试只复读实现就是复读机)。
// 每一条都配成对:只留"坏那一支"的话,"门瞎了"与"门判红"在账面上长得一模一样。

const LEDGER_OK = { parseCoverageBaseline: 3, webOnly: [] }
const LEDGER_STALE = {
  parseCoverageBaseline: 3,
  webOnly: [{ event: 'gamma_frame', why: GOOD_WHY }],
}
const SRC_OK = () => ({
  contract: contractSource(EVENTS),
  client: parserSource(EVENTS),
  parse: parserSource(EVENTS),
})

/** 与 runFixture 的分工:这一个**不要求**有 JSON —— exit 2「无法判定」那一支本来就不产结论。 */
function runRaw(f, args = ['--json']) {
  const r = spawnSync(process.execPath, [f.script, ...args], {
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
    cwd: f.dir,
    env: { ...process.env, HUSKY_SKIP_SSE_PARSER_PARITY: '' },
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}`, json: leadingJson(r.stdout) }
}

test('F1 HEAD 绿 / 索引脏红 / 磁盘脏红:三面各读各的,且 --staged 读的是索引不是磁盘', () => {
  const f = buildFixture({ ...SRC_OK(), ledger: LEDGER_OK })
  try {
    // 只把"过期登记"改到盘上并暂存 ⇒ HEAD 仍是好的
    put(f.dir, P_LEDGER, `${JSON.stringify(LEDGER_STALE, null, 2)}\n`)
    gitAt(f.dir, ['add', '--', P_LEDGER])

    const head = runRaw(f)
    assert.equal(head.code, 0, `默认档判 HEAD,盘上未提交的脏不得进账:${head.out}`)
    assert.equal(
      head.json && head.json.face,
      'head',
      '默认档必须是 head —— 结论里要能看出判的哪一面',
    )
    const staged = runRaw(f, ['--json', '--staged'])
    assert.equal(staged.code, 1, `索引已带上脏 ⇒ --staged 必红:${staged.out}`)
    assert.equal(staged.json && staged.json.face, 'staged')
    assert.equal(runRaw(f, ['--json', '--worktree']).code, 1, '--worktree 必须看得见同一条脏')

    // 反假绿的要害:摘掉暂存(索引回到 HEAD 那份),盘上仍是脏的。
    // 若 --staged 偷偷看了磁盘,这一支就会跟着红 —— 那正是"回落"的另一种写法。
    gitAt(f.dir, ['reset', '-q', '--', P_LEDGER])
    const staged2 = runRaw(f, ['--json', '--staged'])
    assert.equal(staged2.code, 0, `索引已干净 ⇒ --staged 必绿(红了就是它在偷看磁盘):${staged2.out}`)
    assert.equal(
      runRaw(f, ['--json', '--worktree']).code,
      1,
      '同一时刻磁盘仍脏 ⇒ 三面必须各答各的,不是同一个答案读三遍',
    )
  } finally {
    rmScratch(f.dir)
  }
})

test('F2 方向反过来:HEAD 脏而索引已修好 ⇒ 默认档仍红、--staged 绿(盘上改对不算修好)', () => {
  const f = buildFixture({ ...SRC_OK(), ledger: LEDGER_STALE }) // HEAD 里就是过期登记
  try {
    put(f.dir, P_LEDGER, `${JSON.stringify(LEDGER_OK, null, 2)}\n`)
    gitAt(f.dir, ['add', '--', P_LEDGER])
    const head = runRaw(f)
    assert.equal(head.code, 1, `HEAD 仍挂着过期登记 ⇒ 全量档必红:${head.out}`)
    assert.equal(runRaw(f, ['--json', '--staged']).code, 0, '本次提交会带走的是修好的那一份')
  } finally {
    rmScratch(f.dir)
  }
})

test('F3 该面取不到 ⇒ exit 2「无法判定」,绝不回落到另一个面(回落=把没判写成判过了)', () => {
  // commit:false ⇒ 四份输入只在工作树上,HEAD 面一份都读不到;而磁盘面判据是绿的。
  const f = buildFixture({ ...SRC_OK(), ledger: LEDGER_OK, commit: false })
  try {
    assert.equal(
      runRaw(f, ['--json', '--worktree']).code,
      0,
      '前提自检:磁盘面此刻内容合法。它不绿就说明夹具本身没造对,后面的 2 也就没有意义',
    )
    const und = runRaw(f)
    assert.equal(
      und.code,
      2,
      `HEAD 面取不到却回了 ${und.code} ⇒ 要么记绿要么冒红,两者都错:${und.out}`,
    )
    assert.match(und.out, /无法判定/, '必须喊"无法判定",不能只留一个非零码')
    assert.match(und.out, /scripts\/data\/sse-parser-coverage\.json/, '要点名取不到的是哪一份输入')
    assert.ok(!/✅/.test(und.out), '取不到那一面绝不许输出通过结论')
    assert.equal(
      runRaw(f, ['--json', '--staged']).code,
      2,
      '索引面同样没有内容 ⇒ 也不许借 HEAD 或磁盘凑一份自洽的尺子',
    )
  } finally {
    rmScratch(f.dir)
  }
})

test('F4 两面旗同给 ⇒ exit 2 判死(取任一都会让另一面成为假绿)', () => {
  const f = buildFixture({ ...SRC_OK(), ledger: LEDGER_OK })
  try {
    const both = runRaw(f, ['--json', '--staged', '--worktree'])
    assert.equal(both.code, 2, both.out)
    assert.match(both.out, /不得同用/)
  } finally {
    rmScratch(f.dir)
  }
})

test('F5 台账不是合法 JSON ⇒ exit 2,不得被读成"没有违规"(旧写法是崩一个栈,账面同样是噪音)', () => {
  const f = buildFixture({
    ...SRC_OK(),
    ledger: '{ "parseCoverageBaseline": 3, "webOnly": [',
    commit: true,
  })
  try {
    const und = runRaw(f)
    assert.equal(und.code, 2, `坏台账判成了 ${und.code}:${und.out}`)
    assert.match(und.out, /不是合法 JSON|无法判定/)
    assert.equal(runRaw(f, ['--json', '--worktree']).code, 2, '坏 JSON 在哪个面都是"没有输入"')
  } finally {
    rmScratch(f.dir)
  }
})

test('F6 判定面四态是纯函数(缺省 head / --staged / --worktree / 两旗判死),不靠人读结论文字', () => {
  assert.equal(gate.faceFromArgv([]).face, 'head', '默认档回到磁盘 = 本门又在判滞后工作树')
  assert.equal(gate.faceFromArgv(['--staged']).face, 'staged')
  assert.equal(gate.faceFromArgv(['--worktree']).face, 'worktree')
  const both = gate.faceFromArgv(['--staged', '--worktree'])
  assert.equal(both.face, null)
  assert.match(String(both.error), /互斥/)
  assert.ok(
    gate.FACE_TXT.head && gate.FACE_TXT.staged && gate.FACE_TXT.worktree,
    '三面文案都得在位',
  )
})

test('F7 输入清单本身就是判据的枚举面:少一份 = 判据对那一格失明,不得静默', () => {
  const rels = Object.values(gate.INPUT_RELS)
  assert.deepEqual(
    [...rels].sort(),
    [P_CONTRACT, P_CLIENT, P_PARSE, P_LEDGER].sort(),
    '四份输入必须与门读的那四份逐字同集(台账不在里面 ⇒ 判据在自洽的错位上跑)',
  )
  // 阳性对照:真仓 HEAD 面四份都要读得到,且内容非空(读不到就是 exit 2,不是"通过")
  const inputs = gate.readFaceInputs(REPO, 'head')
  for (const rel of rels) {
    assert.ok(
      typeof inputs[rel] === 'string' && inputs[rel].length > 0,
      `HEAD 面 ${rel} 取到空内容`,
    )
  }
})

test('F8 形状锁:取材必须走共用层的 catBatch,散写回潮由机器发现', () => {
  const src = readFileSync(GATE_SCRIPT, 'utf8')
  assert.match(
    src,
    /from '\.\/lib\/face-reader\.mjs'/,
    '取材必须经共用层(否则绝对路径/stdio/maxBuffer 那四条坑会各写一遍)',
  )
  assert.match(
    src,
    /catBatch\(/,
    '内容必须由一次批量读满得到 —— 未预取即读要抛,而不是偷偷补一次派生',
  )
  assert.match(src, /selectFace\(/, '面旗标语义不得自己再抄一份(两面旗同给判死是层的行为)')
  // 反向锁:收口前的三种散写形态,一种都不许回来
  assert.doesNotMatch(src, /readFileSync\s*\(/, '又按磁盘取被审内容了')
  assert.doesNotMatch(src, /existsSync\s*\(/, '用磁盘存在性代替被审面取材 = 换一个面判绿')
  assert.doesNotMatch(
    src,
    /\bshow\b/,
    '自派生 git 取正文(裸 git show)= 绕过共用层的绝对路径与缓冲区护栏',
  )
  assert.doesNotMatch(src, /process\.cwd\(\)/, '定根不得依赖调用者站在哪(§15 路径纪律)')
  assert.doesNotMatch(
    src,
    /return\s+null\s*\)\s*.*gitShow/,
    '取不到就回落另一个面 = 把"没判"写成"判过了"',
  )
  // ↓ 两条形状锁合并自 dceba62c69 那侧的 F3(本侧独有、与上面几条不重叠):
  assert.doesNotMatch(src, /from 'node:fs'/, '门体不再需要 node:fs —— 出现即磁盘直读回来了')
  assert.doesNotMatch(
    src,
    /['"]show['"]/,
    '不得自派生 git 取内容:引了共用层却自己读一份(半接线)正是守门 118 收紧的对象',
  )
})

// ───────────── F9–F11:合并自本地侧 dceba62c69 的独有臂(原 F1 / F2 / F2b)─────────────
// 与 F1–F8 不重叠的三件事:F9 证明**面→cat-file 规格**这一跳存在且未知面不猜面,并且它真被
// readFaceInputs 调用(函数在而无人调 = 没有,守门 70/76/81 同型);F10 让**三条判据臂**各自
// 在不同面上红(ratchet 在索引、归属理由在磁盘),证明"换面"换的是内容而不只是结论文字;
// F11 把"该面取不到"造在**索引单独缺一份**这一格(HEAD 与磁盘都还在)—— 那才是回落最容易
// 偷偷发生的位置,F3 的 commit:false 那一支里另两个面本来也读不到,证不出"不回落"。

test('F9 纯函数两跳:argv→面 四态 + 面→cat-file 规格 三态,未知面必须抛而不猜一个面', () => {
  assert.deepEqual(
    gate.faceFromArgv([]),
    { face: 'head', error: null },
    '默认档必须是 HEAD,不再是磁盘',
  )
  assert.equal(gate.faceFromArgv(['--staged']).face, 'staged')
  assert.equal(gate.faceFromArgv(['--worktree']).face, 'worktree')
  const both = gate.faceFromArgv(['--staged', '--worktree'])
  assert.equal(both.face, null)
  assert.match(
    both.error,
    /不得同用/,
    '两面旗同给必须是可判死的 error(取哪一面都会让另一面成假绿)',
  )
  assert.equal(gate.faceSpecPrefix('staged'), ':')
  assert.equal(gate.faceSpecPrefix('head'), 'HEAD:')
  assert.equal(gate.faceSpecPrefix('worktree'), null, '磁盘面走 readWorktreeFile,不给 cat-file 规格')
  assert.throws(
    () => gate.faceSpecPrefix('whatever'),
    Undetermined,
    '未知面必须抛,不许猜一个面继续跑(猜面 = 替一次拼错的调用发合格证)',
  )
  // 装车锁:上面那四个答案只证明"函数会给答案",这一条证明**有人问它**。
  // 刻意不写 `/faceSpecPrefix\(\s*face\s*\)/` —— 那种形态连 `export function faceSpecPrefix(face)`
  // 这一行定义都能匹配上,把调用点删干净它照样绿(本变异实测过一次:内联三元回来了而锁不红)。
  const src = readFileSync(GATE_SCRIPT, 'utf8')
  assert.match(
    src,
    /\bconst\s+prefix\s*=\s*faceSpecPrefix\(\s*face\s*\)/,
    '面→规格这一跳必须由 readFaceInputs 取值,否则 F9 全绿而门仍在猜面',
  )
  assert.doesNotMatch(
    src,
    /const\s+prefix\s*=\s*face\s*===\s*'staged'\s*\?\s*':'\s*:\s*'HEAD:'/u,
    '取材里又出现内联三元:未知面会被静默当 HEAD 读(猜面 = 发合格证)',
  )
  // 同型装车锁给远端侧新增的两个出口:parseLedger / readFaceInputs 若"写了但没人调",
  // F5(坏台账)与 F1–F3(换面)照样红绿得看不出差别 —— 判据失效的表现永远是安静。
  assert.match(
    src,
    /\bledger:\s*parseLedger\(/,
    '台账必须经 parseLedger 进判据本体;裸 JSON.parse 会让"坏台账"那一格冒红而不是判未判定',
  )
  assert.match(
    src,
    /\bconst\s+inputs\s*=\s*readFaceInputs\(/,
    'runChecks 必须真的经 readFaceInputs 取材 —— 只匹配 `readFaceInputs(repoRoot, face)` 会连' +
      '函数**定义行**一起算命中(变异实测:调用点整行删掉而锁不红),所以本锁锚在赋值形态上',
  )
})

test('F10 临时仓三面三答:HEAD 绿 / 索引红在 ratchet / 磁盘红在空理由,无旗标必须读 HEAD', () => {
  const f = buildFixture({ ...SRC_OK(), ledger: LEDGER_OK }) // 已提交态 = 三面共同的绿基线
  try {
    // 演化出三面互不相同:索引 = 基线 9(ratchet 红);磁盘 = 一条空理由登记(理由红);HEAD 不动。
    put(f.dir, P_LEDGER, `${JSON.stringify({ parseCoverageBaseline: 9, webOnly: [] }, null, 2)}\n`)
    gitAt(f.dir, ['add', '--', P_LEDGER]) // 索引脏
    put(
      f.dir,
      P_LEDGER,
      `${JSON.stringify({ parseCoverageBaseline: 3, webOnly: [{ event: 'gamma_frame', why: '略' }] }, null, 2)}\n`,
    ) // 磁盘改成**另一种**脏,且不 add ⇒ 索引 ≠ 磁盘 ≠ HEAD
    const head = runFixture(f)
    assert.equal(head.code, 0, `无旗标必须读 HEAD(绿),实际 rc=${head.code}:\n${head.out}${head.err}`)
    assert.ok(/HEAD blob/.test(head.out), '结论行必须如实报出用的是哪个面')
    const staged = runFixture(f, ['--json', '--staged'])
    assert.equal(staged.code, 1, '索引脏而磁盘"另有其脏"时,--staged 必须读索引这一份')
    assert.ok(
      staged.json.violations.some((v) => v.event === '(parse-coverage)' && v.reason.includes('基线 9')),
      `--staged 必须红在索引那份的 ratchet 上,实际:${JSON.stringify(staged.json.violations)}`,
    )
    const worktree = runFixture(f, ['--json', '--worktree'])
    assert.equal(worktree.code, 1)
    assert.ok(
      worktree.json.violations.some((v) => v.reason.includes('为什么只有 web 消费')),
      `--worktree 必须红在磁盘那份的空理由上,实际:${JSON.stringify(worktree.json.violations)}`,
    )
  } finally {
    rmScratch(f.dir)
  }
})

test('F11 只有索引缺台账 ⇒ exit 2 并点名路径,绝不回落到仍在位的 HEAD/磁盘', () => {
  const f = buildFixture({ ...SRC_OK(), ledger: LEDGER_OK })
  try {
    // 只从**索引**摘掉台账:磁盘与 HEAD 都还在 —— 回落任一面的话这一跑会给出 0/1 的"结论",
    // 而正确结论是"这一面没判成"(exit 2),两者必须可分辨。
    gitAt(f.dir, ['rm', '--cached', '-q', '--', P_LEDGER])
    const r = runRaw(f, ['--json', '--staged'])
    assert.equal(r.code, 2, `索引取不到台账必须 exit 2(不回落),实际 rc=${r.code}:\n${r.out}`)
    assert.ok(r.out.includes(P_LEDGER), 'exit 2 必须点名取不到的是哪一份,否则不可诊断')
    assert.match(r.out, /无法判定/)
    assert.ok(!/✅/.test(r.out), '没判成那一面绝不许输出通过结论')
    // 对照:同一夹具不带 --staged(HEAD 面)照常出结论 ⇒ 上面那支红不是恒红门坏了整门
    const head = runFixture(f)
    assert.equal(head.code, 0, `HEAD 面不受索引摘除影响,实际:\n${head.out}${head.err}`)
  } finally {
    rmScratch(f.dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
