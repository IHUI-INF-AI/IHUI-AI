#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 测试档需输出逐例读数 */
/**
 * 镜像档 —— 守门 240(大屏读数不得断行)
 *
 * §22c 纪律:判据一律 import 源脚本的 __test__,本文件**不复制任何常量或判定**。
 * 跑法:node scripts/tests/check-readout-no-break.test.mjs
 *
 * 存在的理由:2026-10-24 机主指认「AI 号池」面板把「6天19小时」切成
 * 「6天19小 / 时」。这个缺陷的三层成因(读数没 nowrap / 列宽下限小于读数单行需求 /
 * 两栏阈值没跟着列宽走)每一层都能被一次"看起来无关"的重构单独摘掉,而摘掉任何一层
 * 都不会有别的门响。所以每条判据都要有"摘掉即翻红"的成对夹具,并且**枚举到 0 个输入
 * 时不得冒绿**。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as G } from '../check-readout-no-break.mjs'

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
function eq(actual, expected, what) {
  if (actual !== expected) throw new Error(`${what}: 期望 ${expected},实得 ${actual}`)
}
function rules(r) {
  return r.violations.map((x) => x.rule)
}

const worktree = readFileSync(resolve(ROOT, G.TARGET_REL), 'utf8')
const head = execFileSync('git', ['show', `HEAD:${G.TARGET_REL}`], {
  encoding: 'utf8',
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  maxBuffer: 64 * 1024 * 1024,
})

it('形状锁:__test__ 出口的判据单元齐全(缺一个就说明源脚本被改薄)', () => {
  for (const k of [
    'REPO_ROOT',
    'TARGET_REL',
    'CELLS_PER_GROUP',
    'DURATION_RE',
    'gridClassBefore',
    'R8_SCOPE_PREFIXES',
    'inR8Scope',
    'scanClassReadouts',
    'r8Delta',
    'parseCellMin',
    'parseGapPx',
    'expectedSplitThreshold',
    'judge',
  ]) {
    if (G[k] === undefined) throw new Error(`__test__ 缺 ${k}`)
  }
})

// ─── R8:全仓差值棘轮(§0.5 锚点=该文件 HEAD 自身;§12e 存量不得升绝对零容忍)───
it('R8 净增一处无 nowrap 的大字号数值读数 ⇒ 判红', () => {
  const base = '<div className="text-lg font-semibold tabular-nums">{v}</div>'
  const face = `${base}\n<div className="text-xl font-mono">{v}</div>`
  const d = G.r8Delta(base, face)
  eq(d.status, 'red', 'status')
  eq(d.added, 1, '净增数')
})

it('R8 存量原样搬动(数量不变)⇒ 不拦,免得造恒红门', () => {
  const t = '<div className="text-lg font-semibold tabular-nums">{v}</div>'
  eq(G.r8Delta(t, `${t}\n// 加一行注释`).status, 'ok', 'status')
})

it('R8 修好一处(数量下降)⇒ 绿 —— 棘轮不得反向咬人', () => {
  const base = '<div className="text-lg tabular-nums">{v}</div>'
  const face = '<div className="text-lg tabular-nums whitespace-nowrap">{v}</div>'
  const d = G.r8Delta(base, face)
  eq(d.status, 'ok', 'status')
  eq(d.after, 0, '修好后计数')
})

it('R8 基线读不到 ⇒ 未判定,不得猜 0 再判红(§0.3)', () => {
  eq(G.r8Delta(null, '<div className="text-lg tabular-nums">{v}</div>').status, 'unjudged', 'status')
})

it('R8 射程:web/ui-react/extension 进,形态不同的端与测试/构建产物不进', () => {
  if (!G.inR8Scope('apps/web/app/(main)/x/page.tsx')) throw new Error('apps/web 未进射程')
  if (!G.inR8Scope('packages/ui-react/src/components/x.tsx')) throw new Error('ui-react 未进射程')
  if (!G.inR8Scope('apps/extension/entrypoints/x.tsx')) throw new Error('extension 未进射程')
  if (G.inR8Scope('apps/miniapp-taro/src/x.tsx'))
    throw new Error('miniapp 不该在本档射程(RN/Taro 无 class 串形态,判据须另立)')
  if (G.inR8Scope('apps/web/src/x.test.tsx')) throw new Error('测试文件应排除')
  if (G.inR8Scope('apps/web/.next/static/chunks/x.js')) throw new Error('构建产物应排除')
})

it('R8 只数真 class 串,注释行不得计入(否则存量数是假的)', () => {
  eq(G.scanClassReadouts('// <div className="text-lg tabular-nums">示例</div>').length, 0, '注释行计数')
  eq(G.scanClassReadouts('<div className="text-lg tabular-nums">{v}</div>').length, 1, '真代码计数')
})

it('R8 小字号数值(11px 列表读数)不算 —— 只量大字号读数格', () => {
  eq(G.scanClassReadouts('<span className="wb-num text-[11px] text-muted-foreground">{v}</span>').length, 0, '小字号计数')
})

it('基准:工作区面(带修复)必须全绿且无未判定', () => {
  const r = G.judge(worktree)
  eq(r.violations.length, 0, `violations=${rules(r).join(',')}`)
  eq(r.unjudged.length, 0, 'unjudged')
})

it('反向锁 R1:摘掉读数 nowrap ⇒ 翻红', () => {
  const r = G.judge(worktree.replace(/(wb-num[^']*)whitespace-nowrap/, '$1'))
  if (!rules(r).includes('R1')) throw new Error(`未翻红:${rules(r).join(',') || '无'}`)
})

it('反向锁 R2:删掉 --wb-cell-min 定义 ⇒ 翻红', () => {
  const r = G.judge(worktree.replace(/--wb-cell-min:\s*\d+px;?/, ''))
  if (!rules(r).includes('R2')) throw new Error(`未翻红:${rules(r).join(',') || '无'}`)
})

it('反向锁 R2:常数定义了但没人消费 ⇒ 翻红(悬空常数=没上车)', () => {
  const r = G.judge(worktree.replace(/minmax\(\s*var\(--wb-cell-min\)/g, 'minmax(143px'))
  if (!rules(r).includes('R2')) throw new Error(`未翻红:${rules(r).join(',') || '无'}`)
})

it('反向锁 R3:c3 档改写死数字 ⇒ 翻红(两份数字必然漂移)', () => {
  const r = G.judge(worktree.replace('minmax(var(--wb-cell-min), 1fr)', 'minmax(143px, 1fr)'))
  if (!rules(r).includes('R3')) throw new Error(`未翻红:${rules(r).join(',') || '无'}`)
})

it('反向锁 R3:c3 档整条被删 ⇒ 翻红', () => {
  const r = G.judge(worktree.replace(/\.wb-cells-c3\s*\{[^}]*\}/, ''))
  if (!rules(r).includes('R3')) throw new Error(`未翻红:${rules(r).join(',') || '无'}`)
})

it('反向锁 R4:wb-split-c3 面板内某组退回裸 wb-cells ⇒ 翻红', () => {
  const r = G.judge(worktree.replace(/className="wb-cells wb-cells-c3 grid/g, 'className="wb-cells grid'))
  if (!rules(r).includes('R4')) throw new Error(`未翻红:${rules(r).join(',') || '无'}`)
})

it('未判定不冒绿 R4:把所有 wb-split-c3 标记整块摘掉 ⇒ 不得判成通过', () => {
  const stripped = worktree.replace(/wb-split-c3 /g, '').replace(/ wb-split-c3/g, '')
  const r = G.judge(stripped)
  if (r.violations.length === 0 && r.unjudged.length === 0)
    throw new Error('修复被整块删除却报绿 ⇒ 判据输入集空了必须喊未判定')
  if (!r.unjudged.some((x) => x.startsWith('R4'))) throw new Error(`未点名为 R4 无输入:${r.unjudged.join(' | ') || '无'}`)
})

it('反向锁 R6:时长读数所在网格退回裸 auto-fit ⇒ 翻红', () => {
  const r = G.judge(worktree.replace('className="wb-cells wb-cells-6 grid gap-1.5"', 'className="wb-cells grid gap-1.5"'))
  if (!rules(r).includes('R6')) throw new Error(`未翻红:${rules(r).join(',') || '无'}`)
})

it('R6 只认「值表达式里真的出现 fmtDuration」的格(不得靠 class 名猜)', () => {
  const withDuration = G.judge(worktree)
  if (withDuration.violations.some((x) => x.rule === 'R6'))
    throw new Error('当前面已收口却报 R6 ⇒ 判据在误报,查 gridClassBefore 是否漏了 mt-2 前缀')
})

it('反向锁 R5:只改列宽下限、不改栏阈值 ⇒ 翻红(两者必须同源)', () => {
  const r = G.judge(worktree.replace(/--wb-cell-min:\s*\d+px/, '--wb-cell-min: 160px'))
  if (!rules(r).includes('R5')) throw new Error(`未翻红:${rules(r).join(',') || '无'}`)
})

it('反向锁 R5:只改栏阈值、不改列宽下限 ⇒ 翻红', () => {
  const r = G.judge(worktree.replace(/@container \(min-width: (\d+)px\) \{\n  \.wb-split-c3/, '@container (min-width: 620px) {\n  .wb-split-c3'))
  if (!rules(r).includes('R5')) throw new Error(`未翻红:${rules(r).join(',') || '无'}`)
})

it('R5 算式的三个输入都取自被审面(不得凭记忆填数)', () => {
  const exp = G.expectedSplitThreshold(worktree)
  eq(exp.cellMin, G.parseCellMin(worktree), 'cellMin')
  eq(exp.gapCells, G.parseGapPx(worktree, 'cells'), 'gapCells(列间距)')
  eq(exp.gapSplit, G.parseGapPx(worktree, 'split'), 'gapSplit(栏间距)')
  eq(exp.value, 2 * (G.CELLS_PER_GROUP * exp.cellMin + (G.CELLS_PER_GROUP - 1) * exp.gapCells) + exp.gapSplit, '阈值复算')
  const inCss = Number(worktree.match(/@container \(min-width: (\d+)px\) \{\n  \.wb-split-c3/)[1])
  eq(inCss, exp.value, 'CSS 里的阈值 vs 门内复算')
})

it('列间距与栏间距是两把不同的尺子(读串了 R5 会静默错)', () => {
  const cells = G.parseGapPx(worktree, 'cells')
  const split = G.parseGapPx(worktree, 'split')
  if (cells === null || split === null) throw new Error('两把尺子有解析不出的 ⇒ 未判定')
  if (cells === split)
    console.log(`    ℹ 列间距与栏间距当前同为 ${cells}px(相等时本用例不具鉴别力,仅记录)`)
})

it('空文本不得冒绿(§0.3 枚举到 0 判死不记绿)', () => {
  const r = G.judge('')
  if (r.violations.length === 0 && r.unjudged.length === 0) throw new Error('空面被判成通过')
})

it('HEAD 面必须比工作区多报至少一条规则(证明本档测的是真缺口,不是自造夹具)', () => {
  if (worktree === head) {
    console.log('    ℹ 工作面 == HEAD(修复已全部入库),本例无从对照,跳过')
    return
  }
  const h = new Set(rules(G.judge(head)))
  const w = new Set(rules(G.judge(worktree)))
  const extra = [...h].filter((x) => !w.has(x))
  if (extra.length === 0)
    throw new Error(`HEAD 报 [${[...h].join(',') || '无'}] 与工作区 [${[...w].join(',') || '无'}] 无差 ⇒ 判据测不出"未修"与"已修"`)
})

console.log(`\n${fail === 0 ? '✅' : '❌'} check-readout-no-break 镜像测试 ${pass}/${pass + fail} 通过`)
process.exit(fail === 0 ? 0 : 1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
