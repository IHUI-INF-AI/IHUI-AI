// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 130 · F9「撞号」判据的**题面归一**取材口径(§22c 镜像测试;2026-10-05 立)。
 *
 * 钉的是三型**合法形态不得被算成第二次登记**(三型都是判据/归并门自己产出的形状):
 *  ① 行尾 `〔…〕` 注记 —— `cleanTitle` 的截断集里此前只有 `【`/`[` 没有 U+3014 `〔`,于是截断点
 *     被推到注记**内部**(HEAD 现读:`68` 的题面成了「…新模型〔」、`74` 成了「…TUI决策〔第四份同主键副本」)
 *     ⇒ 同一件事两个题面 ⇒ 每多一份带尾注的副本就"新增一个撞号组"(§1 明文那一格);
 *  ② 前缀套叠 —— `G-278`:`D6-G1v2执行器` ⊂ `D6-G1v2执行器适配器已入库并单测真跑`。F4c 早已把
 *     "同主键 + 精确前缀"认定为**同一件事的两份**,F9 不认 ⇒ 又凭空一组;
 *  ③ 题面**开头**的他号引用 —— `G-916432` 那两行的题面写成 `D129前端子集已落地` / `D129根治半落地`:
 *     那一段 `D129` 是叙述位引用,不是本行议题的名字(§1:宁可少判,也不能把引用判成撞号)。
 *
 * 两条红线贯穿全档:
 *  - **判据仍有牙**:真撞号(两个标题既不互相前缀套叠、也不只差一枚尾注/一段他号)必须照样成组;
 *    并桶用的是"精确前缀"而不是相似度 ⇒ 分叉形态(甲 ⊂ 甲乙 与 甲 ⊂ 甲丙)必须仍剩 2 个标题。
 *  - **变异自证**:把三型各自的补丁摘掉,对应反向用例必须**翻红**;不红就说明那条用例是假的
 *    ("判据失效的表现永远是安静" —— §22c / 守门 70/76/81/103 同族)。
 *  - **阳性对照不得拿台账当下的欠账当前提**(2026-10-10 由三枚自伤逼出,承票 G-814417 验收 ③):
 *    本文件原先要求"HEAD 面 F9 读得出组"、"摘掉 ② 后 `G-278` 必须重新成组"、"摘掉 ①+② 后 `74` 必须成组",
 *    而这三笔存量已被归并轮**付清**(现读 `G-278` / `74` 的待办行数均为 0)⇒ 断言当场变成恒红。
 *    账还完的那天尺子从防线变成缺陷,正是本票要防的形状。正解是把对照**种进真仓字节**
 *    (见下方 `plantOnHead`):生产尺子必须看不见它(证明归一收得住)、摘掉对应一档必须重新看见它
 *    (证明判据有牙)—— 两头都不依赖仓库此刻欠多少账,同时仍跑在 3 MB 的实际取材面上(证明不是小夹具自证)。
 *
 * 只读生产文件;变异跑在临时目录的复制件上(共享工作区里改生产文件会伤到并发会话,§12)。
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, cpSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  auditPlan,
  f9Faces,
  f9DropForeignLead,
  isExactPrefixNesting,
  findPrefixNestedCopies,
  compositeKeyOf,
  keyOfRow,
  keyInWindow,
  stripOwnKey,
} from '../lib/plan-task-index.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const LIB_SRC = readFileSync(path.join(ROOT, 'scripts', 'lib', 'plan-task-index.mjs'), 'utf8')
const headPlan = () => {
  try {
    return execFileSync('git', ['show', 'HEAD:PROJECT_PLAN.md'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch {
    throw new Error('取不到 HEAD 版计划文档 ⇒ 无从复核,不算通过')
  }
}
const groupsOf = (content) => f9Faces(content).collisions
const declaredKeys = (content) => groupsOf(content).map((g) => [String(g.key), g.titleCount])
/**
 * 把夹具**接到真仓面尾巴上** —— 判据吃的仍是 HEAD 的那 3 MB 字节,
 * 只是额外带上我们要观察的那几行。种进去的行用的都是 `G-5xx` / 已作废的号段,
 * 不会与台账里的真行混淆(见下方 `PLANT_*` 注释)。
 */
const plantOnHead = (extra) => headPlan().replace(/\n+$/, '\n') + '\n' + extra + '\n'

// ── 夹具:三型假阳性(修前红 / 修后必须绿)──────────────────────────────────
const F_TAIL =
  '- [ ] 68. 流式中切换模型 → 终止后自动带入新模型\n' +
  '- [ ] 68. 流式中切换模型 → 终止后自动带入新模型 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记,派单以那条为准。〕'
const F_NEST =
  '- [ ] **G-500 D6-G1 v2 执行器:适配器入库 + 四个生产 surface 全部接线** —— 交付说明。\n' +
  '- [ ] **G-500 D6-G1 v2 执行器适配器已入库并单测真跑,但四个生产 surface 仍刻意未接** —— 交付说明。'
const F_FOREIGN =
  '- [ ] **G-501 登录态串号甲**:第一件事。\n' +
  '- [ ] **G-501 D129 登录态串号甲**:同一件事,只是题面开头多写了别人的号(承 D129,不占该号)。'
// 真仓逐字样本(HEAD 面 L10629 / L22524,2026-10-05 现读)—— §22c 红线:不能全用自造夹具。
const REAL_68 =
  '- [ ] 68. 流式中切换模型 → 终止后自动带入新模型\n' +
  '- [ ] 68. 流式中切换模型 → 终止后自动带入新模型 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「68 · 流式中切换模型→终止后自动带入新模型」,派单以那条为准,本行不再单独派单。〕'

// ── 阳性对照:真撞号必须照样判红(修前修后都红 ⇒ 这一笔不是放松)──────────────
const TRUE_PAIR = '- [ ] **G-502 真撞号甲**:第一件事。\n- [ ] **G-502 真撞号乙**:另一件事。'
const BRANCHED =
  '- [ ] **G-503 登录态串号**:一件事。\n' +
  '- [ ] **G-503 登录态串号已修**:第二件事。\n' +
  '- [ ] **G-503 登录态串号复发**:第三件事。'

test('① 行尾 `〔…〕` 副本注记不再被切成第二个题面(自造夹具 + 真仓逐字两行)', () => {
  for (const [name, face] of [['自造夹具', F_TAIL], ['真仓 68 两行', REAL_68]]) {
    assert.deepEqual(groupsOf(face), [], `${name} 不得读成撞号,实测 ${JSON.stringify(declaredKeys(face))}`)
  }
  assert.equal(groupsOf(TRUE_PAIR).length, 1, '阳性对照必须判红,否则"归一"就变成了放松')
})

test('② 精确前缀套叠的两个题面并成一份(G-278 那一型);分叉形态必须仍剩两个标题', () => {
  assert.deepEqual(groupsOf(F_NEST), [], `前缀套叠不得读成撞号,实测 ${JSON.stringify(declaredKeys(F_NEST))}`)
  const branched = groupsOf(BRANCHED)
  assert.equal(branched.length, 1, `分叉形态必须仍读一组(并桶不许吞掉分叉),实测 ${JSON.stringify(declaredKeys(BRANCHED))}`)
  assert.equal(branched[0].titleCount, 2, `分叉必须剩 2 个标题,实测 ${branched[0].titleCount}`)
})

test('③ 题面开头的他号引用让位;剥完给不出实质题面时逐字退回原样(不没收已有覆盖面)', () => {
  assert.deepEqual(groupsOf(F_FOREIGN), [], `他号引用位不得读成撞号,实测 ${JSON.stringify(declaredKeys(F_FOREIGN))}`)
  const thin = '- [ ] **G-504 D160 补注**:指针行。\n- [ ] **G-504 运维班次这一格已补**:另一件事。'
  const g = groupsOf(thin)
  assert.equal(g.length, 1, `剥完只剩 2 字时必须保留原标题并照样判红,实测 ${JSON.stringify(declaredKeys(thin))}`)
  assert.ok(
    g[0].titles.some((t) => t.title === 'D160补注'),
    `短题面必须逐字退回原样,实测 ${JSON.stringify(g[0].titles.map((t) => t.title))}`,
  )
})

test('唯一实现锁:① 住在 cleanTitle、② 走 isExactPrefixNesting、③ 走 stripOwnKey,没有第二份尺子', () => {
  // ① 的截断住在 cleanTitle 里,且带"行首 `〔` 不吃"的守卫(HEAD 现读 28 行的题面本来就是 `〔…`)
  assert.match(LIB_SRC, /const at = t\.indexOf\('〔'\)/, 'cleanTitle 里没有 `〔` 的截断出口 ⇒ ① 被搬走了')
  assert.match(LIB_SRC, /at > 0 \? t\.slice\(0, at\) : t/, '① 的"行首 `〔` 不截"守卫缺失 ⇒ 会没收 28 行的既有题面')
  // ② 关系只有一份:F4c 保留 C8 逐字守卫,同时与本出口做**自毁式对账**(只改一侧就当场炸)
  assert.match(LIB_SRC, /isExactPrefixNesting\(a\.raw, b\.raw\) !== true/, 'F4c 与 F9 的前缀对账缺失 ⇒ 两处会静默漂开')
  assert.match(LIB_SRC, /if \(a\.raw\.length >= b\.raw\.length\) continue\n\s*if \(!b\.raw\.startsWith\(a\.raw\)\) continue/, 'C8 要求的逐字守卫缺失')
  // ③ 不新增第二份编号正则:全库只允许一处窗口扫描 `new RegExp(TASK_ID_PATTERN`
  const scans = LIB_SRC.split('new RegExp(TASK_ID_PATTERN').length - 1
  assert.equal(scans, 1, `编号窗口扫描出现 ${scans} 份(应为 1)⇒ 取号又有了第二把尺子`)
  assert.match(LIB_SRC, /const foreign = keyInWindow\(title\)/, '③ 没走 keyInWindow ⇒ keyOfRow 与 F9 用了两把取号尺子')
  // keyOfRow 拆出 keyInWindow 必须逐字等价
  assert.equal(keyInWindow('**G-505. 题面**'), 'G-505')
  assert.equal(keyOfRow('- [ ] **G-505. 题面**'), keyInWindow('G-505. 题面'), 'keyOfRow 与 keyInWindow 不同形')
  assert.equal(stripOwnKey('D129根治半落地', 'D129', 'strict'), '根治半落地')
})

test('真仓 HEAD 面**性质**锁(不判数量 ⇒ 不因并发提交闪红):三型残留各读 0', () => {
  const txt = headPlan()
  assert.ok(txt.length > 100000, 'HEAD 台账读数过短 ⇒ 取材失败,不算通过')
  const face = f9Faces(txt)
  // 尺子活性**不靠"台账此刻还欠着撞号"来证明**(那是刚才三枚恒红的成因)。
  // 改为:把一对真撞号种进同一份 HEAD 字节 —— 读不出组就是尺子瞎,与仓库欠多少账无关。
  const sighted = f9Faces(plantOnHead(TRUE_PAIR)).collisions.map((g) => String(g.key))
  assert.ok(
    sighted.includes('G-502'),
    `种进真仓面的真撞号都读不出 ⇒ 尺子失明(不是"台账没欠账"),实测 ${JSON.stringify(sighted)}`,
  )
  // 真仓读数只报名不判:归并轮会随时改变它,把它当前提就等于把防线做成定时炸弹。
  console.info(`ℹ 真仓面现读:F9 声明位组 ${face.collisions.length} · 宽口径 ${face.wide.length}(不判数量,只判残留)`)
  const residue = []
  for (const g of face.collisions) {
    const names = g.titles.map((t) => t.title)
    for (const t of names) {
      // ① 归一后不可能再有"挂着孤儿 `〔`"的题面(`〔` 开头的那一族按 M20 契约不截,故只查 index>0)
      if (t.indexOf('〔') > 0) residue.push([g.key, '①尾注未截', t])
      // ③ 让位必须做到**幂等**:还能再剥出一段可用的他号 ⇒ 说明这一档漏了
      if (f9DropForeignLead(g.key, t) !== t) residue.push([g.key, '③他号未让位', t])
    }
    // ② 同组内不许还剩"互相精确前缀"的两个标题
    for (let i = 0; i < names.length; i++) {
      for (let k = i + 1; k < names.length; k++) {
        if (isExactPrefixNesting(names[i], names[k]) || isExactPrefixNesting(names[k], names[i]))
          residue.push([g.key, '②前缀未并', names[i], names[k]])
      }
    }
  }
  assert.deepEqual(residue, [], `真仓面仍有 ${residue.length} 处三型残留:${JSON.stringify(residue.slice(0, 6))}`)
  // 共用出口没有被改坏:F4c 与 F9 吃同一份归一,种一对尾注副本进真仓面必须报出逐字前缀对。
  // (同上:不拿"真仓此刻还有多少对"当前提 —— 那笔账也会被归并轮付掉。)
  const plantedNested = findPrefixNestedCopies(plantOnHead(F_TAIL)).pairs.filter((p) => /^68#/.test(String(p.key)))
  assert.ok(
    plantedNested.length > 0,
    '种进真仓面的尾注副本对在 F4c 上读 0 对 ⇒ 共用出口被改坏(或行首编号族取不到键),实测 68# 对数 0',
  )
  const nested = findPrefixNestedCopies(txt)
  console.info(`ℹ 真仓面现读:F4c 前缀对 ${nested.pairs.length} · 族 ${nested.groupKeys.length}(只报名,不判数量)`)
  for (const p of nested.pairs)
    assert.ok(isExactPrefixNesting(p.short.raw, p.long.raw), `F4c 报了对不是精确前缀的行(L${p.short.line})`)
})

// ── 变异自证:摘掉哪一型,哪一型的反向证据必须翻红 ──────────────────────────
// ⚠ ① 与 ② 在"标题相同 + 只差行尾注记"这一格上是**重叠**的:摘掉 ① 后题面挂着孤儿 `〔`,
// 而挂尾的那一份恰好是另一份的**精确前缀** ⇒ ② 会替它兜住组数。所以 ① 的变异自证问的是
// ① 真正负责的那一格 —— **复合主键是否还稳定**(F1/F4/F4c 全吃这个键,组数只是 F9 的读数);
// 组数那一条由 ①+② 的**联合变异**证明。把 ① 写成"摘掉就翻组"是假证据(它会不红,而原因不是判据没牙)。
const MUT_KEY_1 = (src) =>
  src.replace(
    /const at = t\.indexOf\('〔'\)\n\s*return \(at > 0 \? t\.slice\(0, at\) : t\)\.slice\(0, TITLE_PREFIX\)/,
    'return t.slice(0, TITLE_PREFIX)',
  )
const MUT_GROUP_2 = (src) =>
  src.replace('function f9CollapsePrefixNested(titles) {', 'function f9CollapsePrefixNested(titles) {\n  return titles')
const MUT_GROUP_3 = (src) =>
  src.replace('function f9DropForeignLead(key, title) {', 'function f9DropForeignLead(key, title) {\n  return title')

const TAIL_A = '- [ ] 68. 流式中切换模型 → 终止后自动带入新模型'
const TAIL_B =
  '- [ ] 68. 流式中切换模型 → 终止后自动带入新模型 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记,派单以那条为准。〕'

// 第 5 格 = "种进真仓字节后必须重新成组"的那一对 `{plant, key}`。
// 2026-10-10 由 `['G-278']` / `['68','74']` 改来:那三笔存量已被归并轮付清
// (现读 `G-278` / `74` 的待办行数 = 0),拿它当前提就是三枚恒红的成因。
// 夹具的编号取 `G-500/501` 这类台账里没有的号 ⇒ 种进去只观察归一行为,不与真行混淆。
const MUTATIONS = [
  ['①尾注截断(cleanTitle)⇒ 复合主键必须漂', MUT_KEY_1, F_TAIL, 'key', null],
  ['②前缀并桶(f9CollapsePrefixNested)⇒ 组数必须回红', MUT_GROUP_2, F_NEST, 'group', { plant: F_NEST, key: 'G-500' }],
  ['③他号让位(f9DropForeignLead)⇒ 组数必须回红', MUT_GROUP_3, F_FOREIGN, 'group', { plant: F_FOREIGN, key: 'G-501' }],
  [
    '①+② 同时摘掉 ⇒ 尾注型必须重新成组',
    (src) => MUT_GROUP_2(MUT_KEY_1(src)),
    F_TAIL,
    'group',
    { plant: F_TAIL, key: '68' },
  ],
]

for (const [name, mutate, fixture, mode, planted] of MUTATIONS) {
  test(`真变异:摘掉 ${name} ⇒ 对应反向证据翻红,而真撞号不受影响`, async () => {
    const dir = mkScratch('plan-task-index-f9-norm-mut-')
    try {
      mkdirSync(path.join(dir, 'scripts', 'lib'), { recursive: true })
      cpSync(path.join(ROOT, 'scripts', 'lib'), path.join(dir, 'scripts', 'lib'), {
        recursive: true,
        filter: (s) => !/[\\/]\tests?[\\/]/.test(s),
      })
      const target = path.join(dir, 'scripts', 'lib', 'plan-task-index.mjs')
      const src = readFileSync(target, 'utf8')
      const mutated = mutate(src)
      assert.notEqual(mutated, src, `变异没命中(${name})⇒ 判据被改名/改形,本锁须同批改`)
      writeFileSync(target, mutated, 'utf8')
      // 传递闭包现取(lib 里任何 `from '../x.mjs'` 的反向依赖),不手写第二份名单(手写必腐烂)
      for (const f of readdirSync(path.join(ROOT, 'scripts', 'lib'))) {
        if (!f.endsWith('.mjs')) continue
        const t = readFileSync(path.join(ROOT, 'scripts', 'lib', f), 'utf8')
        for (const m of t.matchAll(/from\s+['"]\.\.\/([A-Za-z0-9._-]+\.mjs)['"]/g)) {
          const abs = path.join(ROOT, 'scripts', m[1])
          if (existsSync(abs)) cpSync(abs, path.join(dir, 'scripts', m[1]))
        }
      }
      const mod = await import(pathToFileURL(target).href)
      if (mode === 'key') {
        assert.equal(compositeKeyOf(TAIL_A), compositeKeyOf(TAIL_B), '正装面上两行必须同复合主键(这是①存在的理由)')
        assert.notEqual(
          mod.compositeKeyOf(TAIL_A),
          mod.compositeKeyOf(TAIL_B),
          `摘掉${name}后两行的主键必须**漂开**(F1/F4/F4c 从此看不见这份副本),实测两者相等`,
        )
      } else {
        const got = mod.f9Faces(fixture).collisions
        assert.ok(
          got.length >= 1,
          `变异面下「${name}」的反向用例必须重新判成撞号 —— 它不红就说明这条用例是假的,实测 ${JSON.stringify(got.map((g) => g.key))}`,
        )
      }
      assert.equal(mod.f9Faces(TRUE_PAIR).collisions.length, 1, `真撞号在变异面下仍应判红(它本来就该红;${name})`)
      if (planted) {
        // 同一份真仓字节跑 A/B:生产尺子看不见这一型(证明夹具是**假阳性对照**),
        // 摘掉这一档就重新看见(证明判据有牙)。两头都不依赖台账此刻欠多少账。
        const face = plantOnHead(planted.plant)
        const prodKeys = f9Faces(face).collisions.map((g) => String(g.key))
        assert.ok(
          !prodKeys.includes(planted.key),
          `种进真仓面的这一型在生产尺子上已经成组 ⇒ 它不是假阳性对照,摘掉${name}什么也证明不了,实测 ${JSON.stringify(prodKeys)}`,
        )
        const mutKeys = mod.f9Faces(face).collisions.map((g) => String(g.key))
        assert.ok(
          mutKeys.includes(planted.key),
          `摘掉${name}后,种在真仓字节上的这一型必须重新成组(3 MB 实际取材面上),生产面 ${JSON.stringify(prodKeys)} / 变异面 ${JSON.stringify(mutKeys)}`,
        )
      }
    } finally {
      rmScratch(dir)
    }
  })
}

test('定级前提:归一只改取材,F9 仍是"只由声明位分组"且宽口径与判据输入成对报出', () => {
  const face = F_TAIL + '\n' + TRUE_PAIR
  const a = auditPlan(face)
  const f9 = f9Faces(face)
  assert.equal(f9.collisions.length, 1, '判据输入只应剩真撞号那一组')
  assert.equal(f9.wide.length, 1, `宽口径(诊断读数)应与判据输入同形,实测 ${f9.wide.length}`)
  assert.equal(a.counts.f9DeclaredGroups, 1, 'counts 里的声明位读数必须与判据输入同轮同面')
  assert.equal(a.counts.f9WideGroups, 1, 'counts 里的宽口径读数必须成对出现(组数与名单分叉时红点不出名)')
  assert.ok(f9.collisions[0].titles.every((t) => t.lines.length >= 1), '每组标题都得带得上行号(--json 定位面),否则人判无从下手')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
