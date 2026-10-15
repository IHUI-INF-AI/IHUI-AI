// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:scripts/check-sheet-flex-contract.mjs(§22c 端到端 —— --src 注入 fixture,落点走 §26 scratch)。
 *
 * 该守门脚本自身曾有 5 个连环 bug 造成「假 OK」(2026-10-15 修复),本文件逐钉回归:
 *  ① 小写 styles\. 漏匹配 shellStyles.(大小写)→ T6
 *  ②③ 双正则同步扫描丢 close token → 深度只增不减 → findBlockEnd 永远 -1 → 全量漏检 → T4b
 *  ④ 自闭合 <View /> 误计为开标签 → 块越界吞进相邻弹窗 → T4a
 *     (钉法要点:误吞本身不产生新违规 —— 列表的契约/豁免判定与所在块无关 —— 唯一让它
 *      翻面的是 isMaxH 分支:自约束业务组件在「定高块」里豁免、被 maxHeight 块误吞后判违规)
 *  ⑤ 多 StyleSheet 同名键 Map 覆盖 → bounded 判定翻转 → 漏检 → T5(前缀隔离键空间)
 * 另加接线锁:门 214 注册进 guardian-runner(防摘线/降级/撞号;原 213 已让位给盘根写入门)+ package.json check:sheet-flex
 * 一键入口(防"造好没装车")。
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOOL = join(HERE, '..', 'check-sheet-flex-contract.mjs')
const RUNNER = join(HERE, '..', 'guardian-runner.mjs')
const PKG = join(HERE, '..', '..', 'package.json')

