// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 check-tool-contract-declared 的镜像测试(AGENTS §22c / §22d 口径)。
//
// 为什么必须"直接 import 源函数的 __test__"而不是复制一份判据:复制会产生两套真相,
// 源函数一改测试就假绿(§22c 立因)。本文件不 re-implement 解析器,只驱动它。
//
// 跑法:node --test scripts/tests/check-tool-contract-declared.test.mjs
import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync, mkdirSync, writeFileSync, cpSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// 临时夹具唯一落点(AGENTS §26:**禁止**往 os.tmpdir() 写 —— 活进程的 TEMP 可能仍钉在 C 盘)
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

import { __test__ as gate } from '../check-tool-contract-declared.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SCRIPT = path.join(ROOT, 'scripts', 'check-tool-contract-declared.mjs')

const BARE = `export const demo: Tool = {
  name: 'demo',
  description: 'd',
  parameters: { path: { type: 'string', description: 'p' } },
  required: ['path'],
  dangerLevel: 'read',
  async execute() { return { success: true, output: 'ok' } },
};`

const COMPLETE = `export const demo: Tool = {
  name: 'demo',
  contract: {
    shape: { visibleToProvider: true, input: { type: 'object' } },
    permission: { permissionKey: 'k', reason: 'r', riskLevel: 'read', effectScope: 'none', requiresApproval: false },
    resultBudget: { inlineLimitBytes: 1, providerVisibleLimitBytes: 1, policy: 'inline', preview: { bytes: 1, lines: 1, from: 'head' } },
  },
  async execute() { return { success: true, output: 'ok' } },
};`

const WITHOUT_SCOPE = COMPLETE.replace(/effectScope: 'none', /, '')
const WITHOUT_BUDGET = COMPLETE.replace(/resultBudget: \{[^}]*\{[^}]*\}[^}]*\},/, 'legacy: 1,')

test('T1 §22c 锚点:__test__ 必须真导出核心判据函数(缺一个 = 测试在驱动空气)', () => {
  for (const key of [
    'maskNonCode',
    'findObjectRanges',
    'collectMembers',
    'extractToolLiterals',
    'violationsOf',
    'flipAuditOf',
    'exceedsAnchor',
    // 2026-09-26 换锚新增:身份台账的三个出口。缺任何一个,T19 的端到端就无从构造。
    'toolKey',
    'declarationLedgerOf',
    'findDeclarationRemovals',
  ]) {
    assert.equal(typeof gate[key], 'function', `__test__.${key} 缺失`)
  }
  assert.deepEqual(gate.CONTRACT_GROUPS, ['shape', 'permission', 'resultBudget'])
})

test('T2 三种缺省状态各有正反例:没声明 / 声明但字段缺 / 齐备', () => {
  const kinds = (src) => gate.violationsOf(gate.extractToolLiterals(src)).map((v) => v.kind)
  assert.deepEqual(kinds(BARE), ['TC1-missing-contract'], '无契约必须计 TC1')
  assert.deepEqual(
    kinds(WITHOUT_SCOPE),
    ['TC2-missing-field:permission.effectScope'],
    '字段缺省即不可信',
  )
  assert.deepEqual(kinds(WITHOUT_BUDGET), ['TC2-missing-group:resultBudget'])
  assert.deepEqual(kinds(COMPLETE), [], '契约齐备必须为绿(否则本门恒红)')
})

test('T3 计数棘轮四向:只拦"把绕档加回来"(摘除那一型不归它管,见 T18/T19 的 TC3)', () => {
  assert.equal(gate.exceedsAnchor(1, 0), true, '新文件(HEAD 锚点 0)出现违规必须红')
  assert.equal(gate.exceedsAnchor(1, 1), false, '与 HEAD 齐平不得红(存量 102 个不许一次改红)')
  assert.equal(gate.exceedsAnchor(0, 1), false, '清理存量必须绿')
  // ⚠️ 措辞修正(2026-09-26):"同数不同内容也不红"作为**整门的锚点描述**是错的 ——
  // 那正是 G-207 的洞(摘掉一份字段不全的契约:1 处 TC2 换成 1 处 TC1,计数持平)。
  // 本断言仍然成立,但它只描述 `exceedsAnchor` **这一个函数**;内容那一半由
  // findDeclarationRemovals(TC3)承担,端到端证明在 T19。
  assert.equal(gate.exceedsAnchor(5, 5), false, '本函数按定义只比大小')
})

