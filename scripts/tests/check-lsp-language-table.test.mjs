#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/* eslint-disable no-console -- 测试脚本需要打印"未注册"这类如实说明 */
/**
 * §22c 镜像测试:`scripts/check-lsp-language-table.mjs`(语言表结构对账,V3 #83)。
 *
 * 与本门 `--self-test` 的分工(两套必须互补,否则就是复读机):
 *   · `--self-test` 用**构造夹具**证判据逻辑(T1–T5 各一对正反)。
 *   · 本文件只做 self-test 结构上做不到的三件事:
 *     T1 **装配证明**(方向性):runner 里没有本门时,本文件不得把它读成"已装车";
 *        一旦主会话注册了,条目必须成套(mode blocking + skipEnv),缺一即红。
 *     T2 **判据形状锁**(源码级):取材必须经 face-reader 的 catBatch;不得回到
 *        `readFileSync` / `execSync` / `process.cwd()` 定根 —— 这类回退只能由源码锁发现。
 *     T3 **真仓阳性对照**:输入**逐字取自真实语言表与真实客户端**(§22c 红线:判据的
 *        对象是真实文件的形态时,至少一条用例的输入必须来自那个真实文件,不得全用自造夹具),
 *        再逐条"把一侧改掉"证明判据真会红。
 *     T4 **CLI 端到端(真实仓,只锁"跑到判据"不锁结论)**:两面旗同给必须 exit 2;
 *        真实仓各面必须**判得出**(exit ∈ {0,1},绝不允许 2),但不断言 0 还是 1 ——
 *        断言"现仓必须零红"会把测试耦合到仓库瞬时状态(2026-09-27 实测:该断言在存量
 *        15 处时红、在别人清偿存量后绿,红绿都反映的不是判据好坏)。
 *     T6 **棘轮双向锁(临时迷你仓,构造面)**:已入库的存量违规 ⇒ `--staged` 必须绿且
 *        照报存量数;在其上加一条新违规 ⇒ `--staged` 必须红并点名新文件;全量档(HEAD)
 *        对同一存量照旧判红(问责面不套棘轮)。三条各红/绿都是**构造出来的**,不依赖
 *        真仓此刻有谁在飞什么(守门 103 T12 的教训:证明机制只能用纯构造面)。
 *
 * 真内容取 HEAD 面:两份被审文件早已入库,worktree 面会撞上并行会话的半编辑态
 * (AGENTS §12:"别人未提交的重写不得钉红无关测试")。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as GATE, TABLE_REL, CLIENT_REL, readFaceInputs } from '../check-lsp-language-table.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE_PATH = join(ROOT, 'scripts/check-lsp-language-table.mjs')
const GATE_SRC = readFileSync(GATE_PATH, 'utf8')
const RUNNER_SRC = readFileSync(join(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
const SELF_SRC = readFileSync(fileURLToPath(import.meta.url), 'utf8')
const SKIP_ENV = 'HUSKY_SKIP_LSP_LANGUAGE_TABLE'
const GIT_BIN = resolveGitBin() || 'git'

/** 真仓内容只读一次(测试之间不可互相污染,但读盘一次足够)。取 HEAD 面:并行会话的
 *  半编辑态不得把镜像测试钉红(T4 mirror 的 worktree 档就是被这条教训改掉的)。 */
let real = null
function realInputs() {
  if (!real) real = readFaceInputs(ROOT, 'head')
  return real
}

function gate(...argsAndOpts) {
  const last = argsAndOpts[argsAndOpts.length - 1]
  const opts = last && typeof last === 'object' ? last : {}
  const args = opts === last ? argsAndOpts.slice(0, -1) : argsAndOpts
  return spawnSync(process.execPath, [opts.script ?? GATE_PATH, ...args], {
    cwd: opts.cwd ?? ROOT,
    encoding: 'utf-8',
    windowsHide: true,
    timeout: 180_000,
    ...(opts.env ? { env: opts.env } : {}),
  })
}

