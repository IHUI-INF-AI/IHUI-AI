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
//   · 本门取材面已于 2026-09-28 收口为统一口径:默认判 **HEAD blob**、`--staged` 判**索引 blob**、
//     `--worktree` 仅人工逃生舱、两面旗同给 / 任一面取不到 ⇒ **exit 2 且不回落另一个面**。
//     这一格由 F 组用例钉死:F1 纯函数三面四态、F2 临时 git 仓"索引脏而磁盘好"的端到端三面三答、
//     F3 源码形状锁(不得再按磁盘取被审内容、必须经共用层一次 catBatch 同面同轮)。
//     夹具因此**连提交**成合法 git 仓 —— 只写盘不 commit 的话每条夹具用例会红在"HEAD 取不到",
//     那是夹具失效,不是门坏了。
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
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPTS_DIR = join(HERE, '..')
const GATE_REL = 'check-sse-parser-parity.mjs'
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

/**
 * 在临时目录里造一棵「看起来像本仓」的**最小 git 仓**,并把**真实的那份门脚本连同其
 * 相对 import 闭包**(face-reader → gitdir)拷进去。
 * 该门把 ROOT 由自身位置推导(scripts/check-*.mjs ⇒ 上一级),所以拷一份就等于换了被审面;
 * 判据仍是同一份实现 —— 本文件不重写任何一条臂(§22c「两份真相必漂移」)。
 * 闭包必须**推导**而不是手抄清单(见 lib/scratch-module-closure.mjs 头注记录的两次同型事故:
 * 迁移后只拷门体一份,夹具全部 ERR_MODULE_NOT_FOUND)。
 * 2026-09-28:门默认面收口为 HEAD blob,所以夹具**连提交** —— 只写盘不 commit 时每条用例
 * 都会红在「HEAD 取不到」,那是夹具失效不是门坏了(守门 36 镜像同口径)。
 */
function buildFixture({ contract, client, parse, ledger }) {
  const dir = mkScratch('sse-parser-parity-')
  const script = join(dir, 'scripts', GATE_REL)
  for (const rel of [
    'scripts/data',
    'packages/shared/src/sse',
    'packages/shared/src/utils',
    'packages/api-client/src',
  ]) {
    mkdirSync(join(dir, rel), { recursive: true })
  }
  copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir, 'scripts'), ['lib/face-reader.mjs'])
  writeFileSync(join(dir, P_CONTRACT), contract)
  writeFileSync(join(dir, P_CLIENT), client)
  writeFileSync(join(dir, P_PARSE), parse)
  writeFileSync(join(dir, P_LEDGER), JSON.stringify(ledger, null, 2) + '\n')
  git(dir, 'init', '-q')
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', 'fixture')
  return { dir, script }
}

/**
 * 演练仓里的 git:绝对路径来自取材层(不赌 PATH,§5b);autocrlf 关掉 —— 否则索引 blob
 * 与盘上字节不等,三面比对的夹具会假红(守门 36 镜像测试同口径)。身份用 `-c` 传,不落 config。
 */
function git(cwd, ...args) {
  return execFileSync(
    GIT_BIN,
    [
      '-c',
      'safe.directory=*',
      '-c',
      'core.quotepath=false',
      '-c',
      'core.autocrlf=false',
      '-c',
      'user.name=gate-fixture',
      '-c',
      'user.email=gate-fixture@invalid',
      '-C',
      cwd,
      ...args,
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] },
  )
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

/** 跑那一门:返回 { code, json, out, err };紧急跳过旗标强制清空,否则测试会对着跳过通道假绿 */
function runFixture({ dir, script }, args = ['--json']) {
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
    env: { ...process.env, HUSKY_SKIP_SSE_PARSER_PARITY: '' },
  })
  const json = leadingJson(r.stdout)
  assert.ok(json, `门在夹具上没有产出可读 JSON 结论 ⇒ 这条测试本身失效了:\n${r.stdout}\n${r.stderr}`)
  return { code: r.status, json, out: r.stdout, err: r.stderr ?? '' }
}

const eventsOf = (violations) => violations.map((v) => v.event).join(',')

/**
 * 原始跑法:不要求 stdout 有 JSON。
 * exit 2「无法判定」那一档**只**往 stderr 写一句话、没有 JSON 结论 —— 那是门的正确形状
 * (没判成就不出结论),所以那一臂不能经 runFixture(它会先断言 JSON 存在)。
 */
function runFixtureRaw({ dir, script }, args = []) {
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
    env: { ...process.env, HUSKY_SKIP_SSE_PARSER_PARITY: '' },
  })
  return { code: r.status, out: r.stdout ?? '', err: r.stderr ?? '' }
}

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
  const res = gate.runChecks(REPO, 'head')
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
  const res = gate.runChecks(REPO, 'head')
  // 台账取 HEAD blob —— 与门判的是同一个面,不得拿滞后的磁盘副本给 HEAD 面的结论作证
  const declared = new Set((JSON.parse(showHead(P_LEDGER)).webOnly ?? []).map((x) => x.event))
  const stillParsed = [...declared].filter((e) => res.parseHandled.includes(e))
  assert.deepEqual(stillParsed, [], `这些帧已被 sse-parse 解析却仍挂着 webOnly 登记:${stillParsed}`)
  // 另一半:每一个"只在一侧解析"的帧都必须有登记 —— 缺一即小程序静默丢帧。
  const unaccounted = res.clientHandled.filter((e) => !res.parseHandled.includes(e) && !declared.has(e))
  assert.deepEqual(unaccounted, [], `api-client 已解析、sse-parse 未解析且未交代归属:${unaccounted}`)
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

