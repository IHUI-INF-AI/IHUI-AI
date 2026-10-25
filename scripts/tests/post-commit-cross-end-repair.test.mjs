#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 测试需逐条打印用例结论 */

/**
 * 「台账→代码 对账修复器」装车的接线锁(2026-10-25 立)。
 *
 * 锁的是哪一格:器物 scripts/repair-cross-end-mirror.mjs 造完后若**无人调用**,它就只是
 * 一个"能跑的工具",不是"会自己修的链路"(AGENTS §0.9「造好没装车 = 没有」)。
 * 本仓多会话共享工作区,并发旧基线提交会静默把这条腿写回"没有"(同型事故:自动登记腿),
 * 所以装车必须有锁。
 *
 * 锁的形状(只判**接线形态**,不判运行时行为 —— 运行时物证在
 * `.ihui-agent/state/cross-end-autoreg.json` 的 lastHits.repair* 与
 * `.ihui-agent/state/hook-logs/post-commit-cross-end-autoreg.log` 的修复器分节块):
 * ① 器物路径常量在位,且指向真实文件(不许硬写第二处路径);
 * ② 器物真被同一腿派发器以 --apply 调起(同腿第二跑);
 * ③ 修复结论独立回写(lastHits.repairApplied/repairRefused/repairFindings/repairOk),
 *    且**不许**改写第一条腿的结论;
 * ④ 本腿绝不落库(不出现 git add / git commit / update-ref 等);
 * ⑤ 成对反控:摘掉锚点后同一把尺子必须读出缺项(防本锁空转)。
 *
 * 比对一律先剥整行注释再折叠空白(本仓 prettier/eslint 会折行,按原始缩进比会造假红)。
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const HOOK_PATH = join(ROOT, 'scripts', 'lib', 'post-commit-hook.js')
const SCRIPT_REL = 'scripts/repair-cross-end-mirror.mjs'
const SCRIPT_PATH = join(ROOT, ...SCRIPT_REL.split('/'))

const HOOK_RAW = existsSync(HOOK_PATH) ? readFileSync(HOOK_PATH, 'utf8') : ''
const norm = (s) => String(s).replace(/\s+/g, ' ')
const HOOK = norm(HOOK_RAW)
const stripLineComments = (text) =>
  text
    .split(/\r?\n/)
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')
/**
 * 取样面 —— R2/R3 锁的锚点**就在**派发器源码常量那一数组里
 * (父侧 spawn 的实参在钩子正文,子侧的 "--apply" 调用在派发器数组内),
 * 所以这里**不能**把该数组抠掉:抠掉它就把要锁的东西一起抠没了(本锁第一版就是这么写成永红的)。
 */
const legFullOf = (src) => {
  const i = src.indexOf('跨端登记自动链路')
  if (i < 0) return ''
  return norm(stripLineComments(src.slice(i)))
}

const results = []
const test = (name, fn) => results.push({ name, fn })

test('R1 器物路径常量在位且指向真实文件(不许第二处硬写路径)', () => {
  const m = /const CROSS_END_REPAIR_SCRIPT = '([^']+)'/.exec(HOOK)
  assert.ok(m, '缺 CROSS_END_REPAIR_SCRIPT 常量 ⇒ 派发器拼不出真实路径')
  assert.equal(m[1].replace(/\\/g, '/'), SCRIPT_REL, '修复器路径被改写 ⇒ 请连同本锁一起改并说明为什么')
  assert.ok(existsSync(SCRIPT_PATH), `器物 ${SCRIPT_REL} 不在位 ⇒ 本腿每次都会派生一个必死的孩子`)
})

test('R2 器物真被同一腿派发器以 --apply 调起(同腿第二跑)', () => {
  const leg = legFullOf(HOOK_RAW)
  assert.match(leg, /repairScript/, '派发器里没有 repairScript 形参 ⇒ 修复器根本没被调起')
  assert.match(leg, /\[repairScript, "--apply"\]/, '修复器必须带 --apply(预演档一行都不写盘 = 没修)')
  assert.match(leg, /CROSS_END_REPAIR_SCRIPT,/, '父侧 spawn 实参里没有传修复器路径 ⇒ 形参永远 undefined')
})

test('R3 修复结论独立回写,不改写第一条腿的结论', () => {
  const leg = legFullOf(HOOK_RAW)
  for (const key of ['repairApplied', 'repairRefused', 'repairFindings', 'repairOk']) {
    assert.ok(leg.includes(key), `lastHits 缺 ${key} ⇒ 修复器的结论无处可查(§0.3:不许用编造的数冒"量到了")`)
  }
  assert.match(leg, /const rok = !rr\.error && rr\.status === 0/, '修复腿的成败必须独立判定,不许沿用第一条腿的 ok')
  assert.match(leg, /const out = /, '第一条腿的输出变量必须原样保留')
})

test('R4 本腿绝不落库(区间内剥注释后无 git 写操作)', () => {
  const leg = stripLineComments(HOOK_RAW.slice(HOOK_RAW.indexOf('跨端登记自动链路')))
  for (const forbidden of [/git add/, /git commit/, /commit-tree/, /update-ref/, /safe-commit/]) {
    assert.ok(!forbidden.test(leg), `本腿出现了 ${forbidden} —— 落库唯一出口是收编器;自行 add/commit 就是叠提交`)
  }
})

test('R5 修复器认得 --apply 且有自测出口(跑不通的出路不算装车,§0.8)', () => {
  const body = readFileSync(SCRIPT_PATH, 'utf8')
  assert.match(body, /--apply/, '器物不认 --apply 旗 ⇒ 本腿的命令是跑不通的出路')
  assert.match(body, /--self-test/, '器物没有自测出口 ⇒ 判据失灵时无人能证')
})

test('R6 成对反控:摘掉锚点后同一把尺子必须读出缺项(防本锁空转)', () => {
  const noConst = HOOK_RAW.replace(/const CROSS_END_REPAIR_SCRIPT = '[^']+'/, 'const CROSS_END_REPAIR_SCRIPT = undefined')
  assert.doesNotMatch(legFullOf(noConst), /const CROSS_END_REPAIR_SCRIPT = '[^']+'/, '摘掉常量后尺子仍读出 ⇒ 本锁判不出"腿被摘走"')
  const noArg = HOOK_RAW.replace(/CROSS_END_REPAIR_SCRIPT,\s*\n\s*\]/, ']')
  assert.doesNotMatch(legFullOf(noArg), /CROSS_END_REPAIR_SCRIPT,/, '摘掉实参后尺子仍读出 ⇒ 派发实参没有被锁住')
  const noApply = HOOK_RAW.replace(/\[repairScript, "--apply"\]/, '[repairScript]')
  assert.doesNotMatch(legFullOf(noApply), /\[repairScript, "--apply"\]/, '摘掉 --apply 后尺子仍读出 ⇒ 修复腿的写盘闸没被锁住')
})

let failed = 0
for (const { name, fn } of results) {
  try {
    fn()
    console.log(`✅ ${name}`)
  } catch (e) {
    failed++
    console.log(`❌ ${name}\n   ${e && e.message ? e.message : e}`)
  }
}
console.log(`\n${results.length - failed}/${results.length} 通过`)
process.exit(failed === 0 ? 0 : 1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
