#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 测试档需输出逐例读数 */
/**
 * 端侧「一格一读数」形状锁(RN / 共享源)。
 *
 * 为什么只有形状锁、没有通用端侧门:实测扫 packages/app + mobile-rn + miniapp-taro 的扁平
 * StyleSheet,得到 638 处「fontSize≥16 且 fontWeight 600/700 无 minWidth」——
 * 其中绝大多数是**标题**不是读数,而"这个 style 是不是住在等分读数格里"只有 JSX 父子关系
 * 才知道,扁平正则判不出。硬造一道门 = 造 638 枚假红(§12e 那种红只会逼人 --no-verify),
 * 所以端侧只钉"已修的这几处不得回退",覆盖面缺口如实登记在 PROJECT_PLAN。
 *
 * 跑法:node scripts/tests/rn-readout-cell-guard.test.mjs
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')

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
function eq(a, b, what) {
  if (a !== b) throw new Error(`${what}: 期望 ${b},实得 ${a}`)
}

/** 取 StyleSheet 里某个 style 对象的体(扁平对象,不支持嵌套)。 */
export function styleBody(text, name) {
  const re = new RegExp(`\\b${name}:\\s*\\{([^{}]*)\\}`, 'g')
  const hits = [...text.matchAll(re)]
  return hits.length ? hits[hits.length - 1][1] : null
}

/**
 * 读数格的一对样式:父行必须允许换行,子格必须有最小宽。
 * 两者缺一都会把"整格换行"退化成"数字被切成两半"(AGENTS §4 / UI_GUIDELINES §13)。
 */
export function checkCellPair(text, rowName, itemName) {
  const row = styleBody(text, rowName)
  const item = styleBody(text, itemName)
  if (row === null || item === null)
    return { status: 'unjudged', reason: `${row === null ? rowName : itemName} 取不到样式体` }
  const wrap = /flexWrap/.test(row)
  const mw = item.match(/minWidth:\s*(\d+(?:\.\d+)?)/)
  if (wrap && mw) return { status: 'ok', minWidth: Number(mw[1]) }
  return { status: 'red', wrap, minWidth: mw ? Number(mw[1]) : null }
}

/**
 * 读数元素上不得挂 numberOfLines(= 把数字截成省略号,违反 §13)。
 * 只判 `<Text … styles.<styleRef> …>` 这一个元素:整文件正则会命中注释里的同名字样
 * (本档第一版就被自己写的注释绊过一次)。
 */
export function checkNoTruncation(text, styleRef = 'cardValue') {
  const re = new RegExp(`<Text[^>]*styles\\.${styleRef}\\b[^>]*>`, 'g')
  const hits = [...text.matchAll(re)]
  if (hits.length === 0) return { status: 'unjudged', reason: `找不到引用 styles.${styleRef} 的 Text 元素` }
  const bad = hits.filter((h) => /numberOfLines/.test(h[0]))
  return bad.length ? { status: 'red', n: bad.length } : { status: 'ok', n: hits.length }
}

const read = (p) => readFileSync(resolve(ROOT, p), 'utf8')
const INCOME = 'packages/app/src/features/income/IncomeScreen.tsx'
const USAGE = 'packages/app/src/features/usage/UsageScreen.tsx'
const DASH = 'packages/app/src/features/dashboard/DashboardScreen.tsx'

it('IncomeScreen 汇总行:flexWrap + 每格 minWidth(3 等分曾把「¥999999.99」切成两行)', () => {
  const d = checkCellPair(read(INCOME), 'summaryRow', 'summaryItem')
  eq(d.status, 'ok', `wrap/minWidth=${d.wrap}/${d.minWidth}`)
  if (d.minWidth < 110) throw new Error(`minWidth ${d.minWidth} < 20px 下 10 字符读数的单行宽 110`)
})

it('UsageScreen 配额行与统计行同锁', () => {
  for (const [row, item] of [
    ['quotaRow', 'quotaCell'],
    ['statsGrid', 'statCell'],
  ]) {
    const d = checkCellPair(read(USAGE), row, item)
    eq(d.status, 'ok', `${row}/${item}: wrap=${d.wrap} minWidth=${d.minWidth}`)
  }
})

it('DashboardScreen 读数格:不得再用 numberOfLines 截断,改用 minWidth', () => {
  const t = read(DASH)
  const d = checkNoTruncation(t)
  if (d.status === 'unjudged') throw new Error(`${d.reason} ⇒ 本例失去鉴别力,要改判据而不是删断言`)
  eq(d.status, 'ok', '截断判据')
  const body = styleBody(t, 'cell')
  if (body === null) throw new Error('取不到 cell 样式体 ⇒ 本例失去鉴别力')
  if (!/minWidth/.test(body)) throw new Error('cell 缺 minWidth ⇒ 去掉 numberOfLines 后没有兜底,长读数会直接折行')
})

// ─── 反向锁:摘掉保护,判据必须翻红(否则本档只是装饰)───
it('反向锁:摘掉 minWidth ⇒ 翻红', () => {
  const t = read(INCOME).replace(/minWidth:\s*112/, '')
  eq(checkCellPair(t, 'summaryRow', 'summaryItem').status, 'red', 'status')
})
it('反向锁:摘掉 flexWrap ⇒ 翻红(只有 minWidth 不够,行不换行就会溢出)', () => {
  const t = read(INCOME).replace(/flexWrap:\s*'wrap'/, 'flexShrink: 1')
  eq(checkCellPair(t, 'summaryRow', 'summaryItem').status, 'red', 'status')
})
it('反向锁:把 numberOfLines 加回 Dashboard ⇒ 截断判据必须翻红', () => {
  const t = read(DASH).replace('<Text style={styles.cardValue}>', '<Text style={styles.cardValue} numberOfLines={1}>')
  if (t === read(DASH)) throw new Error('夹具没生效(源文本形状变了)⇒ 本例失去鉴别力,必须改判据而不是删断言')
  eq(checkNoTruncation(t).status, 'red', 'status')
})
it('反向锁:Dashboard 的 minWidth 可被摘掉(证明上面那条断言不是永真)', () => {
  const t = read(DASH).replace(/minWidth:\s*150/, '')
  if (/minWidth/.test(styleBody(t, 'cell') ?? ''))
    throw new Error('夹具没摘干净 ⇒ "cell 必须有 minWidth" 那条断言可能永真')
})

it('形状锁:三个文件仍在原位(被搬走/改名要显式改本档,不得静默零断言)', () => {
  for (const p of [INCOME, USAGE, DASH]) {
    try {
      execFileSync('git', ['ls-files', '--error-unmatch', p], { cwd: ROOT, stdio: ['ignore', 'ignore', 'ignore'] })
    } catch {
      throw new Error(`${p} 不在版本控制里 ⇒ 本档断言会静默落空`)
    }
  }
})

console.log(`\n${fail === 0 ? '✅' : '❌'} rn-readout-cell-guard ${pass}/${pass + fail} 通过`)
process.exit(fail === 0 ? 0 : 1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
