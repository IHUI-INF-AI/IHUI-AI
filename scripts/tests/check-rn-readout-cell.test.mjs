#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 测试档需输出逐例读数 */
/**
 * check-rn-readout-cell.mjs 的镜像测试(守门 241)。
 *
 * 判据单一真源在源脚本,本档只 import `__test__`,不复制任何判据实现(AGENTS §0.6)。
 * 每条判据都配「摘掉即翻红」的反向夹具 —— 只有正向用例的测试等于没测。
 *
 * 跑法:node scripts/tests/check-rn-readout-cell.test.mjs
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SRC = resolve(ROOT, 'scripts', 'check-rn-readout-cell.mjs')
const { __test__ } = await import(`file://${SRC.replace(/\\/g, '/')}`)
const { analyze, inScope } = __test__

let pass = 0
let fail = 0
function it(name, fn) {
  try {
    fn()
    pass += 1
    console.log(`✓ ${name}`)
  } catch (e) {
    fail += 1
    console.log(`✗ ${name}\n    ${e?.message ?? e}`)
  }
}
function eq(actual, expected, what) {
  if (actual !== expected) throw new Error(`${what}: 期望 ${expected},实得 ${actual}`)
}

// 夹具:StyleSheet 定义 + 一段 JSX。**必须带分号**——无分号时 `})` 紧跟 `<View` 会被 TS
// 解析成比较运算,JSX 整段消失(这是夹具形态要求,不是判据漏洞)。
const SHEET = `
  const s = StyleSheet.create({
    row: { flexDirection: 'row' },
    cell: { flex: 1 },
    val: { fontSize: 20, fontWeight: '700' },
    rowW: { flexDirection: 'row', flexWrap: 'wrap' },
    cellW: { flex: 1, minWidth: 112 },
    small: { fontSize: 11 },
  });`
const jsx = (row, cell, body) => `<View style={s.${row}}><View style={s.${cell}}>${body}</View></View>`
const TEXT = (style, body) => `<Text style={s.${style}}>${body}</Text>`
const run = (body) => analyze(SHEET + body)

it('V1:格无 minWidth ⇒ 报「读数被等分压缩」', () => {
  const r = run(jsx('row', 'cell', TEXT('val', '{info.totalDays}')))
  eq(r.triples.length, 1, '三元组枚数')
  eq(r.violations.length, 1, '违规枚数')
  if (!/minWidth/.test(r.violations[0].why)) throw new Error(`why 未点名 minWidth:${r.violations[0].why}`)
})

it('V2:格有 minWidth 但行无 flexWrap ⇒ 报「溢出而非换行」', () => {
  const r = run(jsx('row', 'cellW', TEXT('val', '{info.totalDays}')))
  eq(r.violations.length, 1, '违规枚数')
  if (!/flexWrap/.test(r.violations[0].why)) throw new Error(`why 未点名 flexWrap:${r.violations[0].why}`)
})

it('完整修法(行 flexWrap + 格 minWidth)⇒ 不报', () => {
  const r = run(jsx('rowW', 'cellW', TEXT('val', '{info.totalDays}')))
  eq(r.triples.length, 1, '三元组仍要记(证明不是靠认不出而变绿)')
  eq(r.violations.length, 0, '违规枚数')
})

it('反向锁:只加 flexWrap 不算修好(flex:1 的 flexBasis 是 0,wrap 永不触发)', () => {
  const r = run(jsx('rowW', 'cell', TEXT('val', '{info.totalDays}')))
  eq(r.violations.length, 1, '违规枚数')
})

it('小字号不算读数', () => {
  const r = run(jsx('row', 'cell', TEXT('small', 'x')))
  eq(r.violations.length, 0, '违规枚数')
  eq(r.triples.length, 0, '三元组枚数')
})

it('i18n 文案不算读数(key 里带 count 也不行)', () => {
  // 反向锁:词表若不去掉字符串字面量,`connectedAccounts` 里的 "count" 会把纯标题判成读数。
  const r = run(jsx('row', 'cell', TEXT('val', "{t('connectedAccounts.title')}")))
  eq(r.violations.length, 0, '违规枚数')
})

it('标题属性(item.title)不算读数', () => {
  const r = run(jsx('row', 'cell', TEXT('val', '{item.title}')))
  eq(r.violations.length, 0, '违规枚数')
})

it('判不出的形态进未判定,不冒红也不算绿', () => {
  const r = run(jsx('row', 'cell', TEXT('val', '{item.targetId}')))
  eq(r.violations.length, 0, '违规枚数')
  eq(r.unjudged.length >= 1, true, '应进未判定')
})

it('读数表达式写成格式化函数(yuan(...))仍要报', () => {
  const r = run(jsx('row', 'cell', TEXT('val', '{yuan(info.totalCommission)}')))
  eq(r.violations.length, 1, '违规枚数')
})

it('真实仓库存量必须归零(整族不变量,不是逐处形状锁)', () => {
  const files = execFileSync('git', ['-c', 'core.quotePath=false', 'ls-files'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter((f) => inScope(f))
  if (files.length < 500) throw new Error(`射程文件只取到 ${files.length} 枚,取材面异常 ⇒ 未判定`)
  const bad = []
  for (const f of files) {
    let r
    try {
      r = analyze(readFileSync(resolve(ROOT, f), 'utf8'))
    } catch {
      continue
    }
    for (const v of r.violations) bad.push(`${f}:${v.line} ${v.row}/${v.cell} — ${v.why}`)
  }
  eq(bad.length, 0, `端侧等分读数格缺口\n      ${bad.slice(0, 5).join('\n      ')}`)
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
