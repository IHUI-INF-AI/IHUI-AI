// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F6 `findDupBlocks` 的 drifted 判据:"块"的定义 + 首行须是登记行 + 正文重合率阈。
 *
 * 修的是什么:drifted 此前把两件不同的事读成"首行相同而正文漂移"。
 *  ① 切分产物 —— 块 = 连续 `- ` 行的极大行段,首行常常是某条登记下的续行小项(缺复选框),
 *     压根不是"同一件事登记两次";HEAD 面 24 组里 6 组是这一型。
 *  ② 首行撞号是**分组的恒等条件**,不是漂移的证据;同批次登记开头格式一致,撞号纯巧合,
 *     正文讲的完全是另一件事。HEAD 面 4 组除首行外共享行数 = 0。
 *
 * ⚠ 本文件最要紧的一条是 T1:每条"不该报的没报"的用例都配一条"真漂移仍被报出"的正向用例。
 *   只测防误报方向的判据,在判据整体失灵(收零块)时会**假绿** —— 本仓已踩过多次。
 *   T1/T4/T5 都钉住"仍看得见"这一半,任何把判据改成恒不报出的改法都会当场翻红。
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { findDupBlocks } from '../lib/plan-task-index.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const LIB = path.join(ROOT, 'scripts', 'lib', 'plan-task-index.mjs')

/** 一条 >=40 字符的登记正文(块内每行都得够长,否则连 `DUP_BLOCK_MIN_LINE_LEN` 都过不了)。 */
const row = (id, tail) => `- [ ] **G-${id} ${tail}** —— 这是一行长度足够的登记正文,用来把块撑到门槛以上。`

/** 造 N 份"首行相同"的块:第 1 份是首行+bodyA,其余份首行相同但 body 是 bodyB(漂移)。 */
function twoBlocks(bodyA, bodyB, first = row(900, '首行相同的登记')) {
  return [[first, ...bodyA], [first, ...bodyB]]
    .map((ls) => ls.join('\n'))
    .join('\n\n')
}

/** T1 真漂移:两份块除首行外**大面积**重合(同一件事被登记两遍,正文各自演化)⇒ 必须仍被报出。 */
test('T1 真漂移块(正文大面积重合)必须仍被报出 —— 防误报用例的配重,判据收零块时本条要翻红', () => {
  const shared = [row(901, '共享正文第一行'), row(902, '共享正文第二行'), row(903, '共享正文第三行')]
  const a = [...shared, row(904, '只在 A 侧多出来的第四行')]
  const b = [...shared, row(905, '只在 B 侧多出来的第四行')]
  const out = findDupBlocks(twoBlocks(a, b))
  assert.equal(out.drifted.length, 1, `真漂移必须仍报出一组,实测 ${JSON.stringify(out.drifted)}`)
  assert.equal(out.drifted[0].variants, 2, '两份都必须在组内')
  assert.match(out.drifted[0].first, /G-900/, '首行定位信息必须仍在返回结构里')
})

/** T2 误判 B:首行撞号但正文两件完全不同的任务 ⇒ 不报。 */
test('T2 误判 B 形态(首行相同、正文交集 0)必须不报,且同批的 T1 仍报 —— 反向用例自身不得有牙', () => {
  const out = findDupBlocks(twoBlocks(
    [row(911, '完全不同的任务甲第一行'), row(912, '完全不同的任务甲第二行')],
    [row(921, '完全不同的任务乙第一行'), row(922, '完全不同的任务乙第二行')],
  ))
  assert.equal(out.drifted.length, 0, `正文零重合必须不报,实测 ${JSON.stringify(out.drifted)}`)
  // 反向用例自身也要证明"这把尺子有牙":同形状但正文大面积重合时必须报
  const shared = [row(931, '共有的正文一'), row(932, '共有的正文二'), row(933, '共有的正文三')]
  const back = findDupBlocks(twoBlocks([...shared, row(934, '甲独有')], [...shared, row(935, '乙独有')]))
  assert.equal(back.drifted.length, 1, '同一入口下,正文重合就必须报出来 —— 否则本条是假绿')
})

/** T3 切分产物:块首行缺复选框(某条登记下的续行小项)⇒ 不算"登记重复"。
 *  ⚠ 两份正文**大面积重合**(远超阈值)—— 否则这条会被"重合率"那一半顺带剔掉,
 *    于是"删掉登记行过滤"这种变异仍然全绿,本条就只剩一个名堂(2026-10-05 首轮变异实测到)。 */
test('T3 切分产物(首行不是登记行、缺复选框)必须不报 —— 正文刻意大面积重合,只可能由登记行过滤剔出', () => {
  const shared = [row(941, '小项甲'), row(942, '小项乙'), row(943, '小项丙')]
  const plain = '- **这是某条登记下的续行小项,没有复选框,所以它不是一次登记** —— 行长足够长以越过长度门槛。'
  const out = findDupBlocks(twoBlocks(
    [...shared, row(944, '小项丁')],
    [...shared, row(945, '小项戊')],
    plain,
  ))
  assert.equal(out.drifted.length, 0, `首行非登记行的块必须剔出,实测 ${JSON.stringify(out.drifted)}`)
  // 对照:同样的首行,只把它变成登记行(加复选框)⇒ 必须被报。正文同样大面积重合,
  // 所以两例之差**只有**"首行是不是登记行"这一条。
  const asRow = '- [ ] **这是某条登记下的续行小项,没有复选框,所以它不是一次登记** —— 行长足够长以越过长度门槛。'
  const ctrl = findDupBlocks(twoBlocks(
    [...shared, row(944, '小项丁')],
    [...shared, row(945, '小项戊')],
    asRow,
  ))
  assert.equal(ctrl.drifted.length, 1, '加回复选框后必须报 —— 否则剔出条件放错了位置')
})