/** 从 runner 源码里按大括号配对取出本门那一条注册项(取不到返回 null)。 */
function ownRunnerEntry() {
  const at = RUNNER_SRC.indexOf('check-lsp-language-table.mjs')
  if (at < 0) return null
  const idAt = RUNNER_SRC.lastIndexOf('id:', at)
  if (idAt < 0) return null
  const open = RUNNER_SRC.lastIndexOf('{', idAt)
  if (open < 0) return null
  let depth = 0
  for (let i = open; i < RUNNER_SRC.length; i++) {
    const c = RUNNER_SRC[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return RUNNER_SRC.slice(open, i + 1)
    }
  }
  return null
}

test('T0 __test__ 出口成套(§22c:源文件 export + 本文件 import 两处锚点必须在位)', () => {
  for (const key of ['parseLanguageTable', 'judgeTable', 'extractArrayLiteral', 'splitTopLevelObjects', 'faceFromArgv']) {
    assert.equal(typeof GATE[key], 'function', `__test__ 缺出口 ${key}`)
  }
  assert.match(GATE_SRC, /export const __test__ = \{/)
  assert.match(SELF_SRC, /import \{ __test__ as GATE[^}]*\} from '\.\.\/check-lsp-language-table\.mjs'/)
})

test('T1 装配证明:未在 runner 里就不得被读成已装车;在位则成套性必须齐备', () => {
  const entry = ownRunnerEntry()
  if (entry === null) {
    // 注册由主会话做(门头注已声明)。本分支锁的是方向:头注不得出现"肯定式声称已接"。
    assert.doesNotMatch(
      GATE_SRC,
      /已接 pre-commit|已挂 guardian|guardian (第|id)\s*\d+/,
      '门头注声称已接提交链,而 runner 里没有它 ⇒ 守门 89 的 R1 会红(且这才是真丢失)',
    )
    console.log('ℹ️ T1:本门尚未接入 guardian-runner(注册由主会话做);此例只锁方向,不计失败')
    return
  }
  assert.match(entry, /mode:\s*'blocking'/, '已注册但非 blocking ⇒ 判红会被读成警告')
  assert.match(entry, new RegExp(`skipEnv:\\s*'${SKIP_ENV}'`), '已注册但缺 skipEnv ⇒ 无应急出口')
})

