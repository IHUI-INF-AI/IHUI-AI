#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 测试文件需 console 输出 */
/**
 * 守门 244(check-readout-and-timer-hygiene.mjs)的镜像测试。
 *
 * §22c:判据只有一份,住在门体 `__test__` 导出里;本文件不得复制正则或另写配平。
 * 三件事:① 成对夹具(每条豁免都配一枚"摘掉即翻红"的反向锁);② 形状锁(注册条目
 * blocking + skipEnv + 射程成套,读 runner 现值);③ 覆盖面自锁(括号配平复用全仓那台
 * 分词器,自带一份必然漂移)。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as G } from '../check-readout-and-timer-hygiene.mjs'
import { maskCommentsAndStrings } from '../lib/code-mask.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const cases = []
const ok = (name, cond) => cases.push({ name, pass: Boolean(cond) })

// —— D1:定时器句柄被覆盖 ——
const coverBad = `  const start = () => {
    pollRef.current = setInterval(() => tick(), 1000)
  }`
const coverGood = `  const start = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(() => tick(), 1000)
  }`
ok('D1 命中:起新之前没停旧', G.findOverwrittenIntervalHandles(coverBad).length === 1)
ok('D1 放过:先停再起', G.findOverwrittenIntervalHandles(coverGood).length === 0)
const helperGood = `  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }
  const start = () => {
    stopPoll()
    pollRef.current = setInterval(() => tick(), 1000)
  }`
ok('D1 认可一跳可验的具名停止函数', G.findOverwrittenIntervalHandles(helperGood).length === 0)
const helperWrongTarget = helperGood.replace('clearInterval(pollRef.current)', 'clearInterval(otherRef.current)')
ok('D1 不认"清了别的句柄"的停止函数', G.findOverwrittenIntervalHandles(helperWrongTarget).length === 1)
ok(
  'D1 注释里的 clearInterval 不算数(与生产同口径先遮罩)',
  G.findOverwrittenIntervalHandles(
    maskCommentsAndStrings(`  const start = () => {
    // clearInterval(pollRef.current) 曾经在这里
    pollRef.current = setInterval(() => tick(), 1000)
  }`),
).length === 1,
)

// —— D2:零分母读数 ——
const propsDiv = `export const Bar = ({ data }: { data: number[] }) => {
  const barW = chartW / data.length
  return barW
}`
ok('D2 命中:props 数组可能为空', G.findUnguardedLengthDivisors(propsDiv).length === 1)
ok(
  'D2 放过三元守卫',
  G.findUnguardedLengthDivisors('  const avg = rows.length ? sum / rows.length : null').length === 0,
)
ok(
  'D2 放过 >0 守卫',
  G.findUnguardedLengthDivisors('  const avg = data.length > 0 ? sum / data.length : null').length === 0,
)
ok(
  'D2 不被"守了另一个变量"骗过',
  G.findUnguardedLengthDivisors('  const avg = rows.length > 0 ? sum / columns.length : null').length === 1,
)
ok(
  'D2 认得出对象字面量外一层的早退守卫',
  G.findUnguardedLengthDivisors(
    `  const memo = React.useMemo(() => {
    if (steps.length === 0) return { pct: 0 }
    const done = steps.filter((s) => s.ok).length
    return { pct: (done / steps.length) * 100 }
  }, [steps])`,
  ).length === 0,
)

// 豁免一:字面量非空数组常量(模块层带类型标注 / 同块内声明)
const typedConst = `const LABELS: Array<{ key: string }> = [{ key: 'a' }]
function Radar() {
  const step = (Math.PI * 2) / LABELS.length
  return step
}`
ok('D2 放过模块层带类型标注的非空常量数组', G.findUnguardedLengthDivisors(typedConst).length === 0)
ok(
  'D2 不放过空字面量(摘掉元素即翻红)',
  G.findUnguardedLengthDivisors(typedConst.replace("= [{ key: 'a' }]", '= []')).length === 1,
)
const localLiteral = `function Chart() {
  const data = [1, 2]
  return chartW / data.length
}`
ok('D2 放过同块内字面量非空数组', G.findUnguardedLengthDivisors(localLiteral).length === 0)
const shadowed = `const SERIES: number[] = [1, 2]
function Chart({ points }) {
  const SERIES = points
  return chartW / SERIES.length
}`
ok('D2 内层同名重绑会作废外层豁免', G.findUnguardedLengthDivisors(shadowed).length === 1)

// 豁免二:循环边界(基数为 0 时循环体一次都不执行)
const loopBound = `  for (let i = 0; i < nodes.length; i++) {
    const angle = (i / nodes.length) * Math.PI * 2
  }`
ok('D2 认得出循环边界守卫', G.findUnguardedLengthDivisors(loopBound).length === 0)
ok('D2 循环头不再量同一个 length 即翻红', G.findUnguardedLengthDivisors(loopBound.replace('i < nodes.length', 'i < 10')).length === 1)

// —— 形状锁:装车证明读 runner 现值 ——
const runner = readFileSync(path.join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
const at = runner.indexOf("id: '244'")
const entry = at < 0 ? null : runner.slice(at, runner.indexOf('\n  },', at))
ok('244 已登记进 runner', Boolean(entry) && entry.length > 80)
ok('244 mode blocking 在位', Boolean(entry) && /mode:\s*'blocking'/.test(entry))
ok('244 skipEnv 成套', Boolean(entry) && /HUSKY_SKIP_READOUT_AND_TIMER_HYGIENE/.test(entry))
ok('244 射程含 apps/web/ 与 packages/', Boolean(entry) && /apps\/web\//.test(entry) && /packages\//.test(entry))

// —— 覆盖面自锁:分词/配平复用全仓唯一那台 ——
const gate = readFileSync(path.join(ROOT, 'scripts', 'check-readout-and-timer-hygiene.mjs'), 'utf8')
ok('门体 import 复用 batch-write-lexer 的 closeBrace', /from '\.\/lib\/batch-write-lexer\.mjs'/.test(gate) && gate.includes('closeBrace'))
ok('门体不得自带括号配平实现', !/function\s+closeParen|function\s+closeBrace/.test(gate))
ok('门体自带 --self-test 且覆盖主判定', /--self-test/.test(gate) && /selfTest/.test(gate))
ok('两面旗同给落未判定(§0.4)', /两面旗同给/.test(gate))
ok('取材失败不记绿', /取不到/.test(gate) && /return 2/.test(gate))

let rc = 0
for (const c of cases) {
  console.log(`${c.pass ? '✅' : '❌'} ${c.name}`)
  if (!c.pass) rc = 1
}
console.log(`mirror ${cases.filter((c) => c.pass).length}/${cases.length}`)
process.exit(rc)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