/** T4 边界:重合率恰好在阈值下 / 阈值上各一例,证明阈值不是随手挑的。
 *  两块正文交集恒为 1 行时,Jaccard = 1/(n+m-1):
 *  - n=19,m=2 ⇒ 1/20 = **恰 0.05** ⇒ 命中 `>=` 那一侧,必须报;
 *  - n=20,m=2 ⇒ 1/21 ≈ 4.76% ⇒ 落在阈下,必须剔。
 *  正文最短 2 行是硬约束:块总行数要 >= `DUP_BLOCK_MIN_LINES`(3),而首行已被分组键占用。 */
test('T4 边界:正文 Jaccard 恰在阈值上(1/20=5.00%)与阈下(1/21≈4.76%)各一例', () => {
  const mk = (n, m) => {
    const shared = row(950, '两侧共有的那一行')
    const big = [shared, ...Array.from({ length: n - 1 }, (_, i) => row(1000 + i, `长侧独有第 ${i + 1} 行`))]
    const small = [shared, row(2000 + m, `短侧独有第 ${m} 行`)]
    return { src: twoBlocks(big, small), n, m }
  }
  const at = mk(19, 2) // J = 1/(19+2-1) = 0.05 整
  assert.ok(Math.abs(1 / ((at.n + at.m) - 1) - 0.05) < 1e-12, '本例必须精确落在阈值上')
  assert.equal(findDupBlocks(at.src).drifted.length, 1, 'J=5.00%(阈值整)必须报出 —— 这条钉的是 >= 那一侧')

  const under = mk(20, 2) // J = 1/21 ≈ 4.76%
  assert.ok(1 / ((under.n + under.m) - 1) < 0.05, '本例必须落在阈值下')
  assert.equal(findDupBlocks(under.src).drifted.length, 0, 'J=4.76%(阈下)必须剔出')
})

/** T5 源码锁:阈值与"首行须是登记行"这两条判据不得被静默删掉(否则 T2/T3 会假绿,改判据的人看不出)。 */
test('T5 源码锁:重合率阈值与"首行须是登记行"两条判据不得被静默删除或改成恒真', async () => {
  const src = readFileSync(LIB, 'utf8')
  assert.match(src, /const DUP_BLOCK_MIN_BODY_OVERLAP = 0\.05/, '正文重合率阈值 0.05 必须还在(改了值也要同时改本条)')
  assert.match(src, /bodyOfRow\(seg\[0\]\) === null\) continue/, '"首行须是登记行"这条过滤必须还在')
  assert.match(src, /bodyOverlap\(group\[a\]\.body, group\[b\]\.body\) >= DUP_BLOCK_MIN_BODY_OVERLAP/,
    'drifted 分组仍须用正文 Jaccard 过阈,不许退化成"只看首行"')
  // 变异自证:把阈值改成 0(恒真)后,T2/T4 的"不报"必须翻红 —— 证明这把锁真在守判据
  const mutated = src
    .replace('const DUP_BLOCK_MIN_BODY_OVERLAP = 0.05', 'const DUP_BLOCK_MIN_BODY_OVERLAP = 0')
    .replace('const DUP_BLOCK_MIN_BODY_OVERLAP = 0.05', 'const DUP_BLOCK_MIN_BODY_OVERLAP = 0')
  assert.notEqual(mutated, src, '变异替换必须真的改到源码 —— 否则本条是假锁')
  const dir = mkScratch('f6-drifted-')
  try {
    const mutatedPath = path.join(dir, 'mutant.mjs')
    const { writeFileSync } = await import('node:fs')
    const { pathToFileURL } = await import('node:url')
    // 变异体落在 scratch 里,它的相对导入会指空 ⇒ 把那条相对导入改写成绝对 file:// URL
    // (Windows 上 ESM 绝对路径同样必须走 file://,裸 'g:\...' 会撞 ERR_UNSUPPORTED_ESM_URL_SCHEME)
    const depUrl = pathToFileURL(path.join(ROOT, 'scripts', 'check-plan-line-loss.mjs')).href
    const mutatedWithDeps = mutated.replace(
      /from '\.\.\/check-plan-line-loss\.mjs'/,
      `from ${JSON.stringify(depUrl)}`,
    )
    assert.notEqual(mutatedWithDeps, mutated, '变异必须真的改到阈值那行 —— 否则本条是假锁')
    writeFileSync(mutatedPath, mutatedWithDeps)
    const probe = [
      `import { findDupBlocks } from ${JSON.stringify(pathToFileURL(mutatedPath).href)}`,
      "const row = (id, tail) => `- [ ] **G-${id} ${tail}** —— 这是一行长度足够的登记正文,用来把块撑到门槛以上。`",
      "const first = row(900, '首行相同的登记')",
      "const a = [row(911, '完全不同的任务甲第一行'), row(912, '完全不同的任务甲第二行')]",
      "const b = [row(921, '完全不同的任务乙第一行'), row(922, '完全不同的任务乙第二行')]",
      'const src = [[first, ...a].join("\\n"), [first, ...b].join("\\n")].join("\\n\\n")',
      'process.stdout.write(String(findDupBlocks(src).drifted.length))',
    ].join('\n')
    const probePath = path.join(dir, 'probe.mjs')
    writeFileSync(probePath, probe)
    const r = spawnSync(process.execPath, [probePath], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    })
    assert.equal(r.status, 0, `变异体探针必须能跑起来,stderr=${r.stderr}`)
    assert.equal(r.stdout.trim(), '1', '阈值改成 0(恒真)后,正文零重合那一组必须被报出来 —— 否则锁没守住判据')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