test('T4 flip-audit 只计"既无契约又无 dangerLevel"(第二阶段要拦的正是这批)', () => {
  const withDanger = gate.extractToolLiterals(BARE)
  assert.equal(gate.flipAuditOf(withDanger).length, 0)
  const noDanger = gate.extractToolLiterals(BARE.replace(/  dangerLevel: 'read',\n/, ''))
  assert.equal(gate.flipAuditOf(noDanger).length, 1)
  assert.equal(gate.flipAuditOf(gate.extractToolLiterals(COMPLETE)).length, 0, '挂了契约就不算缺省')
})

test('T5 判据非恒真:空源码与不含工具的源码都抽不到工具', () => {
  assert.deepEqual(gate.extractToolLiterals(''), [])
  assert.deepEqual(gate.extractToolLiterals('export const n = 42\nconst o = { name: 1 }'), [])
})

test('T6 注释 / 字符串 / 嵌套标量都不造假工具(遮法与 execute 函数形态判据)', () => {
  const tricky = `export const tricky: Tool = {
  name: 'tricky',
  // 假工具:name: 'fake', execute(){}
  description: "带大括号与引号 { } ' \\" 的描述",
  nested: { deep: { name: 'not-a-tool', execute: 1 } },
  re: /^[{]+$/,
  async execute() { return { success: true, output: 'ok' } },
};`
  const tools = gate.extractToolLiterals(tricky)
  assert.equal(tools.length, 1, `应只抽到 1 个真工具,实得 ${tools.length}`)
  assert.equal(tools[0].toolName, 'tricky')
  assert.equal(tools[0].hasContract, false)
  assert.ok(Number.isFinite(tools[0].line) && tools[0].line > 0, '命中必须带行号')
})

function runScript(args) {
  const out = execFileSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180000,
    maxBuffer: 64 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return out
}

test('T7 --self-test 连跑两次结论相同(只能跑一次的取证等于没取证)', () => {
  const once = runScript(['--self-test'])
  const twice = runScript(['--self-test'])
  const tail = (s) => s.trim().split('\n').pop()
  assert.equal(tail(once), tail(twice), `两次末行不一致:\n${tail(once)}\n${tail(twice)}`)
  assert.match(tail(once), /0 失败/)
  assert.match(once, /ST6 permission 缺 effectScope/)
})

test('T8 真仓全量档 exit 0 且末行给出三个数(证明不是恒红门,且数字可 parse)', () => {
  const out = runScript([])
  const last = out.trim().split('\n').pop()
  const m = /注册工具数 (\d+) \/ 无契约数 (\d+) \/ 棘轮余量 (\d+)/.exec(last)
  assert.ok(m, `末行缺三项读数:${last}`)
  assert.ok(Number(m[1]) > 0, '全量档抽到 0 个工具 = 判据失明,不得当作通过')
  assert.ok(Number(m[2]) >= Number(m[1]) - Number(m[2]), '无契约数与工具数同源,只是报数')
})

test('T9 --staged 与 --worktree 同给必须判死(两个面互斥,不得静默选一个)', () => {
  let code = 0
  let err = ''
  try {
    runScript(['--staged', '--worktree'])
  } catch (e) {
    code = e.status
    err = String(e.stderr || e.message)
  }
  assert.equal(code, 2, `期望 exit 2,实得 ${code}:${err}`)
  assert.match(err, /不得同用/)
})

// ==================== TRD(触碰即须声明)2026-09-25 换锚点 ====================
//
// 本票的全部技术核心:锚点从"该文件 HEAD 存量违规数"(碰了也不红)换成"碰了就必须补"。
// 下列断言**不复制任何判据实现**(§22c 红线),只驱动源文件的 __test__ 出口。

const BARE_FILE = {
  rel: 'apps/cli/src/tools/builtins.ts',
  toolCount: 1,
  violations: gate.violationsOf(gate.extractToolLiterals(BARE)),
}
const DECLARED_FILE = {
  rel: 'apps/cli/src/tools/declared.ts',
  toolCount: 1,
  violations: gate.violationsOf(gate.extractToolLiterals(COMPLETE)),
}

