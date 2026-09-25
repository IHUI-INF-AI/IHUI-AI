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
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

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

test('T3 棘轮锚点四向:只拦"把绕档加回来",存量与新文件各按定义处置', () => {
  assert.equal(gate.exceedsAnchor(1, 0), true, '新文件(HEAD 锚点 0)出现违规必须红')
  assert.equal(gate.exceedsAnchor(1, 1), false, '与 HEAD 齐平不得红(存量 102 个不许一次改红)')
  assert.equal(gate.exceedsAnchor(0, 1), false, '清理存量必须绿')
  assert.equal(gate.exceedsAnchor(5, 5), false, '同数不同内容也不红 —— 锚点是计数不是指纹')
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
