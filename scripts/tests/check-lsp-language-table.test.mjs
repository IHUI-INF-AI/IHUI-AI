#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 *     T4 **CLI 端到端**:两面旗同给必须 exit 2;`--worktree` 对现仓必须 exit 0。
 *
 * 为什么真内容走 worktree 面而不是 HEAD:本门与它审的两份源文件此刻**尚未入库**
 * (`git ls-files apps/cli/src/lsp` 为空),HEAD 面必然"取不到 ⇒ exit 2 无法判定"。
 * 这是判据设计在生效,不是故障;入库后本文件仍按 worktree 取(它只要求"现读真实形态",
 * 不要求特定面),而 T4 的第二条会在入库后继续盯 HEAD 档。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as GATE, TABLE_REL, CLIENT_REL, readFaceInputs } from '../check-lsp-language-table.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE_PATH = join(ROOT, 'scripts/check-lsp-language-table.mjs')
const GATE_SRC = readFileSync(GATE_PATH, 'utf8')
const RUNNER_SRC = readFileSync(join(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
const SELF_SRC = readFileSync(fileURLToPath(import.meta.url), 'utf8')
const SKIP_ENV = 'HUSKY_SKIP_LSP_LANGUAGE_TABLE'

/** 真仓内容只读一次(测试之间不可互相污染,但读盘一次足够)。 */
let real = null
function realInputs() {
  if (!real) real = readFaceInputs(ROOT, 'worktree')
  return real
}

function gate(...args) {
  return spawnSync(process.execPath, [GATE_PATH, ...args], {
    cwd: ROOT,
    encoding: 'utf-8',
    windowsHide: true,
    timeout: 180_000,
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

test('T3a 真表 + 真客户端 ⇒ 零红(判据对现仓真实形态不误伤)', () => {
  const files = realInputs()
  const tableText = files[TABLE_REL]
  const clientText = files[CLIENT_REL]
  assert.ok(tableText && clientText, '真仓取不到语言表/客户端 ⇒ 本用例失去意义,必须失败而非跳过')
  const otherFiles = Object.fromEntries(Object.entries(files).filter(([rel]) => rel !== TABLE_REL))
  const res = GATE.judgeTable({ tableText, clientText, otherFiles })
  assert.equal(res.fatal, null, `真仓 fatal:${res.fatal}`)
  assert.deepEqual(res.red, [], `真仓被判红(现仓形态与本判据不匹配):\n${res.red.join('\n')}`)
  assert.ok(res.counts.entries >= 5, `真表项数 ${res.counts.entries} 偏低 ⇒ 解析器可能又漂了`)
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

test('T4 CLI 端到端:两面旗同给 exit 2;--self-test 与 --worktree 各 exit 0', () => {
  const both = gate('--staged', '--worktree')
  assert.equal(both.status, 2, `两面旗同给却 exit ${both.status}\n${both.stdout}\n${both.stderr}`)

  const st = gate('--self-test')
  assert.equal(st.status, 0, `self-test 非零:\n${st.stdout}\n${st.stderr}`)
  assert.doesNotMatch(st.stdout, /❌/, `self-test 输出里有失败断言:\n${st.stdout}`)

  const wt = gate('--worktree')
  assert.equal(wt.status, 0, `--worktree 对现仓必须 exit 0:\n${wt.stdout}\n${wt.stderr}`)
  assert.match(wt.stdout, /T1–T5 全通过/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