test('T10 §22c 锚点:TRD 三出口 + 宽限常量必须真导出(缺一个 = 测试在驱动空气)', () => {
  for (const key of ['trdEnabled', 'trdState', 'trdAssess', 'enumerationBlind', 'isoDay']) {
    assert.equal(typeof gate[key], 'function', `__test__.${key} 缺失`)
  }
  assert.match(String(gate.GRANDFATHER_UNTIL), /^\d{4}-\d{2}-\d{2}$/, '宽限截止日必须是 ISO 日期')
  assert.equal(gate.TRD_OFF_FLAG, '--no-touch-requires-declaration')
})

test('T11 TRD 默认开:没有"漏挂开关就整条判据隐身"的空间(关档必须显式点名)', () => {
  assert.equal(gate.trdEnabled([]), true, '缺省必须是开档 —— 默认关的判据等于没有判据')
  assert.equal(gate.trdEnabled(['--staged']), true)
  assert.equal(gate.trdEnabled([gate.TRD_OFF_FLAG]), false, '只有显式 --no- 才关')
})

test('T12 两档日期都可构造:宽限期内只报数,过期后同一输入判红(today 注入,不依赖系统时钟)', () => {
  const until = gate.GRANDFATHER_UNTIL
  const grace = gate.trdAssess({
    files: [BARE_FILE],
    face: 'staged',
    state: gate.trdState({ today: '2020-01-01', until }),
  })
  const expired = gate.trdAssess({
    files: [BARE_FILE],
    face: 'staged',
    state: gate.trdState({ today: '2099-01-01', until }),
  })
  assert.equal(grace.reds.length, 0, '宽限期内不得判红(否则今天起没人能提交)')
  assert.equal(grace.notices.length, 1, '宽限期内必须如实报数,不得静默')
  assert.equal(expired.reds.length, 1, '过期后同一输入必须判红')
  assert.equal(expired.notices.length, 0)
  assert.equal(expired.violations, 1)
  // 到期日当天不算过期(与守门 108 同边界);日期不可解析不得静默放行
  assert.equal(gate.trdState({ today: until, until }).enforce, false)
  assert.equal(gate.trdState({ today: 'garbage', until }).enforce, true)
})

test('T13 全量档逐字不变 + 全员已声明必须绿(证明本票没把存量 104 处搞红)', () => {
  const headFace = gate.trdAssess({
    files: [BARE_FILE],
    face: 'head',
    state: gate.trdState({ today: '2099-01-01', until: gate.GRANDFATHER_UNTIL }),
  })
  assert.equal(headFace.applied, false, 'head 面整条 TRD 不得生效')
  assert.equal(headFace.reds.length, 0)
  const green = gate.trdAssess({
    files: [DECLARED_FILE],
    face: 'staged',
    state: gate.trdState({ today: '2099-01-01', until: gate.GRANDFATHER_UNTIL }),
  })
  assert.equal(green.reds.length + green.notices.length, 0, '契约齐备必须绿(否则本门恒红)')
  // 换锚点的实质:旧棘轮 2 vs HEAD 2 放绿,TRD 仍计 2 处
  assert.equal(gate.exceedsAnchor(2, 2), false)
  const swap = gate.trdAssess({
    files: [{ ...BARE_FILE, violations: [...BARE_FILE.violations, ...BARE_FILE.violations] }],
    face: 'staged',
    state: gate.trdState({ today: '2099-01-01', until: gate.GRANDFATHER_UNTIL }),
  })
  assert.equal(swap.violations, 2, 'TRD 必须按"碰了就必须补"计数,而非与 HEAD 齐平就放过')
})

test('T14 枚举到 0 枚注册 ⇒ 判死(暂存触及文件而抽不到工具 = 判据失明,不得记绿)', () => {
  assert.equal(gate.enumerationBlind({ face: 'staged', judgedCount: 3, totalTools: 0 }), true)
  assert.equal(gate.enumerationBlind({ face: 'staged', judgedCount: 3, totalTools: 4 }), false)
  assert.equal(gate.enumerationBlind({ face: 'head', judgedCount: 55, totalTools: 0 }), false)
})