test('T2 判据形状锁:取材必须经 face-reader,不得回到磁盘/cwd/execSync', () => {
  assert.match(GATE_SRC, /from '\.\/lib\/face-reader\.mjs'/)
  assert.match(GATE_SRC, /catBatch\(/, '内容未经层的批量读 ⇒ 半接线(守门 118 那一型)')
  assert.match(GATE_SRC, /readWorktreeFile\(/, 'worktree 档也必须经层,不得自己 readFile')
  assert.doesNotMatch(GATE_SRC, /\bprocess\.cwd\(\)/, '定根不得依赖调用者站哪(守门 70 那一型)')
  assert.doesNotMatch(GATE_SRC, /\breadFileSync\(/, '被审内容不得按磁盘取')
  assert.doesNotMatch(GATE_SRC, /\bexecSync\(/, '不得散写 git 取内容')
  assert.match(GATE_SRC, /def:\s*'head'/, '默认档必须是 HEAD')
})

test('T3a 真表(HEAD 面)+ 真客户端 ⇒ 解析不漂、无结构性假阳(T1/T2/T3 不得对真表发红)', () => {
  const files = realInputs()
  const tableText = files[TABLE_REL]
  const clientText = files[CLIENT_REL]
  assert.ok(tableText && clientText, '真仓取不到语言表/客户端 ⇒ 本用例失去意义,必须失败而非跳过')
  const otherFiles = Object.fromEntries(Object.entries(files).filter(([rel]) => rel !== TABLE_REL))
  const res = GATE.judgeTable({ tableText, clientText, otherFiles })
  assert.equal(res.fatal, null, `真仓 fatal:${res.fatal}`)
  assert.ok(res.counts.entries >= 5, `真表项数 ${res.counts.entries} 偏低 ⇒ 解析器可能又漂了`)
  // T1/T2/T3 是"表自洽"判据:解析器对真实形态漂了(如把 spread 能力读成空)必然以它们的
  // 假阳现身 —— 这三条对真表恒红就是判据坏,不随仓库债起落。
  // T4/T5 的条数**刻意不断言**:它们衡量的是仓库在途债务,把"此刻恰好为 0"钉进测试,
  // 下次存量出现反而会把镜像钉红(2026-09-27 的 T3a/T4 两红正是这条耦合的现世报)。
  const structural = res.red.filter((r) => /^T[123]\b/.test(r))
  assert.deepEqual(structural, [], `结构性判据对真表发红(判据与真实形态不匹配):\n${structural.join('\n')}`)
  // 所有红行必须是 T1–T5 已知族(冒出解不出的前缀 = 输出协议漂了)
  for (const r of res.red) assert.match(r, /^T[1-5]\b/, `红行不符族形: ${r}`)
})

test('T3b 阳性对照:抹掉一处 installHint ⇒ T1 必红', () => {
  const files = realInputs()
  const tableText = files[TABLE_REL]
  const mutated = tableText.replace(/installHint: '[^']*'/, "installHint: ''")
  assert.notEqual(mutated, tableText, '真表里没匹配到 installHint 字面量 ⇒ 夹具失效,本例无牙')
  const res = GATE.judgeTable({
    tableText: mutated,
    clientText: files[CLIENT_REL],
    otherFiles: Object.fromEntries(Object.entries(files).filter(([rel]) => rel !== TABLE_REL)),
  })
  assert.ok(res.red.some((r) => r.startsWith('T1') && r.includes('installHint')), `改掉一侧却没红:${res.red}`)
})

test('T3c 阳性对照:把同一扩展名登记进两门 ⇒ T2 必红', () => {
  const files = realInputs()
  const tableText = files[TABLE_REL]
  const parsed = GATE.parseLanguageTable(tableText)
  assert.ok(parsed.entries.length >= 2, '真表不足两门,无法构造两属')
  const stolen = parsed.entries[0].fileExtensions[0]
  const MARK = 'fileExtensions: ['
  const first = tableText.indexOf(MARK)
  const second = tableText.indexOf(MARK, first + 1)
  assert.ok(second > 0, '真表里找不到第二处 fileExtensions ⇒ 夹具失效')
  const mutated = `${tableText.slice(0, second + MARK.length)}'${stolen}', ${tableText.slice(second + MARK.length)}`
  const res = GATE.judgeTable({
    tableText: mutated,
    clientText: files[CLIENT_REL],
    otherFiles: Object.fromEntries(Object.entries(files).filter(([rel]) => rel !== TABLE_REL)),
  })
  assert.ok(res.red.some((r) => r.startsWith('T2')), `扩展名两属却没红:${res.red}`)
})

test('T3d 阳性对照:客户端整族不再提到某个请求种类 ⇒ T5 必红', () => {
  const files = realInputs()
  const clientText = files[CLIENT_REL]
  const kindsLiteral = GATE.extractArrayLiteral(files[TABLE_REL], 'LSP_REQUEST_KINDS') ?? ''
  const list = [...kindsLiteral.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1])
  assert.ok(list.length > 0, '真表里取不到 LSP_REQUEST_KINDS ⇒ 夹具失效(不得改用硬编码种类表)')
  const victim = list.find((k) => clientText.includes(k))
  assert.ok(victim, '真客户端里找不到任何请求种类 ⇒ 夹具失效')
  const mutated = clientText.split(victim).join('')
  const res = GATE.judgeTable({
    tableText: files[TABLE_REL],
    clientText: mutated,
    otherFiles: Object.fromEntries(Object.entries(files).filter(([rel]) => rel !== TABLE_REL)),
  })
  assert.ok(res.red.some((r) => r.startsWith('T5')), `能力投影被整族摘掉却没红:${res.red}`)
})

test('T3e 阳性对照:表外文件再写一遍服务器名 ⇒ T4 必红', () => {
  const files = realInputs()
  const parsed = GATE.parseLanguageTable(files[TABLE_REL])
  const binary = parsed.entries[0]?.candidates?.[0]?.binary
  assert.ok(binary, '真表取不到候选名 ⇒ 夹具失效')
  const otherRel = Object.keys(files).find((rel) => rel !== TABLE_REL && rel !== CLIENT_REL && rel.endsWith('.ts'))
  assert.ok(otherRel, '面上没有第三个源文件可注入 ⇒ 夹具失效')
  const otherFiles = { ...Object.fromEntries(Object.entries(files).filter(([rel]) => rel !== TABLE_REL)) }
  otherFiles[otherRel] = `${otherFiles[otherRel]}\nconst leakedBinaryName = '${binary}'\n`
  const res = GATE.judgeTable({ tableText: files[TABLE_REL], clientText: files[CLIENT_REL], otherFiles })
  assert.ok(res.red.some((r) => r.startsWith('T4')), `表外第二份真相却没红:${res.red}`)
})

test('T3f 空枚举必须判死,不得静默记绿', () => {
  const res = GATE.judgeTable({ tableText: '', clientText: '', otherFiles: {} })
  assert.ok(res.fatal !== null || res.red.length > 0, '空表既无 fatal 也无红 ⇒ 门瞎了')
})

test('T4 CLI 端到端(真实仓):两面旗同给 exit 2;各面必须判得出(0/1),永不 2;--self-test 绿', () => {
  const both = gate('--staged', '--worktree')
  assert.equal(both.status, 2, `两面旗同给却 exit ${both.status}\n${both.stdout}\n${both.stderr}`)

  const st = gate('--self-test')
  assert.equal(st.status, 0, `self-test 非零:\n${st.stdout}\n${st.stderr}`)
  assert.doesNotMatch(st.stdout, /❌/, `self-test 输出里有失败断言:\n${st.stdout}`)

  // 真实仓三档只锁"跑到判据并给出结论"(exit ∈ {0,1}),不锁结论本身 —— 结论由仓库债务
  // 决定(见 T3a 注释与 T6);exit 2 才意味着取材/判据故障。
  for (const args of [[], ['--staged'], ['--worktree']]) {
    const r = gate(...args)
    assert.ok(r.status === 0 || r.status === 1, `${args.join(' ') || '(全量)'} 期望判得出(0/1),实得 ${r.status}:\n${r.stdout}\n${r.stderr}`)
    assert.match(r.stdout, /T1–T5 全通过|处结构违规|新增 \d+ 处结构违规/, `${args.join(' ') || '(全量)'} 输出里没有可核对的结论行:\n${r.stdout}`)
  }
})

test('T6 棘轮双向锁(临时迷你仓):存量 --staged 不判红、新增必判红、全量档照旧判红', () => {
  // 为什么用临时仓而不是真仓 + 私有索引:真仓 HEAD 此刻存量已归零(2026-09-27 aa9000ac55
  // 清偿),"有存量 ⇒ 免检"这一臂在真仓上**无法构造**;而机制的正确性恰恰要求它可证。
  const dir = mkScratch('g-lsp-ratchet')
  try {
    // 1) 把门与它的最小依赖面(rep 根由脚本自身位置推导 ⇒ 拷进临时仓即换根)落位
    mkdirSync(join(dir, 'scripts', 'lib'), { recursive: true })
    copyFileSync(GATE_PATH, join(dir, 'scripts', 'check-lsp-language-table.mjs'))
    copyFileSync(join(ROOT, 'scripts', 'lib', 'face-reader.mjs'), join(dir, 'scripts', 'lib', 'face-reader.mjs'))
    copyFileSync(join(ROOT, 'scripts', 'lib', 'gitdir.mjs'), join(dir, 'scripts', 'lib', 'gitdir.mjs'))
    // 2) 夹具:一张自洽语言表 + 完整投影的客户端 + **一条已入库的 T4 存量**
    const write = (rel, body) => {
      const abs = join(dir, rel)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, body)
    }
    write(
      TABLE_REL,
      `export const LSP_REQUEST_KINDS = ['definition', 'hover'] as const
export const LSP_SERVERS = [
  {
    language: 'typescript',
    displayName: 'TypeScript',
    fileExtensions: ['.ts'],
    languageIds: { '.ts': 'typescript' },
    candidates: [
      { binary: 'typescript-language-server', args: ['--stdio'], versionArgs: ['--version'], installHint: 'pnpm add -g it', capabilities: ['definition', 'hover'] },
    ],
  },
]
`,
    )
    write(
      CLIENT_REL,
      `function buildClientCapabilities(kinds: string[]) { const has = (k: string) => kinds.includes(k); if (has('definition')) {} if (has('hover')) {} }\nexport { buildClientCapabilities }\n`,
    )
    write('apps/cli/src/tools/legacy-leak.ts', `export const legacyCmd = 'typescript-language-server'\n`)
    const git = (...args) =>
      execFileSync(
        GIT_BIN,
        ['-c', 'safe.directory=*', '-c', 'user.name=gate-probe', '-c', 'user.email=probe@local', '-C', dir, ...args],
        { encoding: 'utf8', windowsHide: true, timeout: 60_000 },
      ).trim()
    git('init', '-q')
    git('add', '--', TABLE_REL, CLIENT_REL, 'apps/cli/src/tools/legacy-leak.ts')
    git('commit', '-q', '-m', 'fixture: 带一条已入库 T4 存量的迷你仓')
    const scratchGate = join(dir, 'scripts', 'check-lsp-language-table.mjs')
    const run = (...args) => gate(...args, { script: scratchGate, cwd: dir })

    // A 臂(存量不因 --staged 判红):索引 == HEAD,唯一违规就是已入库的那条存量。
    const a = run('--staged')
    assert.equal(a.status, 0, `存量应当不判红,实得 exit ${a.status}:\n${a.stdout}\n${a.stderr}`)
    assert.match(a.stdout, /存量 1 处/, `--staged 绿的同时必须照报存量数(不得静默):\n${a.stdout}`)
    assert.doesNotMatch(a.stdout, /新增 \d+ 处结构违规/)
    // B 臂(全量档不套棘轮):同一份内容跑 HEAD 问责档 ⇒ 照旧判红并点名存量文件。
    const b = run()
    assert.equal(b.status, 1, `全量档对存量必须照旧判红(问责面),实得 exit ${b.status}:\n${b.stdout}`)
    assert.match(b.stdout, /T4 apps\/cli\/src\/tools\/legacy-leak\.ts/, `全量档红行没点名存量文件:\n${b.stdout}`)
    // C 臂(正向证明:新增一处重复必红,且不吞存量报数)。
    write('apps/cli/src/tools/new-leak.ts', `export const anotherCmd = 'typescript-language-server'\n`)
    git('add', '--', 'apps/cli/src/tools/new-leak.ts')
    const c = run('--staged')
    assert.equal(c.status, 1, `新增一条 T4 却绿了(棘轮把判据吞了):\n${c.stdout}\n${c.stderr}`)
    assert.match(c.stdout, /新增 1 处结构违规/, `没按"新增"口径报数:\n${c.stdout}`)
    assert.match(c.stdout, /apps\/cli\/src\/tools\/new-leak\.ts/, `没点名新增文件:\n${c.stdout}`)
    assert.match(c.stdout, /存量 1 处/, `存量报数不得因新增而消失:\n${c.stdout}`)
    // "存量不得被算进新增"只能在**新增清单那一段**里断言 —— 存量锚点行本来就带该路径,
    // 拿整段 stdout 断言 doesNotMatch 会误伤(这条断言自己先要过阳性对照)。
    const freshBlock = c.stdout.slice(c.stdout.indexOf('新增 1 处结构违规'), c.stdout.indexOf('⚠️ 存量'))
    assert.ok(freshBlock.includes('new-leak.ts') && !freshBlock.includes('legacy-leak'), `新增清单切分不对:\n${freshBlock}`)
  } finally {
    rmScratch(dir)
  }
})