// 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
const runOpts = { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', windowsHide: true, timeout: 60_000, maxBuffer: 64 << 20 }

/** 写 fixture.tsx 到 scratch 目录并以 --src 注入运行守门(§26:临时落点,用完即焚)。 */
function runOnFixture(t, body) {
  const dir = mkScratch('sfc-')
  t.after(() => rmScratch(dir))
  writeFileSync(join(dir, 'fixture.tsx'), body, 'utf8')
  return spawnSync(process.execPath, [TOOL, '--src', join(dir, 'fixture.tsx')], runOpts)
}

const violationCount = (stderr) => String(stderr || '').split('\n').filter((l) => l.includes('✗')).length

test('T1 bounded 容器内裸列表 ⇒ 违规(阳性对照:判据有牙,不许恒绿)', (t) => {
  const r = runOnFixture(t, [
    'const styles = {',
    "  sheet: { maxHeight: '70%' },",
    '}',
    'export function Sheet() {',
    '  return (',
    '    <View style={styles.sheet}>',
    '      <SectionList />',
    '    </View>',
    '  )',
    '}',
    '',
  ].join('\n'))
  assert.equal(r.status, 1, `裸列表必须判违规:${r.stdout}|${r.stderr}`)
  assert.match(r.stderr, /fixture\.tsx:\d+/, '违规行要点名文件与行号')
  assert.match(r.stderr, /「styles\.sheet」内 <SectionList>/, '违规行要点名容器键与列表组件')
})

test('T2 style flex:1 ⇒ 通过(唯一弹性块契约成立)', (t) => {
  const r = runOnFixture(t, [
    'const styles = {',
    "  sheet: { maxHeight: '70%' },",
    '}',
    'export function Sheet() {',
    '  return (',
    '    <View style={styles.sheet}>',
    '      <SectionList style={{ flex: 1 }} />',
    '    </View>',
    '  )',
    '}',
    '',
  ].join('\n'))
  assert.equal(r.status, 0, `flex:1 契约必须放行:${r.stdout}|${r.stderr}`)
})

test('T3 sheet-flex-ok 豁免 ⇒ 通过(例外出路不得被堵死)', (t) => {
  const r = runOnFixture(t, [
    'const styles = {',
    "  sheet: { maxHeight: '70%' },",
    '}',
    'export function Sheet() {',
    '  return (',
    '    <View style={styles.sheet}>',
    '      {/* sheet-flex-ok: 横向分页轮播,数据天然有限 */}',
    '      <FlatList horizontal />',
    '    </View>',
    '  )',
    '}',
    '',
  ].join('\n'))
  assert.equal(r.status, 0, `豁免注释必须放行:${r.stdout}|${r.stderr}`)
})

test('T4a 自闭合 <View /> 不得让 maxHeight 块越界吞进相邻定高弹窗(bug④回归:误吞 ⇒ isMaxH 翻面 ⇒ 多报)', (t) => {
  const r = runOnFixture(t, [
    'const styles = {',
    "  sheetMax: { maxHeight: '70%' },",
    '  sheetFix: { height: 400 },',
    '}',
    'export function TwoSheets() {',
    '  return (',
    '    <View>',
    '      <View style={styles.sheetMax}>',
    '        <View><View /></View>',
    '      </View>',
    '      <View style={styles.sheetFix}>',
    '        <MaterialList />',
    '      </View>',
    '    </View>',
    '  )',
    '}',
    '',
  ].join('\n'))
  // 正确:自约束业务组件(MaterialList)在定高容器里豁免 → 0 违规;
  // bug④(自闭合计成开标签)会把第一块的终点推过第二个弹窗 → ModelList 被 maxHeight 块误吞 → 判违规。
  assert.equal(r.status, 0, `自闭合 View 之后块必须在自己弹窗内闭合:${r.stdout}|${r.stderr}`)
})

test('T4b 嵌套自闭合之下块必须正确闭合(bug②③回归:token 流断掉 ⇒ end=-1 ⇒ 真违规漏检假 OK)', (t) => {
  const r = runOnFixture(t, [
    'const styles = {',
    "  sheetMax: { maxHeight: '70%' },",
    '}',
    'export function Sheet() {',
    '  return (',
    '    <View>',
    '      <View style={styles.sheetMax}>',
    '        <View><View /></View>',
    '        <MaterialList />',
    '      </View>',
    '    </View>',
    '  )',
    '}',
    '',
  ].join('\n'))
  // 自约束组件在 maxHeight 容器里不豁免(R2) → 必须报 1 条;块闭合失败(end=-1)会把它整个漏掉。
  assert.equal(r.status, 1, `块闭合失败 ⇒ MaterialList 漏检:${r.stdout}|${r.stderr}`)
  assert.equal(violationCount(r.stderr), 1, '恰好 1 条(该 MaterialList 无 style 契约)')
  assert.match(r.stderr, /<MaterialList>/)
})

test('T5 两个 StyleSheet 同名键必须前缀隔离(bug⑤回归:Map 覆盖 ⇒ bounded 判定翻转 ⇒ 漏检)', (t) => {
  const r = runOnFixture(t, [
    'const styles = {',
    "  container: { maxHeight: '60%' },",
    '  card: { height: 200 },',
    '}',
    'const shellStyles = {',
    '  container: { flex: 1, backgroundColor: "#eee" },',
    '}',
    'export function A() {',
    '  return (',
    '    <View style={styles.container}>',
    '      <SectionList />',
    '    </View>',
    '  )',
    '}',
    'export function B() {',
    '  return (',
    '    <View style={styles.card}>',
    '      <FlatList />',
    '    </View>',
    '  )',
    '}',
    '',
  ].join('\n'))
  assert.equal(r.status, 1, `${r.stdout}|${r.stderr}`)
  assert.match(r.stderr, /「styles\.container」/, '同名键被 shellStyles.container 覆盖回归 ⇒ container 违规消失')
  assert.match(r.stderr, /「styles\.card」/, 'card 是独立键,必须同时检出')
})

test('T6 shellStyles(大写 S)+ StyleSheet.create 写法必须被检出(bug①回归)', (t) => {
  const r = runOnFixture(t, [
    "import { StyleSheet } from 'react-native'",
    'const shellStyles = StyleSheet.create({',
    "  sheet: { maxHeight: '70%' },",
    '})',
    'export function Sheet() {',
    '  return (',
    '    <View style={shellStyles.sheet}>',
    '      <SectionList />',
    '    </View>',
    '  )',
    '}',
    '',
  ].join('\n'))
  assert.equal(r.status, 1, `${r.stdout}|${r.stderr}`)
  assert.match(r.stderr, /「shellStyles\.sheet」/, '大写 shellStyles 前缀不得隐身')
})

test('T7 --src 缺路径参数 ⇒ exit 2(用法错,与业务违规 1 分开)', () => {
  const r = spawnSync(process.execPath, [TOOL, '--src'], runOpts)
  assert.equal(r.status, 2)
  assert.match(r.stderr, /--src/)
})

test('T8 接线锁:门 214 注册在 guardian-runner(blocking + stagedTriggers,恰好一次)', () => {
  const lines = readFileSync(RUNNER, 'utf8').split('\n')
  const at = lines.findIndex((l) => l.includes("script: 'check-sheet-flex-contract.mjs'"))
  assert.ok(at >= 0, 'check-sheet-flex-contract 未注册进 guardian-runner —— 守门被摘线')
  assert.equal(
    lines.filter((l) => l.includes("script: 'check-sheet-flex-contract.mjs'")).length,
    1,
    '同一 script 不得注册两次',
  )
  const block = lines.slice(Math.max(0, at - 4), at + 5).join('\n')
  assert.match(block, /id: '214'/, '门号漂移会让下一次取号撞号(原 213 已让位给盘根写入门)')
  assert.match(block, /mode: 'blocking'/, '必须是 blocking(pre-commit 阻断),不许被降级成 warn')
  assert.match(block, /stagedTriggers: \['apps\/mobile-rn\/src\/'\]/, '触发面必须圈住 mobile-rn/src(数组形态,裸串会让链崩)')
})

test('T9 接线锁:package.json 有 check:sheet-flex 一键入口(防"造好没装车")', () => {
  const pkg = JSON.parse(readFileSync(PKG, 'utf8'))
  assert.equal(pkg.scripts['check:sheet-flex'], 'node scripts/check-sheet-flex-contract.mjs')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