test('T15 装车证明:main 必须真的调用 TRD 判据并把当前档位打进输出(判据存在而永不调用 = 没有)', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.match(src, /trdAssess\(\{/, 'main 未调用 trdAssess ⇒ TRD 判据只是死代码')
  assert.match(src, /enumerationBlind\(\{/, 'main 未调用 enumerationBlind ⇒ 0 枚举判死未接线')
  assert.match(src, /TRD\(触碰即须声明\)当前档位/, '输出必须明写当前是哪一档')
  assert.match(src, /宽限截止/, '输出必须把宽限日期与剩余天数打出来')
  // 全量档的 ✅ 结论行口径不得被 TRD 改写:后缀只允许出现在暂存档
  assert.match(src, /face === 'staged' && trd\.applied/, '只有暂存档才给 ✅ 行加 TRD 后缀')
})

test('T16 --today 非法日期必须判死(不得把"打错参数"当成已核)', () => {
  let code = 0
  let err = ''
  try {
    runScript(['--staged', '--today', '2026-13-99'])
  } catch (e) {
    code = e.status
    err = String(e.stderr || e.message)
  }
  assert.equal(code, 2, `期望 exit 2,实得 ${code}:${err}`)
  assert.match(err, /需要一个 ISO 日期/)
})

test('T17 真仓全量档复跑:末行三读数仍在且 exit 0(换锚点后存量仍不被搞红)', () => {
  const out = runScript([])
  assert.match(out, /TRD\(触碰即须声明\)当前档位:开但\*\*只作用于 --staged 档\*\*/)
  const last = out.trim().split('\n').pop()
  const m = /注册工具数 (\d+) \/ 无契约数 (\d+) \/ 棘轮余量 (\d+) \/ 契约摘除 (\d+)/.exec(last)
  assert.ok(m, `末行缺四项读数:${last}`)
  assert.ok(Number(m[1]) > 0, '抽到 0 个工具 = 判据失明')
  assert.ok(Number(m[2]) > Number(m[3]), '存量无契约数必须仍被报出(只报数,不判红)')
  assert.equal(Number(m[4]), 0, 'HEAD 面上今天 0 枚声明可摘 ⇒ TC3 必须 0 红(否则就是恒红门)')
})

// ==================== TC3:声明身份台账(2026-09-26 换锚,治 G-207) ====================
//
// 下面所有断言**只驱动源文件的 __test__ 出口**,不复制判据实现(§22c 红线)。

const PARTIAL = COMPLETE.replace(/ effectScope: 'none',/, '')
const DEMO_REL = 'apps/cli/src/tools/demo.ts'
const DEMO_KEY = `${DEMO_REL}#demo`
const HELPER_REL = 'apps/cli/src/tools/command-policy/tokenizer.ts'
const HELPER = `export const KEYWORDS = ['if', 'then']\nexport function tokenize(s: string) { return s.split(' ') }\n`

test('T18 TC3 纯函数成对:摘除必红 / 新增不红 / 整枚删除不红 / 同名两枚不得互相冒充', () => {
  const led = (src) => gate.declarationLedgerOf(DEMO_REL, gate.extractToolLiterals(src))
  const declared = led(COMPLETE)
  const bare = led(BARE)
  // 前提:三份夹具是**同一枚工具**的身份 —— 否则"摘除"根本无从谈起
  assert.equal([...declared.keys()].join(), DEMO_KEY)
  assert.equal([...bare.keys()].join(), DEMO_KEY)
  assert.equal(gate.toolKey(DEMO_REL, 'demo'), DEMO_KEY)
  // ① 摘除 ⇒ 红
  assert.equal(gate.findDeclarationRemovals({ head: declared, current: bare }).removed.length, 1)
  // ② 台账没记而面上出现声明 ⇒ 不红(判据不得把自己产出的形态判红)
  assert.equal(gate.findDeclarationRemovals({ head: bare, current: declared }).removed.length, 0)
  assert.equal(gate.findDeclarationRemovals({ head: bare, current: bare }).removed.length, 0)
  assert.equal(
    gate.findDeclarationRemovals({ head: bare, current: bare }).declaredIdentities,
    0,
    '无声明可摘时必须报 0,结论行据此喊"无事可判"',
  )
  // ③ 整枚工具被删 ⇒ 不判摘除(删除属守门 99 的地盘,本门不越权)
  assert.equal(
    gate.findDeclarationRemovals({ head: declared, current: new Map() }).removed.length,
    0,
  )
  // ④ 同名两枚摘掉一颗:名字集合会漏,身份多重集不会
  const dup = (a, b) =>
    gate.declarationLedgerOf(DEMO_REL, [
      { toolName: 'dup', hasContract: a },
      { toolName: 'dup', hasContract: b },
    ])
  assert.equal(
    gate.findDeclarationRemovals({ head: dup(true, true), current: dup(true, false) }).removed[0]
      .missing,
    1,
  )
  assert.equal(
    gate.findDeclarationRemovals({ head: dup(true, false), current: dup(true, true) }).removed
      .length,
    0,
  )
})

test('T18b 计数锚点全盲的那一型,正是身份锚点有牙的那一型(两把尺子的分工必须可对账)', () => {
  const n = (src) => gate.violationsOf(gate.extractToolLiterals(src)).length
  // HEAD: 挂了契约但缺 effectScope ⇒ 1 处 TC2;摘掉契约 ⇒ 1 处 TC1。计数持平。
  assert.equal(n(PARTIAL), 1)
  assert.equal(n(BARE), 1)
  assert.equal(gate.exceedsAnchor(n(BARE), n(PARTIAL)), false, '计数棘轮按定义放绿')
  const led = (src) => gate.declarationLedgerOf(DEMO_REL, gate.extractToolLiterals(src))
  assert.equal(
    gate.findDeclarationRemovals({ head: led(PARTIAL), current: led(BARE) }).removed.length,
    1,
    '同一输入身份台账必须判红 —— 这就是本票换锚的全部理由',
  )
})

// ---------- 端到端:临时 git 仓(证明两型修复真在 CLI 路径上生效,不只是纯函数) ----------

function scratchRepo() {
  const dir = mkScratch('trd-tc3-')
  mkdirSync(path.join(dir, 'scripts', 'lib'), { recursive: true })
  mkdirSync(path.join(dir, 'apps', 'cli', 'src', 'tools', 'command-policy'), { recursive: true })
  cpSync(SCRIPT, path.join(dir, 'scripts', 'check-tool-contract-declared.mjs'))
  for (const f of ['face-reader.mjs', 'gitdir.mjs'])
    cpSync(path.join(ROOT, 'scripts', 'lib', f), path.join(dir, 'scripts', 'lib', f))
  writeFileSync(path.join(dir, HELPER_REL), HELPER, 'utf8')
  writeFileSync(path.join(dir, DEMO_REL), COMPLETE, 'utf8')
  for (const a of [
    ['init', '-b', 'main'],
    ['add', '-A'],
    ['commit', '-m', 'base', '--no-verify'],
  ]) {
    const r = git(a, dir)
    if (r.status !== 0) throw new Error(a[0] + ': ' + (r.stderr || r.stdout))
  }
  return dir
}

function git(args, cwd) {
  // `core.hooksPath` 指向一个不存在的目录:临时仓**结构上不得**跑到任何钩子。
  // 本机 global/system 实测未设 hooksPath,但 post-commit 的 git-push-guard 一旦被人挂上全局,
  // 一枚测试就会拿别人的仓去推远端 —— 这类"当下不成立所以不写"的护栏本仓已经付过学费。
  return spawnSync(
    'git',
    [
      '-c',
      'safe.directory=*',
      '-c',
      'user.email=t@e.co',
      '-c',
      'user.name=t',
      '-c',
      `core.hooksPath=${path.join(cwd, '.no-hooks-at-all')}`,
      ...args,
    ],
    { cwd, encoding: 'utf8', windowsHide: true },
  )
}

function gateIn(dir, args) {
  const p = spawnSync(
    process.execPath,
    [path.join(dir, 'scripts', 'check-tool-contract-declared.mjs'), ...args],
    { cwd: dir, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 32 << 20 },
  )
  return { code: p.status, out: String(p.stdout || '') + String(p.stderr || '') }
}

test('T19 端到端(临时仓三档):不注册工具的文件不得被判红;摘除契约必须判红;正常编辑必须绿', () => {
  const dir = scratchRepo()
  try {
    // --- A 只暂存"本就不注册工具"的文件(helper)---
    // 旧实现在这里 exit 2「无法判定」= 每一次碰 helper 的提交都被硬拦(§12e 那型)。
    writeFileSync(path.join(dir, HELPER_REL), HELPER + '// 一行正常编辑\n', 'utf8')
    assert.equal(git(['add', HELPER_REL], dir).status, 0)
    const a = gateIn(dir, ['--staged'])
    assert.equal(a.code, 0, `helper 文件不得被本门拦下,实得 exit ${a.code}:\n${a.out}`)
    assert.match(a.out, /不适用/, '必须如实打出"契约判据不适用",不得静默算已核')

    // --- B 摘掉一份"字段不全"的契约(计数持平 ⇒ 只有身份锚点看得见)---
    git(['reset', '-q'], dir)
    writeFileSync(path.join(dir, HELPER_REL), HELPER, 'utf8')
    writeFileSync(path.join(dir, DEMO_REL), PARTIAL, 'utf8')
    assert.equal(git(['add', DEMO_REL], dir).status, 0)
    const c1 = git(['commit', '-m', 'partial contract', '--no-verify'], dir)
    assert.equal(c1.status, 0, c1.stderr || c1.stdout)
    writeFileSync(path.join(dir, DEMO_REL), BARE + '\n', 'utf8')
    assert.equal(git(['add', DEMO_REL], dir).status, 0)
    const b = gateIn(dir, ['--staged', gate.TRD_OFF_FLAG])
    assert.equal(b.code, 1, `摘除契约必须判红,实得 exit ${b.code}:\n${b.out}`)
    assert.match(b.out, /TC3/, '必须点名判据是 TC3(而非计数棘轮)')
    assert.match(b.out, /apps\/cli\/src\/tools\/demo\.ts#demo/, '必须点名被摘除的**身份**')

    // --- C 对照:保留声明的正常编辑必须绿(证明 B 的红来自摘除本身)---
    git(['reset', '-q'], dir)
    writeFileSync(path.join(dir, DEMO_REL), PARTIAL + '// 一行正常注释\n', 'utf8')
    assert.equal(git(['add', DEMO_REL], dir).status, 0)
    const c = gateIn(dir, ['--staged', gate.TRD_OFF_FLAG])
    assert.equal(c.code, 0, `保留声明的正常编辑必须绿,实得 exit ${c.code}:\n${c.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T20 装车证明:TC3 必须真挂在 main 上并把读数打进输出与末行(判据在而没调用 = 没有)', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.match(src, /findDeclarationRemovals\(\{/, 'main 未调用身份台账 ⇒ TC3 只是死代码')
  assert.match(src, /declarationLedgerOf\(rel, headTools\)/, '台账必须由 HEAD 现算,不得取手工清单')
  assert.match(src, /声明身份台账\(TC3\)/, '输出必须打出已声明身份数与摘除数')
  assert.match(src, /契约摘除 \$\{removedTotal\}/, '结论/末行必须把摘除计数带出来')
  assert.match(src, /anchorTools,/, 'enumerationBlind 必须拿到 HEAD 侧工具数,否则又会误拦 helper')
  // 计数棘轮**不得被摘掉**:换锚是"加一把尺子",不是"把旧的扔掉"
  assert.match(src, /exceedsAnchor\(violations\.length, anchor\)/, '计数棘轮必须仍在')
  assert.match(src, /reds\.length > 0 \|\| removals\.length > 0/, '失败分支必须同时看两把尺子')
})

test('T21 runner 注册对账(id/blocking/skipEnv 三者齐备;此前该文件没有这条,新增)', () => {
  const runner = readFileSync(path.join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  const at = runner.indexOf("script: 'check-tool-contract-declared.mjs'")
  assert.ok(at > 0, '本门不在 runner 里 ⇒ 摘线了(守门 70/76/81 同型)')
  const block = runner.slice(Math.max(0, at - 400), at + 400)
  assert.match(block, /id: '111'/, '注册 id 漂了必须让人看见')
  assert.match(block, /mode: 'blocking'/, '定级被悄悄降成 warn ⇒ 判对了也没人被打断')
  assert.match(block, /skipEnv: 'HUSKY_SKIP_TOOL_CONTRACT_DECLARED'/, '应急通道声明必须在位')
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