// ───────────────── F 组:取材面收口(2026-09-28,G-303)─────────────────
// 三道各钉一件事,缺一不可:
//   F1 证明 **argv→面** 与 **面→cat-file 规格** 这两层纯函数四态齐备(默认必须是 head,
//      两面旗同给必须是 error,未知面必须抛而不是猜一个面继续跑);
//   F2 证明**三面对同一份夹具给出三种不同结论** —— 这是对"门真的在换面读"的端到端阳性对照,
//      F1 全绿而 F2 红 ⇒ 面选对了却没接到取材上(半接线,守门 118 正是为此而设);
//      外加一条"所选面取不到 ⇒ exit 2 且不回落"的方向锁。
//   F3 源码形状锁:磁盘直读与自派生 git 取内容这两种旧形态**不得回来**。
// 变异自证(交付报告登记):把 faceFromArgv 的 `def: 'head'` 改回 `'worktree'`(= 旧"按磁盘判")
// ⇒ F1 的默认档臂与 F2 的"无旗标必须读 HEAD"臂同时翻红;若把 readGateInputs 里 staged 的
// 取不到分支改成回落磁盘 ⇒ F2 的 rm --cached 臂红。

test('F1 三面四态(纯函数):默认 head / --staged / --worktree / 两旗同给=error,未知面抛', () => {
  assert.deepEqual(gate.faceFromArgv([]), { face: 'head', error: null }, '默认档必须是 HEAD,不再是磁盘')
  assert.equal(gate.faceFromArgv(['--staged']).face, 'staged')
  assert.equal(gate.faceFromArgv(['--worktree']).face, 'worktree')
  const both = gate.faceFromArgv(['--staged', '--worktree'])
  assert.equal(both.face, null)
  assert.match(both.error, /不得同用/, '两面旗同给必须是可判死的 error(取哪一面都会让另一面成假绿)')
  assert.equal(gate.faceSpecPrefix('staged'), ':')
  assert.equal(gate.faceSpecPrefix('head'), 'HEAD:')
  assert.equal(gate.faceSpecPrefix('worktree'), null, '磁盘面走 readWorktreeFile,不给 cat-file 规格')
  assert.throws(() => gate.faceSpecPrefix('whatever'), Undetermined, '未知面必须抛,不许猜一个面继续跑')
})

test('F2 临时仓三面三答:HEAD 绿 / 索引红(ratchet) / 磁盘红(空理由),无旗标必须读 HEAD', () => {
  const f = buildFixture({
    contract: contractSource(EVENTS),
    client: parserSource(EVENTS),
    parse: parserSource(EVENTS),
    ledger: { parseCoverageBaseline: 3, webOnly: [] }, // 已提交态 = 三面共同的绿基线
  })
  try {
    // 演化出三面互不相同:索引 = 基线 9(ratchet 红);磁盘 = 一条空理由登记(理由红);HEAD 不动。
    writeFileSync(join(f.dir, P_LEDGER), JSON.stringify({ parseCoverageBaseline: 9, webOnly: [] }, null, 2) + '\n')
    git(f.dir, 'add', '--', P_LEDGER) // 索引脏
    writeFileSync(
      join(f.dir, P_LEDGER),
      JSON.stringify({ parseCoverageBaseline: 3, webOnly: [{ event: 'gamma_frame', why: '略' }] }, null, 2) + '\n',
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

test('F2b 所选面取不到 ⇒ exit 2 并点名路径,绝不回落到磁盘/HEAD', () => {
  const f = buildFixture({
    contract: contractSource(EVENTS),
    client: parserSource(EVENTS),
    parse: parserSource(EVENTS),
    ledger: { parseCoverageBaseline: 3, webOnly: [] },
  })
  try {
    // 只从**索引**摘掉台账:磁盘与 HEAD 都还在 —— 回落任一面的话这一跑会给出 0/1 的"结论",
    // 而正确结论是"这一面没判成"(exit 2),两者必须可分辨。
    git(f.dir, 'rm', '--cached', '-q', '--', P_LEDGER)
    const r = runFixtureRaw(f, ['--staged'])
    assert.equal(r.code, 2, `索引取不到台账必须 exit 2(不回落),实际 rc=${r.code}:\n${r.out}${r.err}`)
    assert.ok(
      (r.out + r.err).includes(P_LEDGER),
      'exit 2 必须点名是哪个路径取不到,否则不可诊断',
    )
    assert.match(r.out + r.err, /无法判定/)
    // 对照:同一夹具不带 --staged(HEAD 面)照常出结论 ⇒ 上面那支红不是恒红门坏了整门
    const head = runFixture(f)
    assert.equal(head.code, 0, `HEAD 面不受索引摘除影响,实际:\n${head.out}${head.err}`)
  } finally {
    rmScratch(f.dir)
  }
})

test('F3 形状锁:取材必须经共用层一次 catBatch,磁盘直读/自派生 git 取内容不得回来', () => {
  const src = readFileSync(join(SCRIPTS_DIR, GATE_REL), 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '取材必须走共用层(绝对路径 git/超时/截断都由层兜)')
  assert.match(src, /catBatch\(/, '四份输入必须一次 batch 同面同轮读完(混面会产出假红/假绿)')
  assert.doesNotMatch(src, /readFileSync\s*\(/, '不得再按磁盘取被审内容(守门 118 的 loose-fs 桶)')
  assert.doesNotMatch(src, /from 'node:fs'/, '门体不再需要 node:fs —— 出现即磁盘直读回来了')
  assert.doesNotMatch(src, /['"]show['"]/, '不得自派生 `git show` 取内容:半接线(引层却自己读)正是 118 收紧的对象')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
